import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MatterPicker, buildMatterSummary } from "@/components/MatterPicker";
import type { Matter } from "@/hooks/use-matters";

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

const SUGGESTED_PROMPTS_EN = [
  { label: "Fasakh Grounds", text: "What are the grounds for fasakh under Section 52 of the Islamic Family Law Act 303?" },
  { label: "Harta Sepencarian", text: "Explain the principles of harta sepencarian and how the court determines the division ratio." },
  { label: "Hadhanah Rights", text: "Who has priority for hadhanah (custody) under Malaysian Shariah law and what are the conditions?" },
  { label: "Nafkah Calculation", text: "How is nafkah (maintenance) calculated under the Islamic Family Law Act?" },
  { label: "Faraid Distribution", text: "Explain the faraid distribution shares for a deceased Muslim who leaves a wife, two sons, and one daughter." },
  { label: "Draft: Fasakh Application", text: "Please draft a complete Fasakh application (Permohonan Fasakh) in Bahasa Melayu for filing at the Shariah High Court, with all required sections and clauses." },
  { label: "Mut'ah Claim", text: "What factors does the court consider when determining mut'ah (consolatory gift) after divorce?" },
  { label: "Court Procedure", text: "Explain the step-by-step procedure for filing a case at the Shariah Subordinate Court." },
];

const SUGGESTED_PROMPTS_BM = [
  { label: "Alasan Fasakh", text: "Apakah alasan-alasan fasakh di bawah Seksyen 52 Akta Undang-Undang Keluarga Islam 303?" },
  { label: "Harta Sepencarian", text: "Terangkan prinsip harta sepencarian dan bagaimana mahkamah menentukan nisbah pembahagian." },
  { label: "Hak Hadhanah", text: "Siapa yang mempunyai keutamaan untuk hadhanah di bawah undang-undang Syariah Malaysia dan apakah syarat-syaratnya?" },
  { label: "Pengiraan Nafkah", text: "Bagaimana nafkah dikira di bawah Akta Undang-Undang Keluarga Islam?" },
  { label: "Pembahagian Faraid", text: "Terangkan bahagian pembahagian faraid bagi si mati Muslim yang meninggalkan isteri, dua anak lelaki, dan seorang anak perempuan." },
  { label: "Draf: Permohonan Fasakh", text: "Sila draf permohonan Fasakh yang lengkap dalam Bahasa Melayu untuk difailkan di Mahkamah Tinggi Syariah, dengan semua seksyen dan klausa yang diperlukan." },
  { label: "Tuntutan Mut'ah", text: "Apakah faktor yang dipertimbangkan oleh mahkamah dalam menentukan mut'ah selepas perceraian?" },
  { label: "Prosedur Mahkamah", text: "Terangkan prosedur langkah demi langkah untuk memfailkan kes di Mahkamah Rendah Syariah." },
];

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactElement[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="font-serif font-bold text-base mt-3 mb-1 text-foreground">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="font-serif font-bold text-lg mt-4 mb-1.5 text-foreground">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="font-serif font-bold text-xl mt-4 mb-2 text-foreground">{line.slice(2)}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={i} className="flex gap-2 ml-2">
          <span className="text-secondary mt-0.5 shrink-0">&#8226;</span>
          <span>{renderInlineMarkdown(line.slice(2))}</span>
        </div>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)?.[1];
      elements.push(
        <div key={i} className="flex gap-2 ml-2">
          <span className="text-secondary font-semibold shrink-0">{num}.</span>
          <span>{renderInlineMarkdown(line.replace(/^\d+\.\s/, ""))}</span>
        </div>
      );
    } else if (line.startsWith("---") || line.startsWith("***")) {
      elements.push(<hr key={i} className="my-2 border-border/50" />);
    } else if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-secondary/50 pl-3 ml-1 italic text-muted-foreground">
          {renderInlineMarkdown(line.slice(2))}
        </blockquote>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1.5" />);
    } else {
      elements.push(<p key={i}>{renderInlineMarkdown(line)}</p>);
    }
    i++;
  }

  return <>{elements}</>;
}

function renderInlineMarkdown(text: string) {
  const parts: (string | React.ReactElement)[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
    const codeMatch = remaining.match(/`(.+?)`/);

    let earliest: { match: RegExpMatchArray; type: string } | null = null;
    for (const [type, match] of [["bold", boldMatch], ["italic", italicMatch], ["code", codeMatch]] as const) {
      if (match && match.index !== undefined && (!earliest || match.index < earliest.match.index!)) {
        earliest = { match, type };
      }
    }

    if (!earliest) {
      parts.push(remaining);
      break;
    }

    const { match, type } = earliest;
    if (match.index! > 0) {
      parts.push(remaining.slice(0, match.index!));
    }

    if (type === "bold") {
      parts.push(<strong key={key++} className="font-semibold text-foreground">{match[1]}</strong>);
    } else if (type === "italic") {
      parts.push(<em key={key++} className="italic">{match[1]}</em>);
    } else if (type === "code") {
      parts.push(<code key={key++} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{match[1]}</code>);
    }

    remaining = remaining.slice(match.index! + match[0].length);
  }

  return <>{parts}</>;
}

export default function AICounselPage() {
  const { t, mode } = useLanguage();
  const [activeConversation, setActiveConversation] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [showExportNotice, setShowExportNotice] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, refetch: refetchConversations } = useQuery({
    queryKey: ["gemini-conversations"],
    queryFn: api.gemini.listConversations,
  });

  const createConversation = useMutation({
    mutationFn: (title: string) => api.gemini.createConversation(title),
    onSuccess: (data) => {
      setActiveConversation(data.id);
      setMessages([]);
      setNewTitle("");
      refetchConversations();
    },
  });

  const loadConversation = useCallback(async (id: number) => {
    const data = await api.gemini.getConversation(id);
    setActiveConversation(id);
    setMessages(data.messages || []);
  }, []);

  const deleteConversation = async (id: number) => {
    await api.gemini.deleteConversation(id);
    if (activeConversation === id) {
      setActiveConversation(null);
      setMessages([]);
    }
    refetchConversations();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (overrideContent?: string) => {
    const content = overrideContent || input.trim();
    if (!content || !activeConversation || isStreaming) return;

    if (!overrideContent) setInput("");
    setMessages((prev) => [...prev, { role: "user", content }]);
    setIsStreaming(true);

    try {
      const response = await api.gemini.sendMessage(activeConversation, content);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let assistantContent = "";
      let buffer = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                assistantContent += data.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                  return updated;
                });
              }
              if (data.error) {
                assistantContent += `\n\n[Error: ${data.error}]`;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }

      refetchConversations();
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: mode === "bm" ? "Ralat berlaku. Sila cuba lagi." : "An error occurred. Please try again." },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const exportConversation = () => {
    if (messages.length === 0) return;
    const conv = conversations?.find((c: any) => c.id === activeConversation);
    const title = conv?.title || "Conversation";
    let text = `${title}\n${"=".repeat(title.length)}\n\n`;
    for (const msg of messages) {
      const label = msg.role === "user" ? "User" : "AI Peguam Kanan Syarie";
      text += `[${label}]\n${msg.content}\n\n`;
    }
    text += `---\n${t("Exported from MySyariahAI", "Dieksport daripada MySyariahAI")} | ${new Date().toLocaleString('en-GB')}`;
    navigator.clipboard.writeText(text).then(() => {
      setShowExportNotice(true);
      setTimeout(() => setShowExportNotice(false), 2000);
    });
  };

  const suggestedPrompts = mode === "bm" ? SUGGESTED_PROMPTS_BM : SUGGESTED_PROMPTS_EN;

  return (
    <div className="flex h-[calc(100vh-3rem-2.5rem)] lg:h-[calc(100vh-2.5rem)]">
      <div className="hidden md:flex w-64 flex-col border-r border-border bg-muted/20">
        <div className="p-3 border-b border-border">
          <h2 className="font-serif font-semibold text-sm text-foreground mb-2">
            {t("Conversations", "Perbualan")}
          </h2>
          <div className="flex gap-1.5">
            <Input
              placeholder={mode === "bm" ? "Tajuk baru..." : "New title..."}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="text-xs h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTitle.trim()) {
                  createConversation.mutate(newTitle.trim());
                }
              }}
            />
            <Button
              size="sm"
              className="h-8 px-2 text-xs"
              disabled={!newTitle.trim()}
              onClick={() => createConversation.mutate(newTitle.trim())}
            >
              +
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {conversations?.map((c: any) => (
              <div
                key={c.id}
                className={`group flex items-center justify-between p-2 rounded-md text-xs cursor-pointer transition-colors ${
                  activeConversation === c.id
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => loadConversation(c.id)}
              >
                <span className="truncate flex-1">{c.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive ml-1 p-0.5"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {!activeConversation ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-lg">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 border-2 border-secondary/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h2 className="text-xl font-serif font-bold text-foreground">
                {t("AI Peguam Kanan Syarie", "AI Peguam Kanan Syarie")}
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                {t(
                  "Your AI-powered Senior Shariah Counsel. Ask questions, draft documents, and get expert guidance on Malaysian Shariah law.",
                  "Peguam Kanan Syarie berkuasa AI anda. Tanya soalan, draf dokumen, dan dapatkan panduan pakar mengenai undang-undang Syariah Malaysia."
                )}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                {suggestedPrompts.slice(0, 4).map((p, i) => (
                  <button
                    key={i}
                    className="text-left text-xs p-2.5 rounded-lg border border-border/50 hover:border-secondary/40 hover:bg-muted/50 transition-colors text-muted-foreground"
                    onClick={() => {
                      if (!activeConversation) {
                        const title = p.label;
                        createConversation.mutate(title, {
                          onSuccess: () => {
                            setTimeout(() => sendMessage(p.text), 200);
                          }
                        });
                      }
                    }}
                  >
                    <span className="font-medium text-foreground/80 block mb-0.5">{p.label}</span>
                    <span className="line-clamp-2">{p.text}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <MatterPicker onSelect={(m: Matter) => {
                  // Pre-fill the conversation title with the matter title
                  setNewTitle(m.title);
                  // Pre-fill the input box with the formatted context summary
                  setInput(buildMatterSummary(m));
                }} />
              </div>
              <div className="mt-2 md:hidden">
                <Input
                  placeholder={mode === "bm" ? "Tajuk perbualan baru..." : "New conversation title..."}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="text-sm mb-2"
                />
                <Button
                  className="w-full"
                  disabled={!newTitle.trim()}
                  onClick={() => createConversation.mutate(newTitle.trim())}
                >
                  {t("Start Conversation", "Mulakan Perbualan")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-6 leading-relaxed border-t border-border/50 pt-4">
                {t(
                  "This is AI-generated guidance. All references must be independently verified against primary sources.",
                  "Ini adalah panduan yang dijana oleh AI. Semua rujukan mesti disahkan secara bebas terhadap sumber primer."
                )}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/10">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">AI Peguam Kanan Syarie</Badge>
                {conversations?.find((c: any) => c.id === activeConversation)?.title && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {conversations.find((c: any) => c.id === activeConversation)?.title}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={exportConversation}
                  disabled={messages.length === 0}
                  title={mode === "bm" ? "Eksport perbualan" : "Export conversation"}
                >
                  <svg className="w-3.5 h-3.5 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12l7-7 7 7" />
                  </svg>
                  {t("Export", "Eksport")}
                </Button>
                {showExportNotice && (
                  <span className="text-xs text-green-500">{t("Copied!", "Disalin!")}</span>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="max-w-3xl mx-auto space-y-4">
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground text-center mb-3">
                      {t("Try one of these prompts or type your own question:", "Cuba salah satu soalan berikut atau taip soalan anda sendiri:")}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {suggestedPrompts.map((p, i) => (
                        <button
                          key={i}
                          className="text-left text-xs p-3 rounded-lg border border-border/50 hover:border-secondary/40 hover:bg-muted/50 transition-colors"
                          onClick={() => sendMessage(p.text)}
                        >
                          <span className="font-medium text-foreground/80 block mb-0.5">{p.label}</span>
                          <span className="text-muted-foreground line-clamp-2">{p.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] ${msg.role === "user" ? "order-1" : "order-2"}`}>
                      <div
                        className={`rounded-lg px-4 py-3 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border border-border"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="leading-relaxed">{renderMarkdown(msg.content)}</div>
                        ) : (
                          <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                        )}
                      </div>
                      {msg.role === "assistant" && msg.content && (
                        <div className="flex gap-1 mt-1">
                          <button
                            onClick={() => speakText(msg.content)}
                            className="text-xs text-muted-foreground hover:text-foreground p-1 rounded"
                            title={mode === "bm" ? "Baca" : "Read aloud"}
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 5L6 9H2v6h4l5 4V5z" />
                              <path d="M15.54 8.46a5 5 0 010 7.07" />
                            </svg>
                          </button>
                          <button
                            onClick={() => navigator.clipboard.writeText(msg.content)}
                            className="text-xs text-muted-foreground hover:text-foreground p-1 rounded"
                            title={mode === "bm" ? "Salin" : "Copy"}
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-start">
                    <div className="bg-card border border-border rounded-lg px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-border p-3 bg-background">
              <div className="max-w-3xl mx-auto">
                {!isStreaming && messages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(mode === "bm"
                      ? [
                          { label: "Draf dokumen", text: "Sila draf dokumen undang-undang berdasarkan perbincangan di atas." },
                          { label: "Peruntukan berkaitan", text: "Apakah peruntukan undang-undang lain yang berkaitan dengan isu ini?" },
                          { label: "Kes berkaitan", text: "Senaraikan kes-kes yang berkaitan dengan isu ini termasuk kes dari Jurnal Hukum." },
                        ]
                      : [
                          { label: "Draft document", text: "Please draft a legal document based on our discussion above." },
                          { label: "Related provisions", text: "What other legal provisions are related to this issue?" },
                          { label: "Related cases", text: "List related case laws for this issue including cases from Jurnal Hukum." },
                        ]
                    ).map((q, i) => (
                      <button
                        key={i}
                        className="text-xs px-2.5 py-1 rounded-full border border-border/60 hover:border-secondary/40 hover:bg-muted/30 text-muted-foreground transition-colors"
                        onClick={() => sendMessage(q.text)}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={mode === "bm" ? "Taip soalan anda..." : "Type your question..."}
                    className="resize-none min-h-[44px] max-h-32 text-sm"
                    rows={1}
                    disabled={isStreaming}
                  />
                  <Button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || isStreaming}
                    className="h-11 px-4 self-end"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
