// Case metadata extractor (Phase 08, ADR 0009).
// Pure functions — no DB, no I/O, fully testable.
// Extracts 13 structured fields from ordered page texts with provenance.

import type { MetadataFieldName, MetadataMethod } from "@workspace/db";

export interface PageText {
  id: number;
  pageNumber: number;
  text: string;
}

export interface MetadataSourceRef {
  pageId: number;
  charStart: number;
  charEnd: number;
}

export interface ExtractedField {
  fieldName: MetadataFieldName;
  value: string | string[] | null;
  sourceRef: MetadataSourceRef | null;
  confidence: number;
  method: MetadataMethod;
}

export const METADATA_EXTRACTOR_VERSION = "metadata_extract@2";

// ── Regex patterns ─────────────────────────────────────────────────────────

const COURT_PATTERNS = [
  /IN\s+THE\s+(FEDERAL\s+COURT|COURT\s+OF\s+APPEAL|HIGH\s+COURT(?:\s+OF\s+MALAYA)?(?:\s+AT\s+[\w\s]+)?|SESSIONS?\s+COURT|MAGISTRATES?\s+COURT|SYARIAH\s+(?:HIGH\s+)?COURT|SPECIAL\s+COURT)\b/i,
  /MAHKAMAH\s+(PERSEKUTUAN|RAYUAN|TINGGI|SESYEN|MAJISTRET|SYARIAH)\b/i,
];

const PROCEEDING_PATTERNS = [
  /(?:CIVIL\s+SUIT|ORIGINATING\s+SUMMONS?|CRIMINAL\s+CASE|CIVIL\s+APPEAL|CRIMINAL\s+APPEAL|JUDICIAL\s+REVIEW|PETITION)\s+(?:NO\.?|NUMBER)?\s*:?\s*([\w\s\-\/]+\d[\w\s\-\/]*)/i,
  /(?:SUIT|CASE|APPEAL|SUMMONS?|PETITION)\s+NO\.?\s*:?\s*([\w\s\-\/]+\d[\w\s\-\/]*)/i,
  /\b([A-Z]{1,4}-\d{2}-\d+[-\/]\d{4})\b/,
  /\b(\d{2}[A-Z]{1,3}-\d+-\d{4})\b/,
];

const NEUTRAL_CITATION_PATTERNS = [
  /\[(\d{4})\]\s+(\d+\s+)?(?:MLJU|MLRHU|CLJ|MLJ|AMR|ILR)\s+\d+/gi,
  /\[(\d{4})\]\s+(?:FC|CA|HC|MY)\s+\d+/gi,
];

const REPORT_CITATION_PATTERNS = [
  /\[(\d{4})\]\s+(?:\d+\s+)?(?:CLJ|MLJ|AMR|ILR|All ER|UKHL|AC|QB|Ch)\s+\d+/gi,
];

const JUDGE_PATTERNS = [
  /CORAM\s*:\s*([^\n]{3,120})/i,
  /(?:JUDGE|JUSTICE|J\.?A?\.?|J\.?C\.?A\.?|FCJ|HH?J|DATUK|TAN\s+SRI|DATO['']\s+(?:SRI\s+)?)[\s:]+([A-Z][A-Za-z\s.'-]{3,80})/,
];

const HEARING_DATE_PATTERNS = [
  /(?:Heard|Argued|Hearing\s+date)\s*:\s*([0-9]{1,2}[\s\-\/][A-Za-z0-9\s,]+?\d{4})/i,
  /(?:Heard\s+on|Arguments\s+heard)\s*:\s*([0-9]{1,2}[\s\-\/][A-Za-z]+[\s,]+\d{4})/i,
];

const DECISION_DATE_PATTERNS = [
  /(?:Date\s+of\s+(?:judgment|decision)|Decided|Judgment\s+date)\s*:\s*([0-9]{1,2}[\s\-\/][A-Za-z0-9\s,]+?\d{4})/i,
  /(?:Decision\s+date)\s*:\s*([0-9]{1,2}[\s\-\/][A-Za-z]+[\s,]+\d{4})/i,
  /Dated\s+(?:this)?\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+day\s+of\s+[A-Za-z]+\s+\d{4})/i,
];

const PARTY_PATTERN =
  /^([A-Z][A-Z\s&.,()'-]{2,80})\s*(?:v\.?|versus)\s*([A-Z][A-Z\s&.,()'-]{2,80})$/m;

const LANGUAGE_INDICATORS = {
  malay: [/\b(?:plaintiff|defendan|mahkamah|rayuan|guaman)\b/i],
  english: [/\b(?:plaintiff|defendant|court|judgment|appeal)\b/i],
};

// ── Helper utilities ────────────────────────────────────────────────────────

function findInPages(
  pages: PageText[],
  pattern: RegExp,
  limit = 5,
): Array<{ match: RegExpMatchArray; pageId: number; charStart: number; charEnd: number }> {
  const results: Array<{ match: RegExpMatchArray; pageId: number; charStart: number; charEnd: number }> = [];
  for (const page of pages.slice(0, limit)) {
    const m = page.text.match(pattern);
    if (m && m.index !== undefined) {
      results.push({
        match: m,
        pageId: page.id,
        charStart: m.index,
        charEnd: m.index + m[0].length,
      });
      if (results.length >= 3) break;
    }
  }
  return results;
}

function toSourceRef(
  pageId: number,
  charStart: number,
  charEnd: number,
): MetadataSourceRef {
  return { pageId, charStart, charEnd };
}

function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// ── Field extractors ────────────────────────────────────────────────────────

function extractCourt(pages: PageText[]): ExtractedField | null {
  for (const pat of COURT_PATTERNS) {
    const hits = findInPages(pages, pat);
    if (hits.length > 0) {
      const hit = hits[0]!;
      return {
        fieldName: "court",
        value: cleanText(hit.match[0]),
        sourceRef: toSourceRef(hit.pageId, hit.charStart, hit.charEnd),
        confidence: 0.92,
        method: "regex",
      };
    }
  }
  return null;
}

function extractRegistry(pages: PageText[]): ExtractedField | null {
  // Registry is typically the geographic qualifier in the court string.
  for (const pat of COURT_PATTERNS) {
    const hits = findInPages(pages, pat);
    if (hits.length > 0) {
      const hit = hits[0]!;
      const courtText = hit.match[0];
      const atMatch = courtText.match(/AT\s+([\w\s]+)$/i);
      if (atMatch) {
        return {
          fieldName: "registry",
          value: cleanText(atMatch[1]!),
          sourceRef: toSourceRef(hit.pageId, hit.charStart, hit.charEnd),
          confidence: 0.85,
          method: "heuristic",
        };
      }
    }
  }
  return null;
}

function extractProceedingNumber(pages: PageText[]): ExtractedField | null {
  for (const pat of PROCEEDING_PATTERNS) {
    const hits = findInPages(pages, pat);
    if (hits.length > 0) {
      const hit = hits[0]!;
      const value = cleanText(hit.match[1] ?? hit.match[0]);
      return {
        fieldName: "proceedingNumber",
        value,
        sourceRef: toSourceRef(hit.pageId, hit.charStart, hit.charEnd),
        confidence: 0.90,
        method: "regex",
      };
    }
  }
  return null;
}

function extractNeutralCitation(pages: PageText[]): ExtractedField | null {
  for (const page of pages.slice(0, 3)) {
    for (const pat of NEUTRAL_CITATION_PATTERNS) {
      // These patterns are global so String.match() discards the match offset.
      // exec() preserves it, which is required for citation provenance.
      pat.lastIndex = 0;
      const m = pat.exec(page.text);
      if (m && m.index !== undefined) {
        return {
          fieldName: "neutralCitation",
          value: cleanText(m[0]),
          sourceRef: toSourceRef(page.id, m.index, m.index + m[0].length),
          confidence: 0.93,
          method: "regex",
        };
      }
    }
  }
  return null;
}

function extractReportCitation(pages: PageText[]): ExtractedField | null {
  for (const page of pages.slice(0, 3)) {
    for (const pat of REPORT_CITATION_PATTERNS) {
      // These patterns are global so String.match() discards the match offset.
      // exec() preserves it, which is required for citation provenance.
      pat.lastIndex = 0;
      const m = pat.exec(page.text);
      if (m && m.index !== undefined) {
        return {
          fieldName: "reportCitation",
          value: cleanText(m[0]),
          sourceRef: toSourceRef(page.id, m.index, m.index + m[0].length),
          confidence: 0.88,
          method: "regex",
        };
      }
    }
  }
  return null;
}

function extractJudges(pages: PageText[]): ExtractedField | null {
  for (const pat of JUDGE_PATTERNS) {
    const hits = findInPages(pages, pat);
    if (hits.length > 0) {
      const hit = hits[0]!;
      const raw = hit.match[1] ?? hit.match[0];
      const judges = raw
        .split(/[,;&]|\band\b/i)
        .map(cleanText)
        .filter((j) => j.length > 3);
      if (judges.length > 0) {
        return {
          fieldName: "judges",
          value: judges,
          sourceRef: toSourceRef(hit.pageId, hit.charStart, hit.charEnd),
          confidence: 0.85,
          method: "regex",
        };
      }
    }
  }
  return null;
}

function extractHearingDate(pages: PageText[]): ExtractedField | null {
  for (const pat of HEARING_DATE_PATTERNS) {
    const hits = findInPages(pages, pat, 10);
    if (hits.length > 0) {
      const hit = hits[0]!;
      return {
        fieldName: "hearingDate",
        value: cleanText(hit.match[1]!),
        sourceRef: toSourceRef(hit.pageId, hit.charStart, hit.charEnd),
        confidence: 0.87,
        method: "regex",
      };
    }
  }
  return null;
}

function extractDecisionDate(pages: PageText[]): ExtractedField | null {
  for (const pat of DECISION_DATE_PATTERNS) {
    const hits = findInPages(pages, pat, 10);
    if (hits.length > 0) {
      const hit = hits[0]!;
      return {
        fieldName: "decisionDate",
        value: cleanText(hit.match[1]!),
        sourceRef: toSourceRef(hit.pageId, hit.charStart, hit.charEnd),
        confidence: 0.87,
        method: "regex",
      };
    }
  }
  return null;
}

function extractParties(pages: PageText[]): ExtractedField | null {
  for (const page of pages.slice(0, 3)) {
    const m = page.text.match(PARTY_PATTERN);
    if (m && m.index !== undefined) {
      return {
        fieldName: "parties",
        value: [cleanText(m[1]!), cleanText(m[2]!)],
        sourceRef: toSourceRef(page.id, m.index, m.index + m[0].length),
        confidence: 0.82,
        method: "regex",
      };
    }
  }
  return null;
}

function extractCaseName(
  pages: PageText[],
  parties: ExtractedField | null,
): ExtractedField | null {
  // Case name is typically "Plaintiff v Defendant" from the parties.
  if (parties?.value && Array.isArray(parties.value) && parties.value.length === 2) {
    return {
      fieldName: "caseName",
      value: `${parties.value[0]} v ${parties.value[1]}`,
      sourceRef: parties.sourceRef,
      confidence: parties.confidence,
      method: "heuristic",
    };
  }
  // Fall back: look for a v/versus line in the first 3 pages.
  for (const page of pages.slice(0, 3)) {
    const m = page.text.match(/([A-Z][A-Za-z\s&.,()'-]{2,60})\s+v\b[.]?\s+([A-Z][A-Za-z\s&.,()'-]{2,60})/);
    if (m && m.index !== undefined) {
      return {
        fieldName: "caseName",
        value: cleanText(m[0]),
        sourceRef: toSourceRef(page.id, m.index, m.index + m[0].length),
        confidence: 0.78,
        method: "heuristic",
      };
    }
  }
  return null;
}

function extractJurisdiction(
  court: ExtractedField | null,
): ExtractedField | null {
  if (!court?.value || typeof court.value !== "string") return null;
  const courtText = court.value.toLowerCase();
  let jurisdiction: string;
  if (/federal court|mahkamah persekutuan/.test(courtText)) {
    jurisdiction = "Malaysia — Federal";
  } else if (/court of appeal|mahkamah rayuan/.test(courtText)) {
    jurisdiction = "Malaysia — Court of Appeal";
  } else if (/syariah/.test(courtText)) {
    jurisdiction = "Malaysia — Syariah";
  } else if (/high court|mahkamah tinggi/.test(courtText)) {
    jurisdiction = "Malaysia — High Court";
  } else {
    jurisdiction = "Malaysia";
  }
  return {
    fieldName: "jurisdiction",
    value: jurisdiction,
    sourceRef: court.sourceRef,
    confidence: 0.90,
    method: "heuristic",
  };
}

function extractProceduralPosture(
  pages: PageText[],
): ExtractedField | null {
  const allText = pages
    .slice(0, 5)
    .map((p) => p.text)
    .join(" ");
  let posture: string | null = null;
  let confidence = 0.80;
  if (/\bappeal\b/i.test(allText)) {
    posture = "appeal";
  } else if (/\bjudicial\s+review\b/i.test(allText)) {
    posture = "judicial review";
  } else if (/\boriginating\s+summons?\b/i.test(allText)) {
    posture = "originating summons";
  } else if (/\bcivil\s+suit\b/i.test(allText)) {
    posture = "civil suit";
  } else if (/\bcriminal\b/i.test(allText)) {
    posture = "criminal";
    confidence = 0.75;
  }
  if (!posture) return null;
  return {
    fieldName: "proceduralPosture",
    value: posture,
    sourceRef: null,
    confidence,
    method: "heuristic",
  };
}

function extractLanguage(pages: PageText[]): ExtractedField {
  const sample = pages
    .slice(0, 3)
    .map((p) => p.text)
    .join(" ");
  const malayHits = LANGUAGE_INDICATORS.malay.filter((p) => p.test(sample)).length;
  const engHits = LANGUAGE_INDICATORS.english.filter((p) => p.test(sample)).length;
  const value =
    malayHits > engHits ? "ms" : "en";
  return {
    fieldName: "language",
    value,
    sourceRef: null,
    confidence: 0.75,
    method: "heuristic",
  };
}

// ── Main extraction entry point ─────────────────────────────────────────────

/**
 * Extract all metadata fields from ordered pages of judicial text.
 * Returns one ExtractedField per successfully extracted field.
 * Fields that cannot be found are omitted (callers decide whether to route
 * them to human review or accept the absence).
 */
export function extractMetadata(pages: PageText[]): ExtractedField[] {
  if (pages.length === 0) return [];

  const results: ExtractedField[] = [];

  const court = extractCourt(pages);
  const parties = extractParties(pages);
  const caseName = extractCaseName(pages, parties);
  const neutralCitation = extractNeutralCitation(pages);
  const reportCitation = extractReportCitation(pages);
  const registry = extractRegistry(pages);
  const proceedingNumber = extractProceedingNumber(pages);
  const judges = extractJudges(pages);
  const hearingDate = extractHearingDate(pages);
  const decisionDate = extractDecisionDate(pages);
  const jurisdiction = extractJurisdiction(court);
  const proceduralPosture = extractProceduralPosture(pages);
  const language = extractLanguage(pages);

  const fields = [
    caseName,
    neutralCitation,
    reportCitation,
    court,
    registry,
    proceedingNumber,
    judges,
    hearingDate,
    decisionDate,
    parties,
    jurisdiction,
    proceduralPosture,
    language,
  ];

  for (const f of fields) {
    if (f) results.push(f);
  }

  return results;
}
