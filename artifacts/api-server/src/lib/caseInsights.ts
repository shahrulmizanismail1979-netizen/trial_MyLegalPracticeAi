/**
 * AI case intelligence: generates next-steps, case summary and risk assessment
 * for any portal's matter using Gemini. Results are cached for 6 hours in the
 * case_ai_insights table and invalidated whenever the caller requests a refresh.
 */
import { pool } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import { logger } from "./logger";
import { PORTAL_NAMES, PORTAL_STAGES, type Portal } from "./caseStages";

const CACHE_HOURS = 6;

export interface CaseNextStep {
  action: string;
  suggestedDeadline?: string; // ISO date string or relative ("within 14 days")
  priority: "high" | "medium" | "low";
}

export interface CaseRiskAssessment {
  rating: "Low" | "Medium" | "High";
  keyStrengths: string[];
  keyWeaknesses: string[];
}

export interface CaseInsights {
  nextSteps: CaseNextStep[];
  caseSummary: string;
  riskAssessment: CaseRiskAssessment;
  cachedAt: string;
  expiresAt: string;
}

interface MatterContext {
  title: string;
  matterType?: string | null;
  status?: string | null;
  notes?: string | null;
  plaintiff?: string | null;
  defendant?: string | null;
  clientName?: string | null;
  charge?: string | null; // crim
  court?: string | null;
  documents?: Array<{ title: string; content: string }>;
  deadlines?: Array<{ title: string; dueDate: string; status: string }>;
  stageHistory?: Array<{ toStage: string; changedAt: string }>;
}

async function getCachedInsights(
  portal: string,
  matterId: number,
): Promise<CaseInsights | null> {
  const { rows } = await pool.query(
    `SELECT next_steps, case_summary, risk_assessment, cached_at, expires_at
     FROM case_ai_insights
     WHERE portal = $1 AND matter_id = $2
     LIMIT 1`,
    [portal, matterId],
  );
  if (!rows.length) return null;
  const row = rows[0];
  if (new Date(row.expires_at) < new Date()) return null; // expired
  return {
    nextSteps: (row.next_steps as CaseNextStep[]) ?? [],
    caseSummary: row.case_summary ?? "",
    riskAssessment: (row.risk_assessment as CaseRiskAssessment) ?? {
      rating: "Medium",
      keyStrengths: [],
      keyWeaknesses: [],
    },
    cachedAt: new Date(row.cached_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

async function upsertInsights(
  portal: string,
  matterId: number,
  insights: Omit<CaseInsights, "cachedAt" | "expiresAt">,
): Promise<{ cachedAt: string; expiresAt: string }> {
  const now = new Date();
  const expires = new Date(now.getTime() + CACHE_HOURS * 3600 * 1000);
  await pool.query(
    `INSERT INTO case_ai_insights (portal, matter_id, next_steps, case_summary, risk_assessment, cached_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (portal, matter_id) DO UPDATE SET
       next_steps = EXCLUDED.next_steps,
       case_summary = EXCLUDED.case_summary,
       risk_assessment = EXCLUDED.risk_assessment,
       cached_at = EXCLUDED.cached_at,
       expires_at = EXCLUDED.expires_at`,
    [
      portal,
      matterId,
      JSON.stringify(insights.nextSteps),
      insights.caseSummary,
      JSON.stringify(insights.riskAssessment),
      now,
      expires,
    ],
  );
  return { cachedAt: now.toISOString(), expiresAt: expires.toISOString() };
}

/** Invalidate cached insights when new work is filed for this matter. */
export async function invalidateMatterInsights(portal: string, matterId: number): Promise<void> {
  await pool
    .query(`DELETE FROM case_ai_insights WHERE portal = $1 AND matter_id = $2`, [portal, matterId])
    .catch(() => {}); // best-effort
}

function buildPrompt(portal: Portal, ctx: MatterContext): string {
  const stages = PORTAL_STAGES[portal].join(" → ");
  const portalName = PORTAL_NAMES[portal];
  const docsSection =
    ctx.documents && ctx.documents.length > 0
      ? ctx.documents
          .map((d) => `Document: "${d.title}"\n${d.content.slice(0, 600)}`)
          .join("\n\n")
      : "No documents filed yet.";
  const deadlinesSection =
    ctx.deadlines && ctx.deadlines.length > 0
      ? ctx.deadlines
          .map((d) => `- ${d.title} (${d.status}) due ${d.dueDate}`)
          .join("\n")
      : "No deadlines set.";

  return `You are an AI legal case analyst for ${portalName}.

MATTER DETAILS:
Title: ${ctx.title}
Type: ${ctx.matterType ?? "General"}
Status/Stage: ${ctx.status ?? "open"}
Parties: ${ctx.plaintiff ?? ctx.clientName ?? "—"} vs ${ctx.defendant ?? "—"}
${ctx.charge ? `Charge: ${ctx.charge}` : ""}
${ctx.court ? `Court: ${ctx.court}` : ""}
${ctx.notes ? `Notes: ${ctx.notes.slice(0, 1000)}` : ""}

STAGE PROGRESSION for this portal: ${stages}

FILED DOCUMENTS:
${docsSection}

UPCOMING DEADLINES:
${deadlinesSection}

Analyse this matter and respond with a JSON object in EXACTLY this format (no markdown, no extra text):
{
  "nextSteps": [
    {"action": "<specific action>", "suggestedDeadline": "<date or relative>", "priority": "high|medium|low"}
  ],
  "caseSummary": "<2-3 paragraph factual chronology and current status of the matter>",
  "riskAssessment": {
    "rating": "Low|Medium|High",
    "keyStrengths": ["<strength 1>", "<strength 2>"],
    "keyWeaknesses": ["<weakness 1>", "<weakness 2>"]
  }
}

Rules:
- nextSteps: 3-6 concrete, actionable items based on the current stage and Malaysian legal procedure
- caseSummary: factual, professional, grounded in the filed documents and notes
- riskAssessment: honest assessment for the party the lawyer is acting for
- All text must be in English (or Bahasa Malaysia if the matter notes are in BM)
- Respond ONLY with the JSON object, no other text`;
}

export async function getMatterInsights(
  portal: Portal,
  matterId: number,
  ctx: MatterContext,
  forceRefresh = false,
): Promise<CaseInsights> {
  if (!forceRefresh) {
    const cached = await getCachedInsights(portal, matterId);
    if (cached) return cached;
  }

  const prompt = buildPrompt(portal, ctx);

  let raw = "";
  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });
    raw = result.text ?? "";
  } catch (err) {
    logger.error({ err, portal, matterId }, "Gemini case insights generation failed");
    // Return a minimal fallback instead of crashing
    return {
      nextSteps: [
        {
          action: "Review the matter and add key deadlines",
          priority: "high",
        },
      ],
      caseSummary: "Unable to generate AI summary at this time. Please try again later.",
      riskAssessment: {
        rating: "Medium",
        keyStrengths: [],
        keyWeaknesses: ["Insufficient information to assess risk — please add documents and notes"],
      },
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300_000).toISOString(), // 5min fallback TTL
    };
  }

  // Parse JSON response
  let parsed: Omit<CaseInsights, "cachedAt" | "expiresAt">;
  try {
    // Strip markdown fences if present
    const clean = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    parsed = JSON.parse(clean) as Omit<CaseInsights, "cachedAt" | "expiresAt">;
  } catch (err) {
    logger.warn({ err, raw: raw.slice(0, 200) }, "Failed to parse Gemini insights JSON");
    parsed = {
      nextSteps: [{ action: "Review matter and add key deadlines", priority: "high" }],
      caseSummary: raw.slice(0, 500) || "Unable to generate summary.",
      riskAssessment: {
        rating: "Medium",
        keyStrengths: [],
        keyWeaknesses: ["Parsed error — see raw response"],
      },
    };
  }

  const { cachedAt, expiresAt } = await upsertInsights(portal, matterId, parsed);
  return { ...parsed, cachedAt, expiresAt };
}
