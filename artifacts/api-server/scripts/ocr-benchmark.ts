// Phase 04 OCR benchmark: evaluates the safe LOCAL OCR engines available in
// this environment (tesseract, ocrad, gocr) against the synthetic scanned
// fixtures in fixtures/synthetic/extraction/. No document bytes leave the
// machine. Results feed docs/reports/phase-04-ocr-benchmark.md and ADR 0005.
//   npx tsx scripts/ocr-benchmark.ts

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/synthetic/extraction",
);

const truth = normalize(
  readFileSync(path.join(DIR, "scan-ground-truth.txt"), "utf8"),
);

function normalize(s: string): string {
  return s
    .replace(/[\u2014\u2013]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const dp = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(
        dp[j]! + 1,
        dp[j - 1]! + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

function accuracy(text: string): number {
  const t = normalize(text);
  const dist = levenshtein(truth, t);
  return Math.max(0, 1 - dist / truth.length);
}

interface Engine {
  name: string;
  run(image: string): string;
}

const engines: Engine[] = [
  {
    name: "tesseract (eng, psm 3)",
    run: (img) =>
      execFileSync("tesseract", [img, "stdout", "-l", "eng", "--psm", "3"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
  },
  {
    name: "tesseract (eng+msa, psm 3)",
    run: (img) =>
      execFileSync(
        "tesseract",
        [img, "stdout", "-l", "eng+msa", "--psm", "3"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ),
  },
  {
    name: "ocrad",
    run: (img) => {
      // ocrad needs pnm input
      execFileSync("magick", [img, "/tmp/ocr-bench.pnm"]);
      return execFileSync("ocrad", ["/tmp/ocr-bench.pnm"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    },
  },
  {
    name: "gocr",
    run: (img) => {
      execFileSync("magick", [img, "/tmp/ocr-bench.pnm"]);
      return execFileSync("gocr", ["/tmp/ocr-bench.pnm"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    },
  },
];

const images = ["scan-clean.png", "scan-rotated.png", "scan-faint.png", "scan-noisy.png"];

console.log("| Engine | Fixture | Char accuracy | Time (ms) |");
console.log("|---|---|---|---|");
for (const engine of engines) {
  for (const img of images) {
    const file = path.join(DIR, img);
    let acc = "FAILED";
    let ms = 0;
    try {
      const t0 = Date.now();
      const out = engine.run(file);
      ms = Date.now() - t0;
      acc = (accuracy(out) * 100).toFixed(1) + "%";
    } catch {
      acc = "ERROR";
    }
    console.log(`| ${engine.name} | ${img} | ${acc} | ${ms} |`);
  }
}

// Rotation detection (tesseract OSD) on the rotated fixture.
try {
  const osd = execFileSync(
    "tesseract",
    [path.join(DIR, "scan-rotated.png"), "stdout", "--psm", "0"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  console.log("\nTesseract OSD on scan-rotated.png:\n" + osd.trim());
} catch (err) {
  console.log("\nTesseract OSD failed:", (err as Error).message);
}

// Confidence reporting sample (TSV) on the faint fixture.
const tsv = execFileSync(
  "tesseract",
  [path.join(DIR, "scan-faint.png"), "stdout", "-l", "eng", "tsv"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
);
const confs = tsv
  .split("\n")
  .slice(1)
  .map((l) => l.split("\t"))
  .filter((c) => c.length >= 12 && c[11]?.trim() && c[10] !== "-1")
  .map((c) => Number(c[10]));
const mean = confs.reduce((a, b) => a + b, 0) / Math.max(1, confs.length);
console.log(
  `\nTesseract word-confidence on scan-faint.png: n=${confs.length} mean=${mean.toFixed(1)} min=${Math.min(...confs)}`,
);
