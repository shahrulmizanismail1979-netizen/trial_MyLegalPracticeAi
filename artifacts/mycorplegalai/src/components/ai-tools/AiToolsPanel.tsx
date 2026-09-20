import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  BrainCircuit, BookOpen, PenTool, AlertTriangle, ListChecks,
  Calendar, ChevronRight, ChevronLeft, Send, Loader2,
  FileSearch, Scale, ClipboardList, Copy, Check, Trash2, Lightbulb, X,
  FileCheck, Shield, Lock, Volume2, Square, Sparkles
} from "lucide-react";
import { useAiChat } from "@/hooks/use-ai-chat";
import { useAiContext } from "@/contexts/AiContext";
import { cn } from "@/lib/utils";
import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";
import { SaveToMatterPanel } from "@/components/SaveToMatterPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useTier, canAccessTool, canUseVoice, minTierForTool } from "@/lib/tier";
import { useTts } from "@/lib/tts";

const TIER_LABELS: Record<string, string> = {
  firm: "Firm",
  practitioner: "Practitioner",
  student: "Student",
  legacy_full: "Full Access",
};

type ToolId = "tutor" | "drafter" | "risk-scanner" | "checklist" | "deadline-calculator" | "document-analyzer" | "case-finder" | "minutes-drafter" | "contract-review" | "compliance-advisor";

const TOOLS: { id: ToolId; name: string; icon: React.ElementType; desc: string; placeholder: string; suggestions: string[] }[] = [
  {
    id: "tutor",
    name: "AI Tutor",
    icon: BookOpen,
    desc: "Q&A on Malaysian corporate law",
    placeholder: "Ask anything about Malaysian corporate law...",
    suggestions: [
      "What are the key duties of directors under the Companies Act 2016?",
      "Explain the oppression remedy under s.346 CA 2016",
      "What is the business judgment rule in Malaysia?",
      "How does the Indoor Management Rule apply to third parties?",
    ],
  },
  {
    id: "drafter",
    name: "AI Drafter",
    icon: PenTool,
    desc: "Draft resolutions, notices & agreements",
    placeholder: "Describe the document you need drafted...",
    suggestions: [
      "Draft a board resolution approving allotment of 10,000 shares to ABC Sdn Bhd at RM1.00 per share",
      "Draft a shareholders resolution to remove a director under s.206 CA 2016",
      "Draft a non-disclosure agreement between two Malaysian companies for an M&A due diligence exercise",
      "Draft a notice of annual general meeting for Syarikat XYZ Berhad",
    ],
  },
  {
    id: "risk-scanner",
    name: "Risk Scanner",
    icon: AlertTriangle,
    desc: "Identify legal red flags in transactions",
    placeholder: "Describe the transaction or scenario to scan for legal risks...",
    suggestions: [
      "A director is proposing to sell company assets to his own company at below market value",
      "A substantial shareholder wants to acquire 35% of a listed company's shares",
      "A company is taking on a floating charge over all its assets to secure a personal loan of a director",
      "We are conducting a management buyout of a Sdn Bhd with existing minority shareholders",
    ],
  },
  {
    id: "checklist",
    name: "Checklist",
    icon: ListChecks,
    desc: "Generate step-by-step procedural checklists",
    placeholder: "Select a transaction type or describe your transaction...",
    suggestions: [
      "Generate a full checklist for incorporating a Sdn Bhd in Malaysia",
      "Checklist for a share sale and purchase agreement transaction",
      "Steps required to allot new shares in a private company",
      "Full due diligence checklist for acquiring a Malaysian Sdn Bhd",
    ],
  },
  {
    id: "deadline-calculator",
    name: "Deadlines",
    icon: Calendar,
    desc: "Calculate all statutory deadlines",
    placeholder: "Enter transaction type and a key date (e.g., AGM date, incorporation date)...",
    suggestions: [
      "Company financial year ends 31 December 2024. Calculate all compliance deadlines.",
      "A floating charge was created on 15 January 2025. When must it be registered with SSM?",
      "AGM was held on 30 March 2025. Calculate annual return and audit filing deadlines.",
      "A listed company completed a private placement on 1 April 2025. What are the SC/Bursa deadlines?",
    ],
  },
  {
    id: "document-analyzer",
    name: "Doc Analyzer",
    icon: FileSearch,
    desc: "Analyze any legal document or clause",
    placeholder: "Paste the document, clause, or agreement text you want analyzed...",
    suggestions: [
      "Analyze this drag-along clause: 'If shareholders holding more than 75% of the issued shares agree to sell their shares...'",
      "Review this indemnity clause for risks under Malaysian law",
      "Analyze this non-compete clause in a shareholders agreement",
      "Review this material adverse change clause in a share sale agreement",
    ],
  },
  {
    id: "case-finder",
    name: "Case Finder",
    icon: Scale,
    desc: "Find relevant Malaysian case law",
    placeholder: "Describe your legal issue or question to find relevant cases...",
    suggestions: [
      "Cases on piercing the corporate veil in Malaysia",
      "Malaysian cases on oppression under s.346 Companies Act 2016",
      "Cases where directors were held personally liable for company debts",
      "Cases on just and equitable winding up in Malaysia",
    ],
  },
  {
    id: "minutes-drafter",
    name: "Minutes",
    icon: ClipboardList,
    desc: "Draft formal board/AGM minutes",
    placeholder: "Paste your rough meeting notes or describe decisions made...",
    suggestions: [
      "Draft board minutes: ABC Sdn Bhd board met on 1 April 2025. Approved Q1 accounts, approved allotment of 5000 shares to new investor at RM2/share, appointed Lim Ah Kow as new director.",
      "Draft AGM minutes for XYZ Berhad where shareholders approved the annual accounts, declared a 5% dividend, and re-elected all directors",
      "Draft extraordinary general meeting minutes where shareholders passed a special resolution to alter the company constitution",
      "Draft board minutes for a meeting that approved a RM5 million loan facility from Maybank",
    ],
  },
  {
    id: "contract-review",
    name: "Contract Review",
    icon: FileCheck,
    desc: "Review any contract clause for risks",
    placeholder: "Paste a contract clause or agreement section for review...",
    suggestions: [
      "Review this non-compete clause: 'The Employee shall not, for a period of 3 years after termination, engage in any business competing with the Company within Malaysia'",
      "Analyze this limitation of liability clause for risks under Malaysian law",
      "Review this force majeure clause in a supply agreement — does it cover pandemics?",
      "Is this indemnity clause enforceable under the Contracts Act 1950?",
    ],
  },
  {
    id: "compliance-advisor",
    name: "Compliance",
    icon: Shield,
    desc: "MACC, AML, SSM compliance questions",
    placeholder: "Ask about corporate compliance requirements...",
    suggestions: [
      "What are the annual compliance obligations for a Malaysian Sdn Bhd?",
      "How do I set up adequate procedures under s.17A MACC Act 2009?",
      "What are the AML/CFT obligations for law firms under AMLA 2001?",
      "Our company received a gift from a government official — what are the MACC implications?",
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-foreground"
      title="Copy response"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function ReadAloudButton({ text, tts }: { text: string; tts: ReturnType<typeof useTts> }) {
  return (
    <button
      onClick={() => (tts.isPlaying ? tts.stop() : tts.play(text))}
      disabled={tts.isLoading}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-50"
      title="Read aloud (Firm)"
    >
      {tts.isLoading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : tts.isPlaying ? (
        <Square className="w-3.5 h-3.5 text-primary" />
      ) : (
        <Volume2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

export function AiToolsPanel() {
  const { panelOpen, activeTool, trigger, clearTrigger, setPanelOpen, setActiveTool } = useAiContext();
  const tier = useTier();
  const tts = useTts();
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, isLoading, error, clearMessages } = useAiChat();

  const activeToolDef = TOOLS.find(t => t.id === activeTool);
  const activeLocked = activeTool ? !canAccessTool(tier, activeTool) : false;
  const requiredTier = activeTool ? (TIER_LABELS[minTierForTool(activeTool)] ?? "a higher tier") : "";

  // Handle external triggers (from "Ask AI" buttons in content)
  useEffect(() => {
    if (trigger) {
      const triggerLocked = !canAccessTool(tier, trigger.tool);
      if (trigger.tool !== activeTool) {
        setActiveTool(trigger.tool as typeof activeTool);
        clearMessages();
      }
      // If the triggered tool is out of tier, switch to it (revealing the
      // locked upgrade prompt) but do not fire a request.
      if (triggerLocked) {
        clearTrigger();
        return undefined;
      }
      // Small delay to let state settle then send
      const timer = setTimeout(() => {
        sendMessage(trigger.tool as Parameters<typeof sendMessage>[0], trigger.message, trigger.context);
        clearTrigger();
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [trigger]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading || activeLocked) return;
    sendMessage(activeTool as Parameters<typeof sendMessage>[0], input);
    setInput("");
    setShowSuggestions(false);
  };

  const handleToolChange = (toolId: ToolId) => {
    if (activeTool !== toolId) {
      tts.stop();
      setActiveTool(toolId);
      clearMessages();
      setInput("");
      setShowSuggestions(false);
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
  };

  return (
    <aside
      className={cn(
        "bg-card border-l border-border md:transition-all duration-300 ease-in-out flex-col",
        panelOpen
          ? "flex fixed inset-0 z-50 w-full md:static md:inset-auto md:z-20 md:relative md:w-[420px]"
          : "hidden md:flex md:relative md:z-20 md:w-16"
      )}
    >
      {/* Toggle Button (desktop only) */}
      <button
        onClick={() => { if (panelOpen) tts.stop(); setPanelOpen(!panelOpen); }}
        className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 w-8 h-16 bg-card border border-border border-r-0 rounded-l-md items-center justify-center text-muted-foreground hover:text-primary z-30 shadow-md"
      >
        {panelOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>

      {panelOpen ? (
        <>
          {/* Header */}
          <div className="h-14 flex items-center px-4 border-b border-border gap-2 shrink-0 gold-purple-gradient">
            <BrainCircuit className="w-5 h-5 text-primary" />
            <h2 className="font-serif font-bold text-base text-primary">AI Assistants</h2>
            <span className="ml-auto text-[10px] text-purple-300/70 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full font-medium">
              {TOOLS.length} Tools
            </span>
            {/* Close (mobile only) */}
            <button
              onClick={() => { tts.stop(); setPanelOpen(false); }}
              className="md:hidden text-muted-foreground hover:text-primary p-1 -mr-1"
              aria-label="Close AI assistants"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tool Tabs — two rows */}
          <div className="border-b border-border shrink-0 bg-sidebar/50">
            <div className="flex flex-wrap">
              {TOOLS.map((tool) => {
                const toolLocked = !canAccessTool(tier, tool.id);
                return (
                  <button
                    key={tool.id}
                    onClick={() => handleToolChange(tool.id)}
                    className={cn(
                      "px-2.5 py-2 text-[10px] font-medium whitespace-nowrap transition-colors border-b-2 flex items-center gap-1.5",
                      activeTool === tool.id
                        ? "border-primary text-primary bg-primary/5"
                        : toolLocked
                        ? "border-transparent text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/10"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/10"
                    )}
                    title={toolLocked ? `${tool.name} — requires ${TIER_LABELS[minTierForTool(tool.id)] ?? "upgrade"}` : tool.desc}
                  >
                    <tool.icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{tool.name}</span>
                    {toolLocked && <Lock className="w-2.5 h-2.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-background/30">
            <ScrollArea className="flex-1 p-4">
              {activeLocked ? (
                <div className="flex flex-col items-center text-center text-muted-foreground space-y-4 py-10 px-2">
                  <div className="w-14 h-14 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Lock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{activeToolDef?.name} is locked</p>
                    <p className="text-xs mt-1.5 max-w-[260px]">
                      This assistant requires the{" "}
                      <span className="text-primary font-semibold">{requiredTier}</span> plan. Upgrade to
                      unlock it.
                    </p>
                  </div>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors text-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    View plans
                  </Link>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center text-center text-muted-foreground space-y-4 py-8">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    {activeToolDef && <activeToolDef.icon className="w-6 h-6 text-primary" />}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{activeToolDef?.name}</p>
                    <p className="text-xs mt-0.5">{activeToolDef?.desc}</p>
                  </div>
                  {/* Suggested prompts */}
                  <div className="w-full space-y-2 mt-2">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">Suggested prompts</p>
                    {activeToolDef?.suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestion(s)}
                        className="w-full text-left text-xs p-2.5 rounded-lg bg-card border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "group relative text-sm",
                        msg.role === "user"
                          ? "ml-6"
                          : "mr-2"
                      )}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-wider mb-1 opacity-60 flex items-center gap-2">
                        {msg.role === "user" ? "You" : activeToolDef?.name}
                        {msg.role === "ai" && msg.content && msg.isComplete && <CopyButton text={msg.content} />}
                        {msg.role === "ai" && msg.content && msg.isComplete && canUseVoice(tier) && (
                          <ReadAloudButton text={msg.content} tts={tts} />
                        )}
                        {msg.role === "ai" && msg.content && msg.isComplete && (
                          <DraftExportButtons
                            title={activeToolDef?.name || "AI Response"}
                            content={msg.content}
                            className="normal-case tracking-normal"
                          />
                        )}
                      </div>
                      <div
                        className={cn(
                          "p-3 rounded-lg text-sm leading-relaxed",
                          msg.role === "user"
                            ? "bg-primary/15 border border-primary/25 text-foreground"
                            : "bg-card border border-border text-foreground"
                        )}
                      >
                        {msg.role === "ai"
                          ? (msg.isComplete ? <DraftDocument content={msg.content} /> : <MarkdownLike text={msg.content} />)
                          : <span className="whitespace-pre-wrap">{msg.content}</span>
                        }
                        {msg.role === "ai" &&
                          msg.content &&
                          msg.isComplete &&
                          !isLoading &&
                          (activeTool === "drafter" || activeTool === "minutes-drafter") && (
                            <div className="mt-3">
                              <SaveToMatterPanel
                                draftTitle={activeToolDef?.name ?? "AI Draft"}
                                draftContent={msg.content}
                              />
                            </div>
                          )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="bg-card border border-border rounded-lg p-3 w-fit flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Generating response...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {error && (
              <div
                role="alert"
                className="mx-3 mb-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"
              >
                {error}
              </div>
            )}

            {/* Input area */}
            <div className="p-3 border-t border-border bg-card shrink-0">
              {/* Context actions row */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  className={cn(
                    "flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-colors",
                    showSuggestions
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
                  )}
                >
                  <Lightbulb className="w-3 h-3" />
                  Suggestions
                </button>
                {messages.length > 0 && (
                  <button
                    onClick={() => { tts.stop(); clearMessages(); setInput(""); }}
                    className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-auto"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && (
                <div className="mb-2 space-y-1.5 border border-border rounded-md p-2 bg-background/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">Quick prompts</span>
                    <button onClick={() => setShowSuggestions(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {activeToolDef?.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestion(s)}
                      className="w-full text-left text-[11px] p-2 rounded bg-card hover:bg-primary/5 hover:border-primary/20 border border-transparent transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={activeLocked ? "Upgrade to use this assistant" : (activeToolDef?.placeholder ?? "Ask the AI...")}
                  disabled={activeLocked}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[72px] resize-none pr-10 text-foreground placeholder:text-muted-foreground/60 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Button
                  size="icon"
                  className="absolute bottom-2 right-2 h-7 w-7"
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading || activeLocked}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-[9px] text-muted-foreground/50 mt-1.5 text-center">
                AI responses do not constitute formal legal advice. Verify all statutory citations independently.
              </p>
            </div>
          </div>
        </>
      ) : (
        /* Collapsed state */
        <div className="flex flex-col items-center py-4 space-y-4">
          <BrainCircuit className="w-5 h-5 text-primary mb-2" />
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              onClick={() => { handleToolChange(tool.id); setPanelOpen(true); }}
              className={cn(
                "w-9 h-9 rounded-md flex items-center justify-center transition-colors",
                activeTool === tool.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
              )}
              title={tool.name}
            >
              <tool.icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

/** Simple markdown-like renderer for AI responses */
function MarkdownLike({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (isMarkdownTableStart(lines, i)) {
      const header = splitMarkdownTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isMarkdownTableRow(lines[i]!)) {
        rows.push(splitMarkdownTableRow(lines[i]!));
        i += 1;
      }
      i -= 1;
      elements.push(
        <div key={key++} className="my-2 overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[440px] border-collapse text-left text-xs">
            <thead className="bg-secondary/50">
              <tr>{header.map((cell, cellIndex) => <th key={cellIndex} className="border-b border-border px-2 py-1.5 font-semibold">{formatInline(cell)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border/70 last:border-0">
                  {header.map((_, cellIndex) => <td key={cellIndex} className="align-top px-2 py-1.5 text-muted-foreground">{formatInline(row[cellIndex] ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    }
    // Markdown headings
    else if (/^#{1,3}\s/.test(line)) {
      const level = (line.match(/^#+/) ?? [""])[0].length;
      const content = line.replace(/^#+\s*/, "");
      elements.push(
        level === 1
          ? <h3 key={key++} className="font-serif text-base font-bold text-primary mt-3">{content}</h3>
          : <h4 key={key++} className="font-semibold text-primary mt-3 text-sm">{content}</h4>,
      );
    }
    // Bold headings: **text** on its own line
    else if (/^\*\*[^*]+\*\*$/.test(line.trim())) {
      elements.push(
        <p key={key++} className="font-semibold text-primary mt-3 mb-0.5 text-sm">
          {line.trim().replace(/\*\*/g, "")}
        </p>
      );
    }
    // Numbered list
    else if (/^\d+\.\s/.test(line)) {
      elements.push(
        <p key={key++} className="ml-3 text-sm"><span className="text-primary font-semibold">{line.match(/^\d+/)![0]}.</span>{formatInline(line.replace(/^\d+\.\s/, " "))}</p>
      );
    }
    // Bullet list
    else if (/^[-•*]\s/.test(line)) {
      elements.push(
        <p key={key++} className="ml-4 flex gap-1.5 text-sm"><span className="text-primary mt-1">•</span><span>{formatInline(line.replace(/^[-•*]\s/, ""))}</span></p>
      );
    }
    // Empty line
    else if (line.trim() === "") {
      elements.push(<div key={key++} className="h-1" />);
    }
    // Normal text
    else {
      elements.push(
        <p key={key++} className="text-sm leading-relaxed">{formatInline(line)}</p>
      );
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function isMarkdownTableStart(lines: string[], index: number): boolean {
  const header = lines[index];
  const divider = lines[index + 1];
  return Boolean(
    header &&
    divider &&
    isMarkdownTableRow(header) &&
    isMarkdownTableDivider(divider),
  );
}

function isMarkdownTableRow(line: string): boolean {
  return /^\s*\|/.test(line) && splitMarkdownTableRow(line).length >= 2;
}

function isMarkdownTableDivider(line: string): boolean {
  return isMarkdownTableRow(line) && splitMarkdownTableRow(line).every((cell) => /^:?-{1,}:?$/.test(cell));
}

function splitMarkdownTableRow(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
