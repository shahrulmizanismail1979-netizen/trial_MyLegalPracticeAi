import { useRef, useState } from "react";

/* ─────────────────────────────────────────────
   Export helpers (no external deps)
   ───────────────────────────────────────────── */

/** Rasterise a DOM element to a JPEG data-URL using SVG foreignObject */
async function domToJpeg(el: HTMLElement, scale = 3): Promise<string> {
  const { width, height } = el.getBoundingClientRect();
  const W = Math.round(width * scale);
  const H = Math.round(height * scale);

  // Clone so we can inline computed styles
  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.transform = `scale(${scale})`;
  clone.style.transformOrigin = "top left";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;

  const svgStr = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <foreignObject x="0" y="0" width="${W}" height="${H}">
        <div xmlns="http://www.w3.org/1999/xhtml">
          ${clone.outerHTML}
        </div>
      </foreignObject>
    </svg>`;

  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.97));
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/* ─────────────────────────────────────────────
   Sub-components
   ───────────────────────────────────────────── */

function ScalesIcon({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="30.5" y="10" width="3" height="44" rx="1.5" fill="#C9A84C" />
      <rect x="20" y="52" width="24" height="3" rx="1.5" fill="#C9A84C" />
      <rect x="10" y="18" width="44" height="3" rx="1.5" fill="#C9A84C" />
      <line x1="14" y1="21" x2="10" y2="34" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="50" y1="21" x2="54" y2="34" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6 34 Q10 42 14 34" stroke="#C9A84C" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M50 34 Q54 42 58 34" stroke="#C9A84C" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <line x1="6" y1="34" x2="14" y2="34" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="50" y1="34" x2="58" y2="34" stroke="#C9A84C" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function LAWyesWordmark({ big }: { big?: boolean }) {
  return (
    <div style={{
      fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif",
      lineHeight: 1,
      display: "flex",
      alignItems: "baseline",
    }}>
      <span style={{ fontSize: big ? 72 : 36, fontWeight: 700, color: "#C9A84C", letterSpacing: "-0.01em" }}>LAW</span>
      <span style={{ fontSize: big ? 61 : 30, fontWeight: 300, color: "#FFFFFF", letterSpacing: "0.08em" }}>yes</span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main poster component
   ───────────────────────────────────────────── */

export function LAWyesPoster() {
  const posterRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "jpeg" | "pdf">("idle");
  const [error, setError] = useState("");

  const handleJPEG = async () => {
    if (!posterRef.current) return;
    setStatus("jpeg"); setError("");
    try {
      const dataUrl = await domToJpeg(posterRef.current, 3);
      const a = document.createElement("a");
      a.download = "LAWyes-Rebrand-Announcement.jpg";
      a.href = dataUrl;
      a.click();
    } catch (e) {
      console.error(e);
      setError("JPEG export failed — try the PDF button or use your browser's screenshot tool.");
    } finally {
      setStatus("idle");
    }
  };

  const handlePDF = () => {
    setStatus("pdf");
    // Inject a temporary print style, trigger print, then clean up
    const style = document.createElement("style");
    style.id = "__lawyes-print";
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        body > div#root > * { display: none !important; }
        #lawyes-print-target { display: block !important; position: fixed; inset: 0; }
        @page { size: A4 portrait; margin: 0; }
      }
      #lawyes-print-target { display: none; }
    `;
    document.head.appendChild(style);

    // Clone poster into a top-level div for printing
    const printEl = document.createElement("div");
    printEl.id = "lawyes-print-target";
    if (posterRef.current) {
      printEl.innerHTML = posterRef.current.outerHTML;
      const inner = printEl.firstElementChild as HTMLElement;
      if (inner) {
        inner.style.width = "100%";
        inner.style.minHeight = "100vh";
        inner.style.boxShadow = "none";
      }
    }
    document.body.appendChild(printEl);

    window.print();

    // Clean up after print dialog closes
    setTimeout(() => {
      document.head.removeChild(style);
      document.body.removeChild(printEl);
      setStatus("idle");
    }, 500);
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#060D1A",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: "28px 20px 32px",
    }}>

      {/* ── Export toolbar ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          onClick={handleJPEG}
          disabled={status !== "idle"}
          style={{
            background: status === "jpeg" ? "#9e7d36" : "#C9A84C",
            color: "#060D1A",
            border: "none",
            borderRadius: 6,
            padding: "10px 22px",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: status !== "idle" ? "not-allowed" : "pointer",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {status === "jpeg" ? "Generating…" : "⬇ Export JPEG"}
        </button>
        <button
          onClick={handlePDF}
          disabled={status !== "idle"}
          style={{
            background: "transparent",
            color: "#C9A84C",
            border: "2px solid #C9A84C",
            borderRadius: 6,
            padding: "8px 22px",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: status !== "idle" ? "not-allowed" : "pointer",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {status === "pdf" ? "Opening print…" : "⬇ Export PDF"}
        </button>
        {error && (
          <p style={{ color: "#f87171", fontSize: 11, margin: 0, fontFamily: "Inter, sans-serif", maxWidth: 340, textAlign: "center" }}>
            {error}
          </p>
        )}
      </div>

      {/* ── Poster (captured area) ── */}
      <div
        ref={posterRef}
        style={{
          width: 794,
          minHeight: 1123,
          background: "linear-gradient(160deg, #0B1628 0%, #0F1F3D 55%, #0B1628 100%)",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
        }}
      >
        {/* Decorative rings */}
        {[900, 700, 500].map((d, i) => (
          <div key={d} style={{
            position: "absolute",
            width: d,
            height: d,
            borderRadius: "50%",
            border: `1px solid rgba(201,168,76,${0.06 + i * 0.03})`,
            top: -200 + i * 80,
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "none",
          }} />
        ))}

        {/* Top rule */}
        <div style={{ width: "100%", height: 4, background: "linear-gradient(90deg,transparent,#C9A84C 30%,#C9A84C 70%,transparent)", flexShrink: 0 }} />

        {/* Official announcement tag */}
        <p style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 10,
          letterSpacing: "0.35em",
          color: "#C9A84C",
          textTransform: "uppercase",
          margin: "28px 0 0",
          opacity: 0.8,
        }}>Official Announcement</p>

        {/* Hero */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "44px 60px 0", textAlign: "center", width: "100%", boxSizing: "border-box" }}>

          <p style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 11, letterSpacing: "0.22em", color: "rgba(255,255,255,0.38)", textTransform: "uppercase", margin: "0 0 20px" }}>
            We Are Evolving
          </p>

          {/* Old name box */}
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 10,
            padding: "16px 36px",
            marginBottom: 14,
          }}>
            <p style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 9, letterSpacing: "0.30em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", margin: "0 0 6px" }}>
              Formerly known as
            </p>
            <p style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 26,
              fontWeight: 400,
              color: "rgba(255,255,255,0.48)",
              margin: 0,
              textDecoration: "line-through",
              textDecorationColor: "rgba(201,168,76,0.45)",
            }}>
              mylegalpracticeai.life
            </p>
          </div>

          {/* Down arrow */}
          <svg width="20" height="32" viewBox="0 0 20 32" fill="none" style={{ margin: "2px 0", opacity: 0.55 }}>
            <line x1="10" y1="0" x2="10" y2="24" stroke="#C9A84C" strokeWidth="1.5" />
            <polyline points="4,18 10,26 16,18" stroke="#C9A84C" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* New brand box */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
            padding: "38px 64px 42px",
            background: "linear-gradient(135deg,rgba(201,168,76,0.09),rgba(201,168,76,0.04))",
            border: "1px solid rgba(201,168,76,0.28)",
            borderRadius: 14,
            marginTop: 8,
            width: "100%",
            boxSizing: "border-box",
          }}>
            <ScalesIcon size={72} />
            <LAWyesWordmark big />
            <p style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 11, letterSpacing: "0.20em", color: "rgba(201,168,76,0.65)", textTransform: "uppercase", margin: 0 }}>
              AI-Powered Legal Intelligence
            </p>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 674, height: 1, background: "linear-gradient(90deg,transparent,rgba(201,168,76,0.3) 30%,rgba(201,168,76,0.3) 70%,transparent)", margin: "52px 0 0", flexShrink: 0 }} />

        {/* Body copy */}
        <div style={{ padding: "42px 80px 0", textAlign: "center" }}>
          <p style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 22,
            fontWeight: 400,
            color: "#FFFFFF",
            lineHeight: 1.65,
            margin: "0 0 26px",
          }}>
            A new name. The same commitment to excellence in Malaysian legal practice.
          </p>
          <p style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 12,
            color: "rgba(255,255,255,0.46)",
            lineHeight: 1.9,
            margin: 0,
          }}>
            LAWyes brings together our full suite of AI-powered portals — from litigation and
            corporate law to syariah practice and conveyancing — under a single unified brand
            built for the modern Malaysian legal professional.
          </p>
        </div>

        {/* Portal pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", padding: "36px 80px 0" }}>
          {["MyLitAI","MyCrimAI","MySyariahAI","MyConveyLitAI","MyCorpLegalAI","MyCorpCommBankLitAI","MyLawFirmAI","MyLawAcad"].map(n => (
            <span key={n} style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 9.5,
              color: "rgba(201,168,76,0.7)",
              border: "1px solid rgba(201,168,76,0.2)",
              borderRadius: 20,
              padding: "4px 13px",
              letterSpacing: "0.05em",
            }}>{n}</span>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: 674, height: 1, background: "linear-gradient(90deg,transparent,rgba(201,168,76,0.3) 30%,rgba(201,168,76,0.3) 70%,transparent)", margin: "52px 0 0", flexShrink: 0 }} />

        {/* Footer */}
        <div style={{ padding: "34px 80px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ScalesIcon size={22} />
            <LAWyesWordmark />
          </div>
          <p style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 9.5, color: "rgba(255,255,255,0.22)", letterSpacing: "0.14em", textTransform: "uppercase", margin: 0 }}>
            lawyes.ai &nbsp;·&nbsp; Empowering Malaysian Legal Professionals
          </p>
          <p style={{ fontFamily: "Inter, system-ui, sans-serif", fontSize: 10, color: "rgba(201,168,76,0.38)", letterSpacing: "0.06em", margin: "14px 0 0" }}>
            Effective 18 August 2026
          </p>
        </div>

        {/* Bottom rule */}
        <div style={{ width: "100%", height: 4, background: "linear-gradient(90deg,transparent,#C9A84C 30%,#C9A84C 70%,transparent)", marginTop: 40, flexShrink: 0 }} />
      </div>
    </div>
  );
}
