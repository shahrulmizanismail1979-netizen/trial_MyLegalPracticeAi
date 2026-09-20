import { useState, type CSSProperties, type ReactNode } from "react";
import {
  copyDraft,
  draftToHtml,
  exportDocx,
  exportHtml,
  exportMarkdown,
  exportPdf,
  exportRtf,
  exportTxt,
  printDraft,
  type ExportFormat,
} from "./index.js";

export interface DraftDocumentProps {
  content: string;
  className?: string;
  /** Accessible label for the document region. */
  ariaLabel?: string;
  /** Optional content displayed before the draft inside the paper. */
  header?: ReactNode;
  style?: CSSProperties;
}

const DOCUMENT_CSS = `
.draft-export-paper{width:210mm;max-width:100%;min-height:297mm;margin:0 auto;padding:25.4mm;background:#fff;color:#111;
box-sizing:border-box;box-shadow:0 8px 30px rgba(15,23,42,.14);font:12pt/1.55 "Times New Roman",Times,serif;overflow-wrap:anywhere}
.draft-export-paper h1,.draft-export-paper h2,.draft-export-paper h3,.draft-export-paper h4,.draft-export-paper h5,.draft-export-paper h6{font-family:inherit;line-height:1.3;margin:12pt 0 6pt}
.draft-export-paper h1{font-size:18pt}.draft-export-paper h2{font-size:16pt}.draft-export-paper h3{font-size:14pt}
.draft-export-paper p{margin:0 0 7pt;white-space:pre-wrap}.draft-export-paper ol,.draft-export-paper ul{margin:0 0 7pt;padding-left:24pt}
.draft-export-paper li{margin:2pt 0;white-space:pre-wrap}.draft-export-paper table{width:100%;border-collapse:collapse;margin:8pt 0}
.draft-export-paper table{max-width:100%;table-layout:fixed}.draft-export-paper th,.draft-export-paper td{border:1px solid #777;padding:5pt;text-align:left;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}
.draft-export-paper hr{border:0;border-top:1px solid #777;margin:10pt 0}
@media(max-width:850px){.draft-export-paper{width:100%;min-height:auto;padding:clamp(20px,7vw,48px);box-shadow:none}}
@media print{.draft-export-paper{width:210mm;min-height:297mm;margin:0;padding:25.4mm;box-shadow:none}
.draft-export-screen-only{display:none!important}@page{size:A4;margin:0}}`;

/**
 * Responsive A4 paper preview using exactly the same safe Markdown rendering as
 * HTML and print exports.
 */
export function DraftDocument({
  content,
  className,
  ariaLabel = "Draft document",
  header,
  style,
}: DraftDocumentProps) {
  return (
    <>
      <style>{DOCUMENT_CSS}</style>
      <article
        className={`draft-export-paper ${className ?? ""}`}
        style={style}
        aria-label={ariaLabel}
      >
        {header}
        <div dangerouslySetInnerHTML={{ __html: draftToHtml(content) }} />
      </article>
    </>
  );
}

export interface ExportButtonsProps {
  title: string;
  content: string;
  bm?: boolean;
  className?: string;
  buttonClassName?: string;
  hideMarkdown?: boolean;
  /** Disable every action in addition to the existing empty-content check. */
  disabled?: boolean;
  /** Called after a successful action, including asynchronous DOCX creation. */
  onExportComplete?: (format: ExportFormat) => void;
}

const DEFAULT_BTN =
  "inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50";

export function DraftExportButtons({
  title,
  content,
  bm = false,
  className,
  buttonClassName,
  hideMarkdown = false,
  disabled: disabledProp = false,
  onExportComplete,
}: ExportButtonsProps) {
  const [completed, setCompleted] = useState<ExportFormat | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const btn = buttonClassName ?? DEFAULT_BTN;
  const disabled = disabledProp || !content || busy;
  const opts = { title, text: content };

  const finish = (format: ExportFormat) => {
    setCompleted(format);
    onExportComplete?.(format);
    setTimeout(() => setCompleted((current) => (current === format ? null : current)), 2000);
  };

  const handleCopy = async () => {
    setError(null);
    try {
      if (await copyDraft(opts)) finish("copy");
      else setError(bm ? "Salinan gagal." : "Copy failed.");
    } catch {
      setError(bm ? "Salinan gagal." : "Copy failed.");
    }
  };

  const handleDocx = async () => {
    setBusy(true);
    setError(null);
    try {
      await exportDocx(opts);
      finish("docx");
    } catch {
      setError(bm ? "DOCX tidak dapat dimuat turun." : "DOCX download failed.");
    } finally {
      setBusy(false);
    }
  };

  const action = (format: ExportFormat, callback: () => void | boolean) => () => {
    setError(null);
    try {
      if (callback() !== false) finish(format);
      else setError(bm ? "Eksport gagal. Sila cuba lagi." : "Export failed. Please try again.");
    } catch {
      setError(bm ? "Eksport gagal. Sila cuba lagi." : "Export failed. Please try again.");
    }
  };

  return (
    <div className={`draft-export-screen-only flex flex-wrap gap-1.5 ${className ?? ""}`}>
      <button type="button" onClick={handleCopy} disabled={disabled} className={btn} data-testid="button-export-copy">
        {completed === "copy" ? (bm ? "Disalin" : "Copied") : bm ? "Salin" : "Copy"}
      </button>
      <button type="button" onClick={action("txt", () => exportTxt(opts))} disabled={disabled} className={btn} data-testid="button-export-txt">
        TXT
      </button>
      {!hideMarkdown && (
        <button type="button" onClick={action("md", () => exportMarkdown(opts))} disabled={disabled} className={btn} data-testid="button-export-md">
          Markdown
        </button>
      )}
      <button type="button" onClick={handleDocx} disabled={disabled} className={btn} data-testid="button-export-word">
        {busy ? (bm ? "Menyediakan…" : "Preparing…") : completed === "docx" ? (bm ? "Dimuat turun" : "Downloaded") : "DOCX"}
      </button>
      <button type="button" onClick={action("pdf", () => exportPdf(opts))} disabled={disabled} className={btn} data-testid="button-export-pdf">
        PDF
      </button>
      <button type="button" onClick={action("html", () => exportHtml(opts))} disabled={disabled} className={btn} data-testid="button-export-html">
        HTML
      </button>
      <button type="button" onClick={action("rtf", () => exportRtf(opts))} disabled={disabled} className={btn} data-testid="button-export-rtf">
        RTF
      </button>
      <button type="button" onClick={action("print", () => printDraft(opts))} disabled={disabled} className={btn} data-testid="button-export-print">
        {bm ? "Cetak A4" : "A4 Print"}
      </button>
      {error && (
        <span role="alert" className="basis-full text-xs text-destructive" data-testid="draft-export-error">
          {error}
        </span>
      )}
    </div>
  );
}