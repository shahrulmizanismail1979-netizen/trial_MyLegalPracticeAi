// Duplicate / version detector (Phase 08, ADR 0009).
// Pure functions — no DB, no I/O.
// Detects duplicate and version relationships between verified judgments using
// three signal types: checksum, citation, and paragraph-fingerprint.
// NO auto-merge is performed — all links route to human review.

import { createHash } from "node:crypto";
import type { DuplicateLinkType } from "@workspace/db";

export const DUPLICATE_DETECTOR_VERSION = "duplicate_detect@1";

export interface JudgmentSummary {
  judgmentId: number;
  /** SHA-256 of ordered judicial text (for exact-duplicate detection). */
  textChecksum: string;
  /** Active neutral citation (may be empty string). */
  neutralCitation: string;
  /** Active report citation (may be empty string). */
  reportCitation: string;
  /** Full judicial text (for paragraph fingerprinting). */
  fullText: string;
}

export interface DuplicateLink {
  sourceJudgmentId: number;
  targetJudgmentId: number;
  linkType: DuplicateLinkType;
  similarityScore: number;
  evidence: Record<string, unknown>;
}

// ── Paragraph fingerprinting ─────────────────────────────────────────────────

const NGRAM_SIZE = 5; // words per n-gram

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function ngramFingerprints(tokens: string[]): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i <= tokens.length - NGRAM_SIZE; i++) {
    const gram = tokens.slice(i, i + NGRAM_SIZE).join(" ");
    // Store a 12-char hash of the gram to keep the set compact.
    grams.add(createHash("sha256").update(gram).digest("hex").slice(0, 12));
  }
  return grams;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const g of a) {
    if (b.has(g)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── Citation normalisation ───────────────────────────────────────────────────

function normCitation(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

// ── Detection logic ─────────────────────────────────────────────────────────

function detectLinkType(
  exactMatch: boolean,
  citationMatch: boolean,
  similarity: number,
): DuplicateLinkType | null {
  if (exactMatch) return "EXACT_DUPLICATE";
  if (similarity >= 0.90 || (citationMatch && similarity >= 0.70)) {
    return "POSSIBLE_DUPLICATE";
  }
  if (similarity >= 0.50) return "ALTERNATIVE_VERSION";
  return null;
}

/**
 * Compare two judgments and return a link if one is detected, or null.
 * Source id < Target id is enforced by the caller to avoid duplicate pairs.
 */
export function compareJudgments(
  a: JudgmentSummary,
  b: JudgmentSummary,
): DuplicateLink | null {
  const exactMatch = a.textChecksum === b.textChecksum;

  const aNorm = normCitation(a.neutralCitation);
  const bNorm = normCitation(b.neutralCitation);
  const citationMatch =
    aNorm.length > 0 && bNorm.length > 0 && aNorm === bNorm;

  const aTokens = tokenize(a.fullText);
  const bTokens = tokenize(b.fullText);

  let similarity = 0;
  if (aTokens.length >= NGRAM_SIZE && bTokens.length >= NGRAM_SIZE) {
    const aGrams = ngramFingerprints(aTokens);
    const bGrams = ngramFingerprints(bTokens);
    similarity = jaccardSimilarity(aGrams, bGrams);
  }

  const linkType = detectLinkType(exactMatch, citationMatch, similarity);
  if (!linkType) return null;

  return {
    sourceJudgmentId: a.judgmentId,
    targetJudgmentId: b.judgmentId,
    linkType,
    similarityScore: exactMatch ? 1.0 : similarity,
    evidence: {
      exactChecksumMatch: exactMatch,
      citationMatch,
      paragraphSimilarity: similarity,
      aChecksum: a.textChecksum.slice(0, 16),
      bChecksum: b.textChecksum.slice(0, 16),
      aNeutralCitation: a.neutralCitation,
      bNeutralCitation: b.neutralCitation,
    },
  };
}

/**
 * Detect all pairwise links within a set of judgments.
 * Runs in O(n²); suitable for batches up to a few hundred judgments.
 * Returns links in canonical order (source < target by id).
 */
export function detectAllDuplicates(
  judgments: JudgmentSummary[],
): DuplicateLink[] {
  const links: DuplicateLink[] = [];
  for (let i = 0; i < judgments.length; i++) {
    for (let j = i + 1; j < judgments.length; j++) {
      const a = judgments[i]!;
      const b = judgments[j]!;
      // Canonical ordering: smaller id is source.
      const [src, tgt] =
        a.judgmentId < b.judgmentId ? [a, b] : [b, a];
      const link = compareJudgments(src, tgt);
      if (link) links.push(link);
    }
  }
  return links;
}
