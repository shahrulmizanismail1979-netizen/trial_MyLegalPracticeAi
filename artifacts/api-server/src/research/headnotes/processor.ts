/**
 * Headnotes & Catchwords AI Processor (Phase 11+)
 *
 * Job kind: "container.headnotes"
 *
 * Given a verified judgment, calls Gemini to produce:
 *   - Numbered headnotes in Malaysian law reporter style (MLJ/CLJ convention)
 *   - Catchword lines in hierarchical em-dash notation
 *
 * Output is stored as `ai_draft` and requires editorial review before
 * inclusion in portal search results.
 *
 * Safety:
 *   - Rights gate: analysisPermitted must be true.
 *   - Idempotent: re-running with the same judgmentId+version is a no-op if
 *     accepted headnotes already exist.
 *   - JSON validation on all AI output before storage.
 */

import { logger } from "../../lib/logger";
import {
  db,
  researchVerifiedJudgments,
  researchCaseMetadata,
  researchPageSections,
  researchPageExtractions,
  researchRightsRecords,
  researchHeadnotes,
  researchCatchwords,
} from "@workspace/db";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod/v4";
import {
  registerProcessor,
  enqueue,
  ProcessorFailure,
  type ProcessorContext,
  type ProcessorResult,
} from "../processing";
import { getEnabledProvider } from "../analysis/service";

export const HEADNOTES_JOB_KIND = "container.headnotes";
export const HEADNOTES_PROCESSOR_VERSION = "headnotes@1";

// ── Response schema from Gemini ───────────────────────────────────────────────

const HeadnoteItemSchema = z.object({
  number: z.number().int().positive(),
  text: z.string().min(10),
  paragraphRef: z.string().optional().default(""),
});

const CatchwordItemSchema = z.string().min(3);

const HeadnotesResponseSchema = z.object({
  headnotes: z.array(HeadnoteItemSchema).min(1).max(20),
  catchwords: z.array(CatchwordItemSchema).min(1).max(30),
});

type HeadnotesResponse = z.infer<typeof HeadnotesResponseSchema>;

// ── Text extraction (mirrors searchIndexProcessor) ────────────────────────────

async function extractJudgmentText(
  judgment: { id: number; containerId: number; pageRefs: number[] },
  dbc: typeof db,
): Promise<string> {
  const INDEXABLE = ["VERIFIED_JUDICIAL_TEXT", "PROBABLE_JUDICIAL_TEXT"];

  const sections = await dbc
    .select({
      pageId: researchPageSections.pageId,
      classification: researchPageSections.classification,
      spanStartChar: researchPageSections.spanStartChar,
      spanEndChar: researchPageSections.spanEndChar,
    })
    .from(researchPageSections)
    .where(
      and(
        eq(researchPageSections.containerId, judgment.containerId),
        eq(researchPageSections.isolationApplied, true),
      ),
    );

  const indexable = sections.filter((s) => INDEXABLE.includes(s.classification));
  const pageIds = [...new Set(indexable.map((s) => s.pageId).filter((id): id is number => id != null))];

  let text = "";
  if (pageIds.length > 0) {
    const extractions = await dbc
      .select({ pageId: researchPageExtractions.pageId, rawText: researchPageExtractions.rawText })
      .from(researchPageExtractions)
      .where(inArray(researchPageExtractions.pageId, pageIds))
      .orderBy(desc(researchPageExtractions.id));

    const latestByPage = new Map<number, string>();
    for (const ex of extractions) {
      if (!latestByPage.has(ex.pageId) && ex.rawText) latestByPage.set(ex.pageId, ex.rawText);
    }

    const parts: string[] = [];
    for (const s of indexable) {
      if (s.pageId == null) continue;
      const pageText = latestByPage.get(s.pageId) ?? "";
      if (s.spanStartChar != null && s.spanEndChar != null && s.spanEndChar > s.spanStartChar) {
        parts.push(pageText.slice(s.spanStartChar, s.spanEndChar));
      } else {
        parts.push(pageText);
      }
    }
    text = parts.join("\n\n");
  }

  // Fallback: use raw pageRefs
  if (!text && judgment.pageRefs.length > 0) {
    const extractions = await dbc
      .select({ pageId: researchPageExtractions.pageId, rawText: researchPageExtractions.rawText })
      .from(researchPageExtractions)
      .where(inArray(researchPageExtractions.pageId, judgment.pageRefs))
      .orderBy(desc(researchPageExtractions.id));
    const latestByPage = new Map<number, string>();
    for (const ex of extractions) {
      if (!latestByPage.has(ex.pageId) && ex.rawText) latestByPage.set(ex.pageId, ex.rawText);
    }
    text = judgment.pageRefs.map((id) => latestByPage.get(id) ?? "").join("\n\n");
  }

  return text.slice(0, 60_000); // cap to avoid token overflow
}

// ── Metadata fetcher ──────────────────────────────────────────────────────────

async function getMetaValue(
  judgmentId: number,
  fieldName: string,
  dbc: typeof db,
): Promise<string | null> {
  const [row] = await dbc
    .select({ value: researchCaseMetadata.value })
    .from(researchCaseMetadata)
    .where(
      and(
        eq(researchCaseMetadata.judgmentId, judgmentId),
        eq(
          researchCaseMetadata.fieldName,
          fieldName as (typeof researchCaseMetadata.$inferSelect)["fieldName"],
        ),
        ne(researchCaseMetadata.reviewerStatus, "rejected"),
      ),
    )
    .orderBy(desc(researchCaseMetadata.id))
    .limit(1);

  if (!row?.value) return null;
  if (typeof row.value === "string") return row.value;
  if (Array.isArray(row.value)) return row.value.join(", ");
  return null;
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(params: {
  caseName: string | null;
  citation: string | null;
  court: string | null;
  judges: string | null;
  decisionDate: string | null;
  judgmentText: string;
}): string {
  const meta = [
    params.caseName && `Case: ${params.caseName}`,
    params.citation && `Citation: ${params.citation}`,
    params.court && `Court: ${params.court}`,
    params.judges && `Judge(s): ${params.judges}`,
    params.decisionDate && `Date: ${params.decisionDate}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `You are a Malaysian law reporter preparing headnotes and catchwords for a law report.

CASE DETAILS:
${meta || "(metadata unavailable)"}

JUDGMENT TEXT (excerpt):
${params.judgmentText}

INSTRUCTIONS:
1. Write 3–8 numbered headnotes in the style of the Malayan Law Journal (MLJ) or Current Law Journal (CLJ).
   - Each headnote states ONE point of law decided in this case.
   - Begin each with "Held" or "Per [Judge name]:" where appropriate.
   - Include the specific paragraph or page reference from the judgment (e.g. "[14]", "p 123").
   - Do not paraphrase obiter remarks as held — headnotes record actual holdings.
   - Write in formal legal English. Do not invent facts not in the text.

2. Write 3–10 catchword lines following MLJ/CLJ hierarchical notation:
   - Format: "Primary area — Sub-area — Specific issue" using em-dash (—) as separator.
   - Examples: "Contract — Breach — Anticipatory breach — Repudiation"
              "Evidence — Admissibility — Hearsay — Exceptions"
   - Cover every distinct area of law decided.
   - Each line is a separate catchword hierarchy, not a sentence.

RESPOND WITH ONLY A JSON OBJECT in this exact format (no markdown, no prose):
{
  "headnotes": [
    { "number": 1, "text": "Held, per …: …", "paragraphRef": "[14]" },
    ...
  ],
  "catchwords": [
    "Contract — Breach — Damages",
    "Civil Procedure — …",
    ...
  ]
}`;
}

// ── Upsert helpers ────────────────────────────────────────────────────────────

async function upsertHeadnotesAndCatchwords(
  judgmentId: number,
  response: HeadnotesResponse,
  processorVersion: string,
  dbc: typeof db,
): Promise<void> {
  await dbc.transaction(async (tx) => {
    // Delete existing ai_draft rows before reinserting (accepted rows are preserved)
    await tx
      .delete(researchHeadnotes)
      .where(
        and(
          eq(researchHeadnotes.judgmentId, judgmentId),
          eq(researchHeadnotes.status, "ai_draft"),
        ),
      );

    await tx
      .delete(researchCatchwords)
      .where(
        and(
          eq(researchCatchwords.judgmentId, judgmentId),
          eq(researchCatchwords.status, "ai_draft"),
        ),
      );

    for (const h of response.headnotes) {
      await tx
        .insert(researchHeadnotes)
        .values({
          judgmentId,
          number: h.number,
          text: h.text,
          paragraphRef: h.paragraphRef || null,
          status: "ai_draft",
          processorVersion,
        })
        .onConflictDoNothing(); // skip if accepted version at this number already exists
    }

    for (let i = 0; i < response.catchwords.length; i++) {
      await tx
        .insert(researchCatchwords)
        .values({
          judgmentId,
          sortOrder: i,
          catchwordLine: response.catchwords[i]!,
          status: "ai_draft",
          processorVersion,
        });
    }
  });
}

// ── Processor registration ────────────────────────────────────────────────────

export function registerHeadnotesProcessor(): void {
  registerProcessor(
    HEADNOTES_JOB_KIND,
    async (ctx: ProcessorContext): Promise<ProcessorResult> => {
      const { job, dbc } = ctx;
      const judgmentId = job.payload["judgmentId"] as number;
      const containerId = job.payload["containerId"] as number;

      if (!Number.isInteger(judgmentId) || !Number.isInteger(containerId)) {
        throw new ProcessorFailure(
          "INVALID_PAYLOAD",
          "headnotes job requires integer judgmentId and containerId",
          false,
        );
      }

      // Idempotency: skip if accepted headnotes already exist (don't regenerate on retry)
      const [existingAccepted] = await (dbc as typeof db)
        .select({ id: researchHeadnotes.id })
        .from(researchHeadnotes)
        .where(
          and(
            eq(researchHeadnotes.judgmentId, judgmentId),
            eq(researchHeadnotes.status, "accepted"),
          ),
        )
        .limit(1);

      if (existingAccepted) {
        logger.info({ judgmentId }, "headnotes: accepted headnotes already exist — skipping");
        return { outputChecksum: `accepted:${existingAccepted.id}` };
      }

      // Load judgment
      const [judgment] = await (dbc as typeof db)
        .select()
        .from(researchVerifiedJudgments)
        .where(eq(researchVerifiedJudgments.id, judgmentId));

      if (!judgment) {
        throw new ProcessorFailure("JUDGMENT_NOT_FOUND", `No judgment ${judgmentId}`, false, { judgmentId });
      }

      // Rights gate
      const [rights] = await (dbc as typeof db)
        .select({ analysisPermitted: researchRightsRecords.analysisPermitted })
        .from(researchRightsRecords)
        .where(eq(researchRightsRecords.containerId, containerId))
        .orderBy(desc(researchRightsRecords.id))
        .limit(1);

      if (!rights || rights.analysisPermitted !== true) {
        throw new ProcessorFailure(
          "ANALYSIS_NOT_PERMITTED",
          `Container ${containerId}: analysisPermitted is not true`,
          false,
          { containerId, judgmentId },
        );
      }

      // Require an enabled AI provider
      const provider = await getEnabledProvider(dbc as typeof db);
      if (!provider) {
        throw new ProcessorFailure(
          "PROVIDER_DISABLED",
          "No enabled AI provider — headnotes generation blocked",
          false,
          { judgmentId },
        );
      }

      // Extract judgment text
      const judgmentText = await extractJudgmentText(judgment, dbc as typeof db);
      if (!judgmentText || judgmentText.length < 100) {
        throw new ProcessorFailure(
          "INSUFFICIENT_TEXT",
          `Judgment ${judgmentId} has insufficient text for headnote generation (${judgmentText.length} chars)`,
          false,
          { judgmentId, textLength: judgmentText.length },
        );
      }

      // Load metadata for context
      const [caseName, citation, court, judges, decisionDate] = await Promise.all([
        getMetaValue(judgmentId, "caseName", dbc as typeof db),
        getMetaValue(judgmentId, "neutralCitation", dbc as typeof db).then(
          (v) => v ?? getMetaValue(judgmentId, "reportCitation", dbc as typeof db),
        ),
        getMetaValue(judgmentId, "court", dbc as typeof db),
        getMetaValue(judgmentId, "judges", dbc as typeof db),
        getMetaValue(judgmentId, "decisionDate", dbc as typeof db),
      ]);

      const prompt = buildPrompt({ caseName, citation, court, judges, decisionDate, judgmentText });

      logger.info(
        { judgmentId, containerId, provider: provider.name, model: provider.modelName, promptLen: prompt.length },
        "headnotes: calling AI",
      );

      // Call AI
      let rawJson: string;
      if (provider.name === "gemini") {
        const { ai } = await import("@workspace/integrations-gemini-ai");
        const response = await ai.models.generateContent({
          model: provider.modelName,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            temperature: provider.temperature ?? 0.3,
            maxOutputTokens: provider.maxTokens ?? 8192,
          },
        });
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new ProcessorFailure("EMPTY_AI_RESPONSE", "Gemini returned empty response", true, { judgmentId });
        rawJson = text;
      } else if (provider.name === "openai") {
        const { openai } = await import("@workspace/integrations-openai-ai-server");
        const completion = await openai.chat.completions.create({
          model: provider.modelName,
          messages: [{ role: "user", content: prompt }],
          temperature: provider.temperature ?? 0.3,
          max_tokens: provider.maxTokens ?? 8192,
          response_format: { type: "json_object" },
        });
        const content = completion.choices[0]?.message?.content;
        if (!content) throw new ProcessorFailure("EMPTY_AI_RESPONSE", "OpenAI returned empty response", true, { judgmentId });
        rawJson = content;
      } else {
        throw new ProcessorFailure("UNSUPPORTED_PROVIDER", `Provider ${provider.name} not supported`, false, { judgmentId });
      }

      // Validate AI output
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        throw new ProcessorFailure(
          "INVALID_JSON",
          `AI returned non-JSON for judgment ${judgmentId}: ${rawJson.slice(0, 200)}`,
          true,
          { judgmentId },
        );
      }

      const validated = HeadnotesResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new ProcessorFailure(
          "SCHEMA_VALIDATION_FAILED",
          `AI response did not match expected schema for judgment ${judgmentId}: ${JSON.stringify(validated.error.issues.slice(0, 3))}`,
          true,
          { judgmentId },
        );
      }

      // Persist
      await upsertHeadnotesAndCatchwords(
        judgmentId,
        validated.data,
        HEADNOTES_PROCESSOR_VERSION,
        dbc as typeof db,
      );

      logger.info(
        {
          judgmentId,
          headnoteCount: validated.data.headnotes.length,
          catchwordCount: validated.data.catchwords.length,
        },
        "headnotes: generation complete",
      );

      return { outputChecksum: `${judgmentId}:${HEADNOTES_PROCESSOR_VERSION}:${validated.data.headnotes.length}h` };
    },
    { touchesContent: false },
  );
}

/**
 * Enqueue a headnotes generation job for a verified judgment.
 * Idempotent: the fixed idempotency key means only one ai_draft pass per
 * judgment. Editors can trigger regeneration via the admin API which deletes
 * the existing job before re-enqueueing.
 */
export async function enqueueHeadnotesJob(
  judgmentId: number,
  containerId: number,
): Promise<void> {
  registerHeadnotesProcessor();
  const key = `${HEADNOTES_JOB_KIND}:judgment:${judgmentId}:${HEADNOTES_PROCESSOR_VERSION}`;
  await enqueue(HEADNOTES_JOB_KIND, key, { judgmentId, containerId });
}
