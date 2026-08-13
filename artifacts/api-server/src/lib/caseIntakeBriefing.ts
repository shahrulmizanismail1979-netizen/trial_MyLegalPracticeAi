/**
 * Intake briefing: a one-time AI snapshot of a matter taken at creation time.
 * Stores key parties, facts, legal issues, and suggested initial actions in
 * the `case_intake_briefing` table. Unlike AI Insights, this is read-only after
 * creation — it preserves the opening state of the matter for future comparison.
 */
import { pool } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import { logger } from "./logger";
import { PORTAL_NAMES, type Portal } from "./caseStages";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IntakeBriefing {
  parties: {
    client: string | null;
    opponent: string | null;
    counsel: string | null;
    others: string[];
  };
  keyFacts: string[];
  legalIssues: string[];
  initialActions: Array<{
    action: string;
    priority: "high" | "medium" | "low";
  }>;
  generatedAt: string;
}

interface MatterSnapshot {
  title: string;
  matterType?: string | null;
  status?: string | null;
  notes?: string | null;
  plaintiff?: string | null;
  defendant?: string | null;
  clientName?: string | null;
  charge?: string | null;
  court?: string | null;
  documents?: Array<{ title: string; content: string }>;
}

// ── DB helpers ────────────────────────────────────────────────────────────────

export async function getIntakeBriefing(
  portal: string,
  matterId: number,
): Promise<IntakeBriefing | null> {
  const { rows } = await pool.query(
    `SELECT parties, key_facts, legal_issues, initial_actions, generated_at
     FROM case_intake_briefing
     WHERE portal = $1 AND matter_id = $2
     LIMIT 1`,
    [portal, matterId],
  );
  if (!rows.length) return null;
  const row = rows[0];
  return {
    parties: (row.parties as IntakeBriefing["parties"]) ?? {
      client: null,
      opponent: null,
      counsel: null,
      others: [],
    },
    keyFacts: (row.key_facts as string[]) ?? [],
    legalIssues: (row.legal_issues as string[]) ?? [],
    initialActions: (row.initial_actions as IntakeBriefing["initialActions"]) ?? [],
    generatedAt: new Date(row.generated_at).toISOString(),
  };
}

async function saveIntakeBriefing(
  portal: string,
  matterId: number,
  briefing: Omit<IntakeBriefing, "generatedAt">,
): Promise<string> {
  const now = new Date();
  await pool.query(
    `INSERT INTO case_intake_briefing (portal, matter_id, parties, key_facts, legal_issues, initial_actions, generated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (portal, matter_id) DO NOTHING`,
    [
      portal,
      matterId,
      JSON.stringify(briefing.parties),
      JSON.stringify(briefing.keyFacts),
      JSON.stringify(briefing.legalIssues),
      JSON.stringify(briefing.initialActions),
      now,
    ],
  );
  return now.toISOString();
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildIntakePrompt(portal: Portal, ctx: MatterSnapshot): string {
  const portalName = PORTAL_NAMES[portal];
  const docsSection =
    ctx.documents && ctx.documents.length > 0
      ? ctx.documents
          .map((d) => `Document: "${d.title}"\n${d.content.slice(0, 800)}`)
          .join("\n\n")
      : "No documents uploaded at intake.";

  return `You are an AI legal intake analyst for ${portalName}.

A new matter has just been opened. Analyse the initial information and produce a structured intake briefing.

MATTER DETAILS:
Title: ${ctx.title}
Type: ${ctx.matterType ?? "General"}
Stage: ${ctx.status ?? "open"}
Client: ${ctx.clientName ?? ctx.plaintiff ?? "—"}
Opposing party: ${ctx.defendant ?? "—"}
${ctx.charge ? `Charge: ${ctx.charge}` : ""}
${ctx.court ? `Court: ${ctx.court}` : ""}
${ctx.notes ? `Notes: ${ctx.notes.slice(0, 1200)}` : ""}

UPLOADED DOCUMENTS AT INTAKE:
${docsSection}

Produce a structured intake briefing as a JSON object in EXACTLY this format (no markdown, no extra text):
{
  "parties": {
    "client": "<name of client/applicant or null>",
    "opponent": "<name of opposing party or null>",
    "counsel": "<counsel/solicitor name if known, or null>",
    "others": ["<other relevant party if any>"]
  },
  "keyFacts": [
    "<concise key fact 1>",
    "<concise key fact 2>"
  ],
  "legalIssues": [
    "<legal issue or cause of action 1>",
    "<legal issue or cause of action 2>"
  ],
  "initialActions": [
    {"action": "<specific initial step>", "priority": "high|medium|low"}
  ]
}

Rules:
- parties: extract from the matter details; use null where unknown
- keyFacts: 3-6 bullet-point facts derived from the notes and documents
- legalIssues: 2-4 identified legal issues or causes of action
- initialActions: 3-5 concrete first steps appropriate for the matter type and Malaysian legal practice
- This is a READ-ONLY intake snapshot — focus on opening facts, not predictions
- Respond ONLY with the JSON object, no other text`;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate and persist an intake briefing for a newly-created matter.
 * Uses INSERT … ON CONFLICT DO NOTHING so re-invocations are safe — the
 * snapshot is written exactly once and never overwritten.
 */
export async function generateAndSaveIntakeBriefing(
  portal: Portal,
  matterId: number,
  ctx: MatterSnapshot,
): Promise<void> {
  // Check if briefing already exists (idempotent)
  const existing = await getIntakeBriefing(portal, matterId);
  if (existing) return;

  const prompt = buildIntakePrompt(portal, ctx);

  /** Attempt the Gemini call and JSON repair, returning parsed data or null. */
  async function attempt(): Promise<Omit<IntakeBriefing, "generatedAt"> | null> {
    let raw = "";
    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { maxOutputTokens: 4096, responseMimeType: "application/json" },
      });
      raw = result.text ?? "";
    } catch (err) {
      logger.warn({ err, portal, matterId }, "Gemini intake briefing call failed");
      return null;
    }
    if (!raw.trim()) return null;

    // Strip markdown code fences that Gemini sometimes wraps around the JSON
    let clean = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    // Repair common Gemini JSON inconsistencies (missing commas):
    // 1. Between string elements in arrays: "val1"\n  "val2" → "val1",\n  "val2"
    clean = clean.replace(/"\n(\s*)"/g, (_m, ws: string) => `",\n${ws}"`);
    // 2. Between object elements in arrays: }\n  { → },\n  {
    clean = clean.replace(/\}\n(\s*)\{/g, (_m, ws: string) => `},\n${ws}{`);
    // 3. Between object properties where a value is an array: ]\n  "key" → ],\n  "key"
    clean = clean.replace(/\]\n(\s*)"/g, (_m, ws: string) => `],\n${ws}"`);

    try {
      return JSON.parse(clean) as Omit<IntakeBriefing, "generatedAt">;
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, rawLen: raw.length, portal, matterId },
        "Failed to parse Gemini intake briefing JSON",
      );
      return null;
    }
  }

  // Try up to twice — Gemini occasionally truncates or drops commas on first attempt.
  let parsed = await attempt();
  if (!parsed) {
    logger.info({ portal, matterId }, "Retrying intake briefing generation after parse failure");
    parsed = await attempt();
  }
  if (!parsed) {
    logger.error({ portal, matterId }, "Gemini intake briefing generation failed after 2 attempts");
    return;
  }

  await saveIntakeBriefing(portal, matterId, parsed).catch((err) =>
    logger.warn({ err, portal, matterId }, "Failed to save intake briefing"),
  );
}
