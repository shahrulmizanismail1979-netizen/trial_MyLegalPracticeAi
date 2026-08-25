// Search-index processor (Phase 08, ADR 0009 §D3).
// Job kind: container.search_index
// Only VERIFIED_JUDICIAL_TEXT / PROBABLE_JUDICIAL_TEXT sections with
// isolation_applied = true contribute to the index. Structurally enforced.

import {
  db,
  researchVerifiedJudgments,
  researchPageSections,
  researchPageExtractions,
  researchCaseMetadata,
  researchUploadBatchItems,
  driveAssets,
  researchHeadnotes,
  researchCatchwords,
} from "@workspace/db";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { enqueue, registerProcessor } from "../processing";
import { ProcessorFailure } from "../processing/handlers";
import type { ProcessorContext } from "../processing/handlers";
import type { DbClient } from "../domain/types";
import { indexJudgment } from "./postgresFtsAdapter";
import { practiceAreaForContributorFolder } from "../drive/classify";
import { logger } from "../../lib/logger";
import { enqueueHeadnotesJob } from "../headnotes/processor";

export const SEARCH_INDEX_JOB_KIND = "container.search_index";
export const SEARCH_INDEX_VERSION = "search_index@1";

// Only these section classifications contribute to the search corpus.
const INDEXABLE_CLASSIFICATIONS = [
  "VERIFIED_JUDICIAL_TEXT",
  "PROBABLE_JUDICIAL_TEXT",
] as const;

async function searchIndexProcessor(ctx: ProcessorContext): Promise<{}> {
  const { job, dbc } = ctx;
  const judgmentId = job.payload["judgmentId"] as number;
  const containerId = job.payload["containerId"] as number;

  if (!Number.isInteger(judgmentId) || !Number.isInteger(containerId)) {
    throw new ProcessorFailure(
      "INVALID_PAYLOAD",
      "search_index job requires integer judgmentId and containerId",
      false,
    );
  }

  const [judgment] = await dbc
    .select()
    .from(researchVerifiedJudgments)
    .where(eq(researchVerifiedJudgments.id, judgmentId));

  if (!judgment) {
    throw new ProcessorFailure(
      "JUDGMENT_NOT_FOUND",
      `Verified judgment ${judgmentId} not found`,
      false,
    );
  }

  // ── Isolation gate ──────────────────────────────────────────────────────
  // Fetch only sections that passed the isolation gate (isolationApplied = true)
  // AND belong to indexable classifications. Publisher editorial content is
  // structurally excluded here.
  const sections = await dbc
    .select({
      id: researchPageSections.id,
      pageId: researchPageSections.pageId,
      classification: researchPageSections.classification,
      spanStartChar: researchPageSections.spanStartChar,
      spanEndChar: researchPageSections.spanEndChar,
    })
    .from(researchPageSections)
    .where(
      and(
        eq(researchPageSections.containerId, containerId),
        eq(researchPageSections.isolationApplied, true),
      ),
    );

  const indexableSections = sections.filter((s) =>
    (INDEXABLE_CLASSIFICATIONS as readonly string[]).includes(s.classification),
  );

  // Gather page IDs for these sections.
  const pageIds = [
    ...new Set(
      indexableSections
        .map((s) => s.pageId)
        .filter((id): id is number => id != null),
    ),
  ];

  let documentText = "";

  if (pageIds.length > 0) {
    const extractions = await dbc
      .select({
        pageId: researchPageExtractions.pageId,
        rawText: researchPageExtractions.rawText,
      })
      .from(researchPageExtractions)
      .where(inArray(researchPageExtractions.pageId, pageIds))
      .orderBy(desc(researchPageExtractions.id));

    const latestByPage = new Map<number, string>();
    for (const ex of extractions) {
      if (!latestByPage.has(ex.pageId) && ex.rawText) {
        latestByPage.set(ex.pageId, ex.rawText);
      }
    }

    // For sections with span offsets, extract only the judicial span;
    // for sections without, use the whole page text (still isolated).
    const textParts: string[] = [];
    for (const section of indexableSections) {
      if (section.pageId == null) continue;
      const pageText = latestByPage.get(section.pageId) ?? "";
      if (
        section.spanStartChar != null &&
        section.spanEndChar != null &&
        section.spanEndChar > section.spanStartChar
      ) {
        textParts.push(pageText.slice(section.spanStartChar, section.spanEndChar));
      } else {
        textParts.push(pageText);
      }
    }
    documentText = textParts.join("\n\n");
  }

  // Fall back to pageRefs text if no isolated sections found.
  if (!documentText && judgment.pageRefs.length > 0) {
    logger.warn(
      { judgmentId, containerId },
      "search_index: no isolated sections found; indexing raw pageRefs text",
    );
    const extractions = await dbc
      .select({
        pageId: researchPageExtractions.pageId,
        rawText: researchPageExtractions.rawText,
      })
      .from(researchPageExtractions)
      .where(inArray(researchPageExtractions.pageId, judgment.pageRefs))
      .orderBy(desc(researchPageExtractions.id));

    const latestByPage = new Map<number, string>();
    for (const ex of extractions) {
      if (!latestByPage.has(ex.pageId) && ex.rawText) {
        latestByPage.set(ex.pageId, ex.rawText);
      }
    }
    documentText = judgment.pageRefs
      .map((id) => latestByPage.get(id) ?? "")
      .join("\n\n");
  }

  // Accepted editorial summaries are searchable content, but drafts and
  // rejected material must never enter the public FTS document. Keep the
  // judicial corpus first and append these summaries so the source text is
  // preserved verbatim and snippets can distinguish the added material.
  const [acceptedHeadnotes, acceptedCatchwords] = await Promise.all([
    dbc
      .select({ number: researchHeadnotes.number, text: researchHeadnotes.text })
      .from(researchHeadnotes)
      .where(
        and(
          eq(researchHeadnotes.judgmentId, judgmentId),
          eq(researchHeadnotes.status, "accepted"),
        ),
      )
      .orderBy(researchHeadnotes.number),
    dbc
      .select({
        sortOrder: researchCatchwords.sortOrder,
        catchwordLine: researchCatchwords.catchwordLine,
      })
      .from(researchCatchwords)
      .where(
        and(
          eq(researchCatchwords.judgmentId, judgmentId),
          eq(researchCatchwords.status, "accepted"),
        ),
      )
      .orderBy(researchCatchwords.sortOrder),
  ]);

  const editorialParts: string[] = [];
  if (acceptedHeadnotes.length > 0) {
    editorialParts.push(
      "ACCEPTED HEADNOTES:\n" +
        acceptedHeadnotes
          .map((headnote) => `${headnote.number}. ${headnote.text}`)
          .join("\n"),
    );
  }
  if (acceptedCatchwords.length > 0) {
    editorialParts.push(
      "ACCEPTED CATCHWORDS:\n" +
        acceptedCatchwords.map((catchword) => catchword.catchwordLine).join("\n"),
    );
  }
  if (editorialParts.length > 0) {
    documentText = [documentText, ...editorialParts]
      .filter((part) => part.length > 0)
      .join("\n\n");
  }

  // Resolve denormalised metadata for filter predicates.
  const [courtMeta] = await dbc
    .select({ value: researchCaseMetadata.value })
    .from(researchCaseMetadata)
    .where(
      and(
        eq(researchCaseMetadata.judgmentId, judgmentId),
        eq(researchCaseMetadata.fieldName, "court"),
        ne(researchCaseMetadata.reviewerStatus, "rejected"),
      ),
    )
    .orderBy(desc(researchCaseMetadata.id))
    .limit(1);

  const [langMeta] = await dbc
    .select({ value: researchCaseMetadata.value })
    .from(researchCaseMetadata)
    .where(
      and(
        eq(researchCaseMetadata.judgmentId, judgmentId),
        eq(researchCaseMetadata.fieldName, "language"),
        ne(researchCaseMetadata.reviewerStatus, "rejected"),
      ),
    )
    .orderBy(desc(researchCaseMetadata.id))
    .limit(1);

  const [dateMeta] = await dbc
    .select({ value: researchCaseMetadata.value })
    .from(researchCaseMetadata)
    .where(
      and(
        eq(researchCaseMetadata.judgmentId, judgmentId),
        eq(researchCaseMetadata.fieldName, "decisionDate"),
        ne(researchCaseMetadata.reviewerStatus, "rejected"),
      ),
    )
    .orderBy(desc(researchCaseMetadata.id))
    .limit(1);

  const court =
    courtMeta?.value && typeof courtMeta.value === "string"
      ? courtMeta.value
      : null;
  const language =
    langMeta?.value && typeof langMeta.value === "string"
      ? langMeta.value
      : null;
  const decisionDate =
    dateMeta?.value && typeof dateMeta.value === "string"
      ? (() => {
          try {
            return new Date(dateMeta.value);
          } catch {
            return null;
          }
        })()
      : null;

  // Resolve practice area from the originating Drive asset (if any):
  // container ← upload batch item ← drive_assets.source_batch_item_id.
  // The contributor folder ("Civil Procedure (Caroline)", "Banking (Fazly)", …)
  // encodes the practice area used for portal-scoped search.
  let practiceArea: string | null = null;
  try {
    const [driveRow] = await dbc
      .select({ contributorFolder: driveAssets.contributorFolder })
      .from(researchUploadBatchItems)
      .innerJoin(
        driveAssets,
        eq(driveAssets.sourceBatchItemId, researchUploadBatchItems.id),
      )
      .where(eq(researchUploadBatchItems.containerId, containerId))
      .limit(1);
    practiceArea = practiceAreaForContributorFolder(driveRow?.contributorFolder);
  } catch (err) {
    logger.warn(
      { judgmentId, containerId, err },
      "search_index: failed to resolve practice area (indexing without it)",
    );
  }

  await indexJudgment({
    judgmentId,
    containerId,
    documentText,
    processorVersion: SEARCH_INDEX_VERSION,
    court,
    decisionDate: decisionDate && !isNaN(decisionDate.getTime()) ? decisionDate : null,
    language,
    practiceArea,
  });

  logger.info(
    { judgmentId, containerId, textLength: documentText.length },
    "search_index complete",
  );

  // Auto-enqueue headnotes generation now that the judgment is fully indexed.
  // Fire-and-forget: a failure here must not roll back the search-index result.
  enqueueHeadnotesJob(judgmentId, containerId).catch((err) => {
    logger.warn({ judgmentId, containerId, err }, "search_index: failed to enqueue headnotes job (non-fatal)");
  });

  return {};
}

/** Register the search-index processor at startup. Call once. */
export function registerSearchIndexProcessor(): () => void {
  return registerProcessor(SEARCH_INDEX_JOB_KIND, searchIndexProcessor, {
    touchesContent: true,
  });
}

/**
 * Queue a fresh search-index pass after accepted editorial content changes.
 * The timestamp is supplied by the caller so an acceptance transaction can
 * use one idempotency key for its whole batch. Repeated requests that accept
 * no new rows do not call this helper.
 */
export async function enqueueAcceptedContentReindex(
  judgmentId: number,
  containerId: number,
  acceptedRevision: number,
  opts: {
    actor?: string;
    dbc?: DbClient;
  } = {},
): Promise<void> {
  await enqueue(
    SEARCH_INDEX_JOB_KIND,
    `${SEARCH_INDEX_JOB_KIND}:accepted-content:${judgmentId}:${acceptedRevision}`,
    { judgmentId, containerId },
    {
      actor: opts.actor ?? "headnotes-acceptance",
      processorVersion: SEARCH_INDEX_VERSION,
      provenance: {
        judgmentId,
        containerId,
        trigger: "accepted-headnotes-or-catchwords",
      },
      dbc: opts.dbc,
    },
  );
}
