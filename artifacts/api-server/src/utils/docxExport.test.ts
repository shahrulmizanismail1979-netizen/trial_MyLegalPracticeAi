import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
import { buildLandOfficeDocx } from "./docxExport";

describe("writing DOCX export", () => {
  it("keeps firm/signature structure, uses A4, and renders Markdown presentation", async () => {
    const source = "# Advice\n**Important** term\n* first **item**\nResidual * marker";
    const buffer = await buildLandOfficeDocx({
      title: "**Client Advice**",
      content: source,
      docType: "firm",
      refNo: "REF-*42",
      parties: "**Client** and Firm",
      dateStr: "20 September 2026*",
    });
    const zip = new AdmZip(buffer);
    const xml = zip.readAsText("word/document.xml");

    expect(xml).toContain('w:w="11906"');
    expect(xml).toContain('w:h="16838"');
    // Preserve the legacy title-block convention: document titles are uppercase.
    expect(xml).toContain("CLIENT ADVICE");
    expect(xml).toContain("Important");
    expect(xml).toContain("•");
    expect(xml).toContain("Tandatangan / Signature");
    expect(xml).toContain("<w:b");
    expect(xml).not.toContain("**");
    expect(xml).not.toContain("Residual * marker");
    expect(xml).not.toContain("*");
    expect(source).toContain("**Important**");
  });
});