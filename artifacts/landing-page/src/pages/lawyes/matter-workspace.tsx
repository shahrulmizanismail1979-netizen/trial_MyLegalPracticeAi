import { useState, useEffect, useRef } from "react";
import { useLawyesMatter, useLawyesInstruct, useLawyesSaveOutput } from "./api";
import { Loader2, FileText, MessageSquare, CheckSquare, Calendar, Save, Settings, AlertCircle, ArrowRight, CheckCircle2, Copy, BookOpen, PenLine } from "lucide-react";
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
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-2">Failed to load matter</h2>
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
    <div className="flex flex-col h-full overflow-hidden">
      <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
        <div>
          <h1 className="text-lg font-serif font-medium text-slate-900 dark:text-white flex items-center gap-3">
            {data.matter.title}
            <Badge variant="secondary" className="font-sans text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-none">
              {data.matter.status || "Active"}
            </Badge>
          </h1>
          {data.matter.reference && (
            <div className="text-xs text-slate-500 mt-0.5">Ref: {data.matter.reference}</div>
          )}
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left column: Matter Details */}
        <div className="w-full md:w-1/2 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 min-h-[40vh] md:min-h-0">
          <Tabs defaultValue="documents" className="flex flex-col h-full w-full">
            <div className="px-6 pt-4 shrink-0">
              <TabsList className="w-full justify-start h-10 bg-transparent border-b border-slate-200 dark:border-slate-800 rounded-none p-0 gap-6 overflow-x-auto flex-nowrap no-scrollbar">
                <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 whitespace-nowrap">
                  <FileText className="w-4 h-4 mr-2 shrink-0" /> Documents ({data.documents?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="conversations" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 whitespace-nowrap">
                  <MessageSquare className="w-4 h-4 mr-2 shrink-0" /> Discussions
                </TabsTrigger>
                <TabsTrigger value="tasks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 whitespace-nowrap">
                  <CheckSquare className="w-4 h-4 mr-2 shrink-0" /> Tasks
                </TabsTrigger>
                <TabsTrigger value="deadlines" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 whitespace-nowrap">
                  <Calendar className="w-4 h-4 mr-2 shrink-0" /> Deadlines
                </TabsTrigger>
                <TabsTrigger value="research" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 whitespace-nowrap">
                  <BookOpen className="w-4 h-4 mr-2 shrink-0" /> Research
                </TabsTrigger>
                <TabsTrigger value="drafts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 whitespace-nowrap">
                  <PenLine className="w-4 h-4 mr-2 shrink-0" /> Drafts
                </TabsTrigger>
                <TabsTrigger value="outputs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-2 whitespace-nowrap">
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
        <div className="w-full md:w-1/2 flex flex-col bg-white dark:bg-slate-900 relative">
          <InstructionComposer matterId={matterId} />
        </div>
      </div>
    </div>
  );
}

function ResourceList({ items, emptyText, icon: Icon }: { items: import("./api").ResourceItem[], emptyText: string, icon: any }) {
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500">
        <Icon className="w-8 h-8 mb-3 opacity-20" />
        <p className="text-sm">{emptyText}</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={item.id || i} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-start gap-4">
          <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-md shrink-0">
            <Icon className="w-4 h-4 text-slate-500" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-slate-900 dark:text-white">{item.title || item.name || item.item_text || "Untitled"}</h4>
            {item.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description}</p>}
            {item.date && <p className="text-xs text-slate-400 mt-2">{new Date(item.date).toLocaleDateString()}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function InstructionComposer({ matterId }: { matterId: string }) {
  const [instruction, setInstruction] = useState("");
  const saveIdempotencyKey = useRef(crypto.randomUUID());
  const { mutate: instruct, isPending, data: mutationResult, error: instructError, reset: resetInstruction } = useLawyesInstruct(matterId);
  const { mutate: saveOutput, isPending: isSaving } = useLawyesSaveOutput(matterId);
  const { toast } = useToast();

  useEffect(() => {
    const savedInstruction = localStorage.getItem(`lawyes_draft_text_${matterId}`);
    if (savedInstruction) {
      setInstruction(savedInstruction);
    }
  }, [matterId]);

  useEffect(() => {
    localStorage.setItem(`lawyes_draft_text_${matterId}`, instruction);
  }, [instruction, matterId]);

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
        title: `Output: ${instruction.substring(0, 30)}...`,
        kind: "lawyes-draft",
        content: result.content,
        instruction: instruction,
        citations: result.citations || [],
        verification: result.verification,
        idempotencyKey: saveIdempotencyKey.current
      },
      {
        onSuccess: () => {
          resetInstruction();
          setInstruction("");
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

  return (
    <div className="flex flex-col h-full">
      {/* Output Area */}
      <ScrollArea className="flex-1 bg-slate-50/50 dark:bg-slate-900">
        <div className="p-6">
          {!result && !isPending && (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
              <Settings className="w-12 h-12 mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">Matter Assistant</h3>
              <p className="text-sm max-w-sm">
                Instruct the assistant to draft documents, summarize evidence, or answer questions based on this matter's context.
              </p>
            </div>
          )}

          {isPending && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-slate-500 font-medium">Analyzing matter context and executing instruction...</p>
            </div>
          )}

          {instructError && !isPending && (
            <div className="p-6">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-300">Instruction Failed</h4>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{instructError.message}</p>
                </div>
              </div>
            </div>
          )}

          {result && !isPending && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-slate-900 dark:text-white">Execution Complete</span>
                  </div>
                  {result.verification && (
                    <Badge variant="outline" className={`text-xs uppercase tracking-wider bg-white dark:bg-slate-900 ${result.verification.verified ? "text-green-600 border-green-200" : ""}`}>
                      {result.verification.status}
                    </Badge>
                  )}
                </div>
                
                <div className="p-6 prose dark:prose-invert max-w-none text-sm">
                  {result.content.split('\n').map((para: string, i: number) => (
                    <p key={i} className={para.trim() ? "mb-4" : ""}>{para}</p>
                  ))}
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(result.content)}>
                    <Copy className="w-4 h-4 mr-2" /> Copy text
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save to Matter
                  </Button>
                </div>
              </div>

              {result.capabilities && result.capabilities.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">Applied Capabilities</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.capabilities.map((cap: string, i: number) => (
                      <Badge key={i} variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-normal">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {result.citations && result.citations.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">Cited Sources</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {result.citations.map((citation: import("./api").Citation, i: number) => (
                      <a 
                        key={i} 
                        href={citation.uri} 
                        target="_blank" 
                        rel="noreferrer noopener"
                        className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
                      >
                        <FileText className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{citation.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Composer Input */}
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <div className="relative">
          <Textarea 
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Instruct the assistant..."
            className="min-h-[100px] resize-none pr-12 text-sm bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-primary/20"
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
            className="absolute bottom-3 right-3 rounded-full w-8 h-8"
            disabled={!instruction.trim() || isPending}
            onClick={handleSubmit}
          >
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-3 uppercase tracking-wider font-medium">
          Confidential Matter-Bound Session
        </p>
      </div>
    </div>
  );
}
