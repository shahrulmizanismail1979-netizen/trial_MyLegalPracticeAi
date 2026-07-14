import React, { useEffect, useRef, useState } from "react";
import { useMatter } from "@/contexts/MatterContext";
import { usePathways } from "@/hooks/use-irac-api";
import { runPathwayChat, ChatTurn, Citation, StreamHandlers } from "@/lib/irac-api";
import { useAIProvider } from "@/contexts/AIProviderContext";
import { PARALEGALS } from "@/lib/paralegals";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { CitationsList } from "@/components/CitationsList";
import { DisclaimerNotice } from "@/components/DisclaimerNotice";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MessagesSquare, Send, Loader2, RotateCcw, UserRound, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface DisplayMessage {
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
}

export default function Chat() {
  const { pathwayId } = useMatter();
  const { data: pathways } = usePathways();
  const { provider } = useAIProvider();
  const { t } = useLanguage();
  const persona = PARALEGALS[provider];

  const [selectedPathway, setSelectedPathway] = useState<string>(pathwayId || "");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamCitations, setStreamCitations] = useState<Citation[]>([]);
  const [disclaimer, setDisclaimer] = useState("");
  const [error, setError] = useState("");
  const cancelRef = useRef<() => void>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathwayId && !selectedPathway) setSelectedPathway(pathwayId);
  }, [pathwayId, selectedPathway]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamText]);

  const pathwayLabel = pathways?.find((p) => p.id === selectedPathway)?.label;

  const handleSend = () => {
    const text = input.trim();
    if (!text || !selectedPathway || streaming) return;

    const userMsg: DisplayMessage = { role: "user", text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setError("");
    setDisclaimer("");
    setStreamText("");
    setStreamCitations([]);
    setStreaming(true);

    const turns: ChatTurn[] = history.map((m) => ({ role: m.role, text: m.text }));
    let collected = "";
    let collectedCitations: Citation[] = [];

    const handlers: StreamHandlers = {
      onContent: (chunk) => {
        collected += chunk;
        setStreamText((prev) => prev + chunk);
      },
      onCitations: (cites) => {
        collectedCitations = cites;
        setStreamCitations(cites);
      },
      onDone: (info) => {
        if (info?.disclaimer) setDisclaimer(info.disclaimer);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: collected, citations: collectedCitations },
        ]);
        setStreamText("");
        setStreamCitations([]);
        setStreaming(false);
      },
      onError: (msg) => {
        setError(msg);
        setStreamText("");
        setStreamCitations([]);
        setStreaming(false);
        setMessages((prev) => prev.slice(0, -1));
        setInput(text);
      },
    };

    const control = runPathwayChat(selectedPathway, turns, handlers);
    cancelRef.current = control.cancel;
  };

  const handleClear = () => {
    cancelRef.current?.();
    setMessages([]);
    setStreamText("");
    setStreamCitations([]);
    setDisclaimer("");
    setError("");
    setStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const empty = messages.length === 0 && !streamText;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-semibold text-primary flex items-center gap-3">
          <MessagesSquare className="w-7 h-7 text-secondary" />
          {t("chat.title")}
        </h1>
        <p className="text-muted-foreground mt-2">{t("chat.desc")}</p>
      </div>

      <Card className="flex flex-col" style={{ height: "calc(100vh - 14rem)" }}>
        <CardHeader className="border-b border-border shrink-0 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>{t("chat.pathwayLabel")}</Label>
              <Select
                value={selectedPathway}
                onValueChange={(v) => {
                  setSelectedPathway(v);
                  handleClear();
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("chat.selectPathway")} />
                </SelectTrigger>
                <SelectContent>
                  {pathways?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {messages.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleClear} disabled={streaming}>
                <RotateCcw className="w-4 h-4 mr-2" />
                {t("chat.clear")}
              </Button>
            )}
          </div>
          {selectedPathway && (
            <CardDescription className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[hsl(var(--gold-bright))]" />
              {t("chat.with")} <span className="font-medium text-foreground">{persona.name}</span>
              {pathwayLabel && <> · {pathwayLabel}</>}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent ref={scrollRef} className="flex-1 overflow-y-auto py-6 space-y-6">
          {empty && (
            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
              <MessagesSquare className="w-10 h-10 mb-3 opacity-30" />
              <p>{selectedPathway ? t("chat.empty") : t("chat.needPathway")}</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="shrink-0 w-8 h-8 rounded-full bg-secondary/15 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-secondary" />
                </div>
              )}
              <div
                className={
                  msg.role === "user"
                    ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 whitespace-pre-wrap break-words"
                    : "max-w-[85%] rounded-2xl rounded-tl-sm bg-muted/40 border border-border px-4 py-3"
                }
              >
                {msg.role === "user" ? (
                  msg.text
                ) : (
                  <>
                    <MarkdownRenderer content={msg.text} />
                    {msg.citations && msg.citations.length > 0 && (
                      <CitationsList citations={msg.citations} />
                    )}
                  </>
                )}
              </div>
              {msg.role === "user" && (
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                  <UserRound className="w-4 h-4 text-primary" />
                </div>
              )}
            </div>
          ))}

          {streaming && (
            <div className="flex gap-3 justify-start">
              <div className="shrink-0 w-8 h-8 rounded-full bg-secondary/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-secondary" />
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-muted/40 border border-border px-4 py-3">
                {streamText ? (
                  <>
                    <MarkdownRenderer content={streamText} />
                    {streamCitations.length > 0 && <CitationsList citations={streamCitations} />}
                  </>
                ) : (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("chat.thinking")}
                  </span>
                )}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive text-center">{error}</p>}
        </CardContent>

        <div className="border-t border-border p-4 shrink-0 space-y-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("chat.placeholder")}
              disabled={!selectedPathway || streaming}
              className="resize-none h-12 min-h-12 max-h-40"
            />
            <Button
              onClick={handleSend}
              disabled={!selectedPathway || streaming || !input.trim()}
              className="h-12 px-4"
            >
              {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span className="ml-2 hidden sm:inline">{t("chat.send")}</span>
            </Button>
          </div>
          <DisclaimerNotice disclaimer={disclaimer || t("chat.disclaimer")} />
        </div>
      </Card>
    </div>
  );
}
