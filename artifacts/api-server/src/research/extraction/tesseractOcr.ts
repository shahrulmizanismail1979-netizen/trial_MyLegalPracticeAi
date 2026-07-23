import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { OcrAdapter, OcrPageResult, WordBox } from "../adapters";

// Tesseract OCR adapter (ADR 0005; benchmark:
// docs/reports/phase-04-ocr-benchmark.md). Runs the system tesseract binary
// with TSV output for per-word confidences + coordinates, and OSD for
// orientation. Language set is configurable; default eng+msa for the
// platform's bilingual corpus. Never fabricates text — confidence data is
// passed through untouched so the pipeline can warn and route to review.

const execFileAsync = promisify(execFile);

export const TESSERACT_LANGS = process.env.RESEARCH_OCR_LANGS || "eng+msa";

let available: boolean | null = null;

export async function tesseractAvailable(): Promise<boolean> {
  if (available !== null) return available;
  try {
    await execFileAsync("tesseract", ["--version"]);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

interface TsvRow {
  level: number;
  left: number;
  top: number;
  width: number;
  height: number;
  conf: number;
  text: string;
}

function parseTsv(tsv: string): TsvRow[] {
  return tsv
    .split("\n")
    .slice(1)
    .map((line) => line.split("\t"))
    .filter((c) => c.length >= 12)
    .map((c) => ({
      level: Number(c[0]),
      left: Number(c[6]),
      top: Number(c[7]),
      width: Number(c[8]),
      height: Number(c[9]),
      conf: Number(c[10]),
      text: (c[11] ?? "").trim(),
    }));
}

async function runTesseract(
  image: string,
  args: string[],
): Promise<string> {
  const { stdout } = await execFileAsync(
    "tesseract",
    [image, "stdout", ...args],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  return stdout;
}

export const tesseractOcrAdapter: OcrAdapter = {
  name: "tesseract",
  version: `5.5-${TESSERACT_LANGS}-psm3`,
  isEnabled() {
    // Synchronous surface backed by the cached async probe; callers that
    // need certainty should attempt recognize() and handle failure.
    return available !== false;
  },
  async recognize(pageImage: Buffer): Promise<OcrPageResult> {
    if (!(await tesseractAvailable())) {
      throw new Error(
        "tesseract binary not available — route page to human review",
      );
    }
    const dir = await mkdtemp(path.join(os.tmpdir(), "research-ocr-"));
    try {
      const img = path.join(dir, "page.png");
      await writeFile(img, pageImage);

      const [tsvOut, plainOut, osdOut] = await Promise.all([
        runTesseract(img, ["-l", TESSERACT_LANGS, "--psm", "3", "tsv"]),
        runTesseract(img, ["-l", TESSERACT_LANGS, "--psm", "3"]),
        runTesseract(img, ["--psm", "0"]).catch(() => null),
      ]);

      const words: WordBox[] = parseTsv(tsvOut)
        .filter((r) => r.level === 5 && r.text.length > 0 && r.conf >= 0)
        .map((r) => ({
          text: r.text,
          confidence: r.conf,
          bbox: {
            x: r.left,
            y: r.top,
            width: r.width,
            height: r.height,
            unit: "px" as const,
          },
        }));
      const meanConfidence =
        words.length === 0
          ? 0
          : words.reduce((a, w) => a + (w.confidence ?? 0), 0) / words.length;

      let rotationDegrees: number | null = null;
      let rotationConfidence: number | null = null;
      if (osdOut) {
        const rot = /Rotate:\s*(\d+)/.exec(osdOut);
        const conf = /Orientation confidence:\s*([\d.]+)/.exec(osdOut);
        rotationDegrees = rot ? Number(rot[1]) : null;
        rotationConfidence = conf ? Math.round(Number(conf[1])) : null;
      }

      return {
        text: plainOut.replace(/\f/g, "").trimEnd(),
        words,
        meanConfidence,
        rotationDegrees,
        rotationConfidence,
        languages: TESSERACT_LANGS.split("+"),
      };
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  },
};
