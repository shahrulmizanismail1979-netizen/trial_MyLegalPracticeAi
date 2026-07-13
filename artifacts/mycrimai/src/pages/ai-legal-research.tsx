import { useState, useRef, useEffect, useCallback } from "react";
import { Brain, Send, Loader2, RotateCcw, User, Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/ai/markdown-renderer";
import { VoiceControls } from "@/components/ai/voice-controls";
import { MicInputButton } from "@/components/ai/mic-input-button";
import { useAiStream } from "@/lib/use-ai-stream";
import { useVoice } from "@/lib/use-voice";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STARTER_PROMPTS = [
  "What are the essential elements of murder under Section 302 of the Penal Code?",
  "Explain the bail provisions under the Criminal Procedure Code for non-bailable offences",
  "What is the difference between culpable homicide and murder in Malaysian law?",
  "Summarize the legal requirements for a valid confession under Malaysian Evidence Act",
];

export function AiLegalResearchPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const voice = useVoice();

  const { response, isStreaming, error, stream, reset } = useAiStream({
    onComplete: (fullText) => {
      setMessages((prev) => [...prev, { role: "assistant", content: fullText }]);
      voice.speak(fullText);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, response]);

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = text || input.trim();
      if (!msg || isStreaming) return;

      const newMessages = [...messages, { role: "user" as const, content: msg }];
      setMessages(newMessages);
      setInput("");
      reset();

      await stream("/ai/legal-research", { messages: newMessages });
    },
    [input, messages, isStreaming, stream, reset]
  );

  const handleClear = () => {
    setMessages([]);
    reset();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            AI Legal Research
          </h1>
          <p className="text-muted-foreground">Ask any question about Malaysian criminal law — statutes, case authorities, procedures, sentencing, and practice guidance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <VoiceControls voice={voice} responseText={messages.filter((m) => m.role === "assistant").slice(-1)[0]?.content || ""} compact />
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClear}>
              <RotateCcw className="h-4 w-4 mr-2" /> New Chat
            </Button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto rounded-lg border border-border bg-card/30 p-4 space-y-4">
        {messages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="bg-primary/10 p-4 rounded-full">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold mb-2">Malaysian Criminal Law Research</h2>
              <p className="text-muted-foreground max-w-md">
                Ask questions about the Penal Code, Criminal Procedure Code, Evidence Act 1950, Dangerous Drugs Act, case law, sentencing, bail, appeals, or any criminal law topic. Get answers with specific section citations and relevant case references.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 max-w-2xl w-full">
              {STARTER_PROMPTS.map((prompt) => (
                <Card
                  key={prompt}
                  className="border-border/50 bg-card/50 hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => handleSend(prompt)}
                >
                  <CardContent className="p-3 text-sm text-muted-foreground">{prompt}</CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/30 border border-border/50"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p>{msg.content}</p>
                  ) : (
                    <MarkdownRenderer content={msg.content} />
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            ))}
            {isStreaming && response && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted/30 border border-border/50">
                  <MarkdownRenderer content={response} />
                </div>
              </div>
            )}
            {isStreaming && !response && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-lg px-4 py-3 bg-muted/30 border border-border/50">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              </div>
            )}
            {error && (
              <div className="text-center text-destructive text-sm p-3 bg-destructive/10 rounded-lg">
                {error}
              </div>
            )}
          </>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex gap-2 mt-4"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about Malaysian criminal law..."
          className="flex-1 bg-background/50"
          disabled={isStreaming}
          data-testid="input-legal-research"
        />
        <MicInputButton voice={voice} onTranscript={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))} />
        <Button type="submit" disabled={isStreaming || !input.trim()} data-testid="button-send-research">
          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
