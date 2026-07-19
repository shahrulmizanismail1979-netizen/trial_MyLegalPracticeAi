import { db } from "@workspace/db";
import {
  studioEducatorXpTable,
  type StudioEducatorXpRow,
} from "@workspace/db/acad";
import { eq } from "drizzle-orm";

export type EducatorXpEvent =
  | "assessment_created"
  | "question_created"
  | "material_added"
  | "rubric_saved"
  | "questions_generated"
  | "research_completed";

const EDUCATOR_XP_REWARDS: Record<EducatorXpEvent, number> = {
  assessment_created: 50,
  question_created: 10,
  material_added: 5,
  rubric_saved: 15,
  questions_generated: 25,
  research_completed: 20,
};

export const EDUCATOR_BADGE_TIERS: Array<{
  id: string;
  label: string;
  description: string;
  test: (row: StudioEducatorXpRow) => boolean;
}> = [
  {
    id: "first_steps",
    label: "First Steps",
    description: "Created your first assessment.",
    test: (r) => r.assessmentsCreated >= 1,
  },
  {
    id: "curator",
    label: "Curator",
    description: "Authored 10 questions.",
    test: (r) => r.questionsCreated >= 10,
  },
  {
    id: "library_builder",
    label: "Library Builder",
    description: "Added 5 source materials.",
    test: (r) => r.materialsCreated >= 5,
  },
  {
    id: "prolific",
    label: "Prolific Author",
    description: "Created 5 assessments.",
    test: (r) => r.assessmentsCreated >= 5,
  },
  {
    id: "rising_star",
    label: "Rising Star",
    description: "Reached level 5.",
    test: (r) => r.level >= 5,
  },
  {
    id: "luminary",
    label: "Luminary",
    description: "Reached level 10.",
    test: (r) => r.level >= 10,
  },
  {
    id: "streak_3",
    label: "On a Roll",
    description: "3-day activity streak.",
    test: (r) => r.longestStreakDays >= 3,
  },
  {
    id: "streak_7",
    label: "Week Warrior",
    description: "7-day activity streak.",
    test: (r) => r.longestStreakDays >= 7,
  },
  {
    id: "streak_30",
    label: "Devoted Mentor",
    description: "30-day activity streak.",
    test: (r) => r.longestStreakDays >= 30,
  },
];

export const STUDENT_BADGE_TIERS = [
  { id: "completed", label: "Completed", description: "Finished the assessment." },
  { id: "bronze", label: "Bronze", description: "Scored 60% or higher.", min: 0.6 },
  { id: "silver", label: "Silver", description: "Scored 75% or higher.", min: 0.75 },
  { id: "gold", label: "Gold", description: "Scored 90% or higher.", min: 0.9 },
  { id: "perfectionist", label: "Perfectionist", description: "Scored 100%.", min: 1 },
  {
    id: "speed_runner",
    label: "Speed Runner",
    description: "Finished in under half the time limit.",
  },
  { id: "clean_record", label: "Clean Record", description: "No proctoring flags." },
];

export function levelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  return Math.max(1, Math.floor(Math.sqrt(xp / 50)) + 1);
}

export function xpForNextLevel(level: number): number {
  return Math.pow(level, 2) * 50;
}

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db_ = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db_ - da) / 86400000);
}

async function ensureRow(userId: string): Promise<StudioEducatorXpRow> {
  const [existing] = await db
    .select()
    .from(studioEducatorXpTable)
    .where(eq(studioEducatorXpTable.userId, userId));
  if (existing) return existing;
  const [created] = await db
    .insert(studioEducatorXpTable)
    .values({ userId })
    .returning();
  return created!;
}

export async function getEducatorXp(
  userId: string,
): Promise<StudioEducatorXpRow> {
  return await ensureRow(userId);
}

export async function awardEducatorXp(
  userId: string,
  event: EducatorXpEvent,
): Promise<StudioEducatorXpRow> {
  const row = await ensureRow(userId);
  const today = todayDateString();
  const delta = EDUCATOR_XP_REWARDS[event];
  const newXp = row.xp + delta;
  const newLevel = levelFromXp(newXp);

  let currentStreak = row.currentStreakDays;
  let longestStreak = row.longestStreakDays;
  if (row.lastActivityDate) {
    const gap = daysBetween(row.lastActivityDate, today);
    if (gap === 0) {
      // already counted today
    } else if (gap === 1) {
      currentStreak += 1;
    } else if (gap > 1) {
      currentStreak = 1;
    }
  } else {
    currentStreak = 1;
  }
  if (currentStreak > longestStreak) longestStreak = currentStreak;

  const counters = {
    assessmentsCreated: row.assessmentsCreated,
    questionsCreated: row.questionsCreated,
    materialsCreated: row.materialsCreated,
  };
  if (event === "assessment_created") counters.assessmentsCreated += 1;
  if (event === "question_created") counters.questionsCreated += 1;
  if (event === "material_added") counters.materialsCreated += 1;

  const candidate: StudioEducatorXpRow = {
    ...row,
    ...counters,
    xp: newXp,
    level: newLevel,
    currentStreakDays: currentStreak,
    longestStreakDays: longestStreak,
  };
  const earnedBadges = new Set(row.badges);
  for (const b of EDUCATOR_BADGE_TIERS) {
    if (b.test(candidate)) earnedBadges.add(b.id);
  }

  const [updated] = await db
    .update(studioEducatorXpTable)
    .set({
      xp: newXp,
      level: newLevel,
      currentStreakDays: currentStreak,
      longestStreakDays: longestStreak,
      lastActivityDate: today,
      badges: Array.from(earnedBadges),
      assessmentsCreated: counters.assessmentsCreated,
      questionsCreated: counters.questionsCreated,
      materialsCreated: counters.materialsCreated,
      updatedAt: new Date(),
    })
    .where(eq(studioEducatorXpTable.userId, userId))
    .returning();
  return updated!;
}

/**
 * Compute student-side gamification stats for a finished attempt.
 * Pure function: caller persists `xpEarned` + `badgesEarned` on the row.
 */
export function computeStudentGamification(args: {
  scorePct: number;
  passed: boolean;
  flagCount: number;
  durationSeconds: number;
  timeLimitSeconds: number;
}): { xpEarned: number; badgesEarned: string[] } {
  const pct = Math.max(0, Math.min(1, args.scorePct));
  let xp = Math.round(pct * 100);
  if (args.passed) xp += 100;
  if (args.flagCount === 0) xp += 25;
  if (
    args.timeLimitSeconds > 0 &&
    args.durationSeconds > 0 &&
    args.durationSeconds < args.timeLimitSeconds / 2
  ) {
    xp += 25;
  }

  const badges: string[] = ["completed"];
  if (pct >= 1) badges.push("perfectionist");
  if (pct >= 0.9) badges.push("gold");
  else if (pct >= 0.75) badges.push("silver");
  else if (pct >= 0.6) badges.push("bronze");
  if (
    args.timeLimitSeconds > 0 &&
    args.durationSeconds > 0 &&
    args.durationSeconds < args.timeLimitSeconds / 2
  ) {
    badges.push("speed_runner");
  }
  if (args.flagCount === 0) badges.push("clean_record");

  return { xpEarned: xp, badgesEarned: badges };
}
