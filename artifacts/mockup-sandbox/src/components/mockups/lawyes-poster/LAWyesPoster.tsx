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
    </foreignObject>
  </svg>`;

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

/* ─── Design tokens ─── */
const GOLD   = "#B8972A";
const NAVY   = "#0D1E3C";
const CREAM  = "#FBF7F0";
const WARM   = "#F4EDE0";
const MUTED  = "#6B7A94";
const SERIF  = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const SANS   = "Inter, system-ui, sans-serif";

/* ─── Sub-components ─── */

function ScalesIcon({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="30.5" y="10" width="3" height="44" rx="1.5" fill={GOLD} />
      <rect x="20"   y="52" width="24" height="3" rx="1.5" fill={GOLD} />
      <rect x="10"   y="18" width="44" height="3" rx="1.5" fill={GOLD} />
      <line x1="14" y1="21" x2="10" y2="34" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="50" y1="21" x2="54" y2="34" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 34 Q10 42 14 34"  stroke={GOLD} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M50 34 Q54 42 58 34" stroke={GOLD} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <line x1="6"  y1="34" x2="14" y2="34" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="50" y1="34" x2="58" y2="34" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function Wordmark({ big, onDark }: { big?: boolean; onDark?: boolean }) {
  return (
    <div style={{ fontFamily: SERIF, lineHeight: 1, display: "flex", alignItems: "baseline" }}>
      <span style={{ fontSize: big ? 76 : 38, fontWeight: 700, color: GOLD,  letterSpacing: "-0.01em" }}>LAW</span>
      <span style={{ fontSize: big ? 65 : 32, fontWeight: 300, color: onDark ? "#FFFFFF" : NAVY, letterSpacing: "0.08em" }}>yes</span>
    </div>
  );
}

/* ─── Main export ─── */

export function LAWyesPoster() {
  const posterRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "jpeg" | "pdf">("idle");
  const [err, setErr]       = useState("");

  const exportJpeg = async () => {
    if (!posterRef.current) return;
    setStatus("jpeg"); setErr("");
    try {
      const data = await domToJpeg(posterRef.current, 3);
      const a = document.createElement("a");
      a.download = "LAWyes-Announcement.jpg";
      a.href = data; a.click();
    } catch {
      setErr("JPEG failed — use the PDF button or your browser's screenshot tool.");
    } finally { setStatus("idle"); }
  };

  const exportPdf = () => {
    setStatus("pdf");
    const style = document.createElement("style");
    style.textContent = `
      @media print {
        body > * { display:none!important }
        #__lw_print { display:block!important; position:fixed; inset:0 }
        @page { size:A4 portrait; margin:0 }
      }
      #__lw_print { display:none }
    `;
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
    setTimeout(() => {
      document.head.removeChild(style);
      document.body.removeChild(div);
      setStatus("idle");
    }, 600);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#E8E0D5", display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 20px 40px" }}>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={exportJpeg} disabled={status !== "idle"} style={{
          background: status === "jpeg" ? "#8a6e1c" : GOLD,
          color: "#fff", border: "none", borderRadius: 6,
          padding: "10px 24px", fontWeight: 700, fontSize: 12,
          letterSpacing: "0.08em", textTransform: "uppercase",
          cursor: status !== "idle" ? "not-allowed" : "pointer", fontFamily: SANS,
        }}>
          {status === "jpeg" ? "Generating…" : "⬇ Export JPEG"}
        </button>
        <button onClick={exportPdf} disabled={status !== "idle"} style={{
          background: "#fff", color: NAVY,
          border: `2px solid ${NAVY}`, borderRadius: 6,
          padding: "8px 24px", fontWeight: 700, fontSize: 12,
          letterSpacing: "0.08em", textTransform: "uppercase",
          cursor: status !== "idle" ? "not-allowed" : "pointer", fontFamily: SANS,
        }}>
          {status === "pdf" ? "Opening print…" : "⬇ Export PDF"}
        </button>
        {err && <p style={{ color: "#c0392b", fontSize: 11, margin: 0, fontFamily: SANS, maxWidth: 340, textAlign: "center" }}>{err}</p>}
      </div>

      {/* ── Poster ── */}
      <div ref={posterRef} style={{
        width: 794, minHeight: 1123,
        background: CREAM,
        position: "relative", overflow: "hidden",
        display: "flex", flexDirection: "column", alignItems: "center",
        boxShadow: "0 8px 60px rgba(0,0,0,0.18)",
      }}>

        {/* Top gold stripe */}
        <div style={{ width: "100%", height: 6, background: GOLD, flexShrink: 0 }} />

        {/* Gold header band */}
        <div style={{
          width: "100%", background: NAVY,
          padding: "20px 60px",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxSizing: "border-box",
        }}>
          <p style={{ fontFamily: SANS, fontSize: 10, letterSpacing: "0.38em", color: GOLD, textTransform: "uppercase", margin: 0, opacity: 0.9 }}>
            Official Brand Announcement
          </p>
        </div>

        {/* Hero */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "54px 60px 0", textAlign: "center", width: "100%", boxSizing: "border-box" }}>

          <p style={{ fontFamily: SANS, fontSize: 10.5, letterSpacing: "0.24em", color: MUTED, textTransform: "uppercase", margin: "0 0 28px" }}>
            We Are Evolving
          </p>

          {/* Old name */}
          <div style={{
            background: WARM,
            border: `1px solid rgba(13,30,60,0.10)`,
            borderRadius: 10, padding: "18px 40px", marginBottom: 16,
          }}>
            <p style={{ fontFamily: SANS, fontSize: 9, letterSpacing: "0.32em", color: MUTED, textTransform: "uppercase", margin: "0 0 7px" }}>
              Formerly known as
            </p>
            <p style={{
              fontFamily: SERIF, fontSize: 27, fontWeight: 400,
              color: "rgba(13,30,60,0.38)", margin: 0,
              textDecoration: "line-through", textDecorationColor: GOLD,
              textDecorationThickness: "2px",
            }}>
              mylegalpracticeai.life
            </p>
          </div>

          {/* Arrow */}
          <svg width="20" height="32" viewBox="0 0 20 32" fill="none" style={{ margin: "2px 0", opacity: 0.4 }}>
            <line x1="10" y1="0" x2="10" y2="24" stroke={NAVY} strokeWidth="1.5" />
            <polyline points="4,18 10,26 16,18" stroke={NAVY} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* New brand box */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 20,
            padding: "42px 64px 46px",
            background: NAVY,
            borderRadius: 14, marginTop: 8,
            width: "100%", boxSizing: "border-box",
          }}>
            <ScalesIcon size={68} />
            <Wordmark big onDark />
            <p style={{ fontFamily: SANS, fontSize: 11, letterSpacing: "0.22em", color: "rgba(184,151,42,0.75)", textTransform: "uppercase", margin: 0 }}>
              AI-Powered Legal Intelligence
            </p>
          </div>
        </div>

        {/* Gold rule */}
        <div style={{ width: 674, height: 1, background: GOLD, margin: "52px 0 0", opacity: 0.35, flexShrink: 0 }} />

        {/* Body copy */}
        <div style={{ padding: "44px 80px 0", textAlign: "center" }}>
          <p style={{ fontFamily: SERIF, fontSize: 23, fontWeight: 400, color: NAVY, lineHeight: 1.65, margin: "0 0 26px" }}>
            A new name. The same commitment to excellence in Malaysian legal practice.
          </p>
          <p style={{ fontFamily: SANS, fontSize: 12.5, color: MUTED, lineHeight: 1.85, margin: 0 }}>
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
              color: NAVY, background: WARM,
              border: `1px solid rgba(13,30,60,0.15)`,
              borderRadius: 20, padding: "5px 14px", letterSpacing: "0.05em",
            }}>{n}</span>
          ))}
        </div>

        {/* Gold rule */}
        <div style={{ width: 674, height: 1, background: GOLD, margin: "52px 0 0", opacity: 0.35, flexShrink: 0 }} />

        {/* Footer */}
        <div style={{ padding: "34px 80px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ScalesIcon size={22} />
            <Wordmark />
          </div>
          <p style={{ fontFamily: SANS, fontSize: 9.5, color: MUTED, letterSpacing: "0.14em", textTransform: "uppercase", margin: 0 }}>
            lawyes.ai &nbsp;·&nbsp; Empowering Malaysian Legal Professionals
          </p>
          <p style={{ fontFamily: SANS, fontSize: 10, color: GOLD, letterSpacing: "0.06em", margin: "14px 0 0" }}>
            Effective 18 August 2026
          </p>
        </div>

        {/* Bottom stripe */}
        <div style={{ width: "100%", height: 6, background: GOLD, marginTop: 40, flexShrink: 0 }} />
      </div>
    </div>
  );
}
