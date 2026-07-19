import type { Task, User, TaskNote } from "../db";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_HOUR = 1000 * 60 * 60;

export type SerializedTask = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  reason: string;
  status: string;
  ownerId: number | null;
  ownerName: string | null;
  createdById: number | null;
  createdByName: string | null;
  goalId: number | null;
  goalTitle: string | null;
  priorityScore: number;
  staleFlag: boolean;
  criticalFlag: boolean;
  archived: boolean;
  latestNote: string | null;
  noteCount: number;
  createdAt: string;
  dueAt: string | null;
  acknowledgedAt: string | null;
  lastUpdatedAt: string;
  lastNudgedAt: string | null;
  positionLevel: string | null;
  actionVerb: string | null;
  qualityStandard: string | null;
  natureOfWork: string | null;
  businessUnit: string | null;
  deliverable: string | null;
  collaborators: { userId: number; name: string | null }[];
};

const REASON_WEIGHT: Record<string, number> = {
  compliance: 30,
  partner: 25,
  client: 20,
  finance: 15,
  manager: 15,
  internal: 5,
  other: 0,
};

function daysSince(date: Date | null, now: Date): number {
  if (!date) return 0;
  return (now.getTime() - date.getTime()) / MS_PER_DAY;
}

function deadlineWeight(dueAt: Date | null, now: Date): number {
  if (!dueAt) return 0;
  const diffMs = dueAt.getTime() - now.getTime();
  if (diffMs < 0) return 40; // overdue
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + MS_PER_DAY);
  if (dueAt.getTime() < endOfToday.getTime()) return 30; // due today
  const diffDays = diffMs / MS_PER_DAY;
  if (diffDays <= 3) return 20;
  if (diffDays <= 7) return 10;
  return 0;
}

function inactivityWeight(lastUpdatedAt: Date, now: Date): number {
  const days = daysSince(lastUpdatedAt, now);
  if (days >= 7) return 30;
  if (days >= 5) return 20;
  if (days >= 3) return 10;
  return 0;
}

export function computePriorityScore(task: Task, now: Date): number {
  if (task.status === "done") return 0;
  let score = task.category === "urgent" ? 100 : 40;
  score += REASON_WEIGHT[task.reason] ?? 0;
  score += deadlineWeight(task.dueAt, now);
  score += inactivityWeight(task.lastUpdatedAt, now);
  if (task.status === "blocked") score += 15;
  return score;
}

export function isOverdue(task: Task, now: Date): boolean {
  if (!task.dueAt) return false;
  if (task.status === "done") return false;
  return task.dueAt.getTime() < now.getTime();
}

/**
 * A backlog task becomes stale if:
 *  - no update for 5 days, or
 *  - no owner after 3 days (since creation), or
 *  - due within 7 days but still not started (status todo).
 */
export function computeStaleFlag(task: Task, now: Date): boolean {
  if (task.category !== "backlog") return false;
  if (task.status === "done") return false;
  if (daysSince(task.lastUpdatedAt, now) >= 5) return true;
  if (task.ownerId == null && daysSince(task.createdAt, now) >= 3) return true;
  if (task.dueAt) {
    const diffDays = (task.dueAt.getTime() - now.getTime()) / MS_PER_DAY;
    if (diffDays >= 0 && diffDays <= 7 && task.status === "todo") return true;
  }
  return false;
}

/**
 * An urgent task becomes critical if:
 *  - not acknowledged within 4 working hours of creation, or
 *  - overdue, or
 *  - blocked without a note.
 */
export function computeCriticalFlag(
  task: Task,
  now: Date,
  noteCount: number,
): boolean {
  if (task.category !== "urgent") return false;
  if (task.status === "done") return false;
  if (!task.acknowledgedAt) {
    const hoursSinceCreated =
      (now.getTime() - task.createdAt.getTime()) / MS_PER_HOUR;
    if (hoursSinceCreated > 4) return true;
  }
  if (isOverdue(task, now)) return true;
  if (task.status === "blocked" && noteCount === 0) return true;
  return false;
}

export function isUnacknowledgedUrgent(task: Task, now: Date): boolean {
  if (task.category !== "urgent") return false;
  if (task.status === "done") return false;
  if (task.acknowledgedAt) return false;
  const hoursSinceCreated =
    (now.getTime() - task.createdAt.getTime()) / MS_PER_HOUR;
  return hoursSinceCreated > 4;
}

export function serializeTask(
  task: Task,
  opts: {
    now: Date;
    owner?: User | null;
    creator?: User | null;
    latestNote?: TaskNote | null;
    noteCount?: number;
    goalTitle?: string | null;
    collaborators?: { userId: number; name: string | null }[];
  },
): SerializedTask {
  const noteCount = opts.noteCount ?? 0;
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    category: task.category,
    reason: task.reason,
    status: task.status,
    ownerId: task.ownerId,
    ownerName: opts.owner?.name ?? null,
    createdById: task.createdById,
    createdByName: opts.creator?.name ?? null,
    goalId: task.goalId,
    goalTitle: opts.goalTitle ?? null,
    priorityScore: computePriorityScore(task, opts.now),
    staleFlag: computeStaleFlag(task, opts.now),
    criticalFlag: computeCriticalFlag(task, opts.now, noteCount),
    archived: task.archived,
    latestNote: opts.latestNote?.body ?? null,
    noteCount,
    createdAt: task.createdAt.toISOString(),
    dueAt: task.dueAt ? task.dueAt.toISOString() : null,
    acknowledgedAt: task.acknowledgedAt
      ? task.acknowledgedAt.toISOString()
      : null,
    lastUpdatedAt: task.lastUpdatedAt.toISOString(),
    lastNudgedAt: task.lastNudgedAt ? task.lastNudgedAt.toISOString() : null,
    positionLevel: task.positionLevel,
    actionVerb: task.actionVerb,
    qualityStandard: task.qualityStandard,
    natureOfWork: task.natureOfWork,
    businessUnit: task.businessUnit,
    deliverable: task.deliverable,
    collaborators: opts.collaborators ?? [],
  };
}
