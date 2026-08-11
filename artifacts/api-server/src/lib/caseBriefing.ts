/**
 * Personal dashboard case briefing: one endpoint that summarises ALL of the
 * caller's matters in a portal — stage progress, checklist progress, next
 * deadline, latest activity and a derived "next step" — so every portal's
 * home dashboard can show a live "My Cases" overview.
 *
 * Route (relative to where the router is mounted, i.e. the matters base path):
 *   GET /briefing/summary
 *
 * The path is deliberately two segments so it can never be swallowed by the
 * portal routers' earlier `GET /:id` handlers.
 *
 * SECURITY: everything is scoped by the caller's owner key using the same
 * per-portal owner-column mapping as verifyMatterOwnership. No matter id is
 * accepted from the client at all.
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { PORTAL_STAGES, type Portal } from "./caseStages";
import { logger } from "./logger";

/** Owner predicate matching each portal's own owner column(s). */
export function matterOwnerPredicate(
  portal: Portal,
  ownerKey: string,
  firstParamIndex: number,
): { clause: string; params: Array<string | number> } | null {
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
}

export interface BriefingNextStep {
  source: "deadline" | "checklist" | "stage";
  label: string;
  due_date?: string | null;
}

export interface MatterBriefing {
  id: number;
  title: string;
  status: string | null;
  matter_type: string | null;
  updated_at: string | null;
  stage_index: number; // 0-based position of current stage (-1 if unknown)
  stage_count: number;
  checklist_total: number;
  checklist_done: number;
  next_deadline: { title: string; due_date: string } | null;
  overdue_count: number;
  last_event: { title: string; kind: string; event_date: string } | null;
  next_step: BriefingNextStep;
}

const DEADLINE_OPEN = `COALESCE(status,'') NOT IN ('done','completed','met','closed')`;

export function buildCaseBriefingRouter(
  portal: Portal,
  getOwnerKey: (req: Request, res: Response) => string | null,
): IRouter {
  const router: IRouter = Router({ mergeParams: true });
  const stages = PORTAL_STAGES[portal];

  router.get("/briefing/summary", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const pred = matterOwnerPredicate(portal, ownerKey, 1);
    if (!pred) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const { rows: matters } = await pool.query(
        `SELECT * FROM ${portal}_matters WHERE ${pred.clause}
         ORDER BY (COALESCE(status,'') IN ('Closed','Selesai')) ASC, updated_at DESC NULLS LAST, id DESC
         LIMIT 100`,
        pred.params,
      );
      if (!matters.length) {
        res.json({ matters: [], stageCount: stages.length, stages });
        return;
      }
      const ids = matters.map((m: { id: number }) => m.id);

      // Checklist progress (shared table, owner-scoped).
      const { rows: checkRows } = await pool
        .query(
          `SELECT matter_id, COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE done)::int AS done,
                  (ARRAY_AGG(item_text ORDER BY position, id) FILTER (WHERE NOT done))[1] AS first_open
           FROM case_checklists
           WHERE portal = $1 AND owner_key = $2 AND matter_id = ANY($3)
           GROUP BY matter_id`,
          [portal, ownerKey, ids],
        )
        .catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
      const checkBy = new Map(checkRows.map((r: Record<string, unknown>) => [r.matter_id, r]));

      // Deadlines: next open + overdue count (portal table, owner-scoped).
      const dPred = matterOwnerPredicate(portal, ownerKey, 2)!;
      const { rows: dlRows } = await pool
        .query(
          `SELECT matter_id,
                  MIN(due_date) FILTER (WHERE ${DEADLINE_OPEN} AND due_date >= CURRENT_DATE) AS next_due,
                  COUNT(*) FILTER (WHERE ${DEADLINE_OPEN} AND due_date < CURRENT_DATE)::int AS overdue
           FROM ${portal}_matter_deadlines
           WHERE matter_id = ANY($1) AND ${dPred.clause}
           GROUP BY matter_id`,
          [ids, ...dPred.params],
        )
        .catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
      const dlBy = new Map(dlRows.map((r: Record<string, unknown>) => [r.matter_id, r]));

      // Titles of the next deadlines (small second query keyed by min date).
      const { rows: dlTitleRows } = await pool
        .query(
          `SELECT DISTINCT ON (matter_id) matter_id, title, due_date
           FROM ${portal}_matter_deadlines
           WHERE matter_id = ANY($1) AND ${dPred.clause}
             AND ${DEADLINE_OPEN} AND due_date >= CURRENT_DATE
           ORDER BY matter_id, due_date, id`,
          [ids, ...dPred.params],
        )
        .catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
      const dlTitleBy = new Map(
        dlTitleRows.map((r: Record<string, unknown>) => [r.matter_id, r]),
      );

      // Latest chronology event per matter (shared table, owner-scoped).
      const { rows: evRows } = await pool
        .query(
          `SELECT DISTINCT ON (matter_id) matter_id, title, kind, event_date
           FROM case_events
           WHERE portal = $1 AND owner_key = $2 AND matter_id = ANY($3)
           ORDER BY matter_id, event_date DESC, created_at DESC`,
          [portal, ownerKey, ids],
        )
        .catch(() => ({ rows: [] as Array<Record<string, unknown>> }));
      const evBy = new Map(evRows.map((r: Record<string, unknown>) => [r.matter_id, r]));

      const iso = (v: unknown): string | null =>
        v ? new Date(v as string).toISOString().slice(0, 10) : null;

      const out: MatterBriefing[] = matters.map((m: Record<string, unknown>) => {
        const id = m.id as number;
        const status = (m.status as string | null) ?? null;
        const check = checkBy.get(id) as Record<string, unknown> | undefined;
        const dl = dlBy.get(id) as Record<string, unknown> | undefined;
        const dlTitle = dlTitleBy.get(id) as Record<string, unknown> | undefined;
        const ev = evBy.get(id) as Record<string, unknown> | undefined;

        const nextDeadline = dlTitle
          ? { title: dlTitle.title as string, due_date: iso(dlTitle.due_date) ?? "" }
          : null;
        const firstOpen = (check?.first_open as string | null) ?? null;
        const stageIndex = status ? stages.indexOf(status) : -1;

        let nextStep: BriefingNextStep;
        if (nextDeadline) {
          nextStep = {
            source: "deadline",
            label: nextDeadline.title,
            due_date: nextDeadline.due_date,
          };
        } else if (firstOpen) {
          nextStep = { source: "checklist", label: firstOpen };
        } else if (stageIndex >= 0 && stageIndex < stages.length - 1) {
          nextStep = { source: "stage", label: `Advance towards ${stages[stageIndex + 1]}` };
        } else {
          nextStep = { source: "stage", label: "No outstanding steps recorded" };
        }

        return {
          id,
          title: (m.title as string) ?? "",
          status,
          matter_type: ((m.matter_type ?? m.matterType) as string | null) ?? null,
          updated_at: m.updated_at ? new Date(m.updated_at as string).toISOString() : null,
          stage_index: stageIndex,
          stage_count: stages.length,
          checklist_total: (check?.total as number) ?? 0,
          checklist_done: (check?.done as number) ?? 0,
          next_deadline: nextDeadline,
          overdue_count: (dl?.overdue as number) ?? 0,
          last_event: ev
            ? {
                title: ev.title as string,
                kind: ev.kind as string,
                event_date: iso(ev.event_date) ?? "",
              }
            : null,
          next_step: nextStep,
        };
      });

      res.json({ matters: out, stageCount: stages.length, stages });
    } catch (err) {
      logger.error({ err, portal }, "Case briefing summary failed");
      res.status(500).json({ error: "Failed to load case briefing" });
    }
  });

  return router;
}
