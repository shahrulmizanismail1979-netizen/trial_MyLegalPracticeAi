// Phase 07 — Section Classifier (ADR 0008).
//
// Pure function — no database calls. Classifies blocks within a page into
// one of seven categories (VERIFIED_JUDICIAL_TEXT … MANUAL_REVIEW_REQUIRED).
//
// SAFEGUARD (mandatory): a section must NOT be classified as
// SUSPECTED_PUBLISHER_EDITORIAL solely because it:
//   - appears before the word "Judgment"
//   - contains a summary
//   - contains catchword-like wording
//   - appears as a footnote
//   - uses bold headings
// Each feature requires at least one corroborating publisher-attribution signal.

export const EDITORIAL_PROCESSOR_VERSION = "container.editorial_classify@1";

export const SECTION_CLASSIFICATIONS = [
  "VERIFIED_JUDICIAL_TEXT",
  "PROBABLE_JUDICIAL_TEXT",
  "SUSPECTED_PUBLISHER_EDITORIAL",
  "ADMINISTRATIVE_METADATA",
  "SOURCE_ARTIFACT",
  "UNKNOWN",
  "MANUAL_REVIEW_REQUIRED",
] as const;
export type SectionClassificationType = (typeof SECTION_CLASSIFICATIONS)[number];

export interface PageInput {
  id: number;
  pageNumber: number;
  text: string;
  isBlank?: boolean;
}

export interface BlockInput {
  id: number;
  pageId: number;
  blockIndex: number;
  text: string;
  blockType: string;
  font?: Record<string, unknown> | null;
}

export interface ClassifiedSection {
  pageId: number;
  blockId?: number;
  sectionIndex: number;
  spanStartChar?: number;
  spanEndChar?: number;
  classification: SectionClassificationType;
  confidence: number;
  supportingEvidence: string[];
  detectorVersion: string;
}

// ── Pattern constants ──────────────────────────────────────────────────────

// Publisher branding — corroborating evidence for editorial exclusion
const PUBLISHER_BRANDING_RE =
  /\b(?:MALAYAN LAW JOURNAL|CLJ PUBLICATIONS|CURRENT LAW JOURNAL|LEXIS(?:NEXIS)?|SWEET\s*&\s*MAXWELL|BUTTERWORTHS?|©\s*\d{4}|ISBN[-\s]?\d|ISSN[-\s]?\d|ALL RIGHTS RESERVED|PRINTED BY|PUBLISHED BY|SDN\.?\s*BHD\.?\s+\(PENERBIT\)|Kuala Lumpur Law Journal|Legal Network Series)\b/i;

// Explicit editorial vocabulary (unambiguous in court-document context)
const PUBLISHER_EDITORIAL_VOCAB_RE =
  /\b(?:HEADNOTES?|EDITORIAL\s+(?:NOTE|COMMENT|INTRODUCTION)|PUBLISHER['']?S?\s+SUMMARY|CATCHWORDS?:|KEY TERMS?:|REPORTED BY|WRITTEN\s+BY|ANNOTATIONS?:|COMMENTARY(?:\s+BY)?:)\b/i;

// Administrative material — tables of contents, cause lists
const ADMIN_MATERIAL_RE =
  /\b(?:TABLE\s+OF\s+CONTENTS|CAUSE\s+LIST|INDEX\s+OF\s+CASES|CONTENTS|SENARAI\s+KES|ISI\s+KANDUNGAN|JADUAL\s+KANDUNGAN)\b/i;

// Source/cover artifact patterns
const SOURCE_ARTIFACT_RE =
  /\b(?:ANNUAL\s+DIGEST|BOUND\s+VOLUME|CUMULATIVE\s+INDEX|GENERAL\s+INDEX|SUPPLEMENT|ERRATA|CORRIGENDA)\b/i;

// Judicial anchor signals — strong indicators of court-issued text
const COURT_HEADING_RE =
  /\b(?:FEDERAL\s+COURT|COURT\s+OF\s+APPEAL|HIGH\s+COURT|SESSIONS\s+COURT|MAGISTRATES?\s+COURT|MAHKAMAH\s+PERSEKUTUAN|MAHKAMAH\s+RAYUAN|MAHKAMAH\s+TINGGI|MAHKAMAH\s+SESYEN|MAHKAMAH\s+MAJISTRET|SYARIAH|INDUSTRIAL\s+COURT)\b/i;

const CORAM_RE = /\b(?:CORAM\s*:|PRESIDED\s+BY\s*:|BEFORE\s*:)\s*/i;

const JUDGMENT_HEADING_RE =
  /^[\s*]*(?:JUDGMENT|PENGHAKIMAN|GROUNDS\s+OF\s+JUDGMENT|GROUNDS\s+OF\s+DECISION|AWARD|ALASAN\s+PENGHAKIMAN|ALASAN\s+KEPUTUSAN|RULING)\s*[:\s]*$/im;

const CLOSING_ORDER_RE =
  /\b(?:IT\s+IS\s+HEREBY\s+ORDERED|IT\s+IS\s+ORDERED|DIPERINTAHKAN|ORDER\s+ACCORDINGLY|DISMISSED\s+WITH\s+COSTS?|ALLOWED\s+WITH\s+COSTS?|APPEAL\s+DISMISSED|APPEAL\s+ALLOWED|SO\s+ORDERED|JUDGMENT\s+FOR|PLAINTIF\s+MENDAPAT|DEFENDAN\s+MENDAPAT)\b/i;

const JUDICIAL_SIGNATURE_RE =
  /\b(?:SIGNED|SGD\.?|DITANDATANGANI|VERIFIED\s+BY)\s*:?\s*[A-Za-z][A-Za-z .'-]+/i;

const PROCEEDING_NUMBER_RE =
  /\b(?:GUAMAN\s+SIVIL|SAMAN\s+PEMULA|KES\s+NO\.?|CIVIL\s+SUIT|CIVIL\s+APPEAL|CRIMINAL\s+APPEAL|RAYUAN\s+SIVIL|RAYUAN\s+JENAYAH|PERMOHONAN|JUDICIAL\s+REVIEW)\b/i;

// Numbered paragraph: [1] or "1." at line start
const PARA_SEQUENCE_RE = /^\s*(?:\[\d+\]|\d+\.)\s+\S/m;

// Page-spanning repeated header/footer: very short block repeated across pages
const MAX_HEADER_FOOTER_LEN = 120;

// Confidence thresholds
const HIGH_CONFIDENCE = 0.85;
const LOW_CONFIDENCE = 0.45;

// ── Signal scoring helpers ─────────────────────────────────────────────────

function hasPublisherBranding(text: string): string | null {
  const m = text.match(PUBLISHER_BRANDING_RE);
  return m ? m[0] : null;
}

function hasEditorialVocab(text: string): string | null {
  const m = text.match(PUBLISHER_EDITORIAL_VOCAB_RE);
  return m ? m[0] : null;
}

function hasJudicialAnchor(text: string): boolean {
  return (
    COURT_HEADING_RE.test(text) ||
    CORAM_RE.test(text) ||
    JUDGMENT_HEADING_RE.test(text) ||
    CLOSING_ORDER_RE.test(text) ||
    JUDICIAL_SIGNATURE_RE.test(text) ||
    PROCEEDING_NUMBER_RE.test(text)
  );
}

function hasParaContinuity(text: string): boolean {
  return PARA_SEQUENCE_RE.test(text);
}

// ── Per-block classifier ───────────────────────────────────────────────────

interface BlockClassification {
  classification: SectionClassificationType;
  confidence: number;
  evidence: string[];
}

function classifyBlock(
  block: BlockInput,
  pageNumber: number,
  totalPages: number,
  repeatedTexts: Set<string>,
): BlockClassification {
  const text = block.text.trim();
  if (!text) {
    return { classification: "UNKNOWN", confidence: 0.5, evidence: ["empty block"] };
  }

  const evidence: string[] = [];

  // ── Administrative material (high confidence, no corroboration needed) ──
  if (ADMIN_MATERIAL_RE.test(text)) {
    evidence.push(`admin pattern: ${text.slice(0, 60)}`);
    return { classification: "ADMINISTRATIVE_METADATA", confidence: 0.9, evidence };
  }

  // ── Source artifact ──────────────────────────────────────────────────────
  if (SOURCE_ARTIFACT_RE.test(text)) {
    evidence.push(`source artifact pattern: ${text.slice(0, 60)}`);
    return { classification: "SOURCE_ARTIFACT", confidence: 0.85, evidence };
  }

  // ── Judicial anchors — classify as VERIFIED_JUDICIAL_TEXT ───────────────
  if (JUDGMENT_HEADING_RE.test(text)) {
    evidence.push("judgment heading");
    return { classification: "VERIFIED_JUDICIAL_TEXT", confidence: 0.95, evidence };
  }
  if (CLOSING_ORDER_RE.test(text)) {
    evidence.push("closing order language");
    return { classification: "VERIFIED_JUDICIAL_TEXT", confidence: 0.95, evidence };
  }
  if (JUDICIAL_SIGNATURE_RE.test(text)) {
    evidence.push("judicial signature block");
    return { classification: "VERIFIED_JUDICIAL_TEXT", confidence: 0.9, evidence };
  }
  if (CORAM_RE.test(text)) {
    evidence.push("coram heading");
    return { classification: "VERIFIED_JUDICIAL_TEXT", confidence: 0.9, evidence };
  }
  if (COURT_HEADING_RE.test(text) && !PUBLISHER_BRANDING_RE.test(text)) {
    evidence.push("court heading");
    return { classification: "VERIFIED_JUDICIAL_TEXT", confidence: 0.9, evidence };
  }
  if (PROCEEDING_NUMBER_RE.test(text)) {
    evidence.push("proceeding number");
    return { classification: "VERIFIED_JUDICIAL_TEXT", confidence: 0.85, evidence };
  }
  if (hasParaContinuity(text) && text.length > 80) {
    evidence.push("numbered paragraph continuity");
    return { classification: "VERIFIED_JUDICIAL_TEXT", confidence: 0.82, evidence };
  }

  // ── Publisher-editorial classification (requires corroboration) ──────────
  //
  // SAFEGUARD: the following features alone do NOT produce
  // SUSPECTED_PUBLISHER_EDITORIAL — they need a corroborating branding signal:
  //   - position before "Judgment" heading (any page could precede it)
  //   - summary-like content
  //   - catchword-like wording
  //   - footnote position (small font / superscript)
  //   - bold headings
  //
  // Only branding markers or explicit editorial vocabulary are corroborators.

  const brandingMatch = hasPublisherBranding(text);
  const editorialVocabMatch = hasEditorialVocab(text);

  const hasCorroborator = brandingMatch !== null || editorialVocabMatch !== null;

  if (brandingMatch) evidence.push(`publisher branding: "${brandingMatch}"`);
  if (editorialVocabMatch) evidence.push(`editorial vocabulary: "${editorialVocabMatch}"`);

  // Repeated header/footer text across pages is a weak signal; only combine
  // with corroborator for a confident exclusion.
  const isRepeatedHeaderFooter =
    text.length <= MAX_HEADER_FOOTER_LEN && repeatedTexts.has(normalizeSpace(text));
  if (isRepeatedHeaderFooter) evidence.push("repeated header/footer across pages");

  if (hasCorroborator) {
    // Strong corroborator present: classify as editorial
    const confidence = isRepeatedHeaderFooter ? 0.92 : HIGH_CONFIDENCE;
    return {
      classification: "SUSPECTED_PUBLISHER_EDITORIAL",
      confidence,
      evidence,
    };
  }

  if (isRepeatedHeaderFooter) {
    // Repeated short text without branding: possible running header, could be
    // the case title. Route to manual review.
    evidence.push("repeated short text — insufficient signals without branding");
    return { classification: "MANUAL_REVIEW_REQUIRED", confidence: 0.5, evidence };
  }

  // ── Font-change indicator (layout signal) ─────────────────────────────
  // Bold/italic without branding → not enough to exclude; keep as PROBABLE.
  const isBoldOrHeading =
    block.blockType === "heading" ||
    (block.font != null && (block.font["bold"] === true || block.font["size"] !== undefined));

  if (isBoldOrHeading) {
    evidence.push("bold/heading block — safeguard: not sufficient alone for editorial exclusion");
  }

  // ── Default: PROBABLE_JUDICIAL_TEXT unless nothing suggests judicial content
  if (text.length < 20) {
    return { classification: "UNKNOWN", confidence: 0.5, evidence: ["very short block"] };
  }

  return {
    classification: "PROBABLE_JUDICIAL_TEXT",
    confidence: 0.65,
    evidence: evidence.length ? evidence : ["default — no strong exclusion signal"],
  };
}

function normalizeSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

// ── Multi-page repeated-text detection ────────────────────────────────────

function findRepeatedTexts(pages: PageInput[], blocks: BlockInput[]): Set<string> {
  const byPage = new Map<number, string[]>();
  for (const b of blocks) {
    const t = b.text.trim();
    if (t.length > 0 && t.length <= MAX_HEADER_FOOTER_LEN) {
      const list = byPage.get(b.pageId) ?? [];
      list.push(normalizeSpace(t));
      byPage.set(b.pageId, list);
    }
  }
  const textPageCount = new Map<string, number>();
  for (const [, texts] of byPage) {
    for (const t of new Set(texts)) {
      textPageCount.set(t, (textPageCount.get(t) ?? 0) + 1);
    }
  }
  const totalPages = pages.length;
  const threshold = Math.max(2, Math.floor(totalPages * 0.3));
  const repeated = new Set<string>();
  for (const [t, count] of textPageCount) {
    if (count >= threshold) repeated.add(t);
  }
  return repeated;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Classify all sections (blocks) in the given pages.
 *
 * Pure function — no DB calls, no side effects.
 */
export function classifySections(
  pages: PageInput[],
  blocks: BlockInput[],
): ClassifiedSection[] {
  const totalPages = pages.length;
  const repeatedTexts = findRepeatedTexts(pages, blocks);

  const blocksByPage = new Map<number, BlockInput[]>();
  for (const b of blocks) {
    const list = blocksByPage.get(b.pageId) ?? [];
    list.push(b);
    blocksByPage.set(b.pageId, list);
  }

  const results: ClassifiedSection[] = [];

  for (const page of [...pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
    const pageBlocks = (blocksByPage.get(page.id) ?? []).sort(
      (a, b) => a.blockIndex - b.blockIndex,
    );

    if (page.isBlank || page.text.trim().length === 0) {
      // Blank pages are SOURCE_ARTIFACT (not judicial content, not editorial)
      results.push({
        pageId: page.id,
        sectionIndex: 0,
        classification: "SOURCE_ARTIFACT",
        confidence: 0.95,
        supportingEvidence: ["blank page"],
        detectorVersion: EDITORIAL_PROCESSOR_VERSION,
      });
      continue;
    }

    if (pageBlocks.length === 0) {
      // No block data — classify whole page from raw text
      const syntheticBlock: BlockInput = {
        id: 0,
        pageId: page.id,
        blockIndex: 0,
        text: page.text,
        blockType: "paragraph",
        font: null,
      };
      const cls = classifyBlock(syntheticBlock, page.pageNumber, totalPages, repeatedTexts);
      results.push({
        pageId: page.id,
        sectionIndex: 0,
        classification: cls.classification,
        confidence: cls.confidence,
        supportingEvidence: cls.evidence,
        detectorVersion: EDITORIAL_PROCESSOR_VERSION,
      });
      continue;
    }

    for (let i = 0; i < pageBlocks.length; i++) {
      const block = pageBlocks[i]!;
      const cls = classifyBlock(block, page.pageNumber, totalPages, repeatedTexts);
      results.push({
        pageId: page.id,
        blockId: block.id,
        sectionIndex: i,
        classification: cls.classification,
        confidence: cls.confidence,
        supportingEvidence: cls.evidence,
        detectorVersion: EDITORIAL_PROCESSOR_VERSION,
      });
    }
  }

  return results;
}

/**
 * Derive the overall page classification from its block-level sections.
 * Returns the classification that covers the most of the page, biased toward
 * judicial text when evidence is balanced.
 */
export function resolvePageClassification(
  sections: ClassifiedSection[],
): SectionClassificationType {
  const counts: Partial<Record<SectionClassificationType, number>> = {};
  for (const s of sections) {
    counts[s.classification] = (counts[s.classification] ?? 0) + 1;
  }
  // Priority order: MANUAL_REVIEW_REQUIRED > SUSPECTED_PUBLISHER_EDITORIAL >
  // VERIFIED_JUDICIAL_TEXT > PROBABLE_JUDICIAL_TEXT > rest
  if (counts["MANUAL_REVIEW_REQUIRED"]) return "MANUAL_REVIEW_REQUIRED";
  if (counts["SUSPECTED_PUBLISHER_EDITORIAL"] && !counts["VERIFIED_JUDICIAL_TEXT"] && !counts["PROBABLE_JUDICIAL_TEXT"]) {
    return "SUSPECTED_PUBLISHER_EDITORIAL";
  }
  if (counts["VERIFIED_JUDICIAL_TEXT"]) return "VERIFIED_JUDICIAL_TEXT";
  if (counts["PROBABLE_JUDICIAL_TEXT"]) return "PROBABLE_JUDICIAL_TEXT";
  if (counts["SUSPECTED_PUBLISHER_EDITORIAL"]) return "SUSPECTED_PUBLISHER_EDITORIAL";
  if (counts["ADMINISTRATIVE_METADATA"]) return "ADMINISTRATIVE_METADATA";
  if (counts["SOURCE_ARTIFACT"]) return "SOURCE_ARTIFACT";
  return "UNKNOWN";
}

export { LOW_CONFIDENCE };
