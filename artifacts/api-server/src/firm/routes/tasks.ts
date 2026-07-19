import { Router, type IRouter } from "express";
import { and, or, eq, inArray, ilike, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  db,
  tasksTable,
  taskNotesTable,
  taskAttemptsTable,
  taskEvidenceTable,
  taskAssessmentsTable,
  taskCollaboratorsTable,
  taskActivityTable,
  usersTable,
} from "../db";
import {
  CreateTaskBody,
  UpdateTaskBody,
  UpdateTaskParams,
  GetTaskParams,
  ArchiveTaskParams,
  ArchiveTaskBody,
  AcknowledgeTaskParams,
  AcknowledgeTaskBody,
  ChangeTaskStatusParams,
  ChangeTaskStatusBody,
  NudgeTaskParams,
  NudgeTaskBody,
  ListTaskNotesParams,
  AddTaskNoteParams,
  AddTaskNoteBody,
  ListTaskNotesResponse,
  ListTaskAttemptsParams,
  AddTaskAttemptParams,
  AddTaskAttemptBody,
  ListTaskAttemptsResponse,
  ListTaskEvidenceParams,
  AddTaskEvidenceParams,
  AddTaskEvidenceBody,
  ListTaskEvidenceResponse,
  DeleteTaskEvidenceParams,
  DeleteTaskEvidenceBody,
  AiTriageTaskBody,
  GetTaskAssessmentParams,
  GetTaskAssessmentResponse,
  UpsertTaskAssessmentParams,
  UpsertTaskAssessmentBody,
  UpsertTaskAssessmentResponse,
  ListTaskCollaboratorsParams,
  AddTaskCollaboratorParams,
  AddTaskCollaboratorBody,
  RemoveTaskCollaboratorParams,
  RemoveTaskCollaboratorBody,
  ListTaskActivityParams,
  ListTaskActivityResponse,
} from "../apiZod";
import { requireManagerSession } from "../lib/managerSession";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { type ObjectAclPolicy, getObjectAclPolicy, setObjectAclPolicy } from "../lib/objectAcl";
import { syncObjectToDrive } from "../lib/googleDrive";
import { generateTriage, AiProviderError } from "../lib/aiService";
import {
  speechToText,
  ensureCompatibleFormat,
} from "@workspace/integrations-openai-ai-server";
import {
  serializeTasks,
  serializeOne,
  loadTask,
  loadUser,
  firstManager,
} from "../lib/taskService";
import { sendNudge, notifyManager } from "../lib/notifications";

const router: IRouter = Router();

const VALID_STATUSES = [
  "todo",
  "acknowledged",
  "in_progress",
  "blocked",
  "done",
];

// Allowed forward/sideways transitions. Moving to the same status is a no-op
// and always permitted. A completed task must be reopened (to todo or
// in_progress) before it can be blocked or acknowledged again.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  todo: ["acknowledged", "in_progress", "blocked", "done"],
  acknowledged: ["todo", "in_progress", "blocked", "done"],
  in_progress: ["todo", "acknowledged", "blocked", "done"],
  blocked: ["todo", "acknowledged", "in_progress", "done"],
  done: ["todo", "in_progress"],
};

function parseId(raw: string | string[]): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(value, 10);
}

// Append a task-level audit entry. `actorId` is attribution-only (the global
// session gate is the real boundary); `meta` snapshots before/after context so
// the client can render a bilingual message. Best-effort: a logging failure
// must never break the primary mutation, so callers should not await-throw it.
async function logActivity(
  taskId: number,
  actorId: number | null | undefined,
  action: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  await db.insert(taskActivityTable).values({
    taskId,
    actorId: actorId ?? null,
    action,
    meta: meta ?? null,
  });
}

// List tasks with filters
router.get("/tasks", async (req, res): Promise<void> => {
  const params = req.query;
  const conditions: SQL[] = [];

  if (typeof params.category === "string") {
    conditions.push(eq(tasksTable.category, params.category));
  }
  if (typeof params.status === "string") {
    conditions.push(eq(tasksTable.status, params.status));
  }
  if (typeof params.reason === "string") {
    conditions.push(eq(tasksTable.reason, params.reason));
  }
  if (typeof params.ownerId === "string" && params.ownerId !== "") {
    const ownerId = parseInt(params.ownerId, 10);
    if (!Number.isNaN(ownerId)) {
      conditions.push(eq(tasksTable.ownerId, ownerId));
    }
  }
  // memberId matches tasks where the user is the owner OR a collaborator.
  if (typeof params.memberId === "string" && params.memberId !== "") {
    const memberId = parseInt(params.memberId, 10);
    if (!Number.isNaN(memberId)) {
      const collabTaskIds = await db
        .select({ taskId: taskCollaboratorsTable.taskId })
        .from(taskCollaboratorsTable)
        .where(eq(taskCollaboratorsTable.userId, memberId));
      const ids = collabTaskIds.map((r) => r.taskId);
      const memberCond =
        ids.length > 0
          ? or(eq(tasksTable.ownerId, memberId), inArray(tasksTable.id, ids))
          : eq(tasksTable.ownerId, memberId);
      conditions.push(memberCond as SQL);
    }
  }
  if (typeof params.search === "string" && params.search.trim() !== "") {
    conditions.push(ilike(tasksTable.title, `%${params.search.trim()}%`));
  }
  const includeArchived = params.includeArchived === "true";
  if (!includeArchived) {
    conditions.push(eq(tasksTable.archived, false));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(where)
    .orderBy(desc(tasksTable.createdAt));

  const now = new Date();
  const serialized = await serializeTasks(tasks, now);
  serialized.sort((a, b) => b.priorityScore - a.priorityScore);
  res.json(serialized);
});

// Create task
router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [task] = await db
    .insert(tasksTable)
    .values({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      category: parsed.data.category,
      reason: parsed.data.reason,
      status: "todo",
      ownerId: parsed.data.ownerId ?? null,
      createdById: parsed.data.createdById ?? null,
      goalId: parsed.data.goalId ?? null,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      positionLevel: parsed.data.positionLevel ?? null,
      actionVerb: parsed.data.actionVerb ?? null,
      qualityStandard: parsed.data.qualityStandard ?? null,
      natureOfWork: parsed.data.natureOfWork ?? null,
      businessUnit: parsed.data.businessUnit ?? null,
      deliverable: parsed.data.deliverable ?? null,
    })
    .returning();

  // Persist any collaborators chosen at draft time. We skip the owner (already
  // attributed via ownerId) and de-duplicate; conflicts are ignored so a
  // repeated id can't error. Validity is bounded to existing users.
  const collaboratorIds = parsed.data.collaboratorIds ?? [];
  if (collaboratorIds.length > 0) {
    const users = await db.select().from(usersTable);
    const validIds = new Set(users.map((u) => u.id));
    const toAdd = [...new Set(collaboratorIds)].filter(
      (uid) => validIds.has(uid) && uid !== task.ownerId,
    );
    if (toAdd.length > 0) {
      await db
        .insert(taskCollaboratorsTable)
        .values(
          toAdd.map((uid) => ({
            taskId: task.id,
            userId: uid,
            addedById: parsed.data.createdById ?? null,
          })),
        )
        .onConflictDoNothing({
          target: [
            taskCollaboratorsTable.taskId,
            taskCollaboratorsTable.userId,
          ],
        });
    }
  }

  res.status(201).json(await serializeOne(task, new Date()));
});

// AI smart triage: suggest category, reason, and best owner for a new task
router.post("/tasks/ai-triage", async (req, res): Promise<void> => {
  const parsed = AiTriageTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const suggestion = await generateTriage({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      lang: parsed.data.lang,
    });
    res.json(suggestion);
  } catch (err) {
    if (err instanceof AiProviderError) {
      req.log.error({ err }, "AI triage failed");
      res.status(502).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// Get one task
router.get("/tasks/:id", async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const task = await loadTask(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(await serializeOne(task, new Date()));
});

// Update task (manager edits, reassign, reason, category, due date, status)
router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Editing, reclassifying and reassigning a task is open to any signed-in
  // staff member (the app.ts global gate already requires a valid staff or
  // manager session for every /api request). This is a deliberate "open team"
  // model: the whole org collaboratively grooms the task list. Manager-only
  // boundaries remain on assessments, role changes, goals/KPIs, recommendations
  // and the dashboard.
  const existing = await loadTask(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.title !== undefined) updates.title = d.title;
  if (d.description !== undefined) updates.description = d.description;
  if (d.category !== undefined) updates.category = d.category;
  if (d.reason !== undefined) updates.reason = d.reason;
  if (d.status !== undefined) {
    updates.status = d.status;
    // Keep completedAt consistent with status, mirroring the status route.
    if (d.status === "done") {
      updates.completedAt = existing.completedAt ?? new Date();
    } else if (existing.status === "done") {
      updates.completedAt = null;
    }
  }
  if (d.ownerId !== undefined) updates.ownerId = d.ownerId;
  if (d.goalId !== undefined) updates.goalId = d.goalId;
  if (d.dueAt !== undefined) {
    updates.dueAt = d.dueAt ? new Date(d.dueAt) : null;
  }
  if (d.positionLevel !== undefined) updates.positionLevel = d.positionLevel;
  if (d.actionVerb !== undefined) updates.actionVerb = d.actionVerb;
  if (d.qualityStandard !== undefined)
    updates.qualityStandard = d.qualityStandard;
  if (d.natureOfWork !== undefined) updates.natureOfWork = d.natureOfWork;
  if (d.businessUnit !== undefined) updates.businessUnit = d.businessUnit;
  if (d.deliverable !== undefined) updates.deliverable = d.deliverable;

  if (Object.keys(updates).length === 0) {
    res.json(await serializeOne(existing, new Date()));
    return;
  }

  const [task] = await db
    .update(tasksTable)
    .set(updates)
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  // Record an audit trail of what changed, for accountability under the
  // open-team model. Names/titles are snapshotted at action time; enum keys are
  // stored canonically so the client renders them bilingually.
  const actorId = d.actingUserId ?? null;
  if (d.ownerId !== undefined && existing.ownerId !== task.ownerId) {
    const [fromUser, toUser] = await Promise.all([
      existing.ownerId ? loadUser(existing.ownerId) : Promise.resolve(null),
      task.ownerId ? loadUser(task.ownerId) : Promise.resolve(null),
    ]);
    await logActivity(task.id, actorId, "reassigned", {
      from: fromUser?.name ?? null,
      to: toUser?.name ?? null,
    });
  }
  if (d.status !== undefined && existing.status !== task.status) {
    await logActivity(task.id, actorId, "status_changed", {
      from: existing.status,
      to: task.status,
    });
  }
  if (d.category !== undefined && existing.category !== task.category) {
    await logActivity(task.id, actorId, "classification_changed", {
      from: existing.category,
      to: task.category,
    });
  }
  if (d.reason !== undefined && existing.reason !== task.reason) {
    await logActivity(task.id, actorId, "reason_changed", {
      from: existing.reason,
      to: task.reason,
    });
  }
  if (d.goalId !== undefined && existing.goalId !== task.goalId) {
    await logActivity(task.id, actorId, "goal_changed", {
      from: existing.goalId,
      to: task.goalId,
    });
  }
  if (d.dueAt !== undefined) {
    const before = existing.dueAt ? existing.dueAt.getTime() : null;
    const after = task.dueAt ? task.dueAt.getTime() : null;
    if (before !== after) {
      await logActivity(task.id, actorId, "due_changed", {
        to: task.dueAt ? task.dueAt.toISOString() : null,
      });
    }
  }
  const editedFields: string[] = [];
  const detailFields: [keyof typeof existing, string][] = [
    ["title", "title"],
    ["description", "description"],
    ["positionLevel", "positionLevel"],
    ["actionVerb", "actionVerb"],
    ["qualityStandard", "qualityStandard"],
    ["natureOfWork", "natureOfWork"],
    ["businessUnit", "businessUnit"],
    ["deliverable", "deliverable"],
  ];
  for (const [key, label] of detailFields) {
    if (
      (d as Record<string, unknown>)[key as string] !== undefined &&
      existing[key] !== task[key as keyof typeof task]
    ) {
      editedFields.push(label);
    }
  }
  if (editedFields.length > 0) {
    await logActivity(task.id, actorId, "edited", { fields: editedFields });
  }

  res.json(await serializeOne(task, new Date()));
});

// Archive (soft-delete) a task. Open to any signed-in staff member under the
// open-team model; the global session gate (app.ts) still applies.
router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const params = ArchiveTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = ArchiveTaskBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const existing = await loadTask(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const [task] = await db
    .update(tasksTable)
    .set({ archived: true })
    .where(eq(tasksTable.id, params.data.id))
    .returning();
  await logActivity(task.id, body.data.actingUserId ?? null, "archived");
  res.json(await serializeOne(task, new Date()));
});

// Acknowledge an urgent task
router.post("/tasks/:id/acknowledge", async (req, res): Promise<void> => {
  const params = AcknowledgeTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AcknowledgeTaskBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await loadTask(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const now = new Date();
  const newStatus = existing.status === "todo" ? "acknowledged" : existing.status;
  const [task] = await db
    .update(tasksTable)
    .set({
      acknowledgedAt: existing.acknowledgedAt ?? now,
      status: newStatus,
    })
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  const actorId = parsed.data.actingUserId ?? null;
  if (actorId != null) {
    await db.insert(taskNotesTable).values({
      taskId: task.id,
      authorId: actorId,
      body: "Acknowledged this task.",
    });
  }

  // Only record an audit entry the first time the task is acknowledged; a
  // repeat acknowledge of an already-acknowledged task changes nothing.
  if (existing.acknowledgedAt == null) {
    await logActivity(task.id, actorId, "acknowledged");
  }

  res.json(await serializeOne(task, now));
});

// Change task status (start / block / unblock / done)
router.post("/tasks/:id/status", async (req, res): Promise<void> => {
  const params = ChangeTaskStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ChangeTaskStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!VALID_STATUSES.includes(parsed.data.status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const existing = await loadTask(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const targetStatus = parsed.data.status;

  // Reject illegal status transitions (same-status is an allowed no-op).
  if (
    targetStatus !== existing.status &&
    !(ALLOWED_TRANSITIONS[existing.status] ?? []).includes(targetStatus)
  ) {
    res.status(400).json({
      error: `Invalid transition from "${existing.status}" to "${targetStatus}".`,
    });
    return;
  }

  // A task must have a clear owner before it can move into active work.
  const activeStatuses = ["in_progress", "blocked"];
  if (
    activeStatuses.includes(targetStatus) &&
    existing.ownerId == null
  ) {
    res
      .status(400)
      .json({ error: "A task must have an owner before active work begins." });
    return;
  }

  const now = new Date();
  const patch: Record<string, unknown> = { status: targetStatus };
  // Acknowledging happens implicitly when an urgent task starts moving.
  if (
    existing.category === "urgent" &&
    !existing.acknowledgedAt &&
    targetStatus !== "todo"
  ) {
    patch.acknowledgedAt = now;
  }
  // Stamp completion time when a task is finished; clear it if it reopens.
  if (targetStatus === "done") {
    patch.completedAt = existing.completedAt ?? now;
  } else if (existing.status === "done") {
    patch.completedAt = null;
  }

  const [task] = await db
    .update(tasksTable)
    .set(patch)
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  const actorId = parsed.data.actingUserId ?? null;
  if (parsed.data.note && parsed.data.note.trim() !== "") {
    await db.insert(taskNotesTable).values({
      taskId: task.id,
      authorId: actorId,
      body: parsed.data.note.trim(),
    });
  }

  // Mirror the PATCH route's audit logging so a status change is captured
  // regardless of which endpoint made it — only when it actually changed.
  if (existing.status !== task.status) {
    await logActivity(task.id, actorId, "status_changed", {
      from: existing.status,
      to: task.status,
    });
  }

  if (targetStatus === "blocked") {
    const hasNote = Boolean(parsed.data.note && parsed.data.note.trim() !== "");
    if (!hasNote) {
      notifyManager(req.log, task, "blocked without a note");
    }
  }

  res.json(await serializeOne(task, now));
});

// Read the manager quality/creativity assessment for a task (null if unrated).
router.get("/tasks/:id/assessment", async (req, res): Promise<void> => {
  const params = GetTaskAssessmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const task = await loadTask(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(taskAssessmentsTable)
    .where(eq(taskAssessmentsTable.taskId, params.data.id));
  if (!row) {
    res.json(GetTaskAssessmentResponse.parse(null));
    return;
  }
  const rater = row.raterId ? await loadUser(row.raterId) : null;
  res.json(
    GetTaskAssessmentResponse.parse({
      ...row,
      raterName: rater?.name ?? null,
    }),
  );
});

// Create or update a manager assessment (manager only, completed tasks only).
router.put("/tasks/:id/assessment", async (req, res): Promise<void> => {
  const params = UpsertTaskAssessmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpsertTaskAssessmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const raterId = await requireManagerSession(req);
  if (raterId == null) {
    res
      .status(403)
      .json({ error: "Only managers can assess task quality and creativity." });
    return;
  }
  const task = await loadTask(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (task.status !== "done") {
    res
      .status(400)
      .json({ error: "Only completed tasks can be assessed." });
    return;
  }

  const now = new Date();
  const [row] = await db
    .insert(taskAssessmentsTable)
    .values({
      taskId: params.data.id,
      raterId,
      qualityScore: parsed.data.qualityScore,
      creativityScore: parsed.data.creativityScore,
      note: parsed.data.note ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: taskAssessmentsTable.taskId,
      set: {
        raterId,
        qualityScore: parsed.data.qualityScore,
        creativityScore: parsed.data.creativityScore,
        note: parsed.data.note ?? null,
        updatedAt: now,
      },
    })
    .returning();

  const rater = row.raterId ? await loadUser(row.raterId) : null;
  res.json(
    UpsertTaskAssessmentResponse.parse({
      ...row,
      raterName: rater?.name ?? null,
    }),
  );
});

// Load a task's collaborators as {userId, name}, resolving names from users.
async function loadCollaborators(
  taskId: number,
): Promise<{ userId: number; name: string | null }[]> {
  const rows = await db
    .select()
    .from(taskCollaboratorsTable)
    .where(eq(taskCollaboratorsTable.taskId, taskId))
    .orderBy(taskCollaboratorsTable.createdAt);
  if (rows.length === 0) return [];
  const users = await db.select().from(usersTable);
  const namesById = new Map<number, string>(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    userId: r.userId,
    name: namesById.get(r.userId) ?? null,
  }));
}

// List a task's collaborators
router.get("/tasks/:id/collaborators", async (req, res): Promise<void> => {
  const params = ListTaskCollaboratorsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const task = await loadTask(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(await loadCollaborators(params.data.id));
});

// Add a collaborator to a task (open to any signed-in staff member)
router.post("/tasks/:id/collaborators", async (req, res): Promise<void> => {
  const params = AddTaskCollaboratorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddTaskCollaboratorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const task = await loadTask(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  const member = await loadUser(parsed.data.userId);
  if (!member) {
    res.status(400).json({ error: "That user does not exist." });
    return;
  }
  const inserted = await db
    .insert(taskCollaboratorsTable)
    .values({
      taskId: params.data.id,
      userId: parsed.data.userId,
      addedById: parsed.data.actingUserId ?? null,
    })
    .onConflictDoNothing({
      target: [taskCollaboratorsTable.taskId, taskCollaboratorsTable.userId],
    })
    .returning();
  // Only log when a row was actually added (a duplicate is a no-op).
  if (inserted.length > 0) {
    await logActivity(params.data.id, parsed.data.actingUserId ?? null, "collaborator_added", {
      target: member.name,
    });
  }
  res.json(await loadCollaborators(params.data.id));
});

// Remove a collaborator from a task (open to any signed-in staff member)
router.delete(
  "/tasks/:id/collaborators/:userId",
  async (req, res): Promise<void> => {
    const params = RemoveTaskCollaboratorParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = RemoveTaskCollaboratorBody.safeParse(req.body ?? {});
    const actorId = body.success ? (body.data.actingUserId ?? null) : null;
    const task = await loadTask(params.data.id);
    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const removed = await db
      .delete(taskCollaboratorsTable)
      .where(
        and(
          eq(taskCollaboratorsTable.taskId, params.data.id),
          eq(taskCollaboratorsTable.userId, params.data.userId),
        ),
      )
      .returning();
    // Only log when a collaborator was actually removed.
    if (removed.length > 0) {
      const member = await loadUser(params.data.userId);
      await logActivity(params.data.id, actorId, "collaborator_removed", {
        target: member?.name ?? null,
      });
    }
    res.json(await loadCollaborators(params.data.id));
  },
);

// List the audit trail (edits, reassignments, archive, collaborator changes)
// for a task, newest first. Open read surface, consistent with notes/attempts.
router.get("/tasks/:id/activity", async (req, res): Promise<void> => {
  const params = ListTaskActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(taskActivityTable)
    .where(eq(taskActivityTable.taskId, params.data.id))
    .orderBy(desc(taskActivityTable.createdAt));

  const users = await db.select().from(usersTable);
  const namesById = new Map<number, string>(users.map((u) => [u.id, u.name]));

  const result = rows.map((r) => ({
    id: r.id,
    taskId: r.taskId,
    actorId: r.actorId,
    actorName: r.actorId != null ? namesById.get(r.actorId) ?? null : null,
    action: r.action,
    meta: (r.meta as Record<string, unknown> | null) ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  res.json(ListTaskActivityResponse.parse(result));
});

// Nudge the owner
router.post("/tasks/:id/nudge", async (req, res): Promise<void> => {
  const params = NudgeTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = NudgeTaskBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await loadTask(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const now = new Date();
  const owner = await loadUser(existing.ownerId);
  const manager = await firstManager();
  sendNudge(req.log, existing, owner, manager);

  const [task] = await db
    .update(tasksTable)
    .set({ lastNudgedAt: now })
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  await logActivity(task.id, parsed.data.actingUserId ?? null, "nudged", {
    target: owner?.name ?? null,
  });

  res.json(await serializeOne(task, now));
});

// List notes for a task
router.get("/tasks/:id/notes", async (req, res): Promise<void> => {
  const params = ListTaskNotesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const notes = await db
    .select()
    .from(taskNotesTable)
    .where(eq(taskNotesTable.taskId, params.data.id))
    .orderBy(desc(taskNotesTable.createdAt));

  const users = await db.select().from(usersTable);
  const usersById = new Map<number, string>(users.map((u) => [u.id, u.name]));

  const result = notes.map((note) => ({
    id: note.id,
    taskId: note.taskId,
    authorId: note.authorId,
    authorName: note.authorId != null ? usersById.get(note.authorId) ?? null : null,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
  }));

  res.json(ListTaskNotesResponse.parse(result));
});

// Add a note to a task
router.post("/tasks/:id/notes", async (req, res): Promise<void> => {
  const params = AddTaskNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddTaskNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await loadTask(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const [note] = await db
    .insert(taskNotesTable)
    .values({
      taskId: params.data.id,
      authorId: parsed.data.authorId ?? null,
      body: parsed.data.body,
    })
    .returning();

  // Touch the task so lastUpdatedAt reflects the activity.
  await db
    .update(tasksTable)
    .set({ lastUpdatedAt: new Date() })
    .where(eq(tasksTable.id, params.data.id));

  await logActivity(params.data.id, note.authorId, "note_added");

  const author = await loadUser(note.authorId);
  res.status(201).json({
    id: note.id,
    taskId: note.taskId,
    authorId: note.authorId,
    authorName: author?.name ?? null,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
  });
});

// List completion attempts for a task
router.get("/tasks/:id/attempts", async (req, res): Promise<void> => {
  const params = ListTaskAttemptsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const attempts = await db
    .select()
    .from(taskAttemptsTable)
    .where(eq(taskAttemptsTable.taskId, params.data.id))
    .orderBy(desc(taskAttemptsTable.createdAt));

  const users = await db.select().from(usersTable);
  const usersById = new Map<number, string>(users.map((u) => [u.id, u.name]));

  const result = attempts.map((a) => ({
    id: a.id,
    taskId: a.taskId,
    authorId: a.authorId,
    authorName: a.authorId != null ? usersById.get(a.authorId) ?? null : null,
    body: a.body,
    source: a.source,
    createdAt: a.createdAt.toISOString(),
  }));

  res.json(ListTaskAttemptsResponse.parse(result));
});

// Log a completion attempt (typed text or a voice recording)
router.post("/tasks/:id/attempts", async (req, res): Promise<void> => {
  const params = AddTaskAttemptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddTaskAttemptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await loadTask(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  let body = parsed.data.body?.trim() ?? "";
  let source: "text" | "voice" = "text";

  try {
    if (parsed.data.audioBase64) {
      const audio = Buffer.from(parsed.data.audioBase64, "base64");
      if (audio.length === 0) {
        res.status(400).json({ error: "The recording was empty." });
        return;
      }
      let buffer: Buffer;
      let format: "wav" | "mp3";
      try {
        ({ buffer, format } = await ensureCompatibleFormat(audio));
      } catch (convErr) {
        req.log.error({ err: convErr }, "Audio format conversion failed");
        throw new AiProviderError(
          "The recording could not be processed. Please try recording again.",
        );
      }
      const transcript = await speechToText(buffer, format);
      if (!transcript || transcript.trim() === "") {
        throw new AiProviderError("No speech was detected in the recording.");
      }
      body = transcript.trim();
      source = "voice";
    }
  } catch (err) {
    if (err instanceof AiProviderError) {
      req.log.error({ err }, "Attempt transcription failed");
      res.status(502).json({ error: err.message });
      return;
    }
    throw err;
  }

  if (!body) {
    res.status(400).json({ error: "An attempt needs typed text or a recording." });
    return;
  }

  const [attempt] = await db
    .insert(taskAttemptsTable)
    .values({
      taskId: params.data.id,
      authorId: parsed.data.authorId ?? null,
      body,
      source,
    })
    .returning();

  await db
    .update(tasksTable)
    .set({ lastUpdatedAt: new Date() })
    .where(eq(tasksTable.id, params.data.id));

  await logActivity(params.data.id, attempt.authorId, "attempt_added", {
    source: attempt.source,
  });

  const author = await loadUser(attempt.authorId);
  res.status(201).json({
    id: attempt.id,
    taskId: attempt.taskId,
    authorId: attempt.authorId,
    authorName: author?.name ?? null,
    body: attempt.body,
    source: attempt.source,
    createdAt: attempt.createdAt.toISOString(),
  });
});

// List evidence files for a task
router.get("/tasks/:id/evidence", async (req, res): Promise<void> => {
  const params = ListTaskEvidenceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Past the global staff/manager session gate (app.ts), any signed-in user may
  // view a task's evidence list — evidence is shared team-wide. We no longer
  // require a separate per-user storage session or an owner/manager check.
  const task = await loadTask(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const evidence = await db
    .select()
    .from(taskEvidenceTable)
    .where(eq(taskEvidenceTable.taskId, params.data.id))
    .orderBy(desc(taskEvidenceTable.createdAt));

  const users = await db.select().from(usersTable);
  const usersById = new Map<number, string>(users.map((u) => [u.id, u.name]));

  const result = evidence.map((e) => ({
    id: e.id,
    taskId: e.taskId,
    authorId: e.authorId,
    authorName: e.authorId != null ? usersById.get(e.authorId) ?? null : null,
    objectPath: e.objectPath,
    fileName: e.fileName,
    contentType: e.contentType,
    fileSize: e.fileSize,
    createdAt: e.createdAt.toISOString(),
  }));

  res.json(ListTaskEvidenceResponse.parse(result));
});

// Attach an uploaded evidence file to a task
router.post("/tasks/:id/evidence", async (req, res): Promise<void> => {
  const params = AddTaskEvidenceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddTaskEvidenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await loadTask(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  // Post-upload size validation: verify the GCS object exists and that its
  // actual byte count does not exceed the permitted limit. This closes the gap
  // where the signed PUT URL has no content-length restriction — a malicious
  // client could declare a small size, mint a signed URL, then upload an
  // arbitrarily large file. We enforce the limit here and delete the oversize
  // object before it is ever committed as a task evidence record.
  const MAX_EVIDENCE_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
  const objectSvc = new ObjectStorageService();
  let evidenceObjectFile;
  try {
    evidenceObjectFile = await objectSvc.getObjectEntityFile(parsed.data.objectPath);
    const [meta] = await evidenceObjectFile.getMetadata();
    const actualBytes = meta.size ? Number(meta.size) : null;
    if (actualBytes !== null && actualBytes > MAX_EVIDENCE_FILE_BYTES) {
      evidenceObjectFile.delete({ ignoreNotFound: true }).catch(() => {});
      res.status(413).json({ error: "Uploaded file exceeds the 50 MB size limit and has been removed." });
      return;
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(400).json({ error: "Uploaded file not found in storage. The upload may have failed." });
      return;
    }
    req.log.warn({ err }, "Could not verify uploaded file size; proceeding with attachment");
  }

  const [evidence] = await db
    .insert(taskEvidenceTable)
    .values({
      taskId: params.data.id,
      authorId: parsed.data.authorId ?? null,
      objectPath: parsed.data.objectPath,
      fileName: parsed.data.fileName,
      contentType: parsed.data.contentType ?? null,
      fileSize: parsed.data.fileSize ?? null,
    })
    .returning();

  await db
    .update(tasksTable)
    .set({ lastUpdatedAt: new Date() })
    .where(eq(tasksTable.id, params.data.id));

  await logActivity(params.data.id, evidence.authorId, "evidence_added", {
    target: evidence.fileName,
  });

  syncObjectToDrive(
    evidence.objectPath,
    evidence.fileName,
    evidence.contentType ?? "application/octet-stream",
    { source: "evidence", taskId: evidence.taskId, evidenceId: evidence.id },
  );

  // Bind ownership ACL on the backing object so the private-object serving
  // route can enforce canAccessObjectEntity(). Only set if no ACL exists yet —
  // prevents an attacker from reassigning ownership of an already-protected
  // object by crafting a second evidence record with the same objectPath.
  // Fire-and-forget; never blocks or fails the primary request.
  if (evidence.authorId != null) {
    const aclPolicy: ObjectAclPolicy = {
      owner: String(evidence.authorId),
      visibility: "private",
    };
    (async () => {
      try {
        const f = evidenceObjectFile ?? await objectSvc.getObjectEntityFile(evidence.objectPath);
        const existingAcl = await getObjectAclPolicy(f);
        if (!existingAcl) {
          await setObjectAclPolicy(f, aclPolicy);
        }
      } catch (err) {
        req.log.warn({ err, objectPath: evidence.objectPath }, "Failed to set ACL on evidence object");
      }
    })();
  }

  const author = await loadUser(evidence.authorId);
  res.status(201).json({
    id: evidence.id,
    taskId: evidence.taskId,
    authorId: evidence.authorId,
    authorName: author?.name ?? null,
    objectPath: evidence.objectPath,
    fileName: evidence.fileName,
    contentType: evidence.contentType,
    fileSize: evidence.fileSize,
    createdAt: evidence.createdAt.toISOString(),
  });
});

// Remove an evidence file from a task
router.delete("/tasks/:id/evidence/:evidenceId", async (req, res): Promise<void> => {
  const params = DeleteTaskEvidenceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = DeleteTaskEvidenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const task = await loadTask(params.data.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  // Removing evidence is manager-only. Ownership cannot be verified in the
  // no-auth model (a caller-supplied actingUserId is spoofable), so the only
  // trustworthy authorization is a verified manager session.
  const removerId = await requireManagerSession(req);
  if (removerId == null) {
    res.status(403).json({ error: "Only managers can remove evidence." });
    return;
  }

  const [deleted] = await db
    .delete(taskEvidenceTable)
    .where(
      and(
        eq(taskEvidenceTable.id, params.data.evidenceId),
        eq(taskEvidenceTable.taskId, params.data.id),
      ),
    )
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Evidence not found" });
    return;
  }

  await logActivity(params.data.id, removerId, "evidence_deleted", {
    target: deleted.fileName,
  });

  // Remove the backing object so we don't leak storage or leave it fetchable.
  try {
    await new ObjectStorageService().deleteObjectEntity(deleted.objectPath);
  } catch (err) {
    req.log.error({ err, objectPath: deleted.objectPath }, "Failed to delete evidence object from storage");
  }

  res.status(204).end();
});

export default router;
