import { useState, useEffect, useRef } from "react";
import { useLawyesMatter, useLawyesInstruct, useLawyesSaveOutput } from "./api";
import { Loader2, FileText, MessageSquare, CheckSquare, Calendar, Save, Settings, AlertCircle, ArrowRight, CheckCircle2, Copy, BookOpen, PenLine, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export function MatterWorkspace({ matterId }: { matterId: string }) {
  const { data, isLoading, error } = useLawyesMatter(matterId);
  
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-slate-900 mb-2">Failed to load matter</h2>
          <p className="text-slate-500 text-sm">
            {error?.message === "Unauthorized" 
              ? "Your session has expired. Please sign in again."
              : error?.message || "The matter could not be loaded. It may have been removed or you may lack permission."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <header className="h-16 flex items-center justify-between px-6 border-b shrink-0 bg-white z-10">
        <div>
          <h1 className="text-xl font-serif font-medium text-foreground flex items-center gap-3">
            {data.matter.title}
            <Badge variant="secondary" className="font-sans text-[10px] uppercase tracking-wider bg-primary/10 text-primary border-0 px-2 py-0.5">
              {data.matter.status || "Active"}
            </Badge>
          </h1>
          {data.matter.reference && (
            <div className="text-xs text-muted-foreground mt-0.5 font-medium">Ref: {data.matter.reference}</div>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left column: Matter Details */}
        <div className="w-full md:w-5/12 lg:w-1/2 flex flex-col border-b md:border-b-0 md:border-r border-border bg-slate-50/50 min-h-[40vh] md:min-h-0">
          <Tabs defaultValue="documents" className="flex flex-col h-full w-full">
            <div className="px-0 pt-0 shrink-0 border-b bg-white">
              <TabsList className="w-full justify-start h-12 bg-transparent rounded-none p-0 gap-6 overflow-x-auto flex-nowrap no-scrollbar px-6">
                <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary px-1 pb-3 pt-3 whitespace-nowrap text-slate-500 font-medium">
                  <FileText className="w-4 h-4 mr-2 shrink-0" /> Documents
                  <span className="ml-1.5 bg-slate-100 text-slate-600 py-0.5 px-1.5 rounded-full text-[10px] font-bold">{data.documents?.length || 0}</span>
                </TabsTrigger>
                <TabsTrigger value="conversations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary px-1 pb-3 pt-3 whitespace-nowrap text-slate-500 font-medium">
                  <MessageSquare className="w-4 h-4 mr-2 shrink-0" /> Discussions
                  <span className="ml-1.5 bg-slate-100 text-slate-600 py-0.5 px-1.5 rounded-full text-[10px] font-bold">{data.conversations?.length || 0}</span>
                </TabsTrigger>
                <TabsTrigger value="tasks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary px-1 pb-3 pt-3 whitespace-nowrap text-slate-500 font-medium">
                  <CheckSquare className="w-4 h-4 mr-2 shrink-0" /> Tasks
                </TabsTrigger>
                <TabsTrigger value="deadlines" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary px-1 pb-3 pt-3 whitespace-nowrap text-slate-500 font-medium">
                  <Calendar className="w-4 h-4 mr-2 shrink-0" /> Deadlines
                </TabsTrigger>
                <TabsTrigger value="research" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary px-1 pb-3 pt-3 whitespace-nowrap text-slate-500 font-medium">
                  <BookOpen className="w-4 h-4 mr-2 shrink-0" /> Research
                </TabsTrigger>
                <TabsTrigger value="drafts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary px-1 pb-3 pt-3 whitespace-nowrap text-slate-500 font-medium">
                  <PenLine className="w-4 h-4 mr-2 shrink-0" /> Drafts
                </TabsTrigger>
                <TabsTrigger value="outputs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary px-1 pb-3 pt-3 whitespace-nowrap text-slate-500 font-medium">
                  <Save className="w-4 h-4 mr-2 shrink-0" /> LAWYes
                </TabsTrigger>
              </TabsList>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-6">
                <TabsContent value="documents" className="mt-0">
                  <ResourceList items={data.documents} emptyText="No documents in this matter." icon={FileText} />
                </TabsContent>
                <TabsContent value="conversations" className="mt-0">
                  <ResourceList items={data.conversations} emptyText="No logged discussions." icon={MessageSquare} />
                </TabsContent>
                <TabsContent value="tasks" className="mt-0">
                  <ResourceList items={data.tasks} emptyText="No pending tasks." icon={CheckSquare} />
                </TabsContent>
                <TabsContent value="deadlines" className="mt-0">
                  <ResourceList items={data.deadlines} emptyText="No upcoming deadlines." icon={Calendar} />
                </TabsContent>
                <TabsContent value="research" className="mt-0">
                  <ResourceList items={data.research} emptyText="No source-bearing research saved to this matter." icon={BookOpen} />
                </TabsContent>
                <TabsContent value="drafts" className="mt-0">
                  <ResourceList items={data.drafts} emptyText="No saved drafts in this matter." icon={PenLine} />
                </TabsContent>
                <TabsContent value="outputs" className="mt-0">
                  <ResourceList items={data.outputs} emptyText="No saved LAWYes outputs." icon={Save} />
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Right column: Composer & Output */}
        <div className="w-full md:w-7/12 lg:w-1/2 flex flex-col bg-white relative border-l border-border">
          <InstructionComposer matterId={matterId} />
        </div>
      </div>
    </div>
  );
}

function ResourceList({ items, emptyText, icon: Icon }: { items: import("./api").ResourceItem[], emptyText: string, icon: any }) {
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
          <Icon className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-sm">{emptyText}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={item.id || i} className="p-4 bg-white border border-border hover:border-slate-300 transition-colors rounded-lg flex items-start gap-4 group shadow-sm">
          <div className="p-2 bg-slate-50 group-hover:bg-primary/5 rounded-md shrink-0 transition-colors">
            <Icon className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-foreground truncate">{item.title || item.name || item.item_text || "Untitled"}</h4>
            {item.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{item.description}</p>}
            {(item.date || item.createdAt) && (
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-wider">
                {new Date(item.date || item.createdAt!).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function WorkbenchPreview({ content }: { content: string }) {
  if (!content) {
    return <p className="text-slate-400 italic">No content.</p>;
  }

  return (
    <div className="space-y-3">
      {content.split("\n").map((line, index) => {
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
          const level = heading[1].length;
          const className = level === 1
            ? "text-2xl font-serif font-semibold text-foreground pt-2"
            : level === 2
              ? "text-xl font-serif font-semibold text-foreground pt-2"
              : "text-base font-semibold text-foreground pt-1";
          return <div key={index} className={className}>{heading[2]}</div>;
        }

        const bullet = line.match(/^\s*[-*]\s+(.+)$/);
        if (bullet) {
          return (
            <div key={index} className="flex gap-3 pl-2">
              <span className="text-primary" aria-hidden="true">•</span>
              <span>{bullet[1]}</span>
            </div>
          );
        }

        return line.trim()
          ? <p key={index} className="whitespace-pre-wrap">{line}</p>
          : <div key={index} className="h-2" aria-hidden="true" />;
      })}
    </div>
  );
}

function InstructionComposer({ matterId }: { matterId: string }) {
  const [instruction, setInstruction] = useState("");
  const saveIdempotencyKey = useRef(crypto.randomUUID());
  const { mutate: instruct, isPending, data: mutationResult, error: instructError, reset: resetInstruction } = useLawyesInstruct(matterId);
  const { mutate: saveOutput, isPending: isSaving } = useLawyesSaveOutput(matterId);
  const { toast } = useToast();

  const [workbenchContent, setWorkbenchContent] = useState("");
  const [workbenchTitle, setWorkbenchTitle] = useState("");
  const [viewMode, setViewMode] = useState<"edit" | "preview">("preview");

  useEffect(() => {
    const savedInstruction = localStorage.getItem(`lawyes_draft_text_${matterId}`);
    if (savedInstruction) {
      setInstruction(savedInstruction);
    }
  }, [matterId]);

  useEffect(() => {
    localStorage.setItem(`lawyes_draft_text_${matterId}`, instruction);
  }, [instruction, matterId]);

  const lastResultRef = useRef(mutationResult);
  useEffect(() => {
    if (mutationResult && mutationResult !== lastResultRef.current) {
      lastResultRef.current = mutationResult;
      setWorkbenchContent(mutationResult.content);
      const excerpt = instruction.substring(0, 30).trim();
      setWorkbenchTitle(`Output: ${excerpt}${excerpt.length === 30 ? '...' : ''}`);
      setViewMode("preview");
    }
  }, [mutationResult, instruction]);

  const result = isPending ? null : mutationResult;

  const handleSubmit = () => {
    if (!instruction.trim()) return;
    saveIdempotencyKey.current = crypto.randomUUID();
    instruct({ instruction: instruction.trim() });
  };

  const handleSave = () => {
    if (!result) return;
    saveOutput(
      {
        title: workbenchTitle || "Untitled Output",
        kind: "lawyes-draft",
        content: workbenchContent,
        instruction: instruction,
        citations: result.citations || [],
        verification: result.verification,
        idempotencyKey: saveIdempotencyKey.current
      },
      {
        onSuccess: () => {
          resetInstruction();
          setInstruction("");
          setWorkbenchContent("");
          setWorkbenchTitle("");
          localStorage.removeItem(`lawyes_draft_text_${matterId}`);
          toast({
            title: "Saved to Matter",
            description: "The output has been successfully saved to the matter's records.",
          });
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Save Failed",
            description: "Could not save the output to the matter.",
          });
        }
      }
    );
  };

  const handleDownload = () => {
    const blob = new Blob([workbenchContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(workbenchTitle || "document").replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(workbenchContent);
    toast({ title: "Copied to clipboard" });
  };

  const handleReset = () => {
    if (result) {
      setWorkbenchContent(result.content);
      toast({ title: "Reset to original generation" });
    }
  };

  return (
    <div className="flex flex-col h-full relative bg-slate-50/30">
      {/* Output Area */}
      <ScrollArea className="flex-1">
        <div className="p-6 lg:p-8">
          {!result && !isPending && (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 h-[50vh]">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-border">
                <Settings className="w-7 h-7 text-primary/40" />
              </div>
              <h3 className="text-xl font-serif font-medium text-foreground mb-3">Matter Assistant</h3>
              <p className="text-[15px] max-w-sm leading-relaxed">
                Instruct the assistant to draft documents, summarize evidence, or answer questions based on this matter's context.
              </p>
            </div>
          )}

          {isPending && (
            <div className="flex flex-col items-center justify-center py-24 text-center h-[50vh]">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
                <Loader2 className="w-10 h-10 animate-spin text-primary relative z-10" />
              </div>
              <p className="text-sm text-primary mt-6 font-bold tracking-wide uppercase">Analyzing context & drafting...</p>
            </div>
          )}

          {instructError && !isPending && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 shadow-sm">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-red-800">Instruction Failed</h4>
                <p className="text-sm text-red-600 mt-1">{instructError.message}</p>
              </div>
            </div>
          )}

          {result && !isPending && (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-5">
                <div className="flex-1 mr-4">
                  <input
                    value={workbenchTitle}
                    onChange={(e) => setWorkbenchTitle(e.target.value)}
                    placeholder="Document Title"
                    className="w-full text-2xl font-serif font-medium text-foreground bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary outline-none focus:ring-0 px-1 py-1 transition-colors"
                    data-testid="workbench-title"
                  />
                </div>
                <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-lg shrink-0">
                  <button
                    onClick={() => setViewMode("preview")}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${viewMode === "preview" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"}`}
                    data-testid="workbench-action-preview"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => setViewMode("edit")}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${viewMode === "edit" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"}`}
                    data-testid="workbench-action-edit"
                  >
                    Edit
                  </button>
                </div>
              </div>

              <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden flex flex-col mb-8">
                {/* Editor or Preview */}
                <div className="p-0 flex-1 relative min-h-[350px]">
                  {viewMode === "edit" ? (
                    <Textarea
                      value={workbenchContent}
                      onChange={(e) => setWorkbenchContent(e.target.value)}
                      className="w-full h-full min-h-[350px] resize-y p-6 lg:p-8 border-0 focus-visible:ring-0 rounded-none text-[15px] font-sans leading-relaxed text-foreground bg-slate-50/30"
                      data-testid="workbench-content-editor"
                      placeholder="Enter content..."
                    />
                  ) : (
                    <div className="p-6 lg:p-8 prose prose-slate max-w-none text-[15px] leading-relaxed">
                      <WorkbenchPreview content={workbenchContent} />
                    </div>
                  )}
                </div>

                {/* Toolbar */}
                <div className="p-3 bg-slate-50 border-t border-border flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset} data-testid="workbench-action-reset" className="h-8 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-900 border-slate-200">
                      Reset
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleCopy} data-testid="workbench-action-copy" className="h-8 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-900 border-slate-200">
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownload} data-testid="workbench-action-download" className="h-8 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-900 border-slate-200">
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Download MD
                    </Button>
                  </div>
                  <Button size="sm" onClick={handleSave} disabled={isSaving} data-testid="workbench-action-save" className="h-8 text-xs font-medium bg-primary hover:bg-primary/90 text-white shadow-sm px-4">
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                    Save to Matter
                  </Button>
                </div>
              </div>

              {/* Citations and Capabilities */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-4">
                {result.citations && result.citations.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Grounded Citations</h4>
                    </div>
                    <div className="flex flex-col gap-2">
                      {result.citations.map((citation: import("./api").Citation, i: number) => (
                        <a
                          key={i}
                          href={citation.uri}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="px-3.5 py-3 bg-white border border-border rounded-lg text-xs text-slate-700 hover:text-primary hover:border-primary/40 transition-all shadow-sm flex items-start gap-2.5 group"
                        >
                          <FileText className="w-4 h-4 text-primary/40 group-hover:text-primary shrink-0 mt-0.5 transition-colors" />
                          <span className="leading-relaxed font-medium">{citation.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  {result.verification && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <CheckCircle2 className={`w-4 h-4 ${result.verification.verified ? "text-primary" : "text-amber-500"}`} />
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Verification</h4>
                      </div>
                      <div className={`p-4 rounded-lg text-xs border shadow-sm ${result.verification.verified ? "bg-primary/5 border-primary/20 text-slate-800" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
                        <span className={`font-bold block mb-1.5 text-sm ${result.verification.verified ? "text-primary" : "text-amber-700"}`}>{result.verification.status}</span>
                        {result.verification.guidance && <span className="opacity-90 block mt-1 leading-relaxed text-[13px]">{result.verification.guidance}</span>}
                        <span className="block mt-3 text-[10px] opacity-60 font-medium uppercase tracking-wider">Verification applies only to original AI text. Edited text is unverified.</span>
                      </div>
                    </div>
                  )}

                  {result.capabilities && result.capabilities.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Settings className="w-4 h-4 text-slate-400" />
                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Applied Skills</h4>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {result.capabilities.map((cap: string, i: number) => (
                          <Badge key={i} variant="secondary" className="bg-white border border-border text-slate-600 font-medium text-[11px] px-2.5 py-1 shadow-sm">
                            {cap}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Composer Input */}
      <div className="p-4 lg:p-5 bg-white border-t border-border shrink-0 z-10 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="relative rounded-xl border border-border bg-slate-50/50 focus-within:bg-white focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <Textarea 
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Instruct the assistant..."
            className="min-h-[100px] resize-none pr-14 text-[15px] bg-transparent border-0 focus-visible:ring-0 py-4 px-5 leading-relaxed shadow-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            disabled={isPending}
          />
          <Button 
            size="icon" 
            className="absolute bottom-3 right-3 rounded-lg w-9 h-9 bg-primary hover:bg-primary/90 text-white shadow-sm transition-all"
            disabled={!instruction.trim() || isPending}
            onClick={handleSubmit}
          >
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between mt-3 px-1">
          <p className="text-[10px] text-primary/60 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
            Confidential Matter-Bound Session
          </p>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-sans text-slate-500">Enter</kbd> to send
          </div>
        </div>
      </div>
    </div>
  );
}
