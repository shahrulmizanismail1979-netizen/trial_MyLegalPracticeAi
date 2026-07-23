import type {
  AnalyzedBlock,
  ExtractedPage,
  LayoutAnalysis,
  LayoutAnalyzerAdapter,
  LayoutWarning,
  WordBox,
} from "../adapters";
import type { BoundingBox } from "@workspace/db";

// In-repo layout analyzer (ADR 0005): groups word boxes into lines, lines
// into blocks; detects columns, headers/footers, page numbers; assigns
// reading order and per-page character offsets. Uncertainty is surfaced as
// structured warnings — never silently resolved.

interface Line {
  words: WordBox[];
  y: number;
  height: number;
  x: number;
  xEnd: number;
}

function bboxOfWords(words: WordBox[]): BoundingBox | null {
  if (words.length === 0) return null;
  const unit = words[0]!.bbox.unit;
  const x = Math.min(...words.map((w) => w.bbox.x));
  const y = Math.min(...words.map((w) => w.bbox.y));
  const xEnd = Math.max(...words.map((w) => w.bbox.x + w.bbox.width));
  const yEnd = Math.max(...words.map((w) => w.bbox.y + w.bbox.height));
  return { x, y, width: xEnd - x, height: yEnd - y, unit };
}

function groupLines(words: WordBox[]): Line[] {
  const sorted = [...words].sort(
    (a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x,
  );
  const lines: Line[] = [];
  for (const w of sorted) {
    const cy = w.bbox.y + w.bbox.height / 2;
    const line = lines.find(
      (l) => Math.abs(l.y + l.height / 2 - cy) < Math.max(l.height, w.bbox.height) * 0.6,
    );
    if (line) {
      line.words.push(w);
      line.y = Math.min(line.y, w.bbox.y);
      line.height = Math.max(line.height, w.bbox.height);
      line.x = Math.min(line.x, w.bbox.x);
      line.xEnd = Math.max(line.xEnd, w.bbox.x + w.bbox.width);
    } else {
      lines.push({
        words: [w],
        y: w.bbox.y,
        height: w.bbox.height,
        x: w.bbox.x,
        xEnd: w.bbox.x + w.bbox.width,
      });
    }
  }
  for (const l of lines) l.words.sort((a, b) => a.bbox.x - b.bbox.x);
  return lines.sort((a, b) => a.y - b.y);
}

function lineText(l: Line): string {
  return l.words.map((w) => w.text).join(" ");
}

/** Detect a two-column body: a persistent vertical gap crossed by few lines. */
function detectColumns(lines: Line[], pageWidth: number): number | null {
  const body = lines.filter((l) => l.xEnd - l.x < pageWidth * 0.62);
  if (body.length < 6 || body.length < lines.length * 0.5) return null;
  const mid = pageWidth / 2;
  const left = body.filter((l) => l.xEnd < mid + pageWidth * 0.05);
  const right = body.filter((l) => l.x > mid - pageWidth * 0.05);
  if (left.length >= 3 && right.length >= 3) {
    const gapStart = Math.max(...left.map((l) => l.xEnd));
    const gapEnd = Math.min(...right.map((l) => l.x));
    if (gapEnd - gapStart > pageWidth * 0.02) return (gapStart + gapEnd) / 2;
  }
  return null;
}

const PAGE_NUMBER_RE = /^(page\s+\d+(\s+of\s+\d+)?|-?\s*\d+\s*-?)$/i;

export const heuristicLayoutAnalyzer: LayoutAnalyzerAdapter = {
  name: "heuristic-layout",
  version: "1",
  isEnabled() {
    return true;
  },
  analyze(page: ExtractedPage): LayoutAnalysis {
    const warnings: LayoutWarning[] = [];
    const lines = groupLines(page.words);
    if (lines.length === 0) {
      return { pageText: "", blocks: [], warnings };
    }

    const topBand = page.height * 0.08;
    const bottomBand = page.height * 0.92;
    const columnSplit = detectColumns(
      lines.filter((l) => l.y > topBand && l.y + l.height < bottomBand),
      page.width,
    );

    interface Placed {
      line: Line;
      region: "header" | "footer" | "body";
      column: number | null;
    }
    const placed: Placed[] = lines.map((line) => {
      const region =
        line.y < topBand ? "header" : line.y + line.height > bottomBand ? "footer" : "body";
      let column: number | null = null;
      if (region === "body" && columnSplit !== null) {
        if (line.xEnd <= columnSplit) column = 0;
        else if (line.x >= columnSplit) column = 1;
        else {
          column = null; // spans the gap — reading order uncertain
          warnings.push({
            code: "READING_ORDER_UNCERTAIN",
            coordinates: bboxOfWords(line.words),
            detail: { reason: "line spans the detected column gap" },
          });
        }
      }
      return { line, region, column };
    });

    // Reading order: header lines, then body column 0 (top-down), column 1,
    // full-width/uncertain lines interleaved by y within their column pass,
    // then footer lines.
    const ordered: Placed[] = [
      ...placed.filter((p) => p.region === "header"),
      ...(columnSplit === null
        ? placed.filter((p) => p.region === "body")
        : [
            ...placed.filter((p) => p.region === "body" && p.column !== 1),
            ...placed.filter((p) => p.region === "body" && p.column === 1),
          ]),
      ...placed.filter((p) => p.region === "footer"),
    ];

    // Group consecutive same-region/column lines into blocks, splitting on
    // vertical gaps larger than 1.8× median line height.
    const heights = lines.map((l) => l.height).sort((a, b) => a - b);
    const medianH = heights[Math.floor(heights.length / 2)] ?? 12;
    const blocks: AnalyzedBlock[] = [];
    let current: Placed[] = [];
    let readingOrder = 0;
    let charCursor = 0;
    const parts: string[] = [];

    const flush = () => {
      if (current.length === 0) return;
      const words = current.flatMap((p) => p.line.words);
      const text = current.map((p) => lineText(p.line)).join("\n");
      const first = current[0]!;
      const isPageNumber =
        current.length === 1 && PAGE_NUMBER_RE.test(text.trim());
      const blockType: AnalyzedBlock["blockType"] = isPageNumber
        ? "page_number"
        : first.region === "header"
          ? "header"
          : first.region === "footer"
            ? "footer"
            : "paragraph";
      const charStart = charCursor;
      parts.push(text);
      charCursor += text.length + 1; // '\n' joiner between blocks
      blocks.push({
        blockType,
        text,
        bbox: bboxOfWords(words),
        readingOrder: readingOrder++,
        columnIndex: first.column,
        charStart,
        charEnd: charStart + text.length,
        confidence: avgConfidence(words),
      });
      current = [];
    };

    let prev: Placed | null = null;
    for (const p of ordered) {
      const sameGroup =
        prev !== null &&
        prev.region === p.region &&
        prev.column === p.column &&
        p.line.y - (prev.line.y + prev.line.height) < medianH * 0.8;
      if (!sameGroup) flush();
      current.push(p);
      prev = p;
    }
    flush();

    return { pageText: parts.join("\n"), blocks, warnings };
  },
};

function avgConfidence(words: WordBox[]): number | null {
  const confs = words
    .map((w) => w.confidence)
    .filter((c): c is number => typeof c === "number");
  if (confs.length === 0) return null;
  return Math.round(confs.reduce((a, b) => a + b, 0) / confs.length);
}
