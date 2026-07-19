import { useState } from 'react';
import { FileType2, ExternalLink, Download, Copy, Check, Loader2, FileCode2, Printer } from 'lucide-react';
import { exportMarkdown, exportPdf } from '@workspace/draft-export';

interface Props {
  title: string;
  content: string;
  showText?: boolean;
}

export function ExportButtons({ title, content, showText = true }: Props) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [gdocsCopied, setGdocsCopied] = useState(false);

  const downloadDocx = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/lit/exports/docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safe = (title || 'Document').replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '_') || 'Document';
      a.download = `${safe}_${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to export Word document');
    } finally {
      setBusy(false);
    }
  };

  const downloadTxt = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safe = (title || 'Document').replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '_') || 'Document';
    a.download = `${safe}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openInGoogleDocs = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setGdocsCopied(true);
      setTimeout(() => setGdocsCopied(false), 4000);
    } catch {
      // ignore
    }
    window.open('https://docs.google.com/document/u/0/create', '_blank', 'noopener,noreferrer');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const baseCls =
    'inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border bg-secondary text-muted-foreground border-border hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-50';

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={downloadDocx} disabled={busy || !content} className={baseCls}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileType2 className="h-3.5 w-3.5" />}
        {showText && (busy ? 'Building…' : 'Word (.docx)')}
      </button>
      <button onClick={openInGoogleDocs} disabled={!content} className={baseCls} title="Copies the draft and opens a new Google Doc — paste with Ctrl/Cmd+V">
        <ExternalLink className="h-3.5 w-3.5" />
        {showText && (gdocsCopied ? 'Copied — paste in Google Docs' : 'Google Docs')}
      </button>
      <button onClick={downloadTxt} disabled={!content} className={baseCls}>
        <Download className="h-3.5 w-3.5" />
        {showText && 'Plain text'}
      </button>
      <button onClick={() => exportMarkdown({ title, text: content })} disabled={!content} className={baseCls} data-testid="button-export-md">
        <FileCode2 className="h-3.5 w-3.5" />
        {showText && 'Markdown'}
      </button>
      <button onClick={() => exportPdf({ title, text: content })} disabled={!content} className={baseCls} data-testid="button-export-pdf">
        <Printer className="h-3.5 w-3.5" />
        {showText && 'PDF'}
      </button>
      <button onClick={copy} disabled={!content} className={baseCls}>
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {showText && (copied ? 'Copied' : 'Copy')}
      </button>
    </div>
  );
}
