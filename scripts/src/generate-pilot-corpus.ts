/**
 * Phase 14 — Pilot corpus generator
 *
 * Produces exactly five source files representing the controlled-pilot variants,
 * outputs them to fixtures/pilot-corpus/ with a MANIFEST.json.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts exec tsx ./src/generate-pilot-corpus.ts
 *
 * No commercial materials are used.  All content is purely synthetic.
 */

import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

// ── Output directory ──────────────────────────────────────────────────────────
// Resolve relative to this file (scripts/src/generate-pilot-corpus.ts) so that
// the output lands in workspace/fixtures/pilot-corpus/ regardless of cwd.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// scripts/src → scripts → workspace root
const WORKSPACE_ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(WORKSPACE_ROOT, "fixtures", "pilot-corpus");
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Helpers ────────────────────────────────────────────────────────────────────

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function singleJudgmentText(n: number): string[] {
  const year = 2019 + (n % 7);
  const num = 100 + n;
  return [
    `IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR`,
    `[${year}] ${1 + (n % 3)} MLJ ${num}`,
    `Pilot Plaintiff ${n} Sdn Bhd v Pilot Defendant ${n} Sdn Bhd`,
    `CIVIL SUIT NO: KL-22-G-${String(n).padStart(6, "0")}`,
    `CORAM: JUSTICE PILOT JCA`,
    ``,
    `JUDGMENT`,
    ``,
    `[1] This is synthetic pilot judgment ${n} generated for controlled-pilot testing.`,
    `[2] The plaintiff claims RM ${n * 5000} for breach of a synthetic contract entered`,
    `    on 1 January ${year - 1}.`,
    `[3] Having considered the submissions and authorities cited, I am satisfied that`,
    `    the plaintiff has established its claim on a balance of probabilities.`,
    `[4] In the circumstances, judgment is entered for the plaintiff in the sum of`,
    `    RM ${n * 5000} together with interest at 5% per annum from the date of the`,
    `    writ until full payment.`,
    ``,
    `IT IS HEREBY ORDERED accordingly.`,
    ``,
    `SIGNED: JUSTICE PILOT JCA`,
    `DATE: ${1 + (n % 28)} January ${year}`,
    ``,
  ];
}

async function buildPdf(addContent: (doc: InstanceType<typeof PDFDocument>) => void): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 72, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    addContent(doc);
    doc.end();
  });
}

// ── File A: Dense 30-case native-text PDF ─────────────────────────────────────

async function buildFileA(): Promise<{ buf: Buffer; name: string }> {
  const name = "pilot-a-dense-30cases.pdf";
  const buf = await buildPdf((doc) => {
    for (let i = 1; i <= 30; i++) {
      if (i > 1) doc.addPage();
      doc.fontSize(10).font("Helvetica-Bold").text("SYNTHETIC JUDGMENT CORPUS — PILOT FILE A");
      doc.moveDown(0.5);
      doc.font("Helvetica");
      for (const line of singleJudgmentText(i)) {
        doc.text(line, { lineGap: 2 });
      }
      doc.moveDown(1);
      doc.font("Helvetica-Bold").text("─".repeat(70));
    }
  });
  return { buf, name };
}

// ── File B: 4-case native-text PDF ────────────────────────────────────────────

async function buildFileB(): Promise<{ buf: Buffer; name: string; case1Text: string[] }> {
  const name = "pilot-b-4cases.pdf";
  const case1Text = singleJudgmentText(101);
  const buf = await buildPdf((doc) => {
    for (let i = 0; i < 4; i++) {
      if (i > 0) doc.addPage();
      doc.fontSize(10).font("Helvetica-Bold").text("SYNTHETIC JUDGMENT CORPUS — PILOT FILE B");
      doc.moveDown(0.5);
      doc.font("Helvetica");
      const lines = i === 0 ? case1Text : singleJudgmentText(102 + i);
      for (const line of lines) {
        doc.text(line, { lineGap: 2 });
      }
      doc.moveDown(1);
      doc.font("Helvetica-Bold").text("─".repeat(70));
    }
  });
  return { buf, name, case1Text };
}

// ── File C: Simulated-scanned PDF (no text layer) ─────────────────────────────

async function buildFileC(): Promise<{ buf: Buffer; name: string }> {
  const name = "pilot-c-scanned.pdf";
  const buf = await buildPdf((doc) => {
    // Simulated scan: page with a grey rectangle to mimic a scanned image.
    // No text is added — the native-text extractor will find nothing.
    doc.rect(72, 72, 450, 650).fill("#e8e8e8");
    doc.fillColor("#999").fontSize(8).text(
      "[ Simulated scan page — no text layer ]",
      72,
      400,
      { width: 450, align: "center" },
    );
    doc.fillColor("black");
  });
  return { buf, name };
}

// ── File D: Duplicate of file B case 1 ────────────────────────────────────────

async function buildFileD(case1Text: string[]): Promise<{ buf: Buffer; name: string }> {
  const name = "pilot-d-duplicate.pdf";
  const buf = await buildPdf((doc) => {
    doc.fontSize(10).font("Helvetica-Bold").text("SYNTHETIC JUDGMENT CORPUS — PILOT FILE D (DUPLICATE)");
    doc.moveDown(0.5);
    doc.font("Helvetica");
    for (const line of case1Text) {
      doc.text(line, { lineGap: 2 });
    }
    doc.moveDown(1);
    doc.font("Helvetica-Bold").text("DUPLICATE FILE — FOR DEDUPLICATION TESTING");
  });
  return { buf, name };
}

// ── File E1 & E2: Split case across two files ─────────────────────────────────

const SPLIT_CASE_N = 200;

async function buildFileE1(): Promise<{ buf: Buffer; name: string }> {
  const name = "pilot-e1-split-part1.pdf";
  const buf = await buildPdf((doc) => {
    const year = 2021;
    doc.fontSize(10).font("Helvetica-Bold").text("SYNTHETIC JUDGMENT CORPUS — PILOT FILE E1 (PART 1 OF 2)");
    doc.moveDown(0.5);
    doc.font("Helvetica");
    const lines = [
      `IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR`,
      `[${year}] 2 MLJ ${SPLIT_CASE_N}`,
      `Split Plaintiff ${SPLIT_CASE_N} Sdn Bhd v Split Defendant ${SPLIT_CASE_N} Sdn Bhd`,
      `CIVIL SUIT NO: KL-22-G-${String(SPLIT_CASE_N).padStart(6, "0")}`,
      `CORAM: JUSTICE PILOT JCA`,
      ``,
      `JUDGMENT`,
      ``,
      `[1] This judgment has been split across two source files for pilot testing.`,
      `[2] The plaintiff claims RM ${SPLIT_CASE_N * 5000} for breach of contract.`,
      `[3] Having heard the evidence and submissions, I set out my findings.`,
      `[4] The contract was entered on 15 March 2020 (Exhibit A).`,
      `[5] The defendant breached the contract by failing to deliver goods.`,
      ``,
      `[— CONTINUED IN PART 2 —]`,
    ];
    for (const line of lines) doc.text(line, { lineGap: 2 });
    doc.moveDown(1).font("Helvetica-Bold").text("END OF PART 1");
  });
  return { buf, name };
}

async function buildFileE2(): Promise<{ buf: Buffer; name: string }> {
  const name = "pilot-e2-split-part2.pdf";
  const buf = await buildPdf((doc) => {
    const year = 2021;
    doc.fontSize(10).font("Helvetica-Bold").text("SYNTHETIC JUDGMENT CORPUS — PILOT FILE E2 (PART 2 OF 2)");
    doc.moveDown(0.5);
    doc.font("Helvetica");
    const lines = [
      `[— CONTINUED FROM PART 1 —]`,
      ``,
      `[${year}] 2 MLJ ${SPLIT_CASE_N}  (continued)`,
      `Split Plaintiff ${SPLIT_CASE_N} Sdn Bhd v Split Defendant ${SPLIT_CASE_N} Sdn Bhd`,
      ``,
      `[6] The defendant's submissions on causation are without merit.`,
      `[7] I find that the plaintiff suffered losses totalling RM ${SPLIT_CASE_N * 5000}.`,
      `[8] In the premises, I enter judgment for the plaintiff.`,
      ``,
      `IT IS HEREBY ORDERED that the defendant pay the plaintiff:`,
      `(a) the sum of RM ${SPLIT_CASE_N * 5000};`,
      `(b) interest at 5% per annum from the date of writ; and`,
      `(c) costs of this action to be taxed if not agreed.`,
      ``,
      `SIGNED: JUSTICE PILOT JCA`,
      `DATE: 14 June ${year}`,
    ];
    for (const line of lines) doc.text(line, { lineGap: 2 });
  });
  return { buf, name };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Generating pilot corpus…");

  const [fileA, fileB, fileC, fileE1, fileE2] = await Promise.all([
    buildFileA(),
    buildFileB(),
    buildFileC(),
    buildFileE1(),
    buildFileE2(),
  ]);

  const fileD = await buildFileD(fileB.case1Text);

  const files = [fileA, fileB, fileC, fileD, fileE1, fileE2];

  const manifest: Array<{
    filename: string;
    sha256: string;
    sizeBytes: number;
    variant: string;
    expectedCases: number | "unknown";
    rightsStatus: string;
    notes: string;
  }> = [];

  for (const f of files) {
    const dest = path.join(OUT_DIR, f.name);
    fs.writeFileSync(dest, f.buf);
    console.log(`  wrote ${f.name}  (${f.buf.length} bytes)`);

    let variant = "";
    let expectedCases: number | "unknown" = 1;
    let notes = "";

    if (f.name === fileA.name) {
      variant = "dense-multi-case";
      expectedCases = 30;
      notes = "30 native-text synthetic judgments; tests segmentation at scale";
    } else if (f.name === fileB.name) {
      variant = "multi-case";
      expectedCases = 4;
      notes = "4 native-text synthetic judgments; standard case";
    } else if (f.name === fileC.name) {
      variant = "scanned";
      expectedCases = 1;
      notes = "Single page with no text layer; OCR path required";
    } else if (f.name === fileD.name) {
      variant = "duplicate";
      expectedCases = 1;
      notes = "Exact content duplicate of pilot-b case 1; SHA-256 deduplication expected";
    } else if (f.name === fileE1.name) {
      variant = "split-part1";
      expectedCases = "unknown";
      notes = "First half of case split across two files; cross-file span review required";
    } else if (f.name === fileE2.name) {
      variant = "split-part2";
      expectedCases = "unknown";
      notes = "Second half of case split across two files; cross-file span review required";
    }

    manifest.push({
      filename: f.name,
      sha256: sha256(f.buf),
      sizeBytes: f.buf.length,
      variant,
      expectedCases,
      rightsStatus: "PILOT_REVIEWED",
      notes,
    });
  }

  const manifestPath = path.join(OUT_DIR, "MANIFEST.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        pilotBatch: "pilot-v1",
        generatedAt: new Date().toISOString(),
        description:
          "Phase 14 controlled-pilot corpus — five source files representing specific edge-case variants. No commercial materials. All content is purely synthetic.",
        files: manifest,
      },
      null,
      2,
    ),
  );
  console.log(`  wrote MANIFEST.json`);
  console.log(`\nDone. Output: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
