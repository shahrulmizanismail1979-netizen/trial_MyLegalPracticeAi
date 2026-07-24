import { createHash } from "node:crypto";
import {
  db,
  researchValidationRuns,
  researchCandidateCoherenceChecks,
  researchCrossFileRelationships,
  researchCaseCandidates,
  researchSourcePages,
  researchPageExtractions,
  researchPageBlocks,
  researchCaseCandidateBoundaries,
  researchCaseBoundaries,
  researchTransformations,
  researchJobs,
  type ResearchValidationRun,
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
import {
  checkCoherence,
  requiresValidationReview,
  countFailures,
  type PageData,
  VALIDATE_PROCESSOR_VERSION,
} from "./coherenceChecker";
import {
  detectAllCrossFileRelationships,
  type CandidateSummary,
} from "./crossFileDetector";

export const VALIDATE_JOB_KIND = "container.validate";

/**
 * Start a validation job for a container in SEGMENTATION_PROPOSED.
 * The segmentation pipeline calls this automatically at the end of segmentation.
 */
export async function startValidation(
  containerId: number,
  actor: string,
  dbc: DbClient = db,
): Promise<{ jobId: number | null }> {
  const container = await getContainer(containerId, dbc);
  if (!container) {
    throw new ProcessorFailure(
      "NOT_FOUND",
      `Container ${containerId} not found`,
      false,
    );
  }
  if (container.processingState !== "SEGMENTATION_PROPOSED") {
    throw new ProcessorFailure(
      "INVALID_STATE",
      `Container ${containerId} is ${container.processingState}; validation requires SEGMENTATION_PROPOSED`,
      false,
    );
  }

  const keyPrefix = `validate-container-${containerId}-${container.contentSha256.slice(0, 16)}`;
  const priorJobs = await dbc
    .select({ state: researchJobs.state })
    .from(researchJobs)
    .where(
      and(
        eq(researchJobs.kind, VALIDATE_JOB_KIND),
        like(researchJobs.idempotencyKey, `${keyPrefix}%`),
      ),
    );
  const finishedAttempts = priorJobs.filter(
    (j) => j.state !== "QUEUED" && j.state !== "RUNNING",
  ).length;

  const job = await enqueue(
    VALIDATE_JOB_KIND,
    finishedAttempts === 0 ? keyPrefix : `${keyPrefix}-a${finishedAttempts}`,
    { containerId },
    {
      actor,
      processorVersion: VALIDATE_PROCESSOR_VERSION,
      sourceChecksum: container.contentSha256,
      provenance: { containerId },
      dbc,
    },
  );

  return { jobId: job?.id ?? null };
}

export async function getLatestValidationRun(
  containerId: number,
  dbc: DbClient = db,
): Promise<ResearchValidationRun | undefined> {
  const [row] = await dbc
    .select()
    .from(researchValidationRuns)
    .where(eq(researchValidationRuns.containerId, containerId))
    .orderBy(desc(researchValidationRuns.id))
    .limit(1);
  return row;
}

function sha16(data: string): string {
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}

async function validateProcessor(ctx: ProcessorContext) {
  const { job, dbc } = ctx;
  const containerId = job.payload["containerId"] as number;
  const container = await getContainer(containerId, dbc);
  if (!container) {
    throw new ProcessorFailure("NOT_FOUND", `Container ${containerId} not found`, false);
  }

  // Accept SEGMENTATION_PROPOSED or SEGMENTATION_PENDING (re-run after review)
  const validInputStates = ["SEGMENTATION_PROPOSED", "SEGMENTATION_PENDING", "SEGMENTATION_REVIEW_REQUIRED"] as const;
  if (!validInputStates.includes(container.processingState as typeof validInputStates[number])) {
    throw new ProcessorFailure(
      "INVALID_STATE",
      `Container ${containerId} is ${container.processingState}; expected SEGMENTATION_PROPOSED or SEGMENTATION_PENDING`,
      false,
    );
  }

  // Rights gate (fail-closed — same pattern as prior phases)
  const restrictedStatuses = ["DO_NOT_PROCESS", "DO_NOT_RETAIN", "UNREVIEWED", "COMMERCIAL_SOURCE_REVIEW_REQUIRED", "MANUAL_LEGAL_REVIEW_REQUIRED"];
  if (restrictedStatuses.includes(container.rightsStatus as string)) {
    throw new ProcessorFailure(
      "RIGHTS_NOT_APPROVED",
      `Container ${containerId} rights status is ${container.rightsStatus}; validation not permitted`,
      false,
    );
  }

  const runKey = `validate-${sha16(container.contentSha256)}-${VALIDATE_PROCESSOR_VERSION}-j${job.id}`;

  // Create or resume validation run (idempotent per job attempt)
  await dbc
    .insert(researchValidationRuns)
    .values({
      containerId,
      jobId: job.id,
      runKey,
      processorVersion: VALIDATE_PROCESSOR_VERSION,
      status: "RUNNING",
    })
    .onConflictDoNothing();

  const [run] = await dbc
    .select()
    .from(researchValidationRuns)
    .where(
      and(
        eq(researchValidationRuns.containerId, containerId),
        eq(researchValidationRuns.runKey, runKey),
      ),
    );

  if (!run) {
    throw new ProcessorFailure("RUN_MISSING", `Validation run for container ${containerId} could not be created`, true);
  }

  // Fetch all candidates for this container (non-rejected)
  const allCandidates = await dbc
    .select()
    .from(researchCaseCandidates)
    .where(eq(researchCaseCandidates.containerId, containerId));

  const activeCandidates = allCandidates.filter((c) => c.reviewStatus !== "rejected" && c.status !== "rejected");

  // ── Zero-candidate path ──────────────────────────────────────────────────

  if (activeCandidates.length === 0) {
    await dbc.transaction(async (tx) => {
      await tx
        .update(researchValidationRuns)
        .set({ status: "COMPLETE", finishedAt: new Date() })
        .where(eq(researchValidationRuns.id, run.id));

      await tx.insert(researchTransformations).values({
        containerId,
        kind: "validation",
        detail: { runId: run.id, candidateCount: 0, failCount: 0, uncertainCount: 0, message: "zero active candidates — skipping coherence" },
        actor: `job:${job.id}`,
      });

      await recordAuditEvent(tx, {
        entityType: "container",
        entityId: containerId,
        event: "validation-run",
        detail: { runId: run.id, candidateCount: 0, failCount: 0, uncertainCount: 0 },
        actor: `job:${job.id}`,
      });

      await transitionContainer(containerId, "EDITORIAL_REVIEW_PENDING", {
        actor: `job:${job.id}`,
        detail: { runId: run.id, candidateCount: 0 },
        dbc: tx,
      });
    });
    return {};
  }

  // ── Fetch page data for all active candidates ─────────────────────────

  // Collect all page IDs for these candidates via their boundaries
  const candidatePageSets = new Map<number, number[]>(); // candidateId → [pageId]
  for (const c of activeCandidates) {
    const [cb] = await dbc
      .select()
      .from(researchCaseCandidateBoundaries)
      .where(eq(researchCaseCandidateBoundaries.candidateId, c.id));
    if (!cb) { candidatePageSets.set(c.id, []); continue; }

    const [startBound, endBound] = await Promise.all([
      dbc.select().from(researchCaseBoundaries).where(eq(researchCaseBoundaries.id, cb.startBoundaryId)).then((r) => r[0]),
      dbc.select().from(researchCaseBoundaries).where(eq(researchCaseBoundaries.id, cb.endBoundaryId)).then((r) => r[0]),
    ]);

    if (!startBound || !endBound) { candidatePageSets.set(c.id, []); continue; }

    // Fetch all pages of the container sorted by page number
    const allPages = await dbc
      .select()
      .from(researchSourcePages)
      .where(eq(researchSourcePages.containerId, containerId));

    const startPageRow = allPages.find((p) => p.id === startBound.pageId);
    const endPageRow = allPages.find((p) => p.id === endBound.pageId);
    if (!startPageRow || !endPageRow) { candidatePageSets.set(c.id, []); continue; }

    const minPage = Math.min(startPageRow.pageNumber, endPageRow.pageNumber);
    const maxPage = Math.max(startPageRow.pageNumber, endPageRow.pageNumber);
    const pageIds = allPages
      .filter((p) => p.pageNumber >= minPage && p.pageNumber <= maxPage)
      .map((p) => p.id);
    candidatePageSets.set(c.id, pageIds);
  }

  // Fetch page extractions for all relevant page IDs
  const allPageIds = [...new Set([...candidatePageSets.values()].flat())];
  const pageMap = new Map<number, PageData>();

  if (allPageIds.length > 0) {
    const sourcePages = await dbc
      .select()
      .from(researchSourcePages)
      .where(inArray(researchSourcePages.id, allPageIds));

    // Get latest extraction per page
    const extractions = await dbc
      .select()
      .from(researchPageExtractions)
      .where(inArray(researchPageExtractions.pageId, allPageIds))
      .orderBy(desc(researchPageExtractions.id));

    const latestByPage = new Map<number, typeof extractions[0]>();
    for (const ex of extractions) {
      if (!latestByPage.has(ex.pageId)) latestByPage.set(ex.pageId, ex);
    }

    for (const sp of sourcePages) {
      const ex = latestByPage.get(sp.id);
      pageMap.set(sp.id, {
        id: sp.id,
        pageNumber: sp.pageNumber,
        text: ex?.rawText ?? "",
        isBlank: ex?.isBlank ?? false,
      });
    }
  }

  // ── Run coherence checks per candidate ────────────────────────────────

  let totalFail = 0;
  let totalUncertain = 0;

  for (const candidate of activeCandidates) {
    const pageIds = candidatePageSets.get(candidate.id) ?? [];
    const checks = checkCoherence(candidate.id, pageIds, pageMap, []);
    const { failCount, uncertainCount } = countFailures(checks);
    totalFail += failCount;
    totalUncertain += uncertainCount;

    // Insert checks idempotently
    for (const chk of checks) {
      await dbc
        .insert(researchCandidateCoherenceChecks)
        .values({
          validationRunId: run.id,
          candidateId: candidate.id,
          checkType: chk.checkType,
          result: chk.result,
          detail: chk.detail,
          processorVersion: chk.processorVersion,
        })
        .onConflictDoNothing();
    }
  }

  // ── Cross-file relationship detection ────────────────────────────────

  // Fetch all candidates in the same source batch (across containers)
  const allContainerCandidates: CandidateSummary[] = [];
  for (const c of activeCandidates) {
    const pageIds = candidatePageSets.get(c.id) ?? [];
    const pages = pageIds.map((id) => pageMap.get(id)).filter((p): p is PageData => p != null);
    const startPage = pages.reduce((min, p) => (!min || p.pageNumber < min.pageNumber ? p : min), null as PageData | null);
    const endPage = pages.reduce((max, p) => (!max || p.pageNumber > max.pageNumber ? p : max), null as PageData | null);

    const lastText = endPage?.text ?? "";
    const firstText = startPage?.text ?? "";

    // Detect closing order on last page
    const hasClosingOrder = /\border\s+accordingly\b/i.test(lastText) ||
      /\bappeal\s+(is\s+)?(allowed|dismissed)\b/i.test(lastText) ||
      /\bhereby\s+(ordered|adjudged)\b/i.test(lastText);
    const hasBeginning = /\[\d{4}\]/.test(firstText) || /\bCORAM\b/i.test(firstText) || /\bIN THE\b.*\bCOURT\b/i.test(firstText);

    allContainerCandidates.push({
      id: c.id,
      containerId: containerId,
      sourceBatch: container.sourceBatch,
      contentSha256: null,
      startPageNumber: startPage?.pageNumber ?? 0,
      endPageNumber: endPage?.pageNumber ?? 0,
      hasClosingOrder,
      hasBeginning,
      strength: c.strength,
    });
  }

  const pagesByCandidateId = new Map<number, PageData[]>();
  for (const c of activeCandidates) {
    const pageIds = candidatePageSets.get(c.id) ?? [];
    pagesByCandidateId.set(c.id, pageIds.map((id) => pageMap.get(id)).filter((p): p is PageData => p != null));
  }

  const relationships = detectAllCrossFileRelationships(allContainerCandidates, pagesByCandidateId);

  for (const { sourceCandidateId, targetCandidateId, relationship } of relationships) {
    await dbc
      .insert(researchCrossFileRelationships)
      .values({
        sourceCandidateId,
        targetCandidateId,
        relationshipType: relationship.relationshipType,
        evidence: { ...relationship.evidence, confidenceNote: relationship.confidenceNote },
      })
      .onConflictDoNothing();
  }

  // ── Finalise run ─────────────────────────────────────────────────────

  const needsReview = totalFail > 0 || totalUncertain > 0;
  const runStatus = needsReview ? "REVIEW_REQUIRED" : "COMPLETE";

  await dbc.transaction(async (tx) => {
    await tx
      .update(researchValidationRuns)
      .set({ status: runStatus, finishedAt: new Date() })
      .where(eq(researchValidationRuns.id, run.id));

    await tx.insert(researchTransformations).values({
      containerId,
      kind: "validation",
      detail: {
        runId: run.id,
        candidateCount: activeCandidates.length,
        failCount: totalFail,
        uncertainCount: totalUncertain,
        crossFileRelationships: relationships.length,
      },
      actor: `job:${job.id}`,
    });

    await recordAuditEvent(tx, {
      entityType: "container",
      entityId: containerId,
      event: "validation-run",
      detail: {
        runId: run.id,
        candidateCount: activeCandidates.length,
        failCount: totalFail,
        uncertainCount: totalUncertain,
      },
      actor: `job:${job.id}`,
    });

    if (needsReview) {
      await transitionContainer(containerId, "SEGMENTATION_REVIEW_REQUIRED", {
        actor: `job:${job.id}`,
        detail: { runId: run.id, failCount: totalFail, uncertainCount: totalUncertain },
        dbc: tx,
      });
    } else {
      await transitionContainer(containerId, "EDITORIAL_REVIEW_PENDING", {
        actor: `job:${job.id}`,
        detail: { runId: run.id, candidateCount: activeCandidates.length },
        dbc: tx,
      });
    }
  });

  return {};
}

export function registerValidationProcessor(): void {
  registerProcessor(VALIDATE_JOB_KIND, validateProcessor, { touchesContent: true });
  logger.info({}, "Validation processor registered");
}
