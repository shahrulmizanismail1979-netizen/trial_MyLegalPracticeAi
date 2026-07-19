import { eq } from "drizzle-orm";
import {
  db,
  tasksTable,
  usersTable,
  taskAssessmentsTable,
  type TaskAssessment,
} from "../db";
import {
  computeRecognition,
  recommendationReasons,
  turnaroundDays,
  median,
  type RecognitionEntry,
} from "./recognitionLogic";

export type LeaderboardPayload = {
  generatedAt: string;
  fastThresholdDays: number;
  entries: RecognitionEntry[];
};

export type RecommendationsPayload = {
  generatedAt: string;
  bonus: {
    userId: number;
    userName: string;
    role: string;
    overallScore: number;
    reasons: string[];
  }[];
  promotion: {
    userId: number;
    userName: string;
    role: string;
    overallScore: number;
    reasons: string[];
  }[];
};

async function loadRecognitionEntries(): Promise<{
  entries: RecognitionEntry[];
  fastThresholdDays: number;
}> {
  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.archived, false));
  const users = await db.select().from(usersTable);
  const assessments = await db.select().from(taskAssessmentsTable);

  const doneTasks = tasks.filter((t) => t.status === "done");
  const assessmentsByTask = new Map<number, TaskAssessment>(
    assessments.map((a) => [a.taskId, a]),
  );

  const entries = computeRecognition(users, doneTasks, assessmentsByTask);

  const turnarounds = doneTasks
    .map((t) => turnaroundDays(t))
    .filter((d): d is number => d != null);
  const fastThresholdDays = Math.round(median(turnarounds) * 10) / 10;

  return { entries, fastThresholdDays };
}

export async function buildLeaderboard(): Promise<LeaderboardPayload> {
  const { entries, fastThresholdDays } = await loadRecognitionEntries();
  return {
    generatedAt: new Date().toISOString(),
    fastThresholdDays,
    entries,
  };
}

export async function buildRecommendations(): Promise<RecommendationsPayload> {
  const { entries } = await loadRecognitionEntries();

  const bonus = entries
    .filter((e) => e.bonusEligible)
    .map((e) => ({
      userId: e.userId,
      userName: e.userName,
      role: e.role,
      overallScore: e.overallScore,
      reasons: recommendationReasons(e),
    }));

  const promotion = entries
    .filter((e) => e.promotionCandidate)
    .map((e) => ({
      userId: e.userId,
      userName: e.userName,
      role: e.role,
      overallScore: e.overallScore,
      reasons: recommendationReasons(e),
    }));

  return {
    generatedAt: new Date().toISOString(),
    bonus,
    promotion,
  };
}
