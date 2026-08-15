export type ExportFormat = "copy" | "txt" | "md" | "doc" | "pdf";

export interface DraftExportOptions {
  /** Document title — used for filenames and the print/Word heading. */
  title: string;
  /** The plain-text (or markdown) draft content. */
  text: string;
}

function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return s || "draft";
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Convert inline markdown (bold, italic) inside an already HTML-escaped string
 * into the corresponding HTML tags. Operates on escaped text so it is safe to
 * inject into the document body.
 */
function inlineMarkdownToHtml(escaped: string): string {
  return escaped
    // Bold: **text** or __text__
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    // Italic: *text* or _text_ (single delimiter, no surrounding word chars)
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>")
    // Inline code: `code`
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/**
 * Convert markdown-flavoured draft text into clean formatted HTML for Word/PDF
 * export. Handles headings (#…), bold/italic, bullet and numbered lists,
 * horizontal rules and paragraphs so exported files no longer show raw
 * markdown symbols (e.g. **asterisks** around titles).
 */
function markdownToHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = (): void => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/g, "");
    const trimmed = line.trim();

    if (trimmed === "") {
      closeList();
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeList();
      html.push("<hr />");
      continue;
    }

    // ATX headings: #, ##, ###…
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(
        `<h${level}>${inlineMarkdownToHtml(escapeHtml(heading[2]))}</h${level}>`,
      );
      continue;
    }

    // Bold-only line treated as a heading (common AI output: **Title**)
    const boldHeading = /^\*\*([^*]+)\*\*$/.exec(trimmed);
    if (boldHeading) {
      closeList();
      html.push(`<h3>${inlineMarkdownToHtml(escapeHtml(boldHeading[1]))}</h3>`);
      continue;
    }

    // Numbered paragraph (e.g. "4. …", "5) …"). Do NOT convert to <ol> —
    // that would discard the author's explicit numbering and renumber from 1.
    // Legal drafting relies on the literal numbers (sequences starting other
    // than 1, resuming after blank lines), so preserve them verbatim as an
    // indented paragraph.
    const ordered = /^(\d+[.)])\s+(.*)$/.exec(trimmed);
    if (ordered) {
      closeList();
      html.push(
        `<p class="numbered">${escapeHtml(ordered[1])} ${inlineMarkdownToHtml(escapeHtml(ordered[2]))}</p>`,
      );
      continue;
    }

    // Bullet list item
    const bullet = /^[-•*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${inlineMarkdownToHtml(escapeHtml(bullet[1]))}</li>`);
      continue;
    }

    // Normal paragraph
    closeList();
    html.push(`<p>${inlineMarkdownToHtml(escapeHtml(trimmed))}</p>`);
  }

  closeList();
  return html.join("\n");
}

/** Copy the draft text to the clipboard. Returns false if the clipboard is unavailable. */
export async function copyDraft({ text }: DraftExportOptions): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Download the draft as a plain-text .txt file. */
export function exportTxt({ title, text }: DraftExportOptions): void {
  downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${slugify(title)}.txt`);
}

/** Download the draft as a Markdown .md file. */
export function exportMarkdown({ title, text }: DraftExportOptions): void {
  downloadBlob(new Blob([text], { type: "text/markdown;charset=utf-8" }), `${slugify(title)}.md`);
}

function draftHtml(title: string, text: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.6; margin: 2.54cm; }
h1, h2, h3, h4, h5, h6 { font-family: inherit; font-weight: bold; margin: 1em 0 0.4em; }
h1 { font-size: 18pt; } h2 { font-size: 16pt; } h3 { font-size: 14pt; }
h4, h5, h6 { font-size: 12pt; }
p { margin: 0 0 0.6em; }
p.numbered { padding-left: 1.6em; text-indent: -1.6em; }
ul { margin: 0 0 0.6em; padding-left: 1.6em; }
li { margin: 0.15em 0; }
code { font-family: "Courier New", monospace; }
hr { border: none; border-top: 1px solid #999; margin: 1em 0; }
</style></head><body>${markdownToHtml(text)}</body></html>`;
}

/**
 * Download the draft as a Word-compatible .doc file (HTML-based; opens in
 * Microsoft Word, Google Docs, and LibreOffice).
 */
export function exportWord({ title, text }: DraftExportOptions): void {
  downloadBlob(
    new Blob(["\ufeff", draftHtml(title, text)], { type: "application/msword" }),
    `${slugify(title)}.doc`,
  );
}

/**
 * Open the browser print dialog with a clean document layout so the user can
 * save the draft as a PDF. Returns false if the popup was blocked.
 */
export function exportPdf({ title, text }: DraftExportOptions): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(draftHtml(title, text));
  w.document.close();
  w.focus();
  // Give the new window a moment to render before printing.
  setTimeout(() => {
    try {
      w.print();
    } catch {
      /* window may have been closed */
    }
  }, 250);
  return true;
}

/** Dispatch helper: run the given export format. */
export async function exportDraft(format: ExportFormat, opts: DraftExportOptions): Promise<boolean> {
  switch (format) {
    case "copy":
      return copyDraft(opts);
    case "txt":
      exportTxt(opts);
      return true;
    case "md":
      exportMarkdown(opts);
      return true;
    case "doc":
      exportWord(opts);
      return true;
    case "pdf":
      return exportPdf(opts);
  }
}

/** The standard set of export formats with display labels, for building button rows. */
export const EXPORT_FORMATS: { format: ExportFormat; labelEn: string; labelBm: string }[] = [
  { format: "copy", labelEn: "Copy", labelBm: "Salin" },
  { format: "txt", labelEn: "TXT", labelBm: "TXT" },
  { format: "md", labelEn: "Markdown", labelBm: "Markdown" },
  { format: "doc", labelEn: "Word", labelBm: "Word" },
  { format: "pdf", labelEn: "PDF", labelBm: "PDF" },
];
