import { Router, type IRouter } from "express";
import { logger } from "../../lib/logger";
import { z } from "zod/v4";
import {
  db,
  researchCaseCandidates,
  researchCaseBoundaries,
  researchCaseCandidateBoundaries,
  researchCandidateReviewActions,
  researchCandidateCoherenceChecks,
  researchCrossFileRelationships,
  researchCrossFileSpans,
  researchCrossFileSpanSegments,
  researchTransformations,
  researchSourcePages,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, ne, or } from "drizzle-orm";
import { requireResearchRole } from "../auth";
import { recordAuditEvent } from "../domain/audit";
import { checkContainerAccess } from "../domain/gates";
import { EntityNotFoundError } from "../domain/types";
import { ProcessorFailure } from "../processing/handlers";
import { startValidation, registerValidationProcessor } from "../validation/pipeline";

// Phase 06 web layer: structured reviewer actions + cross-file span management.
// All reviewer actions are append-only. Every action writes one
// research_candidate_review_actions row + one research_transformations row +
// one research_audit_events row in the same transaction.

registerValidationProcessor();

const router: IRouter = Router();

const STAFF_ROLES = ["owner", "administrator", "rights_reviewer", "legal_reviewer"] as const;
// Roles authorised to execute candidate review actions (tighter than STAFF_ROLES)
const REVIEW_ROLES = ["owner", "administrator", "legal_reviewer"] as const;

async function requireContainerView(
  req: import("express").Request,
  res: import("express").Response,
  containerId: number,
): Promise<boolean> {
  try {
    const { decision } = await checkContainerAccess(
      containerId,
      req.researchRole ?? null,
      "view",
      { actor: req.authEmail ?? undefined },
    );
    if (!decision.allowed) {
      res.status(404).json({ error: "Not found" });
      return false;
    }
    return true;
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return false;
    }
    throw err;
  }
}

async function requireCandidate(
  req: import("express").Request,
  res: import("express").Response,
  candidateId: number,
  containerId: number,
) {
  const [candidate] = await db
    .select()
    .from(researchCaseCandidates)
    .where(
      and(
        eq(researchCaseCandidates.id, candidateId),
        eq(researchCaseCandidates.containerId, containerId),
      ),
    );
  if (!candidate) {
    res.status(404).json({ error: "Candidate not found" });
    return null;
  }
  return candidate;
}

function actorFrom(req: import("express").Request): string {
  return req.authEmail ?? `role:${req.researchRole}`;
}

async function recordAction(
  candidateId: number,
  actionType: (typeof db extends any ? string : string),
  actor: string,
  detail: Record<string, unknown>,
  containerId: number,
): Promise<{ actionId: number; transformationId: number }> {
  let actionId: number;
  let transformationId: number;

  await db.transaction(async (tx) => {
    const [transformation] = await tx
      .insert(researchTransformations)
      .values({
        containerId,
        kind: `candidate.${actionType.toLowerCase()}`,
        detail: { candidateId, ...detail },
        actor,
        reviewed: false,
      })
      .returning({ id: researchTransformations.id });

    transformationId = transformation.id;

    const [action] = await tx
      .insert(researchCandidateReviewActions)
      .values({
        candidateId,
        actionType: actionType as any,
        actor,
        detail,
        transformationId: transformation.id,
      })
      .returning({ id: researchCandidateReviewActions.id });

    actionId = action.id;

    await recordAuditEvent(tx, {
      entityType: "case_candidate",
      entityId: candidateId,
      event: `review:${actionType.toLowerCase()}`,
      actor,
      detail: { containerId, ...detail, transformationId: transformation.id, actionId: action.id },
    });
  });

  return { actionId: actionId!, transformationId: transformationId! };
}

// ── APPROVE ───────────────────────────────────────────────────────────────

router.post(
  "/candidates/:id/review/approve",
  requireResearchRole(...REVIEW_ROLES),
  async (req, res) => {
    const candidateId = Number(req.params.id);
    if (!Number.isInteger(candidateId)) { res.status(400).json({ error: "Invalid candidate id" }); return; }

    const [candidate] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    if (!(await requireContainerView(req, res, candidate.containerId))) return;

    if (candidate.reviewStatus === "reviewed") {
      res.status(409).json({ error: "Candidate already approved", code: "ALREADY_APPROVED" }); return;
    }
    if (candidate.reviewStatus === "rejected") {
      res.status(409).json({ error: "Candidate already rejected", code: "ALREADY_REJECTED" }); return;
    }

    const actor = actorFrom(req);
    const { reason = "" } = (req.body as Record<string, string>) ?? {};

    await db.transaction(async (tx) => {
      await tx
        .update(researchCaseCandidates)
        .set({ reviewStatus: "reviewed", reviewedBy: actor, reviewedAt: new Date() })
        .where(eq(researchCaseCandidates.id, candidateId));

      // Also mark boundaries as reviewed
      const [cb] = await tx.select().from(researchCaseCandidateBoundaries).where(eq(researchCaseCandidateBoundaries.candidateId, candidateId));
      if (cb) {
        await tx.update(researchCaseBoundaries).set({ reviewStatus: "reviewed", reviewedBy: actor, reviewedAt: new Date() }).where(eq(researchCaseBoundaries.id, cb.startBoundaryId));
        await tx.update(researchCaseBoundaries).set({ reviewStatus: "reviewed", reviewedBy: actor, reviewedAt: new Date() }).where(eq(researchCaseBoundaries.id, cb.endBoundaryId));
      }

      const [transformation] = await tx.insert(researchTransformations).values({ containerId: candidate.containerId, kind: "candidate.approve", detail: { candidateId, reason }, actor }).returning({ id: researchTransformations.id });
      await tx.insert(researchCandidateReviewActions).values({ candidateId, actionType: "APPROVE", actor, detail: { reason }, transformationId: transformation.id });
      await recordAuditEvent(tx, { entityType: "case_candidate", entityId: candidateId, event: "review:APPROVE", fromState: candidate.reviewStatus ?? "review_required", toState: "reviewed", actor, detail: { containerId: candidate.containerId, reason } });
    });

    const [updated] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    res.json(updated);
  },
);

// ── REJECT ────────────────────────────────────────────────────────────────

const RejectBody = z.object({ reason: z.string().min(1) });

router.post(
  "/candidates/:id/review/reject",
  requireResearchRole(...REVIEW_ROLES),
  async (req, res) => {
    const candidateId = Number(req.params.id);
    if (!Number.isInteger(candidateId)) { res.status(400).json({ error: "Invalid candidate id" }); return; }

    const [candidate] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    if (!(await requireContainerView(req, res, candidate.containerId))) return;

    if (candidate.reviewStatus === "rejected") {
      res.status(409).json({ error: "Candidate already rejected", code: "ALREADY_REJECTED" }); return;
    }
    if (candidate.reviewStatus === "reviewed") {
      res.status(409).json({ error: "Candidate already approved", code: "ALREADY_APPROVED" }); return;
    }

    const parsed = RejectBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

    const actor = actorFrom(req);

    await db.transaction(async (tx) => {
      await tx.update(researchCaseCandidates).set({ reviewStatus: "rejected", reviewedBy: actor, reviewedAt: new Date() }).where(eq(researchCaseCandidates.id, candidateId));
      const [transformation] = await tx.insert(researchTransformations).values({ containerId: candidate.containerId, kind: "candidate.reject", detail: { candidateId, reason: parsed.data.reason }, actor }).returning({ id: researchTransformations.id });
      await tx.insert(researchCandidateReviewActions).values({ candidateId, actionType: "REJECT", actor, detail: { reason: parsed.data.reason }, transformationId: transformation.id });
      await recordAuditEvent(tx, { entityType: "case_candidate", entityId: candidateId, event: "review:REJECT", fromState: candidate.reviewStatus ?? "review_required", toState: "rejected", actor, detail: { containerId: candidate.containerId, reason: parsed.data.reason } });
    });

    const [updated] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    res.json(updated);
  },
);

// ── REQUEST_REPROCESSING ──────────────────────────────────────────────────

router.post(
  "/candidates/:id/review/reprocess",
  requireResearchRole(...REVIEW_ROLES),
  async (req, res) => {
    const candidateId = Number(req.params.id);
    if (!Number.isInteger(candidateId)) { res.status(400).json({ error: "Invalid candidate id" }); return; }

    const [candidate] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    if (!(await requireContainerView(req, res, candidate.containerId))) return;

    const actor = actorFrom(req);
    const { reason = "" } = (req.body as Record<string, string>) ?? {};

    await recordAction(candidateId, "REQUEST_REPROCESSING", actor, { reason }, candidate.containerId);

    // Enqueue a fresh validation job for the container
    try {
      const { jobId } = await startValidation(candidate.containerId, actor);
      res.json({ candidateId, jobId, message: "Reprocessing enqueued" });
    } catch (err) {
      if (err instanceof ProcessorFailure && err.code === "INVALID_STATE") {
        res.status(409).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  },
);

// ── MOVE_BOUNDARY ─────────────────────────────────────────────────────────

const MoveBoundaryBody = z.object({
  boundaryRole: z.enum(["start", "end"]),
  newPageId: z.number().int().positive(),
  reason: z.string().min(1),
});

router.post(
  "/candidates/:id/review/move-boundary",
  requireResearchRole(...REVIEW_ROLES),
  async (req, res) => {
    const candidateId = Number(req.params.id);
    if (!Number.isInteger(candidateId)) { res.status(400).json({ error: "Invalid candidate id" }); return; }

    const [candidate] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    if (!(await requireContainerView(req, res, candidate.containerId))) return;

    const parsed = MoveBoundaryBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

    const { boundaryRole, newPageId, reason } = parsed.data;

    // Validate the new page belongs to this container
    const [page] = await db.select().from(researchSourcePages).where(
      and(eq(researchSourcePages.id, newPageId), eq(researchSourcePages.containerId, candidate.containerId)),
    );
    if (!page) {
      res.status(400).json({ error: "Page does not belong to this container", code: "PAGE_NOT_IN_CONTAINER" }); return;
    }

    // Reject rather than coerce: runId is a required FK on researchCaseBoundaries.
    if (candidate.runId == null) {
      res.status(400).json({ error: "Cannot move boundary on a candidate with no segmentation run", code: "NO_RUN_ID" }); return;
    }

    const actor = actorFrom(req);

    // Append-only lineage: reject the original candidate and create a new one
    // with the adjusted boundary. This preserves the immutable lineage chain.
    const [cb] = await db.select().from(researchCaseCandidateBoundaries).where(eq(researchCaseCandidateBoundaries.candidateId, candidateId));
    if (!cb) {
      res.status(400).json({ error: "Candidate has no boundaries; cannot move boundary", code: "NO_BOUNDARIES" }); return;
    }

    const [startBound] = await db.select().from(researchCaseBoundaries).where(eq(researchCaseBoundaries.id, cb.startBoundaryId));
    const [endBound] = await db.select().from(researchCaseBoundaries).where(eq(researchCaseBoundaries.id, cb.endBoundaryId));
    if (!startBound || !endBound) {
      res.status(400).json({ error: "Boundary records not found", code: "BOUNDARIES_MISSING" }); return;
    }

    let newCandidateId: number | null = null;

    await db.transaction(async (tx) => {
      // candidate.runId is validated non-null above (400 guard before transaction)
      const runId = candidate.runId!;

      // 1. Create a new boundary at the requested page
      await tx.insert(researchCaseBoundaries).values({
        runId,
        pageId: newPageId,
        boundaryRole,
        strength: "MODERATE_BOUNDARY_CANDIDATE",
        compositeScore: 0,
        conflictingSignalCount: 0,
        reviewStatus: "reviewed",
        reviewedBy: actor,
        reviewedAt: new Date(),
      }).onConflictDoNothing();

      const [newBound] = await tx.select().from(researchCaseBoundaries).where(
        and(eq(researchCaseBoundaries.pageId, newPageId), eq(researchCaseBoundaries.boundaryRole, boundaryRole), eq(researchCaseBoundaries.runId, runId)),
      );
      if (!newBound) return; // boundary insert collision — treat as no-op

      // 2. Create a new candidate with the adjusted boundary span
      const newStartBoundId = boundaryRole === "start" ? newBound.id : cb.startBoundaryId;
      const newEndBoundId = boundaryRole === "end" ? newBound.id : cb.endBoundaryId;
      const newStartPageId = boundaryRole === "start" ? newPageId : candidate.startPageId;

      const [newCand] = await tx.insert(researchCaseCandidates).values({
        containerId: candidate.containerId,
        runId: candidate.runId,
        startPageId: newStartPageId,
        strength: candidate.strength,
        pageCount: null,
        reviewStatus: "review_required",
        spans: candidate.spans,
        detail: {
          moveBoundaryFrom: candidateId,
          boundaryRole,
          oldBoundaryId: boundaryRole === "start" ? cb.startBoundaryId : cb.endBoundaryId,
          newBoundaryId: newBound.id,
          reason,
        },
      }).returning({ id: researchCaseCandidates.id });

      if (!newCand) return;
      newCandidateId = newCand.id;

      await tx.insert(researchCaseCandidateBoundaries).values({
        candidateId: newCand.id,
        startBoundaryId: newStartBoundId,
        endBoundaryId: newEndBoundId,
      }).onConflictDoNothing();

      // 3. Mark the original candidate as rejected (superseded by the new one)
      await tx.update(researchCaseCandidates)
        .set({ reviewStatus: "rejected", reviewedBy: actor, reviewedAt: new Date(),
               detail: { ...(candidate.detail as Record<string, unknown>), supersededBy: newCand.id, supersededReason: "MOVE_BOUNDARY" } })
        .where(eq(researchCaseCandidates.id, candidateId));

      // 4. Record transformation and audit (append-only)
      const [transformation] = await tx.insert(researchTransformations).values({
        containerId: candidate.containerId,
        kind: "candidate.move_boundary",
        detail: { originalCandidateId: candidateId, newCandidateId: newCand.id, boundaryRole, newPageId, reason },
        actor,
      }).returning({ id: researchTransformations.id });

      await tx.insert(researchCandidateReviewActions).values({ candidateId, actionType: "MOVE_BOUNDARY", actor, detail: { newCandidateId: newCand.id, boundaryRole, newPageId, reason }, transformationId: transformation.id });
      await recordAuditEvent(tx, { entityType: "case_candidate", entityId: candidateId, event: "review:MOVE_BOUNDARY", actor, detail: { containerId: candidate.containerId, newCandidateId: newCand.id, boundaryRole, newPageId, reason } });
    });

    // 5. Re-validate the container so the new candidate gets coherence checks
    if (newCandidateId !== null) {
      try {
        await startValidation(candidate.containerId, actor);
      } catch (e) {
        logger.warn({ err: e, containerId: candidate.containerId }, "Could not enqueue validation after move-boundary");
      }
    }

    res.status(201).json({ originalCandidateId: candidateId, newCandidateId, message: "Boundary moved; new candidate created" });
  },
);

// ── SPLIT ─────────────────────────────────────────────────────────────────

const SplitBody = z.object({
  splitPageId: z.number().int().positive(),
  reason: z.string().min(1),
});

router.post(
  "/candidates/:id/review/split",
  requireResearchRole("owner", "administrator", "legal_reviewer"),
  async (req, res) => {
    const candidateId = Number(req.params.id);
    if (!Number.isInteger(candidateId)) { res.status(400).json({ error: "Invalid candidate id" }); return; }

    const [candidate] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    if (!(await requireContainerView(req, res, candidate.containerId))) return;

    const parsed = SplitBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

    const { splitPageId, reason } = parsed.data;

    // Validate split page belongs to the container
    const [splitPage] = await db.select().from(researchSourcePages).where(
      and(eq(researchSourcePages.id, splitPageId), eq(researchSourcePages.containerId, candidate.containerId)),
    );
    if (!splitPage) {
      res.status(400).json({ error: "Split page does not belong to this container", code: "PAGE_NOT_IN_CONTAINER" }); return;
    }

    const [cb] = await db.select().from(researchCaseCandidateBoundaries).where(eq(researchCaseCandidateBoundaries.candidateId, candidateId));
    if (!cb) {
      res.status(400).json({ error: "Candidate has no boundaries; cannot split", code: "NO_BOUNDARIES" }); return;
    }

    const [startBound] = await db.select().from(researchCaseBoundaries).where(eq(researchCaseBoundaries.id, cb.startBoundaryId));
    const [endBound] = await db.select().from(researchCaseBoundaries).where(eq(researchCaseBoundaries.id, cb.endBoundaryId));
    if (!startBound || !endBound) {
      res.status(400).json({ error: "Boundary records not found", code: "BOUNDARIES_MISSING" }); return;
    }

    // Validate split page is strictly within the candidate span
    const [startBoundPage] = await db.select({ pageNumber: researchSourcePages.pageNumber })
      .from(researchSourcePages).where(eq(researchSourcePages.id, startBound.pageId));
    const [endBoundPage] = await db.select({ pageNumber: researchSourcePages.pageNumber })
      .from(researchSourcePages).where(eq(researchSourcePages.id, endBound.pageId));
    if (startBoundPage && endBoundPage) {
      if (splitPage.pageNumber <= startBoundPage.pageNumber || splitPage.pageNumber >= endBoundPage.pageNumber) {
        res.status(400).json({ error: "Split page must be strictly within the candidate span", code: "SPLIT_PAGE_OUT_OF_SPAN" }); return;
      }
    }

    const actor = actorFrom(req);
    let newCandidateIds: number[] = [];

    await db.transaction(async (tx) => {
      // Mark original as rejected
      await tx.update(researchCaseCandidates).set({ reviewStatus: "rejected", reviewedBy: actor, reviewedAt: new Date() }).where(eq(researchCaseCandidates.id, candidateId));

      // Candidate A: original start → splitPage (as end)
      await tx.insert(researchCaseBoundaries).values({
        runId: startBound.runId,
        pageId: splitPageId,
        boundaryRole: "end",
        strength: "MODERATE_BOUNDARY_CANDIDATE",
        compositeScore: 0,
        conflictingSignalCount: 0,
        reviewStatus: "review_required",
      }).onConflictDoNothing();

      const [splitEndBound] = await tx.select().from(researchCaseBoundaries).where(
        and(eq(researchCaseBoundaries.pageId, splitPageId), eq(researchCaseBoundaries.boundaryRole, "end"), eq(researchCaseBoundaries.runId, startBound.runId)),
      );

      const [newCandA] = await tx.insert(researchCaseCandidates).values({
        containerId: candidate.containerId,
        runId: candidate.runId,
        startPageId: startBound.pageId,
        strength: candidate.strength,
        pageCount: null,
        reviewStatus: "review_required",
        spans: candidate.spans,
        detail: { splitFrom: candidateId, part: "A", reason },
      }).returning({ id: researchCaseCandidates.id });

      if (newCandA && splitEndBound) {
        await tx.insert(researchCaseCandidateBoundaries).values({ candidateId: newCandA.id, startBoundaryId: startBound.id, endBoundaryId: splitEndBound.id }).onConflictDoNothing();
        newCandidateIds.push(newCandA.id);
      }

      // Candidate B: next page after splitPage → original end
      // Find the page right after splitPage in the container
      const allPages = await tx.select().from(researchSourcePages).where(eq(researchSourcePages.containerId, candidate.containerId));
      const sortedPages = allPages.sort((a, b) => a.pageNumber - b.pageNumber);
      const splitPageIdx = sortedPages.findIndex((p) => p.id === splitPageId);
      const nextPage = splitPageIdx >= 0 && splitPageIdx + 1 < sortedPages.length ? sortedPages[splitPageIdx + 1] : null;

      if (nextPage) {
        await tx.insert(researchCaseBoundaries).values({
          runId: startBound.runId,
          pageId: nextPage.id,
          boundaryRole: "start",
          strength: "MODERATE_BOUNDARY_CANDIDATE",
          compositeScore: 0,
          conflictingSignalCount: 0,
          reviewStatus: "review_required",
        }).onConflictDoNothing();

        const [splitStartBound] = await tx.select().from(researchCaseBoundaries).where(
          and(eq(researchCaseBoundaries.pageId, nextPage.id), eq(researchCaseBoundaries.boundaryRole, "start"), eq(researchCaseBoundaries.runId, startBound.runId)),
        );

        const [newCandB] = await tx.insert(researchCaseCandidates).values({
          containerId: candidate.containerId,
          runId: candidate.runId,
          startPageId: nextPage.id,
          strength: candidate.strength,
          pageCount: null,
          reviewStatus: "review_required",
          spans: candidate.spans,
          detail: { splitFrom: candidateId, part: "B", reason },
        }).returning({ id: researchCaseCandidates.id });

        if (newCandB && splitStartBound) {
          await tx.insert(researchCaseCandidateBoundaries).values({ candidateId: newCandB.id, startBoundaryId: splitStartBound.id, endBoundaryId: endBound.id }).onConflictDoNothing();
          newCandidateIds.push(newCandB.id);
        }
      }

      const [transformation] = await tx.insert(researchTransformations).values({
        containerId: candidate.containerId,
        kind: "candidate.split",
        detail: { originalCandidateId: candidateId, splitPageId, newCandidateIds, reason },
        actor,
      }).returning({ id: researchTransformations.id });

      await tx.insert(researchCandidateReviewActions).values({ candidateId, actionType: "SPLIT", actor, detail: { splitPageId, newCandidateIds, reason }, transformationId: transformation.id });
      await recordAuditEvent(tx, { entityType: "case_candidate", entityId: candidateId, event: "review:SPLIT", actor, detail: { containerId: candidate.containerId, splitPageId, newCandidateIds, reason } });
    });

    // Enqueue re-validation so the new candidates get coherence checks
    try {
      await startValidation(candidate.containerId, actor);
    } catch (e) {
      logger.warn({ err: e, containerId: candidate.containerId }, "Could not enqueue validation after split");
    }

    res.status(201).json({ originalCandidateId: candidateId, newCandidateIds, message: "Split successful" });
  },
);

// ── MERGE ─────────────────────────────────────────────────────────────────

const MergeBody = z.object({
  targetCandidateId: z.number().int().positive(),
  reason: z.string().min(1),
});

router.post(
  "/candidates/:id/review/merge",
  requireResearchRole("owner", "administrator", "legal_reviewer"),
  async (req, res) => {
    const candidateId = Number(req.params.id);
    if (!Number.isInteger(candidateId)) { res.status(400).json({ error: "Invalid candidate id" }); return; }

    const [candidate] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    if (!(await requireContainerView(req, res, candidate.containerId))) return;

    const parsed = MergeBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

    const { targetCandidateId, reason } = parsed.data;
    if (targetCandidateId === candidateId) {
      res.status(400).json({ error: "Cannot merge a candidate with itself", code: "SELF_MERGE" }); return;
    }

    const [targetCandidate] = await db.select().from(researchCaseCandidates).where(
      and(eq(researchCaseCandidates.id, targetCandidateId), eq(researchCaseCandidates.containerId, candidate.containerId)),
    );
    if (!targetCandidate) {
      res.status(404).json({ error: "Target candidate not found or belongs to different container", code: "TARGET_NOT_FOUND" }); return;
    }

    const actor = actorFrom(req);
    let mergedCandidateId: number | null = null;

    const [cbA] = await db.select().from(researchCaseCandidateBoundaries).where(eq(researchCaseCandidateBoundaries.candidateId, candidateId));
    const [cbB] = await db.select().from(researchCaseCandidateBoundaries).where(eq(researchCaseCandidateBoundaries.candidateId, targetCandidateId));

    // ── Adjacency + boundary-order check ─────────────────────────────────
    // Merging non-adjacent candidates creates structurally invalid spans.
    // Enforce adjacency AND compute the canonical (earliest-start, latest-end)
    // merged boundaries by actual page sequence — not by request argument order.
    let mergedStartBoundId: number | undefined;
    let mergedEndBoundId: number | undefined;
    let mergedStartPageId: number | null = null;

    if (cbA && cbB) {
      const [pA_s, pA_e, pB_s, pB_e] = await Promise.all([
        db.select({ pageNumber: researchSourcePages.pageNumber, pageId: researchSourcePages.id })
          .from(researchCaseBoundaries)
          .innerJoin(researchSourcePages, eq(researchSourcePages.id, researchCaseBoundaries.pageId))
          .where(eq(researchCaseBoundaries.id, cbA.startBoundaryId))
          .then(r => r[0]),
        db.select({ pageNumber: researchSourcePages.pageNumber })
          .from(researchCaseBoundaries)
          .innerJoin(researchSourcePages, eq(researchSourcePages.id, researchCaseBoundaries.pageId))
          .where(eq(researchCaseBoundaries.id, cbA.endBoundaryId))
          .then(r => r[0]),
        db.select({ pageNumber: researchSourcePages.pageNumber, pageId: researchSourcePages.id })
          .from(researchCaseBoundaries)
          .innerJoin(researchSourcePages, eq(researchSourcePages.id, researchCaseBoundaries.pageId))
          .where(eq(researchCaseBoundaries.id, cbB.startBoundaryId))
          .then(r => r[0]),
        db.select({ pageNumber: researchSourcePages.pageNumber })
          .from(researchCaseBoundaries)
          .innerJoin(researchSourcePages, eq(researchSourcePages.id, researchCaseBoundaries.pageId))
          .where(eq(researchCaseBoundaries.id, cbB.endBoundaryId))
          .then(r => r[0]),
      ]);

      if (pA_s && pA_e && pB_s && pB_e) {
        // Determine which candidate's span comes first by start page
        const [first, second] = pA_s.pageNumber <= pB_s.pageNumber
          ? [{ s: pA_s.pageNumber, e: pA_e.pageNumber }, { s: pB_s.pageNumber, e: pB_e.pageNumber }]
          : [{ s: pB_s.pageNumber, e: pB_e.pageNumber }, { s: pA_s.pageNumber, e: pA_e.pageNumber }];
        // Adjacent: second's start must be within 1 page of first's end (gap ≤ 1).
        // A gap of 2+ pages means non-contiguous spans that must not be merged.
        const isAdjacent = second.s - first.e <= 1;
        if (!isAdjacent) {
          res.status(400).json({ error: "Candidates are not adjacent; merge would create a gap or overlap", code: "NOT_ADJACENT" }); return;
        }
        // Canonical order: earliest start boundary + latest end boundary
        if (pA_s.pageNumber <= pB_s.pageNumber) {
          mergedStartBoundId = cbA.startBoundaryId;
          mergedEndBoundId = cbB.endBoundaryId;
          mergedStartPageId = pA_s.pageId;
        } else {
          mergedStartBoundId = cbB.startBoundaryId;
          mergedEndBoundId = cbA.endBoundaryId;
          mergedStartPageId = pB_s.pageId;
        }
      }
    }

    await db.transaction(async (tx) => {
      // Mark both originals as rejected
      await tx.update(researchCaseCandidates).set({ reviewStatus: "rejected", reviewedBy: actor, reviewedAt: new Date() }).where(inArray(researchCaseCandidates.id, [candidateId, targetCandidateId]));

      // New merged candidate spans both — use page-ordered boundaries
      const startBoundId = mergedStartBoundId ?? cbA?.startBoundaryId ?? cbB?.startBoundaryId;
      const endBoundId = mergedEndBoundId ?? cbB?.endBoundaryId ?? cbA?.endBoundaryId;
      const startPageId = mergedStartPageId;

      const [merged] = await tx.insert(researchCaseCandidates).values({
        containerId: candidate.containerId,
        runId: candidate.runId,
        startPageId: startPageId ?? null,
        strength: candidate.strength,
        pageCount: null,
        reviewStatus: "review_required",
        spans: [{ mergedFrom: [candidateId, targetCandidateId] }],
        detail: { mergedFrom: [candidateId, targetCandidateId], reason },
      }).returning({ id: researchCaseCandidates.id });

      mergedCandidateId = merged.id;

      if (merged && startBoundId && endBoundId) {
        await tx.insert(researchCaseCandidateBoundaries).values({ candidateId: merged.id, startBoundaryId: startBoundId, endBoundaryId: endBoundId }).onConflictDoNothing();
      }

      const [transformation] = await tx.insert(researchTransformations).values({
        containerId: candidate.containerId,
        kind: "candidate.merge",
        detail: { originalIds: [candidateId, targetCandidateId], mergedCandidateId: merged.id, reason },
        actor,
      }).returning({ id: researchTransformations.id });

      // One action row per invocation (the source candidate initiated the merge)
      await tx.insert(researchCandidateReviewActions).values({ candidateId, actionType: "MERGE", actor, detail: { targetCandidateId, mergedCandidateId: merged.id, reason }, transformationId: transformation.id });
      await recordAuditEvent(tx, { entityType: "case_candidate", entityId: candidateId, event: "review:MERGE", actor, detail: { containerId: candidate.containerId, targetCandidateId, mergedCandidateId: merged.id, reason } });
    });

    // Enqueue re-validation so the merged candidate gets coherence checks
    try {
      await startValidation(candidate.containerId, actor);
    } catch (e) {
      logger.warn({ err: e, containerId: candidate.containerId }, "Could not enqueue validation after merge");
    }

    res.status(201).json({ mergedCandidateId, originalIds: [candidateId, targetCandidateId], message: "Merge successful" });
  },
);

// ── MARK_NON_CASE ─────────────────────────────────────────────────────────

const MarkBody = z.object({ reason: z.string().min(1) });

router.post(
  "/candidates/:id/review/mark-non-case",
  requireResearchRole(...REVIEW_ROLES),
  async (req, res) => {
    const candidateId = Number(req.params.id);
    if (!Number.isInteger(candidateId)) { res.status(400).json({ error: "Invalid candidate id" }); return; }

    const [candidate] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    if (!(await requireContainerView(req, res, candidate.containerId))) return;

    const parsed = MarkBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

    const actor = actorFrom(req);

    await db.transaction(async (tx) => {
      await tx.update(researchCaseCandidates).set({ status: "non_case", reviewedBy: actor, reviewedAt: new Date() }).where(eq(researchCaseCandidates.id, candidateId));
      const [transformation] = await tx.insert(researchTransformations).values({ containerId: candidate.containerId, kind: "candidate.mark_non_case", detail: { candidateId, reason: parsed.data.reason }, actor }).returning({ id: researchTransformations.id });
      await tx.insert(researchCandidateReviewActions).values({ candidateId, actionType: "MARK_NON_CASE", actor, detail: { reason: parsed.data.reason }, transformationId: transformation.id });
      await recordAuditEvent(tx, { entityType: "case_candidate", entityId: candidateId, event: "review:MARK_NON_CASE", actor, detail: { containerId: candidate.containerId, reason: parsed.data.reason } });
    });

    const [updated] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    res.json(updated);
  },
);

// ── MARK_INCOMPLETE ───────────────────────────────────────────────────────

router.post(
  "/candidates/:id/review/mark-incomplete",
  requireResearchRole(...REVIEW_ROLES),
  async (req, res) => {
    const candidateId = Number(req.params.id);
    if (!Number.isInteger(candidateId)) { res.status(400).json({ error: "Invalid candidate id" }); return; }

    const [candidate] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    if (!(await requireContainerView(req, res, candidate.containerId))) return;

    const parsed = MarkBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

    const actor = actorFrom(req);

    await db.transaction(async (tx) => {
      await tx.update(researchCaseCandidates).set({ status: "incomplete", reviewedBy: actor, reviewedAt: new Date() }).where(eq(researchCaseCandidates.id, candidateId));
      const [transformation] = await tx.insert(researchTransformations).values({ containerId: candidate.containerId, kind: "candidate.mark_incomplete", detail: { candidateId, reason: parsed.data.reason }, actor }).returning({ id: researchTransformations.id });
      await tx.insert(researchCandidateReviewActions).values({ candidateId, actionType: "MARK_INCOMPLETE", actor, detail: { reason: parsed.data.reason }, transformationId: transformation.id });
      await recordAuditEvent(tx, { entityType: "case_candidate", entityId: candidateId, event: "review:MARK_INCOMPLETE", actor, detail: { containerId: candidate.containerId, reason: parsed.data.reason } });
    });

    const [updated] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    res.json(updated);
  },
);

// ── LINK_CONTINUATION ─────────────────────────────────────────────────────

const LinkContinuationBody = z.object({
  targetCandidateId: z.number().int().positive(),
  confirmed: z.boolean(),
  reason: z.string().optional(),
});

router.post(
  "/candidates/:id/review/link-continuation",
  requireResearchRole(...REVIEW_ROLES),
  async (req, res) => {
    const candidateId = Number(req.params.id);
    if (!Number.isInteger(candidateId)) { res.status(400).json({ error: "Invalid candidate id" }); return; }

    const [candidate] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    if (!(await requireContainerView(req, res, candidate.containerId))) return;

    const parsed = LinkContinuationBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

    const { targetCandidateId, confirmed, reason } = parsed.data;

    const [targetCandidate] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, targetCandidateId));
    if (!targetCandidate) { res.status(404).json({ error: "Target candidate not found" }); return; }
    if (!(await requireContainerView(req, res, targetCandidate.containerId))) return;

    const actor = actorFrom(req);
    const relType = confirmed ? "CONFIRMED_CONTINUATION" : "POSSIBLE_CONTINUATION";

    const [src, tgt] = candidateId < targetCandidateId ? [candidateId, targetCandidateId] : [targetCandidateId, candidateId];

    await db.transaction(async (tx) => {
      await tx.insert(researchCrossFileRelationships).values({
        sourceCandidateId: src,
        targetCandidateId: tgt,
        relationshipType: relType,
        evidence: { manuallyLinked: true, reason: reason ?? "" },
        confirmedBy: confirmed ? actor : null,
        confirmedAt: confirmed ? new Date() : null,
      }).onConflictDoUpdate({
        target: [researchCrossFileRelationships.sourceCandidateId, researchCrossFileRelationships.targetCandidateId],
        set: {
          relationshipType: relType,
          evidence: { manuallyLinked: true, reason: reason ?? "" },
          confirmedBy: confirmed ? actor : null,
          confirmedAt: confirmed ? new Date() : null,
        },
      });

      const [transformation] = await tx.insert(researchTransformations).values({ containerId: candidate.containerId, kind: "candidate.link_continuation", detail: { candidateId, targetCandidateId, relType, confirmed }, actor }).returning({ id: researchTransformations.id });
      await tx.insert(researchCandidateReviewActions).values({ candidateId, actionType: "LINK_CONTINUATION", actor, detail: { targetCandidateId, confirmed, relType, reason: reason ?? "" }, transformationId: transformation.id });
      await recordAuditEvent(tx, { entityType: "case_candidate", entityId: candidateId, event: "review:LINK_CONTINUATION", actor, detail: { containerId: candidate.containerId, targetCandidateId, relType, confirmed } });
    });

    res.json({ sourceCandidateId: src, targetCandidateId: tgt, relationshipType: relType });
  },
);

// ── LINK_DUPLICATE ────────────────────────────────────────────────────────

const LinkDuplicateBody = z.object({
  targetCandidateId: z.number().int().positive(),
  type: z.enum(["POSSIBLE_DUPLICATE", "EXACT_DUPLICATE", "ALTERNATIVE_VERSION", "CORRECTED_VERSION"]),
  reason: z.string().optional(),
});

router.post(
  "/candidates/:id/review/link-duplicate",
  requireResearchRole(...REVIEW_ROLES),
  async (req, res) => {
    const candidateId = Number(req.params.id);
    if (!Number.isInteger(candidateId)) { res.status(400).json({ error: "Invalid candidate id" }); return; }

    const [candidate] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    if (!(await requireContainerView(req, res, candidate.containerId))) return;

    const parsed = LinkDuplicateBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

    const { targetCandidateId, type: relType, reason } = parsed.data;

    const [targetCandidateDup] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, targetCandidateId));
    if (!targetCandidateDup) { res.status(404).json({ error: "Target candidate not found" }); return; }
    if (!(await requireContainerView(req, res, targetCandidateDup.containerId))) return;

    const actor = actorFrom(req);
    const [src, tgt] = candidateId < targetCandidateId ? [candidateId, targetCandidateId] : [targetCandidateId, candidateId];

    await db.transaction(async (tx) => {
      await tx.insert(researchCrossFileRelationships).values({
        sourceCandidateId: src,
        targetCandidateId: tgt,
        relationshipType: relType,
        evidence: { manuallyLinked: true, reason: reason ?? "" },
        confirmedBy: actor,
        confirmedAt: new Date(),
      }).onConflictDoUpdate({
        target: [researchCrossFileRelationships.sourceCandidateId, researchCrossFileRelationships.targetCandidateId],
        set: {
          relationshipType: relType,
          evidence: { manuallyLinked: true, reason: reason ?? "" },
          confirmedBy: actor,
          confirmedAt: new Date(),
        },
      });

      const [transformation] = await tx.insert(researchTransformations).values({ containerId: candidate.containerId, kind: "candidate.link_duplicate", detail: { candidateId, targetCandidateId, relType }, actor }).returning({ id: researchTransformations.id });
      await tx.insert(researchCandidateReviewActions).values({ candidateId, actionType: "LINK_DUPLICATE", actor, detail: { targetCandidateId, relType, reason: reason ?? "" }, transformationId: transformation.id });
      await recordAuditEvent(tx, { entityType: "case_candidate", entityId: candidateId, event: "review:LINK_DUPLICATE", actor, detail: { containerId: candidate.containerId, targetCandidateId, relType } });
    });

    res.json({ sourceCandidateId: src, targetCandidateId: tgt, relationshipType: relType });
  },
);

// ── LINK_RELATED ──────────────────────────────────────────────────────────

const LinkRelatedBody = z.object({
  targetCandidateId: z.number().int().positive(),
  type: z.enum(["RELATED_APPEAL", "UNRELATED"]),
  reason: z.string().optional(),
});

router.post(
  "/candidates/:id/review/link-related",
  requireResearchRole(...REVIEW_ROLES),
  async (req, res) => {
    const candidateId = Number(req.params.id);
    if (!Number.isInteger(candidateId)) { res.status(400).json({ error: "Invalid candidate id" }); return; }

    const [candidate] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    if (!(await requireContainerView(req, res, candidate.containerId))) return;

    const parsed = LinkRelatedBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

    const { targetCandidateId, type: relType, reason } = parsed.data;

    const [targetCandidateRel] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, targetCandidateId));
    if (!targetCandidateRel) { res.status(404).json({ error: "Target candidate not found" }); return; }
    if (!(await requireContainerView(req, res, targetCandidateRel.containerId))) return;

    const actor = actorFrom(req);
    const [src, tgt] = candidateId < targetCandidateId ? [candidateId, targetCandidateId] : [targetCandidateId, candidateId];

    await db.transaction(async (tx) => {
      await tx.insert(researchCrossFileRelationships).values({
        sourceCandidateId: src,
        targetCandidateId: tgt,
        relationshipType: relType,
        evidence: { manuallyLinked: true, reason: reason ?? "" },
        confirmedBy: actor,
        confirmedAt: new Date(),
      }).onConflictDoUpdate({
        target: [researchCrossFileRelationships.sourceCandidateId, researchCrossFileRelationships.targetCandidateId],
        set: {
          relationshipType: relType,
          evidence: { manuallyLinked: true, reason: reason ?? "" },
          confirmedBy: actor,
          confirmedAt: new Date(),
        },
      });

      const [transformation] = await tx.insert(researchTransformations).values({ containerId: candidate.containerId, kind: "candidate.link_related", detail: { candidateId, targetCandidateId, relType }, actor }).returning({ id: researchTransformations.id });
      await tx.insert(researchCandidateReviewActions).values({ candidateId, actionType: "LINK_RELATED", actor, detail: { targetCandidateId, relType, reason: reason ?? "" }, transformationId: transformation.id });
      await recordAuditEvent(tx, { entityType: "case_candidate", entityId: candidateId, event: "review:LINK_RELATED", actor, detail: { containerId: candidate.containerId, targetCandidateId, relType } });
    });

    res.json({ sourceCandidateId: src, targetCandidateId: tgt, relationshipType: relType });
  },
);

// ── Cross-file span list for a candidate ──────────────────────────────────

router.get(
  "/candidates/:id/relationships",
  requireResearchRole(...STAFF_ROLES),
  async (req, res) => {
    const candidateId = Number(req.params.id);
    if (!Number.isInteger(candidateId)) { res.status(400).json({ error: "Invalid candidate id" }); return; }

    const [candidate] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    if (!(await requireContainerView(req, res, candidate.containerId))) return;

    const relationships = await db
      .select()
      .from(researchCrossFileRelationships)
      .where(
        or(
          eq(researchCrossFileRelationships.sourceCandidateId, candidateId),
          eq(researchCrossFileRelationships.targetCandidateId, candidateId),
        ),
      );

    res.json(relationships);
  },
);

// ── Coherence checks for a candidate ────────────────────────────────────

router.get(
  "/candidates/:id/coherence",
  requireResearchRole(...STAFF_ROLES),
  async (req, res) => {
    const candidateId = Number(req.params.id);
    if (!Number.isInteger(candidateId)) { res.status(400).json({ error: "Invalid candidate id" }); return; }

    const [candidate] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    if (!(await requireContainerView(req, res, candidate.containerId))) return;

    const checks = await db
      .select()
      .from(researchCandidateCoherenceChecks)
      .where(eq(researchCandidateCoherenceChecks.candidateId, candidateId))
      .orderBy(desc(researchCandidateCoherenceChecks.id));

    res.json(checks);
  },
);

// ── Review action history ─────────────────────────────────────────────────

router.get(
  "/candidates/:id/review/actions",
  requireResearchRole(...STAFF_ROLES),
  async (req, res) => {
    const candidateId = Number(req.params.id);
    if (!Number.isInteger(candidateId)) { res.status(400).json({ error: "Invalid candidate id" }); return; }

    const [candidate] = await db.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateId));
    if (!candidate) { res.status(404).json({ error: "Candidate not found" }); return; }
    if (!(await requireContainerView(req, res, candidate.containerId))) return;

    const actions = await db
      .select()
      .from(researchCandidateReviewActions)
      .where(eq(researchCandidateReviewActions.candidateId, candidateId))
      .orderBy(desc(researchCandidateReviewActions.createdAt))
      .limit(50);

    res.json(actions);
  },
);

// ── Cross-file spans ──────────────────────────────────────────────────────

const CreateSpanBody = z.object({
  candidateIds: z.array(z.number().int().positive()).min(2),
  note: z.string().min(1),
});

router.post(
  "/cross-file-spans",
  requireResearchRole("owner", "administrator", "legal_reviewer"),
  async (req, res) => {
    const parsed = CreateSpanBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

    const { candidateIds, note } = parsed.data;
    const actor = actorFrom(req);

    // Validate all candidates exist and are not already in an approved span
    const candidates = await db
      .select()
      .from(researchCaseCandidates)
      .where(inArray(researchCaseCandidates.id, candidateIds));

    if (candidates.length !== candidateIds.length) {
      res.status(400).json({ error: "One or more candidates not found", code: "CANDIDATES_NOT_FOUND" }); return;
    }

    // Rights gate: requester must have view access to each candidate's container
    for (const candidate of candidates) {
      const ok = await requireContainerView(req, res, candidate.containerId);
      if (!ok) return; // requireContainerView already sent 404
    }

    // Check none are in an approved span already
    const existingSegments = await db
      .select({ candidateId: researchCrossFileSpanSegments.candidateId, spanId: researchCrossFileSpanSegments.spanId })
      .from(researchCrossFileSpanSegments)
      .where(inArray(researchCrossFileSpanSegments.candidateId, candidateIds));

    const approvedSpanIds: number[] = [];
    for (const seg of existingSegments) {
      const [span] = await db.select().from(researchCrossFileSpans).where(eq(researchCrossFileSpans.id, seg.spanId));
      if (span && span.status === "APPROVED") approvedSpanIds.push(span.id);
    }
    if (approvedSpanIds.length > 0) {
      res.status(409).json({ error: "One or more candidates are already in an approved span", code: "ALREADY_IN_APPROVED_SPAN", spanIds: approvedSpanIds }); return;
    }

    // Derive canonical segment order from container/page sequence (not request order)
    const orderedCandidates = [...candidates].sort((a, b) => {
      if (a.containerId !== b.containerId) return a.containerId - b.containerId;
      const aPage = a.startPageId ?? 0;
      const bPage = b.startPageId ?? 0;
      return aPage - bPage;
    });
    const orderedIds = orderedCandidates.map((c) => c.id);

    let spanId: number;
    await db.transaction(async (tx) => {
      const [span] = await tx.insert(researchCrossFileSpans).values({ createdBy: actor, status: "PROPOSED", note }).returning({ id: researchCrossFileSpans.id });
      spanId = span.id;

      for (let i = 0; i < orderedIds.length; i++) {
        await tx.insert(researchCrossFileSpanSegments).values({ spanId: span.id, candidateId: orderedIds[i], segmentOrder: i + 1 }).onConflictDoNothing();
      }

      const containerId = candidates[0]?.containerId;
      if (containerId) {
        await tx.insert(researchTransformations).values({ containerId, kind: "cross_file_span.proposed", detail: { spanId: span.id, candidateIds, note }, actor });
        await recordAuditEvent(tx, { entityType: "case_candidate", entityId: candidateIds[0], event: "cross-file-span:proposed", actor, detail: { spanId: span.id, candidateIds } });
      }
    });

    const [created] = await db.select().from(researchCrossFileSpans).where(eq(researchCrossFileSpans.id, spanId!));
    res.status(201).json(created);
  },
);

router.get(
  "/cross-file-spans",
  requireResearchRole(...STAFF_ROLES),
  async (req, res) => {
    const spans = await db.select().from(researchCrossFileSpans).orderBy(desc(researchCrossFileSpans.id)).limit(100);
    const result = [];
    for (const span of spans) {
      const segments = await db.select().from(researchCrossFileSpanSegments).where(eq(researchCrossFileSpanSegments.spanId, span.id)).orderBy(asc(researchCrossFileSpanSegments.segmentOrder));
      result.push({ ...span, candidateIds: segments.map((s) => s.candidateId) });
    }
    res.json(result);
  },
);

router.get(
  "/cross-file-spans/:id",
  requireResearchRole(...STAFF_ROLES),
  async (req, res) => {
    const spanId = Number(req.params.id);
    if (!Number.isInteger(spanId)) { res.status(400).json({ error: "Invalid span id" }); return; }

    const [span] = await db.select().from(researchCrossFileSpans).where(eq(researchCrossFileSpans.id, spanId));
    if (!span) { res.status(404).json({ error: "Span not found" }); return; }

    const segments = await db.select().from(researchCrossFileSpanSegments).where(eq(researchCrossFileSpanSegments.spanId, spanId)).orderBy(asc(researchCrossFileSpanSegments.segmentOrder));
    const candidateIds = segments.map((s) => s.candidateId);

    const candidates = await db.select().from(researchCaseCandidates).where(inArray(researchCaseCandidates.id, candidateIds));

    // Coherence results for each candidate
    const coherenceChecks = candidateIds.length > 0
      ? await db.select().from(researchCandidateCoherenceChecks).where(inArray(researchCandidateCoherenceChecks.candidateId, candidateIds)).orderBy(asc(researchCandidateCoherenceChecks.id))
      : [];

    // Cross-file relationships involving these candidates (SQL-scoped, no in-memory scan)
    const relationships = candidateIds.length > 0
      ? await db.select().from(researchCrossFileRelationships).where(
          or(
            inArray(researchCrossFileRelationships.sourceCandidateId, candidateIds),
            inArray(researchCrossFileRelationships.targetCandidateId, candidateIds),
          ),
        )
      : [];

    res.json({ span, segments, candidates, coherenceChecks, relationships });
  },
);

router.post(
  "/cross-file-spans/:id/approve",
  requireResearchRole("owner", "administrator"),
  async (req, res) => {
    const spanId = Number(req.params.id);
    if (!Number.isInteger(spanId)) { res.status(400).json({ error: "Invalid span id" }); return; }

    const [span] = await db.select().from(researchCrossFileSpans).where(eq(researchCrossFileSpans.id, spanId));
    if (!span) { res.status(404).json({ error: "Span not found" }); return; }
    if (span.status !== "PROPOSED") { res.status(409).json({ error: "Span is not in PROPOSED status", code: "NOT_PROPOSED", currentStatus: span.status }); return; }

    const actor = actorFrom(req);
    const segments = await db.select().from(researchCrossFileSpanSegments).where(eq(researchCrossFileSpanSegments.spanId, spanId));
    const candidateIds = segments.map((s) => s.candidateId);

    await db.transaction(async (tx) => {
      await tx.update(researchCrossFileSpans).set({ status: "APPROVED", approvedBy: actor, approvedAt: new Date() }).where(eq(researchCrossFileSpans.id, spanId));

      const [firstCandidate] = candidateIds.length > 0 ? await tx.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateIds[0])) : [];
      if (firstCandidate) {
        await tx.insert(researchTransformations).values({ containerId: firstCandidate.containerId, kind: "cross_file_span.approved", detail: { spanId, candidateIds }, actor });
        await recordAuditEvent(tx, { entityType: "case_candidate", entityId: candidateIds[0] ?? spanId, event: "cross-file-span:approved", actor, detail: { spanId, candidateIds } });
      }
    });

    const [updated] = await db.select().from(researchCrossFileSpans).where(eq(researchCrossFileSpans.id, spanId));
    res.json(updated);
  },
);

router.post(
  "/cross-file-spans/:id/reject",
  requireResearchRole("owner", "administrator"),
  async (req, res) => {
    const spanId = Number(req.params.id);
    if (!Number.isInteger(spanId)) { res.status(400).json({ error: "Invalid span id" }); return; }

    const [span] = await db.select().from(researchCrossFileSpans).where(eq(researchCrossFileSpans.id, spanId));
    if (!span) { res.status(404).json({ error: "Span not found" }); return; }
    if (span.status === "APPROVED") { res.status(409).json({ error: "Cannot reject an already-approved span", code: "ALREADY_APPROVED" }); return; }

    const actor = actorFrom(req);
    const { reason = "" } = (req.body as Record<string, string>) ?? {};

    await db.transaction(async (tx) => {
      await tx.update(researchCrossFileSpans).set({ status: "REJECTED" }).where(eq(researchCrossFileSpans.id, spanId));
      const segments = await tx.select().from(researchCrossFileSpanSegments).where(eq(researchCrossFileSpanSegments.spanId, spanId));
      const candidateIds = segments.map((s) => s.candidateId);
      const [firstCandidate] = candidateIds.length > 0 ? await tx.select().from(researchCaseCandidates).where(eq(researchCaseCandidates.id, candidateIds[0])) : [];
      if (firstCandidate) {
        await tx.insert(researchTransformations).values({ containerId: firstCandidate.containerId, kind: "cross_file_span.rejected", detail: { spanId, candidateIds, reason }, actor });
        await recordAuditEvent(tx, { entityType: "case_candidate", entityId: candidateIds[0] ?? spanId, event: "cross-file-span:rejected", actor, detail: { spanId, reason } });
      }
    });

    const [updated] = await db.select().from(researchCrossFileSpans).where(eq(researchCrossFileSpans.id, spanId));
    res.json(updated);
  },
);

export default router;
