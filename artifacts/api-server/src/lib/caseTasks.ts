/**
 * Shared per-matter task management for all portals.
 *
 * The case_tasks table records action items attached to a matter —
 * with priority, status, assignee, due date, and a short note.
 * Every operation scopes by portal + matter_id + owner_key to prevent
 * cross-tenant reads and writes. POST/PATCH/DELETE additionally verify
 * that the matter row itself belongs to the caller via verifyMatterOwnership.
 *
 * A mirrored case_events row (kind="task", source="task:<id>") is created
 * on task creation and maintained on updates/deletes so the timeline stays
 * in step with task activity.
 *
 * Routes (mounted relative to a matter router with mergeParams):
 *   GET    /:matterId/tasks
 *   POST   /:matterId/tasks
 *   PATCH  /:matterId/tasks/:taskId
 *   DELETE /:matterId/tasks/:taskId
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import type { Portal } from "./caseStages";
import { verifyMatterOwnership } from "./caseOwnership";
import { recordCaseEvent, updateCaseEventBySource, deleteCaseEventBySource } from "./caseEvents";

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export const TASK_STATUSES = ["open", "in_progress", "done", "cancelled"] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

function isValidPriority(v: unknown): v is TaskPriority {
  return typeof v === "string" && (TASK_PRIORITIES as readonly string[]).includes(v);
}

function isValidStatus(v: unknown): v is TaskStatus {
  return typeof v === "string" && (TASK_STATUSES as readonly string[]).includes(v);
}

/** YYYY-MM-DD validator */
function isValidDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function taskEventSource(taskId: number): string {
  return `task:${taskId}`;
}

function taskEventTitle(task: Record<string, unknown>): string {
  const status = task.status as string;
  const statusLabel =
    status === "done"
      ? "completed"
      : status === "in_progress"
        ? "in progress"
        : status === "cancelled"
          ? "cancelled"
          : "created";
  return `Task ${statusLabel}: ${(task.title as string).slice(0, 200)}`;
}

/**
 * Returns a router handling GET/POST/PATCH/DELETE for a matter's tasks.
 * Mounted at /:matterId/tasks with mergeParams: true.
 */
export function makeCaseTasksRouter(
  portal: Portal,
  getOwnerKey: (req: Request, res: Response) => string | null,
): IRouter {
  const router: IRouter = Router({ mergeParams: true });

  // ── GET /:matterId/tasks ────────────────────────────────────────────────────

  router.get("/", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    if (Number.isNaN(matterId) || matterId <= 0) {
      res.status(400).json({ error: "Invalid matter id" });
      return;
    }
    try {
      const { rows } = await pool.query(
        `SELECT id, title, assignee, due_date, priority, status, note, created_at, updated_at
         FROM case_tasks
         WHERE portal = $1 AND matter_id = $2 AND owner_key = $3
         ORDER BY
           CASE WHEN status IN ('done','cancelled') THEN 1 ELSE 0 END,
           CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
           due_date NULLS LAST, id`,
        [portal, matterId, ownerKey],
      );
      res.json(rows);
    } catch (err) {
      logger.error({ err, portal, matterId }, "caseTasks GET failed");
      res.status(500).json({ error: "Failed to load tasks" });
    }
  });

  // ── POST /:matterId/tasks ───────────────────────────────────────────────────

  router.post("/", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    if (Number.isNaN(matterId) || matterId <= 0) {
      res.status(400).json({ error: "Invalid matter id" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { title, assignee, due_date, priority, status, note } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    if (title.trim().length > 500) {
      res.status(400).json({ error: "title must be at most 500 characters" });
      return;
    }
    if (due_date !== undefined && due_date !== null && !isValidDate(due_date)) {
      res.status(400).json({ error: "due_date must be YYYY-MM-DD" });
      return;
    }
    if (priority !== undefined && priority !== null && !isValidPriority(priority)) {
      res.status(400).json({
        error: "Invalid priority",
        allowedPriorities: TASK_PRIORITIES,
      });
      return;
    }
    if (status !== undefined && status !== null && !isValidStatus(status)) {
      res.status(400).json({ error: "Invalid status", allowedStatuses: TASK_STATUSES });
      return;
    }
    if (assignee !== undefined && assignee !== null && typeof assignee !== "string") {
      res.status(400).json({ error: "assignee must be a string" });
      return;
    }
    if (note !== undefined && note !== null && typeof note !== "string") {
      res.status(400).json({ error: "note must be a string" });
      return;
    }

    try {
      // Verify matter ownership before creating the task
      const owned = await verifyMatterOwnership(portal, matterId, ownerKey);
      if (!owned) {
        res.status(404).json({ error: "Matter not found" });
        return;
      }

      const { rows } = await pool.query(
        `INSERT INTO case_tasks (portal, matter_id, owner_key, title, assignee, due_date, priority, status, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          portal,
          matterId,
          ownerKey,
          title.trim().slice(0, 500),
          typeof assignee === "string" ? assignee.slice(0, 200) : null,
          due_date ?? null,
          isValidPriority(priority) ? priority : "medium",
          isValidStatus(status) ? status : "open",
          typeof note === "string" ? note.slice(0, 5000) : null,
        ],
      );
      const task = rows[0] as Record<string, unknown>;

      // Record a case_events entry for this task (best-effort)
      // Note: due_date from PostgreSQL comes back as a Date object or string
      const dueDateStr = task.due_date != null
        ? new Date(task.due_date as string | Date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      void recordCaseEvent(portal, matterId, ownerKey, {
        event_date: dueDateStr,
        title: taskEventTitle(task),
        kind: "task",
        source: taskEventSource(task.id as number),
        description: typeof note === "string" ? note.slice(0, 5000) : null,
      });

      res.status(201).json(task);
    } catch (err) {
      logger.error({ err, portal, matterId }, "caseTasks POST failed");
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  // ── PATCH /:matterId/tasks/:taskId ─────────────────────────────────────────

  router.patch("/:taskId", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    const taskId = parseInt((req.params as Record<string, string>).taskId ?? "0", 10);
    if (Number.isNaN(matterId) || matterId <= 0 || Number.isNaN(taskId) || taskId <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { title, assignee, due_date, priority, status, note } = body;

    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      res.status(400).json({ error: "title must be a non-empty string" });
      return;
    }
    if (title !== undefined && typeof title === "string" && title.trim().length > 500) {
      res.status(400).json({ error: "title must be at most 500 characters" });
      return;
    }
    if (due_date !== undefined && due_date !== null && !isValidDate(due_date)) {
      res.status(400).json({ error: "due_date must be YYYY-MM-DD" });
      return;
    }
    if (priority !== undefined && priority !== null && !isValidPriority(priority)) {
      res.status(400).json({
        error: "Invalid priority",
        allowedPriorities: TASK_PRIORITIES,
      });
      return;
    }
    if (status !== undefined && status !== null && !isValidStatus(status)) {
      res.status(400).json({ error: "Invalid status", allowedStatuses: TASK_STATUSES });
      return;
    }

    // Verify matter ownership before updating
    const owned = await verifyMatterOwnership(portal, matterId, ownerKey);
    if (!owned) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }

    const sets: string[] = [];
    const params: unknown[] = [portal, matterId, ownerKey, taskId];

    if (title !== undefined && typeof title === "string" && title.trim()) {
      params.push(title.trim().slice(0, 500));
      sets.push(`title = $${params.length}`);
    }
    if (assignee !== undefined) {
      params.push(typeof assignee === "string" ? assignee.slice(0, 200) : null);
      sets.push(`assignee = $${params.length}`);
    }
    if (due_date !== undefined) {
      params.push(isValidDate(due_date) ? due_date : null);
      sets.push(`due_date = $${params.length}`);
    }
    if (priority !== undefined && isValidPriority(priority)) {
      params.push(priority);
      sets.push(`priority = $${params.length}`);
    }
    if (status !== undefined && isValidStatus(status)) {
      params.push(status);
      sets.push(`status = $${params.length}`);
    }
    if (note !== undefined) {
      params.push(typeof note === "string" ? note.slice(0, 5000) : null);
      sets.push(`note = $${params.length}`);
    }

    if (sets.length === 0) {
      // Nothing to update — return the existing row
      const { rows: existing } = await pool.query(
        `SELECT * FROM case_tasks WHERE portal = $1 AND matter_id = $2 AND owner_key = $3 AND id = $4`,
        [portal, matterId, ownerKey, taskId],
      );
      if (!existing.length) {
        res.status(404).json({ error: "Task not found" });
        return;
      }
      res.json(existing[0]);
      return;
    }

    const { rows } = await pool.query(
      `UPDATE case_tasks
       SET ${sets.join(", ")}, updated_at = now()
       WHERE portal = $1 AND matter_id = $2 AND owner_key = $3 AND id = $4
       RETURNING *`,
      params,
    );
    if (!rows.length) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const task = rows[0] as Record<string, unknown>;

    // Mirror the update into the linked case_events row
    const patchedDueDateStr = task.due_date != null
      ? new Date(task.due_date as string | Date).toISOString().slice(0, 10)
      : undefined;
    void updateCaseEventBySource(portal, matterId, ownerKey, taskEventSource(taskId), {
      event_date: patchedDueDateStr,
      title: taskEventTitle(task),
      description: typeof task.note === "string" ? task.note : null,
    });

    res.json(task);
  });

  // ── DELETE /:matterId/tasks/:taskId ────────────────────────────────────────

  router.delete("/:taskId", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    const taskId = parseInt((req.params as Record<string, string>).taskId ?? "0", 10);
    if (Number.isNaN(matterId) || matterId <= 0 || Number.isNaN(taskId) || taskId <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    // Verify matter ownership before deleting
    const owned = await verifyMatterOwnership(portal, matterId, ownerKey);
    if (!owned) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }

    const { rows } = await pool.query(
      `DELETE FROM case_tasks
       WHERE portal = $1 AND matter_id = $2 AND owner_key = $3 AND id = $4
       RETURNING id`,
      [portal, matterId, ownerKey, taskId],
    );
    if (!rows.length) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Remove the linked case_events entry (best-effort)
    void deleteCaseEventBySource(portal, matterId, ownerKey, taskEventSource(taskId));

    res.json({ success: true });
  });

  return router;
}

logger.debug("caseTasks router module loaded");
