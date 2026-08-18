import { useRef, useState } from "react";

/* ─── Export helpers (no external deps) ─── */
async function domToJpeg(el: HTMLElement, scale = 3): Promise<string> {
  const { width, height } = el.getBoundingClientRect();
  const W = Math.round(width * scale);
  const H = Math.round(height * scale);
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.transform = `scale(${scale})`;
  clone.style.transformOrigin = "top left";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <foreignObject x="0" y="0" width="${W}" height="${H}">
      <div xmlns="http://www.w3.org/1999/xhtml">${clone.outerHTML}</div>
    </foreignObject></svg>`;
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.97));
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/* ─── Landing-page design tokens (exact match) ─── */
// background: hsl(220 20% 98%) ≈ #F5F6FA
// foreground: hsl(222 26% 12%) = #1E2535
// primary:    hsl(214 72% 58%) = #6395E0
// accent:     hsl(250 58% 72%) = #9B8AD4
// muted-fg:   hsl(220 10% 48%) = #6B7280
// card:       #FFFFFF
// card-border:#DDE1EA
const BG       = "#F5F6FA";          // near-white cool grey
const BLUE     = "#6395E0";          // primary cornflower blue
const BLUE_DK  = "#5080CC";          // hover/darker blue
const LAVENDER = "#9B8AD4";          // accent lavender
const CHARCOAL = "#1E2535";          // foreground
const MUTED    = "#6B7280";          // muted-foreground
const WHITE    = "#FFFFFF";
const BORDER   = "#DDE1EA";
const CARD_BG  = "#FFFFFF";
const SERIF    = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const SANS     = "Inter, system-ui, sans-serif";

/* ─── Scales icon in blue ─── */
function ScalesIcon({ size = 56, color = BLUE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="30.5" y="10" width="3" height="44" rx="1.5" fill={color} />
      <rect x="20"   y="52" width="24" height="3"  rx="1.5" fill={color} />
      <rect x="10"   y="18" width="44" height="3"  rx="1.5" fill={color} />
      <line x1="14" y1="21" x2="10" y2="34" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="50" y1="21" x2="54" y2="34" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 34 Q10 42 14 34"  stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M50 34 Q54 42 58 34" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <line x1="6"  y1="34" x2="14" y2="34" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="50" y1="34" x2="58" y2="34" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ─── LAWyes wordmark ─── */
function Wordmark({ big, onDark }: { big?: boolean; onDark?: boolean }) {
  const lawSize = big ? 76 : 36;
  const yesSize = big ? 65 : 31;
  return (
    <div style={{ fontFamily: SERIF, lineHeight: 1, display: "flex", alignItems: "baseline" }}>
      <span style={{ fontSize: lawSize, fontWeight: 700, color: BLUE, letterSpacing: "-0.01em" }}>LAW</span>
      <span style={{ fontSize: yesSize, fontWeight: 300, color: onDark ? WHITE : CHARCOAL, letterSpacing: "0.08em" }}>yes</span>
    </div>
  );
}

/* ─── Main component ─── */
export function LAWyesPoster() {
  const posterRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "jpeg" | "pdf">("idle");
  const [err, setErr] = useState("");

  const exportJpeg = async () => {
    if (!posterRef.current) return;
    setStatus("jpeg"); setErr("");
    try {
      const data = await domToJpeg(posterRef.current, 3);
      const a = document.createElement("a");
      a.download = "LAWyes-Announcement.jpg";
      a.href = data; a.click();
    } catch { setErr("JPEG failed — try Export PDF or use your browser's screenshot tool."); }
    finally { setStatus("idle"); }
  };

  const exportPdf = () => {
    setStatus("pdf");
    const style = document.createElement("style");
    style.textContent = `@media print { body > * { display:none!important } #__lw_print { display:block!important; position:fixed; inset:0 } @page { size:A4 portrait; margin:0 } } #__lw_print { display:none }`;
    document.head.appendChild(style);
    const div = document.createElement("div");
    div.id = "__lw_print";
    if (posterRef.current) {
      div.innerHTML = posterRef.current.outerHTML;
      const inner = div.firstElementChild as HTMLElement | null;
      if (inner) { inner.style.width = "100%"; inner.style.minHeight = "100vh"; inner.style.boxShadow = "none"; }
    }
    document.body.appendChild(div);
    window.print();
    setTimeout(() => { document.head.removeChild(style); document.body.removeChild(div); setStatus("idle"); }, 600);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#E8EBF2", display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 20px 40px" }}>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={exportJpeg} disabled={status !== "idle"} style={{
          background: status === "jpeg" ? BLUE_DK : BLUE,
          color: WHITE, border: "none", borderRadius: 8,
          padding: "10px 24px", fontWeight: 600, fontSize: 12,
          letterSpacing: "0.06em", textTransform: "uppercase",
          cursor: status !== "idle" ? "not-allowed" : "pointer",
          fontFamily: SANS, boxShadow: "0 1px 4px rgba(99,149,224,0.35)",
        }}>
          {status === "jpeg" ? "Generating…" : "⬇ Export JPEG"}
        </button>
        <button onClick={exportPdf} disabled={status !== "idle"} style={{
          background: WHITE, color: BLUE,
          border: `1.5px solid ${BORDER}`, borderRadius: 8,
          padding: "9px 24px", fontWeight: 600, fontSize: 12,
          letterSpacing: "0.06em", textTransform: "uppercase",
          cursor: status !== "idle" ? "not-allowed" : "pointer",
          fontFamily: SANS,
        }}>
          {status === "pdf" ? "Opening…" : "⬇ Export PDF"}
        </button>
        {err && <p style={{ color: "#dc3545", fontSize: 11, margin: 0, fontFamily: SANS, maxWidth: 340, textAlign: "center" }}>{err}</p>}
      </div>

      {/* ── Poster ── */}
      <div ref={posterRef} style={{
        width: 794, minHeight: 1123,
        background: BG,
        position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column", alignItems: "center",
        boxShadow: "0 8px 48px rgba(30,37,53,0.14)",
      }}>

        {/* Radial glow (matches landing page) */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(circle at 80% 0%, rgba(99,149,224,0.12) 0%, transparent 60%)",
        }} />
        {/* Second radial — lavender bottom-left */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(circle at 20% 100%, rgba(155,138,212,0.10) 0%, transparent 55%)",
        }} />

        {/* Top blue stripe */}
        <div style={{ width: "100%", height: 5, background: `linear-gradient(90deg, ${BLUE}, ${LAVENDER})`, flexShrink: 0 }} />

        {/* Blue header band */}
        <div style={{
          width: "100%",
          background: `linear-gradient(135deg, ${BLUE} 0%, ${BLUE_DK} 100%)`,
          padding: "18px 60px",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxSizing: "border-box",
        }}>
          <p style={{ fontFamily: SANS, fontSize: 10, letterSpacing: "0.38em", color: "rgba(255,255,255,0.90)", textTransform: "uppercase", margin: 0 }}>
            Official Brand Announcement
          </p>
        </div>

        {/* Hero */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "52px 60px 0", textAlign: "center", width: "100%", boxSizing: "border-box" }}>

          <p style={{ fontFamily: SANS, fontSize: 10.5, letterSpacing: "0.22em", color: MUTED, textTransform: "uppercase", margin: "0 0 28px" }}>
            We Are Evolving
          </p>

          {/* Old name card */}
          <div style={{
            background: CARD_BG, border: `1px solid ${BORDER}`,
            borderRadius: 12, padding: "18px 40px", marginBottom: 16,
            boxShadow: "0 1px 4px rgba(30,37,53,0.06)",
          }}>
            <p style={{ fontFamily: SANS, fontSize: 9, letterSpacing: "0.30em", color: MUTED, textTransform: "uppercase", margin: "0 0 7px" }}>
              Formerly known as
            </p>
            <p style={{
              fontFamily: SERIF, fontSize: 26, fontWeight: 400,
              color: "rgba(30,37,53,0.35)", margin: 0,
              textDecoration: "line-through",
              textDecorationColor: BLUE,
              textDecorationThickness: "2px",
            }}>
              mylegalpracticeai.life
            </p>
          </div>

          {/* Down arrow */}
          <svg width="20" height="32" viewBox="0 0 20 32" fill="none" style={{ margin: "4px 0", opacity: 0.35 }}>
            <line x1="10" y1="0" x2="10" y2="24" stroke={CHARCOAL} strokeWidth="1.5" />
            <polyline points="4,18 10,26 16,18" stroke={CHARCOAL} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* New brand card */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
            padding: "44px 64px 48px",
            background: CHARCOAL,
            borderRadius: 16, marginTop: 8,
            width: "100%", boxSizing: "border-box",
            position: "relative", overflow: "hidden",
          }}>
            {/* Subtle blue radial inside card */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: `radial-gradient(circle at 70% 20%, rgba(99,149,224,0.18) 0%, transparent 60%)`,
            }} />
            <ScalesIcon size={68} color={BLUE} />
            <Wordmark big onDark />
            <p style={{ fontFamily: SANS, fontSize: 10.5, letterSpacing: "0.20em", color: "rgba(99,149,224,0.75)", textTransform: "uppercase", margin: 0 }}>
              AI-Powered Legal Intelligence
            </p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 674, height: 1, background: BORDER, margin: "52px 0 0", flexShrink: 0 }} />

        {/* Body copy */}
        <div style={{ padding: "44px 80px 0", textAlign: "center" }}>
          <p style={{ fontFamily: SERIF, fontSize: 23, fontWeight: 400, color: CHARCOAL, lineHeight: 1.65, margin: "0 0 24px" }}>
            A new name. The same commitment to excellence in Malaysian legal practice.
          </p>
          <p style={{ fontFamily: SANS, fontSize: 12.5, color: MUTED, lineHeight: 1.9, margin: 0 }}>
            LAWyes brings together our full suite of AI-powered portals — from litigation and
            corporate law to syariah practice and conveyancing — under a single unified brand
            built for the modern Malaysian legal professional.
          </p>
        </div>

        {/* Portal pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", padding: "36px 80px 0" }}>
          {["MyLitAI","MyCrimAI","MySyariahAI","MyConveyLitAI","MyCorpLegalAI","MyCorpCommBankLitAI","MyLawFirmAI","MyLawAcad"].map(n => (
            <span key={n} style={{
              fontFamily: SANS, fontSize: 9.5,
              color: BLUE, background: WHITE,
              border: `1px solid ${BORDER}`,
              borderRadius: 20, padding: "5px 14px", letterSpacing: "0.05em",
              boxShadow: "0 1px 3px rgba(30,37,53,0.05)",
            }}>{n}</span>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: 674, height: 1, background: BORDER, margin: "52px 0 0", flexShrink: 0 }} />

        {/* Footer */}
        <div style={{ padding: "34px 80px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ScalesIcon size={20} color={BLUE} />
            <Wordmark />
          </div>
          <p style={{ fontFamily: SANS, fontSize: 9.5, color: MUTED, letterSpacing: "0.14em", textTransform: "uppercase", margin: 0 }}>
            lawyes.ai &nbsp;·&nbsp; Empowering Malaysian Legal Professionals
          </p>
          <p style={{ fontFamily: SANS, fontSize: 10, color: BLUE, letterSpacing: "0.06em", margin: "12px 0 0" }}>
            Effective 18 August 2026
          </p>
        </div>

        {/* Bottom stripe */}
        <div style={{ width: "100%", height: 5, background: `linear-gradient(90deg, ${LAVENDER}, ${BLUE})`, marginTop: 40, flexShrink: 0 }} />
      </div>
    </div>
  );
}
