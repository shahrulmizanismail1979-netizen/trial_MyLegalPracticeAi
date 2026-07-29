#!/usr/bin/env tsx
/**
 * generate-stress-corpus.ts
 *
 * Produces a deterministic synthetic PDF corpus for stress-testing the
 * research ingestion pipeline.  Run with:
 *
 *   pnpm --filter @workspace/scripts exec tsx ./src/generate-stress-corpus.ts
 *
 * Output: fixtures/stress-corpus/  (~500 files, ~2 MB total)
 *
 * NO commercial or restricted material is used.  Every text string is
 * invented solely for automated testing.
 */

import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const OUT_DIR = path.resolve(
  import.meta.dirname,
  "../../fixtures/stress-corpus",
);

// ── OCR-noise injection ──────────────────────────────────────────────────────

const OCR_SUBS: Record<string, string[]> = {
  o: ["0", "O"],
  l: ["1", "|", "I"],
  i: ["!", "l"],
  e: ["3"],
  a: ["@"],
  s: ["5"],
};

function applyOcrNoise(text: string, errorRate: number, seed: number): string {
  let n = seed;
  const lcg = () => {
    n = (n * 1664525 + 1013904223) & 0xffffffff;
    return (n >>> 0) / 0xffffffff;
  };
  return text
    .split("")
    .map((c) => {
      if (lcg() < errorRate) {
        const subs = OCR_SUBS[c.toLowerCase()];
        if (subs) return subs[Math.floor(lcg() * subs.length)] ?? c;
      }
      return c;
    })
    .join("");
}

// ── Synthetic text generators ────────────────────────────────────────────────

function caseHeader(n: number): string {
  const year = 2018 + (n % 9);
  const num = 1 + (n % 300);
  const courts = [
    "HIGH COURT OF MALAYA AT KUALA LUMPUR",
    "HIGH COURT OF MALAYA AT SHAH ALAM",
    "COURT OF APPEAL OF MALAYSIA",
    "FEDERAL COURT OF MALAYSIA",
  ];
  const court = courts[n % courts.length];
  return (
    `IN THE ${court}\n` +
    `[${year}] ${1 + (n % 4)} MLJ ${num}\n` +
    `Synthetic Plaintiff ${n} Sdn Bhd v Synthetic Defendant ${n} Sdn Bhd\n` +
    `CIVIL SUIT NO: KL-22-G-${String(n).padStart(6, "0")}\n` +
    `CORAM: JUSTICE AHMAD SYNTHETIC JCA\n` +
    `JUDGMENT\n`
  );
}

function caseBody(n: number, paragraphs = 5): string {
  const lines = [`[1] This is a synthetic judgment for automated testing only.`];
  for (let p = 2; p <= paragraphs; p++) {
    lines.push(
      `[${p}] Para ${p} of case ${n}: The ${p % 2 === 0 ? "plaintiff" : "defendant"} ` +
        `argues synthetic point ${p} in the matter of fictional contract ${n * p}.`,
    );
  }
  lines.push(
    `IT IS HEREBY ORDERED that judgment is given for the plaintiff in RM ${n * 1000}.`,
    `Signed: AHMAD SYNTHETIC JCA`,
    `Dated: ${1 + (n % 28)} January ${2018 + (n % 9)}`,
  );
  return lines.join("\n");
}

function publisherFrontMatter(): string {
  return (
    `MALAYAN LAW JOURNAL\n` +
    `SYNTHETIC EDITION — NOT FOR COMMERCIAL USE\n` +
    `© 2026 Synthetic Publications Sdn Bhd. All rights reserved.\n` +
    `TABLE OF CONTENTS\n` +
    `Case 1: Synthetic Plaintiff Sdn Bhd v Synthetic Defendant Sdn Bhd ........ 1\n` +
    `Case 2: Another Plaintiff v Another Defendant ...................... 15\n` +
    `────────────────────────────────────\n`
  );
}

function misleadingBoundary(n: number): string {
  return (
    `\n` +
    `  [See also: Related Synthetic Case [${2018 + (n % 9)}] ${n % 4 + 1} MLJ ${100 + n}]\n` +
    `  ─────────────────────\n` +
    `  [EDITORIAL SUB-HEADING — NOT A CASE START]\n` +
    `\n`
  );
}

function incompleteCase(n: number): string {
  return (
    caseHeader(n) +
    `[1] This is a synthetic judgment that ends abruptly mid-sentence.\n` +
    `[2] The plaintiff's argument regarding clause ${n} is that`
    // deliberately truncated
  );
}

// ── PDF builders ─────────────────────────────────────────────────────────────

function makePdf(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 60, compress: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc
      .font("Courier")
      .fontSize(10)
      .text(text, { align: "left", lineBreak: true });
    doc.end();
  });
}

/** Scanned simulation: valid PDF with only a white fill rectangle, no text layer. */
function makeScannedPdf(): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", compress: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    // Render a white rectangle that fills the page — no selectable text.
    doc.rect(0, 0, 612, 792).fill("#f0f0f0");
    // Add faint "image area" marks at corners to mimic a scan artifact.
    doc.rect(30, 30, 4, 4).fill("#cccccc");
    doc.rect(578, 30, 4, 4).fill("#cccccc");
    doc.end();
  });
}

/** Damaged: valid PDF header, corrupted xref table. Passes magic-byte check, fails pdf-parse. */
async function makeDamagedPdf(text: string): Promise<Buffer> {
  const valid = await makePdf(text);
  const buf = Buffer.from(valid);
  // Corrupt 32 bytes starting at 20% into the file (never the %PDF- header).
  const corruptStart = Math.floor(buf.length * 0.2);
  for (let i = 0; i < 32 && corruptStart + i < buf.length; i++) {
    buf[corruptStart + i] = 0xff;
  }
  return buf;
}

// ── File writer ───────────────────────────────────────────────────────────────

function writePdf(name: string, buf: Buffer): void {
  const dest = path.join(OUT_DIR, name);
  const ws = createWriteStream(dest);
  ws.write(buf);
  ws.end();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (existsSync(OUT_DIR)) {
    rmSync(OUT_DIR, { recursive: true });
  }
  mkdirSync(OUT_DIR, { recursive: true });

  let generated = 0;
  const manifest: Array<{ file: string; variant: string; cases: number; sha256: string }> =
    [];

  function record(file: string, variant: string, cases: number, buf: Buffer) {
    writePdf(file, buf);
    manifest.push({
      file,
      variant,
      cases,
      sha256: createHash("sha256").update(buf).digest("hex"),
    });
    generated++;
    if (generated % 50 === 0) process.stdout.write(`  ${generated} files…\n`);
  }

  // ── 1. Native-text single-case containers (180) ──────────────────────────
  console.log("Generating single-case native-text PDFs…");
  for (let i = 0; i < 180; i++) {
    const text = caseHeader(i) + "\n" + caseBody(i, 4 + (i % 6));
    const buf = await makePdf(text);
    record(`native-single-${String(i).padStart(3, "0")}.pdf`, "native-single", 1, buf);
  }

  // ── 2. Multi-case native-text containers (100, 2-10 cases each) ─────────
  console.log("Generating multi-case native-text PDFs…");
  let multiIdx = 0;
  for (let i = 0; i < 100; i++) {
    const casesPerFile = 2 + (i % 9); // 2–10 cases
    const parts = [publisherFrontMatter()];
    for (let c = 0; c < casesPerFile; c++) {
      parts.push(caseHeader(multiIdx + c) + "\n" + caseBody(multiIdx + c, 3 + (c % 5)));
      if (c < casesPerFile - 1) parts.push("\n────────────────────────────\n");
    }
    multiIdx += casesPerFile;
    const text = parts.join("\n");
    const buf = await makePdf(text);
    record(`native-multi-${String(i).padStart(3, "0")}.pdf`, "native-multi", casesPerFile, buf);
  }

  // ── 3. Dense containers — 30+ cases (10) ────────────────────────────────
  console.log("Generating dense containers (30+ cases)…");
  for (let i = 0; i < 10; i++) {
    const casesPerFile = 30 + (i % 10); // 30–39 cases
    const parts = [publisherFrontMatter()];
    for (let c = 0; c < casesPerFile; c++) {
      parts.push(
        caseHeader(500 + i * 40 + c) +
          "\n" +
          caseBody(500 + i * 40 + c, 2),
      );
      if (c < casesPerFile - 1) parts.push("\n────────────────────────────\n");
    }
    const text = parts.join("\n");
    const buf = await makePdf(text);
    record(`dense-${String(i).padStart(2, "0")}.pdf`, "dense-30plus", casesPerFile, buf);
  }

  // ── 4. Simulated-scanned containers (50) ────────────────────────────────
  console.log("Generating simulated-scanned PDFs…");
  for (let i = 0; i < 50; i++) {
    const buf = await makeScannedPdf();
    record(`scanned-${String(i).padStart(3, "0")}.pdf`, "scanned", 0, buf);
  }

  // ── 5. Duplicate containers (30) ────────────────────────────────────────
  // 15 pairs: each pair is identical bytes → SHA-256 dedup fires on 2nd upload
  console.log("Generating duplicate pairs…");
  for (let i = 0; i < 15; i++) {
    const text = caseHeader(700 + i) + "\n" + caseBody(700 + i, 3);
    const buf = await makePdf(text);
    record(`dup-a-${String(i).padStart(2, "0")}.pdf`, "duplicate-a", 1, buf);
    record(`dup-b-${String(i).padStart(2, "0")}.pdf`, "duplicate-b", 0, buf);
  }

  // ── 6. Incomplete cases (20) ────────────────────────────────────────────
  console.log("Generating incomplete-case PDFs…");
  for (let i = 0; i < 20; i++) {
    const text = incompleteCase(800 + i);
    const buf = await makePdf(text);
    record(`incomplete-${String(i).padStart(2, "0")}.pdf`, "incomplete", 0, buf);
  }

  // ── 7. Damaged files (20) ────────────────────────────────────────────────
  console.log("Generating damaged PDFs…");
  for (let i = 0; i < 20; i++) {
    const text = caseHeader(900 + i) + "\n" + caseBody(900 + i, 2);
    const buf = await makeDamagedPdf(text);
    record(`damaged-${String(i).padStart(2, "0")}.pdf`, "damaged", 0, buf);
  }

  // ── 8. Misleading-boundary containers (20) ──────────────────────────────
  console.log("Generating misleading-boundary PDFs…");
  for (let i = 0; i < 20; i++) {
    const text =
      caseHeader(1000 + i) +
      "\n" +
      caseBody(1000 + i, 3) +
      misleadingBoundary(1000 + i) +
      caseBody(1000 + i + 1, 2);
    const buf = await makePdf(text);
    record(
      `misleading-${String(i).padStart(2, "0")}.pdf`,
      "misleading-boundary",
      1,
      buf,
    );
  }

  // ── 9. Cases split across files (20 pairs = 40 files) ───────────────────
  console.log("Generating split-case pairs…");
  for (let i = 0; i < 20; i++) {
    const fullHeader = caseHeader(1200 + i);
    const paras = Array.from({ length: 8 }, (_, p) => `[${p + 1}] Para ${p + 1} of split case ${i}.`);
    const part1 = fullHeader + "\n" + paras.slice(0, 4).join("\n");
    const part2 = paras.slice(4).join("\n") + "\n" + `IT IS ORDERED accordingly.\nSigned: AHMAD SYNTHETIC JCA`;
    const buf1 = await makePdf(part1);
    const buf2 = await makePdf(part2);
    record(`split-a-${String(i).padStart(2, "0")}.pdf`, "split-part1", 0, buf1);
    record(`split-b-${String(i).padStart(2, "0")}.pdf`, "split-part2", 0, buf2);
  }

  // ── 10. Mixed OCR quality (30) ───────────────────────────────────────────
  console.log("Generating mixed-OCR-quality PDFs…");
  const ocrRates = [0.0, 0.05, 0.25, 0.5]; // perfect, typical, low-quality, near-unreadable
  for (let i = 0; i < 30; i++) {
    const rate = ocrRates[i % ocrRates.length]!;
    const raw = caseHeader(1400 + i) + "\n" + caseBody(1400 + i, 3);
    const noisy = applyOcrNoise(raw, rate, 0xdeadbeef + i);
    const buf = await makePdf(noisy);
    const label = rate === 0 ? "perfect" : rate === 0.05 ? "typical" : rate === 0.25 ? "low" : "unreadable";
    record(`ocr-${label}-${String(i).padStart(2, "0")}.pdf`, `ocr-${label}`, rate < 0.2 ? 1 : 0, buf);
  }

  // ── Write manifest ────────────────────────────────────────────────────────
  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    path.join(OUT_DIR, "MANIFEST.json"),
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        totalFiles: manifest.length,
        totalCaseCandidates: manifest.reduce((s, m) => s + m.cases, 0),
        byVariant: Object.fromEntries(
          [
            "native-single",
            "native-multi",
            "dense-30plus",
            "scanned",
            "duplicate-a",
            "duplicate-b",
            "incomplete",
            "damaged",
            "misleading-boundary",
            "split-part1",
            "split-part2",
            "ocr-perfect",
            "ocr-typical",
            "ocr-low",
            "ocr-unreadable",
          ].map((v) => [
            v,
            {
              count: manifest.filter((m) => m.variant === v).length,
              totalCases: manifest
                .filter((m) => m.variant === v)
                .reduce((s, m) => s + m.cases, 0),
            },
          ]),
        ),
        files: manifest,
      },
      null,
      2,
    ),
  );

  console.log(
    `\n✓ Generated ${generated} corpus files → ${OUT_DIR}\n` +
      `  Total case candidates (native-text): ${manifest.reduce((s, m) => s + m.cases, 0)}\n`,
  );
}

main().catch((err) => {
  console.error("Corpus generation failed:", err);
  process.exit(1);
});
