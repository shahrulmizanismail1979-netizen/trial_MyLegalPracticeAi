// Phase 11a: Authorities & Legislation Extraction.
//
// Reads casesConsidered and statutesConsidered propositions from an APPROVED
// AI analysis run and writes structured rows into research_authorities and
// research_legislation_refs.  Both operations are idempotent via
// ON CONFLICT DO NOTHING on (run_id, proposition_id).

import {
  db,
  researchAiAnalysisRuns,
  researchAiPropositions,
  researchAuthorities,
  researchLegislationRefs,
  researchReviewItems,
  type AuthorityTreatment,
  type LegislationMode,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import type { DbClient } from "../domain/types";
import type { ValidatedPassage } from "../analysis/schema";

// ── Treatment vocabulary ───────────────────────────────────────────────────

/**
 * Treatment label → keywords searched in proposition content (case-insensitive).
 * Labels are checked in priority order: more-specific labels first.
 */
const TREATMENT_PATTERNS: Array<{
  label: AuthorityTreatment;
  patterns: RegExp[];
}> = [
  { label: "OVERRULED",          patterns: [/\boverrul/i] },
  { label: "DECLINED_TO_FOLLOW", patterns: [/\bdeclined?\s+to\s+follow\b/i, /\brefused?\s+to\s+follow\b/i] },
  { label: "DOUBTED",            patterns: [/\bdoubted?\b/i] },
  // British: criticise, criticised, criticises, criticising
  // US: criticize, criticized, criticizes, criticizing
  { label: "CRITICISED",         patterns: [/\bcriticis(?:ed?|es|ing)\b/i, /\bcriticiz(?:ed?|es|ing)\b/i] },
  { label: "DISTINGUISHED",      patterns: [/\bdistinguish/i] },
  { label: "APPLIED",            patterns: [/\bapplied\b/i, /\bapplying\b/i, /\bapplies\b/i] },
  { label: "FOLLOWED",           patterns: [/\bfollowed\b/i, /\bfollowing\b/i] },
  { label: "APPROVED",           patterns: [/\bapproved\b/i, /\bapproving\b/i] },
  { label: "ADOPTED",            patterns: [/\badopted\b/i, /\badopting\b/i] },
  { label: "EXPLAINED",          patterns: [/\bexplained\b/i, /\bexplaining\b/i] },
  { label: "DISCUSSED",          patterns: [/\bdiscussed\b/i, /\bdiscussing\b/i] },
  { label: "CONSIDERED",         patterns: [/\bconsidered\b/i, /\bconsidering\b/i] },
  { label: "REFERRED_TO",        patterns: [/\breferred?\s+to\b/i, /\breference\s+to\b/i] },
];

// ── Case citation parsing ──────────────────────────────────────────────────

/**
 * Neutral citation patterns.  Matches formats like:
 *   [2020] 1 MLJ 100
 *   (2020) 5 CLJ 200
 *   [2020] MLJU 123
 *   [2020] 1 LNS 45
 */
const CITATION_RE =
  /[\[(]\s*(\d{4})\s*[\])]\s*\d*\s*[A-Z]{2,6}[A-Z\d]*\s*\d+/i;

/**
 * Case-name patterns.  Captures "X v Y" or "Re X".
 * Intentionally conservative — prefers false-negatives over false-positives.
 */
const CASE_NAME_RE =
  /\b([A-Z][A-Za-z &'()\-]+(?:\s+(?:Sdn?\s+Bhd|Bhd|Ltd|Inc|Corp|Pte|Pty|Holdings?|Resources?|Industries?|Ventures?|Enterprise(?:s)?|Management|Sons))?)\s+v\.?\s+([A-Z][A-Za-z &'()\-]+(?:\s+(?:Sdn?\s+Bhd|Bhd|Ltd|Inc|Corp|Pte|Pty|Holdings?|Resources?|Industries?|Ventures?|Enterprise(?:s)?|Management|Sons))?)/;

const RE_CASE_NAME_RE = /\bRe\s+([A-Z][A-Za-z &'()\-]+)/;

interface ParsedCase {
  caseName: string;
  citation: string | null;
}

export function parseCaseFromContent(content: string): ParsedCase {
  const citationMatch = content.match(CITATION_RE);
  const citation = citationMatch ? citationMatch[0].trim() : null;

  // Try "X v Y" first.
  const nameMatch = content.match(CASE_NAME_RE);
  if (nameMatch) {
    return { caseName: `${nameMatch[1].trim()} v ${nameMatch[2].trim()}`, citation };
  }

  // Try "Re X".
  const reMatch = content.match(RE_CASE_NAME_RE);
  if (reMatch) {
    return { caseName: `Re ${reMatch[1].trim()}`, citation };
  }

  // Fallback: use first sentence fragment or trimmed content (max 120 chars).
  const fallback = content.split(/[.\n]/)[0]?.trim() ?? content;
  return { caseName: fallback.slice(0, 120), citation };
}

// ── Treatment detection ────────────────────────────────────────────────────

interface TreatmentResult {
  treatment: AuthorityTreatment;
  /** The keyword/phrase that matched, for evidence string. */
  matchedKeyword: string | null;
  evidenced: boolean;
}

/**
 * Detect the treatment label from proposition content + validated passages.
 *
 * Evidence requirement: a treatment keyword must appear in BOTH the content
 * text AND at least one validated passage (valid === true).  If a keyword
 * matches in content but no valid passage contains it, the treatment is UNCLEAR.
 * A mention alone (no keyword) is also UNCLEAR.
 */
export function detectTreatment(
  content: string,
  validatedPassages: ValidatedPassage[],
): TreatmentResult {
  const validTexts = validatedPassages
    .filter((p) => p.valid)
    .map((p) => p.text);

  for (const { label, patterns } of TREATMENT_PATTERNS) {
    for (const re of patterns) {
      if (re.test(content)) {
        // Found keyword in content; now check at least one valid passage.
        const evidenced = validTexts.some((t) => re.test(t));
        const matchedKeyword = re.source;
        return { treatment: evidenced ? label : "UNCLEAR", matchedKeyword, evidenced };
      }
    }
  }

  // No keyword found — UNCLEAR (mere mention without treatment evidence).
  return { treatment: "UNCLEAR", matchedKeyword: null, evidenced: false };
}

// ── Legislation parsing ────────────────────────────────────────────────────

const ACT_RE =
  /(?:((?:section|s\.?\s*|art(?:icle)?\.?\s*|reg(?:ulation)?\.?\s*)\s*\d+[\w()]*(?:\s*\(\w+\))*)\s+of\s+)?([A-Z][A-Za-z\s()]+(?:Act|Ordinance|Rules?|Regulations?|Code|Constitution|Order|Enactment)\s*(?:\((?:Amendment|Consolidation|Revised?)\))?\s*\d{0,4})/i;

const JURISDICTION_PATTERNS: Array<{ re: RegExp; jurisdiction: string }> = [
  { re: /\bMalaysia\b|\bFederal\b|\bFederal Court\b/i, jurisdiction: "Malaysia" },
  { re: /\bSabah\b/i,     jurisdiction: "Malaysia (Sabah)" },
  { re: /\bSarawak\b/i,   jurisdiction: "Malaysia (Sarawak)" },
  { re: /\bEngland\b|\bEnglish\b|\bUK\b|\bUnited Kingdom\b/i, jurisdiction: "England & Wales" },
  { re: /\bSingapore\b/i, jurisdiction: "Singapore" },
  { re: /\bAustralia\b|\bAustralian\b/i, jurisdiction: "Australia" },
  { re: /\bIndia\b|\bIndian\b/i, jurisdiction: "India" },
];

const LEGISLATION_MODE_PATTERNS: Array<{
  mode: LegislationMode;
  patterns: RegExp[];
}> = [
  { mode: "constitutionality_considered", patterns: [/\bconstitution(?:al(?:ity)?)?\b/i, /\bunconstitutional\b/i] },
  { mode: "challenged",   patterns: [/\bchallenged?\b/i] },
  { mode: "interpreted",  patterns: [/\binterpreted?\b/i, /\bconstru(?:ed|ing|ction)\b/i, /\binterpretation\b/i] },
  { mode: "applied",      patterns: [/\bapplied\b/i, /\bapplying\b/i, /\bapplies\b/i] },
];

interface ParsedLegislation {
  statute: string;
  provision: string | null;
  jurisdiction: string | null;
  mode: LegislationMode;
  supportingPassage: string | null;
}

export function parseLegislationFromContent(
  content: string,
  validatedPassages: ValidatedPassage[],
): ParsedLegislation {
  const actMatch = content.match(ACT_RE);
  const statute = actMatch ? actMatch[2].trim() : content.split(/[.\n]/)[0]?.trim().slice(0, 120) ?? content.slice(0, 120);
  const provision = actMatch?.[1]?.trim() ?? null;

  // Jurisdiction inference from content.
  let jurisdiction: string | null = null;
  for (const { re, jurisdiction: j } of JURISDICTION_PATTERNS) {
    if (re.test(content)) {
      jurisdiction = j;
      break;
    }
  }

  // Mode from content signals.
  let mode: LegislationMode = "mentioned";
  for (const { mode: m, patterns } of LEGISLATION_MODE_PATTERNS) {
    if (patterns.some((re) => re.test(content))) {
      mode = m;
      break;
    }
  }

  // Best supporting passage: first valid one.
  const supportingPassage =
    validatedPassages.find((p) => p.valid)?.text ?? null;

  return { statute, provision, jurisdiction, mode, supportingPassage };
}

// ── Main extraction functions ──────────────────────────────────────────────

export const CITATION_GRAPH_DISCLAIMER =
  "This treatment analysis is limited to the authorised documents available in this private collection and is not a comprehensive citator.";

/**
 * Extract structured authority records from an APPROVED analysis run's
 * casesConsidered propositions.  Idempotent via ON CONFLICT DO NOTHING.
 *
 * Returns the number of rows inserted (0 if already extracted).
 */
export async function extractAuthorities(
  runId: number,
  dbc: DbClient = db,
): Promise<{ inserted: number; reviewItemsCreated: number }> {
  // 1. Load the run to get judgment_id and verify it is APPROVED.
  const [run] = await dbc
    .select()
    .from(researchAiAnalysisRuns)
    .where(eq(researchAiAnalysisRuns.id, runId));

  if (!run) {
    throw new Error(`Analysis run ${runId} not found`);
  }
  if (run.status !== "APPROVED") {
    throw new Error(
      `Analysis run ${runId} is ${run.status}; extraction requires APPROVED status`,
    );
  }

  // 2. Load casesConsidered propositions.
  const props = await dbc
    .select()
    .from(researchAiPropositions)
    .where(eq(researchAiPropositions.runId, runId))
    .then((rows) => rows.filter((r) => r.fieldName === "casesConsidered"));

  if (props.length === 0) return { inserted: 0, reviewItemsCreated: 0 };

  let inserted = 0;
  let reviewItemsCreated = 0;

  for (const prop of props) {
    const passages = (prop.validatedPassages ?? []) as ValidatedPassage[];
    const { caseName, citation } = parseCaseFromContent(prop.content);
    const { treatment, matchedKeyword, evidenced } = detectTreatment(prop.content, passages);

    const sourceParagraphId = (prop.supportingParagraphIds as string[])[0] ?? null;

    const treatmentEvidence =
      evidenced && matchedKeyword
        ? `Matched keyword pattern "${matchedKeyword}" in validated passage.`
        : treatment === "UNCLEAR"
          ? "No validated passage supports a specific treatment label."
          : null;

    const reviewStatus = treatment === "UNCLEAR" ? "pending_review" : "approved";

    const [inserted_row] = await dbc
      .insert(researchAuthorities)
      .values({
        judgmentId: run.judgmentId,
        runId,
        propositionId: prop.id,
        caseName,
        citation,
        sourceParagraphId,
        treatment,
        treatmentEvidence,
        reviewStatus,
      })
      .onConflictDoNothing()
      .returning({ id: researchAuthorities.id });

    if (inserted_row) {
      inserted++;
      // If UNCLEAR, enqueue a review item.
      if (treatment === "UNCLEAR") {
        await dbc.insert(researchReviewItems).values({
          containerId: null,
          kind: "authority.treatment_unclear",
          reason: `Authority "${caseName}" in analysis run ${runId} has no validated passage supporting a specific treatment label. Human review required.`,
          status: "open",
        });
        reviewItemsCreated++;
      }
    }
  }

  return { inserted, reviewItemsCreated };
}

/**
 * Extract structured legislation refs from an APPROVED analysis run's
 * statutesConsidered propositions.  Idempotent via ON CONFLICT DO NOTHING.
 */
export async function extractLegislation(
  runId: number,
  dbc: DbClient = db,
): Promise<{ inserted: number }> {
  const [run] = await dbc
    .select()
    .from(researchAiAnalysisRuns)
    .where(eq(researchAiAnalysisRuns.id, runId));

  if (!run) {
    throw new Error(`Analysis run ${runId} not found`);
  }
  if (run.status !== "APPROVED") {
    throw new Error(
      `Analysis run ${runId} is ${run.status}; extraction requires APPROVED status`,
    );
  }

  const props = await dbc
    .select()
    .from(researchAiPropositions)
    .where(eq(researchAiPropositions.runId, runId))
    .then((rows) => rows.filter((r) => r.fieldName === "statutesConsidered"));

  if (props.length === 0) return { inserted: 0 };

  let inserted = 0;

  for (const prop of props) {
    const passages = (prop.validatedPassages ?? []) as ValidatedPassage[];
    const { statute, provision, jurisdiction, mode, supportingPassage } =
      parseLegislationFromContent(prop.content, passages);

    const sourceParagraphId = (prop.supportingParagraphIds as string[])[0] ?? null;

    const [inserted_row] = await dbc
      .insert(researchLegislationRefs)
      .values({
        judgmentId: run.judgmentId,
        runId,
        propositionId: prop.id,
        statute,
        provision,
        jurisdiction,
        sourceParagraphId,
        mode,
        supportingPassage,
      })
      .onConflictDoNothing()
      .returning({ id: researchLegislationRefs.id });

    if (inserted_row) inserted++;
  }

  return { inserted };
}
