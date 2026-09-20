import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";
import { toast } from "@/hooks/use-toast";
import { DraftExportButtons } from "@workspace/draft-export/react";

interface ExportActionsProps {
  content: string;
  filenameBase?: string;
  speechLang?: string;
  className?: string;
}

export default function ExportActions({ content, filenameBase = "document", speechLang, className }: ExportActionsProps) {
  const { mode } = useLanguage();
  const t = (en: string, bm: string) => (mode === "bm" ? bm : en);
  const [speaking, setSpeaking] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const safeName = (filenameBase || "document").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60) || "document";
  const noContent = !content || !content.trim();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast({ title: t("Copied to clipboard", "Disalin ke papan keratan") });
    } catch {
      toast({ title: t("Copy failed", "Gagal menyalin"), variant: "destructive" });
    }
  };

  const downloadBlob = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleTxt = () => {
    downloadBlob(new Blob([content], { type: "text/plain;charset=utf-8" }), "txt");
  };

  const handleMarkdown = () => {
    downloadBlob(new Blob([content], { type: "text/markdown;charset=utf-8" }), "md");
  };

  const handlePdf = () => {
    const escaped = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) {
      toast({ title: t("Popup blocked — allow popups to export PDF", "Popup disekat — benarkan popup untuk eksport PDF"), variant: "destructive" });
      return;
    }
    win.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeName}</title>` +
        `<style>body{font-family:'Times New Roman',serif;font-size:12pt;margin:2cm;}pre{white-space:pre-wrap;font-family:inherit;}</style>` +
        `</head><body><pre>${escaped}</pre></body></html>`,
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const handleWord = () => {
    const escaped = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const html =
      `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
      `<head><meta charset="utf-8"><title>${safeName}</title></head>` +
      `<body><pre style="font-family:'Times New Roman',serif;font-size:12pt;white-space:pre-wrap;">${escaped}</pre></body></html>`;
    downloadBlob(new Blob(["\ufeff", html], { type: "application/msword" }), "doc");
  };

  const handleGoogleDocs = () => {
    // Open synchronously inside the click gesture so the popup is not blocked,
    // then copy to the clipboard.
    window.open("https://docs.google.com/document/create", "_blank", "noopener,noreferrer");
    navigator.clipboard
      .writeText(content)
      .then(() =>
        toast({
          title: t("Copied — opening Google Docs", "Disalin — membuka Google Docs"),
          description: t("Paste (Ctrl/Cmd+V) into the blank document.", "Tampal (Ctrl/Cmd+V) ke dalam dokumen kosong."),
        }),
      )
      .catch(() => {
        // Clipboard may be blocked; the blank doc is already open for manual paste.
      });
  };

  const handleListen = () => {
    if (!("speechSynthesis" in window)) {
      toast({ title: t("Listening not supported on this browser", "Mendengar tidak disokong pada pelayar ini"), variant: "destructive" });
      return;
    }
    if (speaking) {
      cancelledRef.current = true;
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    // Strip markdown symbols so they aren't read aloud.
    const spoken = content.replace(/[#*_`>]/g, "");
    const sentences = spoken.match(/[^.!?\n]+[.!?]*[\n]*/g) || [spoken];
    const parts: string[] = [];
    for (const s of sentences) {
      if (s.trim().length === 0) continue;
      if (s.length <= 220) parts.push(s);
      else for (let i = 0; i < s.length; i += 220) parts.push(s.slice(i, i + 220));
    }
    if (parts.length === 0) return;

    cancelledRef.current = false;
    window.speechSynthesis.cancel();
    const lang = speechLang || (mode === "bm" ? "ms-MY" : "en-US");
    let idx = 0;
    const speakNext = () => {
      if (cancelledRef.current || idx >= parts.length) {
        setSpeaking(false);
        return;
      }
      const utter = new SpeechSynthesisUtterance(parts[idx]);
      utter.rate = 0.95;
      utter.lang = lang;
      utter.onend = () => {
        idx += 1;
        speakNext();
      };
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    };
    setSpeaking(true);
    speakNext();
  };

  const iconBtn = "h-8";

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className || ""}`}>
      <DraftExportButtons title={filenameBase} content={content} hideMarkdown />
      <Button variant="outline" size="sm" className={iconBtn} onClick={handleCopy} disabled={noContent} aria-label={t("Copy to clipboard", "Salin ke papan keratan")}>
        <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
        {t("Copy", "Salin")}
      </Button>
      <Button variant="outline" size="sm" className={iconBtn} onClick={handleTxt} disabled={noContent} aria-label={t("Download as text file", "Muat turun sebagai fail teks")}>
        <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
        {t(".txt", ".txt")}
      </Button>
      <Button variant="outline" size="sm" className={iconBtn} onClick={handleMarkdown} disabled={noContent} aria-label={t("Download as Markdown", "Muat turun sebagai Markdown")} data-testid="button-export-md">
        <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
        {t(".md", ".md")}
      </Button>
      <Button variant="outline" size="sm" className={iconBtn} onClick={handleWord} disabled={noContent} aria-label={t("Download as Word document", "Muat turun sebagai dokumen Word")}>
        <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
        {t("Word", "Word")}
      </Button>
      <Button variant="outline" size="sm" className={iconBtn} onClick={handlePdf} disabled={noContent} aria-label={t("Print or save as PDF", "Cetak atau simpan sebagai PDF")} data-testid="button-export-pdf">
        <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
        {t("PDF", "PDF")}
      </Button>
      <Button variant="outline" size="sm" className={iconBtn} onClick={handleGoogleDocs} disabled={noContent} aria-label={t("Open in Google Docs", "Buka dalam Google Docs")}>
        <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg>
        {t("Google Docs", "Google Docs")}
      </Button>
      <Button variant="outline" size="sm" className={iconBtn} onClick={handleListen} disabled={noContent} aria-pressed={speaking} aria-label={speaking ? t("Stop listening", "Henti mendengar") : t("Listen", "Dengar")}>
        {speaking ? (
          <>
            <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
            {t("Stop", "Henti")}
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" /></svg>
            {t("Listen", "Dengar")}
          </>
        )}
      </Button>
    </div>
  );
}
