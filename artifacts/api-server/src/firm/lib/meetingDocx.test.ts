import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
import { buildMinutesDocx } from "./meetingDocx";

describe("meeting DOCX export", () => {
  it("uses A4 and renders emphasis without literal Markdown asterisks", async () => {
    const buffer = await buildMinutesDocx({
      title: "Weekly meeting",
      summary: "**Important** summary with stray *",
      attendees: ["*Alice*"],
      agenda: [],
      decisions: [],
      actionItems: [],
    }, "en");
    const zip = new AdmZip(buffer);
    const documentXml = zip.readAsText("word/document.xml");

    expect(documentXml).toContain('w:w="11906"');
    expect(documentXml).toContain('w:h="16838"');
    expect(documentXml).toContain("<w:b");
    expect(documentXml).toContain("Important");
    expect(documentXml).not.toContain("**Important**");
    expect(documentXml).not.toContain("stray *");
  });
});