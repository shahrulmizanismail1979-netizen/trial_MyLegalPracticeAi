import { useEffect, useState, useRef } from "react";
import { useLocation, useParams, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { PRACTITIONER_TOOLS } from "@/data/ai-tools-data";
import { ArrowLeft, Send, Loader2, Copy, Check, Download, RotateCcw, Sparkles, Lock, Volume2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTier, canAccessTool, canUseVoice, minTierForTool } from "@/lib/tier";
import { useTts } from "@/lib/tts";
import { FileUploadDropzone, buildContextFromFiles } from "@/components/FileUploadDropzone";

const TIER_LABELS: Record<string, string> = {
  firm: "Firm",
  practitioner: "Practitioner",
  student: "Student",
  legacy_full: "Full Access",
};

export default function ToolDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const tier = useTier();
  const tts = useTts();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) {
      setLocation("/login");
    }
  }, [setLocation]);

  const tool = PRACTITIONER_TOOLS.find((t) => t.id === id);

  if (!tool) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-serif text-muted-foreground">Tool not found.</h2>
          <Link href="/tools" className="text-primary underline mt-4 block">Back to Tools</Link>
        </div>
      </AppLayout>
    );
  }

  const locked = !canAccessTool(tier, tool.id);
  if (locked) {
    const requiredTier = TIER_LABELS[minTierForTool(tool.id)] ?? "a higher tier";
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto py-16 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">{tool.name} is locked</h1>
            <p className="text-sm text-muted-foreground mt-2">
              This tool requires the <span className="text-primary font-semibold">{requiredTier}</span> plan.
              Upgrade to unlock it and the rest of that tier's features.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors text-sm"
            >
              <Sparkles className="w-4 h-4" />
              View plans
            </Link>
            <Link
              href="/tools"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-muted-foreground hover:text-foreground rounded-lg transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to tools
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const updateField = (fieldId: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const isFormValid = tool.isValid
    ? tool.isValid(formValues)
    : tool.formFields
        .filter((f) => f.required)
        .every((f) => formValues[f.id]?.trim());

  const handleGenerate = async () => {
    if (!isFormValid || isLoading) return;
    setIsLoading(true);
    setError(null);
    setOutput("");

    const prompt = tool.buildPrompt(formValues);
    const backendTool = mapToBackendTool(tool.id);

    try {
      const authToken = localStorage.getItem("auth_token");
      const response = await fetch("/api/corp/legal/ai-tools/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ tool: backendTool, message: prompt }),
      });

      if (!response.ok) throw new Error("Failed to connect to AI");
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) { setError(parsed.error); streamDone = true; break; }
            if (parsed.done) { streamDone = true; break; }
            if (parsed.content) {
              setOutput((prev) => prev + parsed.content);
            }
          } catch { /* ignore */ }
        }
      }
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith("data: ") && trimmed.slice(6) !== "[DONE]") {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            if (parsed.content) setOutput((prev) => prev + parsed.content);
          } catch { /* ignore */ }
        }
      }
      reader.cancel().catch(() => {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tool.id}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFormValues({});
    setOutput("");
    setError(null);
    setResetKey((k) => k + 1); // remounts file dropzones so their file lists clear
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Link
            href="/tools"
            className="w-9 h-9 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors shrink-0 mt-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-9 h-9 rounded-lg bg-background border border-border flex items-center justify-center`}>
                <tool.icon className={`w-5 h-5 ${tool.color}`} />
              </div>
              <h1 className="text-3xl font-serif font-bold text-foreground">{tool.name}</h1>
            </div>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Form Column */}
          <div className="bg-card border border-purple-500/15 rounded-xl p-5 space-y-4">
            <h3 className="font-serif font-semibold text-foreground text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Input Details
            </h3>

            {tool.formFields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <label className="text-xs font-medium text-foreground flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-primary">*</span>}
                </label>
                {field.helpText && (
                  <p className="text-[10px] text-muted-foreground">{field.helpText}</p>
                )}
                {field.type === "files" ? (
                  <FileUploadDropzone
                    key={`${field.id}-${resetKey}`}
                    label={field.label}
                    hint={field.filesHint}
                    onFilesExtracted={(files) =>
                      updateField(
                        field.id,
                        buildContextFromFiles(files, field.filesHeading ?? "UPLOADED DOCUMENTS:"),
                      )
                    }
                  />
                ) : field.type === "textarea" ? (
                  <textarea
                    value={formValues[field.id] ?? ""}
                    onChange={(e) => updateField(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[100px] resize-y placeholder:text-muted-foreground/50"
                  />
                ) : field.type === "select" ? (
                  <select
                    value={formValues[field.id] ?? ""}
                    onChange={(e) => updateField(field.id, e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Select...</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : field.type === "date" ? (
                  <input
                    type="date"
                    value={formValues[field.id] ?? ""}
                    onChange={(e) => updateField(field.id, e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                ) : (
                  <input
                    type={field.type === "number" ? "number" : "text"}
                    value={formValues[field.id] ?? ""}
                    onChange={(e) => updateField(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
                  />
                )}
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleGenerate}
                disabled={!isFormValid || isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleReset} title="Reset form">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          {/* Output Column */}
          <div className="bg-card border border-purple-500/15 rounded-xl flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <h3 className="font-serif font-semibold text-foreground text-sm">AI Output</h3>
              {output && (
                <div className="flex items-center gap-1.5">
                  {canUseVoice(tier) && (
                    <button
                      onClick={() => (tts.isPlaying ? tts.stop() : tts.play(output))}
                      disabled={tts.isLoading}
                      className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent/10 transition-colors disabled:opacity-50"
                      title="Read aloud (Firm)"
                    >
                      {tts.isLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : tts.isPlaying ? (
                        <Square className="w-3 h-3 text-primary" />
                      ) : (
                        <Volume2 className="w-3 h-3" />
                      )}
                      {tts.isPlaying ? "Stop" : "Read aloud"}
                    </button>
                  )}
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent/10 transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-accent/10 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </button>
                </div>
              )}
            </div>
            <ScrollArea className="flex-1 p-5">
              {output ? (
                <div ref={outputRef} className="text-sm leading-relaxed">
                  <OutputRenderer text={output} />
                </div>
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm">Generating your {tool.shortName}...</p>
                  <p className="text-[10px]">This may take 15-30 seconds for complex outputs</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                  <tool.icon className={`w-10 h-10 ${tool.color} opacity-30`} />
                  <p className="text-sm text-center">Fill in the form and click Generate to create your {tool.shortName}</p>
                </div>
              )}
            </ScrollArea>
            <div className="px-5 py-2 border-t border-border text-center">
              <p className="text-[9px] text-muted-foreground/50">
                AI-generated content. Verify all statutory citations and legal analysis independently before use.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function mapToBackendTool(toolId: string): string {
  const directTools = [
    "legal-opinion", "transaction-advisor", "dd-report", "spa-reviewer",
    "board-resolution", "macc-17a", "ssm-filing", "stamp-duty",
    "compliance-calendar", "client-letter", "sha-builder", "aml-checker",
    "corporate-secretary", "ipo-readiness", "employment-advisor", "cross-border",
    "dispute-resolution", "contract-review", "islamic-finance", "negotiation-points",
    "negotiation-simulator", "mediation-simulator", "arbitration-simulator",
    "client-consultation-trainer", "board-presentation-simulator",
  ];
  if (directTools.includes(toolId)) return toolId;
  return "tutor";
}

function OutputRenderer({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) {
      const level = (line.match(/^#+/) || [""])[0].length;
      const content = line.replace(/^#+\s*/, "");
      if (level === 1) {
        elements.push(<h2 key={key++} className="text-lg font-serif font-bold text-primary mt-5 mb-2">{content}</h2>);
      } else if (level === 2) {
        elements.push(<h3 key={key++} className="text-base font-serif font-semibold text-primary mt-4 mb-1.5">{content}</h3>);
      } else {
        elements.push(<h4 key={key++} className="text-sm font-semibold text-foreground mt-3 mb-1">{content}</h4>);
      }
    } else if (/^\*\*[^*]+\*\*$/.test(line.trim())) {
      elements.push(
        <p key={key++} className="font-semibold text-primary mt-4 mb-1">{line.trim().replace(/\*\*/g, "")}</p>
      );
    } else if (/^\d+\.\s/.test(line)) {
      elements.push(
        <div key={key++} className="ml-2 flex gap-2 text-sm">
          <span className="text-primary font-semibold shrink-0">{line.match(/^\d+/)![0]}.</span>
          <span>{renderInline(line.replace(/^\d+\.\s*/, ""))}</span>
        </div>
      );
    } else if (/^\s*[-•*]\s/.test(line)) {
      const indent = (line.match(/^\s*/) || [""])[0].length;
      elements.push(
        <div key={key++} className="flex gap-2 text-sm" style={{ marginLeft: Math.min(indent * 4 + 16, 80) }}>
          <span className="text-primary mt-1.5 shrink-0">•</span>
          <span>{renderInline(line.replace(/^\s*[-•*]\s*/, ""))}</span>
        </div>
      );
    } else if (/^\|/.test(line)) {
      elements.push(
        <p key={key++} className="text-sm font-mono text-muted-foreground">{line}</p>
      );
    } else if (line.trim() === "---" || line.trim() === "***") {
      elements.push(<hr key={key++} className="border-border my-3" />);
    } else if (line.trim() === "") {
      elements.push(<div key={key++} className="h-2" />);
    } else {
      elements.push(<p key={key++} className="text-sm leading-relaxed">{renderInline(line)}</p>);
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
