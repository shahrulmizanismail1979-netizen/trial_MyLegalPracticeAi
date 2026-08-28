import { describe, expect, it } from "vitest";
import { buildCaseReportExport, type PublicCaseReport } from "./caseReportExport";

const report: PublicCaseReport = {
  id: 522,
  caseName: "A & B <C>",
  citation: "[2025] LAWYes 522",
  court: "High Court in Sabah and Sarawak",
  decisionDate: "2025-08-01",
  reportState: "Published",
  verificationDate: "2025-08-02T00:00:00.000Z",
  rightsStatus: "OFFICIAL_COURT_SOURCE",
  sourceUrl: "https://example.invalid/judgment/522",
  sourceName: "Official judgment.pdf",
  sections: [{
    id: "facts",
    title: "Facts",
    content: ["The supported fact."],
    pinpoints: ["[1]"],
  }],
  paragraphs: [{ paragraphRef: "[1]", pageNumber: 1, text: "Judicial text." }],
};

describe("case report exports", () => {
  it("creates genuine DOCX and A4 PDF files", async () => {
    const [docx, pdf] = await Promise.all([
      buildCaseReportExport(report, "docx"),
      buildCaseReportExport(report, "pdf"),
    ]);
    expect(docx.contentType).toContain("wordprocessingml");
    expect(docx.buffer.subarray(0, 2).toString()).toBe("PK");
    expect(pdf.contentType).toBe("application/pdf");
    expect(pdf.buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("escapes report values in print HTML and labels structured JSON", async () => {
    const [html, json] = await Promise.all([
      buildCaseReportExport(report, "html"),
      buildCaseReportExport(report, "json"),
    ]);
    expect(html.buffer.toString()).toContain("A &amp; B &lt;C&gt;");
    expect(html.buffer.toString()).not.toContain("<h1>A & B <C></h1>");
    expect(JSON.parse(json.buffer.toString()).schema).toContain("judgment-report/v1");
  });

  it("includes source provenance and paragraph pinpoints in text", async () => {
    const text = await buildCaseReportExport(report, "text");
    expect(text.buffer.toString()).toContain("The supported fact. ([1])");
    expect(text.buffer.toString()).toContain("https://example.invalid/judgment/522");
  });

  it("supports every permitted report representation", async () => {
    const exports = await Promise.all(
      (["docx", "pdf", "text", "json", "html", "citation"] as const).map(
        (format) => buildCaseReportExport(report, format),
      ),
    );
    expect(exports.map((item) => item.filename.split(".").pop())).toEqual([
      "docx", "pdf", "txt", "json", "html", "txt",
    ]);
    expect(exports.every((item) => item.buffer.length > 0)).toBe(true);
  });
});