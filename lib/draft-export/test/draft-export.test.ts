import { describe, expect, it } from "vitest";
import {
  createDraftHtml,
  draftToHtml,
  draftToPlainText,
  exportDocx,
  exportMarkdown,
  exportPdf,
  parseDraft,
  presentationText,
  requiresUnicodePdfFallback,
} from "../src/index.js";

describe("draft presentation", () => {
  it("renders emphasis and bullets without visible ASCII asterisks", () => {
    const source = "**Heading**\n\n* A **bold** item\n* unmatched * marker";
    const html = draftToHtml(source);
    const plain = draftToPlainText(source);

    expect(html).toContain("<h3>Heading</h3>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).not.toContain("*");
    expect(plain).toContain("• A bold item");
    expect(plain).not.toContain("*");
    expect(source).toContain("**Heading**");
  });

  it("escapes untrusted HTML while retaining multiline text and tables", () => {
    const source = "<script>alert(1)</script>\nsecond line\n\nName | Value\n--- | ---\nA | B";
    const html = draftToHtml(source);
    const blocks = parseDraft(source);

    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("second line");
    expect(html).toContain("<table>");
    expect(blocks.at(-1)?.type).toBe("table");
  });

  it("creates an A4, UTF-8 standalone HTML document", () => {
    const html = createDraftHtml({ title: `Advice "A"`, text: "# **Advice**" });

    expect(html).toContain("@page { size: A4");
    expect(html).toContain("<meta charset=\"utf-8\">");
    expect(html).toContain("<title>Advice &quot;A&quot;</title>");
    expect(html).not.toContain("*");
  });

  it("removes residual presentation markers but not ordinary underscores", () => {
    expect(presentationText("A *draft* with stray * and file_name")).toBe(
      "A draft with stray  and file_name",
    );
  });

  it("builds a genuine ZIP-based DOCX with the correct extension", async () => {
    let downloadedBlob: Blob | undefined;
    let downloadedName = "";
    const originalDocument = globalThis.document;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      downloadedBlob = blob as Blob;
      return "blob:test";
    };
    URL.revokeObjectURL = () => {};
    globalThis.document = {
      body: { appendChild: () => {} },
      createElement: () => ({
        click: () => {},
        remove: () => {},
        set href(_value: string) {},
        set download(value: string) {
          downloadedName = value;
        },
      }),
    } as unknown as Document;

    try {
      await exportDocx({ title: "Legal Advice", text: "**Advice**\n\n* First" });
      const signature = new Uint8Array(await downloadedBlob!.slice(0, 2).arrayBuffer());
      expect([...signature]).toEqual([0x50, 0x4b]);
      expect(downloadedName).toBe("legal-advice.docx");
    } finally {
      globalThis.document = originalDocument;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it("sanitizes Markdown downloads without changing the source value", async () => {
    const source = "**Advice** with a stray *";
    let downloadedBlob: Blob | undefined;
    const originalDocument = globalThis.document;
    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      downloadedBlob = blob as Blob;
      return "blob:test";
    };
    globalThis.document = {
      body: { appendChild: () => {} },
      createElement: () => ({ click: () => {}, remove: () => {} }),
    } as unknown as Document;

    try {
      exportMarkdown({ title: "Advice", text: source });
      expect(await downloadedBlob!.text()).toBe("Advice with a stray ");
      expect(source).toBe("**Advice** with a stray *");
    } finally {
      globalThis.document = originalDocument;
      URL.createObjectURL = originalCreateObjectURL;
    }
  });

  it("uses an explicit Unicode-safe print fallback instead of corrupting PDF text", () => {
    const opts = { title: "Legal advice", text: "نصيحة قانونية 法律意见" };
    expect(requiresUnicodePdfFallback(opts)).toBe(true);

    let alertMessage = "";
    let printed = false;
    const originalWindow = globalThis.window;
    globalThis.window = {
      open: () => ({
        document: { open: () => {}, write: () => {}, close: () => {} },
        focus: () => {},
        print: () => {
          printed = true;
        },
      }),
      alert: (message: string) => {
        alertMessage = message;
      },
    } as unknown as Window & typeof globalThis;

    try {
      expect(exportPdf(opts)).toBe(true);
      expect(alertMessage).toContain("Unicode-safe A4 print");
    } finally {
      globalThis.window = originalWindow;
    }
    expect(printed).toBe(false);
  });
});