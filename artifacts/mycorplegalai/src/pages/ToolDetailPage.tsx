import { useEffect, useState, useRef } from "react";
import { emitRateLimit, readRateLimitRemaining } from "@/lib/rate-limit-bus";
import { useLocation, useParams, useSearchParams, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { PRACTITIONER_TOOLS } from "@/data/ai-tools-data";
import { ArrowLeft, Send, Loader2, RotateCcw, Sparkles, Lock, Volume2, Square } from "lucide-react";
import { DraftExportButtons } from "@workspace/draft-export/react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTier, canAccessTool, canUseVoice, minTierForTool } from "@/lib/tier";
import { useTts } from "@/lib/tts";
import { FileUploadDropzone, buildContextFromFiles } from "@/components/FileUploadDropzone";
import { SaveToMatterPanel } from "@/components/SaveToMatterPanel";
import { MatterPicker } from "@/components/MatterPicker";
import type { Matter } from "@/hooks/use-matters";

const TIER_LABELS: Record<string, string> = {
  firm: "Firm",
  practitioner: "Practitioner",
  student: "Student",
  legacy_full: "Full Access",
};

export default function ToolDetailPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const [searchParams] = useSearchParams();
  const tier = useTier();
  const tts = useTts();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  // Matter context from query string (e.g. coming from Case Home panel)
  const matterIdParam = searchParams.get("matterId") ?? searchParams.get("matter");
  const matterIdFromQuery = matterIdParam && Number.isInteger(Number(matterIdParam))
    ? Number(matterIdParam)
    : null;
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) {
      setLocation("/login");
    }
  }, [setLocation]);

  // Stop voice playback whenever the output is cleared (reset, new generate, or navigate away)
  useEffect(() => {
    if (!output) tts.stop();
  }, [output]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Pre-fill fields from Case Home query params (matterId, client, ref, matterTitle).
  // Runs once per tool/query combination; user can edit freely afterwards.
  useEffect(() => {
    if (!tool) return;
    const qClient = searchParams.get("client") ?? "";
    const qRef = searchParams.get("ref") ?? "";
    const qMatterTitle = searchParams.get("matterTitle") ?? "";
    // Only prefill if at least one query value is present
    if (!qClient && !qRef && !qMatterTitle) return;

    const updates: Record<string, string> = {};
    for (const field of tool.formFields) {
      if (field.type === "files" || field.type === "select") continue;
      const lc = (field.label + " " + field.id).toLowerCase();
      if (/client|company|addressee/.test(lc) && qClient && !updates[field.id]) {
        updates[field.id] = qClient;
      } else if (/matter|subject|title|reference|ref/.test(lc) && (qMatterTitle || qRef) && !updates[field.id]) {
        updates[field.id] = qMatterTitle || qRef;
      }
    }
    if (Object.keys(updates).length > 0) {
      setFormValues((prev) => ({ ...updates, ...prev }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool?.id]);

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

  /** Pre-fill form fields from a selected matter. */
  const handleMatterSelect = (matter: Matter) => {
    const updates: Record<string, string> = {};

    // Build a formatted summary for any leading textarea
    const summary = [
      matter.title && `Matter: ${matter.title}`,
      matter.clientName && `Client: ${matter.clientName}`,
      matter.counterparty && `Counterparty: ${matter.counterparty}`,
      matter.matterType && `Type: ${matter.matterType}`,
      matter.reference && `Ref: ${matter.reference}`,
    ]
      .filter(Boolean)
      .join(" | ");

    let firstTextareaFilled = false;

    for (const field of tool.formFields) {
      if (field.type === "files" || field.type === "select") continue;

      const lc = (field.label + " " + field.id).toLowerCase();

      // client / company name
      if (/client|company/.test(lc) && matter.clientName) {
        updates[field.id] = matter.clientName;
        continue;
      }

      // counterparty / opposing party
      if (/counterparty|opposing party|opponent/.test(lc) && matter.counterparty) {
        updates[field.id] = matter.counterparty;
        continue;
      }

      // matter title / reference / file ref
      if (/\bmatter\b|reference|file ref|suit|case no/.test(lc)) {
        updates[field.id] = matter.reference ?? matter.title;
        continue;
      }

      // first textarea → summary (only if not already matched above)
      if (field.type === "textarea" && !firstTextareaFilled) {
        firstTextareaFilled = true;
        updates[field.id] = summary;
        continue;
      }
    }

    setFormValues((prev) => ({ ...prev, ...updates }));
  };

  const isFormValid = tool.isValid
    ? tool.isValid(formValues)
    : tool.formFields
        .filter((f) => f.required)
        .every((f) => formValues[f.id]?.trim());

  const handleGenerate = async () => {
    if (!isFormValid || isLoading) return;
    tts.stop();
    setIsLoading(true);
    setError(null);
    setOutput("");

    const prompt = tool.buildPrompt(formValues);

    try {
      const authToken = localStorage.getItem("auth_token");
      const response = await fetch("/api/corp/legal/ai-tools/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        // Tool IDs are shared with the backend registry. Never downgrade an
        // unrecognised specialist tool to a generic tutor prompt: a rejected
        // request is safer and more useful than the wrong kind of work product.
        body: JSON.stringify({ tool: tool.id, message: prompt, matterId: matterIdFromQuery ?? undefined }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 429) emitRateLimit(0);
        throw new Error(errData.error || "Failed to connect to AI");
      }
      const rl = readRateLimitRemaining(response);
      if (rl !== null) emitRateLimit(rl);
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let sawDone = false;

      const processEvent = (event: string) => {
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.replace(/^data:\s?/, ""))
          .join("\n")
          .trim();
        if (!data) return;
        if (data === "[DONE]") {
          sawDone = true;
          return;
        }

        let parsed: { content?: string; error?: string; done?: boolean; complete?: boolean };
        try {
          parsed = JSON.parse(data);
        } catch {
          throw new Error("The AI response was malformed. No draft has been marked as complete.");
        }
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.content) setOutput((prev) => prev + parsed.content);
        if (parsed.done) {
          sawDone = parsed.complete !== false;
          if (parsed.complete === false) {
            throw new Error("The AI response stopped before the draft was complete. Please generate it again.");
          }
        }
      };

      while (!sawDone) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";
        for (const event of events) {
          processEvent(event);
          if (sawDone) break;
        }
      }

      buffer += decoder.decode();
      if (buffer.trim() && !sawDone) {
        processEvent(buffer);
      }
      if (!sawDone) {
        throw new Error("The AI connection ended before the draft was complete. Please generate it again.");
      }
      reader.cancel().catch(() => {});
    } catch (err: unknown) {
      // Never leave a truncated response looking exportable or complete.
      setOutput("");
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    tts.stop();
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
          <div
            className="bg-card border border-purple-500/15 rounded-xl p-5 space-y-4"
            data-testid="case-home-handoff-target"
            data-matter-id={matterIdFromQuery ?? undefined}
          >
            <h3 className="font-serif font-semibold text-foreground text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Input Details
            </h3>

            {/* If we arrived from Case Home, show the originating matter context */}
            {matterIdFromQuery && (searchParams.get("client") || searchParams.get("matterTitle") || searchParams.get("ref")) && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>
                  Fields pre-filled from matter
                  {searchParams.get("matterTitle") ? ` "${searchParams.get("matterTitle")}"` : ` #${matterIdFromQuery}`}.
                  {" "}Edit freely before generating.
                </span>
                <Link
                  href={`/matters/${matterIdFromQuery}`}
                  className="ml-auto text-primary hover:underline shrink-0"
                >
                  Back to matter
                </Link>
              </div>
            )}

            {/* Matter picker — pre-fills form fields from an existing case file */}
            <MatterPicker onSelect={handleMatterSelect} />

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
                  <DraftExportButtons title={tool?.name || "Document"} content={output} />
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

        {/* Save the completed draft into a matter file */}
        {output && !isLoading && (
          <SaveToMatterPanel
            draftTitle={tool.name}
            draftContent={output}
            defaultMatterId={matterIdFromQuery}
          />
        )}
      </div>
    </AppLayout>
  );
}

function OutputRenderer({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    if (isTableStart(lines, lineIndex)) {
      const header = splitTableRow(line);
      lineIndex += 2; // Skip the Markdown table divider.
      const rows: string[][] = [];
      while (lineIndex < lines.length && isTableRow(lines[lineIndex]!)) {
        rows.push(splitTableRow(lines[lineIndex]!));
        lineIndex += 1;
      }
      lineIndex -= 1;
      elements.push(
        <div key={key++} className="my-3 overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[520px] border-collapse text-left text-xs">
            <thead className="bg-secondary/50 text-foreground">
              <tr>{header.map((cell, index) => <th key={index} className="border-b border-border px-3 py-2 font-semibold">{renderInline(cell)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-border/70 last:border-0">
                  {header.map((_, cellIndex) => <td key={cellIndex} className="align-top px-3 py-2 text-muted-foreground">{renderInline(row[cellIndex] ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (/^```/.test(line.trim())) {
      const codeLines: string[] = [];
      lineIndex += 1;
      while (lineIndex < lines.length && !/^```/.test(lines[lineIndex]!.trim())) {
        codeLines.push(lines[lineIndex]!);
        lineIndex += 1;
      }
      elements.push(<pre key={key++} className="my-3 overflow-x-auto rounded-md bg-secondary/60 p-3 text-xs text-foreground whitespace-pre-wrap">{codeLines.join("\n")}</pre>);
    } else if (/^#{1,3}\s/.test(line)) {
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

function isTableStart(lines: string[], index: number): boolean {
  const header = lines[index];
  const divider = lines[index + 1];
  return Boolean(
    header &&
    divider &&
    isTableRow(header) &&
    isTableDivider(divider),
  );
}

function isTableRow(line: string): boolean {
  return /^\s*\|/.test(line) && splitTableRow(line).length >= 2;
}

function isTableDivider(line: string): boolean {
  return isTableRow(line) && splitTableRow(line).every((cell) => /^:?-{1,}:?$/.test(cell));
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
}

function renderInline(text: string): React.ReactNode {
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
