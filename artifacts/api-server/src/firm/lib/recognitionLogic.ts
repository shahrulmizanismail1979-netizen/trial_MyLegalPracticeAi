import type { Task, User, TaskAssessment } from "../db";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Weights for the blended speed score of a single completed task.
const SPEED_W_DEADLINE = 0.4;
const SPEED_W_TURNAROUND = 0.3;
const SPEED_W_TEAM = 0.3;

// Weights for the overall recognition score (renormalized over available parts).
const OVERALL_W_SPEED = 0.3;
const OVERALL_W_THROUGHPUT = 0.2;
const OVERALL_W_QUALITY = 0.3;
const OVERALL_W_CREATIVITY = 0.2;

// Eligibility thresholds.
const BONUS_MIN_OVERALL = 75;
const BONUS_MIN_COMPLETED = 3;
const BONUS_MIN_QC = 80; // avg of quality+creativity (0-100)
const PROMO_MIN_OVERALL = 82;
const PROMO_MIN_COMPLETED = 5;
const PROMO_MIN_SPEED = 70;
const PROMO_MIN_QC = 85;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Effective completion timestamp for a done task. */
export function completionDate(task: Task): Date | null {
  if (task.status !== "done") return null;
  return task.completedAt ?? task.lastUpdatedAt;
}

/** Turnaround in days: from acknowledgment (or creation) to completion. */
export function turnaroundDays(task: Task): number | null {
  const completed = completionDate(task);
  if (!completed) return null;
  const start = task.acknowledgedAt ?? task.createdAt;
  const ms = completed.getTime() - start.getTime();
  if (ms < 0) return 0;
  return ms / MS_PER_DAY;
}

/** Score how far ahead of the deadline a task was finished (0-100), or null if no due date. */
function deadlineScore(task: Task): number | null {
  if (!task.dueAt) return null;
  const completed = completionDate(task);
  if (!completed) return null;
  const marginDays = (task.dueAt.getTime() - completed.getTime()) / MS_PER_DAY;
  if (marginDays >= 0) {
    // On time = 70; up to +30 for being early (full at 3+ days early).
    return clamp(70 + (marginDays / 3) * 30, 70, 100);
  }
  // Late: lose 20 points per day late, floor 0.
  return clamp(70 + marginDays * 20, 0, 70);
}

/** Score the raw turnaround duration (0-100). Shorter is better. */
function turnaroundScore(days: number): number {
  if (days <= 1) return 100;
  if (days <= 3) return 85;
  if (days <= 7) return 65;
  if (days <= 14) return 45;
  if (days <= 30) return 25;
  return 10;
}

/** Score this task's turnaround against the team average for its category (0-100). */
function vsTeamScore(days: number, teamAvgForCategory: number | null): number {
  if (teamAvgForCategory == null || teamAvgForCategory <= 0) return 50;
  if (days <= 0) return 100;
  // ratio > 1 means faster than average.
  const ratio = teamAvgForCategory / days;
  return clamp(50 * ratio, 0, 100);
}

export type SpeedContext = {
  /** Average turnaround (days) per task category across the whole team. */
  teamAvgByCategory: Map<string, number>;
};

/** Build the team-average turnaround per category from all completed tasks. */
export function buildSpeedContext(tasks: Task[]): SpeedContext {
  const sums = new Map<string, { total: number; count: number }>();
  for (const t of tasks) {
    const days = turnaroundDays(t);
    if (days == null) continue;
    const entry = sums.get(t.category) ?? { total: 0, count: 0 };
    entry.total += days;
    entry.count += 1;
    sums.set(t.category, entry);
  }
  const teamAvgByCategory = new Map<string, number>();
  for (const [cat, { total, count }] of sums) {
    if (count > 0) teamAvgByCategory.set(cat, total / count);
  }
  return { teamAvgByCategory };
}

/** Blended speed score for a single completed task (0-100). */
export function taskSpeedScore(task: Task, ctx: SpeedContext): number | null {
  const days = turnaroundDays(task);
  if (days == null) return null;
  const dl = deadlineScore(task);
  const ta = turnaroundScore(days);
  const vt = vsTeamScore(days, ctx.teamAvgByCategory.get(task.category) ?? null);
  if (dl == null) {
    // No deadline: split the deadline weight between the other two.
    return round1(ta * 0.5 + vt * 0.5);
  }
  return round1(
    dl * SPEED_W_DEADLINE + ta * SPEED_W_TURNAROUND + vt * SPEED_W_TEAM,
  );
}

export type RecognitionEntry = {
  userId: number;
  userName: string;
  role: string;
  completedCount: number;
  onTimeCount: number;
  speedScore: number;
  throughputScore: number;
  qualityScore: number | null;
  creativityScore: number | null;
  overallScore: number;
  assessedCount: number;
  bonusEligible: boolean;
  promotionCandidate: boolean;
};

/** Median of a numeric array (0 for empty). */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Compute per-user recognition entries from completed tasks and assessments.
 * Throughput is scored relative to the highest completed-count on the team.
 */
export function computeRecognition(
  users: User[],
  doneTasks: Task[],
  assessmentsByTask: Map<number, TaskAssessment>,
): RecognitionEntry[] {
  const ctx = buildSpeedContext(doneTasks);

  // Group completed tasks by owner.
  const byOwner = new Map<number, Task[]>();
  for (const t of doneTasks) {
    if (t.ownerId == null) continue;
    const list = byOwner.get(t.ownerId) ?? [];
    list.push(t);
    byOwner.set(t.ownerId, list);
  }

  const maxCompleted = Math.max(
    1,
    ...Array.from(byOwner.values()).map((l) => l.length),
  );

  const entries: RecognitionEntry[] = [];
  for (const user of users) {
    if (!user.activeStatus) continue;
    const tasks = byOwner.get(user.id) ?? [];

    const speedScores: number[] = [];
    let onTimeCount = 0;
    const qualityVals: number[] = [];
    const creativityVals: number[] = [];

    for (const t of tasks) {
      const s = taskSpeedScore(t, ctx);
      if (s != null) speedScores.push(s);
      const completed = completionDate(t);
      if (t.dueAt && completed && completed.getTime() <= t.dueAt.getTime()) {
        onTimeCount += 1;
      }
      const a = assessmentsByTask.get(t.id);
      if (a) {
        qualityVals.push(a.qualityScore);
        creativityVals.push(a.creativityScore);
      }
    }

    const speedScore =
      speedScores.length > 0
        ? round1(speedScores.reduce((a, b) => a + b, 0) / speedScores.length)
        : 0;
    const throughputScore = round1((tasks.length / maxCompleted) * 100);
    const qualityScore =
      qualityVals.length > 0
        ? round1((qualityVals.reduce((a, b) => a + b, 0) / qualityVals.length / 5) * 100)
        : null;
    const creativityScore =
      creativityVals.length > 0
        ? round1(
            (creativityVals.reduce((a, b) => a + b, 0) / creativityVals.length / 5) * 100,
          )
        : null;

    // Overall: weighted average over available components (renormalized).
    let weighted = speedScore * OVERALL_W_SPEED + throughputScore * OVERALL_W_THROUGHPUT;
    let weightSum = OVERALL_W_SPEED + OVERALL_W_THROUGHPUT;
    if (qualityScore != null) {
      weighted += qualityScore * OVERALL_W_QUALITY;
      weightSum += OVERALL_W_QUALITY;
    }
    if (creativityScore != null) {
      weighted += creativityScore * OVERALL_W_CREATIVITY;
      weightSum += OVERALL_W_CREATIVITY;
    }
    const overallScore = round1(weighted / weightSum);

    const qcAvg =
      qualityScore != null && creativityScore != null
        ? (qualityScore + creativityScore) / 2
        : null;

    const bonusEligible =
      overallScore >= BONUS_MIN_OVERALL &&
      tasks.length >= BONUS_MIN_COMPLETED &&
      qcAvg != null &&
      qcAvg >= BONUS_MIN_QC;

    const promotionCandidate =
      bonusEligible &&
      overallScore >= PROMO_MIN_OVERALL &&
      tasks.length >= PROMO_MIN_COMPLETED &&
      speedScore >= PROMO_MIN_SPEED &&
      qcAvg != null &&
      qcAvg >= PROMO_MIN_QC;

    entries.push({
      userId: user.id,
      userName: user.name,
      role: user.role,
      completedCount: tasks.length,
      onTimeCount,
      speedScore,
      throughputScore,
      qualityScore,
      creativityScore,
      overallScore,
      assessedCount: qualityVals.length,
      bonusEligible,
      promotionCandidate,
    });
  }

  entries.sort(
    (a, b) =>
      b.overallScore - a.overallScore ||
      b.completedCount - a.completedCount ||
      a.userName.localeCompare(b.userName),
  );
  return entries;
}

/** Human-readable reasons supporting a bonus/promotion recommendation. */
export function recommendationReasons(entry: RecognitionEntry): string[] {
  const reasons: string[] = [];
  reasons.push(
    `Completed ${entry.completedCount} task(s), ${entry.onTimeCount} on or before deadline.`,
  );
  reasons.push(`Speed score ${entry.speedScore}/100.`);
  if (entry.qualityScore != null) {
    reasons.push(`Quality ${entry.qualityScore}/100 across ${entry.assessedCount} rated task(s).`);
  }
  if (entry.creativityScore != null) {
    reasons.push(`Creativity ${entry.creativityScore}/100.`);
  }
  reasons.push(`Overall recognition score ${entry.overallScore}/100.`);
  return reasons;
}
