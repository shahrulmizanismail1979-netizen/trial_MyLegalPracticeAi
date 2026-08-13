import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import WorkspaceLayout from "./layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import MarkdownRenderer from "@/components/markdown-renderer";
import { DraftExportButtons } from "@workspace/draft-export/react";
import { useToast } from "@/hooks/use-toast";
import {
  useMatter,
  useUpdateMatter,
  useDeleteMatter,
  useMatterWork,
  useAddDeadline,
  useUpdateDeadline,
  useDeleteDeadline,
  useStageHistory,
  useUpdateStage,
  useAiInsights,
  useChecklist,
  useAddChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  useTimeEntries,
  useLogTime,
  useDeleteTimeEntry,
  useClients,
  useCreateClient,
  useDeleteClient,
  useMatterClients,
  useLinkClient,
  useUnlinkClient,
  useCaseEvents,
  useAddCaseEvent,
  useUpdateCaseEvent,
  useDeleteCaseEvent,
  useCaseReview,
  CASE_EVENT_KINDS,
  daysUntil,
  fmtDate,
  ApiError,
  type MatterDeadline,
  type MatterWorkItem,
  type MatterInput,
  type ChecklistItem,
  type CaseEvent,
  type CaseClient,
} from "@/hooks/use-matters";
import {
  ArrowLeft, CalendarClock, Plus, Pencil, Trash2, Check,
  AlertTriangle, CircleCheck, User, Hash, Clock, FileText, Copy,
  Sparkles, TrendingUp, TrendingDown, Minus, RefreshCw, ListChecks,
  Phone, Mail, Timer, Building2, Users, ChevronDown, Download,
  History, Link2, X, Loader2, Calculator, FolderLock, FileSignature,
} from "lucide-react";
import { authHeaders } from "@/lib/auth";
import { BillingTab, type BillingRequest } from "@workspace/billing-ui";
import { DocumentsPanel, type VaultRequest } from "@workspace/vault-ui";
import { DraftsPanel, type LettersRequest } from "@workspace/letters-ui";

const billingRequest: BillingRequest = (path, init) =>
  fetch(`/api/ccb/matters${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...authHeaders() },
  });
const vaultRequest: VaultRequest = billingRequest;
const lettersRequest: LettersRequest = billingRequest;

const CCB_STAGES = ["Pre-Action", "Filing", "Interlocutory", "Trial", "Judgment", "Enforcement", "Closed"];
const STATUS_OPTIONS = [...CCB_STAGES];
const selectCls = "flex h-10 w-full items-center rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

type Tab = "overview" | "timeline" | "chronology" | "documents" | "vault" | "checklist" | "team" | "time" | "billing" | "letters";

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "timeline", label: "Timeline", icon: CalendarClock },
  { id: "chronology", label: "Chronology", icon: History },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "vault", label: "Vault", icon: FolderLock },
  { id: "checklist", label: "Checklist", icon: ListChecks },
  { id: "team", label: "Team", icon: Users },
  { id: "time", label: "Time", icon: Timer },
  { id: "billing", label: "Billing", icon: Calculator },
  { id: "letters", label: "Drafts & Letters", icon: FileSignature },
];

const EVENT_KIND_COLORS: Record<string, string> = {
  filing: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  hearing: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  correspondence: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  instruction: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  deadline: "bg-red-500/10 text-red-500 border-red-500/20",
  stage: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  "saved-work": "bg-slate-500/10 text-slate-400 border-slate-500/20",
  note: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  payment: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  meeting: "bg-pink-500/10 text-pink-500 border-pink-500/20",
};

function ChronologyTab({ matterId }: { matterId: number }) {
  const { data: events, isLoading } = useCaseEvents(matterId);
  const addEvent = useAddCaseEvent();
  const updateEvent = useUpdateCaseEvent();
  const deleteEvent = useDeleteCaseEvent();
  const { toast } = useToast();

  const blank = { title: "", event_date: new Date().toISOString().slice(0, 10), kind: "filing", description: "" };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<CaseEvent | null>(null);
  const [editForm, setEditForm] = useState(blank);

  const sorted = [...(events ?? [])].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
  );

  const submit = async () => {
    if (!form.title.trim() || !form.event_date) { toast({ title: "Title and date required", variant: "destructive" }); return; }
    try {
      await addEvent.mutateAsync({ matterId, title: form.title.trim(), event_date: form.event_date, kind: form.kind, description: form.description.trim() || undefined });
      setForm(blank);
      toast({ title: "Event added" });
    } catch (e) {
      toast({ title: "Could not add event", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.title.trim() || !editForm.event_date) { toast({ title: "Title and date required", variant: "destructive" }); return; }
    try {
      await updateEvent.mutateAsync({ matterId, eventId: editing.id, title: editForm.title.trim(), event_date: editForm.event_date, kind: editForm.kind, description: editForm.description.trim() || undefined });
      setEditing(null);
      toast({ title: "Event updated" });
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <h2 className="font-serif font-bold text-lg text-foreground">Chronology</h2>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Add event</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Date *</Label><Input type="date" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Kind *</Label>
              <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))} className={selectCls}>
                {CASE_EVENT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Writ of summons filed" /></div>
          </div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <Button onClick={submit} disabled={addEvent.isPending} className="gap-1.5">{addEvent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add event</Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="p-8 text-center text-primary animate-pulse">Loading chronology…</div>
      ) : sorted.length === 0 ? (
        <Card><CardContent className="p-10 text-center"><History className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No chronology events yet. Add key filings, hearings and correspondence above.</p></CardContent></Card>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-3">
            {sorted.map((ev) => (
              <div key={ev.id} className="relative flex items-start gap-3">
                <div className="absolute -left-2.5 mt-2 h-5 w-5 rounded-full border-2 border-primary bg-background flex items-center justify-center shrink-0"><div className="h-2 w-2 rounded-full bg-primary" /></div>
                <Card className="flex-1 ml-4">
                  <CardContent className="p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${EVENT_KIND_COLORS[ev.kind] ?? EVENT_KIND_COLORS.note}`}>{ev.kind}</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(ev.event_date)}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground mt-1">{ev.title}</p>
                      {ev.description && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{ev.description}</p>}
                      {ev.source && <p className="text-[10px] text-muted-foreground/70 mt-1">Source: {ev.source}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditing(ev); setEditForm({ title: ev.title, event_date: ev.event_date.slice(0, 10), kind: ev.kind, description: ev.description ?? "" }); }} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => deleteEvent.mutateAsync({ matterId, eventId: ev.id })} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit event</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Date *</Label><Input type="date" value={editForm.event_date} onChange={(e) => setEditForm((f) => ({ ...f, event_date: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Kind *</Label>
              <select value={editForm.kind} onChange={(e) => setEditForm((f) => ({ ...f, kind: e.target.value }))} className={selectCls}>
                {CASE_EVENT_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>Title *</Label><Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Textarea rows={2} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateEvent.isPending}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AiReviewCard({ matterId }: { matterId: number }) {
  const review = useCaseReview();
  const { toast } = useToast();
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    setResult(null);
    try {
      const res = await review.mutateAsync(matterId);
      setResult(res.review ?? "");
    } catch (e) {
      toast({ title: "AI review failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <Card className="border-primary/20">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold text-foreground">AI Case Review</span>
          </div>
          <Button size="sm" className="gap-1.5" onClick={run} disabled={review.isPending}>
            {review.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {review.isPending ? "Reviewing…" : "Run AI review"}
          </Button>
        </div>
        {review.isPending && <p className="text-sm text-muted-foreground animate-pulse">Generating case review and prioritised next actions… this can take up to a minute.</p>}
        {result != null && !review.isPending && (
          <div className="border-t border-border pt-3">
            <MarkdownRenderer content={result} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MatterClientsCard({ matterId }: { matterId: number }) {
  const { data: linked, isLoading } = useMatterClients(matterId);
  const { data: allClients } = useClients();
  const createClient = useCreateClient();
  const linkClient = useLinkClient();
  const unlinkClient = useUnlinkClient();
  const { toast } = useToast();

  const [linkOpen, setLinkOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [newForm, setNewForm] = useState({ name: "", phone: "", email: "" });

  const linkedIds = new Set((linked ?? []).map((c) => c.id));
  const available = (allClients ?? []).filter((c) => !linkedIds.has(c.id));

  const doLinkExisting = async () => {
    if (!selectedId) return;
    try {
      await linkClient.mutateAsync({ clientId: parseInt(selectedId, 10), matterId });
      toast({ title: "Client linked" });
      setSelectedId(""); setLinkOpen(false);
    } catch (e) { toast({ title: "Could not link", description: e instanceof Error ? e.message : "", variant: "destructive" }); }
  };

  const doCreateAndLink = async () => {
    if (!newForm.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    try {
      const created: CaseClient = await createClient.mutateAsync({ name: newForm.name.trim(), phone: newForm.phone.trim() || undefined, email: newForm.email.trim() || undefined });
      await linkClient.mutateAsync({ clientId: created.id, matterId });
      toast({ title: "Client created & linked" });
      setNewForm({ name: "", phone: "", email: "" }); setLinkOpen(false);
    } catch (e) { toast({ title: "Could not create client", description: e instanceof Error ? e.message : "", variant: "destructive" }); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><User className="h-4 w-4 text-primary" /> Linked Clients</h3>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setLinkOpen(true)}><Link2 className="h-3.5 w-3.5" /> Link client</Button>
      </div>
      {isLoading ? null : (linked ?? []).length === 0 ? (
        <Card><CardContent className="p-6 text-center"><p className="text-sm text-muted-foreground">No client linked to this matter yet.</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {linked!.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground">{c.name}</p>
                  {c.company_name && <p className="text-xs text-muted-foreground">{c.company_name}</p>}
                  {c.email && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Mail className="h-3 w-3" /> {c.email}</p>}
                  {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</p>}
                </div>
                <button onClick={async () => { try { await unlinkClient.mutateAsync({ clientId: c.id, matterId }); toast({ title: "Client unlinked" }); } catch { toast({ title: "Could not unlink", variant: "destructive" }); } }} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0" title="Unlink"><X className="h-3.5 w-3.5" /></button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Link a client</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Existing client</Label>
              {available.length === 0 ? (
                <p className="text-xs text-muted-foreground">No other clients available.</p>
              ) : (
                <div className="flex gap-2">
                  <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={selectCls}>
                    <option value="">Choose a client…</option>
                    {available.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <Button onClick={doLinkExisting} disabled={!selectedId || linkClient.isPending}>Link</Button>
                </div>
              )}
            </div>
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Or create a new client</p>
              <div className="space-y-1.5"><Label>Name *</Label><Input value={newForm.name} onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Phone</Label><Input value={newForm.phone} onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))} /></div>
                <div className="space-y-1.5"><Label>Email</Label><Input value={newForm.email} onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <Button className="w-full gap-1.5" onClick={doCreateAndLink} disabled={createClient.isPending || linkClient.isPending || !newForm.name.trim()}>
                {(createClient.isPending || linkClient.isPending) && <Loader2 className="h-4 w-4 animate-spin" />} Create & link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CountdownBadge({ due, status }: { due: string; status: string }) {
  if (status === "done") return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500"><CircleCheck className="h-3.5 w-3.5" /> Done</span>;
  const d = daysUntil(due);
  if (d < 0) return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> {Math.abs(d)}d overdue</span>;
  if (d === 0) return <span className="text-[11px] font-bold text-destructive">Due today</span>;
  if (d <= 7) return <span className="text-[11px] font-bold text-amber-500">in {d}d</span>;
  return <span className="text-[11px] font-medium text-muted-foreground">in {d}d</span>;
}

function StageStepper({ matterId, currentStatus }: { matterId: number; currentStatus: string }) {
  const updateStage = useUpdateStage();
  const { toast } = useToast();
  const currentIdx = CCB_STAGES.indexOf(currentStatus);

  const changeStage = async (stage: string) => {
    if (stage === currentStatus) return;
    try {
      await updateStage.mutateAsync({ id: matterId, stage });
      toast({ title: `Stage updated to "${stage}"` });
    } catch (e) {
      toast({ title: "Could not update stage", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Litigation Stage</p>
      <div className="flex items-center gap-1 flex-wrap">
        {CCB_STAGES.map((stage, idx) => {
          const isActive = stage === currentStatus;
          const isPast = idx < currentIdx;
          return (
            <button
              key={stage}
              onClick={() => changeStage(stage)}
              disabled={updateStage.isPending}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                isActive
                  ? "bg-primary/15 text-primary border-primary/40"
                  : isPast
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:border-emerald-500/40"
                  : "text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {isPast && <Check className="inline h-3 w-3 mr-1" />}
              {stage}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AiInsightsCard({ matterId }: { matterId: number }) {
  const { data: insights, isLoading, isError, refetch, isFetching } = useAiInsights(matterId);

  const riskColor = (rating: string) => {
    if (rating === "High") return "text-red-500 bg-red-500/10 border-red-500/20";
    if (rating === "Medium") return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
  };

  if (isLoading || isFetching) {
    return (
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            <span className="text-sm font-semibold text-foreground">AI Case Intelligence</span>
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Generating insights…</p>
        </CardContent>
      </Card>
    );
  }

  if (isError || !insights) {
    return (
      <Card>
        <CardContent className="p-5 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">AI insights unavailable</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-semibold text-foreground">AI Case Summary</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${riskColor(insights.riskAssessment.rating)}`}>
                {insights.riskAssessment.rating} Risk
              </span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => refetch()}><RefreshCw className="h-3 w-3" /></Button>
            </div>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{insights.caseSummary}</p>
        </CardContent>
      </Card>

      {insights.nextSteps.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recommended Next Steps</p>
            <div className="space-y-2.5">
              {insights.nextSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  {step.priority === "high" ? <TrendingUp className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" /> :
                   step.priority === "medium" ? <Minus className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" /> :
                   <TrendingDown className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{step.action}</p>
                    {step.suggestedDeadline && <p className="text-xs text-muted-foreground mt-0.5">⏱ {step.suggestedDeadline}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(insights.riskAssessment.keyStrengths.length > 0 || insights.riskAssessment.keyWeaknesses.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {insights.riskAssessment.keyStrengths.length > 0 && (
            <Card className="border-emerald-500/20">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wider mb-2">Strengths</p>
                <ul className="space-y-1">
                  {insights.riskAssessment.keyStrengths.map((s, i) => (
                    <li key={i} className="text-xs text-foreground/80 flex gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" /> {s}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {insights.riskAssessment.keyWeaknesses.length > 0 && (
            <Card className="border-red-500/20">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">Concerns</p>
                <ul className="space-y-1">
                  {insights.riskAssessment.keyWeaknesses.map((w, i) => (
                    <li key={i} className="text-xs text-foreground/80 flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" /> {w}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function ChecklistTab({ matterId }: { matterId: number }) {
  const { data: items, isLoading } = useChecklist(matterId);
  const addItem = useAddChecklistItem();
  const updateItem = useUpdateChecklistItem();
  const deleteItem = useDeleteChecklistItem();
  const { toast } = useToast();
  const [newText, setNewText] = useState("");

  const doneCount = (items ?? []).filter((i) => i.done).length;
  const total = items?.length ?? 0;

  const toggle = async (item: ChecklistItem) => {
    try { await updateItem.mutateAsync({ matterId, itemId: item.id, done: !item.done }); }
    catch { toast({ title: "Could not update", variant: "destructive" }); }
  };

  const addNew = async () => {
    if (!newText.trim()) return;
    try { await addItem.mutateAsync({ matterId, text: newText.trim() }); setNewText(""); }
    catch { toast({ title: "Could not add", variant: "destructive" }); }
  };

  if (isLoading) return <div className="p-8 text-center text-primary animate-pulse">Loading checklist…</div>;

  return (
    <div className="space-y-4">
      {total > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-border rounded-full h-1.5">
            <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{doneCount}/{total}</span>
        </div>
      )}

      {(items ?? []).length === 0 ? (
        <Card><CardContent className="p-8 text-center"><ListChecks className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No checklist yet. AI will generate one, or add items below.</p></CardContent></Card>
      ) : (
        <div className="space-y-1.5">
          {[...(items ?? [])].sort((a, b) => a.position - b.position).map((item) => (
            <Card key={item.id} className={item.done ? "opacity-60" : ""}>
              <CardContent className="p-3 flex items-center gap-3">
                <button onClick={() => toggle(item)} className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${item.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-border hover:border-primary"}`}>
                  {item.done && <Check className="h-3 w-3" />}
                </button>
                <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.text}</span>
                <button onClick={() => deleteItem.mutateAsync({ matterId, itemId: item.id })} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Add a checklist item…" onKeyDown={(e) => e.key === "Enter" && addNew()} />
        <Button onClick={addNew} disabled={addItem.isPending} className="gap-1.5 shrink-0"><Plus className="h-4 w-4" /> Add</Button>
      </div>
    </div>
  );
}

function TeamTab({ matter }: { matter: { id: number; clientName: string | null; counterparty: string | null } }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {matter.clientName && (
          <Card className="border-primary/20"><CardContent className="p-4"><p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Client</p><p className="font-semibold text-foreground">{matter.clientName}</p></CardContent></Card>
        )}
        {matter.counterparty && (
          <Card><CardContent className="p-4"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Counterparty</p><p className="font-semibold text-foreground">{matter.counterparty}</p></CardContent></Card>
        )}
      </div>
      <MatterClientsCard matterId={matter.id} />
      <ContactDirectory />
    </div>
  );
}

function ContactDirectory() {
  const { data: clients, isLoading } = useClients();
  const createClient = useCreateClient();
  const deleteClient = useDeleteClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", company_name: "", email: "", phone: "", notes: "" });

  const submit = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    try {
      await createClient.mutateAsync({ name: form.name.trim(), company_name: form.company_name || undefined, email: form.email || undefined, phone: form.phone || undefined, notes: form.notes || undefined });
      toast({ title: "Contact added" });
      setAddOpen(false);
      setForm({ name: "", company_name: "", email: "", phone: "", notes: "" });
    } catch { toast({ title: "Could not add", variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Contact Directory</h3>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddOpen(true)}><Plus className="h-3.5 w-3.5" /> Add</Button>
        </div>
        {isLoading ? null : (clients ?? []).length === 0 ? (
          <Card><CardContent className="p-6 text-center"><p className="text-sm text-muted-foreground">No contacts yet.</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(clients ?? []).map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{c.name}</p>
                    {c.company_name && <p className="text-xs text-muted-foreground">{c.company_name}</p>}
                    {c.email && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Mail className="h-3 w-3" /> {c.email}</p>}
                    {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</p>}
                  </div>
                  <button onClick={() => deleteClient.mutateAsync(c.id)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Company</Label><Input value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={createClient.isPending}>Add contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TimeTab({ matterId }: { matterId: number }) {
  const { data: timeData, isLoading } = useTimeEntries(matterId);
  const logTime = useLogTime();
  const deleteEntry = useDeleteTimeEntry();
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ description: "", minutes: "", entry_date: today });

  const submit = async () => {
    if (!form.description.trim() || !form.minutes || !form.entry_date) { toast({ title: "All fields required", variant: "destructive" }); return; }
    const mins = parseInt(form.minutes, 10);
    if (Number.isNaN(mins) || mins <= 0) { toast({ title: "Enter valid minutes", variant: "destructive" }); return; }
    try {
      await logTime.mutateAsync({ matterId, description: form.description.trim(), minutes: mins, entry_date: form.entry_date });
      toast({ title: "Time logged" });
      setForm({ description: "", minutes: "", entry_date: today });
    } catch { toast({ title: "Could not log time", variant: "destructive" }); }
  };

  const totalH = Math.floor((timeData?.totalMinutes ?? 0) / 60);
  const totalM = (timeData?.totalMinutes ?? 0) % 60;

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardContent className="p-4 flex items-center gap-4">
          <Timer className="h-5 w-5 text-primary" />
          <div>
            <p className="text-2xl font-bold text-foreground">{totalH}h {totalM}m</p>
            <p className="text-xs text-muted-foreground">Total time recorded</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Log Time</p>
          <div className="space-y-1.5"><Label>Description *</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Review cause papers, advise on interlocutory" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Minutes *</Label><Input type="number" min="1" value={form.minutes} onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))} placeholder="e.g. 90" /></div>
            <div className="space-y-1.5"><Label>Date *</Label><Input type="date" value={form.entry_date} onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))} /></div>
          </div>
          <Button onClick={submit} disabled={logTime.isPending} className="gap-1.5"><Plus className="h-4 w-4" /> {logTime.isPending ? "Logging…" : "Log time"}</Button>
        </CardContent>
      </Card>

      {isLoading ? null : (timeData?.entries ?? []).length === 0 ? (
        <Card><CardContent className="p-6 text-center"><p className="text-sm text-muted-foreground">No time entries yet.</p></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {(timeData?.entries ?? []).map((entry) => (
            <Card key={entry.id}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{entry.description}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(entry.entry_date)}</p>
                </div>
                <span className="text-sm font-semibold text-primary shrink-0">{Math.floor(entry.minutes / 60)}h {entry.minutes % 60}m</span>
                <button onClick={() => deleteEntry.mutateAsync({ matterId, entryId: entry.id })} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MatterDetailPage() {
  const [, params] = useRoute("/workspace/matters/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id, 10) : null;
  const { data: matter, isLoading, error } = useMatter(id);
  const { data: matterWork } = useMatterWork(id);
  const { toast } = useToast();

  const updateMatter = useUpdateMatter();
  const deleteMatter = useDeleteMatter();
  const addDeadline = useAddDeadline();
  const updateDeadline = useUpdateDeadline();
  const deleteDeadline = useDeleteDeadline();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<MatterInput>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dForm, setDForm] = useState({ title: "", dueDate: "", basis: "", notes: "" });
  const [viewDoc, setViewDoc] = useState<MatterWorkItem | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const isForbidden = error instanceof ApiError && error.status === 403;

  if (isForbidden) {
    return (
      <WorkspaceLayout>
        <div className="p-10 text-center max-w-lg mx-auto">
          <h2 className="text-xl font-serif font-bold mb-2">Matter files require a subscriber access code</h2>
          <p className="text-muted-foreground mb-4">{error instanceof ApiError ? error.message : ""}</p>
          <Link href="/workspace/matters"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        </div>
      </WorkspaceLayout>
    );
  }

  if (isLoading) return <WorkspaceLayout><div className="p-10 text-center text-primary animate-pulse">Loading matter…</div></WorkspaceLayout>;
  if (!matter) {
    return (
      <WorkspaceLayout>
        <div className="p-10 text-center">
          <p className="text-muted-foreground mb-4">This matter could not be found.</p>
          <Link href="/workspace/matters"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back to matters</Button></Link>
        </div>
      </WorkspaceLayout>
    );
  }

  const openEdit = () => {
    setEditForm({ title: matter.title, clientName: matter.clientName ?? "", counterparty: matter.counterparty ?? "", matterType: matter.matterType ?? "", reference: matter.reference ?? "", status: matter.status, notes: matter.notes ?? "" });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.title?.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
    try {
      await updateMatter.mutateAsync({ id: matter.id, ...editForm });
      toast({ title: "Matter updated" });
      setEditOpen(false);
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const doDelete = async () => {
    try {
      await deleteMatter.mutateAsync(matter.id);
      toast({ title: "Matter deleted" });
      setLocation("/workspace/matters");
    } catch (e) {
      toast({ title: "Could not delete", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const submitAdd = async () => {
    if (!dForm.title.trim() || !dForm.dueDate) { toast({ title: "Title and due date required", variant: "destructive" }); return; }
    try {
      await addDeadline.mutateAsync({ matterId: matter.id, ...dForm });
      toast({ title: "Deadline added" });
      setAddOpen(false);
      setDForm({ title: "", dueDate: "", basis: "", notes: "" });
    } catch (e) {
      toast({ title: "Could not add deadline", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const toggleDone = async (d: MatterDeadline) => {
    try { await updateDeadline.mutateAsync({ matterId: matter.id, id: d.id, status: d.status === "done" ? "pending" : "done" }); }
    catch { toast({ title: "Could not update", variant: "destructive" }); }
  };

  const copyDoc = (w: MatterWorkItem) => { navigator.clipboard.writeText(w.content); toast({ title: "Copied to clipboard" }); };

  const deadlines = matter.deadlines ?? [];
  const pending = deadlines.filter((d) => d.status !== "done");
  const done = deadlines.filter((d) => d.status === "done");

  return (
    <WorkspaceLayout>
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
        <Link href="/workspace/matters">
          <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" /> All matters
          </button>
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {matter.reference && <span className="text-xs font-mono text-muted-foreground">{matter.reference}</span>}
              {matter.matterType && <Badge variant="outline" className="text-xs">{matter.matterType}</Badge>}
            </div>
            <h1 className="text-2xl font-serif font-bold tracking-tight text-foreground">{matter.title}</h1>
            {matter.clientName && (
              <p className="text-sm text-muted-foreground mt-1">
                {matter.clientName}{matter.counterparty ? ` · ${matter.counterparty}` : ""}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={openEdit}><Pencil className="h-4 w-4" /> Edit</Button>
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.id === "documents" && (matterWork?.length ?? 0) > 0 && (
                <span className="ml-1 text-[10px] bg-primary/15 text-primary rounded-full px-1.5">{matterWork!.length}</span>
              )}
              {tab.id === "timeline" && pending.length > 0 && (
                <span className="ml-1 text-[10px] bg-amber-500/15 text-amber-500 rounded-full px-1.5">{pending.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <StageStepper matterId={matter.id} currentStatus={matter.status} />
            {matter.notes && (
              <Card><CardContent className="p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Notes</p><p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{matter.notes}</p></CardContent></Card>
            )}
            {/* AI tool launch */}
            <Card className="border-primary/20">
              <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-sm text-foreground">Draft for this matter</p>
                  <p className="text-xs text-muted-foreground">Launch AI tools pre-filled with matter context</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link href={`/workspace/tool/cause-paper-drafter?matter=${matter.id}&client=${encodeURIComponent(matter.clientName ?? "")}&ref=${encodeURIComponent(matter.reference ?? "")}`}>
                    <Button size="sm" variant="outline" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Cause Papers</Button>
                  </Link>
                  <Link href={`/workspace/tool/legal-opinion?matter=${matter.id}&ref=${encodeURIComponent(matter.reference ?? "")}`}>
                    <Button size="sm" variant="outline" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Legal Opinion</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
            <AiInsightsCard matterId={matter.id} />
            <AiReviewCard matterId={matter.id} />
          </div>
        )}

        {activeTab === "chronology" && <ChronologyTab matterId={matter.id} />}

        {activeTab === "timeline" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                <h2 className="font-serif font-bold text-lg text-foreground">Deadline Timeline</h2>
                {pending.length > 0 && <Badge variant="outline">{pending.length} pending</Badge>}
              </div>
              <Button className="gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add</Button>
            </div>

            {deadlines.length === 0 ? (
              <Card><CardContent className="p-10 text-center"><CalendarClock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" /><p className="text-sm text-muted-foreground max-w-sm mx-auto">No deadlines yet. Add key dates for filing, hearings, and judgments.</p></CardContent></Card>
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-3">
                  {[...pending, ...done].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map((d) => {
                    const isDone = d.status === "done";
                    return (
                      <div key={d.id} className={`relative flex items-start gap-3 ${isDone ? "opacity-60" : ""}`}>
                        <button
                          onClick={() => toggleDone(d)}
                          className={`absolute -left-2.5 mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all bg-background ${isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-border hover:border-primary"}`}
                        >
                          {isDone && <Check className="h-3 w-3" />}
                        </button>
                        <Card className="flex-1">
                          <CardContent className="p-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{d.title}</span>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <Clock className="h-3 w-3" /> {fmtDate(d.dueDate)}
                                {d.basis && <span className="truncate">· {d.basis}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <CountdownBadge due={d.dueDate} status={d.status} />
                              <button onClick={() => deleteDeadline.mutateAsync({ matterId: matter.id, id: d.id })} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "documents" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="font-serif font-bold text-lg text-foreground">Documents</h2>
              {(matterWork?.length ?? 0) > 0 && <Badge variant="outline">{matterWork!.length}</Badge>}
            </div>
            {(matterWork?.length ?? 0) === 0 ? (
              <Card><CardContent className="p-8 text-center"><FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">No documents filed yet. Generate a draft in any tool and file it here.</p></CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {matterWork!.map((w) => (
                  <Card key={w.id} className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => setViewDoc(w)}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <FileText className="h-4 w-4 text-primary mt-1 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{w.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Updated {fmtDate(w.updatedAt)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "vault" && (
          <DocumentsPanel request={vaultRequest} matterId={matter.id} accent="#d99e1f" />
        )}

        {activeTab === "checklist" && <ChecklistTab matterId={matter.id} />}
        {activeTab === "team" && <TeamTab matter={matter} />}
        {activeTab === "time" && <TimeTab matterId={matter.id} />}
        {activeTab === "billing" && (
          <BillingTab
            request={billingRequest}
            matterId={matter.id}
            currency="RM"
            accent="#d99e1f"
            defaultClientName={matter.clientName ?? undefined}
          />
        )}

        {activeTab === "letters" && (
          <DraftsPanel
            request={lettersRequest}
            matterId={matter.id}
            accent="#d99e1f"
            showLetterWriter
            matterTitle={matter.title ?? ""}
            clientName={matter.clientName ?? ""}
          />
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit matter</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Matter title *</Label><Input value={editForm.title ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Client</Label><Input value={editForm.clientName ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, clientName: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Counterparty</Label><Input value={editForm.counterparty ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, counterparty: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Matter type</Label><Input value={editForm.matterType ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, matterType: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>File reference</Label><Input value={editForm.reference ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, reference: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select value={editForm.status ?? "open"} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))} className={selectCls}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={editForm.notes ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateMatter.isPending}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete this matter?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This permanently deletes <span className="text-foreground font-medium">"{matter.title}"</span> and all its data.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={doDelete} disabled={deleteMatter.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add deadline</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Title *</Label><Input value={dForm.title} onChange={(e) => setDForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. File defence" /></div>
            <div className="space-y-1.5"><Label>Due date *</Label><Input type="date" value={dForm.dueDate} onChange={(e) => setDForm((f) => ({ ...f, dueDate: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Basis</Label><Input value={dForm.basis} onChange={(e) => setDForm((f) => ({ ...f, basis: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={dForm.notes} onChange={(e) => setDForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submitAdd} disabled={addDeadline.isPending}>Add deadline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewDoc} onOpenChange={(o) => !o && setViewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle className="pr-8">{viewDoc?.title}</DialogTitle></DialogHeader>
          {viewDoc && (
            <>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyDoc(viewDoc)}><Copy className="h-3.5 w-3.5" /> Copy</Button>
                <DraftExportButtons title={viewDoc.title} content={viewDoc.content} className="items-center" />
              </div>
              <div className="overflow-y-auto flex-1 mt-2 border-t border-border pt-4">
                <MarkdownRenderer content={viewDoc.content} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </WorkspaceLayout>
  );
}
