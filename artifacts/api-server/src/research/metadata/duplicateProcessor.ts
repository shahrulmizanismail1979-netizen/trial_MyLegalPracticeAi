// Duplicate-detection processor (Phase 08, ADR 0009).
// Job kind: container.duplicate_detect
// Runs after metadata extraction; compares new judgment against all existing
// verified judgments. Idempotent by (judgmentId, version). NO auto-merge.

import {
  db,
  researchVerifiedJudgments,
  researchSourcePages,
  researchPageExtractions,
  researchCaseMetadata,
  researchDuplicateLinks,
} from "@workspace/db";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { registerProcessor, enqueue } from "../processing";
import { ProcessorFailure } from "../processing/handlers";
import type { ProcessorContext } from "../processing/handlers";
import type { DbClient } from "../domain/types";
import {
  compareJudgments,
  DUPLICATE_DETECTOR_VERSION,
} from "./duplicateDetector";
import type { JudgmentSummary } from "./duplicateDetector";
import { logger } from "../../lib/logger";

export const DUPLICATE_JOB_KIND = "container.duplicate_detect";

export async function enqueueDuplicateJob(
  judgmentId: number,
  containerId: number,
  actor: string,
  dbc = db,
): Promise<void> {
  await enqueue(
    DUPLICATE_JOB_KIND,
    `duplicate-${judgmentId}-${DUPLICATE_DETECTOR_VERSION}`,
    { judgmentId, containerId },
    {
      actor,
      processorVersion: DUPLICATE_DETECTOR_VERSION,
      provenance: { judgmentId, containerId },
      dbc,
    },
  );
}

async function loadJudgmentText(
  judgmentId: number,
  pageRefs: number[],
  dbc: DbClient,
): Promise<string> {
  if (pageRefs.length === 0) return "";

  const extractions = await dbc
    .select({ pageId: researchPageExtractions.pageId, rawText: researchPageExtractions.rawText })
    .from(researchPageExtractions)
    .where(inArray(researchPageExtractions.pageId, pageRefs))
    .orderBy(desc(researchPageExtractions.id));

  const latestByPage = new Map<number, string>();
  for (const ex of extractions) {
    if (!latestByPage.has(ex.pageId) && ex.rawText) {
      latestByPage.set(ex.pageId, ex.rawText);
    }
  }

  const pages = await dbc
    .select()
    .from(researchSourcePages)
    .where(inArray(researchSourcePages.id, pageRefs));

  return pages
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((p) => latestByPage.get(p.id) ?? "")
    .join("\n\n");
}

async function getActiveCitation(
  judgmentId: number,
  fieldName: "neutralCitation" | "reportCitation",
  dbc: DbClient,
): Promise<string> {
  const [row] = await dbc
    .select({ value: researchCaseMetadata.value })
    .from(researchCaseMetadata)
    .where(
      and(
        eq(researchCaseMetadata.judgmentId, judgmentId),
        eq(researchCaseMetadata.fieldName, fieldName),
        ne(researchCaseMetadata.reviewerStatus, "rejected"),
      ),
    )
    .orderBy(desc(researchCaseMetadata.id))
    .limit(1);
  if (!row) return "";
  const v = row.value;
  return typeof v === "string" ? v : "";
}

async function duplicateProcessor(ctx: ProcessorContext): Promise<{}> {
  const { job, dbc } = ctx;
  const judgmentId = job.payload["judgmentId"] as number;

  if (!Number.isInteger(judgmentId)) {
    throw new ProcessorFailure(
      "INVALID_PAYLOAD",
      "duplicate_detect job requires integer judgmentId",
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

  // Build summary for this judgment.
  const fullText = await loadJudgmentText(judgmentId, judgment.pageRefs, dbc);
  const neutralCitation = await getActiveCitation(judgmentId, "neutralCitation", dbc);
  const reportCitation = await getActiveCitation(judgmentId, "reportCitation", dbc);

  const current: JudgmentSummary = {
    judgmentId,
    textChecksum: judgment.textChecksum,
    neutralCitation,
    reportCitation,
    fullText,
  };

  // Load all other verified judgments for comparison.
  const others = await dbc
    .select({
      id: researchVerifiedJudgments.id,
      textChecksum: researchVerifiedJudgments.textChecksum,
      pageRefs: researchVerifiedJudgments.pageRefs,
    })
    .from(researchVerifiedJudgments)
    .where(ne(researchVerifiedJudgments.id, judgmentId));

  let linkCount = 0;

  for (const other of others) {
    // Canonical order: smaller id is source.
    const [srcId, tgtId] =
      judgmentId < other.id
        ? [judgmentId, other.id]
        : [other.id, judgmentId];

    // Skip if a link already exists for this pair.
    const existing = await dbc
      .select({ id: researchDuplicateLinks.id })
      .from(researchDuplicateLinks)
      .where(
        and(
          eq(researchDuplicateLinks.sourceJudgmentId, srcId),
          eq(researchDuplicateLinks.targetJudgmentId, tgtId),
        ),
      )
      .limit(1);

    if (existing.length > 0) continue;

    const otherFullText = await loadJudgmentText(other.id, other.pageRefs, dbc);
    const otherNeutral = await getActiveCitation(other.id, "neutralCitation", dbc);
    const otherReport = await getActiveCitation(other.id, "reportCitation", dbc);

    const [src, tgt] =
      judgmentId < other.id
        ? [current, { judgmentId: other.id, textChecksum: other.textChecksum, neutralCitation: otherNeutral, reportCitation: otherReport, fullText: otherFullText }]
        : [{ judgmentId: other.id, textChecksum: other.textChecksum, neutralCitation: otherNeutral, reportCitation: otherReport, fullText: otherFullText }, current];

    const link = compareJudgments(src, tgt);
    if (!link) continue;

    await dbc
      .insert(researchDuplicateLinks)
      .values({
        sourceJudgmentId: link.sourceJudgmentId,
        targetJudgmentId: link.targetJudgmentId,
        linkType: link.linkType,
        evidence: link.evidence,
        similarityScore: link.similarityScore,
        detectedBy: `job:${job.id}:${DUPLICATE_DETECTOR_VERSION}`,
        reviewerStatus: "pending",
      })
      .onConflictDoNothing();

    linkCount++;
  }

  logger.info(
    { judgmentId, comparedCount: others.length, linkCount },
    "duplicate_detect complete",
  );

  return {};
}

/** Register the duplicate-detect processor at startup. Call once. */
export function registerDuplicateProcessor(): () => void {
  return registerProcessor(DUPLICATE_JOB_KIND, duplicateProcessor, {
    touchesContent: true,
  });
}
