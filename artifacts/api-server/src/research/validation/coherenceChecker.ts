// Phase 06 (ADR 0007): coherence & contradiction checker for case candidates.
// All functions are PURE — no DB calls. Inputs are plain data objects.
// Tests can run without a database or any external adapters.

export const COHERENCE_CHECK_TYPES = [
  // Coherence checks — a FAIL routes to review
  "COHERENT_CASE_IDENTITY",
  "COHERENT_COURT",
  "COHERENT_PARTIES",
  "COHERENT_CITATION",
  "COHERENT_JUDGE",
  "COHERENT_NARRATIVE",
  "COHERENT_PARAGRAPHS",
  "COHERENT_DISPUTE",
  "COHERENT_CONCLUSION",
  // Contradiction checks — any FAIL routes to review
  "NO_MIXED_COURTS",
  "NO_UNRELATED_PARTY_CHANGE",
  "NO_MULTIPLE_DECISIONS",
  "NO_REPEATED_ENDINGS",
  "NO_NEW_PROCEEDING_MID_SPAN",
  "HAS_BEGINNING",
  "HAS_ENDING",
  "SEQUENTIAL_PARAGRAPHS",
  "NO_SOURCE_PAGE_GAP",
] as const;
export type CoherenceCheckType = (typeof COHERENCE_CHECK_TYPES)[number];

export const COHERENCE_RESULTS = ["PASS", "FAIL", "UNCERTAIN", "NOT_APPLICABLE"] as const;
export type CoherenceResult = (typeof COHERENCE_RESULTS)[number];

export interface CoherenceCheck {
  checkType: CoherenceCheckType;
  result: CoherenceResult;
  detail: Record<string, unknown>;
  processorVersion: string;
}

export interface PageData {
  id: number;
  pageNumber: number;
  text: string;
  isBlank?: boolean;
}

export interface BlockData {
  id: number;
  pageId: number;
  text: string;
  blockType: string;
}

export const VALIDATE_PROCESSOR_VERSION = "container.validate@1";

// ── Pattern helpers ────────────────────────────────────────────────────────

const COURT_PATTERNS = [
  /\bHIGH COURT\b/i,
  /\bCOURT OF APPEAL\b/i,
  /\bFEDERAL COURT\b/i,
  /\bMAGISTRATE['S]* COURT\b/i,
  /\bSESSIONS COURT\b/i,
  /\bMAHKAMAH\b/i,
  /\bSYARIAH\b/i,
  /\bINDUSTRIAL COURT\b/i,
];

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

const JUDICIAL_SIGNATURE_PATTERNS = [
  /\(([A-Z][a-z]+ )*[A-Z][A-Za-z\s]+\)\s*(Judge|Judicial Commissioner|JC|J|JCA|FCJ)/,
  /^[A-Z][A-Za-z\s]+\nJudge/m,
  /Dated this/i,
];

const PARAGRAPH_NUMBER_RE = /^\[?(\d+)\]?\s/m;

const CITATION_PATTERNS = [
  /\[\d{4}\]\s+\d+\s+[A-Z]+\s+\d+/,         // [2023] 4 MLJ 100
  /\[\d{4}\]\s+[A-Z]+\s+\d+/,               // [2023] MLJU 100
  /\(\d{4}\)\s+\d+\s+[A-Z]+\s+\d+/,         // (2023) 4 MLJ 100
  /\d{4}\s+\d+\s+CLJ\s+\d+/,                // 2023 1 CLJ 100
];

const PROCEEDING_RE = /\b[A-Z]{1,6}-\d{2,4}-[A-Z0-9]+-\d{4}\b/;
const DECISION_DATE_RE = /\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i;

// ── Signal helpers ─────────────────────────────────────────────────────────

function detectCourt(text: string): string | null {
  for (const pat of COURT_PATTERNS) {
    const m = text.match(pat);
    if (m) return m[0].toUpperCase();
  }
  return null;
}

function detectCourts(text: string): string[] {
  const found: string[] = [];
  for (const pat of COURT_PATTERNS) {
    if (pat.test(text)) found.push(pat.source);
  }
  return found;
}

function hasClosingOrder(text: string): boolean {
  return CLOSING_ORDER_PATTERNS.some((p) => p.test(text));
}

function hasJudicialSignature(text: string): boolean {
  return JUDICIAL_SIGNATURE_PATTERNS.some((p) => p.test(text));
}

function hasCaseStartSignals(text: string): boolean {
  return CITATION_PATTERNS.some((p) => p.test(text)) ||
    PROCEEDING_RE.test(text) ||
    /\bCORAM\b/i.test(text) ||
    /\bIN THE\b.*\bCOURT\b/i.test(text);
}

function hasCaseEndSignals(text: string): boolean {
  return hasClosingOrder(text) || hasJudicialSignature(text);
}

function extractParagraphNumbers(text: string): number[] {
  const matches = [...text.matchAll(/^\[?(\d+)\]?\s/gm)];
  return matches.map((m) => parseInt(m[1], 10)).filter((n) => !isNaN(n));
}

function jaccardSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean));
  const setA = tokenize(a);
  const setB = tokenize(b);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// ── Main checker ───────────────────────────────────────────────────────────

/**
 * Run all 18 coherence/contradiction checks for a candidate span.
 * pageIds = sorted list of page ids belonging to this candidate.
 * pages = map from page_id → PageData (only need the candidate's pages).
 * blocks = all blocks for those pages.
 */
export function checkCoherence(
  candidateId: number,
  pageIds: number[],
  pages: Map<number, PageData>,
  blocks: BlockData[],
): CoherenceCheck[] {
  const candidatePages = pageIds
    .map((id) => pages.get(id))
    .filter((p): p is PageData => p != null)
    .sort((a, b) => a.pageNumber - b.pageNumber);

  const fullText = candidatePages.map((p) => p.text).join("\n\n");

  const results: CoherenceCheck[] = [];

  // ── Coherence checks ──────────────────────────────────────────────────

  // COHERENT_CASE_IDENTITY: presence of at least one citation that's consistent
  {
    const citations = CITATION_PATTERNS.flatMap((p) => {
      const m = fullText.match(new RegExp(p.source, "gi"));
      return m ?? [];
    });
    if (citations.length === 0) {
      results.push({ checkType: "COHERENT_CASE_IDENTITY", result: "NOT_APPLICABLE", detail: { reason: "no citations found" }, processorVersion: VALIDATE_PROCESSOR_VERSION });
    } else {
      const unique = new Set(citations.map((c) => c.trim().toUpperCase()));
      const sim = unique.size === 1 ? 1 : 0.5; // crude: same citation is consistent
      results.push({
        checkType: "COHERENT_CASE_IDENTITY",
        result: sim >= 0.8 || unique.size <= 2 ? "PASS" : "UNCERTAIN",
        detail: { citationCount: unique.size, citations: [...unique].slice(0, 5) },
        processorVersion: VALIDATE_PROCESSOR_VERSION,
      });
    }
  }

  // COHERENT_COURT: same court name throughout
  {
    const courts = candidatePages
      .map((p) => detectCourt(p.text))
      .filter((c): c is string => c != null);
    if (courts.length === 0) {
      results.push({ checkType: "COHERENT_COURT", result: "NOT_APPLICABLE", detail: { reason: "no court name found" }, processorVersion: VALIDATE_PROCESSOR_VERSION });
    } else {
      const unique = new Set(courts);
      results.push({
        checkType: "COHERENT_COURT",
        result: unique.size <= 1 ? "PASS" : "UNCERTAIN",
        detail: { courts: [...unique] },
        processorVersion: VALIDATE_PROCESSOR_VERSION,
      });
    }
  }

  // COHERENT_PARTIES: first and last page should have similar party names
  {
    if (candidatePages.length < 2) {
      results.push({ checkType: "COHERENT_PARTIES", result: "NOT_APPLICABLE", detail: { reason: "single page" }, processorVersion: VALIDATE_PROCESSOR_VERSION });
    } else {
      const first = candidatePages[0].text.slice(0, 500);
      const last = candidatePages[candidatePages.length - 1].text.slice(0, 500);
      const sim = jaccardSimilarity(first, last);
      results.push({
        checkType: "COHERENT_PARTIES",
        result: sim > 0.05 ? "PASS" : "UNCERTAIN",
        detail: { firstPageSample: first.slice(0, 80), similarity: Math.round(sim * 100) / 100 },
        processorVersion: VALIDATE_PROCESSOR_VERSION,
      });
    }
  }

  // COHERENT_CITATION: at most one primary citation
  {
    const allCitations = CITATION_PATTERNS.flatMap((p) =>
      [...fullText.matchAll(new RegExp(p.source, "gi"))].map((m) => m[0].trim()),
    );
    const unique = new Set(allCitations);
    if (unique.size === 0) {
      results.push({ checkType: "COHERENT_CITATION", result: "NOT_APPLICABLE", detail: { reason: "no citations detected" }, processorVersion: VALIDATE_PROCESSOR_VERSION });
    } else {
      results.push({
        checkType: "COHERENT_CITATION",
        result: unique.size <= 2 ? "PASS" : "UNCERTAIN",
        detail: { citationCount: unique.size, sample: [...unique].slice(0, 3) },
        processorVersion: VALIDATE_PROCESSOR_VERSION,
      });
    }
  }

  // COHERENT_JUDGE: coram heading presence
  {
    const hasCoram = /\bCORAM\b/i.test(fullText) || /\bJudge\b/i.test(fullText);
    results.push({
      checkType: "COHERENT_JUDGE",
      result: hasCoram ? "PASS" : "NOT_APPLICABLE",
      detail: { hasCoram },
      processorVersion: VALIDATE_PROCESSOR_VERSION,
    });
  }

  // COHERENT_NARRATIVE: check for legal procedural keywords
  {
    const keywords = ["plaintiff", "defendant", "appellant", "respondent", "petitioner", "claimant", "applicant", "submission", "judgment", "court", "appeal", "held", "found", "ordered"];
    const found = keywords.filter((k) => new RegExp(`\\b${k}\\b`, "i").test(fullText));
    results.push({
      checkType: "COHERENT_NARRATIVE",
      result: found.length >= 3 ? "PASS" : (found.length >= 1 ? "UNCERTAIN" : "FAIL"),
      detail: { keywordsFound: found },
      processorVersion: VALIDATE_PROCESSOR_VERSION,
    });
  }

  // COHERENT_PARAGRAPHS: monotonically increasing paragraph numbers
  {
    const nums = extractParagraphNumbers(fullText);
    if (nums.length < 2) {
      results.push({ checkType: "COHERENT_PARAGRAPHS", result: "NOT_APPLICABLE", detail: { reason: "fewer than 2 paragraph numbers" }, processorVersion: VALIDATE_PROCESSOR_VERSION });
    } else {
      let nonMonotone = 0;
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] < nums[i - 1]) nonMonotone++;
      }
      results.push({
        checkType: "COHERENT_PARAGRAPHS",
        result: nonMonotone === 0 ? "PASS" : (nonMonotone <= 1 ? "UNCERTAIN" : "FAIL"),
        detail: { paragraphCount: nums.length, nonMonotoneTransitions: nonMonotone, sample: nums.slice(0, 10) },
        processorVersion: VALIDATE_PROCESSOR_VERSION,
      });
    }
  }

  // COHERENT_DISPUTE: check for dispute-related terms
  {
    const disputeTerms = ["breach", "negligence", "defamation", "contract", "tort", "crime", "offence", "charged", "accused", "claim", "damages", "injunction"];
    const found = disputeTerms.filter((k) => new RegExp(`\\b${k}\\b`, "i").test(fullText));
    results.push({
      checkType: "COHERENT_DISPUTE",
      result: found.length >= 1 ? "PASS" : "UNCERTAIN",
      detail: { termsFound: found },
      processorVersion: VALIDATE_PROCESSOR_VERSION,
    });
  }

  // COHERENT_CONCLUSION: check for dispositive language
  {
    const hasConclusion = hasCaseEndSignals(fullText);
    results.push({
      checkType: "COHERENT_CONCLUSION",
      result: hasConclusion ? "PASS" : "UNCERTAIN",
      detail: { hasClosingOrder: hasClosingOrder(fullText), hasSignature: hasJudicialSignature(fullText) },
      processorVersion: VALIDATE_PROCESSOR_VERSION,
    });
  }

  // ── Contradiction checks ──────────────────────────────────────────────

  // NO_MIXED_COURTS: different court names inside one segment
  {
    const courtSets = candidatePages.map((p) => detectCourts(p.text));
    const allCourts = new Set(courtSets.flat());
    const courtNames = candidatePages.map((p) => detectCourt(p.text)).filter((c): c is string => c != null);
    const uniqueCourtNames = new Set(courtNames);
    results.push({
      checkType: "NO_MIXED_COURTS",
      result: uniqueCourtNames.size <= 1 ? "PASS" : "FAIL",
      detail: { courts: [...uniqueCourtNames] },
      processorVersion: VALIDATE_PROCESSOR_VERSION,
    });
  }

  // NO_UNRELATED_PARTY_CHANGE: drastic party name change mid-span
  {
    if (candidatePages.length < 3) {
      results.push({ checkType: "NO_UNRELATED_PARTY_CHANGE", result: "NOT_APPLICABLE", detail: { reason: "fewer than 3 pages" }, processorVersion: VALIDATE_PROCESSOR_VERSION });
    } else {
      const firstHalf = candidatePages.slice(0, Math.ceil(candidatePages.length / 2)).map((p) => p.text).join(" ");
      const secondHalf = candidatePages.slice(Math.ceil(candidatePages.length / 2)).map((p) => p.text).join(" ");
      const sim = jaccardSimilarity(firstHalf.slice(0, 400), secondHalf.slice(0, 400));
      results.push({
        checkType: "NO_UNRELATED_PARTY_CHANGE",
        result: sim > 0.02 ? "PASS" : "FAIL",
        detail: { halfSimilarity: Math.round(sim * 100) / 100 },
        processorVersion: VALIDATE_PROCESSOR_VERSION,
      });
    }
  }

  // NO_MULTIPLE_DECISIONS: two independent dispositive orders
  {
    const closingMatches: string[] = [];
    for (const p of CLOSING_ORDER_PATTERNS) {
      const m = fullText.match(new RegExp(p.source, "gi"));
      if (m) closingMatches.push(...m);
    }
    const distinctClosings = new Set(closingMatches.map((s) => s.toLowerCase().trim()));
    results.push({
      checkType: "NO_MULTIPLE_DECISIONS",
      result: distinctClosings.size <= 1 ? "PASS" : "FAIL",
      detail: { closingOrderCount: distinctClosings.size, sample: [...distinctClosings].slice(0, 3) },
      processorVersion: VALIDATE_PROCESSOR_VERSION,
    });
  }

  // NO_REPEATED_ENDINGS: closing order or judicial signature appears more than once
  {
    let sigCount = 0;
    for (const p of candidatePages) {
      if (hasJudicialSignature(p.text)) sigCount++;
    }
    let closingCount = 0;
    for (const p of candidatePages) {
      if (hasClosingOrder(p.text)) closingCount++;
    }
    results.push({
      checkType: "NO_REPEATED_ENDINGS",
      result: (sigCount <= 1 && closingCount <= 1) ? "PASS" : "FAIL",
      detail: { signatureCount: sigCount, closingOrderCount: closingCount },
      processorVersion: VALIDATE_PROCESSOR_VERSION,
    });
  }

  // NO_NEW_PROCEEDING_MID_SPAN: new proceeding number begins inside the span
  {
    const proceedings: Array<{ pageNumber: number; value: string }> = [];
    for (const p of candidatePages) {
      const m = p.text.match(PROCEEDING_RE);
      if (m) proceedings.push({ pageNumber: p.pageNumber, value: m[0] });
    }
    const uniqueProceedings = new Set(proceedings.map((p) => p.value));
    results.push({
      checkType: "NO_NEW_PROCEEDING_MID_SPAN",
      result: uniqueProceedings.size <= 1 ? "PASS" : "FAIL",
      detail: { proceedings: proceedings.slice(0, 5), uniqueCount: uniqueProceedings.size },
      processorVersion: VALIDATE_PROCESSOR_VERSION,
    });
  }

  // HAS_BEGINNING: start page carries case-start signals
  {
    const firstPage = candidatePages[0];
    if (!firstPage) {
      results.push({ checkType: "HAS_BEGINNING", result: "NOT_APPLICABLE", detail: { reason: "no pages" }, processorVersion: VALIDATE_PROCESSOR_VERSION });
    } else {
      const hasStart = hasCaseStartSignals(firstPage.text);
      results.push({
        checkType: "HAS_BEGINNING",
        result: hasStart ? "PASS" : "FAIL",
        detail: { firstPageNumber: firstPage.pageNumber, sample: firstPage.text.slice(0, 120) },
        processorVersion: VALIDATE_PROCESSOR_VERSION,
      });
    }
  }

  // HAS_ENDING: end page carries case-end signals (or is marked incomplete)
  {
    const lastPage = candidatePages[candidatePages.length - 1];
    if (!lastPage) {
      results.push({ checkType: "HAS_ENDING", result: "NOT_APPLICABLE", detail: { reason: "no pages" }, processorVersion: VALIDATE_PROCESSOR_VERSION });
    } else {
      const hasEnd = hasCaseEndSignals(lastPage.text);
      // UNCERTAIN if no ending — might be incomplete case (reviewer can mark)
      results.push({
        checkType: "HAS_ENDING",
        result: hasEnd ? "PASS" : "UNCERTAIN",
        detail: { lastPageNumber: lastPage.pageNumber, hasClosingOrder: hasClosingOrder(lastPage.text), hasSignature: hasJudicialSignature(lastPage.text) },
        processorVersion: VALIDATE_PROCESSOR_VERSION,
      });
    }
  }

  // SEQUENTIAL_PARAGRAPHS: no discontinuity ≥ 10
  {
    const nums = extractParagraphNumbers(fullText);
    if (nums.length < 2) {
      results.push({ checkType: "SEQUENTIAL_PARAGRAPHS", result: "NOT_APPLICABLE", detail: { reason: "fewer than 2 paragraph numbers" }, processorVersion: VALIDATE_PROCESSOR_VERSION });
    } else {
      const gaps: Array<{ from: number; to: number; gap: number }> = [];
      for (let i = 1; i < nums.length; i++) {
        const gap = nums[i] - nums[i - 1];
        if (gap >= 10 && gap < 1000) { // ignore resets (>1000 is likely a new case)
          gaps.push({ from: nums[i - 1], to: nums[i], gap });
        }
      }
      results.push({
        checkType: "SEQUENTIAL_PARAGRAPHS",
        result: gaps.length === 0 ? "PASS" : "FAIL",
        detail: { gaps, paragraphCount: nums.length },
        processorVersion: VALIDATE_PROCESSOR_VERSION,
      });
    }
  }

  // NO_SOURCE_PAGE_GAP: no gap in page_number sequence
  {
    const pageNums = candidatePages.map((p) => p.pageNumber).sort((a, b) => a - b);
    const gaps: Array<{ from: number; to: number }> = [];
    for (let i = 1; i < pageNums.length; i++) {
      if (pageNums[i] - pageNums[i - 1] > 1) {
        gaps.push({ from: pageNums[i - 1], to: pageNums[i] });
      }
    }
    results.push({
      checkType: "NO_SOURCE_PAGE_GAP",
      result: gaps.length === 0 ? "PASS" : "FAIL",
      detail: { gaps, pageNumbers: pageNums },
      processorVersion: VALIDATE_PROCESSOR_VERSION,
    });
  }

  return results;
}

/**
 * Returns true if any result is FAIL or UNCERTAIN (routes to review).
 */
export function requiresValidationReview(checks: CoherenceCheck[]): boolean {
  return checks.some((c) => c.result === "FAIL" || c.result === "UNCERTAIN");
}

/**
 * Count FAIL and UNCERTAIN results.
 */
export function countFailures(checks: CoherenceCheck[]): { failCount: number; uncertainCount: number } {
  let failCount = 0;
  let uncertainCount = 0;
  for (const c of checks) {
    if (c.result === "FAIL") failCount++;
    else if (c.result === "UNCERTAIN") uncertainCount++;
  }
  return { failCount, uncertainCount };
}
