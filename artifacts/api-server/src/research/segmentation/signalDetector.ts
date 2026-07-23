// Phase 05 signal detector (ADR 0006).
//
// Pure function — no database calls. Takes extracted page and block records
// and emits one DetectedSignal per matched signal instance.
//
// The score is a deterministic, additive, weighted integer.
// It is explicitly NOT a calibrated probability.
// See SCORING_RULES.md for weights and thresholds.

export const SEGMENT_PROCESSOR_VERSION = "container.segment@1";

export const SIGNAL_TYPES = [
  "NEW_CASE_TITLE",
  "NEW_PARTY_CONFIGURATION",
  "NEUTRAL_CITATION",
  "REPORT_CITATION",
  "COURT_HEADING",
  "PROCEEDING_NUMBER",
  "CORAM_HEADING",
  "JUDGE_HEADING",
  "DECISION_DATE",
  "JUDGMENT_HEADING",
  "PARAGRAPH_RESET",
  "PAGE_NUMBER_RESTART",
  "CLOSING_ORDER",
  "JUDICIAL_SIGNATURE",
  "ABRUPT_METADATA_CHANGE",
  "ABRUPT_SEMANTIC_CHANGE",
  "TYPOGRAPHY_CHANGE",
  "PUBLISHER_DIVIDER",
  "BLANK_DIVIDER_PAGE",
  "REPEATED_TITLE_IN_QUOTATION",
  "ADMINISTRATIVE_MATERIAL",
  "INCOMPLETE_CASE_END",
  "MULTI_PAGE_GAP",
  "PUBLISHER_ATTRIBUTION",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

export const SIGNAL_SCORES: Record<SignalType, number> = {
  NEW_CASE_TITLE: 12,
  NEW_PARTY_CONFIGURATION: 8,
  NEUTRAL_CITATION: 14,
  REPORT_CITATION: 10,
  COURT_HEADING: 10,
  PROCEEDING_NUMBER: 10,
  CORAM_HEADING: 6,
  JUDGE_HEADING: 6,
  DECISION_DATE: 5,
  JUDGMENT_HEADING: 5,
  PARAGRAPH_RESET: 8,
  PAGE_NUMBER_RESTART: 8,
  CLOSING_ORDER: 10,
  JUDICIAL_SIGNATURE: 8,
  ABRUPT_METADATA_CHANGE: 4,
  ABRUPT_SEMANTIC_CHANGE: 3,
  TYPOGRAPHY_CHANGE: 3,
  PUBLISHER_DIVIDER: 4,
  BLANK_DIVIDER_PAGE: 5,
  REPEATED_TITLE_IN_QUOTATION: -8,
  ADMINISTRATIVE_MATERIAL: -6,
  INCOMPLETE_CASE_END: 3,
  MULTI_PAGE_GAP: 4,
  PUBLISHER_ATTRIBUTION: -4,
};

export interface PageInput {
  id: number;
  pageNumber: number;
  text: string;
  isBlank?: boolean;
}

export interface BlockInput {
  id: number;
  pageId: number;
  pageExtractionId: number;
  blockIndex: number;
  text: string;
  blockType: string;
  font?: Record<string, unknown> | null;
}

export interface DetectedSignal {
  pageId: number;
  blockId?: number;
  signalType: SignalType;
  signalValue: string;
  supportingText: string;
  scoreContribution: number;
  processorVersion: string;
}

// ── Pattern constants ──────────────────────────────────────────────────────

// Malaysian court codes for neutral citations: e.g. [2023] MYCA 5
const NEUTRAL_CITATION_RE =
  /\[\d{4}\]\s+(?:MY[A-Z]{2,5}|FC|CA|HC|SHC|SAC|MAHKAMAH|KL|JB|PG|IP|KK|KCH|MT|MR|ML)\s+\d+/gi;

// Report citations: [2020] 1 MLJ 123 or [2020] 3 CLJ 456 or 5 AMR 123
const REPORT_CITATION_RE =
  /(?:\[\d{4}\]\s+\d+\s+(?:MLJ|CLJ|AMR|MLJU|LNS|BLR|SLR|All ER|WLR|AC|QB|KB|Ch)\s+\d+|\d+\s+(?:MLJ|CLJ|AMR|MLJU|LNS)\s+\d+)/gi;

// Case title patterns: [2020] court-ref N
const CASE_TITLE_RE =
  /\[\d{4}\]\s+(?:[A-Z][A-Z0-9 ]{1,20})\s+\d+\b/;

// Case prefix heading (RE, IN THE MATTER OF, EX PARTE)
const CASE_PREFIX_RE =
  /^\s*(?:RE|IN THE MATTER OF|EX PARTE)\s+[A-Z][A-Z &.()]+\s*$/m;

// Party configurations: Name v. Name or lwn. (Malay)
const PARTY_CONFIG_RE =
  /\b([A-Z][A-Za-z .]{2,})\s+(?:v\.|v\b|vs\.|lwn\.)\s+([A-Z][A-Za-z .]{2,})/;

// Known Malaysian court names as headings
const COURT_HEADING_RE =
  /\b(?:FEDERAL COURT|COURT OF APPEAL|HIGH COURT|SESSIONS COURT|MAGISTRATES? COURT|MAHKAMAH PERSEKUTUAN|MAHKAMAH RAYUAN|MAHKAMAH TINGGI|MAHKAMAH SESYEN|MAHKAMAH MAJISTRET|SYARIAH|INDUSTRIAL COURT|COURT OF APPEAL OF MALAYSIA)\b/i;

// Proceeding numbers
const PROCEEDING_NUMBER_RE =
  /\b(?:GUAMAN SIVIL|SAMAN PEMULA|KES NO\.?|CIVIL SUIT|CIVIL APPEAL|CRIMINAL APPEAL|CRIMINAL PETITION|RAYUAN SIVIL|RAYUAN JENAYAH|PERMOHONAN|JUDICIAL REVIEW|WA|WA-?22|BA|BA-?22|DA|KL[- ]\d|[A-Z]{1,4}[-– ]\d{2}[-–A-Z\d-]+(?:-K(?:HU)?)?)\b/i;

// Coram headings
const CORAM_HEADING_RE = /\b(?:CORAM\s*:|PRESIDED BY\s*:|BEFORE\s*:)\s*/i;

// Judge headings: surname followed by J, JC, FCJ, CJ, PCA, CJMA, CJSS etc.
const JUDGE_HEADING_RE =
  /\b[A-Z][A-Z '.]{2,}\s+(?:FCJ|JCA|FCJBK|CJMA|CJSS|PCA|JCA|JC|CJ)\b/;

// Dates in heading context
const DATE_RE =
  /\b(?:\d{1,2}[-/ ](?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)[-/ ]\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:Januari|Februari|Mac|April|Mei|Jun|Julai|Ogos|September|Oktober|November|Disember)\s+\d{4})\b/i;

// Judgment headings
const JUDGMENT_HEADING_RE =
  /^[\s*]*(?:JUDGMENT|PENGHAKIMAN|GROUNDS OF JUDGMENT|GROUNDS OF DECISION|AWARD|ALASAN PENGHAKIMAN|ALASAN KEPUTUSAN|RULING)\s*[:\s]*$/im;

// Paragraph reset: [1] or "1." or "1)" at the start of a block, after content
const PARA_RESET_RE = /^\s*(?:\[1\]|1\.|1\))\s+/m;

// Page footer restart: "1" or "- 1 -" or "Page 1" at end of text
const PAGE_NUMBER_RESTART_RE = /(?:^|\n)\s*(?:[-– ]*1[-– ]*|page\s+1|pg\.?\s*1)\s*(?:\n|$)/im;

// Closing orders
const CLOSING_ORDER_RE =
  /\b(?:IT IS HEREBY ORDERED|IT IS ORDERED|DIPERINTAHKAN|ORDER ACCORDINGLY|DISMISSED WITH COSTS?|ALLOWED WITH COSTS?|APPEAL DISMISSED|APPEAL ALLOWED|SO ORDERED|JUDGMENT FOR|PLAINTIF MENDAPAT|DEFENDAN MENDAPAT)\b/i;

// Judicial signatures (case-insensitive — "Signed:" and "SIGNED:" are both valid)
const JUDICIAL_SIGNATURE_RE =
  /\b(?:SIGNED|SGD\.?|DITANDATANGANI|VERIFIED BY)\s*:?\s*[A-Za-z][A-Za-z .'-]+/i;

// Publisher dividers: repeated HR characters
const PUBLISHER_DIVIDER_RE = /^[\s]*(?:[-–—*]{5,}|={5,}|\*{5,}|_{5,})\s*$/m;

// Administrative material: indexes, cause lists, table of contents
const ADMIN_MATERIAL_RE =
  /\b(?:TABLE OF CONTENTS|CAUSE LIST|INDEX OF CASES|CONTENTS|SENARAI KES|ISI KANDUNGAN|JADUAL KANDUNGAN)\b/i;

// Publisher attribution: publisher name/address blocks
const PUBLISHER_ATTRIBUTION_RE =
  /\b(?:MALAYAN LAW JOURNAL|CLJ PUBLICATIONS|CURRENT LAW JOURNAL|LEXIS|SWEET & MAXWELL|BUTTERWORTHS?|ALL RIGHTS RESERVED|©\s*\d{4}|PRINTED BY|PUBLISHED BY|SDN\.?\s*BHD\.?)\b/i;

// Quotation context: text inside quotation marks (rough heuristic)
const QUOTATION_RE = /["'"'][^"'"']{10,}["'"']/;

// ── Helper utilities ───────────────────────────────────────────────────────

function snippet(text: string, match: RegExpMatchArray, radius = 80): string {
  const idx = match.index ?? 0;
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + (match[0]?.length ?? 0) + radius);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function isHeadingBlock(block: BlockInput): boolean {
  return (
    block.blockType === "heading" ||
    block.blockType === "header" ||
    block.blockType === "paragraph"
  );
}

// ── Core detection function ────────────────────────────────────────────────

/**
 * Detect all boundary signals in a set of pages and blocks.
 *
 * Pure function — no DB calls, no side effects.
 * Returns one DetectedSignal per matched signal instance.
 */
export function detectSignals(
  pages: PageInput[],
  blocks: BlockInput[],
): DetectedSignal[] {
  const signals: DetectedSignal[] = [];

  const blocksByPage = new Map<number, BlockInput[]>();
  for (const b of blocks) {
    const list = blocksByPage.get(b.pageId) ?? [];
    list.push(b);
    blocksByPage.set(b.pageId, list);
  }

  const sortedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  // Collect all cited titles across all pages for quotation anti-signal
  const allCitedTitles: string[] = [];
  for (const page of sortedPages) {
    const titleMatches = page.text.matchAll(new RegExp(NEUTRAL_CITATION_RE.source, "gi"));
    for (const m of titleMatches) {
      allCitedTitles.push(m[0].toLowerCase());
    }
  }

  let prevPageText = "";

  for (let pi = 0; pi < sortedPages.length; pi++) {
    const page = sortedPages[pi]!;
    const pageBlocks = blocksByPage.get(page.id) ?? [];
    const text = page.text;

    // ── 19. BLANK_DIVIDER_PAGE ─────────────────────────────────────────────
    if (page.isBlank || text.trim().length === 0) {
      signals.push({
        pageId: page.id,
        signalType: "BLANK_DIVIDER_PAGE",
        signalValue: "blank",
        supportingText: "(blank page)",
        scoreContribution: SIGNAL_SCORES.BLANK_DIVIDER_PAGE,
        processorVersion: SEGMENT_PROCESSOR_VERSION,
      });
      prevPageText = text;
      continue; // blank pages: no further signal detection meaningful
    }

    // ── 21. ADMINISTRATIVE_MATERIAL ────────────────────────────────────────
    const adminMatch = text.match(ADMIN_MATERIAL_RE);
    if (adminMatch) {
      signals.push({
        pageId: page.id,
        signalType: "ADMINISTRATIVE_MATERIAL",
        signalValue: adminMatch[0].trim(),
        supportingText: snippet(text, adminMatch),
        scoreContribution: SIGNAL_SCORES.ADMINISTRATIVE_MATERIAL,
        processorVersion: SEGMENT_PROCESSOR_VERSION,
      });
    }

    // ── 24. PUBLISHER_ATTRIBUTION ──────────────────────────────────────────
    const pubMatch = text.match(PUBLISHER_ATTRIBUTION_RE);
    if (pubMatch) {
      signals.push({
        pageId: page.id,
        signalType: "PUBLISHER_ATTRIBUTION",
        signalValue: pubMatch[0].trim(),
        supportingText: snippet(text, pubMatch),
        scoreContribution: SIGNAL_SCORES.PUBLISHER_ATTRIBUTION,
        processorVersion: SEGMENT_PROCESSOR_VERSION,
      });
    }

    // ── 3. NEUTRAL_CITATION ────────────────────────────────────────────────
    const neutralMatches = [...text.matchAll(new RegExp(NEUTRAL_CITATION_RE.source, "gi"))];
    for (const m of neutralMatches) {
      // Check if it's inside a quoted passage (anti-signal context)
      const surrounding = text.slice(
        Math.max(0, (m.index ?? 0) - 200),
        Math.min(text.length, (m.index ?? 0) + 200),
      );
      const inQuotation = QUOTATION_RE.test(surrounding);
      if (!inQuotation) {
        const matchBlock = pageBlocks.find((b) =>
          b.text.toLowerCase().includes(m[0].toLowerCase()),
        );
        signals.push({
          pageId: page.id,
          blockId: matchBlock?.id,
          signalType: "NEUTRAL_CITATION",
          signalValue: m[0].trim(),
          supportingText: snippet(text, m),
          scoreContribution: SIGNAL_SCORES.NEUTRAL_CITATION,
          processorVersion: SEGMENT_PROCESSOR_VERSION,
        });
      }
    }

    // ── 4. REPORT_CITATION ─────────────────────────────────────────────────
    const reportMatches = [...text.matchAll(new RegExp(REPORT_CITATION_RE.source, "gi"))];
    const seenReportCitations = new Set<string>();
    for (const m of reportMatches) {
      const key = m[0].trim().toLowerCase();
      if (seenReportCitations.has(key)) continue;
      seenReportCitations.add(key);
      const surrounding = text.slice(
        Math.max(0, (m.index ?? 0) - 200),
        Math.min(text.length, (m.index ?? 0) + 200),
      );
      const inQuotation = QUOTATION_RE.test(surrounding);
      if (!inQuotation) {
        const matchBlock = pageBlocks.find((b) =>
          b.text.toLowerCase().includes(m[0].toLowerCase()),
        );
        signals.push({
          pageId: page.id,
          blockId: matchBlock?.id,
          signalType: "REPORT_CITATION",
          signalValue: m[0].trim(),
          supportingText: snippet(text, m),
          scoreContribution: SIGNAL_SCORES.REPORT_CITATION,
          processorVersion: SEGMENT_PROCESSOR_VERSION,
        });
      }
    }

    // ── 2. NEW_PARTY_CONFIGURATION ─────────────────────────────────────────
    const partyMatch = text.match(PARTY_CONFIG_RE);
    if (partyMatch) {
      const surrounding = text.slice(
        Math.max(0, (partyMatch.index ?? 0) - 200),
        Math.min(text.length, (partyMatch.index ?? 0) + 200),
      );
      const inQuotation = QUOTATION_RE.test(surrounding);
      if (!inQuotation) {
        const matchBlock = pageBlocks.find((b) =>
          b.text.includes(partyMatch[0]),
        );
        signals.push({
          pageId: page.id,
          blockId: matchBlock?.id,
          signalType: "NEW_PARTY_CONFIGURATION",
          signalValue: partyMatch[0].trim(),
          supportingText: snippet(text, partyMatch),
          scoreContribution: SIGNAL_SCORES.NEW_PARTY_CONFIGURATION,
          processorVersion: SEGMENT_PROCESSOR_VERSION,
        });
      }
    }

    // ── 1. NEW_CASE_TITLE ──────────────────────────────────────────────────
    for (const block of pageBlocks) {
      if (!isHeadingBlock(block)) continue;
      const btMatch = block.text.match(CASE_TITLE_RE);
      if (btMatch) {
        signals.push({
          pageId: page.id,
          blockId: block.id,
          signalType: "NEW_CASE_TITLE",
          signalValue: btMatch[0].trim().slice(0, 120),
          supportingText: block.text.slice(0, 200),
          scoreContribution: SIGNAL_SCORES.NEW_CASE_TITLE,
          processorVersion: SEGMENT_PROCESSOR_VERSION,
        });
      }
    }

    // ── 5. COURT_HEADING ───────────────────────────────────────────────────
    const courtMatch = text.match(COURT_HEADING_RE);
    if (courtMatch) {
      const matchBlock = pageBlocks.find((b) =>
        b.text.match(COURT_HEADING_RE),
      );
      signals.push({
        pageId: page.id,
        blockId: matchBlock?.id,
        signalType: "COURT_HEADING",
        signalValue: courtMatch[0].trim(),
        supportingText: snippet(text, courtMatch),
        scoreContribution: SIGNAL_SCORES.COURT_HEADING,
        processorVersion: SEGMENT_PROCESSOR_VERSION,
      });
    }

    // ── 6. PROCEEDING_NUMBER ───────────────────────────────────────────────
    const procMatch = text.match(PROCEEDING_NUMBER_RE);
    if (procMatch) {
      const matchBlock = pageBlocks.find((b) =>
        b.text.match(PROCEEDING_NUMBER_RE),
      );
      signals.push({
        pageId: page.id,
        blockId: matchBlock?.id,
        signalType: "PROCEEDING_NUMBER",
        signalValue: procMatch[0].trim(),
        supportingText: snippet(text, procMatch),
        scoreContribution: SIGNAL_SCORES.PROCEEDING_NUMBER,
        processorVersion: SEGMENT_PROCESSOR_VERSION,
      });
    }

    // ── 7. CORAM_HEADING ───────────────────────────────────────────────────
    const coramMatch = text.match(CORAM_HEADING_RE);
    if (coramMatch) {
      const matchBlock = pageBlocks.find((b) =>
        b.text.match(CORAM_HEADING_RE),
      );
      signals.push({
        pageId: page.id,
        blockId: matchBlock?.id,
        signalType: "CORAM_HEADING",
        signalValue: "Coram",
        supportingText: snippet(text, coramMatch),
        scoreContribution: SIGNAL_SCORES.CORAM_HEADING,
        processorVersion: SEGMENT_PROCESSOR_VERSION,
      });
    }

    // ── 8. JUDGE_HEADING ───────────────────────────────────────────────────
    const judgeMatch = text.match(JUDGE_HEADING_RE);
    if (judgeMatch) {
      const matchBlock = pageBlocks.find((b) =>
        b.text.match(JUDGE_HEADING_RE),
      );
      signals.push({
        pageId: page.id,
        blockId: matchBlock?.id,
        signalType: "JUDGE_HEADING",
        signalValue: judgeMatch[0].trim(),
        supportingText: snippet(text, judgeMatch),
        scoreContribution: SIGNAL_SCORES.JUDGE_HEADING,
        processorVersion: SEGMENT_PROCESSOR_VERSION,
      });
    }

    // ── 9. DECISION_DATE ───────────────────────────────────────────────────
    const dateMatches = [...text.matchAll(new RegExp(DATE_RE.source, "gi"))];
    if (dateMatches.length > 0) {
      const firstDate = dateMatches[0]!;
      signals.push({
        pageId: page.id,
        signalType: "DECISION_DATE",
        signalValue: firstDate[0].trim(),
        supportingText: snippet(text, firstDate),
        scoreContribution: SIGNAL_SCORES.DECISION_DATE,
        processorVersion: SEGMENT_PROCESSOR_VERSION,
      });
    }

    // ── 10. JUDGMENT_HEADING ───────────────────────────────────────────────
    const judgMatch = text.match(JUDGMENT_HEADING_RE);
    if (judgMatch) {
      const matchBlock = pageBlocks.find((b) =>
        b.text.match(JUDGMENT_HEADING_RE),
      );
      signals.push({
        pageId: page.id,
        blockId: matchBlock?.id,
        signalType: "JUDGMENT_HEADING",
        signalValue: judgMatch[0].trim(),
        supportingText: snippet(text, judgMatch),
        scoreContribution: SIGNAL_SCORES.JUDGMENT_HEADING,
        processorVersion: SEGMENT_PROCESSOR_VERSION,
      });
    }

    // ── 11. PARAGRAPH_RESET ────────────────────────────────────────────────
    // Only fire when page number is > 1 (first page trivially has para 1)
    if (page.pageNumber > 1) {
      const paraMatch = text.match(PARA_RESET_RE);
      if (paraMatch) {
        signals.push({
          pageId: page.id,
          signalType: "PARAGRAPH_RESET",
          signalValue: paraMatch[0].trim(),
          supportingText: snippet(text, paraMatch),
          scoreContribution: SIGNAL_SCORES.PARAGRAPH_RESET,
          processorVersion: SEGMENT_PROCESSOR_VERSION,
        });
      }
    }

    // ── 12. PAGE_NUMBER_RESTART ────────────────────────────────────────────
    if (page.pageNumber > 1) {
      const pnMatch = text.match(PAGE_NUMBER_RESTART_RE);
      if (pnMatch) {
        signals.push({
          pageId: page.id,
          signalType: "PAGE_NUMBER_RESTART",
          signalValue: pnMatch[0].trim(),
          supportingText: snippet(text, pnMatch),
          scoreContribution: SIGNAL_SCORES.PAGE_NUMBER_RESTART,
          processorVersion: SEGMENT_PROCESSOR_VERSION,
        });
      }
    }

    // ── 13. CLOSING_ORDER ─────────────────────────────────────────────────
    const closingMatch = text.match(CLOSING_ORDER_RE);
    if (closingMatch) {
      const matchBlock = pageBlocks.find((b) =>
        b.text.match(CLOSING_ORDER_RE),
      );
      signals.push({
        pageId: page.id,
        blockId: matchBlock?.id,
        signalType: "CLOSING_ORDER",
        signalValue: closingMatch[0].trim(),
        supportingText: snippet(text, closingMatch),
        scoreContribution: SIGNAL_SCORES.CLOSING_ORDER,
        processorVersion: SEGMENT_PROCESSOR_VERSION,
      });
    }

    // ── 14. JUDICIAL_SIGNATURE ─────────────────────────────────────────────
    const sigMatch = text.match(JUDICIAL_SIGNATURE_RE);
    if (sigMatch) {
      signals.push({
        pageId: page.id,
        signalType: "JUDICIAL_SIGNATURE",
        signalValue: sigMatch[0].trim(),
        supportingText: snippet(text, sigMatch),
        scoreContribution: SIGNAL_SCORES.JUDICIAL_SIGNATURE,
        processorVersion: SEGMENT_PROCESSOR_VERSION,
      });
    }

    // ── 18. PUBLISHER_DIVIDER ──────────────────────────────────────────────
    const dividerMatch = text.match(PUBLISHER_DIVIDER_RE);
    if (dividerMatch) {
      signals.push({
        pageId: page.id,
        signalType: "PUBLISHER_DIVIDER",
        signalValue: dividerMatch[0].trim(),
        supportingText: snippet(text, dividerMatch),
        scoreContribution: SIGNAL_SCORES.PUBLISHER_DIVIDER,
        processorVersion: SEGMENT_PROCESSOR_VERSION,
      });
    }

    // ── 23. MULTI_PAGE_GAP ─────────────────────────────────────────────────
    if (pi > 0 && sortedPages[pi - 1]) {
      const prevPageNum = sortedPages[pi - 1]!.pageNumber;
      const gap = page.pageNumber - prevPageNum;
      if (gap >= 3) {
        signals.push({
          pageId: page.id,
          signalType: "MULTI_PAGE_GAP",
          signalValue: `gap:${gap}`,
          supportingText: `Page number jumped from ${prevPageNum} to ${page.pageNumber} (gap of ${gap})`,
          scoreContribution: SIGNAL_SCORES.MULTI_PAGE_GAP,
          processorVersion: SEGMENT_PROCESSOR_VERSION,
        });
      }
    }

    // ── 17. TYPOGRAPHY_CHANGE ──────────────────────────────────────────────
    // Detect from block font metadata differences between blocks on this page
    if (pageBlocks.length >= 2) {
      const headingBlock = pageBlocks.find((b) => b.blockType === "heading");
      const paragraphBlock = pageBlocks.find((b) => b.blockType === "paragraph");
      if (
        headingBlock?.font &&
        paragraphBlock?.font &&
        (headingBlock.font["size"] !== paragraphBlock.font["size"] ||
          headingBlock.font["bold"] !== paragraphBlock.font["bold"])
      ) {
        signals.push({
          pageId: page.id,
          blockId: headingBlock.id,
          signalType: "TYPOGRAPHY_CHANGE",
          signalValue: `heading-size:${headingBlock.font["size"]}`,
          supportingText: headingBlock.text.slice(0, 100),
          scoreContribution: SIGNAL_SCORES.TYPOGRAPHY_CHANGE,
          processorVersion: SEGMENT_PROCESSOR_VERSION,
        });
      }
    }

    // ── 15. ABRUPT_METADATA_CHANGE ─────────────────────────────────────────
    // Detect sharp changes in year or court between adjacent pages
    if (prevPageText) {
      const prevYear = prevPageText.match(/\[(\d{4})\]/)?.[1];
      const curYear = text.match(/\[(\d{4})\]/)?.[1];
      if (prevYear && curYear && prevYear !== curYear) {
        signals.push({
          pageId: page.id,
          signalType: "ABRUPT_METADATA_CHANGE",
          signalValue: `year:${prevYear}->${curYear}`,
          supportingText: `Year changed from [${prevYear}] to [${curYear}] across page boundary`,
          scoreContribution: SIGNAL_SCORES.ABRUPT_METADATA_CHANGE,
          processorVersion: SEGMENT_PROCESSOR_VERSION,
        });
      }
      const prevCourt = prevPageText.match(COURT_HEADING_RE)?.[0];
      const curCourt = text.match(COURT_HEADING_RE)?.[0];
      if (
        prevCourt &&
        curCourt &&
        prevCourt.trim().toLowerCase() !== curCourt.trim().toLowerCase()
      ) {
        signals.push({
          pageId: page.id,
          signalType: "ABRUPT_METADATA_CHANGE",
          signalValue: `court:change`,
          supportingText: `Court changed from "${prevCourt.trim()}" to "${curCourt.trim()}"`,
          scoreContribution: SIGNAL_SCORES.ABRUPT_METADATA_CHANGE,
          processorVersion: SEGMENT_PROCESSOR_VERSION,
        });
      }
    }

    // ── 16. ABRUPT_SEMANTIC_CHANGE ─────────────────────────────────────────
    // Simple heuristic: very different vocabulary (non-overlapping word sets)
    if (prevPageText && prevPageText.trim().length > 50 && text.trim().length > 50) {
      const prevWords = new Set(
        prevPageText.toLowerCase().match(/\b\w{4,}\b/g) ?? [],
      );
      const curWords = (text.toLowerCase().match(/\b\w{4,}\b/g) ?? []);
      const overlap = curWords.filter((w) => prevWords.has(w)).length;
      const total = curWords.length;
      if (total > 10 && overlap / total < 0.08) {
        signals.push({
          pageId: page.id,
          signalType: "ABRUPT_SEMANTIC_CHANGE",
          signalValue: `overlap:${Math.round((overlap / total) * 100)}%`,
          supportingText: `Low word overlap (${overlap}/${total}) with previous page`,
          scoreContribution: SIGNAL_SCORES.ABRUPT_SEMANTIC_CHANGE,
          processorVersion: SEGMENT_PROCESSOR_VERSION,
        });
      }
    }

    // ── 20. REPEATED_TITLE_IN_QUOTATION ───────────────────────────────────
    // If this page cites a case title that also appears as a signal on another
    // page, it's an anti-signal (case title used in body text, not as a heading)
    for (const citedTitle of allCitedTitles) {
      if (
        citedTitle.length > 5 &&
        text.toLowerCase().includes(citedTitle) &&
        neutralMatches.some(
          (m) => m[0].toLowerCase() === citedTitle,
        )
      ) {
        // Check if THIS specific title appears inside a quotation context.
        // Use a targeted regex anchored to the title itself — the broad
        // QUOTATION_RE.test(surrounding) is intentionally NOT used here because
        // the ±200-char window can contain unrelated quoted strings from other
        // parts of the page, causing false positives (e.g. the canonical citation
        // of this case appearing near a quoted body-text citation of another case).
        const idx = text.toLowerCase().indexOf(citedTitle);
        const surrounding = text.slice(
          Math.max(0, idx - 200),
          Math.min(text.length, idx + citedTitle.length + 200),
        );
        const escapedTitle = citedTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const titleInQuotesRE = new RegExp(
          `["'"'][^"'"']{0,200}${escapedTitle}[^"'"']{0,200}["'"']`,
          "i",
        );
        if (titleInQuotesRE.test(surrounding)) {
          const fakeMatch = { 0: citedTitle, index: idx } as unknown as RegExpMatchArray;
          signals.push({
            pageId: page.id,
            signalType: "REPEATED_TITLE_IN_QUOTATION",
            signalValue: citedTitle,
            supportingText: snippet(text, fakeMatch),
            scoreContribution: SIGNAL_SCORES.REPEATED_TITLE_IN_QUOTATION,
            processorVersion: SEGMENT_PROCESSOR_VERSION,
          });
        }
      }
    }

    prevPageText = text;
  }

  // ── 22. INCOMPLETE_CASE_END ────────────────────────────────────────────
  // Fire on the last page if it has no closing order or judicial signature
  if (sortedPages.length > 0) {
    const lastPage = sortedPages[sortedPages.length - 1]!;
    if (lastPage.text.trim().length > 0) {
      const hasClosing = CLOSING_ORDER_RE.test(lastPage.text);
      const hasSig = JUDICIAL_SIGNATURE_RE.test(lastPage.text);
      if (!hasClosing && !hasSig) {
        signals.push({
          pageId: lastPage.id,
          signalType: "INCOMPLETE_CASE_END",
          signalValue: "no-closing",
          supportingText: "Last page has no closing order or judicial signature",
          scoreContribution: SIGNAL_SCORES.INCOMPLETE_CASE_END,
          processorVersion: SEGMENT_PROCESSOR_VERSION,
        });
      }
    }
  }

  // De-duplicate signals: keep the first occurrence of each
  // (run_id, page_id, signal_type, signal_value) combination.
  const seen = new Set<string>();
  const deduped: DetectedSignal[] = [];
  for (const s of signals) {
    const key = `${s.pageId}|${s.signalType}|${s.signalValue}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(s);
    }
  }
  return deduped;
}
