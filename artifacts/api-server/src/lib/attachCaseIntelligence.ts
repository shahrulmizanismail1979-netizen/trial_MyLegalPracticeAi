/**
 * Attaches AI case intelligence routes to an existing matter router.
 *
 * Routes added relative to where the router is mounted:
 *   GET  {prefix}/:id/ai-insights              — AI next-steps, summary, risk (cached 6h)
 *   GET  {prefix}/:id/ai-insights?refresh=1    — force-refresh the cache
 *   GET  {prefix}/:id/stage-history            — audit trail of stage changes
 *   PATCH {prefix}/:id/status                  — advance/change the matter stage
 *   GET  {prefix}/:matterId/checklist           — procedural checklist items
 *   POST {prefix}/:matterId/checklist           — add a custom item
 *   PATCH {prefix}/:matterId/checklist/:itemId  — toggle done / edit text
 *   DELETE {prefix}/:matterId/checklist/:itemId — remove item
 *   GET  {prefix}/:matterId/time-entries        — time entries + running total
 *   POST {prefix}/:matterId/time-entries        — log a time entry
 *   DELETE {prefix}/:matterId/time-entries/:entryId — remove a time entry
 *
 * @param router      The IRouter to attach routes to (mutated).
 * @param portal      Which portal these routes belong to.
 * @param pathPrefix  Optional path prefix, e.g. "/matters" for MySyariahAI.
 * @param getOwnerKey Returns the owner key string (or null = 401).
 * @param getMatter   Ownership-verifying matter fetch: returns the matter row
 *                    or sends an error response + returns undefined.
 */
import type { IRouter, Request, Response } from "express";
import { pool } from "@workspace/db";
import { type Portal, PORTAL_STAGES, isValidStage } from "./caseStages";
import { getMatterInsights, invalidateMatterInsights } from "./caseInsights";
import { generateAndSaveChecklist, makeChecklistRouter } from "./caseChecklist";
import { makeTimeRecordingRouter } from "./caseTimeRecording";
import { buildCaseEventsRouter } from "./caseEvents";
import { makeMatterClientsRouter } from "./caseClients";
import { buildCaseReviewRouter, type DeadlineItem, type SavedWorkItem } from "./caseReview";
import { buildCaseBriefingRouter } from "./caseBriefing";
import { attachBilling } from "./caseBilling";
import { attachDocumentVault } from "./caseDocuments";
import { attachDraftWorkspace } from "./caseDrafts";
import { aiRateLimit } from "./aiRateLimit";
import { logger } from "./logger";

type MatterRow = Record<string, unknown>;

export interface IntelligenceOptions {
  router: IRouter;
  portal: Portal;
  /** Optional path prefix prepended to every route pattern. Default: "". */
  pathPrefix?: string;
  getOwnerKey: (req: Request, res: Response) => string | null;
  getMatter: (req: Request, res: Response, id: string) => Promise<MatterRow | undefined>;
}

export function attachCaseIntelligence(opts: IntelligenceOptions): void {
  const { router, portal, getOwnerKey, getMatter } = opts;
  const P = opts.pathPrefix ?? "";

  // ── AI Insights ─────────────────────────────────────────────────────────────
  router.get(`${P}/:id/ai-insights`, aiRateLimit, async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matter = await getMatter(req, res, req.params.id as string);
    if (!matter) return;

    const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true";
    const matterId = matter.id as number;

    // Supporting context for the prompt (best-effort, errors → empty arrays)
    const { rows: docs } = await pool
      .query(
        `SELECT title, content FROM ${portal}_saved_work WHERE matter_id = $1 ORDER BY created_at DESC LIMIT 8`,
        [matterId],
      )
      .catch(() => ({ rows: [] as Array<{ title: string; content: string }> }));

    const { rows: deadlines } = await pool
      .query(
        `SELECT title, due_date, status FROM ${portal}_matter_deadlines WHERE matter_id = $1 ORDER BY due_date LIMIT 15`,
        [matterId],
      )
      .catch(() => ({ rows: [] as Array<{ title: string; due_date: string; status: string }> }));

    const { rows: history } = await pool
      .query(
        `SELECT to_stage, changed_at FROM case_stage_history WHERE portal = $1 AND matter_id = $2 ORDER BY changed_at`,
        [portal, matterId],
      )
      .catch(() => ({ rows: [] as Array<{ to_stage: string; changed_at: string }> }));

    try {
      const insights = await getMatterInsights(
        portal,
        matterId,
        {
          title: (matter.title as string) ?? "",
          matterType: (matter.matter_type ?? matter.matterType) as string | null,
          status: matter.status as string | null,
          notes: matter.notes as string | null,
          plaintiff: matter.plaintiff as string | null,
          defendant: matter.defendant as string | null,
          clientName: (matter.client_name ?? matter.clientName) as string | null,
          charge: matter.charge as string | null,
          court: matter.court as string | null,
          documents: docs.map((d) => ({ title: d.title, content: d.content })),
          deadlines: deadlines.map((d) => ({
            title: d.title,
            dueDate: new Date(d.due_date).toISOString().slice(0, 10),
            status: d.status,
          })),
          stageHistory: history.map((h) => ({
            toStage: h.to_stage,
            changedAt: new Date(h.changed_at).toISOString(),
          })),
        },
        forceRefresh,
      );
      res.json(insights);
    } catch (err) {
      logger.error({ err, portal, matterId }, "Failed to get case insights");
      res.status(500).json({ error: "Failed to generate case insights" });
    }
  });

  // ── Stage history ────────────────────────────────────────────────────────────
  router.get(`${P}/:id/stage-history`, async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matter = await getMatter(req, res, req.params.id as string);
    if (!matter) return;
    const { rows } = await pool.query(
      `SELECT id, from_stage, to_stage, changed_at FROM case_stage_history
       WHERE portal = $1 AND matter_id = $2 ORDER BY changed_at`,
      [portal, matter.id as number],
    );
    res.json(rows);
  });

  // ── Stage update ─────────────────────────────────────────────────────────────
  router.patch(`${P}/:id/status`, async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matter = await getMatter(req, res, req.params.id as string);
    if (!matter) return;

    const { stage } = req.body ?? {};
    if (!stage || typeof stage !== "string") {
      res
        .status(400)
        .json({ error: "stage is required", allowedStages: PORTAL_STAGES[portal] });
      return;
    }
    if (!isValidStage(portal, stage)) {
      res.status(400).json({ error: "Invalid stage", allowedStages: PORTAL_STAGES[portal] });
      return;
    }

    const matterId = matter.id as number;
    const fromStage = matter.status as string | null;

    const tableName = `${portal}_matters`;
    await pool.query(
      `UPDATE ${tableName} SET status = $1, updated_at = now() WHERE id = $2`,
      [stage, matterId],
    );
    await pool.query(
      `INSERT INTO case_stage_history (portal, matter_id, from_stage, to_stage) VALUES ($1, $2, $3, $4)`,
      [portal, matterId, fromStage, stage],
    );
    void invalidateMatterInsights(portal, matterId);

    res.json({ success: true, status: stage, allowedStages: PORTAL_STAGES[portal] });
  });

  // ── Checklist (sub-router with mergeParams) ──────────────────────────────────
  const checklistRouter = makeChecklistRouter(portal, getOwnerKey);
  router.use(`${P}/:matterId/checklist`, checklistRouter);

  // ── Time recording (sub-router with mergeParams) ─────────────────────────────
  const timeRouter = makeTimeRecordingRouter(portal, getOwnerKey);
  router.use(`${P}/:matterId/time-entries`, timeRouter);

  // ── Chronology / activity stream (sub-router with mergeParams) ───────────────
  const eventsRouter = buildCaseEventsRouter(portal, getOwnerKey);
  router.use(`${P}/:matterId/events`, eventsRouter);

  // ── Linked client records for a matter ───────────────────────────────────────
  router.use(`${P}/:matterId/clients`, makeMatterClientsRouter(portal, getOwnerKey));

  // ── Matter-aware AI review (context assembly + "what next") ──────────────────
  // Owner predicate matching each portal's own owner column (see caseOwnership.ts)
  // so supporting rows are tenant-scoped in addition to the up-front ownership gate.
  const ownerPredicate = (
    ownerKey: string,
    firstParamIndex: number,
  ): { clause: string; params: Array<string | number> } | null => {
    if (portal === "sya") {
      const colon = ownerKey.indexOf(":");
      if (colon < 0) return null;
      const ownerId = parseInt(ownerKey.slice(colon + 1), 10);
      if (Number.isNaN(ownerId)) return null;
      return {
        clause: `owner_type = $${firstParamIndex} AND owner_id = $${firstParamIndex + 1}`,
        params: [ownerKey.slice(0, colon), ownerId],
      };
    }
    const ownerCol =
      portal === "convey" ? "user_id" : portal === "acc" ? "owner_id" : "access_code_id";
    const ownerId = parseInt(ownerKey, 10);
    if (Number.isNaN(ownerId)) return null;
    return { clause: `${ownerCol} = $${firstParamIndex}`, params: [ownerId] };
  };
  const fetchSavedWork = async (
    matterId: number,
    ownerKey: string,
  ): Promise<Array<Omit<SavedWorkItem, "content"> & { content: string }>> => {
    const pred = ownerPredicate(ownerKey, 2);
    if (!pred) return [];
    const { rows } = await pool
      .query(
        `SELECT title, kind, content, created_at FROM ${portal}_saved_work
         WHERE matter_id = $1 AND ${pred.clause} ORDER BY created_at DESC LIMIT 12`,
        [matterId, ...pred.params],
      )
      .catch(() => ({ rows: [] }));
    return rows as Array<Omit<SavedWorkItem, "content"> & { content: string }>;
  };
  const fetchDeadlines = async (matterId: number, ownerKey: string): Promise<DeadlineItem[]> => {
    const pred = ownerPredicate(ownerKey, 2);
    if (!pred) return [];
    const { rows } = await pool
      .query(
        `SELECT title, due_date, status FROM ${portal}_matter_deadlines
         WHERE matter_id = $1 AND ${pred.clause} ORDER BY due_date LIMIT 20`,
        [matterId, ...pred.params],
      )
      .catch(() => ({ rows: [] }));
    return rows.map((d: { title: string; due_date: string; status: string }) => ({
      title: d.title,
      due_date: d.due_date ? new Date(d.due_date).toISOString().slice(0, 10) : "",
      status: d.status ?? "",
    })) as DeadlineItem[];
  };
  const reviewRouter = buildCaseReviewRouter(portal, getOwnerKey, {
    fetchSavedWork,
    fetchDeadlines,
  });
  router.use(P === "" ? "/" : P, reviewRouter);

  // ── Dashboard case briefing (all matters overview) ───────────────────────────
  router.use(P === "" ? "/" : P, buildCaseBriefingRouter(portal, getOwnerKey));

  // ── Time & billing (fee items, invoices, invoice PDFs, settings) ─────────────
  attachBilling({ router, portal, pathPrefix: P, getOwnerKey });

  attachDocumentVault({ router, portal, pathPrefix: P, getOwnerKey });

  attachDraftWorkspace({ router, portal, pathPrefix: P, getOwnerKey });
}

/**
 * Hook called after a matter is created — fires off checklist generation
 * in the background (non-blocking).
 */
export function triggerChecklistGeneration(
  portal: Portal,
  matterId: number,
  ownerKey: string,
  title: string,
  matterType?: string | null,
  charge?: string | null,
): void {
  void generateAndSaveChecklist(portal, matterId, ownerKey, title, matterType, charge).catch(
    (err) => logger.warn({ err }, "Background checklist generation failed"),
  );
}
