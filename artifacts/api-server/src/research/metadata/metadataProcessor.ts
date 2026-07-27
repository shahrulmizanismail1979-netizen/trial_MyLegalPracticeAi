// Case-metadata extraction processor (Phase 08, ADR 0009).
// Job kind: container.metadata_extract
// Runs after JUDGMENT_VERIFICATION_COMPLETE; idempotent by (judgmentId, version).

import {
  db,
  researchVerifiedJudgments,
  researchSourcePages,
  researchPageExtractions,
  researchPageSections,
  researchCaseMetadata,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { registerProcessor, enqueue } from "../processing";
import { ProcessorFailure } from "../processing/handlers";
import type { ProcessorContext } from "../processing/handlers";
import { extractMetadata, METADATA_EXTRACTOR_VERSION } from "./extractor";
import type { PageText } from "./extractor";
import { SEARCH_INDEX_JOB_KIND } from "../search/searchIndexProcessor";
import { logger } from "../../lib/logger";

export const METADATA_JOB_KIND = "container.metadata_extract";

/**
 * Enqueue a metadata extraction job for a newly-verified judgment.
 * Idempotent: duplicate calls are collapsed by idempotency key.
 */
export async function enqueueMetadataJob(
  judgmentId: number,
  containerId: number,
  actor: string,
  dbc = db,
): Promise<void> {
  await enqueue(
    METADATA_JOB_KIND,
    `metadata-${judgmentId}-${METADATA_EXTRACTOR_VERSION}`,
    { judgmentId, containerId },
    {
      actor,
      processorVersion: METADATA_EXTRACTOR_VERSION,
      provenance: { judgmentId, containerId },
      dbc,
    },
  );
}

async function metadataProcessor(ctx: ProcessorContext): Promise<{}> {
  const { job, dbc } = ctx;
  const judgmentId = job.payload["judgmentId"] as number;
  const containerId = job.payload["containerId"] as number;

  if (!Number.isInteger(judgmentId) || !Number.isInteger(containerId)) {
    throw new ProcessorFailure(
      "INVALID_PAYLOAD",
      "metadata_extract job requires integer judgmentId and containerId",
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

  // Resolve the ordered page texts for the judicial text spans.
  // We use the approved page refs from the verified judgment.
  const pageIds = judgment.pageRefs.length > 0 ? judgment.pageRefs : [];

  let pages: PageText[] = [];

  if (pageIds.length > 0) {
    const sourcePages = await dbc
      .select()
      .from(researchSourcePages)
      .where(inArray(researchSourcePages.id, pageIds));

    const extractions = await dbc
      .select()
      .from(researchPageExtractions)
      .where(inArray(researchPageExtractions.pageId, pageIds))
      .orderBy(desc(researchPageExtractions.id));

    const latestByPage = new Map<number, string>();
    for (const ex of extractions) {
      if (!latestByPage.has(ex.pageId) && ex.rawText) {
        latestByPage.set(ex.pageId, ex.rawText);
      }
    }

    pages = sourcePages
      .map((sp) => ({
        id: sp.id,
        pageNumber: sp.pageNumber,
        text: latestByPage.get(sp.id) ?? "",
      }))
      .sort((a, b) => a.pageNumber - b.pageNumber);
  }

  // If no page texts found via pageRefs, try the approved judicial spans.
  if (pages.length === 0 && judgment.approvedJudicialSpans.length > 0) {
    const spanPageIds = [
      ...new Set(
        judgment.approvedJudicialSpans
          .map((s) => s.pageId)
          .filter((id): id is number => id != null),
      ),
    ];

    if (spanPageIds.length > 0) {
      const sourcePages = await dbc
        .select()
        .from(researchSourcePages)
        .where(inArray(researchSourcePages.id, spanPageIds));

      const extractions = await dbc
        .select()
        .from(researchPageExtractions)
        .where(inArray(researchPageExtractions.pageId, spanPageIds))
        .orderBy(desc(researchPageExtractions.id));

      const latestByPage = new Map<number, string>();
      for (const ex of extractions) {
        if (!latestByPage.has(ex.pageId) && ex.rawText) {
          latestByPage.set(ex.pageId, ex.rawText);
        }
      }

      pages = sourcePages
        .map((sp) => ({
          id: sp.id,
          pageNumber: sp.pageNumber,
          text: latestByPage.get(sp.id) ?? "",
        }))
        .sort((a, b) => a.pageNumber - b.pageNumber);
    }
  }

  if (pages.length === 0) {
    logger.warn(
      { judgmentId, containerId },
      "metadata_extract: no page texts found — inserting empty metadata record",
    );
  }

  const extracted = extractMetadata(pages);

  // Upsert each field — idempotent by (judgmentId, fieldName, processorVersion).
  for (const field of extracted) {
    await dbc
      .insert(researchCaseMetadata)
      .values({
        judgmentId,
        containerId,
        fieldName: field.fieldName,
        value: field.value ?? null,
        sourcePageId: field.sourceRef?.pageId ?? null,
        sourceCharStart: field.sourceRef?.charStart ?? null,
        sourceCharEnd: field.sourceRef?.charEnd ?? null,
        confidence: field.confidence,
        method: field.method,
        processorVersion: METADATA_EXTRACTOR_VERSION,
        reviewerStatus: "pending",
      })
      .onConflictDoNothing({
        target: [
          researchCaseMetadata.judgmentId,
          researchCaseMetadata.fieldName,
          researchCaseMetadata.processorVersion,
        ],
      });
  }

  logger.info(
    { judgmentId, containerId, fieldCount: extracted.length },
    "metadata_extract complete",
  );

  // Enqueue the search-index job next (pipeline).
  await enqueue(
    SEARCH_INDEX_JOB_KIND,
    `search-index-${judgmentId}-${METADATA_EXTRACTOR_VERSION}`,
    { judgmentId, containerId },
    {
      actor: `job:${job.id}`,
      processorVersion: METADATA_EXTRACTOR_VERSION,
      provenance: { judgmentId, containerId },
      dbc,
    },
  );

  return {};
}

/** Register the metadata-extract processor at startup. Call once. */
export function registerMetadataProcessor(): () => void {
  return registerProcessor(METADATA_JOB_KIND, metadataProcessor, {
    touchesContent: true,
  });
}
