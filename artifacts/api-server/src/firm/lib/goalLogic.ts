import type { Goal, Kpi, User } from "../db";
import type { SerializedTask } from "./taskLogic";

export type SerializedKpi = {
  id: number;
  goalId: number;
  name: string;
  unit: string | null;
  targetValue: number;
  currentValue: number;
  direction: string;
  attainmentPct: number;
  createdAt: string;
  lastUpdatedAt: string;
};

export type GoalDeliverableStats = {
  total: number;
  done: number;
  blocked: number;
  overdue: number;
  urgent: number;
  progressPct: number;
};

export type SerializedGoal = {
  id: number;
  title: string;
  description: string | null;
  ownerId: number | null;
  ownerName: string | null;
  timeframe: string | null;
  status: string;
  health: string;
  archived: boolean;
  kpis: SerializedKpi[];
  deliverableStats: GoalDeliverableStats;
  deliverables: SerializedTask[];
  createdAt: string;
  lastUpdatedAt: string;
};

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeAttainmentPct(kpi: Kpi): number {
  const { currentValue, targetValue, direction } = kpi;
  if (direction === "down") {
    // Lower is better; the target is a ceiling.
    if (currentValue <= 0) return 100;
    if (currentValue <= targetValue) return 100;
    if (targetValue <= 0) return 0;
    return clampPct((targetValue / currentValue) * 100);
  }
  // Higher is better.
  if (targetValue <= 0) return currentValue > 0 ? 100 : 0;
  return clampPct((currentValue / targetValue) * 100);
}

export function serializeKpi(kpi: Kpi): SerializedKpi {
  return {
    id: kpi.id,
    goalId: kpi.goalId,
    name: kpi.name,
    unit: kpi.unit,
    targetValue: kpi.targetValue,
    currentValue: kpi.currentValue,
    direction: kpi.direction,
    attainmentPct: computeAttainmentPct(kpi),
    createdAt: kpi.createdAt.toISOString(),
    lastUpdatedAt: kpi.lastUpdatedAt.toISOString(),
  };
}

function computeDeliverableStats(
  deliverables: SerializedTask[],
  now: Date,
): GoalDeliverableStats {
  const total = deliverables.length;
  let done = 0;
  let blocked = 0;
  let overdue = 0;
  let urgent = 0;
  for (const t of deliverables) {
    if (t.status === "done") done += 1;
    if (t.status === "blocked") blocked += 1;
    if (t.category === "urgent") urgent += 1;
    if (
      t.dueAt &&
      t.status !== "done" &&
      new Date(t.dueAt).getTime() < now.getTime()
    ) {
      overdue += 1;
    }
  }
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, blocked, overdue, urgent, progressPct };
}

function computeHealth(
  status: string,
  stats: GoalDeliverableStats,
  kpis: SerializedKpi[],
): string {
  if (status === "achieved") return "achieved";
  if (stats.overdue > 0 || stats.blocked > 0) return "at_risk";
  if (kpis.length > 0) {
    const avg =
      kpis.reduce((sum, k) => sum + k.attainmentPct, 0) / kpis.length;
    if (avg < 50) return "at_risk";
  }
  return "on_track";
}

export function serializeGoal(
  goal: Goal,
  opts: {
    now: Date;
    owner?: User | null;
    kpis: Kpi[];
    deliverables: SerializedTask[];
  },
): SerializedGoal {
  const kpis = opts.kpis.map(serializeKpi);
  const deliverableStats = computeDeliverableStats(opts.deliverables, opts.now);
  const health = computeHealth(goal.status, deliverableStats, kpis);
  return {
    id: goal.id,
    title: goal.title,
    description: goal.description,
    ownerId: goal.ownerId,
    ownerName: opts.owner?.name ?? null,
    timeframe: goal.timeframe,
    status: goal.status,
    health,
    archived: goal.archived,
    kpis,
    deliverableStats,
    deliverables: opts.deliverables,
    createdAt: goal.createdAt.toISOString(),
    lastUpdatedAt: goal.lastUpdatedAt.toISOString(),
  };
}
