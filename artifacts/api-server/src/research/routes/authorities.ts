// Phase 11a: Authorities & Legislation routes.
//
// Routes:
//   POST   /api/research/judgments/:id/authorities/extract   — trigger extraction (legal_reviewer+)
//   GET    /api/research/judgments/:id/authorities           — list authorities (view access)
//   PATCH  /api/research/authorities/:authorityId/review     — review treatment (legal_reviewer+)
//   GET    /api/research/judgments/:id/legislation           — list legislation refs (view access)
//   GET    /api/research/judgments/:id/citation-graph        — intra-collection graph (view access)

import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireResearchRole } from "../auth";
import { checkContainerAccess } from "../domain/gates";
import { EntityNotFoundError } from "../domain/types";
import { extractAuthorities, extractLegislation, CITATION_GRAPH_DISCLAIMER } from "../authorities/extractor";
import { getCitationGraph } from "../authorities/citationGraph";
import {
  db,
  researchVerifiedJudgments,
  researchAiAnalysisRuns,
  researchAuthorities,
  researchLegislationRefs,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

// ── Shared judgment-gate helper ────────────────────────────────────────────

async function gateJudgment(
  req: import("express").Request,
  res: import("express").Response,
  judgmentId: number,
): Promise<{ containerId: number } | null> {
  const [judgment] = await db
    .select()
    .from(researchVerifiedJudgments)
    .where(eq(researchVerifiedJudgments.id, judgmentId));

  if (!judgment) {
    res.status(404).json({ error: "Not found" });
    return null;
  }

  try {
    const { decision } = await checkContainerAccess(
      judgment.containerId,
      req.researchRole ?? null,
      "view",
      { actor: req.authEmail ?? undefined },
    );
    if (!decision.allowed) {
      res.status(404).json({ error: "Not found" });
      return null;
    }
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return null;
    }
    throw err;
  }

  return { containerId: judgment.containerId };
}

// ── Trigger extraction ─────────────────────────────────────────────────────

router.post(
  "/judgments/:id/authorities/extract",
  requireResearchRole("owner", "administrator", "legal_reviewer"),
  async (req, res) => {
    const judgmentId = Number(req.params.id);
    if (!Number.isInteger(judgmentId)) {
      res.status(400).json({ error: "Invalid judgment id" });
      return;
    }

    const gate = await gateJudgment(req, res, judgmentId);
    if (!gate) return;

    // Find the latest APPROVED run for this judgment.
    const [run] = await db
      .select()
      .from(researchAiAnalysisRuns)
      .where(
        and(
          eq(researchAiAnalysisRuns.judgmentId, judgmentId),
          eq(researchAiAnalysisRuns.status, "APPROVED"),
        ),
      )
      .orderBy(desc(researchAiAnalysisRuns.id))
      .limit(1);

    if (!run) {
      res.status(409).json({
        error: "No approved AI analysis run found for this judgment",
        code: "NO_APPROVED_RUN",
      });
      return;
    }

    try {
      const [authResult, legResult] = await Promise.all([
        extractAuthorities(run.id, db),
        extractLegislation(run.id, db),
      ]);
      res.status(202).json({
        runId: run.id,
        authoritiesInserted: authResult.inserted,
        reviewItemsCreated: authResult.reviewItemsCreated,
        legislationInserted: legResult.inserted,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(422).json({ error: msg });
    }
  },
);

// ── List authorities for a judgment ───────────────────────────────────────

router.get("/judgments/:id/authorities", async (req, res) => {
  const judgmentId = Number(req.params.id);
  if (!Number.isInteger(judgmentId)) {
    res.status(400).json({ error: "Invalid judgment id" });
    return;
  }

  const gate = await gateJudgment(req, res, judgmentId);
  if (!gate) return;

  const rows = await db
    .select()
    .from(researchAuthorities)
    .where(eq(researchAuthorities.judgmentId, judgmentId))
    .orderBy(researchAuthorities.id);

  const pendingReviewCount = rows.filter((r) => r.reviewStatus === "pending_review").length;

  res.json({
    judgmentId,
    authorities: rows,
    pendingReviewCount,
    disclaimer: CITATION_GRAPH_DISCLAIMER,
  });
});

// ── Review a treatment label ───────────────────────────────────────────────

const ReviewAuthorityBody = z.object({
  reviewStatus: z.enum(["approved", "rejected"]),
  treatment: z.enum([
    "APPLIED", "FOLLOWED", "APPROVED", "ADOPTED", "DISTINGUISHED",
    "CONSIDERED", "DISCUSSED", "EXPLAINED", "CRITICISED", "DOUBTED",
    "DECLINED_TO_FOLLOW", "OVERRULED", "REFERRED_TO", "UNCLEAR",
  ]).optional(),
  treatmentEvidence: z.string().optional(),
});

router.patch(
  "/authorities/:authorityId/review",
  requireResearchRole("owner", "administrator", "legal_reviewer"),
  async (req, res) => {
    const authorityId = Number(req.params.authorityId);
    if (!Number.isInteger(authorityId)) {
      res.status(400).json({ error: "Invalid authority id" });
      return;
    }

    const parsed = ReviewAuthorityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    // Load authority → run → judgment → container to enforce container gate.
    const [authority] = await db
      .select()
      .from(researchAuthorities)
      .where(eq(researchAuthorities.id, authorityId));

    if (!authority) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const gate = await gateJudgment(req, res, authority.judgmentId);
    if (!gate) return;

    const updates: Partial<typeof researchAuthorities.$inferInsert> & {
      reviewedAt: Date;
      reviewerEmail: string;
    } = {
      reviewStatus: parsed.data.reviewStatus,
      reviewerEmail: req.authEmail ?? "unknown",
      reviewedAt: new Date(),
    };
    if (parsed.data.treatment !== undefined) {
      updates.treatment = parsed.data.treatment;
    }
    if (parsed.data.treatmentEvidence !== undefined) {
      updates.treatmentEvidence = parsed.data.treatmentEvidence;
    }

    const [updated] = await db
      .update(researchAuthorities)
      .set(updates)
      .where(eq(researchAuthorities.id, authorityId))
      .returning();

    res.json(updated);
  },
);

// ── List legislation refs for a judgment ──────────────────────────────────

router.get("/judgments/:id/legislation", async (req, res) => {
  const judgmentId = Number(req.params.id);
  if (!Number.isInteger(judgmentId)) {
    res.status(400).json({ error: "Invalid judgment id" });
    return;
  }

  const gate = await gateJudgment(req, res, judgmentId);
  if (!gate) return;

  const rows = await db
    .select()
    .from(researchLegislationRefs)
    .where(eq(researchLegislationRefs.judgmentId, judgmentId))
    .orderBy(researchLegislationRefs.id);

  res.json({ judgmentId, legislation: rows });
});

// ── Citation graph ─────────────────────────────────────────────────────────

router.get("/judgments/:id/citation-graph", async (req, res) => {
  const judgmentId = Number(req.params.id);
  if (!Number.isInteger(judgmentId)) {
    res.status(400).json({ error: "Invalid judgment id" });
    return;
  }

  const gate = await gateJudgment(req, res, judgmentId);
  if (!gate) return;

  const graph = await getCitationGraph(judgmentId, db);
  res.json(graph);
});

export default router;
