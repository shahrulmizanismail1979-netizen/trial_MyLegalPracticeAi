import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
} from "docx";
import { jsPDF } from "jspdf";

export type ExportFormat =
  | "copy"
  | "txt"
  | "md"
  | "doc"
  | "docx"
  | "html"
  | "rtf"
  | "pdf"
  | "print";

export interface DraftExportOptions {
  /** Document title — used for filenames and document metadata. */
  title: string;
  /** The original plain-text or Markdown draft. It is never mutated. */
  text: string;
}

export type DraftBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; rows: string[][] }
  | { type: "rule" };

const A4_CSS = `
@page { size: A4; margin: 25.4mm; }
html, body { box-sizing: border-box; }
body { color: #111; font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.55; margin: 25.4mm; overflow-wrap: anywhere; }
h1,h2,h3,h4,h5,h6 { font: bold 12pt/1.3 "Times New Roman",Times,serif; margin: 12pt 0 6pt; }
h1 { font-size: 18pt; } h2 { font-size: 16pt; } h3 { font-size: 14pt; }
p { margin: 0 0 7pt; white-space: pre-wrap; } ol,ul { margin: 0 0 7pt; padding-left: 24pt; }
li { margin: 2pt 0; white-space: pre-wrap; } table { width: 100%; border-collapse: collapse; margin: 8pt 0; }
table { max-width: 100%; table-layout: fixed; } th,td { border: 1px solid #777; padding: 5pt; text-align: left; vertical-align: top; white-space: pre-wrap; overflow-wrap: anywhere; }
hr { border: 0; border-top: 1px solid #777; margin: 10pt 0; }
code { font-family: "Courier New",monospace; font-size: 10pt; }`;

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "draft"
  );
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

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Removes Markdown emphasis syntax and any unmatched asterisks from presentation text. */
export function presentationText(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(^|[^\w])([*_])([^*_\n]+)\2(?=$|[^\w])/g, "$1$3")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*/g, "");
}

function isTableSeparator(line: string): boolean {
  const cells = line.trim().replace(/^\||\|$/g, "").split("|");
  return cells.length > 0 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** Parse the deliberately small Markdown subset used by generated legal drafts. */
export function parseDraft(text: string): DraftBlock[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: DraftBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (i + 1 < lines.length && trimmed.includes("|") && isTableSeparator(lines[i + 1])) {
      const rows = [tableCells(lines[i])];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(tableCells(lines[i++]));
      blocks.push({ type: "table", rows });
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: "rule" });
      i++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    const boldHeading = /^\*\*(.+)\*\*$/.exec(trimmed);
    if (boldHeading) {
      blocks.push({ type: "heading", level: 3, text: boldHeading[1] });
      i++;
      continue;
    }
    const item = /^([-+*]|\d+[.)])\s+(.*)$/.exec(trimmed);
    if (item) {
      const ordered = /^\d/.test(item[1]);
      const items: string[] = [];
      while (i < lines.length) {
        const match = /^([-+*]|\d+[.)])\s+(.*)$/.exec(lines[i].trim());
        if (!match || /^\d/.test(match[1]) !== ordered) break;
        items.push(match[2]);
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    const paragraph = [trimmed];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6})\s+|^([-+*]|\d+[.)])\s+/.test(lines[i].trim())) {
      if (i + 1 < lines.length && lines[i].includes("|") && isTableSeparator(lines[i + 1])) break;
      paragraph.push(lines[i++].trim());
    }
    blocks.push({ type: "paragraph", text: paragraph.join("\n") });
  }
  return blocks;
}

function inlineHtml(value: string): string {
  let html = escapeHtml(value);
  html = html
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  return html.replace(/\*/g, "");
}

/** Safe HTML fragment suitable for both the preview and exported documents. */
export function draftToHtml(text: string): string {
  return parseDraft(text)
    .map((block) => {
      if (block.type === "heading") return `<h${block.level}>${inlineHtml(block.text)}</h${block.level}>`;
      if (block.type === "paragraph") return `<p>${inlineHtml(block.text).replace(/\n/g, "<br>")}</p>`;
      if (block.type === "rule") return "<hr>";
      if (block.type === "list") {
        const tag = block.ordered ? "ol" : "ul";
        return `<${tag}>${block.items.map((item) => `<li>${inlineHtml(item)}</li>`).join("")}</${tag}>`;
      }
      const [header, ...rows] = block.rows;
      return `<table><thead><tr>${header.map((cell) => `<th>${inlineHtml(cell)}</th>`).join("")}</tr></thead><tbody>${rows
        .map((row) => `<tr>${row.map((cell) => `<td>${inlineHtml(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`;
    })
    .join("\n");
}

export function draftToPlainText(text: string): string {
  return parseDraft(text)
    .map((block) => {
      if (block.type === "rule") return "—";
      if (block.type === "list")
        return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : "•"} ${presentationText(item)}`).join("\n");
      if (block.type === "table") return block.rows.map((row) => row.map(presentationText).join("\t")).join("\n");
      return presentationText(block.text);
    })
    .join("\n\n");
}

export function createDraftHtml({ title, text }: DraftExportOptions): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(presentationText(title))}</title><style>${A4_CSS}</style></head><body>${draftToHtml(text)}</body></html>`;
}

export async function copyDraft({ text }: DraftExportOptions): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(draftToPlainText(text));
    return true;
  } catch {
    return false;
  }
}

export function exportTxt({ title, text }: DraftExportOptions): void {
  downloadBlob(new Blob([draftToPlainText(text)], { type: "text/plain;charset=utf-8" }), `${slugify(title)}.txt`);
}

/**
 * Download a readable Markdown-compatible text file. Presentation markers are
 * removed from the download; the caller's original stored source is untouched.
 */
export function exportMarkdown({ title, text }: DraftExportOptions): void {
  downloadBlob(new Blob([draftToPlainText(text)], { type: "text/markdown;charset=utf-8" }), `${slugify(title)}.md`);
}

export function exportHtml(opts: DraftExportOptions): void {
  downloadBlob(new Blob(["\ufeff", createDraftHtml(opts)], { type: "text/html;charset=utf-8" }), `${slugify(opts.title)}.html`);
}

/** Backwards-compatible Word HTML export. It remains correctly named .doc, never .docx. */
export function exportWord(opts: DraftExportOptions): void {
  downloadBlob(new Blob(["\ufeff", createDraftHtml(opts)], { type: "application/msword" }), `${slugify(opts.title)}.doc`);
}

function docxParagraph(text: string, options: IParagraphOptions = {}): Paragraph {
  return new Paragraph({ ...options, children: [new TextRun(presentationText(text))] });
}

/** Generate and download a genuine Office Open XML Word document. */
export async function exportDocx(opts: DraftExportOptions): Promise<void> {
  const children: (Paragraph | Table)[] = [];
  for (const block of parseDraft(opts.text)) {
    if (block.type === "heading") {
      const levels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
      children.push(docxParagraph(block.text, { heading: levels[block.level - 1] }));
    } else if (block.type === "paragraph") {
      for (const line of block.text.split("\n")) children.push(docxParagraph(line, { spacing: { after: 140 } }));
    } else if (block.type === "list") {
      block.items.forEach((item, index) =>
        children.push(docxParagraph(item, block.ordered ? { numbering: { reference: "draft-numbering", level: 0 } } : { bullet: { level: 0 } })),
      );
    } else if (block.type === "table") {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: block.rows.map(
            (row) => new TableRow({ children: row.map((cell) => new TableCell({ children: [docxParagraph(cell)] })) }),
          ),
        }),
      );
    } else {
      children.push(new Paragraph({ border: { bottom: { color: "777777", size: 6, style: "single" } } }));
    }
  }
  const doc = new Document({
    creator: "Draft Export",
    title: presentationText(opts.title),
    numbering: { config: [{ reference: "draft-numbering", levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.START }] }] },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children }],
  });
  downloadBlob(await Packer.toBlob(doc), `${slugify(opts.title)}.docx`);
}

function rtfEscape(value: string): string {
  return value.replace(/[\\{}]/g, "\\$&").replace(/\n/g, "\\line ").replace(/[^\x20-\x7e]/g, (char) => `\\u${char.charCodeAt(0)}?`);
}

export function exportRtf({ title, text }: DraftExportOptions): void {
  const body = rtfEscape(draftToPlainText(text)).replace(/\n\n/g, "\\par\\par ").replace(/\n/g, "\\line ");
  const rtf = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Times New Roman;}}\\paperw11906\\paperh16838\\margl1440\\margr1440\\margt1440\\margb1440\\fs24 ${body}}`;
  downloadBlob(new Blob([rtf], { type: "application/rtf" }), `${slugify(title)}.rtf`);
}

/** Built-in jsPDF fonts are not Unicode fonts; these drafts must use browser print. */
export function requiresUnicodePdfFallback({ title, text }: DraftExportOptions): boolean {
  const pdfText = draftToPlainText(text).replace(/^• /gm, "- ").replace(/^—$/gm, "---");
  return /[^\x09\x0a\x0d\x20-\x7e]/.test(
    `${presentationText(title)}\n${pdfText}`,
  );
}

/**
 * Download a real A4 PDF when the built-in font can represent every character.
 * Unicode drafts explicitly open the browser's Unicode-safe A4 print flow
 * instead of creating a silently corrupted file.
 */
export function exportPdf(opts: DraftExportOptions): boolean {
  if (requiresUnicodePdfFallback(opts)) {
    const opened = printDraft(opts);
    if (typeof window.alert === "function") {
      window.alert(
        opened
          ? "This draft contains characters that the PDF download font cannot safely represent. The Unicode-safe A4 print dialog has been opened; choose “Save as PDF”."
          : "This draft contains characters that the PDF download font cannot safely represent. Allow pop-ups, then use A4 Print and choose “Save as PDF”.",
      );
    }
    return opened;
  }
  try {
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    pdf.setProperties({ title: presentationText(opts.title) });
    pdf.setFont("times", "normal");
    pdf.setFontSize(12);
    const margin = 25.4;
    const pdfText = draftToPlainText(opts.text).replace(/^• /gm, "- ").replace(/^—$/gm, "---");
    const lines = pdf.splitTextToSize(pdfText, 210 - margin * 2) as string[];
    let y = margin;
    for (const line of lines) {
      if (y > 297 - margin) {
        pdf.addPage("a4", "portrait");
        y = margin;
      }
      pdf.text(line, margin, y);
      y += 6.2;
    }
    pdf.save(`${slugify(opts.title)}.pdf`);
    return true;
  } catch {
    return false;
  }
}

/** Open the shared A4 rendering for browser printing. */
export function printDraft(opts: DraftExportOptions): boolean {
  const popup = window.open("", "_blank");
  if (!popup) return false;
  popup.document.open();
  popup.document.write(createDraftHtml(opts));
  popup.document.close();
  popup.focus();
  setTimeout(() => {
    try {
      popup.print();
    } catch {
      // The user may close the print window first.
    }
  }, 250);
  return true;
}

export async function exportDraft(format: ExportFormat, opts: DraftExportOptions): Promise<boolean> {
  if (format === "copy") return copyDraft(opts);
  if (format === "txt") exportTxt(opts);
  else if (format === "md") exportMarkdown(opts);
  else if (format === "doc") exportWord(opts);
  else if (format === "docx") await exportDocx(opts);
  else if (format === "html") exportHtml(opts);
  else if (format === "rtf") exportRtf(opts);
  else if (format === "pdf") return exportPdf(opts);
  else return printDraft(opts);
  return true;
}

export const EXPORT_FORMATS: { format: ExportFormat; labelEn: string; labelBm: string }[] = [
  { format: "copy", labelEn: "Copy", labelBm: "Salin" },
  { format: "txt", labelEn: "TXT", labelBm: "TXT" },
  { format: "md", labelEn: "Markdown", labelBm: "Markdown" },
  { format: "doc", labelEn: "Word (.doc)", labelBm: "Word (.doc)" },
  { format: "docx", labelEn: "DOCX", labelBm: "DOCX" },
  { format: "html", labelEn: "HTML", labelBm: "HTML" },
  { format: "rtf", labelEn: "RTF", labelBm: "RTF" },
  { format: "pdf", labelEn: "PDF", labelBm: "PDF" },
  { format: "print", labelEn: "Print", labelBm: "Cetak" },
];