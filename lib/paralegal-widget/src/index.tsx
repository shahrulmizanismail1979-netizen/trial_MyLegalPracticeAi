/**
 * Floating "virtual paralegal" dashboard widget shared by every portal.
 *
 * Renders a bottom-right avatar button that opens a chat panel. Replies stream
 * over SSE from the portal's /paralegal/chat endpoint and are spoken aloud via
 * /paralegal/speak (ElevenLabs) unless muted.
 *
 * The host portal supplies `request(path, init)` — a fetch wrapper that
 * prepends the portal's API base and attaches its auth (session cookie or JWT
 * header). The widget itself is auth-agnostic and styled with inline styles so
 * it looks consistent regardless of each portal's Tailwind theme.
 */
import { useEffect, useRef, useState } from "react";
// @ts-ignore — static asset; bundled by each portal's Vite
import amaniAvatarSrc from "./amani-avatar.jpg";

export interface ParalegalWidgetProps {
  /** Product name shown in the header, e.g. "MyLitAI". */
  portalName: string;
  /** Authed fetch: path is relative, e.g. "/paralegal/chat". */
  request: (path: string, init?: RequestInit) => Promise<Response>;
  /** Accent colour (any CSS colour). Default: dark gold. */
  accent?: string;
  /** Assistant display name. Default "Amani". */
  assistantName?: string;
  /** Greeting bubble shown when the panel is first opened. */
  greeting?: string;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const S = {
  fab: (accent: string): React.CSSProperties => ({
    position: "fixed",
    bottom: 20,
    right: 20,
    zIndex: 2147483000,
    width: 60,
    height: 60,
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    background: accent,
    boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  }),
  panel: {
    position: "fixed",
    bottom: 92,
    right: 20,
    zIndex: 2147483000,
    width: "min(380px, calc(100vw - 32px))",
    height: "min(560px, calc(100vh - 120px))",
    display: "flex",
    flexDirection: "column",
    borderRadius: 16,
    overflow: "hidden",
    background: "#141414",
    color: "#f3efe6",
    boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
    border: "1px solid rgba(200,170,110,0.35)",
    fontFamily: "system-ui, sans-serif",
    fontSize: 14,
  } as React.CSSProperties,
  header: (accent: string): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    background: accent,
    color: "#fff",
  }),
  body: {
    flex: 1,
    overflowY: "auto",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } as React.CSSProperties,
  bubble: (mine: boolean, accent: string): React.CSSProperties => ({
    alignSelf: mine ? "flex-end" : "flex-start",
    maxWidth: "85%",
    padding: "8px 12px",
    borderRadius: 12,
    whiteSpace: "pre-wrap",
    lineHeight: 1.45,
    background: mine ? accent : "rgba(255,255,255,0.08)",
    color: mine ? "#fff" : "#f3efe6",
  }),
  inputRow: {
    display: "flex",
    gap: 8,
    padding: 10,
    borderTop: "1px solid rgba(255,255,255,0.1)",
  } as React.CSSProperties,
  input: {
    flex: 1,
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 8,
    color: "#f3efe6",
    padding: "8px 10px",
    fontSize: 14,
    outline: "none",
  } as React.CSSProperties,
  send: (accent: string, disabled: boolean): React.CSSProperties => ({
    background: accent,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 14px",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontWeight: 600,
  }),
  iconBtn: {
    background: "rgba(255,255,255,0.15)",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    width: 30,
    height: 30,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
  } as React.CSSProperties,
};

/** Photo avatar — professional AI-generated portrait with animated speaking rings. */
function Avatar({ size, speaking }: { size: number; speaking: boolean }) {
  return (
    <span
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "inline-block",
        borderRadius: "50%",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {speaking && (
        <>
          <span
            style={{
              position: "absolute",
              inset: -5,
              borderRadius: "50%",
              border: "2.5px solid rgba(255,255,255,0.75)",
              animation: "vp-pulse 1.1s ease-out infinite",
              zIndex: 2,
              pointerEvents: "none",
            }}
          />
          <span
            style={{
              position: "absolute",
              inset: -10,
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.35)",
              animation: "vp-pulse 1.1s ease-out 0.35s infinite",
              zIndex: 2,
              pointerEvents: "none",
            }}
          />
        </>
      )}
      <img
        src={amaniAvatarSrc}
        alt="Amani"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          objectPosition: "center 15%",
          display: "block",
        }}
      />
      <style>{`@keyframes vp-pulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.5);opacity:0}}`}</style>
    </span>
  );
}

export function ParalegalWidget({
  portalName,
  request,
  accent = "#8a6d2f",
  assistantName = "Amani",
  greeting,
}: ParalegalWidgetProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("vp.muted") === "1";
  });
  const [speaking, setSpeaking] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const hello =
    greeting ??
    `Hi, I'm ${assistantName}, your virtual paralegal here on ${portalName}. Ask me anything about your matters, this portal's tools, or Malaysian legal procedure.`;

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages, open]);

  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  };

  const speak = async (text: string) => {
    if (mutedRef.current || !text.trim()) return;
    try {
      const res = await request("/paralegal/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      if (mutedRef.current) return;
      stopAudio();
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      setSpeaking(true);
      audio.onended = audio.onerror = () => {
        URL.revokeObjectURL(audio.src);
        setSpeaking(false);
      };
      await audio.play().catch(() => setSpeaking(false));
    } catch {
      /* voice is best-effort */
    }
  };

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    stopAudio();
    setInput("");
    const history = [...messages, { role: "user" as const, content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setBusy(true);
    let acc = "";
    try {
      const res = await request("/paralegal/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok || !res.body) {
        const err = new Error(String(res.status)) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split("\n\n");
        buf = events.pop() ?? "";
        for (const ev of events) {
          const line = ev.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const data = JSON.parse(line.slice(6)) as {
              content?: string;
              error?: string;
            };
            if (data.content) {
              acc += data.content;
              setMessages([...history, { role: "assistant", content: acc }]);
            }
            if (data.error) {
              acc = acc || data.error;
              setMessages([...history, { role: "assistant", content: acc }]);
            }
          } catch {
            /* skip malformed event */
          }
        }
      }
      if (!acc) {
        acc = "Sorry — I couldn't answer that just now. Please try again.";
        setMessages([...history, { role: "assistant", content: acc }]);
      }
      void speak(acc);
    } catch (e) {
      const status = (e as { status?: number } | null)?.status;
      const content =
        status === 429
          ? "You've reached your AI usage limit for now. Please wait a minute and try again."
          : status === 401
            ? "Your session has ended — please sign in again to keep chatting."
            : "Sorry — the paralegal is unavailable right now. Please try again shortly.";
      setMessages([...history, { role: "assistant", content }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div style={S.panel} role="dialog" aria-label={`${assistantName} — virtual paralegal`}>
          <div style={S.header(accent)}>
            <Avatar size={36} speaking={speaking} />
            <div style={{ flex: 1, lineHeight: 1.2 }}>
              <div style={{ fontWeight: 700 }}>{assistantName}</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>Virtual paralegal · {portalName}</div>
            </div>
            <button
              style={S.iconBtn}
              title={muted ? "Unmute voice" : "Mute voice"}
              onClick={() => {
                const next = !muted;
                setMuted(next);
                window.localStorage.setItem("vp.muted", next ? "1" : "0");
                if (next) stopAudio();
              }}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button style={S.iconBtn} title="Close" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div ref={bodyRef} style={S.body}>
            <div style={S.bubble(false, accent)}>{hello}</div>
            {messages.map((m, i) => (
              <div key={i} style={S.bubble(m.role === "user", accent)}>
                {m.content || (busy && i === messages.length - 1 ? "…" : m.content)}
              </div>
            ))}
          </div>
          <div style={S.inputRow}>
            <input
              style={S.input}
              value={input}
              placeholder="Ask your paralegal…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button style={S.send(accent, busy || !input.trim())} disabled={busy || !input.trim()} onClick={() => void send()}>
              Send
            </button>
          </div>
        </div>
      )}
      <button
        style={S.fab(accent)}
        aria-label={open ? "Close virtual paralegal" : "Open virtual paralegal"}
        title={`${assistantName} — your virtual paralegal`}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar size={48} speaking={speaking} />
      </button>
    </>
  );
}
