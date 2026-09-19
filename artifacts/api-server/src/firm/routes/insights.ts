import { Router, type IRouter } from "express";
import { firmAiRateLimit } from "../lib/firmAiRateLimit";
import { eq, desc, and, or, lt, gte, isNull, inArray } from "drizzle-orm";
import { db, tasksTable, usersTable, taskActivityTable } from "../db";
import {
  GetDashboardResponse,
  GetDigestResponse,
  GetRecentActivityResponse,
  GenerateAiBriefingBody,
} from "../apiZod";
import { serializeTasks } from "../lib/taskService";
import { generateBriefing, AiProviderError } from "../lib/aiService";
import { requireManagerSession } from "../lib/managerSession";
import { firmScope } from "../lib/workspace";

const router: IRouter = Router();

const MS_PER_MIN = 1000 * 60;

router.get("/dashboard", async (req, res): Promise<void> => {
  // The manager dashboard aggregates team-wide load, velocity, and per-member
  // metrics — sensitive management data that must require a verified manager
  // session, not be readable by any anonymous caller.
  if ((await requireManagerSession(req)) == null) {
    res.status(403).json({ error: "Only managers can view the dashboard." });
    return;
  }
  const now = new Date();
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.archived, false), firmScope(tasksTable)));
  const users = await db.select().from(usersTable).where(firmScope(usersTable));
  const serialized = await serializeTasks(tasks, now);

  const open = serialized.filter((t) => t.status !== "done");

  const totalUrgent = open.filter((t) => t.category === "urgent").length;
  const unacknowledgedUrgent = open.filter(
    (t) => t.category === "urgent" && !t.acknowledgedAt,
  ).length;
  const staleBacklog = open.filter((t) => t.staleFlag).length;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const dueToday = open.filter(
    (t) =>
      t.dueAt &&
      new Date(t.dueAt).getTime() >= startOfToday.getTime() &&
      new Date(t.dueAt).getTime() < endOfToday.getTime(),
  ).length;
  const overdue = open.filter(
    (t) => t.dueAt && new Date(t.dueAt).getTime() < now.getTime(),
  ).length;
  const blockedNoNote = open.filter(
    (t) => t.status === "blocked" && t.noteCount === 0,
  ).length;

  // Average acknowledge time (urgent, acknowledged).
  const ackDurations: number[] = [];
  for (const t of tasks) {
    if (t.category === "urgent" && t.acknowledgedAt) {
      ackDurations.push(
        (t.acknowledgedAt.getTime() - t.createdAt.getTime()) / MS_PER_MIN,
      );
    }
  }
  const avgAcknowledgeMinutes =
    ackDurations.length > 0
      ? Math.round(
          ackDurations.reduce((a, b) => a + b, 0) / ackDurations.length,
        )
      : null;

  // Average completion time (done tasks: created -> lastUpdated).
  const completeDurations: number[] = [];
  for (const t of tasks) {
    if (t.status === "done") {
      completeDurations.push(
        (t.lastUpdatedAt.getTime() - t.createdAt.getTime()) / MS_PER_MIN,
      );
    }
  }
  const avgCompleteMinutes =
    completeDurations.length > 0
      ? Math.round(
          completeDurations.reduce((a, b) => a + b, 0) /
            completeDurations.length,
        )
      : null;

  // Tasks by owner.
  const ownerMap = new Map<
    number | null,
    { ownerId: number | null; ownerName: string; total: number; active: number; urgent: number; overdue: number }
  >();
  const nameById = new Map<number, string>(users.map((u) => [u.id, u.name]));
  for (const t of open) {
    const key = t.ownerId;
    if (!ownerMap.has(key)) {
      ownerMap.set(key, {
        ownerId: key,
        ownerName: key != null ? nameById.get(key) ?? "Unknown" : "Unassigned",
        total: 0,
        active: 0,
        urgent: 0,
        overdue: 0,
      });
    }
    const entry = ownerMap.get(key)!;
    entry.total += 1;
    if (t.status === "in_progress" || t.status === "blocked") entry.active += 1;
    if (t.category === "urgent") entry.urgent += 1;
    if (t.dueAt && new Date(t.dueAt).getTime() < now.getTime()) {
      entry.overdue += 1;
    }
  }
  const tasksByOwner = Array.from(ownerMap.values()).sort(
    (a, b) => b.total - a.total,
  );

  // Tasks by status.
  const statusOrder = ["todo", "acknowledged", "in_progress", "blocked", "done"];
  const statusCounts = new Map<string, number>();
  for (const t of serialized) {
    statusCounts.set(t.status, (statusCounts.get(t.status) ?? 0) + 1);
  }
  const tasksByStatus = statusOrder
    .filter((s) => statusCounts.has(s))
    .map((status) => ({ status, count: statusCounts.get(status) ?? 0 }));

  // Completion trend over last 7 days.
  const completionTrend: { date: string; completed: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(day.getTime() + 24 * 60 * 60 * 1000);
    const completed = tasks.filter(
      (t) =>
        t.status === "done" &&
        t.lastUpdatedAt.getTime() >= day.getTime() &&
        t.lastUpdatedAt.getTime() < dayEnd.getTime(),
    ).length;
    completionTrend.push({
      date: day.toISOString().slice(0, 10),
      completed,
    });
  }

  const payload = {
    totalUrgent,
    unacknowledgedUrgent,
    staleBacklog,
    dueToday,
    overdue,
    blockedNoNote,
    avgAcknowledgeMinutes,
    avgCompleteMinutes,
    tasksByOwner,
    tasksByStatus,
    completionTrend,
  };

  res.json(GetDashboardResponse.parse(payload));
});

router.get("/digest", async (_req, res): Promise<void> => {
  const now = new Date();
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.archived, false), firmScope(tasksTable)));
  const serialized = await serializeTasks(tasks, now);
  const open = serialized.filter((t) => t.status !== "done");

  const newlyStale = open.filter((t) => t.staleFlag);
  const noOwner = open.filter((t) => t.ownerId == null);
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const approachingDue = open.filter((t) => {
    if (!t.dueAt) return false;
    const diff = new Date(t.dueAt).getTime() - now.getTime();
    return diff >= 0 && diff <= sevenDays;
  });
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const inactiveOverWeek = open.filter((t) => {
    const raw = taskById.get(t.id);
    if (!raw) return false;
    return (
      (now.getTime() - raw.lastUpdatedAt.getTime()) / (24 * 60 * 60 * 1000) >= 7
    );
  });

  // Recommended focus: top critical + stale by priority.
  const recommended = [...open]
    .filter((t) => t.criticalFlag || t.staleFlag)
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 5);

  const payload = {
    newlyStale,
    noOwner,
    approachingDue,
    inactiveOverWeek,
    recommended,
  };

  res.json(GetDigestResponse.parse(payload));
});

// Org-wide recent task activity (manager only). Surfaces the per-task audit
// trail as a management radar signal — reassignments, archives, edits across
// the whole team, newest first. Paginated via a keyset (cursor) seek so deep
// paging stays fast regardless of how far back the manager scrolls.
router.get("/activity", async (req, res): Promise<void> => {
  if ((await requireManagerSession(req)) == null) {
    res
      .status(403)
      .json({ error: "Only managers can view recent activity." });
    return;
  }

  // Export mode returns the full filtered range unpaginated (capped at a safe
  // maximum) so managers can download the whole matching activity log, not just
  // the page currently on screen.
  const isExport = req.query.export === "true";
  const EXPORT_MAX = 10000;
  const rawLimit = Number(req.query.limit);
  const limit = isExport
    ? EXPORT_MAX
    : Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, 100)
      : 20;

  // Keyset cursor: the (createdAt, id) of the last item from the previous page.
  // We seek to rows strictly "older" than the cursor using a WHERE comparison
  // that maps directly onto task_activity_created_at_id_idx (created_at DESC,
  // id DESC), so each page is an indexed range read with no growing OFFSET scan.
  // Export mode ignores the cursor and returns the full filtered range.
  const rawCursorId = Number(req.query.cursorId);
  const rawCursorCreatedAt = req.query.cursorCreatedAt;
  let cursorWhere = undefined;
  if (
    !isExport &&
    typeof rawCursorCreatedAt === "string" &&
    rawCursorCreatedAt.length > 0 &&
    Number.isFinite(rawCursorId)
  ) {
    const cursorDate = new Date(rawCursorCreatedAt);
    if (!Number.isNaN(cursorDate.getTime())) {
      cursorWhere = or(
        lt(taskActivityTable.createdAt, cursorDate),
        and(
          eq(taskActivityTable.createdAt, cursorDate),
          lt(taskActivityTable.id, rawCursorId),
        ),
      );
    }
  }

  // Optional filters (applied server-side so pagination stays correct across
  // the whole history): by actor (numeric id or the literal "system" for
  // automated/null-actor entries) and by a set of canonical action keys.
  const actorParam =
    typeof req.query.actor === "string" ? req.query.actor.trim() : "";
  const actionsParam =
    typeof req.query.actions === "string" ? req.query.actions.trim() : "";
  const actionKeys = actionsParam
    ? actionsParam
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean)
    : [];

  const conditions = [firmScope(taskActivityTable)];
  if (actorParam === "system") {
    conditions.push(isNull(taskActivityTable.actorId));
  } else if (actorParam) {
    const actorId = Number(actorParam);
    if (Number.isInteger(actorId)) {
      conditions.push(eq(taskActivityTable.actorId, actorId));
    }
  }
  if (actionKeys.length > 0) {
    conditions.push(inArray(taskActivityTable.action, actionKeys));
  }
  // Optional date-range bounds (inclusive start, exclusive end) so managers can
  // scope the log to a period (today / this week / a custom range). Applied
  // server-side so pagination remains correct across the whole filtered set.
  const parseDate = (raw: unknown): Date | null => {
    if (typeof raw !== "string" || raw.trim() === "") return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const fromDate = parseDate(req.query.from);
  const toDate = parseDate(req.query.to);
  if (fromDate) {
    conditions.push(gte(taskActivityTable.createdAt, fromDate));
  }
  if (toDate) {
    conditions.push(lt(taskActivityTable.createdAt, toDate));
  }

  // Combine the optional filters with the keyset cursor seek so deep paging
  // stays both correct (filtered) and fast (indexed range read).
  if (cursorWhere) {
    conditions.push(cursorWhere);
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

  // Fetch one extra row to determine whether more pages exist.
  const rows = await db
    .select()
    .from(taskActivityTable)
    .where(whereClause)
    .orderBy(desc(taskActivityTable.createdAt), desc(taskActivityTable.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // Resolve actor names and task titles only for the ids on THIS page, instead
  // of scanning the entire users/tasks tables on every (deep) page load.
  const actorIds = Array.from(
    new Set(
      page
        .map((r) => r.actorId)
        .filter((id): id is number => id != null),
    ),
  );
  const taskIds = Array.from(new Set(page.map((r) => r.taskId)));

  const users =
    actorIds.length > 0
      ? await db
          .select({ id: usersTable.id, name: usersTable.name })
          .from(usersTable)
          .where(and(inArray(usersTable.id, actorIds), firmScope(usersTable)))
      : [];
  const userNamesById = new Map<number, string>(
    users.map((u) => [u.id, u.name]),
  );
  const tasks =
    taskIds.length > 0
      ? await db
          .select({ id: tasksTable.id, title: tasksTable.title })
          .from(tasksTable)
          .where(and(inArray(tasksTable.id, taskIds), firmScope(tasksTable)))
      : [];
  const taskTitlesById = new Map<number, string>(
    tasks.map((t) => [t.id, t.title]),
  );

  const items = page.map((r) => ({
    id: r.id,
    taskId: r.taskId,
    taskTitle: taskTitlesById.get(r.taskId) ?? null,
    actorId: r.actorId,
    actorName: r.actorId != null ? userNamesById.get(r.actorId) ?? null : null,
    action: r.action,
    meta: (r.meta as Record<string, unknown> | null) ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  res.json(GetRecentActivityResponse.parse({ items, hasMore }));
});

// AI manager briefing (manager only)
router.post("/ai-briefing", firmAiRateLimit, async (req, res): Promise<void> => {
  const parsed = GenerateAiBriefingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if ((await requireManagerSession(req)) == null) {
    res
      .status(403)
      .json({ error: "Only managers can generate an AI briefing." });
    return;
  }

  try {
    const briefing = await generateBriefing(parsed.data.lang);
    res.json(briefing);
  } catch (err) {
    if (err instanceof AiProviderError) {
      req.log.error({ err }, "AI briefing generation failed");
      res.status(502).json({ error: err.message });
      return;
    }
    throw err;
  }
});

export default router;
