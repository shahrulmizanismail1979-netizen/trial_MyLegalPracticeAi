// Phase 07 — Completeness Checker (ADR 0008).
//
// Pure function — no database calls. Given the isolation-gated judicial
// sections for a candidate, checks for structural completeness.
//
// Returns two lists:
//   criticalWarnings  — block VERIFIED status; must all be empty for VERIFIED
//   nonCriticalWarnings — recorded in the verified judgment record as warnings

import type { ClassifiedSection, PageInput } from "./sectionClassifier";

export interface CompletenessWarning {
  code: string;
  description: string;
}

export interface CompletenessResult {
  criticalWarnings: CompletenessWarning[];
  nonCriticalWarnings: CompletenessWarning[];
}

// ── Pattern constants ──────────────────────────────────────────────────────

// Case-opening patterns: neutral citation, case number, party line, court heading
const OPENING_PATTERN_RE =
  /\[\d{4}\]|(?:FEDERAL\s+COURT|COURT\s+OF\s+APPEAL|HIGH\s+COURT|MAHKAMAH)|(?:GUAMAN\s+SIVIL|CIVIL\s+SUIT|CIVIL\s+APPEAL|RAYUAN\s+SIVIL)|(?:v\.|lwn\.)\s+[A-Z]/i;

// Judgment dispositif — closing order language
const DISPOSITIF_RE =
  /\b(?:IT\s+IS\s+HEREBY\s+ORDERED|ORDER\s+ACCORDINGLY|DISMISSED\s+WITH\s+COSTS?|ALLOWED\s+WITH\s+COSTS?|APPEAL\s+DISMISSED|APPEAL\s+ALLOWED|SO\s+ORDERED|JUDGMENT\s+FOR|DIPERINTAHKAN|PLAINTIF\s+MENDAPAT|DEFENDAN\s+MENDAPAT)\b/i;

// Paragraph number extraction: [3] or "3." at start of line
const PARA_NUM_RE = /(?:^\s*\[(\d+)\]|^\s*(\d+)\.\s+)/gm;

// Annexure reference: "Exhibit", "Annexure", "Appendix", "Schedule"
const ANNEXURE_REF_RE =
  /\b(?:Exhibit|Annexure|Appendix|Schedule|Lampiran|Jadual)\s+[A-Z0-9]/gi;

// Annexure heading (present in text)
const ANNEXURE_HEADING_RE =
  /^\s*(?:EXHIBIT|ANNEXURE|APPENDIX|SCHEDULE|LAMPIRAN|JADUAL)\s+[A-Z0-9]/im;

// Order/schedule reference
const ORDER_REF_RE =
  /\b(?:as\s+per\s+(?:the\s+)?(?:attached|enclosed)\s+(?:order|schedule)|(?:see|refer\s+to)\s+(?:the\s+)?(?:order|schedule)\s+(?:attached|hereto))\b/i;

// Multiple case numbers / coram on same candidate (combined-judgment signal)
const CASE_NUMBER_RE =
  /\[(?:(\d{4}))\]\s+(?:MY[A-Z]{2,5}|FC|CA|HC)\s+(\d+)/g;

// ── Helpers ────────────────────────────────────────────────────────────────

function extractParaNumbers(text: string): number[] {
  const nums: number[] = [];
  const re = new RegExp(PARA_NUM_RE.source, "gm");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1] ?? m[2] ?? "0", 10);
    if (n > 0) nums.push(n);
  }
  return nums;
}

function joinText(sections: ClassifiedSection[], pages: PageInput[]): string {
  const pageMap = new Map<number, string>();
  for (const p of pages) pageMap.set(p.id, p.text);
  return sections
    .map((s) => {
      const pageText = pageMap.get(s.pageId) ?? "";
      if (s.spanStartChar != null && s.spanEndChar != null) {
        return pageText.slice(s.spanStartChar, s.spanEndChar);
      }
      // Block-scoped section (blockId present) but no character-span offsets:
      // we cannot determine safe boundaries within the page, so return empty
      // string rather than risk contaminating judicial text with adjacent
      // publisher-editorial blocks on mixed pages.
      if (s.blockId != null) return "";
      // Whole-page synthetic section (no blockId, no span): the classifier
      // assigned the entire page as judicial — full page text is safe.
      return pageText;
    })
    .join("\n");
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Check the completeness of judicial sections for a candidate.
 *
 * @param judicialSections - Isolation-gated sections (VERIFIED + PROBABLE only)
 * @param allPages         - All pages in the candidate span (including non-judicial)
 * @param totalContainerPages - Total page count of the container
 */
export function checkCompleteness(
  judicialSections: ClassifiedSection[],
  allPages: PageInput[],
  totalContainerPages: number,
): CompletenessResult {
  const critical: CompletenessWarning[] = [];
  const nonCritical: CompletenessWarning[] = [];

  if (judicialSections.length === 0) {
    critical.push({
      code: "NO_JUDICIAL_SECTIONS",
      description: "No judicial sections found in candidate span after isolation gating.",
    });
    return { criticalWarnings: critical, nonCriticalWarnings: nonCritical };
  }

  const sortedPages = [...allPages].sort((a, b) => a.pageNumber - b.pageNumber);
  const pageNums = sortedPages.map((p) => p.pageNumber);
  const firstPage = sortedPages[0];
  const lastPage = sortedPages[sortedPages.length - 1];
  const fullText = joinText(judicialSections, allPages);

  // ── Critical: missing first page ──────────────────────────────────────
  // First page is page 1 of the container, or first candidate page is not 1
  // and the opening pattern is absent.
  if (firstPage && firstPage.pageNumber > 1 && !OPENING_PATTERN_RE.test(firstPage.text)) {
    // Check if any judicial section on an early page has an opening pattern
    const hasOpeningAnywhere = OPENING_PATTERN_RE.test(fullText);
    if (!hasOpeningAnywhere) {
      critical.push({
        code: "MISSING_FIRST_PAGE",
        description: `Candidate span starts at page ${firstPage.pageNumber}; no case-opening pattern found.`,
      });
    }
  }

  // ── Critical: incomplete opening sentence ──────────────────────────────
  const hasOpening = OPENING_PATTERN_RE.test(fullText);
  if (!hasOpening) {
    critical.push({
      code: "INCOMPLETE_OPENING",
      description: "No recognisable case-opening pattern (case citation, court heading, or party line) found in judicial text.",
    });
  }

  // ── Critical: missing final page ─────────────────────────────────────
  // If the candidate's last page is not the container's last page AND there is
  // no dispositif in the judicial text.
  const hasDispositif = DISPOSITIF_RE.test(fullText);
  if (!hasDispositif) {
    if (lastPage && lastPage.pageNumber < totalContainerPages) {
      critical.push({
        code: "MISSING_FINAL_PAGE",
        description: `Candidate span ends at page ${lastPage.pageNumber} of ${totalContainerPages}; no judgment dispositif found — final page may be missing.`,
      });
    } else {
      critical.push({
        code: "INCOMPLETE_ENDING",
        description: "No judgment dispositif (ordering language) found in judicial text.",
      });
    }
  }

  // ── Critical: multiple judgments accidentally combined ─────────────────
  const caseRefs: Array<{ year: string; num: string }> = [];
  const caseRe = new RegExp(CASE_NUMBER_RE.source, "g");
  let cm: RegExpExecArray | null;
  while ((cm = caseRe.exec(fullText)) !== null) {
    const year = cm[1] ?? "";
    const num = cm[2] ?? "";
    if (year && num) caseRefs.push({ year, num });
  }
  if (caseRefs.length >= 3) {
    // Multiple distinct citations — possible multiple judgments
    const distinct = new Set(caseRefs.map((r) => `${r.year}-${r.num}`));
    if (distinct.size >= 3) {
      critical.push({
        code: "MULTIPLE_JUDGMENTS_COMBINED",
        description: `${distinct.size} distinct case citations detected in candidate span — may contain multiple judgments accidentally combined.`,
      });
    }
  }

  // ── Non-critical: skipped paragraph numbers ────────────────────────────
  const paraNumbers = extractParaNumbers(fullText);
  if (paraNumbers.length >= 3) {
    const sorted = [...paraNumbers].sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff = (sorted[i] ?? 0) - (sorted[i - 1] ?? 0);
      if (diff > 1 && diff <= 20) {
        gaps.push(sorted[i - 1] ?? 0);
      }
    }
    if (gaps.length > 0) {
      nonCritical.push({
        code: "SKIPPED_PARAGRAPH_NUMBERS",
        description: `Gap(s) in paragraph numbering after: ${gaps.slice(0, 5).join(", ")}${gaps.length > 5 ? " …" : ""}.`,
      });
    }
  }

  // ── Non-critical: duplicate paragraph numbers ──────────────────────────
  if (paraNumbers.length >= 2) {
    const seen = new Set<number>();
    const dupes = new Set<number>();
    for (const n of paraNumbers) {
      if (seen.has(n)) dupes.add(n);
      seen.add(n);
    }
    if (dupes.size > 0) {
      nonCritical.push({
        code: "DUPLICATE_PARAGRAPH_NUMBERS",
        description: `Duplicate paragraph number(s): ${[...dupes].slice(0, 5).join(", ")}${dupes.size > 5 ? " …" : ""}.`,
      });
    }
  }

  // ── Non-critical: possible missing orders/annexures ────────────────────
  const annexureRefs = [...fullText.matchAll(new RegExp(ANNEXURE_REF_RE.source, "gi"))];
  if (annexureRefs.length > 0) {
    const hasHeading = ANNEXURE_HEADING_RE.test(fullText);
    if (!hasHeading) {
      nonCritical.push({
        code: "POSSIBLE_MISSING_ANNEXURES",
        description: `${annexureRefs.length} annexure/exhibit/schedule reference(s) found but no corresponding annexure heading detected.`,
      });
    }
  }

  if (ORDER_REF_RE.test(fullText) && !hasDispositif) {
    nonCritical.push({
      code: "POSSIBLE_MISSING_ORDERS",
      description: "Reference to an attached order found but no formal order language detected.",
    });
  }

  // ── Non-critical: unreadable pages ────────────────────────────────────
  const unreadable = sortedPages.filter(
    (p) => !p.isBlank && p.text.trim().length < 20,
  );
  if (unreadable.length > 0) {
    nonCritical.push({
      code: "UNREADABLE_PAGES",
      description: `Page(s) with little or no extracted text (possible scan quality issue): ${unreadable.map((p) => p.pageNumber).join(", ")}.`,
    });
  }

  // ── Non-critical: page number gaps in span ────────────────────────────
  if (pageNums.length >= 2) {
    const pageSorted = [...pageNums].sort((a, b) => a - b);
    for (let i = 1; i < pageSorted.length; i++) {
      const diff = (pageSorted[i] ?? 0) - (pageSorted[i - 1] ?? 0);
      if (diff > 1) {
        nonCritical.push({
          code: "PAGE_NUMBER_GAP",
          description: `Gap in page sequence between pages ${pageSorted[i - 1]} and ${pageSorted[i]} — pages may be missing.`,
        });
        break; // report once
      }
    }
  }

  return { criticalWarnings: critical, nonCriticalWarnings: nonCritical };
}
