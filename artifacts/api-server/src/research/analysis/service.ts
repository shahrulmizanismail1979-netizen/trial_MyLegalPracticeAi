// Phase 10: Analysis run service.
// CRUD operations for AI analysis runs and propositions, plus the review
// workflow state machine.

import {
  db,
  researchAiProviders,
  researchAiAnalysisRuns,
  researchAiPropositions,
  researchVerifiedJudgments,
} from "@workspace/db";
import type {
  ResearchAiProvider,
  ResearchAiAnalysisRun,
  ResearchAiProposition,
  AiRunStatus,
  AiPropositionReviewStatus,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { DbClient } from "../domain/types";

export const AI_ANALYSIS_DISCLAIMER =
  "AI-GENERATED RESEARCH AID — NOT PART OF THE JUDGMENT — VERIFY AGAINST THE JUDICIAL TEXT.";

// ── Provider management ────────────────────────────────────────────────────

export async function listProviders(dbc: DbClient = db) {
  return dbc.select().from(researchAiProviders).orderBy(desc(researchAiProviders.id));
}

export async function getEnabledProvider(
  dbc: DbClient = db,
): Promise<ResearchAiProvider | null> {
  const [provider] = await dbc
    .select()
    .from(researchAiProviders)
    .where(eq(researchAiProviders.enabled, true))
    .orderBy(desc(researchAiProviders.id))
    .limit(1);
  return provider ?? null;
}

export interface CreateProviderInput {
  name: "gemini" | "openai";
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  promptVersion?: string;
  approvedBy: string;
}

export async function createProvider(
  input: CreateProviderInput,
  dbc: DbClient = db,
) {
  const [row] = await dbc
    .insert(researchAiProviders)
    .values({
      name: input.name,
      enabled: false, // explicitly disabled by default
      modelName: input.modelName,
      temperature: input.temperature ?? 0.2,
      maxTokens: input.maxTokens ?? 8192,
      promptVersion: input.promptVersion ?? "analysis@1",
      approvedBy: input.approvedBy,
      approvedAt: null,
    })
    .returning();
  return row!;
}

export async function enableProvider(
  providerId: number,
  approvedBy: string,
  dbc: DbClient = db,
) {
  // Disable all other providers first (only one can be active at a time).
  await dbc
    .update(researchAiProviders)
    .set({ enabled: false, updatedAt: new Date() });

  const [row] = await dbc
    .update(researchAiProviders)
    .set({
      enabled: true,
      approvedBy,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(researchAiProviders.id, providerId))
    .returning();
  return row ?? null;
}

export async function disableProvider(
  providerId: number,
  dbc: DbClient = db,
) {
  const [row] = await dbc
    .update(researchAiProviders)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(researchAiProviders.id, providerId))
    .returning();
  return row ?? null;
}

// ── Analysis runs ──────────────────────────────────────────────────────────

export interface AiRunWithPropositions {
  run: ResearchAiAnalysisRun;
  propositions: ResearchAiProposition[];
  disclaimer: string;
}

export async function getAnalysisRun(
  runId: number,
  dbc: DbClient = db,
): Promise<AiRunWithPropositions | null> {
  const [run] = await dbc
    .select()
    .from(researchAiAnalysisRuns)
    .where(eq(researchAiAnalysisRuns.id, runId));
  if (!run) return null;

  const propositions = await dbc
    .select()
    .from(researchAiPropositions)
    .where(eq(researchAiPropositions.runId, runId))
    .orderBy(researchAiPropositions.fieldName, researchAiPropositions.id);

  return { run, propositions, disclaimer: AI_ANALYSIS_DISCLAIMER };
}

/**
 * Get the latest analysis run for a judgment.
 * For reviewers (legal_reviewer+): returns latest run regardless of status.
 * For other roles: returns latest APPROVED run only.
 */
export async function getLatestRunForJudgment(
  judgmentId: number,
  role: string | null,
  dbc: DbClient = db,
): Promise<AiRunWithPropositions | null> {
  const reviewerRoles = new Set([
    "owner",
    "administrator",
    "rights_reviewer",
    "legal_reviewer",
  ]);
  const canSeeAllStatuses = role !== null && reviewerRoles.has(role);

  const query = dbc
    .select()
    .from(researchAiAnalysisRuns)
    .where(
      canSeeAllStatuses
        ? eq(researchAiAnalysisRuns.judgmentId, judgmentId)
        : and(
            eq(researchAiAnalysisRuns.judgmentId, judgmentId),
            eq(researchAiAnalysisRuns.status, "APPROVED"),
          ),
    )
    .orderBy(desc(researchAiAnalysisRuns.id))
    .limit(1);

  const [run] = await query;
  if (!run) return null;

  const propositions = await dbc
    .select()
    .from(researchAiPropositions)
    .where(eq(researchAiPropositions.runId, run.id))
    .orderBy(researchAiPropositions.fieldName, researchAiPropositions.id);

  return { run, propositions, disclaimer: AI_ANALYSIS_DISCLAIMER };
}

// ── Review workflow ────────────────────────────────────────────────────────

/** Legal reviewer approves or rejects the whole run. */
export async function reviewRun(
  runId: number,
  status: "APPROVED" | "REJECTED",
  reviewerEmail: string,
  notes: string | null,
  dbc: DbClient = db,
): Promise<ResearchAiAnalysisRun | null> {
  const now = new Date();
  const [row] = await dbc
    .update(researchAiAnalysisRuns)
    .set({
      status,
      reviewerEmail,
      reviewNotes: notes ?? null,
      reviewedAt: now,
      approvedAt: status === "APPROVED" ? now : null,
    })
    .where(eq(researchAiAnalysisRuns.id, runId))
    .returning();
  return row ?? null;
}

/** Legal reviewer approves or rejects an individual proposition. */
export async function reviewProposition(
  propositionId: number,
  reviewStatus: AiPropositionReviewStatus,
  reviewerEmail: string,
  dbc: DbClient = db,
): Promise<ResearchAiProposition | null> {
  const [row] = await dbc
    .update(researchAiPropositions)
    .set({
      reviewStatus,
      reviewerEmail,
      reviewedAt: new Date(),
    })
    .where(eq(researchAiPropositions.id, propositionId))
    .returning();
  return row ?? null;
}

/** Move a run to REVIEWING status (after initial creation as DRAFT). */
export async function submitRunForReview(
  runId: number,
  dbc: DbClient = db,
): Promise<ResearchAiAnalysisRun | null> {
  const [run] = await dbc
    .select()
    .from(researchAiAnalysisRuns)
    .where(eq(researchAiAnalysisRuns.id, runId));
  if (!run || run.status !== "DRAFT") return null;

  const [row] = await dbc
    .update(researchAiAnalysisRuns)
    .set({ status: "REVIEWING" })
    .where(eq(researchAiAnalysisRuns.id, runId))
    .returning();
  return row ?? null;
}
