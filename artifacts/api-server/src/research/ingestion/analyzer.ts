import mammoth from "mammoth";
import type { InventoryLabel } from "@workspace/db";

// Phase 03 inventory analyzer (ADR 0004). Non-destructive diagnostics only:
// nothing here creates cases, extracts judgments, or mutates bytes. Output
// labels are DIAGNOSTIC — uncertainty routes to human review, never guesses.

export interface InventoryAnalysis {
  label: InventoryLabel;
  fileType: string;
  pageCount: number | null;
  textCharCount: number;
  blankPageCount: number | null;
  damagedPageCount: number | null;
  ocrProbable: boolean;
  caseTitleRegionCount: number;
  repeatedLines: string[];
  commercialMarkers: string[];
  multiCasePossible: boolean;
  detail: Record<string, unknown>;
}

// Malaysian/common-law case-title signals: neutral citations, report
// citations, court headers, and "X v Y" / "X lwn Y" party lines.
const CITATION_RE =
  /\[\d{4}\]\s+(?:\d+\s+)?(?:MLJ|CLJ|MLRA|MLRH|AMR|ILR|SSLR|AC|WLR|All\s?ER)\b/g;
const COURT_HEADER_RE =
  /\b(?:IN THE (?:HIGH COURT|COURT OF APPEAL|FEDERAL COURT|SESSIONS COURT|MAGISTRATES?['’]? COURT)|DALAM MAHKAMAH (?:TINGGI|RAYUAN|PERSEKUTUAN|SESYEN|MAJISTRET))\b/gi;
const PARTY_LINE_RE = /^.{2,120}\s+(?:v\.?|lwn\.?|melawan)\s+.{2,120}$/gim;

const COMMERCIAL_MARKER_PATTERNS: Array<[string, RegExp]> = [
  ["copyright-symbol", /©/],
  ["all-rights-reserved", /all rights reserved/i],
  ["lexisnexis", /lexis\s?nexis/i],
  ["malayan-law-journal", /malayan law journal/i],
  ["clj-publisher", /current law journal|CLJ Legal Network/i],
  ["sweet-maxwell", /sweet\s*&\s*maxwell/i],
  ["thomson-reuters", /thomson reuters|westlaw/i],
  ["headnote-marker", /\bheadnotes?\b.{0,40}\bprepared\b/i],
];

function countMatches(text: string, re: RegExp): number {
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

function findCommercialMarkers(text: string): string[] {
  return COMMERCIAL_MARKER_PATTERNS.filter(([, re]) => re.test(text)).map(
    ([name]) => name,
  );
}

/** Lines appearing on 3+ pages (or 3+ times) — probable headers/footers. */
function findRepeatedLines(pages: string[]): string[] {
  const freq = new Map<string, number>();
  for (const page of pages) {
    const seenInPage = new Set<string>();
    for (const raw of page.split("\n")) {
      const line = raw.trim();
      if (line.length < 4 || line.length > 120) continue;
      if (/^\d+$/.test(line)) continue; // bare page numbers
      if (seenInPage.has(line)) continue;
      seenInPage.add(line);
      freq.set(line, (freq.get(line) ?? 0) + 1);
    }
  }
  const threshold = Math.max(3, Math.ceil(pages.length * 0.5));
  return [...freq.entries()]
    .filter(([, n]) => pages.length >= 3 && n >= threshold)
    .map(([line]) => line)
    .slice(0, 20);
}

interface ExtractedText {
  fileType: string;
  pages: string[]; // one entry per page where the format has pages
  pageCount: number | null;
  damagedPageCount: number | null;
  corrupt: boolean;
}

async function extractText(
  bytes: Buffer,
  mimeType: string,
  originalName: string,
): Promise<ExtractedText> {
  const name = originalName.toLowerCase();
  if (mimeType.startsWith("image/")) {
    return {
      fileType: mimeType,
      pages: [],
      pageCount: null,
      damagedPageCount: null,
      corrupt: false,
    };
  }
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    try {
      // pdf-parse v2 exposes a `PDFParse` class; externalized in esbuild.
      const { PDFParse } = (await import("pdf-parse")) as unknown as {
        PDFParse: new (opts: { data: Uint8Array }) => {
          getText(): Promise<{
            text: string;
            total?: number;
            pages?: Array<{ text: string }>;
          }>;
          destroy(): Promise<void>;
        };
      };
      const parser = new PDFParse({ data: new Uint8Array(bytes) });
      try {
        const result = await parser.getText();
        const pages =
          result.pages && result.pages.length > 0
            ? result.pages.map((p) => p.text ?? "")
            : result.text.split("\f");
        return {
          fileType: "application/pdf",
          pages,
          pageCount: result.total ?? pages.length,
          damagedPageCount: null,
          corrupt: false,
        };
      } finally {
        await parser.destroy();
      }
    } catch {
      return {
        fileType: "application/pdf",
        pages: [],
        pageCount: null,
        damagedPageCount: null,
        corrupt: true,
      };
    }
  }
  if (name.endsWith(".docx")) {
    try {
      const { value } = await mammoth.extractRawText({ buffer: bytes });
      return {
        fileType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        pages: [value],
        pageCount: null,
        damagedPageCount: null,
        corrupt: false,
      };
    } catch {
      return {
        fileType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        pages: [],
        pageCount: null,
        damagedPageCount: null,
        corrupt: true,
      };
    }
  }
  // txt / html / rtf: treat form feeds as page separators when present.
  const text = bytes.toString("utf8").replace(/\u0000/g, "");
  const stripped =
    mimeType === "text/html"
      ? text.replace(/<[^>]+>/g, " ")
      : mimeType === "application/rtf"
        ? text.replace(/\\[a-z]+-?\d*\s?|[{}]/g, " ")
        : text;
  const pages = stripped.includes("\f") ? stripped.split("\f") : [stripped];
  return {
    fileType: mimeType,
    pages,
    pageCount: pages.length > 1 ? pages.length : null,
    damagedPageCount: null,
    corrupt: false,
  };
}

/**
 * Analyze stored container bytes and produce diagnostic inventory data with
 * exactly one label. Pure with respect to the platform: no DB, no mutation.
 */
export async function analyzeContainer(
  bytes: Buffer,
  mimeType: string,
  originalName: string,
): Promise<InventoryAnalysis> {
  const extracted = await extractText(bytes, mimeType, originalName);
  const fullText = extracted.pages.join("\n");
  const textCharCount = fullText.replace(/\s+/g, "").length;
  const blankPageCount =
    extracted.pages.length > 1
      ? extracted.pages.filter((p) => p.replace(/\s+/g, "").length === 0)
          .length
      : null;

  const citations = countMatches(fullText, CITATION_RE);
  const courtHeaders = countMatches(fullText, COURT_HEADER_RE);
  const partyLines = countMatches(fullText, PARTY_LINE_RE);
  // A "case title region" needs a strong signal: a court header or a
  // citation. Party lines alone are too noisy to count as regions.
  const caseTitleRegionCount = Math.max(courtHeaders, citations > 0 ? 1 : 0);
  const commercialMarkers = findCommercialMarkers(fullText);
  const repeatedLines = findRepeatedLines(extracted.pages);

  const isImage = mimeType.startsWith("image/");
  const scannedPdf =
    extracted.fileType === "application/pdf" &&
    !extracted.corrupt &&
    textCharCount < 20 &&
    bytes.length > 10_000;
  const ocrProbable = isImage || scannedPdf;

  let label: InventoryLabel;
  let multiCasePossible = false;
  if (extracted.corrupt) {
    label = "MANUAL_INSPECTION_REQUIRED";
  } else if (ocrProbable) {
    label = "OCR_REQUIRED";
  } else if (textCharCount === 0) {
    label = "EMPTY_OR_INVALID";
  } else if (commercialMarkers.length > 0) {
    // Suspected publisher/editorial material mixed with judicial text —
    // isolation rules apply, humans decide.
    label = "MIXED_CONTENT_POSSIBLE";
    multiCasePossible = caseTitleRegionCount > 1;
  } else if (caseTitleRegionCount > 1) {
    label = "MULTI_CASE_POSSIBLE";
    multiCasePossible = true;
  } else if (caseTitleRegionCount === 1 || partyLines > 0) {
    label = "SINGLE_CASE_POSSIBLE";
  } else {
    label = "MANUAL_INSPECTION_REQUIRED";
  }

  return {
    label,
    fileType: extracted.fileType,
    pageCount: extracted.pageCount,
    textCharCount,
    blankPageCount,
    damagedPageCount: extracted.corrupt ? extracted.pageCount : null,
    ocrProbable,
    caseTitleRegionCount,
    repeatedLines,
    commercialMarkers,
    multiCasePossible,
    detail: {
      citations,
      courtHeaders,
      partyLines,
      byteSize: bytes.length,
      corrupt: extracted.corrupt,
    },
  };
}
