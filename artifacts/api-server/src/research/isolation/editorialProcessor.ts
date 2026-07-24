// Phase 07 — Editorial Classification Processor (ADR 0008).
//
// Job kind: container.editorial_classify
// Input: { containerId: number }
//
// Steps:
//   1. Fetch container + active candidates
//   2. Fetch page extractions + blocks for each candidate's span
//   3. Run sectionClassifier (pure)
//   4. Persist research_page_sections (ON CONFLICT DO NOTHING — idempotent)
//   5. Create research_editorial_runs row
//   6. Record research_transformations for excluded sections
//   7. If any MANUAL_REVIEW_REQUIRED → EDITORIAL_REVIEW_REQUIRED
//      Else → JUDGMENT_VERIFICATION_PENDING

import { createHash } from "node:crypto";
import {
  db,
  researchCaseCandidates,
  researchCaseCandidateBoundaries,
  researchCaseBoundaries,
  researchSourceContainers,
  researchSourcePages,
  researchPageExtractions,
  researchPageBlocks,
  researchPageSections,
  researchEditorialRuns,
  researchTransformations,
  researchReviewItems,
  researchJobs,
} from "@workspace/db";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { getContainer } from "../data/containers";
import { transitionContainer } from "../domain/containerStateMachine";
import { recordAuditEvent } from "../domain/audit";
import { enqueue, registerProcessor } from "../processing";
import { ProcessorFailure } from "../processing/handlers";
import type { ProcessorContext } from "../processing/handlers";
import type { DbClient } from "../domain/types";
import {
  classifySections,
  EDITORIAL_PROCESSOR_VERSION,
  LOW_CONFIDENCE,
  type PageInput,
  type BlockInput,
} from "./sectionClassifier";
import { applyIsolationGate, gateHasExclusions } from "./isolationGate";

export const EDITORIAL_JOB_KIND = "container.editorial_classify";

// Re-export so pipeline.ts can import from one place
export { EDITORIAL_PROCESSOR_VERSION } from "./sectionClassifier";

// ── Public helpers ─────────────────────────────────────────────────────────

/**
 * Enqueue an editorial classification job for a container.
 * Idempotent: returns the existing job if one is already QUEUED or RUNNING.
 */
export async function startEditorialClassification(
  containerId: number,
  actor: string,
  dbc: DbClient = db,
): Promise<{ jobId: number | null }> {
  const container = await getContainer(containerId, dbc);
  if (!container) {
    throw new ProcessorFailure("NOT_FOUND", `Container ${containerId} not found`, false);
  }

  const validStartStates = ["EDITORIAL_REVIEW_PENDING", "EDITORIAL_REVIEW_REQUIRED"] as const;
  if (!validStartStates.includes(container.processingState as typeof validStartStates[number])) {
    throw new ProcessorFailure(
      "INVALID_STATE",
      `Container ${containerId} is ${container.processingState}; editorial classification requires EDITORIAL_REVIEW_PENDING or EDITORIAL_REVIEW_REQUIRED`,
      false,
    );
  }

  const keyPrefix = `editorial-container-${containerId}-${container.contentSha256.slice(0, 16)}`;
  const priorJobs = await dbc
    .select({ id: researchJobs.id, state: researchJobs.state })
    .from(researchJobs)
    .where(eq(researchJobs.idempotencyKey, keyPrefix));

  const activeJob = priorJobs.find((j) => j.state === "QUEUED" || j.state === "RUNNING");
  if (activeJob) return { jobId: activeJob.id };

  const finishedAttempts = priorJobs.length;
  const key = finishedAttempts === 0 ? keyPrefix : `${keyPrefix}-a${finishedAttempts}`;

  const job = await enqueue(
    EDITORIAL_JOB_KIND,
    key,
    { containerId },
    {
      actor,
      processorVersion: EDITORIAL_PROCESSOR_VERSION,
      sourceChecksum: container.contentSha256,
      provenance: { containerId },
      dbc,
    },
  );

  return { jobId: job?.id ?? null };
}

// ── Processor implementation ───────────────────────────────────────────────

async function editorialProcessor(ctx: ProcessorContext): Promise<Record<string, unknown>> {
  const { job, dbc } = ctx;
  const containerId = job.payload["containerId"] as number;

  const container = await getContainer(containerId, dbc);
  if (!container) {
    throw new ProcessorFailure("NOT_FOUND", `Container ${containerId} not found`, false);
  }

  const validInputStates = ["EDITORIAL_REVIEW_PENDING", "EDITORIAL_REVIEW_REQUIRED"] as const;
  if (!validInputStates.includes(container.processingState as typeof validInputStates[number])) {
    throw new ProcessorFailure(
      "INVALID_STATE",
      `Container ${containerId} is ${container.processingState}; expected EDITORIAL_REVIEW_PENDING`,
      false,
    );
  }

  const restrictedStatuses = [
    "DO_NOT_PROCESS", "DO_NOT_RETAIN", "UNREVIEWED",
    "COMMERCIAL_SOURCE_REVIEW_REQUIRED", "MANUAL_LEGAL_REVIEW_REQUIRED",
  ];
  if (restrictedStatuses.includes(container.rightsStatus as string)) {
    throw new ProcessorFailure(
      "RIGHTS_NOT_APPROVED",
      `Container ${containerId} rights status is ${container.rightsStatus}; editorial classification not permitted`,
      false,
    );
  }

  // Fetch active candidates
  const allCandidates = await dbc
    .select()
    .from(researchCaseCandidates)
    .where(eq(researchCaseCandidates.containerId, containerId));

  const activeCandidates = allCandidates.filter(
    (c) => c.reviewStatus !== "rejected" && c.status !== "rejected",
  );

  // All container pages
  const allContainerPages = await dbc
    .select()
    .from(researchSourcePages)
    .where(eq(researchSourcePages.containerId, containerId));

  // Latest extraction per page
  const allPageIds = allContainerPages.map((p) => p.id);
  let extractionMap = new Map<number, { rawText: string; isBlank: boolean }>();
  if (allPageIds.length > 0) {
    const exts = await dbc
      .select()
      .from(researchPageExtractions)
      .where(inArray(researchPageExtractions.pageId, allPageIds))
      .orderBy(desc(researchPageExtractions.id));
    for (const ex of exts) {
      if (!extractionMap.has(ex.pageId)) {
        extractionMap.set(ex.pageId, { rawText: ex.rawText ?? "", isBlank: ex.isBlank ?? false });
      }
    }
  }

  // Blocks for all pages — researchPageBlocks links via pageExtractionId, so we
  // join through the extractions we already fetched to get the pageId mapping.
  let allBlocks: BlockInput[] = [];
  if (allPageIds.length > 0) {
    // Build a map of extractionId → pageId from the extractions already loaded
    const extractionIdToPageId = new Map<number, number>();
    // We need extraction IDs. Re-query with IDs.
    const extsWithId = await dbc
      .select({ id: researchPageExtractions.id, pageId: researchPageExtractions.pageId })
      .from(researchPageExtractions)
      .where(inArray(researchPageExtractions.pageId, allPageIds));
    for (const ex of extsWithId) {
      extractionIdToPageId.set(ex.id, ex.pageId);
    }

    const extractionIds = extsWithId.map((e) => e.id);
    if (extractionIds.length > 0) {
      const rawBlocks = await dbc
        .select()
        .from(researchPageBlocks)
        .where(inArray(researchPageBlocks.pageExtractionId, extractionIds))
        .orderBy(researchPageBlocks.blockIndex);
      allBlocks = rawBlocks.map((b) => ({
        id: b.id,
        pageId: extractionIdToPageId.get(b.pageExtractionId) ?? 0,
        blockIndex: b.blockIndex,
        text: b.text ?? "",
        blockType: b.blockType ?? "paragraph",
        font: b.font as Record<string, unknown> | null,
      }));
    }
  }

  const pages: PageInput[] = allContainerPages.map((p) => {
    const ex = extractionMap.get(p.id);
    return { id: p.id, pageNumber: p.pageNumber, text: ex?.rawText ?? "", isBlank: ex?.isBlank };
  });

  // Run classifier on all pages
  const classified = classifySections(pages, allBlocks);

  // Create editorial run row
  const uncertainCount = classified.filter((s) => s.classification === "MANUAL_REVIEW_REQUIRED").length;
  const suspectedEditorialCount = classified.filter(
    (s) => s.classification === "SUSPECTED_PUBLISHER_EDITORIAL",
  ).length;

  const [editorialRun] = await dbc
    .insert(researchEditorialRuns)
    .values({
      containerId,
      jobId: job.id,
      processorVersion: EDITORIAL_PROCESSOR_VERSION,
      sectionCount: classified.length,
      uncertainCount,
      suspectedEditorialCount,
    })
    .returning({ id: researchEditorialRuns.id });

  if (!editorialRun) {
    throw new ProcessorFailure("RUN_MISSING", `Could not create editorial run for container ${containerId}`, true);
  }

  // Persist sections (idempotent: ON CONFLICT DO NOTHING)
  const toInsert = classified.map((s) => ({
    containerId,
    pageId: s.pageId,
    editorialRunId: editorialRun.id,
    blockId: s.blockId ?? null,
    sectionIndex: s.sectionIndex,
    classification: s.classification,
    confidence: Math.round(s.confidence * 100),
    supportingEvidence: s.supportingEvidence,
    detectorVersion: s.detectorVersion,
    isolationApplied: !["VERIFIED_JUDICIAL_TEXT", "PROBABLE_JUDICIAL_TEXT"].includes(s.classification),
  }));

  if (toInsert.length > 0) {
    await dbc.insert(researchPageSections).values(toInsert).onConflictDoNothing();
  }

  // Record transformation for excluded sections
  const excluded = classified.filter(
    (s) => s.classification === "SUSPECTED_PUBLISHER_EDITORIAL" ||
           s.classification === "ADMINISTRATIVE_METADATA" ||
           s.classification === "SOURCE_ARTIFACT",
  );

  if (excluded.length > 0) {
    await dbc.insert(researchTransformations).values({
      containerId,
      kind: "editorial.isolation",
      detail: {
        editorialRunId: editorialRun.id,
        excludedCount: excluded.length,
        classifications: excluded.map((s) => ({
          pageId: s.pageId,
          sectionIndex: s.sectionIndex,
          classification: s.classification,
          confidence: s.confidence,
        })),
      },
      actor: `job:${job.id}`,
    });
  }

  // Create research_review_items for sections requiring manual review or low confidence
  const reviewRequiredSections = classified.filter(
    (s) => s.classification === "MANUAL_REVIEW_REQUIRED" || s.confidence < LOW_CONFIDENCE,
  );
  if (reviewRequiredSections.length > 0) {
    await dbc.insert(researchReviewItems).values(
      reviewRequiredSections.map((s) => ({
        containerId,
        kind: s.classification === "MANUAL_REVIEW_REQUIRED"
          ? "editorial.manual_review"
          : "editorial.low_confidence",
        reason: s.classification === "MANUAL_REVIEW_REQUIRED"
          ? `Section ${s.sectionIndex} on page ${s.pageId} has conflicting signals and requires manual classification review.`
          : `Section ${s.sectionIndex} on page ${s.pageId} classified as ${s.classification} with low confidence (${Math.round(s.confidence * 100)}%); human review recommended.`,
        status: "open",
      })),
    );
  }

  // Decide next state
  const hasUncertain = uncertainCount > 0;

  if (hasUncertain) {
    if (container.processingState !== "EDITORIAL_REVIEW_REQUIRED") {
      await transitionContainer(containerId, "EDITORIAL_REVIEW_REQUIRED", {
        actor: `job:${job.id}`,
        detail: { editorialRunId: editorialRun.id, uncertainCount, reason: "editorial_uncertain" },
      });
    }
    await recordAuditEvent(dbc, {
      entityType: "editorial_run",
      entityId: editorialRun.id,
      event: "editorial-classification:uncertain",
      toState: "EDITORIAL_REVIEW_REQUIRED",
      actor: `job:${job.id}`,
      detail: { containerId, sectionCount: classified.length, uncertainCount },
    });
  } else {
    await transitionContainer(containerId, "JUDGMENT_VERIFICATION_PENDING", {
      actor: `job:${job.id}`,
      detail: { editorialRunId: editorialRun.id, sectionCount: classified.length },
    });
    await recordAuditEvent(dbc, {
      entityType: "editorial_run",
      entityId: editorialRun.id,
      event: "editorial-classification:complete",
      toState: "JUDGMENT_VERIFICATION_PENDING",
      actor: `job:${job.id}`,
      detail: { containerId, sectionCount: classified.length },
    });
  }

  return {
    editorialRunId: editorialRun.id,
    sectionCount: classified.length,
    uncertainCount,
    suspectedEditorialCount,
  };
}

export function registerEditorialProcessor(): void {
  registerProcessor(EDITORIAL_JOB_KIND, editorialProcessor, { touchesContent: true });
  logger.info({}, "Editorial classification processor registered");
}

// ── Checksum helper (for verified judgment creation) ──────────────────────

/** Compute SHA-256 of concatenated ordered judicial text. */
export function computeJudicialTextChecksum(judicialTexts: string[]): string {
  return createHash("sha256").update(judicialTexts.join("\n")).digest("hex");
}
