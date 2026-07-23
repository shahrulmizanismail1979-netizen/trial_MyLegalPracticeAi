// Phase 05 candidate composer (ADR 0006).
//
// Pure function — no database calls. Takes detected signals and a set of
// page IDs and proposes case candidate spans with boundary classifications.
//
// See SCORING_RULES.md for thresholds and the minimum evidence rule.

import type { DetectedSignal } from "./signalDetector";

// ── Thresholds ─────────────────────────────────────────────────────────────

export const STRONG_THRESHOLD = 20;
export const MODERATE_THRESHOLD = 12;
export const WEAK_THRESHOLD = 6;
export const STRONG_SINGLE_THRESHOLD = 12; // single signal minimum for solo boundary

// ── Types ──────────────────────────────────────────────────────────────────

export type BoundaryStrength =
  | "STRONG_BOUNDARY_CANDIDATE"
  | "MODERATE_BOUNDARY_CANDIDATE"
  | "WEAK_BOUNDARY_CANDIDATE"
  | "CONFLICTING_BOUNDARY";

export type ReviewStatus = "auto_accepted" | "review_required";

export interface ProposedBoundary {
  pageId: number;
  blockId?: number;
  boundaryRole: "start" | "end";
  strength: BoundaryStrength;
  compositeScore: number;
  conflictingSignalCount: number;
  reviewStatus: ReviewStatus;
  /** Signals on this page that contributed to this boundary */
  signals: DetectedSignal[];
}

export interface CandidateProposal {
  startBoundary: ProposedBoundary;
  endBoundary: ProposedBoundary;
  /** All pages in the candidate span (inclusive) */
  pageIds: number[];
  /** Strength of the weaker of the two boundaries */
  overallStrength: BoundaryStrength;
  requiresReview: boolean;
}

export interface ComposerResult {
  candidates: CandidateProposal[];
  /** Page IDs not covered by any candidate span */
  unassignedPageIds: number[];
}

// ── Utilities ──────────────────────────────────────────────────────────────

const ANTI_SIGNALS = new Set([
  "REPEATED_TITLE_IN_QUOTATION",
  "ADMINISTRATIVE_MATERIAL",
  "PUBLISHER_ATTRIBUTION",
]);

function classifyStrength(
  score: number,
  conflictCount: number,
): BoundaryStrength | "NO_BOUNDARY" {
  if (score >= STRONG_THRESHOLD && conflictCount === 0) {
    return "STRONG_BOUNDARY_CANDIDATE";
  }
  if (score >= MODERATE_THRESHOLD && conflictCount <= 1) {
    return "MODERATE_BOUNDARY_CANDIDATE";
  }
  if (score >= WEAK_THRESHOLD && conflictCount <= 2) {
    return "WEAK_BOUNDARY_CANDIDATE";
  }
  if (score > 0 && conflictCount > 2) {
    return "CONFLICTING_BOUNDARY";
  }
  // Positive score but conflicts exceed positive signals
  if (score > 0 && conflictCount > 0) {
    return "CONFLICTING_BOUNDARY";
  }
  return "NO_BOUNDARY";
}

function strengthRank(s: BoundaryStrength | "NO_BOUNDARY"): number {
  const ranks: Record<string, number> = {
    STRONG_BOUNDARY_CANDIDATE: 4,
    MODERATE_BOUNDARY_CANDIDATE: 3,
    WEAK_BOUNDARY_CANDIDATE: 2,
    CONFLICTING_BOUNDARY: 1,
    NO_BOUNDARY: 0,
  };
  return ranks[s] ?? 0;
}

function weakerStrength(
  a: BoundaryStrength,
  b: BoundaryStrength,
): BoundaryStrength {
  return strengthRank(a) <= strengthRank(b) ? a : b;
}

function requiresReview(strength: BoundaryStrength): boolean {
  return (
    strength === "WEAK_BOUNDARY_CANDIDATE" ||
    strength === "CONFLICTING_BOUNDARY"
  );
}

function reviewStatusForStrength(strength: BoundaryStrength): ReviewStatus {
  if (strength === "STRONG_BOUNDARY_CANDIDATE") return "auto_accepted";
  return "review_required";
}

// ── Per-page scoring ───────────────────────────────────────────────────────

interface PageScore {
  pageId: number;
  compositeScore: number;
  conflictingSignalCount: number;
  positiveSignals: DetectedSignal[];
  antiSignals: DetectedSignal[];
  allSignals: DetectedSignal[];
  /** Max score_contribution from a single signal */
  maxSingleScore: number;
  /** Count of distinct signal_types */
  distinctSignalTypes: number;
}

function scorePages(signals: DetectedSignal[]): Map<number, PageScore> {
  const byPage = new Map<number, PageScore>();

  for (const signal of signals) {
    let ps = byPage.get(signal.pageId);
    if (!ps) {
      ps = {
        pageId: signal.pageId,
        compositeScore: 0,
        conflictingSignalCount: 0,
        positiveSignals: [],
        antiSignals: [],
        allSignals: [],
        maxSingleScore: 0,
        distinctSignalTypes: 0,
      };
      byPage.set(signal.pageId, ps);
    }
    ps.allSignals.push(signal);
    ps.compositeScore += signal.scoreContribution;
    if (signal.scoreContribution < 0) {
      ps.conflictingSignalCount += 1;
      ps.antiSignals.push(signal);
    } else {
      ps.positiveSignals.push(signal);
      if (signal.scoreContribution > ps.maxSingleScore) {
        ps.maxSingleScore = signal.scoreContribution;
      }
    }
  }

  // Count distinct signal types (for minimum evidence rule)
  for (const ps of byPage.values()) {
    const types = new Set(ps.positiveSignals.map((s) => s.signalType));
    ps.distinctSignalTypes = types.size;
  }

  return byPage;
}

// ── Boundary proposal ──────────────────────────────────────────────────────

/**
 * Decide whether a page scores as a boundary and return the proposal.
 * Returns null if the page does not meet the minimum evidence rule.
 */
function proposeBoundary(
  ps: PageScore,
  role: "start" | "end",
): ProposedBoundary | null {
  // Minimum evidence: ≥ 2 independent signal types OR 1 strong signal
  const meetsMinEvidence =
    ps.distinctSignalTypes >= 2 ||
    ps.maxSingleScore >= STRONG_SINGLE_THRESHOLD;

  if (!meetsMinEvidence) return null;

  const rawStrength = classifyStrength(ps.compositeScore, ps.conflictingSignalCount);
  if (rawStrength === "NO_BOUNDARY") return null;

  // The strength may be downgraded to CONFLICTING when anti-signals dominate
  let strength: BoundaryStrength = rawStrength as BoundaryStrength;
  if (ps.antiSignals.length > ps.positiveSignals.length) {
    strength = "CONFLICTING_BOUNDARY";
  }

  // Pick a representative block id (the block with the highest scoring signal)
  const topSignal = ps.positiveSignals.reduce(
    (best, s) =>
      s.scoreContribution > (best?.scoreContribution ?? -Infinity) ? s : best,
    ps.positiveSignals[0],
  );

  return {
    pageId: ps.pageId,
    blockId: topSignal?.blockId,
    boundaryRole: role,
    strength,
    compositeScore: ps.compositeScore,
    conflictingSignalCount: ps.conflictingSignalCount,
    reviewStatus: reviewStatusForStrength(strength),
    signals: ps.allSignals,
  };
}

// ── Candidate segmentation ─────────────────────────────────────────────────

/**
 * Compose case candidate proposals from detected signals.
 *
 * Algorithm:
 * 1. Score every page from detected signals.
 * 2. Identify "start boundary" pages: pages with enough case-start signals.
 * 3. Pair each start boundary with the closest subsequent end boundary or the
 *    page before the next start boundary.
 * 4. Pages not covered by any candidate are recorded as unassigned.
 *
 * Pure TypeScript — no DB calls. Fully testable without a database.
 */
export function composeCandidate(
  signals: DetectedSignal[],
  allPageIds: number[],
  pageNumbers: Map<number, number>, // pageId -> pageNumber for ordering
): ComposerResult {
  if (allPageIds.length === 0) {
    return { candidates: [], unassignedPageIds: [] };
  }

  const sortedPageIds = [...allPageIds].sort(
    (a, b) => (pageNumbers.get(a) ?? 0) - (pageNumbers.get(b) ?? 0),
  );

  const pageScores = scorePages(signals);

  // ── Identify candidate start pages ────────────────────────────────────
  // A start boundary is a page with strong case-start signals:
  // NEW_CASE_TITLE, NEUTRAL_CITATION, REPORT_CITATION, COURT_HEADING,
  // NEW_PARTY_CONFIGURATION, PROCEEDING_NUMBER, PARAGRAPH_RESET, PAGE_NUMBER_RESTART
  const START_SIGNAL_TYPES = new Set([
    "NEW_CASE_TITLE",
    "NEUTRAL_CITATION",
    "REPORT_CITATION",
    "COURT_HEADING",
    "NEW_PARTY_CONFIGURATION",
    "PROCEEDING_NUMBER",
    "CORAM_HEADING",
    "JUDGE_HEADING",
    "PARAGRAPH_RESET",
    "PAGE_NUMBER_RESTART",
    "BLANK_DIVIDER_PAGE",
    "PUBLISHER_DIVIDER",
    "MULTI_PAGE_GAP",
  ]);

  const END_SIGNAL_TYPES = new Set([
    "CLOSING_ORDER",
    "JUDICIAL_SIGNATURE",
    "INCOMPLETE_CASE_END",
  ]);

  // For each page, compute start-signal score and end-signal score separately
  const pageStartScores = new Map<number, number>();
  const pageEndScores = new Map<number, number>();

  for (const [pageId, ps] of pageScores) {
    let startScore = 0;
    let endScore = 0;
    for (const s of ps.allSignals) {
      if (s.scoreContribution > 0 && START_SIGNAL_TYPES.has(s.signalType)) {
        startScore += s.scoreContribution;
      }
      if (s.scoreContribution > 0 && END_SIGNAL_TYPES.has(s.signalType)) {
        endScore += s.scoreContribution;
      }
    }
    pageStartScores.set(pageId, startScore);
    pageEndScores.set(pageId, endScore);
  }

  // ── Find start boundary pages (those with meaningful start signals) ────
  const startBoundaryPageIds: number[] = [];
  for (const pageId of sortedPageIds) {
    const ps = pageScores.get(pageId);
    if (!ps) continue;

    // Pages with administrative material signals (TABLE OF CONTENTS, CAUSE LIST, etc.)
    // are definitively non-case pages — they must never become case start boundaries.
    // Note: PUBLISHER_ATTRIBUTION is intentionally excluded from this check because
    // "Sdn Bhd" (a common company suffix) appears legitimately in party names and would
    // cause false exclusions of valid case pages.
    const hasAdminMaterial = ps.allSignals.some(
      (s) => s.signalType === "ADMINISTRATIVE_MATERIAL",
    );
    if (hasAdminMaterial) continue;

    const startScore = pageStartScores.get(pageId) ?? 0;
    if (startScore < WEAK_THRESHOLD) continue;
    // Must have at least 2 distinct signal types or 1 strong single signal
    const startSignals = ps.positiveSignals.filter((s) =>
      START_SIGNAL_TYPES.has(s.signalType),
    );
    const startTypes = new Set(startSignals.map((s) => s.signalType));
    const maxStartSingle = startSignals.reduce(
      (m, s) => Math.max(m, s.scoreContribution),
      0,
    );
    if (startTypes.size >= 2 || maxStartSingle >= STRONG_SINGLE_THRESHOLD) {
      startBoundaryPageIds.push(pageId);
    }
  }

  if (startBoundaryPageIds.length === 0) {
    // No cases detected — all pages unassigned
    return { candidates: [], unassignedPageIds: [...sortedPageIds] };
  }

  // ── Build candidate spans ──────────────────────────────────────────────
  const candidates: CandidateProposal[] = [];
  const assignedPageIds = new Set<number>();

  for (let i = 0; i < startBoundaryPageIds.length; i++) {
    const startPageId = startBoundaryPageIds[i]!;
    const nextStartPageId = startBoundaryPageIds[i + 1];

    // Span from startPage up to (but not including) the next start page
    const startIdx = sortedPageIds.indexOf(startPageId);
    const endIdx =
      nextStartPageId !== undefined
        ? sortedPageIds.indexOf(nextStartPageId) - 1
        : sortedPageIds.length - 1;

    if (startIdx < 0 || endIdx < startIdx) continue;

    const spanPageIds = sortedPageIds.slice(startIdx, endIdx + 1);

    // Find the best end boundary within the span
    let endPageId: number = spanPageIds[spanPageIds.length - 1]!;
    let bestEndScore = -Infinity;
    for (const pid of spanPageIds) {
      const endScore = pageEndScores.get(pid) ?? 0;
      if (endScore > bestEndScore) {
        bestEndScore = endScore;
        endPageId = pid;
      }
    }

    // Propose boundaries
    const startPs = pageScores.get(startPageId);
    const endPs = pageScores.get(endPageId);

    // Build start boundary page score with only start signals counted
    const startBoundaryScore: PageScore = startPs
      ? {
          ...startPs,
          positiveSignals: startPs.positiveSignals.filter((s) =>
            START_SIGNAL_TYPES.has(s.signalType),
          ),
          maxSingleScore: startPs.positiveSignals
            .filter((s) => START_SIGNAL_TYPES.has(s.signalType))
            .reduce((m, s) => Math.max(m, s.scoreContribution), 0),
          distinctSignalTypes: new Set(
            startPs.positiveSignals
              .filter((s) => START_SIGNAL_TYPES.has(s.signalType))
              .map((s) => s.signalType),
          ).size,
          compositeScore: pageStartScores.get(startPageId) ?? 0,
        }
      : {
          pageId: startPageId,
          compositeScore: 0,
          conflictingSignalCount: 0,
          positiveSignals: [],
          antiSignals: [],
          allSignals: [],
          maxSingleScore: 0,
          distinctSignalTypes: 0,
        };

    // Force minimum evidence for start (we already checked startBoundaryPageIds selection)
    startBoundaryScore.distinctSignalTypes = Math.max(startBoundaryScore.distinctSignalTypes, 2);

    const startBoundary = proposeBoundary(startBoundaryScore, "start");
    if (!startBoundary) continue;

    // Build end boundary score
    let endBoundary: ProposedBoundary;
    if (endPs && (pageEndScores.get(endPageId) ?? 0) >= WEAK_THRESHOLD) {
      const endBoundaryScore: PageScore = {
        ...endPs,
        positiveSignals: endPs.positiveSignals.filter((s) =>
          END_SIGNAL_TYPES.has(s.signalType),
        ),
        maxSingleScore: endPs.positiveSignals
          .filter((s) => END_SIGNAL_TYPES.has(s.signalType))
          .reduce((m, s) => Math.max(m, s.scoreContribution), 0),
        distinctSignalTypes: new Set(
          endPs.positiveSignals
            .filter((s) => END_SIGNAL_TYPES.has(s.signalType))
            .map((s) => s.signalType),
        ).size,
        compositeScore: pageEndScores.get(endPageId) ?? 0,
      };
      // Ensure minimum evidence
      endBoundaryScore.distinctSignalTypes = Math.max(
        endBoundaryScore.distinctSignalTypes,
        endBoundaryScore.maxSingleScore >= STRONG_SINGLE_THRESHOLD ? 1 : 2,
      );
      const proposed = proposeBoundary(endBoundaryScore, "end");
      if (proposed) {
        endBoundary = proposed;
      } else {
        // Fallback: weak end boundary on last page
        endBoundary = {
          pageId: endPageId,
          boundaryRole: "end",
          strength: "WEAK_BOUNDARY_CANDIDATE",
          compositeScore: 1,
          conflictingSignalCount: 0,
          reviewStatus: "review_required",
          signals: endPs?.allSignals ?? [],
        };
      }
    } else {
      // No strong end signals — weak end boundary on last span page
      const hasIncomplete = signals.some(
        (s) =>
          s.pageId === endPageId && s.signalType === "INCOMPLETE_CASE_END",
      );
      endBoundary = {
        pageId: endPageId,
        boundaryRole: "end",
        strength: hasIncomplete ? "WEAK_BOUNDARY_CANDIDATE" : "WEAK_BOUNDARY_CANDIDATE",
        compositeScore: hasIncomplete ? WEAK_THRESHOLD : WEAK_THRESHOLD - 1,
        conflictingSignalCount: 0,
        reviewStatus: "review_required",
        signals: endPs?.allSignals ?? [],
      };
    }

    const overallStrength = weakerStrength(startBoundary.strength, endBoundary.strength);

    // Trim the span to [start..endPage]: pages after the end boundary page
    // (before the next case start) are left unassigned — they are non-case
    // material (admin pages, publisher blocks, blank gaps) that should be
    // routed to human review separately, not silently absorbed into this case.
    const endPageIdxInSpan = spanPageIds.indexOf(endPageId);
    const trimmedSpanPageIds =
      endPageIdxInSpan >= 0
        ? spanPageIds.slice(0, endPageIdxInSpan + 1)
        : spanPageIds;

    for (const pid of trimmedSpanPageIds) {
      assignedPageIds.add(pid);
    }

    candidates.push({
      startBoundary,
      endBoundary,
      pageIds: trimmedSpanPageIds,
      overallStrength,
      requiresReview:
        requiresReview(startBoundary.strength) ||
        requiresReview(endBoundary.strength),
    });
  }

  const unassignedPageIds = sortedPageIds.filter(
    (pid) => !assignedPageIds.has(pid),
  );

  return { candidates, unassignedPageIds };
}
