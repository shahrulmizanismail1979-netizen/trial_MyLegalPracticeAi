import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import jsPDF from "jspdf";
import {
  Copy,
  Check,
  Download,
  FileText,
  FileType2,
  Mail,
  ExternalLink,
  ShieldAlert,
  X,
} from "lucide-react";

type Props = {
  password: string;
  email: string;
  onClose: () => void;
};

const AUTO_PDF_AFTER_SECONDS = 30;

function buildDocBody(password: string, email: string) {
  const date = new Date().toLocaleString();
  return `MyLawAcad — Your License Credential

Account email: ${email}
New password:  ${password}

Issued on:     ${date}

IMPORTANT
---------
• This password REPLACED your previous one when your subscription started.
• Save it somewhere safe (password manager, encrypted note, printed copy).
• MyLawAcad will NOT show this password again. If you lose it, ask an admin
  to reset it for you.
• Never share this password. Anyone holding it can access your account.

Sign in URL:   ${typeof window !== "undefined" ? window.location.origin : ""}/examiner

— MyLawAcad
`;
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function makePdf(password: string, email: string): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("MyLawAcad", margin, margin + 10);
  doc.setFontSize(14);
  doc.setTextColor(120);
  doc.text("Your license credential", margin, margin + 32);

  doc.setDrawColor(200);
  doc.line(margin, margin + 46, 595 - margin, margin + 46);

  doc.setTextColor(20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Account email: ${email}`, margin, margin + 80);
  doc.text(`Issued on:    ${new Date().toLocaleString()}`, margin, margin + 100);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(180, 90, 0);
  doc.text("New password", margin, margin + 160);

  doc.setFontSize(36);
  doc.setTextColor(0);
  doc.text(password, margin, margin + 210);

  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(
    [
      "This password replaced your previous one when your subscription started.",
      "Save it now — MyLawAcad will not show it again. If lost, an admin can reset it.",
      "Never share this password.",
    ],
    margin,
    margin + 260,
    { lineHeightFactor: 1.4 },
  );

  return doc;
}

function downloadPdf(password: string, email: string) {
  const doc = makePdf(password, email);
  doc.save("MyLawAcad-License.pdf");
}

function downloadWord(password: string, email: string) {
  // Minimal Word-compatible HTML (.doc). MS Word opens this happily.
  const body = buildDocBody(password, email).replace(/\n/g, "<br/>");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>MyLawAcad License</title></head>
<body style="font-family: Calibri, Arial, sans-serif; font-size: 11pt;">
<h1 style="color:#b45a00; margin-bottom:0;">MyLawAcad</h1>
<p style="color:#666; margin-top:4px;">Your license credential</p>
<hr/>
<p><b>Account email:</b> ${email}</p>
<p style="font-size:28pt; font-weight:bold; color:#b45a00; letter-spacing:2px;">${password}</p>
<p style="color:#444;">${body}</p>
</body></html>`;
  downloadBlob(html, "MyLawAcad-License.doc", "application/msword");
}

function downloadTxt(password: string, email: string) {
  downloadBlob(
    buildDocBody(password, email),
    "MyLawAcad-License.txt",
    "text/plain;charset=utf-8",
  );
}

function openGoogleDocs() {
  // Google Docs doesn't accept prefilled body in URL, so we open a blank doc
  // in a new tab. The user pastes (clipboard already has the credentials).
  window.open("https://docs.google.com/document/create", "_blank", "noopener");
}

function openEmail(password: string, email: string) {
  const subject = encodeURIComponent("MyLawAcad — your license credential");
  const body = encodeURIComponent(buildDocBody(password, email));
  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
}

export function LicenseReveal({ password, email, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(AUTO_PDF_AFTER_SECONDS);
  const [autoDownloaded, setAutoDownloaded] = useState(false);
  const interactedRef = useRef(false);

  const markInteracted = () => {
    interactedRef.current = true;
  };

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0 && !autoDownloaded && !interactedRef.current) {
      setAutoDownloaded(true);
      downloadPdf(password, email);
    }
  }, [secondsLeft, autoDownloaded, password, email]);

  const handleCopy = async () => {
    markInteracted();
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  const overlay = (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="license-reveal-title"
      data-testid="license-reveal"
    >
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative w-full max-w-3xl rounded-3xl border border-amber-400/40 bg-gradient-to-br from-amber-950/40 via-black/95 to-black shadow-[0_40px_120px_-20px_rgba(251,191,36,0.5)] overflow-hidden"
      >
        <div className="absolute -inset-1 pointer-events-none opacity-30 bg-gradient-to-br from-amber-400/30 via-transparent to-fuchsia-500/20" />

        <button
          type="button"
          onClick={() => {
            markInteracted();
            onClose();
          }}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors"
          aria-label="Close"
          data-testid="license-close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative p-8 md:p-12 space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="text-[0.65rem] uppercase tracking-[0.3em] text-amber-300/80">
                One-time reveal
              </div>
              <h2
                id="license-reveal-title"
                className="font-display text-3xl md:text-4xl text-white"
              >
                Your new password
              </h2>
            </div>
          </div>

          <p className="text-white/70 text-base md:text-lg leading-relaxed">
            Your subscription is active. We've issued a fresh password for{" "}
            <span className="text-amber-200 font-mono">{email}</span>. It has
            replaced your previous one.{" "}
            <span className="text-amber-300 font-semibold">
              Save this now — MyLawAcad will not show it again.
            </span>
          </p>

          <div
            className="rounded-2xl border border-amber-400/50 bg-black/70 px-6 py-10 text-center select-all"
            data-testid="license-password"
          >
            <div className="font-mono font-black text-amber-200 text-[clamp(1.75rem,5vw,3.5rem)] tracking-[0.08em] break-all leading-tight">
              {password}
            </div>
          </div>

          <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 px-4 py-3 text-sm text-fuchsia-100 flex items-center gap-3">
            <ShieldAlert className="w-4 h-4 text-fuchsia-300 flex-shrink-0" />
            <span>
              If you don't save or download within{" "}
              <span className="font-mono font-bold text-amber-200">
                {secondsLeft}s
              </span>
              , we'll auto-download a PDF copy to your device.
              {autoDownloaded && (
                <span className="ml-1 text-amber-300">
                  (PDF downloaded — check your downloads folder.)
                </span>
              )}
            </span>
          </div>

          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-white/40 mb-3">
              Save or export
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <ExportButton
                onClick={handleCopy}
                icon={copied ? Check : Copy}
                label={copied ? "Copied!" : "Copy password"}
                testId="license-copy"
                highlight
              />
              <ExportButton
                onClick={() => {
                  markInteracted();
                  downloadPdf(password, email);
                }}
                icon={Download}
                label="Download PDF"
                testId="license-download-pdf"
              />
              <ExportButton
                onClick={() => {
                  markInteracted();
                  downloadWord(password, email);
                }}
                icon={FileType2}
                label="Download Word (.doc)"
                testId="license-download-word"
              />
              <ExportButton
                onClick={() => {
                  markInteracted();
                  downloadTxt(password, email);
                }}
                icon={FileText}
                label="Download .txt"
                testId="license-download-txt"
              />
              <ExportButton
                onClick={async () => {
                  markInteracted();
                  try {
                    await navigator.clipboard.writeText(
                      buildDocBody(password, email),
                    );
                  } catch {
                    // ignore
                  }
                  openGoogleDocs();
                }}
                icon={ExternalLink}
                label="Open Google Docs"
                testId="license-google-docs"
              />
              <ExportButton
                onClick={() => {
                  markInteracted();
                  openEmail(password, email);
                }}
                icon={Mail}
                label="Email it to me"
                testId="license-email"
              />
            </div>
            <p className="text-[0.7rem] text-white/40 mt-3 leading-relaxed">
              Google Docs opens a blank document — paste with{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-white/10">⌘V</kbd> /{" "}
              <kbd className="px-1.5 py-0.5 rounded bg-white/10">Ctrl+V</kbd>{" "}
              (your credentials are already in the clipboard).
            </p>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="button"
              onClick={() => {
                markInteracted();
                onClose();
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-[0.2em] text-black bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-600 hover:shadow-[0_10px_30px_-5px_rgba(251,191,36,0.7)] transition-all"
              data-testid="license-saved-close"
            >
              <Check className="w-4 h-4" />
              I've saved it — close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(overlay, document.body);
}

function ExportButton({
  onClick,
  icon: Icon,
  label,
  testId,
  highlight,
}: {
  onClick: () => void;
  icon: typeof Copy;
  label: string;
  testId: string;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={
        "inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border " +
        (highlight
          ? "bg-amber-400/15 border-amber-400/50 text-amber-100 hover:bg-amber-400/25"
          : "bg-white/5 border-white/15 text-white/80 hover:bg-white/10 hover:border-white/30")
      }
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
