// Phase 10: AI analysis job processor.
//
// Job kind: "container.ai_analysis"
// Triggered via POST /api/research/judgments/:id/analysis
//
// Safety contract:
//   - analysisPermitted must be true on the container (rights gate).
//   - An enabled AI provider must exist (fails closed — no silent fallback).
//   - All evidence is validated before storage.

import { logger } from "../../lib/logger";
import {
  db,
  researchVerifiedJudgments,
  researchRightsRecords,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  registerProcessor,
  enqueue,
  ProcessorFailure,
  type ProcessorContext,
  type ProcessorResult,
} from "../processing";
import { getEnabledProvider } from "./service";
import { runAiAnalysis, AnalysisError } from "./generator";

export const AI_ANALYSIS_JOB_KIND = "container.ai_analysis";

/** Register the processor (idempotent — safe to call multiple times). */
export function registerAiAnalysisProcessor(): void {
  registerProcessor(
    AI_ANALYSIS_JOB_KIND,
    async (ctx: ProcessorContext): Promise<ProcessorResult> => {
      const { job, dbc } = ctx;
      const containerId = job.payload["containerId"] as number;
      const jobId = job.id;

      // Load the latest verified judgment for this container.
      const [judgment] = await dbc
        .select()
        .from(researchVerifiedJudgments)
        .where(eq(researchVerifiedJudgments.containerId, containerId))
        .orderBy(desc(researchVerifiedJudgments.id))
        .limit(1);

      if (!judgment) {
        throw new ProcessorFailure(
          "JUDGMENT_NOT_FOUND",
          `No verified judgment found for container ${containerId}`,
          false,
          { containerId, jobId },
        );
      }

      // Check rights gate: analysisPermitted must be explicitly true.
      const [rights] = await dbc
        .select()
        .from(researchRightsRecords)
        .where(eq(researchRightsRecords.containerId, containerId))
        .orderBy(desc(researchRightsRecords.id))
        .limit(1);

      if (!rights || rights.analysisPermitted !== true) {
        throw new ProcessorFailure(
          "ANALYSIS_NOT_PERMITTED",
          `Container ${containerId}: analysisPermitted is not true — AI analysis blocked (fails closed)`,
          false,
          { containerId, jobId, analysisPermitted: rights?.analysisPermitted },
        );
      }

      // Require an enabled provider (fails closed — no silent fallback).
      const provider = await getEnabledProvider(dbc);
      if (!provider) {
        throw new ProcessorFailure(
          "PROVIDER_DISABLED",
          "No enabled AI provider found — AI analysis blocked",
          false,
          { containerId, jobId },
        );
      }

      logger.info(
        {
          containerId,
          judgmentId: judgment.id,
          providerId: provider.id,
          provider: provider.name,
          model: provider.modelName,
          jobId,
        },
        "Starting AI analysis run",
      );

      const { run, propositions, inputBoundaryAudit } = await runAiAnalysis(
        judgment.id,
        provider.id,
        { dbc },
      );

      logger.info(
        {
          containerId,
          judgmentId: judgment.id,
          runId: run.id,
          propositionCount: propositions.length,
          criticalWarnings: run.criticalWarningCount,
          excludedBoundaryFields: inputBoundaryAudit.excludedFields.length,
        },
        "AI analysis run complete",
      );

      return { outputChecksum: run.id.toString() };
    },
    { touchesContent: false },
  );
}

/** Enqueue an AI analysis job for a container. */
export async function enqueueAiAnalysis(containerId: number): Promise<void> {
  registerAiAnalysisProcessor();
  const key = `${AI_ANALYSIS_JOB_KIND}:container:${containerId}:${Date.now()}`;
  await enqueue(AI_ANALYSIS_JOB_KIND, key, { containerId });
}
