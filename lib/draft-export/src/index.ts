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
pre { font-family: inherit; white-space: pre-wrap; word-wrap: break-word; margin: 0; }
</style></head><body><pre>${escapeHtml(text)}</pre></body></html>`;
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
