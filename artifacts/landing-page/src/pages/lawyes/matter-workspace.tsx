import { useState, useEffect, useRef } from "react";
import {
  useConfirmLawyesEvidence,
  useDisconnectLawyesGoogle,
  useLawyesDriveConfirm,
  useLawyesDrivePreview,
  useLawyesGmailImport,
  useLawyesGmailSearch,
  useLawyesGoogleConnection,
  useLawyesInstruct,
  useLawyesMatter,
  useLawyesSaveOutput,
  uploadLawyesEvidence,
} from "./api";
import type { ResourceItem, WorkspaceAggregate } from "./api";
import { Loader2, FileText, Settings, AlertCircle, ArrowRight, CheckCircle2, Copy, BookOpen, Download, Eye, PanelRight, Sparkles, Plus, Mail, HardDrive, Globe, Users, Save, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export function MatterWorkspace({ matterId, onShareClick }: { matterId: string, onShareClick: () => void }) {
  const { data, isLoading, error } = useLawyesMatter(matterId);
  const [railOpen, setRailOpen] = useState(false);
  
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center bg-white">
        <div className="max-w-md">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-red-100">
             <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-serif font-medium text-slate-900 mb-2">Failed to load matter</h2>
          <p className="text-slate-500 text-[15px] leading-relaxed">
            {error?.message === "Unauthorized" 
              ? "Your session has expired. Please sign in again."
              : error?.message || "The matter could not be loaded. It may have been removed or you may lack permission."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white relative">
      <header className="h-14 md:h-16 flex items-center justify-between px-4 md:px-6 border-b border-slate-200 shrink-0 bg-white z-20 shadow-sm">
        <div className="flex-1 min-w-0 mr-4">
          <h1 className="text-lg md:text-xl font-serif font-medium text-slate-900 flex items-center gap-3 truncate">
            <span className="truncate">{data.matter.title}</span>
            <Badge variant="secondary" className="font-sans text-[10px] uppercase tracking-wider bg-primary/10 text-primary border-0 px-2 py-0.5 shrink-0">
              {data.matter.status || "Active"}
            </Badge>
          </h1>
          {data.matter.reference && (
            <div className="text-[11px] text-slate-500 mt-0.5 font-medium truncate">Ref: {data.matter.reference}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!data.permissions.canWrite && (
            <div className="hidden md:flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 border border-amber-200" role="status" data-testid="status-read-only">
              <Eye className="h-3.5 w-3.5" /> Read-only
            </div>
          )}
          {data.permissions.role === "owner" && (
            <Button variant="outline" size="sm" onClick={onShareClick} className="h-8 text-xs font-medium border-slate-200 text-slate-700 hover:text-primary hover:border-primary/30" data-testid="button-matter-share">
              <Users className="w-3.5 h-3.5 mr-1.5 text-primary" /> Share
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden w-8 h-8 text-slate-500"
            onClick={() => setRailOpen(!railOpen)}
            aria-label={railOpen ? "Close matter context" : "Open matter context"}
            data-testid="button-toggle-matter-context"
          >
             <PanelRight className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Center: Composer & Output */}
        <div className="flex-1 flex flex-col bg-slate-50/30 relative min-w-0">
          <InstructionComposer matterId={matterId} canWrite={data.permissions.canWrite} />
        </div>

        {railOpen && (
          <button
            type="button"
            className="absolute inset-0 z-20 bg-slate-950/10 backdrop-blur-[1px] lg:hidden"
            onClick={() => setRailOpen(false)}
            aria-label="Close matter context"
            data-testid="button-close-matter-context-backdrop"
          />
        )}

        {/* Right Rail */}
        <div className={`
          absolute inset-y-0 right-0 z-30 w-[min(22rem,calc(100vw-1rem))] bg-slate-50/50 border-l border-slate-200 flex flex-col transition-transform duration-300 transform
          lg:relative lg:w-80 lg:transform-none lg:flex
          ${railOpen ? 'translate-x-0 shadow-[-10px_0_20px_rgba(0,0,0,0.1)] lg:shadow-none' : 'translate-x-full lg:translate-x-0'}
        `}>
          <ContextualRail data={data} matterId={matterId} onClose={() => setRailOpen(false)} />
        </div>
      </div>
    </div>
  );
}

function ContextualRail({ data, matterId, onClose }: { data: WorkspaceAggregate; matterId: string; onClose: () => void }) {
  return (
    <div className="flex flex-col h-full">
       <div className="h-10 flex items-center justify-between px-4 md:px-5 border-b border-slate-200 shrink-0 bg-white">
         <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-primary" /> Matter Context
         </h2>
          <button
            type="button"
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            onClick={onClose}
            aria-label="Close matter context"
            data-testid="button-close-matter-context"
          >
            <X className="h-4 w-4" />
          </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <RailSection title="Progress">
            <ResourceRailList items={[...(data.tasks || []), ...(data.checklists || [])]} empty="No active progress items." matterId={matterId} />
          </RailSection>

          <RailSection title="Outputs">
            <ResourceRailList items={[...(data.outputs || []), ...(data.drafts || [])]} empty="No saved outputs." matterId={matterId} />
          </RailSection>

           <RailSection title="Sources" action={data.permissions.canWrite ? <SourceUploadAction matterId={matterId} /> : undefined}>
             <GoogleConnectionStatus canUseConnectors={data.permissions.canUseConnectors} />
            <ResourceRailList
              items={[...(data.documents || []), ...(data.uploads || []), ...(data.research || [])]}
              empty="No sources added."
              matterId={matterId}
              canConfirmEvidence={data.permissions.canWrite}
            />
          </RailSection>

          {data.permissions.canUseConnectors && (
            <RailSection title="Email & Drive">
              <GoogleMatterTools matterId={matterId} outputs={data.outputs || []} />
            </RailSection>
          )}

          <RailSection title="Scheduled">
            <ResourceRailList items={[...(data.deadlines || []), ...(data.events || [])]} empty="No upcoming dates." matterId={matterId} />
          </RailSection>
        </div>
      </ScrollArea>
    </div>
  );
}

function RailSection({ title, action, children }: { title: string, action?: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between px-2 py-1.5 mb-1 group">
         <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {title}
         </div>
         {action && <div>{action}</div>}
      </div>
      <div>
        {children}
      </div>
    </div>
  )
}

function ResourceRailList({
  items,
  empty,
  matterId,
  canConfirmEvidence = false,
}: {
  items: ResourceItem[];
  empty: string;
  matterId?: string;
  canConfirmEvidence?: boolean;
}) {
  if (!items || items.length === 0) {
     return <div className="px-2 py-1 text-[11px] text-slate-400">{empty}</div>
  }
  return (
    <div className="space-y-0.5">
       {items.map((item, i) => (
          <div key={item.id || i} className="flex flex-col px-2 py-1.5 rounded-lg transition-colors" data-testid={`context-item-${item.id || i}`}>
             <div className="flex items-start gap-2">
               <FileText className="w-3.5 h-3.5 text-primary/60 shrink-0 mt-0.5" />
               <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-slate-700 line-clamp-2 break-words leading-relaxed font-medium">{item.title || item.name || item.item_text || "Untitled"}</p>
               </div>
             </div>
             {item.extractionMetadata && matterId && (
               <div className="pl-5 mt-1.5">
                 {item.evidenceVerified ? (
                    <span className="inline-block px-1.5 py-0.5 rounded-[4px] bg-primary/10 text-[9px] text-primary font-bold uppercase tracking-wider">Verified</span>
                 ) : (
                    <RailEvidenceStatus item={item} matterId={matterId} canConfirm={canConfirmEvidence} />
                 )}
               </div>
             )}
          </div>
       ))}
    </div>
  )
}

function RailEvidenceStatus({
  item,
  matterId,
  canConfirm,
}: {
  item: ResourceItem;
  matterId: string;
  canConfirm: boolean;
}) {
  const confirm = useConfirmLawyesEvidence(matterId);
  return (
    <div className="flex items-center gap-2">
       <span className="inline-block px-1.5 py-0.5 rounded-[4px] bg-amber-100/50 text-[9px] text-amber-700 font-bold uppercase tracking-wider border border-amber-200/50">Unverified</span>
       {canConfirm && (
         <button
           type="button"
           onClick={() => confirm.mutate(item.id)}
           disabled={confirm.isPending}
           className="text-[9px] text-slate-500 hover:text-primary font-semibold underline underline-offset-2 disabled:opacity-50"
           data-testid={`button-confirm-evidence-${item.id}`}
         >
           Verify
         </button>
       )}
    </div>
  )
}

function GoogleConnectionStatus({ canUseConnectors }: { canUseConnectors: boolean }) {
  const google = useLawyesGoogleConnection();
  const disconnect = useDisconnectLawyesGoogle();

  if (!canUseConnectors || google.isLoading || !google.data?.configured) return null;

  if (!google.data.connected) {
    return (
      <div className="mb-2">
         <a href="/api/lit/lawyes/google/connect" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-200/50 text-[13px] text-slate-600 hover:text-primary font-medium transition-colors" data-testid="link-connect-lawyes-google">
           <Globe className="w-3.5 h-3.5 shrink-0 text-slate-400" />
           <span>Connect Google</span>
         </a>
      </div>
    );
  }
  
  return (
    <div className="mb-2 space-y-0.5">
      <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-200/50 group transition-colors">
         <div className="flex items-center gap-2 text-[13px] font-medium text-slate-700 truncate">
            <Mail className="w-3.5 h-3.5 shrink-0 text-red-500" />
            <span className="truncate">Gmail ({google.data.account?.email})</span>
         </div>
         <button
           type="button"
           onClick={() => { if (window.confirm("Disconnect this Google account?")) disconnect.mutate(); }}
           className="text-[9px] text-slate-400 opacity-0 transition-opacity hover:text-red-500 focus:opacity-100 group-hover:opacity-100 uppercase tracking-wider font-bold"
           data-testid="button-disconnect-lawyes-google"
         >
           Unlink
         </button>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-200/50 group transition-colors">
         <div className="flex items-center gap-2 text-[13px] font-medium text-slate-700 truncate">
            <HardDrive className="w-3.5 h-3.5 shrink-0 text-blue-500" />
            <span className="truncate">Drive files</span>
         </div>
      </div>
    </div>
  )
}

function GoogleMatterTools({
  matterId,
  outputs,
}: {
  matterId: string;
  outputs: ResourceItem[];
}) {
  const google = useLawyesGoogleConnection();
  const gmailSearch = useLawyesGmailSearch(matterId);
  const gmailImport = useLawyesGmailImport(matterId);
  const drivePreview = useLawyesDrivePreview(matterId);
  const driveConfirm = useLawyesDriveConfirm(matterId);
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [messageIds, setMessageIds] = useState<string[]>([]);
  const [outputIds, setOutputIds] = useState<number[]>([]);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  if (!google.data?.connected) {
    return <p className="px-2 py-1 text-[11px] text-slate-400">Connect Google above to import Gmail messages or export approved work.</p>;
  }

  const toggle = <T extends string | number>(items: T[], item: T, checked: boolean) =>
    checked ? [...items, item] : items.filter((value) => value !== item);

  return (
    <div className="space-y-3 px-2">
      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-800">
          <Mail className="h-3.5 w-3.5 text-primary" /> Import from Gmail
        </div>
        <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
          Search only {google.data.account?.email}. Nothing is added until you select and import it.
        </p>
        <form
          className="flex gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            setMessageIds([]);
            gmailSearch.mutate({ q: query });
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Gmail"
            className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs"
            maxLength={500}
          />
          <Button type="submit" size="sm" className="h-8 w-8 p-0" disabled={gmailSearch.isPending} aria-label="Search Gmail">
            {gmailSearch.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
        </form>
        {gmailSearch.error && <p className="mt-2 text-[11px] text-red-600">{gmailSearch.error.message}</p>}
        {gmailSearch.data && (
          <div className="mt-3 space-y-1.5">
            {gmailSearch.data.messages.length === 0 && <p className="text-[11px] text-slate-500">No messages found.</p>}
            {gmailSearch.data.messages.map((message) => (
              <label key={message.id} className="flex cursor-pointer gap-2 rounded-md border border-slate-200 p-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={messageIds.includes(message.id)}
                  disabled={message.imported}
                  onChange={(event) => setMessageIds(toggle(messageIds, message.id, event.target.checked))}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-slate-800">{message.subject}</span>
                  <span className="block truncate text-slate-500">{message.from}</span>
                  <span className="mt-0.5 block line-clamp-2 text-slate-600">{message.snippet}</span>
                  {message.imported && <span className="mt-1 block font-semibold text-primary">Already imported</span>}
                </span>
              </label>
            ))}
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={!messageIds.length || gmailImport.isPending}
              onClick={() => gmailImport.mutate(
                { messageIds },
                {
                  onSuccess: (result) => {
                    setMessageIds([]);
                    gmailSearch.mutate({ q: query });
                    toast({ title: `${result.createdCount} message${result.createdCount === 1 ? "" : "s"} imported` });
                  },
                },
              )}
            >
              {gmailImport.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Import selected ({messageIds.length})
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-800">
          <HardDrive className="h-3.5 w-3.5 text-primary" /> Export approved work
        </div>
        <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
          Select outputs, then review the account, destination, and filenames before confirming.
        </p>
        <div className="space-y-1.5">
          {outputs.length === 0 && <p className="text-[11px] text-slate-500">Save a LAWYes output before exporting.</p>}
          {outputs.map((output) => {
            const id = Number(output.id);
            return (
              <label key={output.id} className="flex gap-2 rounded-md border border-slate-200 p-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={outputIds.includes(id)}
                  onChange={(event) => {
                    setOutputIds(toggle(outputIds, id, event.target.checked));
                    drivePreview.reset();
                    setReviewConfirmed(false);
                  }}
                />
                <span className="line-clamp-2">{output.title || "Untitled output"}</span>
              </label>
            );
          })}
        </div>
        {!drivePreview.data ? (
          <Button
            className="mt-2 h-8 text-xs"
            size="sm"
            disabled={!outputIds.length || drivePreview.isPending}
            onClick={() => drivePreview.mutate({ outputIds })}
          >
            {drivePreview.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Review destination
          </Button>
        ) : (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-950">
            <p className="font-semibold">Review required</p>
            <p className="mt-1.5 break-all">Account: {drivePreview.data.destination.account}</p>
            <p>Destination: {drivePreview.data.destination.folderName}</p>
            <ul className="my-1.5 list-disc pl-4">
              {drivePreview.data.files.map((file) => <li key={file.outputId}>{file.name}</li>)}
            </ul>
            <label className="flex items-start gap-2 font-medium">
              <input
                type="checkbox"
                checked={reviewConfirmed}
                onChange={(event) => setReviewConfirmed(event.target.checked)}
              />
              I reviewed this exact account, destination, and file list.
            </label>
            <Button
              className="mt-2 h-8 text-xs"
              size="sm"
              disabled={!reviewConfirmed || driveConfirm.isPending}
              onClick={() => driveConfirm.mutate(
                { confirmationToken: drivePreview.data!.confirmationToken, confirmed: true },
                {
                  onSuccess: (result) => {
                    toast({ title: `${result.files.length} file${result.files.length === 1 ? "" : "s"} exported to Drive` });
                    setOutputIds([]);
                    setReviewConfirmed(false);
                    drivePreview.reset();
                  },
                },
              )}
            >
              {driveConfirm.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {driveConfirm.isPending ? "Exporting…" : driveConfirm.error ? "Retry confirmed export" : "Confirm export"}
            </Button>
            {driveConfirm.error && (
              <p className="mt-2 font-medium">
                Retry this reviewed export by confirming again. Completed files will not be recreated.
              </p>
            )}
          </div>
        )}
        {(drivePreview.error || driveConfirm.error) && (
          <p className="mt-2 text-[11px] text-red-600">{drivePreview.error?.message || driveConfirm.error?.message}</p>
        )}
      </section>
    </div>
  );
}
function SourceUploadAction({ matterId }: { matterId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const { refetch } = useLawyesMatter(matterId);
  const onFile = async (file?: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      await uploadLawyesEvidence(matterId, file);
      await refetch();
      toast({ title: "Evidence analysed", description: "Source uploaded and text extracted." });
    } catch (error) {
      toast({ variant: "destructive", title: "Upload failed", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return (
    <>
       <input ref={inputRef} className="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/tiff,audio/*,video/*" onChange={(event) => void onFile(event.target.files?.[0])} data-testid="input-matter-evidence-source" />
       <button type="button" onClick={() => inputRef.current?.click()} disabled={isUploading} className="p-1 hover:bg-slate-200/80 rounded-md text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50" aria-label="Add evidence source" title="Add evidence source" data-testid="button-add-evidence-source">
          {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
       </button>
    </>
  )
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
            ? "text-2xl font-serif font-semibold text-slate-900 pt-2"
            : level === 2
              ? "text-xl font-serif font-semibold text-slate-900 pt-2"
              : "text-base font-semibold text-slate-900 pt-1";
          return <div key={index} className={className}>{heading[2]}</div>;
        }

        const bullet = line.match(/^\s*[-*]\s+(.+)$/);
        if (bullet) {
          return (
            <div key={index} className="flex gap-3 pl-2">
              <span className="text-primary mt-1" aria-hidden="true">•</span>
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

function InstructionComposer({ matterId, canWrite }: { matterId: string; canWrite: boolean }) {
  const [instruction, setInstruction] = useState("");
  const saveIdempotencyKey = useRef(crypto.randomUUID());
  const { mutate: instruct, isPending, data: mutationResult, error: instructError, reset: resetInstruction } = useLawyesInstruct(matterId);
  const { mutate: saveOutput, isPending: isSaving } = useLawyesSaveOutput(matterId);
  const { toast } = useToast();

  const [workbenchContent, setWorkbenchContent] = useState("");
  const [workbenchTitle, setWorkbenchTitle] = useState("");
  const [viewMode, setViewMode] = useState<"edit" | "preview">("preview");
  const [researchMode, setResearchMode] = useState<"verified_library" | "web">("verified_library");
  const capabilityLabel: Record<string, string> = {
    verified_internal_legal_research: "Verified Malaysian legal research",
    explicit_web_legal_research: "Public web research — verification required",
    matter_aware_review_or_drafting: "Matter-aware review and drafting",
  };

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
    instruct({ instruction: instruction.trim(), researchMode });
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
    <div className="flex flex-col h-full relative">
      {/* Output Area */}
      <ScrollArea className="flex-1">
        <div className="p-6 lg:p-10 max-w-4xl mx-auto w-full">
          {!result && !isPending && (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 min-h-[50vh]">
              <div className="w-14 h-14 bg-primary/5 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-primary/10">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-serif font-medium text-slate-800 mb-3">Matter Assistant</h3>
              <p className="text-[15px] max-w-sm leading-relaxed text-slate-500">
                Instruct the assistant to draft documents, summarize evidence, or answer questions based on this matter's context.
              </p>
            </div>
          )}

          {isPending && (
            <div className="flex flex-col items-center justify-center py-24 text-center min-h-[50vh]">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
                <Loader2 className="w-10 h-10 animate-spin text-primary relative z-10" />
              </div>
              <p className="text-xs text-primary mt-6 font-bold tracking-widest uppercase">Analyzing context & drafting...</p>
            </div>
          )}

          {instructError && !isPending && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 shadow-sm">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-red-800">Instruction Failed</h4>
                <p className="text-sm text-red-600 mt-1">{instructError.message}</p>
              </div>
            </div>
          )}

          {result && !isPending && (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-6">
                <div className="flex-1 mr-4">
                  <input
                    value={workbenchTitle}
                    onChange={(e) => setWorkbenchTitle(e.target.value)}
                    placeholder="Document Title"
                    className="w-full text-2xl md:text-3xl font-serif font-medium text-slate-900 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-primary outline-none focus:ring-0 px-1 py-1 transition-colors"
                    data-testid="workbench-title"
                     readOnly={!canWrite}
                  />
                </div>
                <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl shrink-0">
                  <button
                    onClick={() => setViewMode("preview")}
                    className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${viewMode === "preview" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"}`}
                    data-testid="workbench-action-preview"
                  >
                    Preview
                  </button>
                  {canWrite && (
                    <button
                      onClick={() => setViewMode("edit")}
                      className={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${viewMode === "edit" ? "bg-white shadow-sm text-primary" : "text-slate-500 hover:text-slate-700"}`}
                      data-testid="workbench-action-edit"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col mb-8">
                {/* Editor or Preview */}
                <div className="p-0 flex-1 relative min-h-[400px]">
                  {viewMode === "edit" ? (
                    <Textarea
                      value={workbenchContent}
                      onChange={(e) => setWorkbenchContent(e.target.value)}
                      className="w-full h-full min-h-[400px] resize-y p-6 lg:p-8 border-0 focus-visible:ring-0 rounded-none text-[15px] font-sans leading-relaxed text-slate-800 bg-slate-50/30"
                      data-testid="workbench-content-editor"
                      placeholder="Enter content..."
                    />
                  ) : (
                    <div className="p-6 lg:p-10 prose prose-slate max-w-none text-[15px] leading-relaxed">
                      <WorkbenchPreview content={workbenchContent} />
                    </div>
                  )}
                </div>

                {/* Toolbar */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {canWrite && (
                      <Button variant="outline" size="sm" onClick={handleReset} data-testid="workbench-action-reset" className="h-8 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-900 border-slate-200">
                        Reset
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleCopy} data-testid="workbench-action-copy" className="h-8 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-900 border-slate-200">
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDownload} data-testid="workbench-action-download" className="h-8 text-xs font-medium text-slate-600 bg-white hover:bg-slate-100 hover:text-slate-900 border-slate-200">
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Download MD
                    </Button>
                  </div>
                  {canWrite && (
                    <Button size="sm" onClick={handleSave} disabled={isSaving} data-testid="workbench-action-save" className="h-8 text-xs font-medium bg-primary hover:bg-primary/90 text-white shadow-sm px-5 rounded-lg">
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                      Save to Matter
                    </Button>
                  )}
                </div>
              </div>

              {/* Citations and Capabilities */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-6">
                {result.citations && result.citations.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-4 h-4 text-primary" />
                       <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                         {result.researchMode === "verified_library" ? "Verified Malaysian Authorities" : "Web Sources — Verify Before Use"}
                       </h4>
                    </div>
                    <div className="flex flex-col gap-2">
                      {result.citations.map((citation: import("./api").Citation, i: number) => (
                         <div
                          key={i}
                           className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 shadow-sm"
                           data-testid={`verified-authority-${citation.judgmentId ?? i}`}
                        >
                           <div className="flex items-start gap-2.5">
                             <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                             <div className="min-w-0 flex-1">
                               <a href={citation.uri} target="_blank" rel="noreferrer noopener" className="leading-relaxed font-semibold hover:text-primary hover:underline">
                                 {citation.title}
                               </a>
                               <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                                 <span className={`rounded px-1.5 py-0.5 font-bold uppercase tracking-wide ${citation.origin === "internal_verified" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`}>
                                   {citation.origin === "internal_verified" ? "Internal verified" : "Public web · unverified"}
                                 </span>
                                 {citation.citation && <span>{citation.citation}</span>}
                                 {citation.court && <span>· {citation.court}</span>}
                                 {citation.decisionDate && <span>· {citation.decisionDate}</span>}
                               </div>
                             </div>
                           </div>
                           {citation.origin === "internal_verified" && citation.pinpoints && citation.pinpoints.length > 0 && (
                             <details className="mt-3 border-t border-slate-100 pt-2">
                               <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-primary">
                                 View cited passages
                               </summary>
                               <div className="mt-2 space-y-2">
                                 {citation.pinpoints.map((pinpoint) => (
                                   <blockquote key={`${pinpoint.paragraphRef}-${pinpoint.pageNumber}`} className="border-l-2 border-primary/30 pl-3 text-[11px] leading-relaxed text-slate-600">
                                     <span className="mb-1 block font-bold text-slate-700">{pinpoint.paragraphRef} · source page {pinpoint.pageNumber}</span>
                                     {pinpoint.text}
                                   </blockquote>
                                 ))}
                               </div>
                             </details>
                           )}
                         </div>
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
                      <div className={`p-4 rounded-xl text-xs border shadow-sm ${result.verification.verified ? "bg-primary/5 border-primary/20 text-slate-800" : "bg-amber-50 border-amber-200 text-amber-900"}`}>
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
                          <Badge key={i} variant="secondary" className="bg-white border border-slate-200 text-slate-600 font-medium text-[11px] px-3 py-1 shadow-sm rounded-lg">
                             {capabilityLabel[cap] ?? cap.replace(/_/g, " ")}
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
      {canWrite && (
        <div className="p-4 md:p-6 bg-white shrink-0 border-t border-slate-200 relative z-10 max-w-4xl mx-auto w-full">
          <div className="relative rounded-2xl border border-slate-200 bg-slate-50/80 focus-within:bg-white focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 transition-all shadow-sm">
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Instruct the matter assistant..."
              className="min-h-[60px] md:min-h-[80px] max-h-[300px] resize-y pr-14 text-[15px] bg-transparent border-0 focus-visible:ring-0 py-4 px-5 leading-relaxed shadow-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={isPending}
              data-testid="input-matter-instruction"
            />
            <Button
              size="icon"
              className="absolute bottom-3 right-3 rounded-xl w-9 h-9 bg-primary hover:bg-primary/90 text-white shadow-sm transition-all"
              disabled={!instruction.trim() || isPending}
              onClick={handleSubmit}
              aria-label="Send matter instruction"
              data-testid="button-send-matter-instruction"
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-3 px-2">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-primary/60" />
              Confidential Matter-Bound Session
            </p>
             <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5" aria-label="Research source">
               <button
                 type="button"
                 onClick={() => setResearchMode("verified_library")}
                 className={`rounded-md px-2 py-1 text-[10px] font-bold ${researchMode === "verified_library" ? "bg-white text-primary shadow-sm" : "text-slate-500"}`}
                 data-testid="research-mode-verified"
               >
                 Verified library
               </button>
               <button
                 type="button"
                 onClick={() => setResearchMode("web")}
                 className={`rounded-md px-2 py-1 text-[10px] font-bold ${researchMode === "web" ? "bg-amber-50 text-amber-700 shadow-sm" : "text-slate-500"}`}
                 data-testid="research-mode-web"
                 title="Public web sources are not verified by the LAWYes editorial library"
               >
                 Web research
               </button>
             </div>
          </div>
           {researchMode === "web" && (
             <p className="mt-2 px-2 text-[10px] leading-relaxed text-amber-700">
               Web research may be current but is not editorially verified. Check every authority and pinpoint before professional use.
             </p>
           )}
        </div>
      )}
    </div>
  );
}
