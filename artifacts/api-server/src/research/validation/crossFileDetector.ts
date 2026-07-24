// Phase 06 (ADR 0007): cross-file relationship detector.
// Pure function — no DB calls. Tests run without a database.

import type { PageData } from "./coherenceChecker";

export const CROSS_FILE_RELATIONSHIP_TYPES = [
  "POSSIBLE_CONTINUATION",
  "CONFIRMED_CONTINUATION",
  "POSSIBLE_DUPLICATE",
  "EXACT_DUPLICATE",
  "ALTERNATIVE_VERSION",
  "CORRECTED_VERSION",
  "RELATED_APPEAL",
  "UNRELATED",
] as const;
export type CrossFileRelationshipType = (typeof CROSS_FILE_RELATIONSHIP_TYPES)[number];

export interface CandidateRelationship {
  relationshipType: CrossFileRelationshipType;
  evidence: Record<string, unknown>;
  confidenceNote: string;
}

export interface CandidateSummary {
  id: number;
  containerId: number;
  sourceBatch: string;
  contentSha256?: string | null; // text sha of extracted span (optional)
  startPageNumber: number;
  endPageNumber: number;
  hasClosingOrder: boolean;
  hasBeginning: boolean;
  strength: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const CLOSING_ORDER_PATTERNS = [
  /\border\s+accordingly\b/i,
  /\bordered\s+accordingly\b/i,
  /\bappeal\s+(is\s+)?(allowed|dismissed|struck\s+out)\b/i,
  /\bclaim\s+(is\s+)?(allowed|dismissed)\b/i,
  /\bjudgment\s+(is\s+)?entered\b/i,
  /\bconvicted\s+and\s+sentenced\b/i,
  /\bacquitted\s+and\s+discharged\b/i,
  /\bhereby\s+(ordered|adjudged)\b/i,
];

const CASE_START_PATTERNS = [
  /\[\d{4}\]\s+\d+\s+[A-Z]+\s+\d+/,
  /\[\d{4}\]\s+[A-Z]+\s+\d+/,
  /\b[A-Z]{1,6}-\d{2,4}-[A-Z0-9]+-\d{4}\b/,
  /\bCORAM\b/i,
  /\bIN THE\b.*\bCOURT\b/i,
];

const CITATION_RE = /\[\d{4}\]\s+[\dA-Z]+\s+[A-Z]+\s+\d+|\[\d{4}\]\s+[A-Z]+\s+\d+/g;
const CORRIGENDUM_RE = /\bcorrigendum\b/i;

function hasClosingOrder(text: string): boolean {
  return CLOSING_ORDER_PATTERNS.some((p) => p.test(text));
}

function hasCaseStartSignals(text: string): boolean {
  return CASE_START_PATTERNS.some((p) => p.test(text));
}

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean),
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function extractCitations(text: string): string[] {
  return [...text.matchAll(CITATION_RE)].map((m) => m[0].trim());
}

function citationOverlap(textA: string, textB: string): number {
  const citA = new Set(extractCitations(textA));
  const citB = new Set(extractCitations(textB));
  if (citA.size === 0 && citB.size === 0) return 0;
  const common = new Set([...citA].filter((x) => citB.has(x)));
  return (2 * common.size) / (citA.size + citB.size);
}

function simpleEditDistance(a: string, b: string): number {
  // Normalised edit distance approximation using token-level diff.
  const ta = a.toLowerCase().split(/\s+/);
  const tb = b.toLowerCase().split(/\s+/);
  const common = ta.filter((t) => tb.includes(t)).length;
  const total = Math.max(ta.length, tb.length);
  return total === 0 ? 0 : 1 - common / total;
}

// ── Main detector ──────────────────────────────────────────────────────────

/**
 * Detect the relationship between two candidates from (potentially) different
 * containers within the same source batch.
 *
 * Only auto-detects POSSIBLE_* and EXACT_DUPLICATE / ALTERNATIVE_VERSION /
 * RELATED_APPEAL. CONFIRMED_CONTINUATION and CORRECTED_VERSION/UNRELATED
 * are set only through human reviewer actions.
 *
 * Returns null if no significant relationship is detected.
 */
export function detectCrossFileRelationship(
  a: CandidateSummary,
  b: CandidateSummary,
  pagesA: PageData[],
  pagesB: PageData[],
): CandidateRelationship | null {
  // Must be in same source batch; different containers (or same is fine for
  // duplicate detection within a container, but cross-file is the main goal).
  if (a.sourceBatch !== b.sourceBatch) return null;
  if (a.id === b.id) return null;

  const textA = pagesA.map((p) => p.text).join("\n\n");
  const textB = pagesB.map((p) => p.text).join("\n\n");

  // EXACT_DUPLICATE: content sha-256 match of extracted text
  if (
    a.contentSha256 &&
    b.contentSha256 &&
    a.contentSha256 === b.contentSha256
  ) {
    return {
      relationshipType: "EXACT_DUPLICATE",
      evidence: { sha256: a.contentSha256, candidateAId: a.id, candidateBId: b.id },
      confidenceNote: "Extracted text sha-256 is identical.",
    };
  }

  const fullSim = jaccardSimilarity(textA, textB);

  // POSSIBLE_DUPLICATE: ≥ 80% token overlap
  if (fullSim >= 0.8) {
    return {
      relationshipType: "POSSIBLE_DUPLICATE",
      evidence: { similarity: Math.round(fullSim * 100) / 100, candidateAId: a.id, candidateBId: b.id },
      confidenceNote: `Token similarity ${Math.round(fullSim * 100)}% ≥ 80%; likely duplicate.`,
    };
  }

  const citOverlap = citationOverlap(textA, textB);

  // ALTERNATIVE_VERSION: same citation, materially different text
  if (citOverlap >= 0.5 && fullSim < 0.9) {
    const editDist = simpleEditDistance(textA, textB);
    if (editDist > 0.1) {
      return {
        relationshipType: "ALTERNATIVE_VERSION",
        evidence: { citationOverlap: Math.round(citOverlap * 100) / 100, editDistance: Math.round(editDist * 100) / 100 },
        confidenceNote: `Shared citations (${Math.round(citOverlap * 100)}%) but text differs (${Math.round(editDist * 100)}% edit distance).`,
      };
    }
  }

  // RELATED_APPEAL: one candidate's text references the other's citations
  const citationsA = extractCitations(textA);
  const citationsB = extractCitations(textB);
  const bCitesA = citationsA.some((c) => textB.includes(c));
  const aCitesB = citationsB.some((c) => textA.includes(c));
  if (bCitesA || aCitesB) {
    return {
      relationshipType: "RELATED_APPEAL",
      evidence: {
        bReferencesA: bCitesA,
        aReferencesB: aCitesB,
        citationsA: citationsA.slice(0, 3),
        citationsB: citationsB.slice(0, 3),
      },
      confidenceNote: "One candidate references the other's citation — likely appeal or related proceeding.",
    };
  }

  // POSSIBLE_CONTINUATION: A ends without closing order AND B begins without a new case header
  // (matching parties/court is approximated by token overlap on first 300 chars of B)
  if (!a.hasClosingOrder && !b.hasBeginning) {
    const lastPageA = pagesA[pagesA.length - 1];
    const firstPageB = pagesB[0];
    if (lastPageA && firstPageB) {
      const bridgeSim = jaccardSimilarity(
        lastPageA.text.slice(-300),
        firstPageB.text.slice(0, 300),
      );
      if (bridgeSim >= 0.05) {
        return {
          relationshipType: "POSSIBLE_CONTINUATION",
          evidence: {
            candidateAId: a.id,
            candidateBId: b.id,
            aEndsWithoutOrder: !a.hasClosingOrder,
            bStartsWithoutNewHeader: !b.hasBeginning,
            bridgeTokenSimilarity: Math.round(bridgeSim * 100) / 100,
          },
          confidenceNote: "Candidate A ends without a closing order and B begins without a new case header; may be a split judgment.",
        };
      }
    }
  }

  return null;
}

/**
 * Run detection across all ordered pairs of candidates in the same batch.
 * Returns unique relationships (each pair appears at most once, canonical order
 * source_id < target_id to avoid duplicates — callers must canonicalise before insert).
 */
export function detectAllCrossFileRelationships(
  candidates: CandidateSummary[],
  pagesByCandidateId: Map<number, PageData[]>,
): Array<{
  sourceCandidateId: number;
  targetCandidateId: number;
  relationship: CandidateRelationship;
}> {
  const results: Array<{
    sourceCandidateId: number;
    targetCandidateId: number;
    relationship: CandidateRelationship;
  }> = [];

  const seen = new Set<string>();

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      if (a.sourceBatch !== b.sourceBatch) continue;

      const pagesA = pagesByCandidateId.get(a.id) ?? [];
      const pagesB = pagesByCandidateId.get(b.id) ?? [];

      const rel = detectCrossFileRelationship(a, b, pagesA, pagesB);
      if (!rel) continue;

      // Canonical order: lower id first
      const [src, tgt] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
      const key = `${src}-${tgt}-${rel.relationshipType}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({ sourceCandidateId: src, targetCandidateId: tgt, relationship: rel });
    }
  }

  return results;
}
