// Generates the Phase 04 synthetic extraction fixtures (native-text PDFs,
// degraded "scanned" page images, and ground-truth text) into
// fixtures/synthetic/extraction/. Deterministic and safe to re-run:
//   npx tsx scripts/generate-extraction-fixtures.ts
// All content is synthetic — no real judgments. Requires pdftoppm and
// ImageMagick (`magick`) on PATH for the scanned variants.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, createWriteStream, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

const OUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/synthetic/extraction",
);
mkdirSync(OUT, { recursive: true });

function finish(doc: PDFKit.PDFDocument, file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(path.join(OUT, file));
    doc.pipe(stream);
    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
}

const PAGE1 = [
  "SYNTHETIC HIGH COURT OF EXAMPLESTAN",
  "CIVIL SUIT NO. SYN-22-001-2026",
  "",
  "BETWEEN",
  "ALPHA TRADING SDN BHD ... PLAINTIFF",
  "AND",
  "BETA LOGISTICS SDN BHD ... DEFENDANT",
  "",
  "JUDGMENT",
  "",
  "[1] This is a synthetic judgment created solely for software testing.",
  "It contains no real parties, facts, or holdings.",
  "[2] The plaintiff claims damages for breach of a fictional carriage",
  "contract dated 1 January 2026.",
].join("\n");

const PAGE2 = [
  "[3] The defendant denies liability and pleads a fictional exclusion",
  "clause. The court considers the synthetic evidence of both sides.",
  "[4] For the reasons above, judgment is entered for the plaintiff in",
  "the sum of RM 100,000 with synthetic costs.",
  "",
  "Dated this 2nd day of February 2026.",
  "SYNTHETIC JUDGE",
].join("\n");

async function nativeClean() {
  const doc = new PDFDocument({ size: "A4", margin: 72 });
  doc.font("Helvetica");
  for (const [i, body] of [PAGE1, PAGE2].entries()) {
    if (i > 0) doc.addPage();
    doc.fontSize(9).text("SYNTHETIC LAW REPORTS — FOR TESTING ONLY", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(body, { lineGap: 4 });
    doc.fontSize(9).text(`Page ${i + 1} of 2`, 72, 770, { align: "center", lineBreak: false });
  }
  await finish(doc, "native-clean.pdf");
}

async function nativeTwoColumn() {
  const doc = new PDFDocument({ size: "A4", margin: 60 });
  doc.font("Helvetica").fontSize(10);
  const colText = (n: number) =>
    Array.from({ length: 12 }, (_, i) =>
      `Column ${n} line ${i + 1}: synthetic two-column layout text for reading-order testing.`,
    ).join(" ");
  doc.fontSize(9).text("SYNTHETIC TWO-COLUMN FIXTURE", { align: "center" });
  doc.fontSize(10);
  doc.text(colText(1), 60, 100, { width: 220, lineGap: 3 });
  doc.text(colText(2), 320, 100, { width: 220, lineGap: 3 });
  doc.fontSize(9).text("Page 1 of 1", 60, 780, { align: "center", lineBreak: false });
  await finish(doc, "native-two-column.pdf");
}

async function nativeFootnotesTables() {
  const doc = new PDFDocument({ size: "A4", margin: 72 });
  doc.font("Helvetica");
  doc.fontSize(9).text("SYNTHETIC FOOTNOTES AND TABLE FIXTURE", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(
    "[1] The synthetic principle applies.¹ The quantum is set out in the table below.²",
    { lineGap: 4 },
  );
  doc.moveDown();
  const rows = [
    ["Item", "Amount (RM)"],
    ["Synthetic loss A", "40,000"],
    ["Synthetic loss B", "60,000"],
    ["Total", "100,000"],
  ];
  let y = doc.y;
  for (const r of rows) {
    doc.text(r[0]!, 90, y, { width: 200 });
    doc.text(r[1]!, 300, y, { width: 120 });
    y += 18;
  }
  doc.fontSize(8).text(
    "1. Synthetic Case v Synthetic Case [2026] SYN 1.\n2. Figures are fictional.",
    72,
    700,
  );
  doc.fontSize(9).text("Page 1 of 1", 72, 780, { align: "center", lineBreak: false });
  await finish(doc, "native-footnotes-tables.pdf");
}

async function nativeMixedLanguage() {
  const doc = new PDFDocument({ size: "A4", margin: 72 });
  doc.font("Helvetica");
  doc.fontSize(9).text("SYNTHETIC MIXED-LANGUAGE FIXTURE (ENGLISH / BAHASA MELAYU)", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(
    [
      "[1] The plaintiff's claim is allowed. Ini adalah penghakiman sintetik",
      "untuk ujian perisian sahaja. Mahkamah memutuskan bahawa defendan",
      "bertanggungan. The defendant shall pay synthetic damages of RM 100,000.",
      "[2] Kos sebanyak RM 5,000 diberikan kepada plaintif.",
    ].join("\n"),
    { lineGap: 4 },
  );
  doc.fontSize(9).text("Page 1 of 1", 72, 780, { align: "center", lineBreak: false });
  await finish(doc, "native-mixed-language.pdf");
}

async function nativeBlankPages() {
  const doc = new PDFDocument({ size: "A4", margin: 72 });
  doc.font("Helvetica").fontSize(12);
  doc.text("Page one has synthetic content before a deliberately blank page.");
  doc.addPage(); // intentionally blank
  doc.addPage();
  doc.text("Page three resumes after the blank page.");
  await finish(doc, "native-blank-pages.pdf");
}

function sh(cmd: string, args: string[]) {
  execFileSync(cmd, args, { stdio: "pipe" });
}

// Scanned variants: rasterize native-clean.pdf, then degrade.
function scannedVariants() {
  const base = path.join(OUT, "scan-base");
  sh("pdftoppm", ["-r", "200", "-png", path.join(OUT, "native-clean.pdf"), base]);
  const pages = readdirSync(OUT).filter((f) => f.startsWith("scan-base"));
  const p1 = path.join(OUT, pages.sort()[0]!);
  // clean scan (image-only, no text layer)
  sh("magick", [p1, path.join(OUT, "scan-clean.png")]);
  // rotated scan (~2.4 degrees skew)
  sh("magick", [p1, "-background", "white", "-rotate", "2.4", path.join(OUT, "scan-rotated.png")]);
  // faint scan (washed out, low contrast)
  sh("magick", [p1, "-brightness-contrast", "35x-60", "-blur", "0x0.6", path.join(OUT, "scan-faint.png")]);
  // noisy scan
  sh("magick", [p1, "-attenuate", "0.9", "+noise", "Gaussian", "-colorspace", "Gray", path.join(OUT, "scan-noisy.png")]);
  // image-only PDF wrapping the clean scan (a "scanned PDF" container)
  sh("magick", [path.join(OUT, "scan-clean.png"), path.join(OUT, "scanned-judgment.pdf")]);
  // ground truth for the scanned page = PAGE1 text
  writeFileSync(path.join(OUT, "scan-ground-truth.txt"), `SYNTHETIC LAW REPORTS — FOR TESTING ONLY\n${PAGE1}\nPage 1 of 2\n`);
}

async function main() {
  await nativeClean();
  await nativeTwoColumn();
  await nativeFootnotesTables();
  await nativeMixedLanguage();
  await nativeBlankPages();
  scannedVariants();
  console.log("Fixtures written to", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
