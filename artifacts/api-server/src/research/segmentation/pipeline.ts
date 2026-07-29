import { createHash } from "node:crypto";
import {
  db,
  researchSegmentationRuns,
  researchBoundarySignals,
  researchCaseBoundaries,
  researchCaseCandidateBoundaries,
  researchCaseCandidates,
  researchJobs,
  researchReviewItems,
  researchSourcePages,
  researchPageExtractions,
  researchPageBlocks,
  researchTransformations,
  type ResearchSegmentationRun,
} from "@workspace/db";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { getContainer } from "../data/containers";
import { transitionContainer } from "../domain/containerStateMachine";
import { recordAuditEvent } from "../domain/audit";
import { enqueue, registerProcessor } from "../processing";
import { ProcessorFailure, ReviewRequiredSignal } from "../processing/handlers";
import type { ProcessorContext } from "../processing/handlers";
import type { DbClient } from "../domain/types";
import { detectSignals } from "./signalDetector";
import { composeCandidate } from "./candidateComposer";
import type { PageInput, BlockInput } from "./signalDetector";
import { startValidation } from "../validation/pipeline";


export const SEGMENT_JOB_KIND = "container.segment";
export const SEGMENT_PROCESSOR_VERSION = "container.segment@1";

/**
 * Start segmentation for a container in TEXT_EXTRACTED or SEGMENTATION_REVIEW_REQUIRED.
 * Idempotent per (container, attempt count).
 */
export async function startSegmentation(
  containerId: number,
  actor: string,
): Promise<{ jobId: number | null }> {
  const container = await getContainer(containerId);
  if (!container) {
    throw new ProcessorFailure(
      "NOT_FOUND",
      `Container ${containerId} not found`,
      false,
    );
  }
  if (
    container.processingState !== "TEXT_EXTRACTED" &&
    container.processingState !== "SEGMENTATION_REVIEW_REQUIRED"
  ) {
    throw new ProcessorFailure(
      "INVALID_STATE",
      `Container ${containerId} is ${container.processingState}; segmentation requires TEXT_EXTRACTED or SEGMENTATION_REVIEW_REQUIRED`,
      false,
    );
  }

  const keyPrefix = `segment-container-${containerId}-${container.contentSha256.slice(0, 16)}`;
  const priorJobs = await db
    .select({ state: researchJobs.state })
    .from(researchJobs)
    .where(
      and(
        eq(researchJobs.kind, SEGMENT_JOB_KIND),
        like(researchJobs.idempotencyKey, `${keyPrefix}%`),
      ),
    );
  const finishedAttempts = priorJobs.filter(
    (j) => j.state !== "QUEUED" && j.state !== "RUNNING",
  ).length;
  const job = await enqueue(
    SEGMENT_JOB_KIND,
    finishedAttempts === 0 ? keyPrefix : `${keyPrefix}-a${finishedAttempts}`,
    { containerId },
    {
      actor,
      processorVersion: SEGMENT_PROCESSOR_VERSION,
      sourceChecksum: container.contentSha256,
      provenance: { containerId },
    },
  );

  if (job && container.processingState === "TEXT_EXTRACTED") {
    await transitionContainer(containerId, "SEGMENTATION_PENDING", {
      actor,
      detail: { cause: "segmentation-requested" },
    });
  } else if (job && container.processingState === "SEGMENTATION_REVIEW_REQUIRED") {
    await transitionContainer(containerId, "SEGMENTATION_PENDING", {
      actor,
      detail: { cause: "segmentation-rerun-after-review" },
    });
  }
  return { jobId: job?.id ?? null };
}

export async function getLatestSegmentationRun(
  containerId: number,
  dbc: DbClient = db,
): Promise<ResearchSegmentationRun | undefined> {
  const [row] = await dbc
    .select()
    .from(researchSegmentationRuns)
    .where(eq(researchSegmentationRuns.containerId, containerId))
    .orderBy(desc(researchSegmentationRuns.id))
    .limit(1);
  return row;
}

function sha16(data: string): string {
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}

async function segmentProcessor(ctx: ProcessorContext) {
  const { job, dbc } = ctx;
  const containerId = job.payload["containerId"] as number;
  const container = await getContainer(containerId, dbc);
  if (!container) {
    throw new ProcessorFailure(
      "NOT_FOUND",
      `Container ${containerId} not found`,
      false,
    );
  }

  // Idempotent re-execution after completion
  if (container.processingState === "SEGMENTATION_PROPOSED") {
    throw new ProcessorFailure(
      "INVALID_STATE",
      `Container ${containerId} is already SEGMENTATION_PROPOSED; re-run refused (idempotency)`,
      false,
    );
  }
  if (
    container.processingState !== "SEGMENTATION_PENDING" &&
    container.processingState !== "SEGMENTATION_REVIEW_REQUIRED"
  ) {
    throw new ProcessorFailure(
      "INVALID_STATE",
      `Container ${containerId} is ${container.processingState}; expected SEGMENTATION_PENDING`,
      false,
    );
  }

  // Rights gate (fail-closed — checked in addition to the framework touchesContent gate).
  // Containers that must not be processed have "DO_NOT_PROCESS" or "DO_NOT_RETAIN" rights status.
  const restrictedStatuses: string[] = ["DO_NOT_PROCESS", "DO_NOT_RETAIN", "UNREVIEWED", "COMMERCIAL_SOURCE_REVIEW_REQUIRED", "MANUAL_LEGAL_REVIEW_REQUIRED"];
  if (restrictedStatuses.includes(container.rightsStatus as string)) {
    throw new ProcessorFailure(
      "RIGHTS_NOT_APPROVED",
      `Container ${containerId} rights status is ${container.rightsStatus}; segmentation not permitted`,
      false,
    );
  }

  const sourceSha = container.contentSha256;
  const runKey = `segment-${sha16(sourceSha)}-${SEGMENT_PROCESSOR_VERSION}-j${job.id}`;

  // Create or resume the segmentation run (idempotent per job attempt)
  await dbc
    .insert(researchSegmentationRuns)
    .values({
      containerId,
      jobId: job.id,
      runKey,
      processorVersion: SEGMENT_PROCESSOR_VERSION,
      sourceChecksum: sourceSha,
      status: "RUNNING",
    })
    .onConflictDoNothing();

  const [run] = await dbc
    .select()
    .from(researchSegmentationRuns)
    .where(
      and(
        eq(researchSegmentationRuns.containerId, containerId),
        eq(researchSegmentationRuns.runKey, runKey),
      ),
    );

  if (!run) {
    throw new ProcessorFailure(
      "RUN_MISSING",
      `Segmentation run for container ${containerId} could not be created`,
      true,
    );
  }

  // ── Fetch extraction data for this container ───────────────────────────
  const sourcePages = await dbc
    .select()
    .from(researchSourcePages)
    .where(eq(researchSourcePages.containerId, containerId));

  if (sourcePages.length === 0) {
    // No pages extracted — treat as zero candidates
    await dbc.transaction(async (tx) => {
      await tx
        .update(researchSegmentationRuns)
        .set({ status: "COMPLETE", finishedAt: new Date(), detail: { unassigned_pages: [] } })
        .where(eq(researchSegmentationRuns.id, run.id));
      await tx.insert(researchTransformations).values({
        containerId,
        kind: "segmentation",
        detail: { runId: run.id, candidateCount: 0, pageCount: 0, message: "no pages extracted" },
        actor: `job:${job.id}`,
      });
      await transitionContainer(containerId, "SEGMENTATION_PROPOSED", {
        actor: `job:${job.id}`,
        detail: { runId: run.id, candidateCount: 0 },
        dbc: tx,
      });
    });
    return {};
  }

  // Get latest extraction run for each page
  const pageIds = sourcePages.map((p) => p.id);
  const pageNumbers = new Map<number, number>(
    sourcePages.map((p) => [p.id, p.pageNumber]),
  );

  // Fetch extractions (latest run only — use the most recent extraction row per page)
  const extractionRows = await dbc
    .select({
      extraction: researchPageExtractions,
      pageId: researchPageExtractions.pageId,
    })
    .from(researchPageExtractions)
    .where(
      // Scope to this container's pages only — avoids fetching the entire extractions table
      inArray(researchPageExtractions.pageId, pageIds),
    )
    .orderBy(desc(researchPageExtractions.id));

  // Pick latest extraction per page
  const latestByPage = new Map<number, typeof extractionRows[0]>();
  for (const row of extractionRows) {
    const pid = row.extraction.pageId;
    if (sourcePages.some((p) => p.id === pid) && !latestByPage.has(pid)) {
      latestByPage.set(pid, row);
    }
  }

  // Fetch all blocks for the pages we have
  const allBlocks: BlockInput[] = [];
  for (const [pageId, exRow] of latestByPage) {
    const blocks = await dbc
      .select()
      .from(researchPageBlocks)
      .where(eq(researchPageBlocks.pageExtractionId, exRow.extraction.id));
    for (const b of blocks) {
      allBlocks.push({
        id: b.id,
        pageId,
        pageExtractionId: b.pageExtractionId,
        blockIndex: b.blockIndex,
        text: b.text,
        blockType: b.blockType,
        font: b.font as Record<string, unknown> | null | undefined,
      });
    }
  }

  // Build page inputs
  const pages: PageInput[] = sourcePages.map((p) => {
    const exRow = latestByPage.get(p.id);
    return {
      id: p.id,
      pageNumber: p.pageNumber,
      text: exRow?.extraction.rawText ?? "",
      isBlank: exRow?.extraction.isBlank ?? false,
    };
  });

  // ── Signal detection ───────────────────────────────────────────────────
  const signals = detectSignals(pages, allBlocks);

  // Insert signals (idempotent — ON CONFLICT DO NOTHING)
  if (signals.length > 0) {
    for (const signal of signals) {
      await dbc
        .insert(researchBoundarySignals)
        .values({
          runId: run.id,
          pageId: signal.pageId,
          blockId: signal.blockId ?? null,
          signalType: signal.signalType,
          signalValue: signal.signalValue.slice(0, 500),
          supportingText: signal.supportingText.slice(0, 500),
          scoreContribution: signal.scoreContribution,
          processorVersion: signal.processorVersion,
        })
        .onConflictDoNothing();
    }
  }

  // ── Candidate composition ──────────────────────────────────────────────
  const composerResult = composeCandidate(signals, pageIds, pageNumbers);
  const { candidates, unassignedPageIds } = composerResult;

  // ── Persist boundaries and candidates ─────────────────────────────────
  let reviewRequired = false;
  const insertedCandidateIds: number[] = [];

  for (const candidate of candidates) {
    const { startBoundary, endBoundary, pageIds: spanPageIds, overallStrength } = candidate;

    // Check if review is needed
    if (candidate.requiresReview) {
      reviewRequired = true;
    }

    await dbc.transaction(async (tx) => {
      // Insert start boundary
      await tx
        .insert(researchCaseBoundaries)
        .values({
          runId: run.id,
          pageId: startBoundary.pageId,
          blockId: startBoundary.blockId ?? null,
          boundaryRole: "start",
          strength: startBoundary.strength,
          compositeScore: startBoundary.compositeScore,
          conflictingSignalCount: startBoundary.conflictingSignalCount,
          reviewStatus: startBoundary.reviewStatus,
        })
        .onConflictDoNothing();

      const [startBound] = await tx
        .select()
        .from(researchCaseBoundaries)
        .where(
          and(
            eq(researchCaseBoundaries.runId, run.id),
            eq(researchCaseBoundaries.pageId, startBoundary.pageId),
            eq(researchCaseBoundaries.boundaryRole, "start"),
          ),
        );
      if (!startBound) return;

      // Insert end boundary
      await tx
        .insert(researchCaseBoundaries)
        .values({
          runId: run.id,
          pageId: endBoundary.pageId,
          blockId: endBoundary.blockId ?? null,
          boundaryRole: "end",
          strength: endBoundary.strength,
          compositeScore: endBoundary.compositeScore,
          conflictingSignalCount: endBoundary.conflictingSignalCount,
          reviewStatus: endBoundary.reviewStatus,
        })
        .onConflictDoNothing();

      const [endBound] = await tx
        .select()
        .from(researchCaseBoundaries)
        .where(
          and(
            eq(researchCaseBoundaries.runId, run.id),
            eq(researchCaseBoundaries.pageId, endBoundary.pageId),
            eq(researchCaseBoundaries.boundaryRole, "end"),
          ),
        );
      if (!endBound) return;

      // Insert candidate (idempotent: ON CONFLICT DO NOTHING on unique index
      // research_case_candidates_run_container_startpage_uq)
      await tx
        .insert(researchCaseCandidates)
        .values({
          containerId,
          runId: run.id,
          startPageId: startBoundary.pageId,
          strength: overallStrength,
          pageCount: spanPageIds.length,
          reviewStatus: candidate.requiresReview ? "review_required" : "auto_accepted",
          spans: [{ startPageId: startBoundary.pageId, endPageId: endBoundary.pageId }],
          detail: {
            startBoundaryId: startBound.id,
            endBoundaryId: endBound.id,
            startScore: startBoundary.compositeScore,
            endScore: endBoundary.compositeScore,
          },
        })
        .onConflictDoNothing();

      // Fetch the inserted or pre-existing candidate (idempotent re-run)
      const [candidateRow] = await tx
        .select()
        .from(researchCaseCandidates)
        .where(
          and(
            eq(researchCaseCandidates.runId, run.id),
            eq(researchCaseCandidates.containerId, containerId),
            eq(researchCaseCandidates.startPageId, startBoundary.pageId),
          ),
        );

      if (!candidateRow) return;
      insertedCandidateIds.push(candidateRow.id);

      // Insert candidate-boundary join
      await tx
        .insert(researchCaseCandidateBoundaries)
        .values({
          candidateId: candidateRow.id,
          startBoundaryId: startBound.id,
          endBoundaryId: endBound.id,
        })
        .onConflictDoNothing();

      // Audit event for candidate proposal
      await recordAuditEvent(tx, {
        entityType: "case_candidate",
        entityId: candidateRow.id,
        event: "proposed",
        actor: `job:${job.id}`,
        detail: {
          runId: run.id,
          containerId,
          strength: overallStrength,
          startPageId: startBoundary.pageId,
          endPageId: endBoundary.pageId,
          pageCount: spanPageIds.length,
        },
      });
    });
  }

  const unassignedPageNumbers = unassignedPageIds.map(
    (pid) => pageNumbers.get(pid) ?? 0,
  );

  // ── Finalize run ───────────────────────────────────────────────────────
  await dbc.transaction(async (tx) => {
    await tx
      .update(researchSegmentationRuns)
      .set({
        status: reviewRequired ? "REVIEW_REQUIRED" : "COMPLETE",
        finishedAt: new Date(),
        detail: { unassigned_pages: unassignedPageNumbers },
      })
      .where(eq(researchSegmentationRuns.id, run.id));

    await tx.insert(researchTransformations).values({
      containerId,
      kind: "segmentation",
      detail: {
        runId: run.id,
        jobId: job.id,
        candidateCount: candidates.length,
        pageCount: sourcePages.length,
        unassignedPageCount: unassignedPageIds.length,
        reviewRequired,
        description: `Proposed ${candidates.length} case candidates from ${sourcePages.length} pages`,
      },
      actor: `job:${job.id}`,
    });

    if (reviewRequired) {
      await tx.insert(researchReviewItems).values({
        containerId,
        kind: "segmentation",
        reason: `Segmentation requires review: ${candidates.filter((c) => c.requiresReview).length} uncertain boundaries`,
      });
    }

    // State machine: SEGMENTATION_PENDING → SEGMENTATION_PROPOSED (always)
    // Then optionally SEGMENTATION_PROPOSED → SEGMENTATION_REVIEW_REQUIRED
    await transitionContainer(containerId, "SEGMENTATION_PROPOSED", {
      actor: `job:${job.id}`,
      detail: { runId: run.id, candidateCount: candidates.length },
      dbc: tx,
    });
    if (reviewRequired) {
      await transitionContainer(containerId, "SEGMENTATION_REVIEW_REQUIRED", {
        actor: `job:${job.id}`,
        detail: { runId: run.id, reviewItemCreated: true },
        dbc: tx,
      });
    }
  });

  logger.info(
    {
      containerId,
      runId: run.id,
      candidateCount: candidates.length,
      reviewRequired,
    },
    "Research container segmentation finished",
  );

  // Phase 06: kick off validation automatically after every segmentation —
  // both clean runs (SEGMENTATION_PROPOSED) and review-required runs
  // (SEGMENTATION_REVIEW_REQUIRED). Running coherence checks in both cases
  // gives reviewers structured quality data before they take any action.
  // The validation processor already handles SEGMENTATION_REVIEW_REQUIRED
  // input and skips self-transitions idempotently.
  try {
    const { jobId: validateJobId } = await startValidation(
      containerId,
      `job:${job.id}`,
      dbc,
    );
    logger.info(
      { containerId, runId: run.id, validateJobId, reviewRequired },
      "Validation job enqueued automatically after segmentation",
    );
  } catch (err) {
    // Best-effort: validation enqueue failure should not fail the segmentation
    // job — the container is already in its new state and an operator
    // can trigger validation manually.
    logger.error(
      { containerId, runId: run.id, err },
      "Failed to auto-enqueue validation job after segmentation; operator can trigger manually",
    );
  }

  // Phase 14 note: EDITORIAL_REVIEW_PENDING transition and editorial job
  // enqueue are handled by the validation processor (validation/pipeline.ts)
  // AFTER it completes coherence checks — not here. Moving it here would fire
  // before validation runs, putting the container in a state the validation
  // processor rejects (INVALID_STATE). The correct pipeline order is:
  //   segmentation → validation → editorial classification.

  return {
    outputChecksum: sha16(
      JSON.stringify({ containerId, runKey, candidates: insertedCandidateIds }),
    ),
  };
}

let registered = false;
/** Register the segmentation processor (idempotent). Rights-gated: touchesContent. */
export function registerSegmentationProcessor(): void {
  if (registered) return;
  registered = true;
  registerProcessor(SEGMENT_JOB_KIND, segmentProcessor, {
    touchesContent: true,
  });
}
