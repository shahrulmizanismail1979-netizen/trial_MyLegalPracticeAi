import PDFDocument from "pdfkit";
import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";

export type CaseReportExportFormat =
  | "docx"
  | "pdf"
  | "text"
  | "json"
  | "html"
  | "citation";

export interface PublicCaseReport {
  id: number;
  caseName: string;
  citation: string;
  court: string;
  decisionDate: string;
  reportState: "Published";
  verificationDate: string;
  rightsStatus: string;
  sourceUrl: string | null;
  sourceName: string;
  sections: Array<{
    id: string;
    title: string;
    content: string | string[];
    pinpoints?: string[];
  }>;
  paragraphs: Array<{ paragraphRef: string; pageNumber: number; text: string }>;
}

export interface CaseReportExport {
  contentType: string;
  filename: string;
  buffer: Buffer;
}

const MISSING = "Not stated in the published judgment";

function safeName(value: string): string {
  return (value || "LAWYes-case-report")
    .replace(/[^\p{L}\p{N} ._-]+/gu, "_")
    .trim()
    .slice(0, 80) || "LAWYes-case-report";
}

function values(content: string | string[]): string[] {
  const result = Array.isArray(content) ? content : [content];
  return result.filter(Boolean).length ? result.filter(Boolean) : [MISSING];
}

function reportText(report: PublicCaseReport): string {
  const lines = [
    "LAWYes JUDGMENT LIBRARY",
    report.caseName,
    report.citation,
    `${report.court} | ${report.decisionDate}`,
    `Status: ${report.reportState} | Verified: ${report.verificationDate}`,
    `Rights: ${report.rightsStatus}`,
    `Original source: ${report.sourceUrl ?? report.sourceName}`,
    "",
  ];
  for (const section of report.sections) {
    lines.push(section.title.toUpperCase());
    values(section.content).forEach((item, index) => {
      const pinpoint = section.pinpoints?.[index];
      lines.push(`${item}${pinpoint ? ` (${pinpoint})` : ""}`);
    });
    lines.push("");
  }
  lines.push("JUDGMENT");
  report.paragraphs.forEach((p) => lines.push(`${p.paragraphRef} ${p.text}`));
  lines.push(
    "",
    "Provenance: LAWYes original editorial report prepared from the verified official or authorised judgment identified above.",
  );
  return lines.join("\n");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function renderHtml(report: PublicCaseReport): string {
  const sections = report.sections.map((section) => `
    <section id="${escapeHtml(section.id)}">
      <h2>${escapeHtml(section.title)}</h2>
      ${values(section.content).map((item, index) =>
        `<p>${escapeHtml(item)}${section.pinpoints?.[index] ? ` <a href="#${escapeHtml(section.pinpoints[index]!.replace(/[[\]]/g, ""))}">${escapeHtml(section.pinpoints[index]!)}</a>` : ""}</p>`,
      ).join("")}
    </section>`).join("");
  const paragraphs = report.paragraphs.map((p) =>
    `<p id="${escapeHtml(p.paragraphRef.replace(/[[\]]/g, ""))}"><strong>${escapeHtml(p.paragraphRef)}</strong> ${escapeHtml(p.text)}</p>`,
  ).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(report.caseName)} | LAWYes</title>
<style>@page{size:A4;margin:20mm}body{font:11pt Georgia,serif;line-height:1.55;color:#172033;max-width:170mm;margin:auto}header{border-bottom:3px solid #123b5d;margin-bottom:1.5rem}h1{font-size:22pt}h2{font:700 12pt Arial,sans-serif;color:#123b5d;border-bottom:1px solid #ccd5dd;padding-bottom:.25rem}a{color:#075985}@media print{.no-print{display:none}}</style></head><body>
<header><strong>LAWYes JUDGMENT LIBRARY</strong><h1>${escapeHtml(report.caseName)}</h1><p>${escapeHtml(report.citation)} · ${escapeHtml(report.court)} · ${escapeHtml(report.decisionDate)}</p><p>Status: ${report.reportState} · Verified ${escapeHtml(report.verificationDate)} · Rights: ${escapeHtml(report.rightsStatus)}</p></header>
${sections}<section><h2>Judgment</h2>${paragraphs}</section>
<footer><p>LAWYes original editorial report. Source: ${report.sourceUrl ? `<a href="${escapeHtml(report.sourceUrl)}">${escapeHtml(report.sourceName)}</a>` : escapeHtml(report.sourceName)}</p></footer></body></html>`;
}

async function renderDocx(report: PublicCaseReport): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ text: "LAWYes JUDGMENT LIBRARY", alignment: AlignmentType.CENTER }),
    new Paragraph({ text: report.caseName, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: report.citation, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: `${report.court} · ${report.decisionDate}`, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: `Published · Verified ${report.verificationDate} · ${report.rightsStatus}`, alignment: AlignmentType.CENTER }),
  ];
  for (const section of report.sections) {
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }));
    values(section.content).forEach((item, index) => {
      const pinpoint = section.pinpoints?.[index];
      children.push(new Paragraph({
        children: [
          new TextRun(item),
          ...(pinpoint ? [new TextRun({ text: ` (${pinpoint})`, italics: true })] : []),
        ],
      }));
    });
  }
  children.push(new Paragraph({ text: "Judgment", heading: HeadingLevel.HEADING_1 }));
  report.paragraphs.forEach((p) => children.push(new Paragraph({
    children: [
      new TextRun({ text: `${p.paragraphRef} `, bold: true }),
      new TextRun(p.text),
    ],
  })));
  children.push(new Paragraph({
    children: [new TextRun({
      text: `Provenance: verified official or authorised source — ${report.sourceUrl ?? report.sourceName}`,
      italics: true,
    })],
  }));
  const doc = new Document({
    title: report.caseName,
    description: "LAWYes published judgment report",
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } },
      },
      footers: {
        default: new Footer({ children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun("LAWYes · Published report · Page "), new TextRun({ children: [PageNumber.CURRENT] })],
        })] }),
      },
      children,
    }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

function renderPdf(report: PublicCaseReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 56, right: 56, bottom: 62, left: 56 }, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#123b5d").text("LAWYes JUDGMENT LIBRARY", { align: "center" });
    doc.moveDown().fontSize(20).fillColor("#172033").text(report.caseName, { align: "center" });
    doc.moveDown(.4).fontSize(11).text(report.citation, { align: "center" });
    doc.font("Helvetica").fontSize(9).text(`${report.court} · ${report.decisionDate}`, { align: "center" });
    doc.text(`Published · Verified ${report.verificationDate} · ${report.rightsStatus}`, { align: "center" });
    for (const section of report.sections) {
      doc.moveDown().font("Helvetica-Bold").fontSize(12).fillColor("#123b5d").text(section.title);
      values(section.content).forEach((item, index) => {
        const pinpoint = section.pinpoints?.[index];
        doc.font("Times-Roman").fontSize(10).fillColor("#172033").text(`${item}${pinpoint ? ` (${pinpoint})` : ""}`, { lineGap: 2 });
      });
    }
    doc.moveDown().font("Helvetica-Bold").fontSize(12).fillColor("#123b5d").text("Judgment");
    report.paragraphs.forEach((p) => doc.font("Times-Roman").fontSize(10).fillColor("#172033").text(`${p.paragraphRef}  ${p.text}`, { lineGap: 2 }));
    doc.moveDown().font("Helvetica-Oblique").fontSize(8).fillColor("#555").text(`Provenance: verified official or authorised source — ${report.sourceUrl ?? report.sourceName}`);
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font("Helvetica").fontSize(8).fillColor("#666").text(
        `LAWYes · ${report.citation} · Page ${i + 1} of ${range.count}`,
        56,
        doc.page.height - 38,
        { width: doc.page.width - 112, align: "center" },
      );
    }
    doc.end();
  });
}

export async function buildCaseReportExport(
  report: PublicCaseReport,
  format: CaseReportExportFormat,
): Promise<CaseReportExport> {
  const name = safeName(report.citation || report.caseName);
  if (format === "docx") return { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", filename: `${name}.docx`, buffer: await renderDocx(report) };
  if (format === "pdf") return { contentType: "application/pdf", filename: `${name}.pdf`, buffer: await renderPdf(report) };
  if (format === "json") return { contentType: "application/json; charset=utf-8", filename: `${name}.json`, buffer: Buffer.from(JSON.stringify({ schema: "https://lawyes.my/schemas/judgment-report/v1", ...report }, null, 2)) };
  if (format === "html") return { contentType: "text/html; charset=utf-8", filename: `${name}.html`, buffer: Buffer.from(renderHtml(report)) };
  if (format === "citation") return { contentType: "text/plain; charset=utf-8", filename: `${name}-citation.txt`, buffer: Buffer.from(`${report.caseName} ${report.citation} (${report.court}, ${report.decisionDate})`) };
  return { contentType: "text/plain; charset=utf-8", filename: `${name}.txt`, buffer: Buffer.from(reportText(report)) };
}