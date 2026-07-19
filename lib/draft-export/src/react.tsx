import { useState } from "react";
import {
  copyDraft,
  exportTxt,
  exportMarkdown,
  exportWord,
  exportPdf,
} from "./index.js";

export interface ExportButtonsProps {
  /** Document title — used for filenames and the print/Word heading. */
  title: string;
  /** The draft content to export. */
  content: string;
  /** Use Bahasa Melayu labels. */
  bm?: boolean;
  /** Extra classes for the wrapping element. */
  className?: string;
  /** Override the per-button classes (defaults to a small pill style). */
  buttonClassName?: string;
  /** Hide the Markdown button (for apps whose output is plain text). */
  hideMarkdown?: boolean;
}

const DEFAULT_BTN =
  "inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50";

/**
 * A row of export buttons: Copy, TXT, Markdown, Word (.doc), PDF (print).
 * Framework-free styling via Tailwind utility classes shared by all apps.
 */
export function DraftExportButtons({
  title,
  content,
  bm = false,
  className,
  buttonClassName,
  hideMarkdown = false,
}: ExportButtonsProps) {
  const [copied, setCopied] = useState(false);
  const btn = buttonClassName ?? DEFAULT_BTN;
  const disabled = !content;
  const opts = { title, text: content };

  const handleCopy = async () => {
    const ok = await copyDraft(opts);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      <button type="button" onClick={handleCopy} disabled={disabled} className={btn} data-testid="button-export-copy">
        {copied ? (bm ? "Disalin" : "Copied") : bm ? "Salin" : "Copy"}
      </button>
      <button type="button" onClick={() => exportTxt(opts)} disabled={disabled} className={btn} data-testid="button-export-txt">
        TXT
      </button>
      {!hideMarkdown && (
        <button type="button" onClick={() => exportMarkdown(opts)} disabled={disabled} className={btn} data-testid="button-export-md">
          Markdown
        </button>
      )}
      <button type="button" onClick={() => exportWord(opts)} disabled={disabled} className={btn} data-testid="button-export-word">
        Word
      </button>
      <button type="button" onClick={() => exportPdf(opts)} disabled={disabled} className={btn} data-testid="button-export-pdf">
        PDF
      </button>
    </div>
  );
}
