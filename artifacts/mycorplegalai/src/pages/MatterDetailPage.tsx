import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useMatter, useUpdateMatter, useDeleteMatter,
  useAddDeadline, useUpdateDeadline, useDeleteDeadline,
  useStageHistory, useUpdateStage, useAiInsights, useRefreshAiInsights, useIntakeBriefing, useGenerateIntakeBriefing,
  useChecklist, useAddChecklistItem, useUpdateChecklistItem, useDeleteChecklistItem,
  useTimeEntries, useLogTime, useDeleteTimeEntry,
  useClients, useCreateClient, useDeleteClient,
  useMatterClients, useLinkClient, useUnlinkClient,
  useCaseEvents, useAddCaseEvent, useUpdateCaseEvent, useDeleteCaseEvent,
  useMatterReview,
  useMatterWork, categoryMeta, daysUntil, fmtDate,
  CASE_EVENT_KINDS,
  type MatterDeadline, type MatterWorkItem, type MatterInput,
  type CaseInsights, type ChecklistItem, type TimeEntry, type CaseClient,
  type CaseEvent,
  ApiError,
} from "@/hooks/use-matters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, CalendarClock, Plus, Pencil, Trash2, Check, AlertTriangle,
  CircleCheck, Building2, Users, Hash, Clock, FileText, Copy, Download, ChevronDown,
  Sparkles, TrendingUp, TrendingDown, Minus, RefreshCw, ListChecks,
  User, Phone, Mail, Timer, ChevronRight, ArrowRight, History, Link2, X, Loader2,
  Calculator, FolderLock, FileSignature, Scale, ClipboardList,
} from "lucide-react";
import { BillingTab, BillingPage as SharedBillingPage, type BillingRequest } from "@workspace/billing-ui";
import { DocumentsPanel, type VaultRequest } from "@workspace/vault-ui";
import { DraftsPanel, type LettersRequest } from "@workspace/letters-ui";
import { CaseHomePanel, type CaseHomeRequest } from "@workspace/case-home-ui";
const API_BASE = import.meta.env.VITE_API_URL || "";

export const billingRequest: BillingRequest = (path, init) => {
  const token = localStorage.getItem("auth_token");
  return fetch(`${API_BASE}/api/corp/matters${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
};

const vaultRequest: VaultRequest = billingRequest;
const lettersRequest: LettersRequest = billingRequest;
const caseHomeRequest: CaseHomeRequest = (path, init) => {
  const token = localStorage.getItem("auth_token");
  return fetch(`${API_BASE}/api/corp/matters${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init as RequestInit & { headers?: Record<string, string> })?.headers || {}),
    },
  });
};

const CORP_STAGES = ["Instruction", "Due Diligence", "Advisory", "Opinion Delivered", "Closed"];
const STATUS_OPTIONS = [...CORP_STAGES];
const CATEGORY_OPTIONS = ["filing", "compliance", "meeting", "closing", "hearing", "custom"];
const inputCls =
  "w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary";

type Tab = "overview" | "chronology" | "timeline" | "documents" | "vault" | "checklist" | "team" | "time" | "billing" | "letters";

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "chronology", label: "Chronology", icon: History },
  { id: "timeline", label: "Timeline", icon: CalendarClock },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "vault", label: "Vault", icon: FolderLock },
  { id: "checklist", label: "Checklist", icon: ListChecks },
  { id: "team", label: "Team", icon: Users },
  { id: "time", label: "Time", icon: Timer },
  { id: "billing", label: "Billing", icon: Calculator },
  { id: "letters", label: "Drafts & Letters", icon: FileSignature },
];

const EVENT_KIND_META: Record<string, { label: string; color: string }> = {
  filing: { label: "Filing", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  hearing: { label: "Hearing", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  correspondence: { label: "Correspondence", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  instruction: { label: "Instruction", color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  deadline: { label: "Deadline", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  stage: { label: "Stage", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
  "saved-work": { label: "Saved work", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  note: { label: "Note", color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
  payment: { label: "Payment", color: "text-green-400 bg-green-500/10 border-green-500/20" },
  meeting: { label: "Meeting", color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
};

function eventKindMeta(kind: string) {
  return EVENT_KIND_META[kind] ?? { label: kind, color: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
}

function CountdownBadge({ due, status }: { due: string; status: string }) {
  if (status === "done") return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><CircleCheck className="h-3.5 w-3.5" /> Done</span>;
  const d = daysUntil(due);
  if (d < 0) return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> {Math.abs(d)}d overdue</span>;
  if (d === 0) return <span className="text-[11px] font-bold text-red-400">Due today</span>;
  if (d <= 7) return <span className="text-[11px] font-bold text-amber-400">in {d}d</span>;
  return <span className="text-[11px] font-medium text-muted-foreground">in {d}d</span>;
}

// ── Stage Stepper ─────────────────────────────────────────────────────────────
function StageStepper({ matterId, currentStatus }: { matterId: number; currentStatus: string }) {
  const updateStage = useUpdateStage();
  const { toast } = useToast();

  const currentIdx = CORP_STAGES.indexOf(currentStatus);

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
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Matter Stage</p>
      <div className="flex items-center gap-1 flex-wrap">
        {CORP_STAGES.map((stage, idx) => {
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
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40"
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

function IntakeBriefingPanel({ matterId }: { matterId: number }) {
  const { data: briefing, isLoading } = useIntakeBriefing(matterId);
  const generate = useGenerateIntakeBriefing();
  const [open, setOpen] = useState(false);

  if (isLoading) return null;

  if (!briefing) {
    return (
      <Card className="border-indigo-500/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-semibold text-foreground">Intake Briefing</span>
            </div>
            <button
              onClick={() => generate.mutate(matterId, { onSuccess: () => setOpen(true) })}
              disabled={generate.isPending}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
            >
              {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generate.isPending ? "Generating…" : "Generate Intake Briefing"}
            </button>
          </div>
          {generate.isPending && (
            <p className="text-xs text-muted-foreground/60 mt-2">Analysing matter details — this may take a moment…</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-indigo-500/20">
      <CardContent className="p-5">
        <button className="flex items-center justify-between w-full text-left" onClick={() => setOpen((o) => !o)}>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-semibold text-foreground">Intake Briefing</span>
            <span className="text-[10px] text-muted-foreground/60 ml-1">— opening snapshot</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="mt-4 space-y-4">
            {(briefing.parties.client || briefing.parties.opponent || briefing.parties.counsel || briefing.parties.others.length > 0) && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Parties</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {briefing.parties.client && <div><span className="text-muted-foreground text-xs">Client: </span>{briefing.parties.client}</div>}
                  {briefing.parties.opponent && <div><span className="text-muted-foreground text-xs">Opponent: </span>{briefing.parties.opponent}</div>}
                  {briefing.parties.counsel && <div><span className="text-muted-foreground text-xs">Counsel: </span>{briefing.parties.counsel}</div>}
                  {briefing.parties.others.map((o, i) => <div key={i}><span className="text-muted-foreground text-xs">Other: </span>{o}</div>)}
                </div>
              </div>
            )}
            {briefing.keyFacts.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Key Facts</p>
                <ul className="space-y-1">
                  {briefing.keyFacts.map((f, i) => (
                    <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {briefing.legalIssues.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Legal Issues</p>
                <ul className="space-y-1">
                  {briefing.legalIssues.map((issue, i) => (
                    <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                      <Scale className="h-3.5 w-3.5 text-indigo-400 mt-0.5 shrink-0" />{issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {briefing.initialActions.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Suggested Initial Actions</p>
                <div className="space-y-2">
                  {briefing.initialActions.map((a, i) => {
                    const dot = a.priority === "high" ? "bg-red-400" : a.priority === "medium" ? "bg-amber-400" : "bg-emerald-400";
                    return (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dot}`} />
                        <p className="text-sm text-foreground">{a.action}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/60 pt-1">
              Read-only intake snapshot · generated {new Date(briefing.generatedAt).toLocaleDateString('en-GB')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
function AiInsightsCard({ matterId }: { matterId: number }) {
  const { data: insights, isLoading, isError, isFetching } = useAiInsights(matterId);
  const refresh = useRefreshAiInsights();
  const { toast } = useToast();

  const handleRefresh = async () => {
    try {
      await refresh.mutateAsync(matterId);
      toast({ title: "AI insights refreshed" });
    } catch {
      toast({ title: "Could not refresh insights", variant: "destructive" });
    }
  };

  const riskColor = (rating: string) => {
    if (rating === "High") return "text-red-400 bg-red-500/10 border-red-500/20";
    if (rating === "Medium") return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  };

  const priorityIcon = (p: string) => {
    if (p === "high") return <TrendingUp className="h-3.5 w-3.5 text-red-400 shrink-0" />;
    if (p === "medium") return <Minus className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
    return <TrendingDown className="h-3.5 w-3.5 text-emerald-400 shrink-0" />;
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
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">AI insights unavailable</span>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRefresh} disabled={refresh.isPending}>
            {refresh.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary + risk */}
      <Card className="border-primary/20 bg-primary/3">
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
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleRefresh} disabled={refresh.isPending} title="Regenerate briefing">
                {refresh.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              </Button>
            </div>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{insights.caseSummary}</p>
        </CardContent>
      </Card>

      {/* Next steps */}
      {insights.nextSteps.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recommended Next Steps</p>
            <div className="space-y-2.5">
              {insights.nextSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  {priorityIcon(step.priority)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{step.action}</p>
                    {step.suggestedDeadline && (
                      <p className="text-xs text-muted-foreground mt-0.5">⏱ {step.suggestedDeadline}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk details */}
      {(insights.riskAssessment.keyStrengths.length > 0 || insights.riskAssessment.keyWeaknesses.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {insights.riskAssessment.keyStrengths.length > 0 && (
            <Card className="border-emerald-500/20">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Strengths</p>
                <ul className="space-y-1">
                  {insights.riskAssessment.keyStrengths.map((s, i) => (
                    <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" /> {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {insights.riskAssessment.keyWeaknesses.length > 0 && (
            <Card className="border-red-500/20">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Areas of Concern</p>
                <ul className="space-y-1">
                  {insights.riskAssessment.keyWeaknesses.map((w, i) => (
                    <li key={i} className="text-xs text-foreground/80 flex gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" /> {w}
                    </li>
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

// ── AI Case Review ────────────────────────────────────────────────────────────
function AiCaseReviewCard({ matterId }: { matterId: number }) {
  const review = useMatterReview();
  const { toast } = useToast();
  const [markdown, setMarkdown] = useState<string | null>(null);

  const run = async () => {
    setMarkdown(null);
    try {
      const res = await review.mutateAsync(matterId);
      setMarkdown(res.review);
    } catch (e) {
      toast({
        title: "AI review failed",
        description: e instanceof ApiError ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">AI Case Review</span>
          </div>
          <Button size="sm" onClick={run} disabled={review.isPending} className="gap-2">
            {review.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {review.isPending ? "Reviewing…" : markdown ? "Re-run review" : "Run AI review"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          A deeper AI assessment of this matter with a prioritised list of next actions, drawn from the
          assembled case context. Always verify against the file before relying on it.
        </p>
        {review.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Analysing the matter — this can take up to a minute…
          </div>
        )}
        {markdown && !review.isPending && (
          <pre className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed font-sans max-h-[500px] overflow-y-auto bg-background border border-border rounded-md p-4">
            {markdown}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

// ── Chronology Tab ────────────────────────────────────────────────────────────
function ChronologyTab({ matterId }: { matterId: number }) {
  const { data: events, isLoading } = useCaseEvents(matterId);
  const add = useAddCaseEvent();
  const upd = useUpdateCaseEvent();
  const del = useDeleteCaseEvent();
  const { toast } = useToast();

  const [form, setForm] = useState({ title: "", event_date: "", kind: "note", description: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: "", event_date: "", kind: "note", description: "" });

  const sorted = [...(events ?? [])].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
  );

  const submit = async () => {
    if (!form.title.trim() || !form.event_date) {
      toast({ title: "Title and date required", variant: "destructive" });
      return;
    }
    try {
      await add.mutateAsync({
        matterId,
        title: form.title.trim(),
        event_date: form.event_date,
        kind: form.kind,
        description: form.description.trim() || undefined,
      });
      setForm({ title: "", event_date: "", kind: "note", description: "" });
      toast({ title: "Event added" });
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : "Could not add event", variant: "destructive" });
    }
  };

  const startEdit = (ev: CaseEvent) => {
    setEditId(ev.id);
    setEditForm({
      title: ev.title,
      event_date: ev.event_date.slice(0, 10),
      kind: ev.kind,
      description: ev.description ?? "",
    });
  };

  const saveEdit = async () => {
    if (editId == null) return;
    if (!editForm.title.trim() || !editForm.event_date) {
      toast({ title: "Title and date required", variant: "destructive" });
      return;
    }
    try {
      await upd.mutateAsync({
        matterId,
        eventId: editId,
        title: editForm.title.trim(),
        event_date: editForm.event_date,
        kind: editForm.kind,
        description: editForm.description.trim() || undefined,
      });
      setEditId(null);
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : "Could not save event", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Add form */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Add chronology event</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))} className={inputCls}>
                {CASE_EVENT_KINDS.map((k) => <option key={k} value={k}>{eventKindMeta(k).label}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Board resolution passed" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          </div>
          <Button onClick={submit} disabled={add.isPending} className="gap-1.5">
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add event
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="p-8 text-center text-primary animate-pulse">Loading chronology…</div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <History className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No chronology events yet. Record key milestones above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-3">
            {sorted.map((ev) => {
              const meta = eventKindMeta(ev.kind);
              const editing = editId === ev.id;
              return (
                <div key={ev.id} className="relative flex items-start gap-3">
                  <div className="absolute -left-[3px] mt-2 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
                  <Card className="flex-1 ml-3">
                    <CardContent className="p-3">
                      {editing ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Input type="date" value={editForm.event_date} onChange={(e) => setEditForm((f) => ({ ...f, event_date: e.target.value }))} />
                            <select value={editForm.kind} onChange={(e) => setEditForm((f) => ({ ...f, kind: e.target.value }))} className={inputCls}>
                              {CASE_EVENT_KINDS.map((k) => <option key={k} value={k}>{eventKindMeta(k).label}</option>)}
                            </select>
                          </div>
                          <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
                          <Textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>Cancel</Button>
                            <Button size="sm" onClick={saveEdit} disabled={upd.isPending} className="gap-1.5">
                              {upd.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${meta.color}`}>{meta.label}</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDate(ev.event_date)}</span>
                            </div>
                            <p className="text-sm font-medium text-foreground mt-1">{ev.title}</p>
                            {ev.description && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{ev.description}</p>}
                            {ev.source && <p className="text-[11px] text-muted-foreground mt-0.5">Source: {ev.source}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => startEdit(ev)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => del.mutateAsync({ matterId, eventId: ev.id })} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Linked Clients ────────────────────────────────────────────────────────────
function LinkedClientsSection({ matterId }: { matterId: number }) {
  const { data: linked, isLoading } = useMatterClients(matterId);
  const { data: directory } = useClients();
  const create = useCreateClient();
  const link = useLinkClient();
  const unlink = useUnlinkClient();
  const { toast } = useToast();

  const [showLink, setShowLink] = useState(false);
  const [selectId, setSelectId] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [nf, setNf] = useState({ name: "", phone: "", email: "" });

  const linkedIds = new Set((linked ?? []).map((c) => c.id));
  const available = (directory ?? []).filter((c) => !linkedIds.has(c.id));

  const doLink = async () => {
    const id = parseInt(selectId, 10);
    if (Number.isNaN(id)) return;
    try {
      await link.mutateAsync({ clientId: id, matterId });
      setSelectId("");
      setShowLink(false);
      toast({ title: "Client linked" });
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : "Could not link client", variant: "destructive" });
    }
  };

  const doCreateAndLink = async () => {
    if (!nf.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    try {
      const client: CaseClient = await create.mutateAsync({
        name: nf.name.trim(),
        phone: nf.phone.trim() || undefined,
        email: nf.email.trim() || undefined,
      });
      await link.mutateAsync({ clientId: client.id, matterId });
      setNf({ name: "", phone: "", email: "" });
      setShowNew(false);
      setShowLink(false);
      toast({ title: "Client created and linked" });
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : "Could not create client", variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Link2 className="h-4 w-4 text-primary" /> Linked Clients</h3>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setShowLink((v) => !v); setShowNew(false); }}>
          <Plus className="h-3.5 w-3.5" /> Link client
        </Button>
      </div>

      {showLink && (
        <Card className="mb-3">
          <CardContent className="p-4 space-y-3">
            {available.length > 0 && (
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  <Label>Existing client</Label>
                  <select value={selectId} onChange={(e) => setSelectId(e.target.value)} className={inputCls}>
                    <option value="">Choose a client…</option>
                    {available.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company_name ? ` — ${c.company_name}` : ""}</option>)}
                  </select>
                </div>
                <Button size="sm" onClick={doLink} disabled={!selectId || link.isPending} className="gap-1.5">
                  {link.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Link
                </Button>
              </div>
            )}
            {!showNew ? (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setShowNew(true)}>
                <Plus className="h-3.5 w-3.5" /> Create new client
              </Button>
            ) : (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1.5"><Label>Name *</Label><Input value={nf.name} onChange={(e) => setNf((f) => ({ ...f, name: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Phone</Label><Input value={nf.phone} onChange={(e) => setNf((f) => ({ ...f, phone: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Email</Label><Input value={nf.email} onChange={(e) => setNf((f) => ({ ...f, email: e.target.value }))} /></div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
                  <Button size="sm" onClick={doCreateAndLink} disabled={create.isPending || link.isPending} className="gap-1.5">
                    {(create.isPending || link.isPending) && <Loader2 className="h-4 w-4 animate-spin" />} Create &amp; link
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="p-4 text-center text-muted-foreground animate-pulse text-sm">Loading…</div>
      ) : (linked ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No client linked to this matter yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(linked ?? []).map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground">{c.name}</p>
                  {c.company_name && <p className="text-xs text-muted-foreground">{c.company_name}</p>}
                  <div className="mt-1.5 space-y-0.5">
                    {c.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</p>}
                    {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</p>}
                  </div>
                </div>
                <button onClick={() => unlink.mutateAsync({ clientId: c.id, matterId })} disabled={unlink.isPending} title="Unlink" className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Checklist Tab ─────────────────────────────────────────────────────────────
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
    catch (e) { toast({ title: "Could not update", variant: "destructive" }); }
  };

  const addNew = async () => {
    if (!newText.trim()) return;
    try {
      await addItem.mutateAsync({ matterId, text: newText.trim() });
      setNewText("");
    } catch (e) {
      toast({ title: "Could not add item", variant: "destructive" });
    }
  };

  const remove = async (item: ChecklistItem) => {
    try { await deleteItem.mutateAsync({ matterId, itemId: item.id }); }
    catch (e) { toast({ title: "Could not delete", variant: "destructive" }); }
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
        <Card>
          <CardContent className="p-8 text-center">
            <ListChecks className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No checklist yet. AI will generate one automatically, or add items below.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {[...(items ?? [])].sort((a, b) => a.position - b.position).map((item) => (
            <Card key={item.id} className={`transition-all ${item.done ? "opacity-60" : ""}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <button
                  onClick={() => toggle(item)}
                  className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                    item.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-border hover:border-primary"
                  }`}
                >
                  {item.done && <Check className="h-3 w-3" />}
                </button>
                <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.text}</span>
                <button onClick={() => remove(item)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Add a custom checklist item…" onKeyDown={(e) => e.key === "Enter" && addNew()} />
        <Button onClick={addNew} disabled={addItem.isPending} className="gap-1.5 shrink-0"><Plus className="h-4 w-4" /> Add</Button>
      </div>
    </div>
  );
}

// ── Team Tab ──────────────────────────────────────────────────────────────────
function TeamTab({ matter }: { matter: { id: number; clientName: string | null; counterparty: string | null } }) {
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
      toast({ title: "Client added" });
      setAddOpen(false);
      setForm({ name: "", company_name: "", email: "", phone: "", notes: "" });
    } catch (e) {
      toast({ title: "Could not add client", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Linked client records */}
      <LinkedClientsSection matterId={matter.id} />

      {/* Matter parties */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {matter.clientName && (
          <Card className="border-primary/20">
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Client</p>
              <p className="font-semibold text-foreground">{matter.clientName}</p>
            </CardContent>
          </Card>
        )}
        {matter.counterparty && (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Counterparty</p>
              <p className="font-semibold text-foreground">{matter.counterparty}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Client contacts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Contact Directory</h3>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add contact
          </Button>
        </div>
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground animate-pulse text-sm">Loading…</div>
        ) : (clients ?? []).length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <User className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No contacts yet. Add client contacts for quick reference.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(clients ?? []).map((c) => (
              <Card key={c.id}>
                <CardContent className="p-4 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{c.name}</p>
                    {c.company_name && <p className="text-xs text-muted-foreground">{c.company_name}</p>}
                    <div className="mt-1.5 space-y-0.5">
                      {c.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</p>}
                      {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</p>}
                    </div>
                  </div>
                  <button onClick={() => deleteClient.mutateAsync(c.id)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-serif">Add Contact</DialogTitle></DialogHeader>
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

// ── Time Tab ──────────────────────────────────────────────────────────────────
function TimeTab({ matterId }: { matterId: number }) {
  const { data: timeData, isLoading } = useTimeEntries(matterId);
  const logTime = useLogTime();
  const deleteEntry = useDeleteTimeEntry();
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ description: "", minutes: "", entry_date: today });

  const submit = async () => {
    if (!form.description.trim() || !form.minutes || !form.entry_date) {
      toast({ title: "Description, time and date required", variant: "destructive" }); return;
    }
    const mins = parseInt(form.minutes, 10);
    if (Number.isNaN(mins) || mins <= 0) { toast({ title: "Enter valid minutes", variant: "destructive" }); return; }
    try {
      await logTime.mutateAsync({ matterId, description: form.description.trim(), minutes: mins, entry_date: form.entry_date });
      toast({ title: "Time logged" });
      setForm({ description: "", minutes: "", entry_date: today });
    } catch (e) {
      toast({ title: "Could not log time", variant: "destructive" });
    }
  };

  const totalH = Math.floor((timeData?.totalMinutes ?? 0) / 60);
  const totalM = (timeData?.totalMinutes ?? 0) % 60;

  return (
    <div className="space-y-4">
      {/* Total */}
      <Card className="border-primary/20">
        <CardContent className="p-4 flex items-center gap-4">
          <Timer className="h-5 w-5 text-primary" />
          <div>
            <p className="text-2xl font-bold text-foreground">{totalH}h {totalM}m</p>
            <p className="text-xs text-muted-foreground">Total time recorded</p>
          </div>
        </CardContent>
      </Card>

      {/* Log form */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Log Time</p>
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Review SPA, advise on warranties" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Minutes *</Label>
              <Input type="number" min="1" value={form.minutes} onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))} placeholder="e.g. 90" />
            </div>
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={form.entry_date} onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))} />
            </div>
          </div>
          <Button onClick={submit} disabled={logTime.isPending} className="gap-1.5">
            <Plus className="h-4 w-4" /> {logTime.isPending ? "Logging…" : "Log time"}
          </Button>
        </CardContent>
      </Card>

      {/* Entries */}
      {isLoading ? (
        <div className="p-4 text-center text-muted-foreground animate-pulse text-sm">Loading…</div>
      ) : (timeData?.entries ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No time entries yet.</p>
          </CardContent>
        </Card>
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
                <button onClick={() => deleteEntry.mutateAsync({ matterId, entryId: entry.id })} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function MatterDetailPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id, 10) : null;
  const { data: matter, isLoading } = useMatter(id);
  const { toast } = useToast();

  const updateMatter = useUpdateMatter();
  const deleteMatter = useDeleteMatter();
  const addDeadline = useAddDeadline();
  const updateDeadline = useUpdateDeadline();
  const deleteDeadline = useDeleteDeadline();
  const { data: matterWork } = useMatterWork(id);

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<MatterInput>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dForm, setDForm] = useState({ title: "", dueDate: "", category: "custom", basis: "", notes: "" });
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) setLocation("/login");
  }, [setLocation]);

  if (isLoading) return <AppLayout><div className="p-8 text-center text-primary animate-pulse">Loading matter…</div></AppLayout>;
  if (!matter) {
    return (
      <AppLayout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground mb-4">This matter could not be found.</p>
          <Button asChild variant="outline" className="gap-2"><Link href="/matters"><ArrowLeft className="h-4 w-4" /> Back to matters</Link></Button>
        </div>
      </AppLayout>
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
      setLocation("/matters");
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
      setDForm({ title: "", dueDate: "", category: "custom", basis: "", notes: "" });
    } catch (e) {
      toast({ title: "Could not add deadline", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const toggleDone = async (d: MatterDeadline) => {
    try { await updateDeadline.mutateAsync({ matterId: matter.id, id: d.id, status: d.status === "done" ? "pending" : "done" }); }
    catch (e) { toast({ title: "Could not update", variant: "destructive" }); }
  };

  const copyDoc = (w: MatterWorkItem) => { navigator.clipboard.writeText(w.content); toast({ title: "Copied to clipboard" }); };
  const downloadDoc = (w: MatterWorkItem) => {
    const blob = new Blob([w.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${w.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deadlines = matter.deadlines ?? [];
  const pending = deadlines.filter((d) => d.status !== "done");
  const done = deadlines.filter((d) => d.status === "done");

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <Link href="/matters" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" /> All matters
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap border-b border-purple-500/15 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {matter.reference && <span className="text-xs font-mono text-muted-foreground">{matter.reference}</span>}
              {matter.matterType && <Badge variant="outline" className="text-xs">{matter.matterType}</Badge>}
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground">{matter.title}</h1>
            {matter.clientName && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> {matter.clientName}
                {matter.counterparty && <><span className="mx-1">·</span><Users className="h-3.5 w-3.5" /> {matter.counterparty}</>}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={openEdit}><Pencil className="h-4 w-4" /> Edit</Button>
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Case Home Panel */}
        <CaseHomePanel
          matterId={matter.id}
          request={caseHomeRequest}
          accent="#8b5cf6"
          className="mb-2"
          action={{
            href: `/tools/legal-opinion?matterId=${matter.id}${matter.clientName ? `&client=${encodeURIComponent(matter.clientName)}` : ""}${matter.reference ? `&ref=${encodeURIComponent(matter.reference)}` : ""}${matter.title ? `&matterTitle=${encodeURIComponent(matter.title)}` : ""}`,
            label: "Continue in Case Home",
          }}
        />

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
                <span className="ml-1 text-[10px] bg-amber-500/15 text-amber-400 rounded-full px-1.5">{pending.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <StageStepper matterId={matter.id} currentStatus={matter.status} />
            {matter.notes && (
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Notes</p>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{matter.notes}</p>
                </CardContent>
              </Card>
            )}
            {/* AI tool quick launch */}
            <Card className="border-primary/20 bg-primary/3">
              <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-sm text-foreground">Draft for this matter</p>
                  <p className="text-xs text-muted-foreground">Launch AI tools pre-filled with this matter's context</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <Link href={`/tools/legal-opinion?matter=${matter.id}&client=${encodeURIComponent(matter.clientName ?? "")}&ref=${encodeURIComponent(matter.reference ?? "")}`}><FileText className="h-3.5 w-3.5" /> Legal Opinion</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <Link href={`/tools/dd-report?matter=${matter.id}&ref=${encodeURIComponent(matter.reference ?? "")}`}><ArrowRight className="h-3.5 w-3.5" /> DD Report</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <IntakeBriefingPanel matterId={matter.id} />
            <AiInsightsCard matterId={matter.id} />
            <AiCaseReviewCard matterId={matter.id} />
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
              <Button className="gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add deadline</Button>
            </div>
            {deadlines.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <CalendarClock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="font-serif font-semibold text-foreground mb-1">No deadlines yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">Add key dates for this matter.</p>
                  <Button className="gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add a deadline</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-3">
                  {[...pending, ...done].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map((d) => {
                    const cat = categoryMeta(d.category);
                    const isDone = d.status === "done";
                    return (
                      <div key={d.id} className={`relative flex items-start gap-3 ${isDone ? "opacity-60" : ""}`}>
                        <button
                          onClick={() => toggleDone(d)}
                          className={`absolute -left-2.5 mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all bg-background ${
                            isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-border hover:border-primary"
                          }`}
                        >
                          {isDone && <Check className="h-3 w-3" />}
                        </button>
                        <Card className="flex-1">
                          <CardContent className="p-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{d.title}</span>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cat.color}`}>{cat.label}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <Clock className="h-3 w-3" /> {fmtDate(d.dueDate)}
                                {d.basis && <span className="truncate">· {d.basis}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <CountdownBadge due={d.dueDate} status={d.status} />
                              <button onClick={() => deleteDeadline.mutateAsync({ matterId: matter.id, id: d.id })} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
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
              <h2 className="font-serif font-bold text-lg text-foreground">Filed Documents</h2>
              {(matterWork?.length ?? 0) > 0 && <Badge variant="outline">{matterWork!.length}</Badge>}
            </div>
            {(matterWork?.length ?? 0) === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No documents filed yet. Drafts from AI tools can be saved into this matter.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {matterWork!.map((w) => {
                  const isOpen = expanded === w.id;
                  return (
                    <Card key={w.id}>
                      <CardContent className="p-0">
                        <button onClick={() => setExpanded(isOpen ? null : w.id)} className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/5 transition-colors">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-foreground truncate">{w.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Updated {fmtDate(w.updatedAt)}</p>
                          </div>
                          <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                        {isOpen && (
                          <div className="border-t border-border p-4 space-y-3">
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyDoc(w)}><Copy className="h-3.5 w-3.5" /> Copy</Button>
                              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => downloadDoc(w)}><Download className="h-3.5 w-3.5" /> Download .txt</Button>
                            </div>
                            <pre className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed font-sans max-h-[400px] overflow-y-auto bg-background border border-border rounded-md p-3">{w.content}</pre>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "vault" && (
          <DocumentsPanel request={vaultRequest} matterId={matter.id} accent="#d4a017" />
        )}

        {activeTab === "checklist" && <ChecklistTab matterId={matter.id} />}
        {activeTab === "team" && <TeamTab matter={matter} />}
        {activeTab === "time" && <TimeTab matterId={matter.id} />}
        {activeTab === "billing" && (
          <BillingTab
            request={billingRequest}
            matterId={matter.id}
            currency="RM"
            accent="#d4a017"
            defaultClientName={matter.clientName ?? undefined}
          />
        )}

        {activeTab === "letters" && (
          <DraftsPanel
            request={lettersRequest}
            matterId={matter.id}
            accent="#d4a017"
            showLetterWriter
            matterTitle={matter.title || ""}
            clientName={matter.clientName || ""}
          />
        )}
      </div>

      {/* Edit matter */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Edit Matter</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Matter title *</Label><Input value={editForm.title ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Client</Label><Input value={editForm.clientName ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, clientName: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Counterparty</Label><Input value={editForm.counterparty ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, counterparty: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Matter type</Label><Input value={editForm.matterType ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, matterType: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Reference</Label><Input value={editForm.reference ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, reference: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={editForm.notes ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={3} /></div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateMatter.isPending}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-serif">Delete this matter?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This permanently deletes <span className="text-foreground font-medium">"{matter.title}"</span> and all its data. Cannot be undone.</p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={doDelete} disabled={deleteMatter.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add deadline */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Add Deadline</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Title *</Label><Input value={dForm.title} onChange={(e) => setDForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. File annual return" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Due date *</Label><Input type="date" value={dForm.dueDate} onChange={(e) => setDForm((f) => ({ ...f, dueDate: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select value={dForm.category} onChange={(e) => setDForm((f) => ({ ...f, category: e.target.value }))} className={inputCls}>
                  {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{categoryMeta(c).label}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Basis</Label><Input value={dForm.basis} onChange={(e) => setDForm((f) => ({ ...f, basis: e.target.value }))} placeholder="e.g. s.68 Companies Act 2016" /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={dForm.notes} onChange={(e) => setDForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submitAdd} disabled={addDeadline.isPending}>Add deadline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
