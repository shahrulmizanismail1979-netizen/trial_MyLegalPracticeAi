/**
 * Matter-aware AI review: assembles a matter's full context from the shared
 * intelligence tables (plus optional per-portal deadline/saved-work fetchers)
 * and asks Gemini to produce a grounded "review this matter / what should I do
 * next" briefing.
 *
 * This is a self-contained router-builder — the orchestrator mounts the router
 * returned by buildCaseReviewRouter() per portal. It does NOT touch
 * attachCaseIntelligence.ts or any other workstream's file.
 *
 * Routes (relative to where the router is mounted):
 *   GET  /matters/:id/context  — the assembled matter context as JSON
 *   POST /matters/:id/review   — AI review { review: string } (markdown)
 *
 * SECURITY: every route resolves the owner key first (401 if absent) and gates
 * access with verifyMatterOwnership(portal, matterId, ownerKey). Reads of the
 * shared tables (case_stage_history, case_checklists, case_time_entries) are
 * additionally scoped by portal + matter_id + owner_key in SQL, following the
 * caseChecklist.ts pattern. No cross-tenant reads are possible.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import { logger } from "./logger";
import { PORTAL_NAMES, PORTAL_STAGES, type Portal } from "./caseStages";
import { verifyMatterOwnership } from "./caseOwnership";

/** A single saved-work entry as surfaced to the review context. */
export interface SavedWorkItem {
  title: string;
  kind: string;
  created_at: string;
  content: string;
}

/** A single deadline as surfaced to the review context. */
export interface DeadlineItem {
  title: string;
  due_date: string;
  status: string;
}

export interface CaseReviewOptions {
  /**
   * Optional per-portal deadline fetcher. Each portal owns its own deadlines
   * table, so the orchestrator wires this in. Must itself be owner-scoped.
   * If absent, deadlines are skipped.
   */
  fetchDeadlines?: (matterId: number, ownerKey: string) => Promise<DeadlineItem[]>;
  /**
   * Optional per-portal saved-work fetcher. Returns title/kind/created_at plus
   * the (already trimmed or full) content — this builder trims to ~500 chars.
   * Must itself be owner-scoped. If absent, saved work is skipped.
   */
  fetchSavedWork?: (
    matterId: number,
    ownerKey: string,
  ) => Promise<Array<Omit<SavedWorkItem, "content"> & { content: string }>>;
}

/** The full assembled context returned by GET /matters/:id/context. */
export interface MatterContext {
  matter: Record<string, unknown>;
  currentStage: string | null;
  stageHistory: Array<{ from_stage: string | null; to_stage: string; changed_at: string }>;
  deadlines: DeadlineItem[];
  checklist: Array<{ item_text: string; done: boolean; position: number }>;
  timeSummary: { entryCount: number; totalMinutes: number };
  savedWork: SavedWorkItem[];
}

const CONTENT_PREVIEW_CHARS = 500;

// ── Context assembly ──────────────────────────────────────────────────────────

/**
 * Assembles the full matter context. Assumes ownership has ALREADY been
 * verified by the caller. Each supporting query is owner-scoped and best-effort
 * (a missing/optional source resolves to an empty result rather than throwing).
 */
async function assembleContext(
  portal: Portal,
  matterId: number,
  ownerKey: string,
  opts: CaseReviewOptions,
): Promise<MatterContext | null> {
  // Matter row — queried generically from the portal's own table.
  const { rows: matterRows } = await pool.query(
    `SELECT * FROM ${portal}_matters WHERE id = $1 LIMIT 1`,
    [matterId],
  );
  if (!matterRows.length) return null;
  const matter = matterRows[0] as Record<string, unknown>;

  // Stage history (shared table, scoped by portal + matter_id).
  const { rows: history } = await pool
    .query(
      `SELECT from_stage, to_stage, changed_at FROM case_stage_history
       WHERE portal = $1 AND matter_id = $2 ORDER BY changed_at`,
      [portal, matterId],
    )
    .catch(() => ({
      rows: [] as Array<{ from_stage: string | null; to_stage: string; changed_at: string }>,
    }));

  // Checklist items (shared table, scoped by portal + matter_id + owner_key).
  const { rows: checklist } = await pool
    .query(
      `SELECT item_text, done, position FROM case_checklists
       WHERE portal = $1 AND matter_id = $2 AND owner_key = $3
       ORDER BY position, id`,
      [portal, matterId, ownerKey],
    )
    .catch(() => ({
      rows: [] as Array<{ item_text: string; done: boolean; position: number }>,
    }));

  // Time entries summary (shared table, scoped by portal + matter_id + owner_key).
  const { rows: timeRows } = await pool
    .query(
      `SELECT COUNT(*)::int AS entry_count, COALESCE(SUM(minutes), 0)::int AS total_minutes
       FROM case_time_entries
       WHERE portal = $1 AND matter_id = $2 AND owner_key = $3`,
      [portal, matterId, ownerKey],
    )
    .catch(() => ({ rows: [{ entry_count: 0, total_minutes: 0 }] }));
  const timeSummary = {
    entryCount: (timeRows[0]?.entry_count as number) ?? 0,
    totalMinutes: (timeRows[0]?.total_minutes as number) ?? 0,
  };

  // Deadlines — per-portal callback (owner-scoped by the orchestrator).
  let deadlines: DeadlineItem[] = [];
  if (opts.fetchDeadlines) {
    deadlines = await opts
      .fetchDeadlines(matterId, ownerKey)
      .catch((err: unknown) => {
        logger.warn({ err, portal, matterId }, "fetchDeadlines failed (non-fatal)");
        return [] as DeadlineItem[];
      });
  }

  // Saved work — per-portal callback; trim content to a preview.
  let savedWork: SavedWorkItem[] = [];
  if (opts.fetchSavedWork) {
    const raw = await opts
      .fetchSavedWork(matterId, ownerKey)
      .catch((err: unknown) => {
        logger.warn({ err, portal, matterId }, "fetchSavedWork failed (non-fatal)");
        return [] as Array<Omit<SavedWorkItem, "content"> & { content: string }>;
      });
    savedWork = raw.map((w) => ({
      title: w.title,
      kind: w.kind,
      created_at: w.created_at,
      content: (w.content ?? "").slice(0, CONTENT_PREVIEW_CHARS),
    }));
  }

  return {
    matter,
    currentStage: (matter.status as string | null) ?? null,
    stageHistory: history,
    deadlines,
    checklist,
    timeSummary,
    savedWork,
  };
}

// ── AI review prompt ──────────────────────────────────────────────────────────

function buildReviewPrompt(portal: Portal, context: MatterContext): string {
  const portalName = PORTAL_NAMES[portal];
  // Keep only useful, non-null matter fields to avoid feeding noise/PII columns.
  const matterFields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(context.matter)) {
    if (v === null || v === undefined || v === "") continue;
    matterFields[k] = v;
  }

  const payload = {
    portal: portalName,
    allowedStages: PORTAL_STAGES[portal],
    currentStage: context.currentStage,
    matter: matterFields,
    stageHistory: context.stageHistory,
    deadlines: context.deadlines,
    checklist: context.checklist,
    timeSummary: context.timeSummary,
    savedWork: context.savedWork,
  };

  return `You are a Malaysian legal practice management assistant for ${portalName}.

You are reviewing ONE matter. Below is ALL the data available for this matter as JSON.

MATTER DATA:
${JSON.stringify(payload, null, 2)}

Produce a concise practitioner briefing in GitHub-flavoured Markdown with these sections, in this order:

## Matter Summary
A short factual summary of what this matter is about.

## Current Position
Where the matter currently stands (stage, what has been done, time recorded).

## Outstanding Items
Checklist items not yet done and pending deadlines.

## Gaps & Risks
Missing information, unaddressed deadlines, or procedural risks evident FROM THE DATA.

## Prioritised Next Actions
A numbered list of concrete next steps, ordered highest priority first. For each, note why and any relevant deadline that is already in the data.

CRITICAL RULES:
- Use ONLY the matter data provided above. Do NOT invent facts, dates, parties, case numbers, statutes, or authorities that are not present in the data.
- Do NOT cite legislation or case law unless it already appears verbatim in the matter data.
- If information needed to advise is missing, say so explicitly under "Gaps & Risks" rather than guessing.
- Clearly mark any uncertainty with words like "unclear from the record" or "not stated in the file".
- This is practice-management guidance, not legal advice; keep it practical and grounded.

Respond with the Markdown briefing only — no preamble, no code fences.`;
}

async function generateReview(portal: Portal, context: MatterContext): Promise<string> {
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: buildReviewPrompt(portal, context) }],
      },
    ],
    config: { maxOutputTokens: 8192 },
  });
  const raw = (result.text ?? "").trim();
  if (!raw) throw new Error("Empty response from AI model");
  // Strip an accidental outer code fence if the model wrapped its output.
  return raw.replace(/^```(?:markdown)?\n?/m, "").replace(/\n?```$/m, "").trim();
}

// ── Route builder ─────────────────────────────────────────────────────────────

/**
 * Builds a router exposing matter-aware AI review routes for one portal.
 * The orchestrator mounts this router at the portal's base path so the routes
 * resolve to {base}/matters/:id/context and {base}/matters/:id/review.
 *
 * @param portal        Which portal these routes belong to.
 * @param getOwnerKey   Returns the owner key string (or null = 401).
 * @param opts          Optional per-portal deadline/saved-work fetchers.
 */
export function buildCaseReviewRouter(
  portal: Portal,
  getOwnerKey: (req: Request, res: Response) => string | null,
  opts: CaseReviewOptions = {},
): IRouter {
  const router: IRouter = Router({ mergeParams: true });

  // GET /matters/:id/context ────────────────────────────────────────────────
  router.get("/:id/context", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matterId = parseInt((req.params as Record<string, string>).id ?? "0", 10);
    if (Number.isNaN(matterId) || matterId <= 0) {
      res.status(400).json({ error: "Invalid matter id" });
      return;
    }

    // Gate: caller must own the matter before we assemble anything.
    const owned = await verifyMatterOwnership(portal, matterId, ownerKey);
    if (!owned) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }

    const context = await assembleContext(portal, matterId, ownerKey, opts);
    if (!context) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }
    res.json(context);
  });

  // POST /matters/:id/review ─────────────────────────────────────────────────
  router.post("/:id/review", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matterId = parseInt((req.params as Record<string, string>).id ?? "0", 10);
    if (Number.isNaN(matterId) || matterId <= 0) {
      res.status(400).json({ error: "Invalid matter id" });
      return;
    }

    // Gate: caller must own the matter before we assemble anything.
    const owned = await verifyMatterOwnership(portal, matterId, ownerKey);
    if (!owned) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }

    const context = await assembleContext(portal, matterId, ownerKey, opts);
    if (!context) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }

    try {
      const review = await generateReview(portal, context);
      res.json({ review });
    } catch (err) {
      logger.error({ err, portal, matterId }, "Matter review generation failed");
      res.status(502).json({ error: "Failed to generate matter review" });
    }
  });

  return router;
}
