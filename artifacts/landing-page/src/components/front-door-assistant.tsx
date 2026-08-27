import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SendHorizonal, X } from "lucide-react";
import { AmaniAvatar } from "@workspace/paralegal-widget";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

const GREETING =
  "Hi! I'm Amani. Not sure which option fits you? Tell me a bit about your work — for example \"I run a small litigation firm\" or \"I'm a company secretary\" — and I'll suggest the best pathway. Saya juga boleh membantu dalam Bahasa Malaysia.";

const SUGGESTIONS = [
  "Which option should I pick?",
  "I work in a law firm",
  "I'm in-house counsel at a company",
  "I teach law at a university",
  "I'm a law student",
  "I work in the courts",
  "Can I change my choice later?",
];

/** Strip [[goto:...|...]] section actions — those sections don't exist on the front door. */
const GOTO_PATTERN = /\[\[goto:([a-z-]+)\|([^\]]+)\]\]/g;

function renderContent(text: string) {
  const clean = text.replace(GOTO_PATTERN, "").trim();
  const lines = clean.split("\n").filter((l) => l.trim() !== "");
  return lines.map((line, i) => {
    const isBullet = line.trim().startsWith("- ");
    const body = isBullet ? line.trim().slice(2) : line;
    const parts = body.split(/\*\*(.+?)\*\*/g);
    const rendered = parts.map((part, j) =>
      j % 2 === 1 ? (
        <strong key={j} className="font-semibold text-foreground">
          {part}
        </strong>
      ) : (
        <span key={j}>{part}</span>
      ),
    );
    return isBullet ? (
      <li key={i} className="ml-4 list-disc">
        {rendered}
      </li>
    ) : (
      <p key={i} className={i > 0 ? "mt-2" : undefined}>
        {rendered}
      </p>
    );
  });
}

export function FrontDoorAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    startedRef.current = true;
    setError(null);
    setInput("");

    const history = [...messages, { role: "user" as const, content: trimmed }];
    const payload = history.slice(-12);
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      });
      if (!response.ok || !response.body) {
        throw new Error(
          response.status === 429
            ? "You're sending messages a little quickly — please wait a moment."
            : "I couldn't reach the assistant just now. Please try again.",
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6)) as {
            content?: string;
            done?: boolean;
            error?: string;
          };
          if (data.error) throw new Error(data.error);
          if (data.content) {
            assistantText += data.content;
            setMessages([...history, { role: "assistant", content: assistantText }]);
          }
        }
      }
      if (!assistantText) throw new Error("No reply received");
    } catch (err) {
      setMessages(history);
      setError(
        err instanceof Error && err.message.length < 120
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setStreaming(false);
    }
  }

  const showGreeting = !startedRef.current && messages.length === 0;

  return (
    <div className="fixed right-6 z-[60] flex flex-col items-end" style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}>
      {open && (
        <div className="mb-4 w-[min(24rem,calc(100vw-3rem))] rounded-2xl border border-primary/25 bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-secondary/40">
            <AmaniAvatar size={36} />
            <div className="text-left">
              <p className="font-serif text-sm font-semibold leading-tight">Need help choosing?</p>
              <p className="text-xs text-muted-foreground">Amani · English / Bahasa Malaysia</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="max-h-80 overflow-y-auto px-4 py-3 space-y-3 text-sm text-left" aria-live="polite">
            {showGreeting && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-secondary/60 border border-border/60 px-3 py-2.5 max-w-[92%] text-muted-foreground leading-relaxed">
                  {GREETING}
                </div>
              </div>
            )}
            {messages.map((message, i) =>
              message.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="rounded-2xl rounded-tr-sm bg-primary/15 border border-primary/25 px-3 py-2.5 max-w-[92%] leading-relaxed">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-sm bg-secondary/60 border border-border/60 px-3 py-2.5 max-w-[92%] leading-relaxed text-muted-foreground">
                    {message.content === "" && streaming && i === messages.length - 1 ? (
                      <span className="inline-flex gap-1 items-center py-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:300ms]" />
                      </span>
                    ) : (
                      renderContent(message.content)
                    )}
                  </div>
                </div>
              ),
            )}
            {error && <p className="text-xs text-destructive text-center">{error}</p>}
          </div>

          {showGreeting && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-3">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  className="text-xs px-2.5 py-1 rounded-full border border-border/70 bg-secondary/40 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form
            className="flex items-center gap-2 border-t border-border/60 px-3 py-2.5 bg-secondary/30"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything…"
              maxLength={4000}
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground/70 px-2 py-1.5"
              aria-label="Ask the AI assistant"
            />
            <Button
              type="submit"
              size="sm"
              disabled={streaming || input.trim() === ""}
              className="rounded-full h-9 w-9 p-0 bg-primary text-primary-foreground hover:bg-primary/90"
              aria-label="Send message"
            >
              <SendHorizonal className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      <Button
        onClick={() => setOpen(!open)}
        className="h-14 rounded-full shadow-lg gap-2 bg-primary text-primary-foreground hover:bg-primary/90 pl-2 pr-5"
      >
        <AmaniAvatar size={40} />
        <span className="font-medium text-sm">{open ? "Close" : "Need help choosing?"}</span>
      </Button>
    </div>
  );
}
