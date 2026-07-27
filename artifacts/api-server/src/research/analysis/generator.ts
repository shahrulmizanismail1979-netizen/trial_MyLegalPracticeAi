// Phase 10: AI analysis generator.
//
// `runAiAnalysis` is the central function that:
//   1. Builds the input boundary (only approved judicial text + approved metadata).
//   2. Calls the LLM (or a test stub injected via opts.callLlm).
//   3. Parses and validates the structured output.
//   4. Validates every proposition's evidence (paragraph IDs + passages).
//   5. Stores the run + propositions in the DB.
//   6. Returns the stored run and propositions.
//
// The function accepts an optional `callLlm` override so tests can inject
// pre-crafted JSON responses without touching live AI APIs.

import { randomUUID } from "node:crypto";
import { logger } from "../../lib/logger";
import {
  db,
  researchAiProviders,
  researchAiAnalysisRuns,
  researchAiPropositions,
  researchVerifiedJudgments,
  researchRightsRecords,
} from "@workspace/db";
import type {
  ResearchAiProvider,
  ResearchAiAnalysisRun,
  ResearchAiProposition,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { DbClient } from "../domain/types";
import { buildAnalysisInput } from "./inputBoundary";
import {
  AiAnalysisOutputSchema,
  AI_ANALYSIS_FIELDS,
  type AiAnalysisField,
  type AiPropositionInput,
  type ValidatedPassage,
} from "./schema";

/** Injected LLM call function (defaults to the real Gemini/OpenAI call). */
export type LlmCallFn = (
  prompt: string,
  settings: { modelName: string; temperature: number; maxTokens: number },
) => Promise<string>;

/** Hard errors that prevent a run from being stored. */
export class AnalysisError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AnalysisError";
  }
}

/**
 * Run AI analysis for a verified judgment.
 *
 * @param judgmentId — verified judgment to analyse
 * @param providerId — `research_ai_providers.id` to use
 * @param opts.callLlm — override the LLM call (for testing)
 * @param opts.dbc — DB client override
 */
export async function runAiAnalysis(
  judgmentId: number,
  providerId: number,
  opts?: { callLlm?: LlmCallFn; dbc?: DbClient },
): Promise<{
  run: ResearchAiAnalysisRun;
  propositions: ResearchAiProposition[];
  inputBoundaryAudit: { includedFields: string[]; excludedFields: unknown[] };
}> {
  const dbc = opts?.dbc ?? db;

  // ── 0. Load and validate provider ─────────────────────────────────────
  const [provider] = await dbc
    .select()
    .from(researchAiProviders)
    .where(eq(researchAiProviders.id, providerId));

  if (!provider) {
    throw new AnalysisError("PROVIDER_NOT_FOUND", `Provider ${providerId} not found`);
  }
  if (!provider.enabled) {
    throw new AnalysisError(
      "PROVIDER_DISABLED",
      `AI provider '${provider.name}' (id ${providerId}) is not enabled`,
    );
  }

  // ── 1. Rights gate: analysisPermitted must be true on the container ────
  const [judgment] = await dbc
    .select()
    .from(researchVerifiedJudgments)
    .where(eq(researchVerifiedJudgments.id, judgmentId));
  if (!judgment) {
    throw new AnalysisError("JUDGMENT_NOT_FOUND", `Judgment ${judgmentId} not found`);
  }

  const [latestRights] = await dbc
    .select()
    .from(researchRightsRecords)
    .where(eq(researchRightsRecords.containerId, judgment.containerId))
    .orderBy(desc(researchRightsRecords.id))
    .limit(1);

  if (!latestRights || latestRights.analysisPermitted !== true) {
    throw new AnalysisError(
      "ANALYSIS_NOT_PERMITTED",
      `Container ${judgment.containerId} does not have analysisPermitted === true`,
    );
  }

  // ── 2. Build input boundary ────────────────────────────────────────────
  const input = await buildAnalysisInput(judgmentId, dbc);
  if (!input) {
    throw new AnalysisError(
      "JUDICIAL_TEXT_UNAVAILABLE",
      `Cannot reconstruct judicial text for judgment ${judgmentId}`,
    );
  }

  logger.info(
    {
      judgmentId,
      providerId,
      judicialTextLength: input.judicialTextLength,
      includedMetadataFields: input.includedFields,
      excludedCount: input.excludedFields.length,
    },
    "AI analysis input boundary assembled",
  );

  // ── 3. Call the LLM ────────────────────────────────────────────────────
  const callLlm: LlmCallFn = opts?.callLlm ?? makeDefaultLlmCall(provider);

  let rawJson: string;
  try {
    rawJson = await callLlm(input.prompt, {
      modelName: provider.modelName,
      temperature: provider.temperature,
      maxTokens: provider.maxTokens,
    });
  } catch (err) {
    throw new AnalysisError(
      "LLM_CALL_FAILED",
      `LLM call failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── 4. Parse and validate the structured output ────────────────────────
  let parsed: ReturnType<typeof AiAnalysisOutputSchema.parse>;
  try {
    const obj = JSON.parse(rawJson);
    parsed = AiAnalysisOutputSchema.parse(obj);
  } catch (err) {
    throw new AnalysisError(
      "OUTPUT_PARSE_FAILED",
      `AI output did not conform to the expected schema: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Reconstruct the judicial text once for passage validation.
  const { reconstructJudicialText } = await import("../quotations/integrity");
  const reconstruction = await reconstructJudicialText(judgmentId, dbc);
  const judicialText = reconstruction?.text ?? "";
  const judgmentParagraphIds = new Set(judgment.paragraphIdentifiers ?? []);

  // ── 5. Validate every proposition's evidence ───────────────────────────
  let criticalWarningCount = 0;
  const criticalFields: AiAnalysisField[] = [
    "holdingOnEachIssue",
    "possibleRatioDecidendi",
  ];

  const allPropositionValues: Array<{
    fieldName: string;
    prop: AiPropositionInput;
    validatedPassages: ValidatedPassage[];
    paragraphsValid: boolean;
    evidenceSufficient: boolean;
  }> = [];

  for (const field of AI_ANALYSIS_FIELDS) {
    const propositions = parsed[field] as AiPropositionInput[];
    let fieldRejectedCount = 0;

    for (const prop of propositions) {
      // Validate supporting paragraph IDs
      const paragraphsValid =
        prop.supportingParagraphIds.length === 0 ||
        prop.supportingParagraphIds.every((pid) =>
          judgmentParagraphIds.size === 0 || judgmentParagraphIds.has(pid),
        );

      // Validate supporting passages (byte-for-byte substring search)
      const validatedPassages: ValidatedPassage[] = prop.supportingPassages.map(
        (passage) => {
          const idx = judicialText.indexOf(passage);
          if (idx === -1) {
            return {
              text: passage,
              valid: false,
              charStart: null,
              charEnd: null,
              failureReason: "passage not found in judicial text",
            };
          }
          return {
            text: passage,
            valid: true,
            charStart: idx,
            charEnd: idx + passage.length,
          };
        },
      );

      const validPassageCount = validatedPassages.filter((p) => p.valid).length;
      const hasAnyPassages = validatedPassages.length > 0;
      // If passages were supplied, they MUST match byte-for-byte.
      // Paragraph refs alone are not sufficient to rescue a proposition that
      // provided passages and had them all fail verbatim validation.
      const evidenceSufficient = hasAnyPassages
        ? validPassageCount > 0
        : prop.supportingParagraphIds.length === 0 || paragraphsValid;

      if (!evidenceSufficient) {
        fieldRejectedCount++;
      }

      allPropositionValues.push({
        fieldName: field,
        prop,
        validatedPassages,
        paragraphsValid,
        evidenceSufficient,
      });
    }

    // Critical warning: if a critical field has more than half its
    // propositions rejected, bump the critical warning counter.
    if (
      criticalFields.includes(field as AiAnalysisField) &&
      propositions.length > 0 &&
      fieldRejectedCount > propositions.length / 2
    ) {
      criticalWarningCount++;
    }
  }

  // ── 6. Store run and propositions ──────────────────────────────────────
  const evidenceValidationResult = {
    totalPropositions: allPropositionValues.length,
    invalidEvidence: allPropositionValues.filter((p) => !p.evidenceSufficient).length,
    invalidParagraphRefs: allPropositionValues.filter((p) => !p.paragraphsValid).length,
    inputBoundary: {
      includedMetadataFields: input.includedFields,
      excludedCount: input.excludedFields.length,
      exclusions: input.excludedFields,
    },
    judicialTextChecksum: input.judicialTextChecksum,
  };

  const [run] = await dbc
    .insert(researchAiAnalysisRuns)
    .values({
      judgmentId,
      providerId,
      promptVersion: provider.promptVersion,
      modelVersion: provider.modelName,
      rawOutputStorageKey: null, // stored via job processor when object storage is available
      status: "DRAFT",
      criticalWarningCount,
      evidenceValidationResult,
    })
    .returning();

  const runId = run!.id;

  // Insert propositions — one row per proposition across all 17 fields.
  const propositionRows: Array<typeof researchAiPropositions.$inferInsert> =
    allPropositionValues.map(({ fieldName, prop, validatedPassages, evidenceSufficient }) => {
      // Effective confidence: downgrade to INSUFFICIENT_EVIDENCE if evidence fails.
      const effectiveConfidence: typeof prop.confidenceCategory = !evidenceSufficient
        ? "INSUFFICIENT_EVIDENCE"
        : prop.confidenceCategory;

      // Effective review status: rejected immediately if evidence fails.
      const effectiveReviewStatus = !evidenceSufficient ? "rejected" : "pending";

      return {
        runId,
        propositionId: prop.propositionId || randomUUID(),
        fieldName,
        content: prop.content,
        supportingParagraphIds: prop.supportingParagraphIds,
        validatedPassages: validatedPassages as unknown[],
        confidenceCategory: effectiveConfidence,
        uncertaintyLabel: prop.uncertaintyLabel ?? null,
        reviewStatus: effectiveReviewStatus as "pending" | "rejected",
      };
    });

  let propositions: ResearchAiProposition[] = [];
  if (propositionRows.length > 0) {
    propositions = await dbc
      .insert(researchAiPropositions)
      .values(propositionRows)
      .returning();
  }

  logger.info(
    {
      judgmentId,
      runId,
      totalPropositions: propositions.length,
      criticalWarningCount,
      rejectedByEvidence: propositions.filter((p) => p.reviewStatus === "rejected").length,
    },
    "AI analysis run stored",
  );

  return {
    run: run!,
    propositions,
    inputBoundaryAudit: {
      includedFields: input.includedFields,
      excludedFields: input.excludedFields,
    },
  };
}

// ── Default LLM caller ─────────────────────────────────────────────────────

function makeDefaultLlmCall(provider: ResearchAiProvider): LlmCallFn {
  return async (prompt, settings) => {
    if (provider.name === "gemini") {
      const { ai } = await import("@workspace/integrations-gemini-ai");
      const response = await ai.models.generateContent({
        model: settings.modelName,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          temperature: settings.temperature,
          maxOutputTokens: settings.maxTokens,
        },
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from Gemini");
      return text;
    }

    if (provider.name === "openai") {
      const { openai } = await import("@workspace/integrations-openai-ai-server");
      const completion = await openai.chat.completions.create({
        model: settings.modelName,
        messages: [{ role: "user", content: prompt }],
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        response_format: { type: "json_object" },
      });
      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from OpenAI");
      return content;
    }

    throw new Error(`Unsupported AI provider: ${provider.name}`);
  };
}
