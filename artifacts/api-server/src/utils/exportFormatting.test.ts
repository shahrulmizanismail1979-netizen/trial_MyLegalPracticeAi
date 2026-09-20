import { describe, expect, it } from "vitest";
import { exportPlainText, normalizeExportLines } from "./exportFormatting";

describe("export presentation formatting", () => {
  it("turns Markdown emphasis and lists into formatting without visible asterisks", () => {
    const source = "**Bold** and *italic* plus a stray *\n* **listed**";
    const lines = normalizeExportLines(source);

    expect(lines[0]).toMatchObject({
      kind: "paragraph",
      runs: [
        { text: "Bold", bold: true },
        { text: " and " },
        { text: "italic", italics: true },
        { text: " plus a stray " },
      ],
    });
    expect(lines[1]).toMatchObject({
      kind: "bullet",
      runs: [{ text: "listed", bold: true }],
    });
    expect(lines.flatMap((line) => line.runs).map((run) => run.text).join(""))
      .not.toContain("*");
    expect(source).toBe("**Bold** and *italic* plus a stray *\n* **listed**");
  });

  it("preserves content while removing residual ASCII asterisks for presentation", () => {
    expect(exportPlainText("File **ABC** * incomplete")).toBe("File ABC  incomplete");
    expect(normalizeExportLines("1. **First**\n(a) *Second*")).toMatchObject([
      { kind: "numbered", marker: "1.", runs: [{ text: "First", bold: true }] },
      { kind: "numbered", marker: "(a)", runs: [{ text: "Second", italics: true }] },
    ]);
  });
});