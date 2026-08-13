import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, SendHorizonal, ArrowDownRight } from "lucide-react";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface GotoAction {
  sectionId: string;
  label: string;
}

const GREETING =
  "Hello and welcome! 👋 I'm your AI receptionist at LAWYes — Your Legal Work, Solved. Whether you're a litigator, syarie counsel, company secretary, conveyancer, or in-house counsel — I can help you find the right AI portal, explain pricing and the 7-day free trial, or show you how to earn free months. Saya juga boleh membantu dalam Bahasa Malaysia. How can I help you today?";

const SUGGESTIONS = [
  "Which portal is right for my practice?",
  "How does the 7-day free trial work?",
  "What do I get in the Complete Bundle?",
  "How can I get free access?",
  "Do you have plans for law firms?",
  "Is my data confidential?",
];

const GOTO_PATTERN = /\[\[goto:([a-z-]+)\|([^\]]+)\]\]/g;

function extractActions(text: string): { clean: string; actions: GotoAction[] } {
  const actions: GotoAction[] = [];
  const clean = text
    .replace(GOTO_PATTERN, (_match, sectionId: string, label: string) => {
      actions.push({ sectionId, label: label.trim() });
      return "";
    })
    .trim();
  return { clean, actions };
}

/** Minimal markdown: **bold** and "- " bullet lines. */
function renderContent(text: string) {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
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

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
}

export function ReceptionChat() {
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
    // Keep the request small: last 12 turns is plenty of context.
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
            ? "You're sending messages a little quickly — please wait a moment and try again."
            : "I couldn't reach the reception desk just now. Please try again.",
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
      if (!assistantText) {
        throw new Error("No reply received");
      }
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
    <section
      id="reception"
      className="relative px-6 lg:px-8 max-w-4xl mx-auto -mt-6 md:-mt-10 pb-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200"
    >
      <div className="rounded-2xl border border-primary/25 bg-card/80 backdrop-blur shadow-[0_0_60px_rgba(99,149,224,0.12)] overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-5 border-b border-border/60 bg-secondary/40">
          <div className="h-11 w-11 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-serif text-base font-semibold leading-tight">AI Reception Counter</p>
            <p className="text-sm text-muted-foreground">
              Happy to help with anything — portals, pricing, free trial, free access. English /
              Bahasa Malaysia.
            </p>
          </div>
          <span className="ml-auto flex items-center gap-1.5 text-sm text-primary shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Online
          </span>
        </div>

        <div
          ref={scrollRef}
          className="max-h-[28rem] overflow-y-auto px-6 py-5 space-y-4 text-base text-left"
          aria-live="polite"
        >
          {showGreeting && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-tl-sm bg-secondary/60 border border-border/60 px-4 py-3 max-w-[90%] text-muted-foreground leading-relaxed">
                {GREETING}
              </div>
            </div>
          )}

          {messages.map((message, i) => {
            if (message.role === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="rounded-2xl rounded-tr-sm bg-primary/15 border border-primary/25 px-4 py-3 max-w-[90%] leading-relaxed">
                    {message.content}
                  </div>
                </div>
              );
            }
            const { clean, actions } = extractActions(message.content);
            const isLast = i === messages.length - 1;
            return (
              <div key={i} className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm bg-secondary/60 border border-border/60 px-4 py-3 max-w-[90%] leading-relaxed text-muted-foreground">
                  {clean === "" && streaming && isLast ? (
                    <span className="inline-flex gap-1 items-center py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce [animation-delay:300ms]" />
                    </span>
                  ) : (
                    <>
                      {renderContent(clean)}
                      {actions.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {actions.map((action) => (
                            <Button
                              key={action.sectionId + action.label}
                              size="sm"
                              variant="outline"
                              className="rounded-full border-primary/40 text-primary hover:bg-primary/10 h-8"
                              onClick={() => scrollToSection(action.sectionId)}
                            >
                              {action.label}
                              <ArrowDownRight className="ml-1 h-3.5 w-3.5" />
                            </Button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {error && <p className="text-xs text-destructive text-center">{error}</p>}
        </div>

        {showGreeting && (
          <div className="flex flex-wrap gap-2 px-6 pb-4">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void send(suggestion)}
                className="text-xs px-3 py-1.5 rounded-full border border-border/70 bg-secondary/40 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <form
          className="flex items-center gap-2 border-t border-border/60 px-5 py-4 bg-secondary/30"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything — I'm happy to help…"
            maxLength={4000}
            className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground/70 px-2 py-2"
            aria-label="Ask the AI reception counter"
          />
          <Button
            type="submit"
            size="sm"
            disabled={streaming || input.trim() === ""}
            className="rounded-full h-10 w-10 p-0 bg-primary text-primary-foreground hover:bg-primary/90"
            aria-label="Send message"
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </section>
  );
}
