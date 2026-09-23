import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import WorkspaceLayout from "./layout";
import MarkdownRenderer from "@/components/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, RefreshCw, Sparkles, Loader2, StopCircle, FileText, Wand2 } from "lucide-react";
import { isAuthenticated, getToken, authHeaders } from "@/lib/auth";
import { emitRateLimit, readRateLimitRemaining } from "@/lib/rate-limit-bus";
import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";
import { apiUrl } from "@/lib/api";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";
import { MatterPicker, mapMatterToFormValues } from "@/components/MatterPicker";
import type { Matter } from "@/hooks/use-matters";
import { consumeCompletionStream } from "@/lib/completion-stream";

type PracticeGuide = {
  inputs: string[];
  structure: string[];
  gaps: string[];
  review: string[];
};

function getPracticeGuide(tool: { id: string; name: string; category: string }): PracticeGuide {
  const key = `${tool.id} ${tool.name} ${tool.category}`.toLowerCase();
  if (/plead|affidavit|submission|litig|injunction|application/.test(key)) {
    return {
      inputs: ["Complete pleadings and orders", "Dated chronology with disputed facts marked", "Relief sought, procedural posture and hearing purpose"],
      structure: ["Case theory and issues", "Fact-to-evidence matrix", "Elements, responses and relief", "Authorities and next steps"],
      gaps: ["Missing exhibit or source witness", "Allegation not tied to admissible evidence", "Procedural fact or court direction not confirmed"],
      review: ["Match assertions to the evidential record", "Check relief against the live pleadings", "Verify every authority and quotation", "Apply current rules and registry practice"],
    };
  }
  if (/bank|facility|security|debt|recovery|insolv/.test(key)) {
    return {
      inputs: ["Executed facilities, variations and securities", "Certified account history and reconciliation", "Notices, service evidence and enforcement status"],
      structure: ["Facility and security map", "Default and notice chronology", "Amount reconciliation", "Options, dependencies and risks"],
      gaps: ["Unsigned variation or guarantee", "Unexplained ledger entry or interest basis", "Notice or proof of service missing"],
      review: ["Recalculate amounts independently", "Confirm parties and security particulars", "Check preconditions against each instrument", "Obtain current insolvency and enforcement advice"],
    };
  }
  if (/share|director|company|corporate|fraud/.test(key)) {
    return {
      inputs: ["Constitution, registers and ownership history", "Board and member materials", "Challenged acts, communications and requested remedy"],
      structure: ["Governance map", "Decision chronology", "Issue and remedy analysis", "Evidence requests and action plan"],
      gaps: ["Authority of decision-maker unclear", "Incomplete register or resolution set", "Beneficial ownership or conflict evidence absent"],
      review: ["Reconcile dates across corporate records", "Separate company and stakeholder interests", "Confirm approvals and execution", "Verify statutory analysis from primary materials"],
    };
  }
  return {
    inputs: ["Complete agreement and schedules", "Dated performance and communication chronology", "Parties' positions, loss material and desired outcome"],
    structure: ["Executive issue map", "Contract and fact analysis", "Evidence and remedy table", "Prioritised next actions"],
    gaps: ["Amendment or incorporated document absent", "Loss figure unsupported", "Assumption presented as an agreed fact"],
    review: ["Check defined terms and cross-references", "Trace each conclusion to a source", "Stress-test counterarguments", "Verify law, procedure and forum independently"],
  };
}

function PracticeGuidePanel({ tool }: { tool: { id: string; name: string; category: string; example?: Record<string, string>; sampleNote?: string } }) {
  const guide = getPracticeGuide(tool);
  const example = tool.example
    ? Object.entries(tool.example).slice(0, 3).map(([label, value]) => `${label}: ${value}`).join(" · ")
    : "State the event, date, source document, what is agreed or disputed, and the outcome counsel needs.";
  return (
    <details className="mb-5 rounded-lg border border-primary/20 bg-primary/5 p-3 group">
      <summary className="cursor-pointer list-none text-sm font-semibold flex justify-between gap-3">
        Matter preparation & quality guide
        <span className="text-xs font-normal text-primary group-open:hidden">Open</span>
        <span className="text-xs font-normal text-primary hidden group-open:inline">Close</span>
      </summary>
      <div className="grid sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-primary/15">
        <MiniGuide title="Prepare" items={guide.inputs} />
        <MiniGuide title="Expected output" items={guide.structure} />
        <MiniGuide title="Evidence gaps" items={guide.gaps} />
        <MiniGuide title="Review before use" items={guide.review} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground"><strong className="text-foreground">Example input:</strong> {example}</p>
      <p className="mt-2 text-xs text-muted-foreground"><strong className="text-foreground">FAQ:</strong> If a fact is unknown, label it “not confirmed” and identify the document or witness needed. Treat the result as a working draft: do not file, send or advise from it until the record, calculations, authorities and current procedure have been checked.</p>
    </details>
  );
}

function MiniGuide({ title, items }: { title: string; items: string[] }) {
  return <div><p className="text-[11px] font-semibold uppercase tracking-wide text-primary mb-1">{title}</p><ul className="space-y-1">{items.map(item => <li key={item} className="text-xs text-muted-foreground">• {item}</li>)}</ul></div>;
}

/**
 * Explicit, field-name/label aware pre-fill for the editable single-purpose
 * fields the generic `mapMatterToFormValues` helper deliberately skips
 * (e.g. Client Name, Subject Matter, Questions of Law on the Legal Opinion
 * tool). Returned values are seeds only — the fields stay fully editable.
 */
function buildExplicitMatterValues(
  matter: Matter,
  fields: Array<{ name: string; label: string; type: string }>,
): Record<string, string> {
  const result: Record<string, string> = {};
  const client = matter.clientName ?? "";
  const counterparty = matter.counterparty ?? "";
  const title = matter.title ?? "";
  const ref = matter.reference ?? "";

  for (const field of fields) {
    const name = field.name.toLowerCase();
    const label = field.label.toLowerCase();
    const key = `${name} ${label}`;

    // Client / party name fields
    if (/client.?name|\bclient\b/.test(key)) {
      if (client) result[field.name] = client;
      continue;
    }
    // Subject matter / topic / issue fields
    if (/subject|topic|\bissue\b|matter.?type|area.?of.?law/.test(key)) {
      // Seed with the matter title (the case's subject) plus reference context.
      const subject = [title, ref ? `(Ref: ${ref})` : ""].filter(Boolean).join(" ");
      if (subject) result[field.name] = subject;
      continue;
    }
    // Questions of law / issues to address fields
    if (/questions?.?of.?law|legal.?questions?|issues?.?to.?address|questions?.?to.?be/.test(key)) {
      const lines = [
        `Legal questions arising in ${title || "this matter"}`,
        client ? `for ${client}` : "",
        counterparty ? `against ${counterparty}` : "",
        ref ? `(Ref: ${ref})` : "",
      ].filter(Boolean).join(" ");
      if (lines) result[field.name] = `${lines}:\n1. `;
      continue;
    }
    // Opposing / counterparty fields
    if (/counterparty|opposing|defendant|respondent/.test(key)) {
      if (counterparty) result[field.name] = counterparty;
      continue;
    }
  }

  return result;
}

export default function ToolPage() {
  const [, params] = useRoute("/workspace/tool/:toolId");
  const toolId = params?.toolId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Parse matter context from query string (set by CaseHomePanel action href)
  const queryParams = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const qMatterId = queryParams.get("matter");
  const qClient = queryParams.get("client") ?? "";
  const qRef = queryParams.get("ref") ?? "";
  const qCounterparty = queryParams.get("counterparty") ?? "";
  const qMatterTitle = queryParams.get("title") ?? "";
  const defaultMatterId = qMatterId ? parseInt(qMatterId, 10) : undefined;

  // Synthetic Matter from query params for pre-filling form fields
  const matterFromQuery: import("@/hooks/use-matters").Matter | null =
    defaultMatterId
      ? {
          id: defaultMatterId,
          title: qMatterTitle || `Matter #${defaultMatterId}`,
          clientName: qClient || null,
          counterparty: qCounterparty || null,
          matterType: null,
          reference: qRef || null,
          status: "open",
          notes: null,
          createdAt: "",
          updatedAt: "",
        }
      : null;

  const { data: tools, isLoading: isToolsLoading } = useQuery({
    queryKey: ["ccb-tools"],
    queryFn: async () => {
      const res = await fetch("/api/ccb/tools/list", { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load tools");
      return res.json() as Promise<Array<{id:string;name:string;description:string;category:string;icon:string;fields:any[];example?:Record<string,string>;sampleNote?:string}>>;
    },
  });
  const tool = tools?.find(t => t.id === toolId);

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState("");
  const [outputComplete, setOutputComplete] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const endOfOutputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/access");
    }
  }, [setLocation]);

  // Initialize form fields, then pre-fill from query-string matter context
  useEffect(() => {
    if (!tool) return;
    const initialInputs: Record<string, string> = {};
    tool.fields.forEach(field => {
      initialInputs[field.name] = "";
    });
    // Overlay query-param matter context if present
    if (matterFromQuery) {
      // 1) Generic mapping (fills facts/background/parties/reference-style fields)
      const mapped = mapMatterToFormValues(matterFromQuery, tool.fields);
      Object.assign(initialInputs, mapped);
      // 2) Explicit field-name/label mapping so the editable text fields the
      //    generic helper skips (e.g. Client Name, Subject Matter, Questions of
      //    Law) are seeded too. Values remain fully editable — this only sets the
      //    initial state. Only apply to fields that actually exist for this tool
      //    and are still blank after the generic pass.
      const explicit = buildExplicitMatterValues(matterFromQuery, tool.fields);
      for (const [name, value] of Object.entries(explicit)) {
        if (!initialInputs[name] && value) {
          initialInputs[name] = value;
        }
      }
    }
    setInputs(initialInputs);
  // Only re-run when tool definition changes (not on every inputs change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool?.id]);

  // Auto-scroll when generating
  useEffect(() => {
    if (isGenerating && endOfOutputRef.current) {
      endOfOutputRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [output, isGenerating]);

  const handleInputChange = (name: string, value: string) => {
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      setOutputComplete(false);
      toast({
        title: "Generation stopped",
        description: "The AI generation was manually stopped."
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolId) return;

    // Validate required fields
    const missingFields = tool?.fields.filter(f => f.required && !inputs[f.name]);
    if (missingFields && missingFields.length > 0) {
      toast({
        title: "Missing fields",
        description: `Please fill in: ${missingFields.map(f => f.label).join(", ")}`,
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setOutput("");
    setOutputComplete(false);
    
    abortControllerRef.current = new AbortController();
    
    try {
      const token = getToken();
      const url = apiUrl("tools/generate");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          toolId,
          inputs
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        if (response.status === 429) emitRateLimit(0);
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const rl = readRateLimitRemaining(response);
      if (rl !== null) emitRateLimit(rl);

      await consumeCompletionStream(response, setOutput);
      setOutputComplete(true);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Generation aborted');
      } else {
        console.error("Generation error:", error);
        toast({
          title: "Generation failed",
          description: error.message || "An unexpected error occurred",
          variant: "destructive"
        });
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    toast({
      title: "Copied to clipboard",
      description: "The generated content has been copied."
    });
  };

  const handleReset = () => {
    setOutput("");
    setOutputComplete(false);
    const initialInputs: Record<string, string> = {};
    tool?.fields.forEach(field => {
      initialInputs[field.name] = "";
    });
    setInputs(initialInputs);
  };

  const handleMatterSelect = (matter: Matter) => {
    if (!tool) return;
    const mapped = mapMatterToFormValues(matter, tool.fields);
    setInputs(prev => ({ ...prev, ...mapped }));
  };

  // Track which matter is currently loaded (for defaulting SaveToMatterPanel)
  const [activeMatterId, setActiveMatterId] = useState<number | undefined>(defaultMatterId);

  const handleMatterSelectWithTrack = (matter: Matter) => {
    handleMatterSelect(matter);
    setActiveMatterId(matter.id);
  };

  const handleLoadSample = () => {
    if (!tool) return;
    const sample = (tool as unknown as { example?: Record<string, string> }).example;
    if (!sample || Object.keys(sample).length === 0) {
      toast({
        title: "No sample available",
        description: "This tool does not have a sample example yet."
      });
      return;
    }
    const filled: Record<string, string> = {};
    tool.fields.forEach(field => {
      filled[field.name] = sample[field.name] ?? "";
    });
    setInputs(filled);
    toast({
      title: "Sample loaded",
      description: "Form filled with example data. Edit as needed before generating."
    });
  };

  if (isToolsLoading) {
    return (
      <WorkspaceLayout>
        <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
            <Skeleton className="h-[400px] w-full rounded-xl" />
            <Skeleton className="h-[400px] w-full rounded-xl" />
          </div>
        </div>
      </WorkspaceLayout>
    );
  }

  if (!tool) {
    return (
      <WorkspaceLayout>
        <div className="p-10 text-center">
          <h2 className="text-2xl font-bold mb-4">Tool not found</h2>
          <Button onClick={() => setLocation("/workspace")}>Return to Workspace</Button>
        </div>
      </WorkspaceLayout>
    );
  }

  return (
    <WorkspaceLayout>
      <div
        className="p-6 md:p-10 max-w-7xl mx-auto flex flex-col h-[calc(100vh-64px)] md:h-full"
        data-testid="case-home-handoff-target"
        data-matter-id={activeMatterId ?? undefined}
      >
        <div className="mb-6 flex-shrink-0">
          <Link href="/workspace/tools">
            <Button variant="ghost" size="sm" className="mb-4 -ml-3 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tools
            </Button>
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground mb-2">{tool.name}</h1>
              <p className="text-muted-foreground text-lg max-w-3xl">{tool.description}</p>
            </div>
            <div className="hidden md:block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase border border-primary/20">
              {tool.category}
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
          {/* Input Form Column */}
          <div className="w-full md:w-5/12 flex flex-col min-h-0 bg-card rounded-xl border border-border overflow-hidden flex-shrink-0 shadow-sm">
            <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center gap-2">
              <h2 className="font-semibold flex items-center">
                <Sparkles className="w-4 h-4 mr-2 text-primary" />
                Provide Context
              </h2>
              {(tool as unknown as { example?: Record<string, string> }).example && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLoadSample}
                  disabled={isGenerating}
                  className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
                  data-testid="button-load-sample"
                >
                  <Wand2 className="w-3.5 h-3.5 mr-1.5" /> Load Sample
                </Button>
              )}
            </div>
            {(tool as unknown as { sampleNote?: string }).sampleNote && (
              <div className="px-4 py-2 bg-primary/5 border-b border-primary/10 text-xs text-muted-foreground italic">
                {(tool as unknown as { sampleNote: string }).sampleNote}
              </div>
            )}
            <div className="p-4 overflow-y-auto flex-1">
              <PracticeGuidePanel tool={tool} />
              <MatterPicker
                onSelect={handleMatterSelectWithTrack}
                defaultMatterId={defaultMatterId}
              />
              <form id="tool-form" onSubmit={handleSubmit} className="space-y-5">
                {tool.fields.map(field => (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name} className="font-medium text-foreground/90">
                      {field.label} {field.required && <span className="text-destructive">*</span>}
                    </Label>
                    
                    {field.type === 'textarea' ? (
                      <Textarea 
                        id={field.name}
                        placeholder={field.placeholder}
                        required={field.required}
                        value={inputs[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        className="min-h-[120px] resize-y bg-background/50 border-border/60 focus:border-primary/50 font-sans text-sm"
                        disabled={isGenerating}
                        data-testid={`input-${field.name}`}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        id={field.name}
                        required={field.required}
                        value={inputs[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isGenerating}
                        data-testid={`select-${field.name}`}
                      >
                        <option value="" disabled>Select an option</option>
                        {field.options?.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <Input 
                        id={field.name}
                        type="text"
                        placeholder={field.placeholder}
                        required={field.required}
                        value={inputs[field.name] || ''}
                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                        className="bg-background/50 border-border/60 focus:border-primary/50"
                        disabled={isGenerating}
                        data-testid={`input-${field.name}`}
                      />
                    )}
                  </div>
                ))}
              </form>
            </div>
            <div className="p-4 border-t border-border bg-muted/20">
              {isGenerating ? (
                <Button 
                  type="button" 
                  variant="destructive" 
                  className="w-full"
                  onClick={handleStop}
                  data-testid="button-stop-generation"
                >
                  <StopCircle className="w-4 h-4 mr-2" /> Stop Generation
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  form="tool-form" 
                  className="w-full font-medium"
                  data-testid="button-generate"
                >
                  <Sparkles className="w-4 h-4 mr-2" /> Generate Output
                </Button>
              )}
            </div>
          </div>

          {/* Output Column */}
          <div className="w-full md:w-7/12 flex flex-col min-h-0 bg-card rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center h-[57px]">
              <h2 className="font-semibold flex items-center">
                <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                Result
              </h2>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCopy} 
                  disabled={!output || isGenerating}
                  className="h-8 border-border/50 text-xs"
                  data-testid="button-copy"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleReset}
                  disabled={(!output && Object.values(inputs).every(v => !v)) || isGenerating}
                  className="h-8 border-border/50 text-xs"
                  data-testid="button-reset"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reset
                </Button>
                {outputComplete && (
                  <DraftExportButtons title={tool?.name || "Result"} content={output} className="items-center" />
                )}
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 relative bg-[url('/bg-pattern.svg')] bg-repeat">
              <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-0"></div>
              <div className="relative z-10">
                {!output && !isGenerating ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-60 mt-20">
                    <Sparkles className="w-16 h-16 mb-4 text-primary/30" />
                    <p>Fill out the form and click Generate</p>
                  </div>
                ) : (
                  <div className="min-h-full">
                    <DraftDocument content={output} />
                    {isGenerating && (
                      <div className="flex items-center space-x-2 mt-4 text-primary">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-medium animate-pulse">Generating...</span>
                      </div>
                    )}
                    {output && !isGenerating && !outputComplete && (
                      <p className="mt-4 text-sm text-destructive" role="alert">
                        This output is incomplete and cannot be saved or exported. Generate it again.
                      </p>
                    )}
                    {output && !isGenerating && outputComplete && (
                      <div className="mt-6">
                        <SaveToMatterPanel
                          key={`${tool.id}-${activeMatterId ?? 0}`}
                          draftTitle={tool.name}
                          draftContent={output}
                          kind="draft"
                          refPrefix="CCB"
                          defaultMatterId={activeMatterId}
                        />
                      </div>
                    )}
                    <div ref={endOfOutputRef} className="h-4" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </WorkspaceLayout>
  );
}
