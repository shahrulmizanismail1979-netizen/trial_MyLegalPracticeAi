// Phase 10: AI analysis routes.
//
// Routes:
//   POST   /api/research/admin/ai-providers            — create provider (admin)
//   GET    /api/research/admin/ai-providers            — list providers (admin)
//   PATCH  /api/research/admin/ai-providers/:id        — enable/disable (admin)
//
//   POST   /api/research/judgments/:id/analysis        — trigger run (researcher+)
//   GET    /api/research/judgments/:id/analysis        — latest run (view access)
//   GET    /api/research/analysis/:runId               — specific run (view access)
//   PATCH  /api/research/analysis/:runId/review        — review run (legal_reviewer+)

import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { requireResearchRole, resolveResearchRole } from "../auth";
import {
  checkContainerAccess,
  AccessDeniedError,
} from "../domain/gates";
import { EntityNotFoundError } from "../domain/types";
import {
  listProviders,
  createProvider,
  enableProvider,
  disableProvider,
  getAnalysisRun,
  getLatestRunForJudgment,
  reviewRun,
  submitRunForReview,
  AI_ANALYSIS_DISCLAIMER,
} from "../analysis/service";
import { enqueueAiAnalysis } from "../analysis/processor";
import { runAiAnalysis, AnalysisError } from "../analysis/generator";
import { getEnabledProvider } from "../analysis/service";
import { db, researchVerifiedJudgments, researchAiAnalysisRuns } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

// ── Admin: provider management ─────────────────────────────────────────────

const CreateProviderBody = z.object({
  name: z.enum(["gemini", "openai"]),
  modelName: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(256).max(131072).optional(),
  promptVersion: z.string().optional(),
});

router.post(
  "/admin/ai-providers",
  requireResearchRole("owner", "administrator"),
  async (req, res) => {
    const parsed = CreateProviderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const provider = await createProvider(
      { ...parsed.data, approvedBy: req.authEmail ?? "unknown" },
      db,
    );
    res.status(201).json(provider);
  },
);

router.get(
  "/admin/ai-providers",
  requireResearchRole("owner", "administrator"),
  async (_req, res) => {
    res.json(await listProviders(db));
  },
);

const PatchProviderBody = z.object({
  action: z.enum(["enable", "disable"]),
});

router.patch(
  "/admin/ai-providers/:id",
  requireResearchRole("owner", "administrator"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid provider id" });
      return;
    }
    const parsed = PatchProviderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const provider =
      parsed.data.action === "enable"
        ? await enableProvider(id, req.authEmail ?? "unknown", db)
        : await disableProvider(id, db);
    if (!provider) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }
    res.json(provider);
  },
);

// ── Trigger analysis run ───────────────────────────────────────────────────

router.post("/judgments/:id/analysis", async (req, res) => {
  const judgmentId = Number(req.params.id);
  if (!Number.isInteger(judgmentId)) {
    res.status(400).json({ error: "Invalid judgment id" });
    return;
  }

  // Load judgment to get containerId.
  const [judgment] = await db
    .select()
    .from(researchVerifiedJudgments)
    .where(eq(researchVerifiedJudgments.id, judgmentId));
  if (!judgment) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Gate: "analyse" action (requires researcher role or above).
  try {
    await checkContainerAccess(
      judgment.containerId,
      req.researchRole ?? null,
      "analyse",
      { actor: req.authEmail ?? undefined },
    );
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      // 404 (not 403) — non-leak policy consistent with other research routes.
      const view = await checkContainerAccess(
        judgment.containerId,
        req.researchRole ?? null,
        "view",
        { actor: req.authEmail ?? undefined, audit: false },
      ).catch(() => null);
      if (view?.decision.allowed) {
        res.status(403).json({ error: "Forbidden", reason: err.reason });
      } else {
        res.status(404).json({ error: "Not found" });
      }
      return;
    }
    if (err instanceof EntityNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }

  // Trigger the job (enqueue for async processing).
  try {
    await enqueueAiAnalysis(judgment.containerId);
    res.status(202).json({
      message: "AI analysis job enqueued",
      judgmentId,
      containerId: judgment.containerId,
    });
  } catch (err) {
    if (err instanceof AnalysisError) {
      const status =
        err.code === "PROVIDER_DISABLED" || err.code === "PROVIDER_NOT_FOUND"
          ? 503
          : err.code === "ANALYSIS_NOT_PERMITTED"
            ? 403
            : 422;
      res.status(status).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// ── Get latest analysis for a judgment ────────────────────────────────────

router.get("/judgments/:id/analysis", async (req, res) => {
  const judgmentId = Number(req.params.id);
  if (!Number.isInteger(judgmentId)) {
    res.status(400).json({ error: "Invalid judgment id" });
    return;
  }

  const [judgment] = await db
    .select()
    .from(researchVerifiedJudgments)
    .where(eq(researchVerifiedJudgments.id, judgmentId));
  if (!judgment) {
    res.status(404).json({ error: "Not found" });
    return;
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
      return;
    }
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }

  const result = await getLatestRunForJudgment(
    judgmentId,
    req.researchRole ?? null,
    db,
  );
  if (!result) {
    res.status(404).json({ error: "No analysis run found for this judgment" });
    return;
  }

  // Always include disclaimer.
  res.json({ ...result, disclaimer: AI_ANALYSIS_DISCLAIMER });
});

// ── Get specific analysis run ──────────────────────────────────────────────

router.get("/analysis/:runId", async (req, res) => {
  const runId = Number(req.params.runId);
  if (!Number.isInteger(runId)) {
    res.status(400).json({ error: "Invalid run id" });
    return;
  }

  const result = await getAnalysisRun(runId, db);
  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Load the judgment to check view access on the container.
  const [judgment] = await db
    .select()
    .from(researchVerifiedJudgments)
    .where(eq(researchVerifiedJudgments.id, result.run.judgmentId));
  if (!judgment) {
    res.status(404).json({ error: "Not found" });
    return;
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
      return;
    }
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }

  // DRAFT runs are only visible to reviewers.
  if (
    result.run.status === "DRAFT" &&
    !["owner", "administrator", "rights_reviewer", "legal_reviewer"].includes(
      req.researchRole ?? "",
    )
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ ...result, disclaimer: AI_ANALYSIS_DISCLAIMER });
});

// ── Review a run ───────────────────────────────────────────────────────────

const ReviewRunBody = z.object({
  action: z.enum(["submit_for_review", "approve", "reject"]),
  reviewNotes: z.string().optional(),
});

router.patch(
  "/analysis/:runId/review",
  requireResearchRole("owner", "administrator", "legal_reviewer"),
  async (req, res) => {
    const runId = Number(req.params.runId);
    if (!Number.isInteger(runId)) {
      res.status(400).json({ error: "Invalid run id" });
      return;
    }

    const parsed = ReviewRunBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    // Load run → judgment → container; apply non-leak 404 policy.
    const result = await getAnalysisRun(runId, db);
    if (!result) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const [judgment] = await db
      .select()
      .from(researchVerifiedJudgments)
      .where(eq(researchVerifiedJudgments.id, result.run.judgmentId));
    if (!judgment) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Container-level access gate (non-leak 404 policy: callers without view
    // access see the same 404 as a non-existent run).
    try {
      const { decision } = await checkContainerAccess(
        judgment.containerId,
        req.researchRole ?? null,
        "view",
        { actor: req.authEmail ?? undefined },
      );
      if (!decision.allowed) {
        res.status(404).json({ error: "Not found" });
        return;
      }
    } catch (err) {
      if (err instanceof EntityNotFoundError) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }

    const { action, reviewNotes } = parsed.data;
    const reviewerEmail = req.authEmail ?? "unknown";

    let run;
    if (action === "submit_for_review") {
      run = await submitRunForReview(runId, db);
    } else {
      run = await reviewRun(
        runId,
        action === "approve" ? "APPROVED" : "REJECTED",
        reviewerEmail,
        reviewNotes ?? null,
        db,
      );
    }

    if (!run) {
      res.status(404).json({
        error: "Run not found or transition not allowed",
      });
      return;
    }

    res.json(run);
  },
);

export default router;
