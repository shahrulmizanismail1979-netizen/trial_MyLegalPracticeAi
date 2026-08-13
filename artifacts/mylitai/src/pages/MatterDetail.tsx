import { useState, useRef, type ReactNode } from 'react';
import { Link, useRoute } from 'wouter';
import {
  useMatter,
  useUpdateMatter,
  useDeleteMatter,
  useDeadlineTriggers,
  useComputeDeadlines,
  useAddDeadline,
  useAddDeadlinesBulk,
  useUpdateDeadline,
  useDeleteDeadline,
  categoryMeta,
  daysUntil,
  ApiError,
  type MatterDeadline,
  type ComputedDeadline,
  useMatterWork,
  type MatterWorkItem,
  type MatterInput,
  useAIInsights,
  useRefreshInsights,
  AI_BRIEFING_POLL_TIMEOUT_MS,
  useIntakeBriefing,
  useChecklist,
  useAddChecklistItem,
  useToggleChecklistItem,
  useDeleteChecklistItem,
  useStageHistory,
  useAdvanceStage,
  useTimeEntries,
  useAddTimeEntry,
  useDeleteTimeEntry,
  useClients,
  useCreateClient,
  useUpdateClient,
  type MatterClient,
  useCaseEvents,
  useAddCaseEvent,
  useUpdateCaseEvent,
  useDeleteCaseEvent,
  useCaseReview,
  CASE_EVENT_KINDS,
  type CaseEvent,
} from '@/hooks/use-matters';
import { findMatter } from '@/data/practice-hub';
import { ExportButtons } from '@/components/ExportButtons';
import {
  PageHeader,
  Card,
  CardContent,
  Badge,
  Button,
  Modal,
  Input,
  Textarea,
  Label,
  Select,
} from '@/components/ui';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, CalendarClock, Plus, Pencil, Trash2, Check,
  Wand2, AlertTriangle, CircleCheck, Building2, Scale, Hash,
  Banknote, Clock, FileText, ArrowRight, GitBranch,
  Sparkles, RefreshCw, ShieldCheck, ShieldAlert, Shield,
  Users, Timer, Loader2, ChevronRight, CheckSquare,
  Phone, Mail, CreditCard, History, Calculator, FolderLock, FileSignature,
  ClipboardList, ChevronDown,
} from 'lucide-react';
import { BillingTab, type BillingRequest } from '@workspace/billing-ui';
import { DocumentsPanel, type VaultRequest } from '@workspace/vault-ui';
import { DraftsPanel, type LettersRequest } from '@workspace/letters-ui';
const billingRequest: BillingRequest = (path, init) =>
  fetch(`/api/lit/matters${path}`, { credentials: 'include', ...init });
const vaultRequest: VaultRequest = billingRequest;
const lettersRequest: LettersRequest = billingRequest;

// ── Constants ─────────────────────────────────────────────────────────────────

const LIT_STAGES = ['Pre-Trial', 'Trial', 'Judgment', 'Appeal', 'Closed'] as const;
type LitStage = typeof LIT_STAGES[number];

const STATUS_OPTIONS = ['active', 'on-hold', 'closed', ...LIT_STAGES];
const CATEGORY_OPTIONS = [
  'limitation', 'appearance', 'pleading', 'interlocutory',
  'hearing', 'enforcement', 'appeal', 'custom',
];

const RISK_META: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  Low: { label: 'Low Risk', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: ShieldCheck },
  Medium: { label: 'Medium Risk', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: Shield },
  High: { label: 'High Risk', color: 'text-red-400 bg-red-500/10 border-red-500/30', icon: ShieldAlert },
};

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMoney(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(n);
}

function minutesToHm(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? (min > 0 ? `${h}h ${min}m` : `${h}h`) : `${min}m`;
}

function CountdownBadge({ due, status }: { due: string; status: string }) {
  if (status === 'done') return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><CircleCheck className="h-3.5 w-3.5" /> Done</span>;
  const d = daysUntil(due);
  if (d < 0) return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> {Math.abs(d)}d overdue</span>;
  if (d === 0) return <span className="text-[11px] font-bold text-red-400">Due today</span>;
  if (d <= 7) return <span className="text-[11px] font-bold text-amber-400">in {d}d</span>;
  return <span className="text-[11px] font-medium text-muted-foreground">in {d}d</span>;
}

// ── Stage tracker ─────────────────────────────────────────────────────────────

function StageTracker({
  matterId,
  current,
  onAdvance,
}: {
  matterId: number;
  current: string;
  onAdvance: (stage: string) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const currentIdx = LIT_STAGES.indexOf(current as LitStage);
  const isStaged = currentIdx >= 0;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Case stage</span>
        {!isStaged && <Badge variant="outline" className="text-[10px] text-muted-foreground">Not yet staged</Badge>}
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {LIT_STAGES.map((stage, i) => {
          const done = isStaged && i < currentIdx;
          const active = isStaged && i === currentIdx;
          const isNext = isStaged ? i === currentIdx + 1 : i === 0;
          return (
            <div key={stage} className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => (active ? null : setConfirming(stage))}
                disabled={active}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : done
                    ? 'bg-primary/10 text-primary border-primary/30 line-through opacity-60'
                    : isNext
                    ? 'border-primary/40 text-primary hover:bg-primary/10 cursor-pointer'
                    : 'border-border text-muted-foreground hover:border-primary/30 cursor-pointer'
                }`}
              >
                {stage}
              </button>
              {i < LIT_STAGES.length - 1 && (
                <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${done ? 'text-primary/40' : 'text-border'}`} />
              )}
            </div>
          );
        })}
      </div>

      {confirming && (
        <div className="mt-3 p-3 bg-secondary/60 rounded-lg border border-border flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-foreground">
            Set stage to <span className="font-semibold text-primary">{confirming}</span>?
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>Cancel</Button>
            <Button size="sm" onClick={() => { onAdvance(confirming); setConfirming(null); }}>Confirm</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function IntakeBriefingPanel({ matterId }: { matterId: number }) {
  const { data: briefing } = useIntakeBriefing(matterId);
  const [open, setOpen] = useState(false);
  if (!briefing) return null;
  return (
    <Card className="border-indigo-500/20">
      <CardContent className="p-5">
        <button className="flex items-center justify-between w-full text-left" onClick={() => setOpen((o) => !o)}>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-semibold text-foreground">Intake Briefing</span>
            <span className="text-[10px] text-muted-foreground/60 ml-1">— opening snapshot</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
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
                    const dot = a.priority === 'high' ? 'bg-red-400' : a.priority === 'medium' ? 'bg-amber-400' : 'bg-emerald-400';
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
              Read-only intake snapshot · generated {new Date(briefing.generatedAt).toLocaleDateString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
function AIInsightsPanel({ matterId }: { matterId: number }) {
  const mountedAt = useRef(Date.now());
  const { data: insights, isLoading, error } = useAIInsights(matterId);
  const refresh = useRefreshInsights();
  const { toast } = useToast();

  function handleRefresh() {
    refresh.mutate(matterId, {
      onSuccess: () => toast({ title: 'AI insights refreshed' }),
      onError: (e) =>
        toast({
          title: 'Could not refresh insights',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        }),
    });
  }

  // While waiting for a background job that hasn't finished yet, show a
  // "generating" state instead of the error/empty state. We poll the endpoint
  // automatically (see useAIInsights) and flip to this banner until data
  // arrives or the 3-minute timeout elapses.
  const withinPollWindow = Date.now() - mountedAt.current < AI_BRIEFING_POLL_TIMEOUT_MS;
  const isGenerating = isLoading || (!insights && withinPollWindow);

  if (isGenerating) {
    return (
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-primary mb-3">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-semibold">AI Case Insights</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating AI briefing from your uploaded documents…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !insights) {
    return (
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-primary mb-3">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-semibold">AI Case Insights</span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">Could not load insights. Click below to try again.</p>
          <Button size="sm" variant="outline" className="gap-2" onClick={handleRefresh} disabled={refresh.isPending}>
            <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} /> Generate insights
          </Button>
        </CardContent>
      </Card>
    );
  }

  const risk = RISK_META[insights.riskAssessment.rating] ?? RISK_META.Medium;
  const RiskIcon = risk.icon;

  return (
    <Card className="mb-6 border-primary/20">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">AI Case Insights</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${risk.color}`}>
              <RiskIcon className="h-3.5 w-3.5" /> {risk.label}
            </span>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={handleRefresh} disabled={refresh.isPending} title="Refresh insights">
              <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Case Summary</p>
          <p className="text-sm text-foreground/90 leading-relaxed">{insights.caseSummary}</p>
        </div>

        {/* Next steps */}
        {insights.nextSteps.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Recommended Next Steps</p>
            <div className="space-y-2">
              {insights.nextSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[step.priority] ?? PRIORITY_DOT.medium}`} />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{step.action}</p>
                    {step.suggestedDeadline && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" /> {step.suggestedDeadline}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Strengths / Weaknesses */}
        {(insights.riskAssessment.keyStrengths.length > 0 || insights.riskAssessment.keyWeaknesses.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/50">
            {insights.riskAssessment.keyStrengths.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-400 mb-1.5">Key Strengths</p>
                <ul className="space-y-1">
                  {insights.riskAssessment.keyStrengths.map((s, i) => (
                    <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                      <Check className="h-3 w-3 text-emerald-400 mt-0.5 shrink-0" /> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {insights.riskAssessment.keyWeaknesses.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-400 mb-1.5">Points of Concern</p>
                <ul className="space-y-1">
                  {insights.riskAssessment.keyWeaknesses.map((w, i) => (
                    <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-amber-400 mt-0.5 shrink-0" /> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/60">
          AI-generated analysis · cached {fmtDate(insights.cachedAt)} · not a substitute for professional judgment
        </p>
      </CardContent>
    </Card>
  );
}

// ── Chronology (case events) ───────────────────────────────────────────────────

const EVENT_KIND_META: Record<string, { label: string; color: string }> = {
  filing: { label: 'Filing', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  hearing: { label: 'Hearing', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  correspondence: { label: 'Correspondence', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  instruction: { label: 'Instruction', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  deadline: { label: 'Deadline', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  stage: { label: 'Stage', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  'saved-work': { label: 'Saved work', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  note: { label: 'Note', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  payment: { label: 'Payment', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  meeting: { label: 'Meeting', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
};

function eventKindMeta(kind: string) {
  return EVENT_KIND_META[kind] ?? EVENT_KIND_META.note;
}

function ChronologyPanel({ matterId }: { matterId: number }) {
  const { data: events, isLoading } = useCaseEvents(matterId);
  const addEvent = useAddCaseEvent();
  const updateEvent = useUpdateCaseEvent();
  const deleteEvent = useDeleteCaseEvent();
  const { toast } = useToast();

  const blank = { title: '', event_date: '', kind: 'note', description: '' };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<CaseEvent | null>(null);
  const [editForm, setEditForm] = useState(blank);

  const sorted = [...(events ?? [])].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
  );

  const submitAdd = async () => {
    if (!form.title.trim() || !form.event_date) {
      toast({ title: 'Title and date required', variant: 'destructive' });
      return;
    }
    try {
      await addEvent.mutateAsync({
        matterId,
        title: form.title.trim(),
        event_date: form.event_date,
        kind: form.kind,
        description: form.description.trim() || undefined,
      });
      toast({ title: 'Event added to chronology' });
      setForm(blank);
    } catch (e) {
      toast({ title: 'Could not add event', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const openEdit = (ev: CaseEvent) => {
    setEditing(ev);
    setEditForm({
      title: ev.title,
      event_date: ev.event_date.slice(0, 10),
      kind: ev.kind,
      description: ev.description ?? '',
    });
  };

  const submitEdit = async () => {
    if (!editing || !editForm.title.trim() || !editForm.event_date) {
      toast({ title: 'Title and date required', variant: 'destructive' });
      return;
    }
    try {
      await updateEvent.mutateAsync({
        matterId,
        eventId: editing.id,
        title: editForm.title.trim(),
        event_date: editForm.event_date,
        kind: editForm.kind,
        description: editForm.description.trim() || undefined,
      });
      toast({ title: 'Event updated' });
      setEditing(null);
    } catch (e) {
      toast({ title: 'Could not update event', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const removeEvent = async (ev: CaseEvent) => {
    try {
      await deleteEvent.mutateAsync({ matterId, eventId: ev.id });
    } catch (e) {
      toast({ title: 'Could not delete event', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Add-event form */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Add to chronology</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Kind</Label>
              <Select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))} className="mt-1">
                {CASE_EVENT_KINDS.map(k => <option key={k} value={k}>{eventKindMeta(k).label}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Statement of Claim filed" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="mt-1" />
          </div>
          <Button size="sm" className="gap-2" onClick={submitAdd} disabled={addEvent.isPending}>
            {addEvent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add event
          </Button>
        </CardContent>
      </Card>

      {/* Timeline */}
      {isLoading ? (
        <div className="p-6 text-center text-sm text-muted-foreground animate-pulse">Loading chronology…</div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <History className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No chronology events yet. Add the first event above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border/50" />
          <div className="space-y-3 pl-10">
            {sorted.map(ev => {
              const meta = eventKindMeta(ev.kind);
              return (
                <div key={ev.id} className="relative">
                  <div className="absolute -left-6 top-3 h-3 w-3 rounded-full border-2 bg-primary border-primary" />
                  <Card>
                    <CardContent className="p-3 flex items-start gap-3">
                      <CalendarClock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{ev.title}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${meta.color}`}>{meta.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(ev.event_date)}</p>
                        {ev.description && <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap leading-relaxed">{ev.description}</p>}
                        {ev.source && <p className="text-[10px] text-muted-foreground/60 mt-1">Source: {ev.source}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEdit(ev)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => removeEvent(ev)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit event modal */}
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit event">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={editForm.event_date} onChange={e => setEditForm(f => ({ ...f, event_date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Kind</Label>
              <Select value={editForm.kind} onChange={e => setEditForm(f => ({ ...f, kind: e.target.value }))} className="mt-1">
                {CASE_EVENT_KINDS.map(k => <option key={k} value={k}>{eventKindMeta(k).label}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2} className="mt-1" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
            <Button className="flex-1" onClick={submitEdit} disabled={updateEvent.isPending}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── AI Case Review (on-demand markdown briefing) ────────────────────────────────

export function renderMarkdownLite(md: string) {
  // Lightweight markdown → JSX renderer (no new deps). Handles headings,
  // bold, bullets and paragraphs; falls back to whitespace-pre for anything else.
  const lines = md.split('\n');
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flushList = (key: number) => {
    if (list.length) {
      out.push(
        <ul key={`ul-${key}`} className="list-disc pl-5 space-y-1 my-2">
          {list.map((li, i) => <li key={i} className="text-sm text-foreground/90">{renderInline(li)}</li>)}
        </ul>,
      );
      list = [];
    }
  };
  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
        : <span key={i}>{p}</span>,
    );
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^#{1,6}\s+/.test(line)) {
      flushList(idx);
      const level = line.match(/^#+/)![0].length;
      const text = line.replace(/^#+\s+/, '');
      out.push(
        <p key={idx} className={`font-serif font-bold text-foreground ${level <= 2 ? 'text-base mt-4 mb-1.5' : 'text-sm mt-3 mb-1'}`}>
          {renderInline(text)}
        </p>,
      );
    } else if (/^[-*•]\s+/.test(line)) {
      list.push(line.replace(/^[-*•]\s+/, ''));
    } else if (line.trim() === '') {
      flushList(idx);
    } else {
      flushList(idx);
      out.push(<p key={idx} className="text-sm text-foreground/90 leading-relaxed my-1.5">{renderInline(line)}</p>);
    }
  });
  flushList(lines.length);
  return out;
}

function AICaseReviewPanel({ matterId }: { matterId: number }) {
  const review = useCaseReview();
  const { toast } = useToast();
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    setResult(null);
    try {
      const res = await review.mutateAsync(matterId);
      setResult(res.review);
    } catch (e) {
      toast({ title: 'Case review failed', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  return (
    <Card className="mb-6 border-primary/20">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">AI Case Review</span>
          </div>
          <Button size="sm" variant="outline" className="gap-2" onClick={run} disabled={review.isPending}>
            {review.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reviewing…</>
              : <><Wand2 className="h-3.5 w-3.5" /> {result ? 'Re-run review' : 'Run case review'}</>}
          </Button>
        </div>
        {!result && !review.isPending && (
          <p className="text-sm text-muted-foreground">
            Generate a grounded review of this matter — key position, risks, and prioritised next actions. Takes up to a minute.
          </p>
        )}
        {review.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin" /> Assembling context and generating review…
          </div>
        )}
        {result && (
          <div className="pt-1 border-t border-border/50">
            <div className="mt-3">{renderMarkdownLite(result)}</div>
            <p className="text-[10px] text-muted-foreground/60 mt-3">AI-generated · verify against the file before relying on it.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MatterDetail() {
  const [, params] = useRoute('/app/matters/:id');
  const id = params?.id ? parseInt(params.id, 10) : null;
  const { data: matter, isLoading } = useMatter(id);
  const { toast } = useToast();

  // Core matter mutations
  const updateMatter = useUpdateMatter();
  const deleteMatter = useDeleteMatter();

  // Deadline diary
  const { data: triggers } = useDeadlineTriggers();
  const compute = useComputeDeadlines();
  const addDeadline = useAddDeadline();
  const addBulk = useAddDeadlinesBulk();
  const updateDeadline = useUpdateDeadline();
  const deleteDeadline = useDeleteDeadline();

  // Intelligence
  const advanceStage = useAdvanceStage();
  const { data: checklist } = useChecklist(id);
  const addChecklistItem = useAddChecklistItem();
  const toggleItem = useToggleChecklistItem();
  const deleteItem = useDeleteChecklistItem();
  const { data: timeData } = useTimeEntries(id);
  const addTimeEntry = useAddTimeEntry();
  const deleteTimeEntry = useDeleteTimeEntry();
  const { data: clients } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  // Matter work
  const { data: matterWork } = useMatterWork(id);

  // Chronology
  const { data: events } = useCaseEvents(id);

  // ── State ──
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<MatterInput>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [dForm, setDForm] = useState({ title: '', dueDate: '', category: 'custom', basis: '', notes: '' });

  const [computeOpen, setComputeOpen] = useState(false);
  const [trigger, setTrigger] = useState('');
  const [triggerDate, setTriggerDate] = useState('');
  const [preview, setPreview] = useState<ComputedDeadline[]>([]);
  const [picked, setPicked] = useState<Record<number, boolean>>({});

  const [editingDeadline, setEditingDeadline] = useState<MatterDeadline | null>(null);
  const [edForm, setEdForm] = useState({ title: '', dueDate: '', category: 'custom', basis: '', notes: '' });

  const [viewDoc, setViewDoc] = useState<MatterWorkItem | null>(null);

  // Checklist state
  const [newItemText, setNewItemText] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Time recording state
  const [timeFormOpen, setTimeFormOpen] = useState(false);
  const [timeForm, setTimeForm] = useState({ description: '', hours: '', minutes: '', entry_date: '' });

  // Client state
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<MatterClient | null>(null);
  const [clientForm, setClientForm] = useState({ name: '', ic_or_company: '', phone: '', email: '', notes: '' });

  // ── Guards ──
  if (isLoading) return <div className="p-8 text-center text-primary animate-pulse">Loading matter…</div>;
  if (!matter) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">This matter could not be found.</p>
        <Link href="/app/matters"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back to matters</Button></Link>
      </div>
    );
  }

  const premiumToast = (action: string) =>
    toast({ title: 'Premium feature', description: `${action} needs an active subscription.`, variant: 'destructive' });

  // ── Matter edit handlers ──
  const openEdit = () => {
    setEditForm({
      title: matter.title, clientName: matter.clientName ?? '',
      actingFor: matter.actingFor ?? '', plaintiff: matter.plaintiff ?? '',
      defendant: matter.defendant ?? '', matterType: matter.matterType ?? '',
      court: matter.court ?? '', suitNo: matter.suitNo ?? '',
      claimAmount: matter.claimAmount ?? '', status: matter.status, notes: matter.notes ?? '',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.title?.trim()) { toast({ title: 'Title required', variant: 'destructive' }); return; }
    try {
      await updateMatter.mutateAsync({ id: matter.id, ...editForm });
      toast({ title: 'Matter updated' });
      setEditOpen(false);
    } catch (e) {
      toast({ title: 'Could not update', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const doDelete = async () => {
    try {
      await deleteMatter.mutateAsync(matter.id);
      toast({ title: 'Matter deleted' });
      window.history.back();
    } catch (e) {
      toast({ title: 'Could not delete', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  // ── Stage ──
  const handleAdvanceStage = async (stage: string) => {
    try {
      await advanceStage.mutateAsync({ matterId: matter.id, stage });
      toast({ title: `Stage set to ${stage}` });
    } catch (e) {
      toast({ title: 'Could not update stage', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  // ── Deadlines ──
  const submitAdd = async () => {
    if (!dForm.title.trim() || !dForm.dueDate) { toast({ title: 'Title and due date required', variant: 'destructive' }); return; }
    try {
      await addDeadline.mutateAsync({ matterId: matter.id, ...dForm });
      toast({ title: 'Deadline added' });
      setAddOpen(false);
      setDForm({ title: '', dueDate: '', category: 'custom', basis: '', notes: '' });
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) premiumToast('Adding deadlines');
      else toast({ title: 'Could not add deadline', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const runCompute = async () => {
    if (!trigger || !triggerDate) { toast({ title: 'Pick a trigger and its date', variant: 'destructive' }); return; }
    try {
      const rows = await compute.mutateAsync({ matterId: matter.id, trigger, triggerDate });
      setPreview(rows);
      setPicked(Object.fromEntries(rows.map((_, i) => [i, true])));
    } catch (e) {
      toast({ title: 'Could not compute', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const saveComputed = async () => {
    const chosen = preview.filter((_, i) => picked[i]);
    if (!chosen.length) { toast({ title: 'Select at least one deadline', variant: 'destructive' }); return; }
    try {
      await addBulk.mutateAsync({ matterId: matter.id, deadlines: chosen.map(c => ({ title: c.title, dueDate: c.dueDate, category: c.category, basis: c.basis, notes: c.notes })) });
      toast({ title: `${chosen.length} deadline(s) added to the diary` });
      setComputeOpen(false); setPreview([]); setTrigger(''); setTriggerDate('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) premiumToast('Adding deadlines');
      else toast({ title: 'Could not save', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const toggleDone = async (d: MatterDeadline) => {
    try { await updateDeadline.mutateAsync({ matterId: matter.id, id: d.id, status: d.status === 'done' ? 'pending' : 'done' }); }
    catch (e) { toast({ title: 'Could not update', description: e instanceof Error ? e.message : '', variant: 'destructive' }); }
  };

  const openEditDeadline = (d: MatterDeadline) => {
    setEditingDeadline(d);
    setEdForm({ title: d.title, dueDate: d.dueDate.slice(0, 10), category: d.category, basis: d.basis ?? '', notes: d.notes ?? '' });
  };

  const saveEditDeadline = async () => {
    if (!editingDeadline || !edForm.title.trim() || !edForm.dueDate) { toast({ title: 'Title and due date required', variant: 'destructive' }); return; }
    try {
      await updateDeadline.mutateAsync({ matterId: matter.id, id: editingDeadline.id, ...edForm });
      toast({ title: 'Deadline updated' }); setEditingDeadline(null);
    } catch (e) { toast({ title: 'Could not update', description: e instanceof Error ? e.message : '', variant: 'destructive' }); }
  };

  const removeDeadline = async (d: MatterDeadline) => {
    try { await deleteDeadline.mutateAsync({ matterId: matter.id, id: d.id }); }
    catch (e) { toast({ title: 'Could not delete', description: e instanceof Error ? e.message : '', variant: 'destructive' }); }
  };

  // ── Checklist handlers ──
  const submitNewItem = async () => {
    if (!newItemText.trim()) return;
    try {
      await addChecklistItem.mutateAsync({ matterId: matter.id, item_text: newItemText.trim() });
      setNewItemText(''); setAddingItem(false);
    } catch (e) { toast({ title: 'Could not add item', description: e instanceof Error ? e.message : '', variant: 'destructive' }); }
  };

  // ── Time handlers ──
  const submitTimeEntry = async () => {
    if (!timeForm.description.trim()) { toast({ title: 'Description required', variant: 'destructive' }); return; }
    const h = parseInt(timeForm.hours || '0', 10);
    const m = parseInt(timeForm.minutes || '0', 10);
    const totalMinutes = h * 60 + m;
    if (totalMinutes <= 0) { toast({ title: 'Enter at least 1 minute', variant: 'destructive' }); return; }
    try {
      await addTimeEntry.mutateAsync({
        matterId: matter.id,
        description: timeForm.description.trim(),
        minutes: totalMinutes,
        entry_date: timeForm.entry_date || undefined,
      });
      toast({ title: 'Time logged' });
      setTimeFormOpen(false);
      setTimeForm({ description: '', hours: '', minutes: '', entry_date: '' });
    } catch (e) { toast({ title: 'Could not log time', description: e instanceof Error ? e.message : '', variant: 'destructive' }); }
  };

  // ── Client handlers ──
  const matchedClient = clients?.find(c => c.name.toLowerCase() === (matter.clientName ?? '').toLowerCase());

  const openClientCreate = () => {
    setEditingClient(null);
    setClientForm({ name: matter.clientName ?? '', ic_or_company: '', phone: '', email: '', notes: '' });
    setClientFormOpen(true);
  };

  const openClientEdit = (c: MatterClient) => {
    setEditingClient(c);
    setClientForm({ name: c.name, ic_or_company: c.ic_or_company ?? '', phone: c.phone ?? '', email: c.email ?? '', notes: c.notes ?? '' });
    setClientFormOpen(true);
  };

  const saveClient = async () => {
    if (!clientForm.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    try {
      if (editingClient) {
        await updateClient.mutateAsync({ id: editingClient.id, ...clientForm });
        toast({ title: 'Client updated' });
      } else {
        await createClient.mutateAsync(clientForm);
        toast({ title: 'Client created' });
      }
      setClientFormOpen(false);
    } catch (e) { toast({ title: 'Could not save client', description: e instanceof Error ? e.message : '', variant: 'destructive' }); }
  };

  // ── Computed values ──
  const deadlines = matter.deadlines ?? [];
  const pending = deadlines.filter(d => d.status !== 'done');
  const done = deadlines.filter(d => d.status === 'done');
  const money = formatMoney(matter.claimAmount);
  const selectedTrigger = triggers?.find(t => t.trigger === trigger);
  const hubEntry = matter.matterType ? findMatter(matter.matterType) : null;

  const checklistItems = checklist ?? [];
  const doneItems = checklistItems.filter(i => i.done);
  const progressPct = checklistItems.length > 0 ? Math.round((doneItems.length / checklistItems.length) * 100) : 0;

  const totalMinutes = timeData?.totalMinutes ?? 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href="/app/matters">
        <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" /> All matters
        </button>
      </Link>

      <PageHeader
        title={matter.title}
        description={matter.matterType ? `${matter.matterType}${matter.court ? ` · ${matter.court}` : ''}` : undefined}
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={openEdit}><Pencil className="h-4 w-4" /> Edit</Button>
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        }
      />

      {/* Stage tracker */}
      <StageTracker
        matterId={matter.id}
        current={matter.status}
        onAdvance={handleAdvanceStage}
      />

      {/* Tabbed content */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Documents
            {(matterWork?.length ?? 0) > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{matterWork!.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1.5">
            <CheckSquare className="h-3.5 w-3.5" /> Checklist
            {checklistItems.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{doneItems.length}/{checklistItems.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Team</TabsTrigger>
          <TabsTrigger value="time" className="gap-1.5">
            <Timer className="h-3.5 w-3.5" /> Time
            {totalMinutes > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{minutesToHm(totalMinutes)}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5">
            <Calculator className="h-3.5 w-3.5" /> Billing
          </TabsTrigger>
          <TabsTrigger value="vault" className="gap-1.5">
            <FolderLock className="h-3.5 w-3.5" /> Vault
          </TabsTrigger>
          <TabsTrigger value="drafts" className="gap-1.5">
            <FileSignature className="h-3.5 w-3.5" /> Drafts & Letters
          </TabsTrigger>
          <TabsTrigger value="diary" className="gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> Diary
            {pending.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="chronology" className="gap-1.5">
            <History className="h-3.5 w-3.5" /> Chronology
            {(events?.length ?? 0) > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{events!.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview" className="space-y-4">
          {/* Key info */}
          {(matter.clientName || matter.plaintiff || matter.court || matter.suitNo || money) && (
            <Card className="mb-2">
              <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                {matter.clientName && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">Client:</span>
                    <span className="font-medium truncate">{matter.clientName}{matter.actingFor ? ` (for the ${matter.actingFor})` : ''}</span>
                  </div>
                )}
                {(matter.plaintiff || matter.defendant) && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Scale className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">Parties:</span>
                    <span className="font-medium truncate">{matter.plaintiff || '—'} v {matter.defendant || '—'}</span>
                  </div>
                )}
                {matter.court && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Scale className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">Court:</span>
                    <span className="font-medium truncate">{matter.court}</span>
                  </div>
                )}
                {matter.suitNo && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Hash className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">Suit no.:</span>
                    <span className="font-medium font-mono truncate">{matter.suitNo}</span>
                  </div>
                )}
                {money && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Banknote className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">Claim:</span>
                    <span className="font-medium">{money}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {matter.notes && (
            <Card className="mb-2">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Notes</p>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{matter.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Intake Briefing */}
          <IntakeBriefingPanel matterId={matter.id} />

          {/* AI Insights */}
          <AIInsightsPanel matterId={matter.id} />

          {/* AI Case Review (on-demand) */}
          <AICaseReviewPanel matterId={matter.id} />

          {/* Practice hub / draft link */}
          {hubEntry && (
            <Card className="border-primary/25 bg-primary/5">
              <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <GitBranch className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-serif font-semibold text-foreground">{hubEntry.matter.name} — workflow &amp; checklist</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Continue drafting: step-by-step workflow, cause papers, and checklist. Drafts filed straight into this matter.
                    </p>
                  </div>
                </div>
                <Link href={`/app/practice/${hubEntry.matter.id}?matter=${matter.id}`}>
                  <Button className="gap-2">Draft for this matter <ArrowRight className="h-4 w-4" /></Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── DOCUMENTS ── */}
        <TabsContent value="documents">
          {(matterWork?.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No documents filed yet.{hubEntry ? ' Use the "Draft for this matter" button in Overview.' : ' Generate drafts from the AI tools and file them into this matter.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {matterWork!.map(w => (
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
        </TabsContent>

        {/* ── CHECKLIST ── */}
        <TabsContent value="checklist">
          {checklistItems.length > 0 && (
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-foreground">{doneItems.length} of {checklistItems.length} steps done</span>
                  <span className="text-xs text-muted-foreground">{progressPct}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2 mb-4">
            {checklistItems.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    AI is generating a procedural checklist for this matter. Reload in a moment, or add steps manually below.
                  </p>
                </CardContent>
              </Card>
            )}
            {checklistItems.map(item => (
              <Card key={item.id} className={`transition-all ${item.done ? 'opacity-60' : ''}`}>
                <CardContent className="p-3 flex items-center gap-3">
                  <button
                    onClick={() => toggleItem.mutate({ matterId: matter.id, itemId: item.id, done: !item.done })}
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                      item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:border-primary'
                    }`}
                  >
                    {item.done && <Check className="h-3 w-3" />}
                  </button>
                  <span className={`flex-1 text-sm ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {item.item_text}
                  </span>
                  <button
                    onClick={() => deleteItem.mutate({ matterId: matter.id, itemId: item.id })}
                    className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>

          {addingItem ? (
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <Input
                  value={newItemText}
                  onChange={e => setNewItemText(e.target.value)}
                  placeholder="Describe the step…"
                  className="flex-1"
                  onKeyDown={e => { if (e.key === 'Enter') submitNewItem(); if (e.key === 'Escape') setAddingItem(false); }}
                  autoFocus
                />
                <Button size="sm" onClick={submitNewItem} disabled={addChecklistItem.isPending || !newItemText.trim()}>Add</Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingItem(false); setNewItemText(''); }}>Cancel</Button>
              </CardContent>
            </Card>
          ) : (
            <Button variant="outline" className="gap-2" onClick={() => setAddingItem(true)}>
              <Plus className="h-4 w-4" /> Add step
            </Button>
          )}
        </TabsContent>

        {/* ── TEAM ── */}
        <TabsContent value="team" className="space-y-4">
          {/* Case parties */}
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-4">Case Parties</p>
              <div className="space-y-3">
                {matter.clientName && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="font-medium">{matter.clientName}</p>
                      {matter.actingFor && <p className="text-xs text-muted-foreground">Acting for the {matter.actingFor}</p>}
                    </div>
                  </div>
                )}
                {matter.plaintiff && (
                  <div className="flex items-center gap-3 text-sm">
                    <Scale className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium">{matter.plaintiff}</p>
                      <p className="text-xs text-muted-foreground">Plaintiff / Applicant</p>
                    </div>
                  </div>
                )}
                {matter.defendant && (
                  <div className="flex items-center gap-3 text-sm">
                    <Scale className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-medium">{matter.defendant}</p>
                      <p className="text-xs text-muted-foreground">Defendant / Respondent</p>
                    </div>
                  </div>
                )}
                {!matter.clientName && !matter.plaintiff && !matter.defendant && (
                  <p className="text-sm text-muted-foreground">No parties recorded. Use Edit to add them.</p>
                )}
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 mt-4" onClick={openEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit parties
              </Button>
            </CardContent>
          </Card>

          {/* Client record */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Client Contact Record</p>
              {!matchedClient && (
                <Button size="sm" className="gap-1.5" onClick={openClientCreate}>
                  <Plus className="h-3.5 w-3.5" /> Add client record
                </Button>
              )}
            </div>

            {matchedClient ? (
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-serif font-bold text-foreground">{matchedClient.name}</p>
                      {matchedClient.ic_or_company && <p className="text-xs text-muted-foreground mt-0.5">{matchedClient.ic_or_company}</p>}
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openClientEdit(matchedClient)}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {matchedClient.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <a href={`tel:${matchedClient.phone}`} className="hover:text-primary">{matchedClient.phone}</a>
                      </div>
                    )}
                    {matchedClient.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <a href={`mailto:${matchedClient.email}`} className="hover:text-primary">{matchedClient.email}</a>
                      </div>
                    )}
                    {matchedClient.ic_or_company && (
                      <div className="flex items-center gap-2 text-sm">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{matchedClient.ic_or_company}</span>
                      </div>
                    )}
                    {matchedClient.notes && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">{matchedClient.notes}</p>}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No client record yet. Add one to store IC/company number, phone, and email.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── TIME ── */}
        <TabsContent value="time">
          {/* Summary */}
          {totalMinutes > 0 && (
            <Card className="mb-4">
              <CardContent className="p-4 flex items-center gap-4">
                <Timer className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-lg font-bold text-foreground">{minutesToHm(totalMinutes)}</p>
                  <p className="text-xs text-muted-foreground">Total time recorded</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Time entries</h3>
            <Button className="gap-2" size="sm" onClick={() => setTimeFormOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Log time
            </Button>
          </div>

          {timeFormOpen && (
            <Card className="mb-4">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Log time</p>
                <div className="space-y-1.5">
                  <Label>Description *</Label>
                  <Input value={timeForm.description} onChange={e => setTimeForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Drafted statement of claim" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Hours</Label>
                    <Input type="number" min="0" value={timeForm.hours} onChange={e => setTimeForm(f => ({ ...f, hours: e.target.value }))} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Minutes</Label>
                    <Input type="number" min="0" max="59" value={timeForm.minutes} onChange={e => setTimeForm(f => ({ ...f, minutes: e.target.value }))} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={timeForm.entry_date} onChange={e => setTimeForm(f => ({ ...f, entry_date: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={submitTimeEntry} disabled={addTimeEntry.isPending}>
                    {addTimeEntry.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setTimeFormOpen(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!timeData?.entries.length ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Timer className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No time recorded yet. Use "+ Log time" to track your hours.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {timeData.entries.map(entry => (
                <Card key={entry.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{entry.description}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(entry.entry_date)}</p>
                    </div>
                    <span className="text-sm font-semibold text-primary shrink-0">{minutesToHm(entry.minutes)}</span>
                    <button
                      onClick={() => deleteTimeEntry.mutate({ matterId: matter.id, entryId: entry.id })}
                      className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── BILLING ── */}
        <TabsContent value="billing">
          <BillingTab
            request={billingRequest}
            matterId={matter.id}
            accent="#8a6d2f"
            currency="RM"
            defaultClientName={matter.clientName ?? undefined}
          />
        </TabsContent>

        {/* ── VAULT (client documents) ── */}
        <TabsContent value="vault">
          <DocumentsPanel request={vaultRequest} matterId={matter.id} accent="#8a6d2f" />
        </TabsContent>

        {/* ── DRAFTS & LETTERS ── */}
        <TabsContent value="drafts">
          <DraftsPanel
            request={lettersRequest}
            matterId={matter.id}
            accent="#8a6d2f"
            showLetterWriter
            matterTitle={matter.title}
            clientName={matter.clientName ?? ''}
          />
        </TabsContent>

        {/* ── DIARY ── */}
        <TabsContent value="diary">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" />
              <h2 className="font-serif font-bold text-lg text-foreground">Deadline Diary</h2>
              {pending.length > 0 && <Badge variant="outline">{pending.length} pending</Badge>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setComputeOpen(true)}><Wand2 className="h-4 w-4" /> Compute from ROC</Button>
              <Button className="gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add</Button>
            </div>
          </div>

          {deadlines.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <CalendarClock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="font-serif font-semibold text-foreground mb-1">No deadlines yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                  Add dates manually or compute a full set from a ROC 2012 trigger.
                </p>
                <Button className="gap-2" onClick={() => setComputeOpen(true)}><Wand2 className="h-4 w-4" /> Compute from a trigger</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {[...pending, ...done].map(d => {
                const cat = categoryMeta(d.category);
                const isDone = d.status === 'done';
                return (
                  <Card key={d.id} className={`transition-all ${isDone ? 'opacity-60' : ''}`}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <button
                        onClick={() => toggleDone(d)}
                        className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:border-primary'
                        }`}
                      >
                        {isDone && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{d.title}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cat.color}`}>{cat.label}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Clock className="h-3 w-3" /> {fmtDate(d.dueDate)}
                          {d.basis && <span className="truncate">· {d.basis}</span>}
                        </div>
                        {d.notes && <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">{d.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <CountdownBadge due={d.dueDate} status={d.status} />
                        <button onClick={() => openEditDeadline(d)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => removeDeadline(d)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex items-start gap-3 bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/70 leading-relaxed">
              Computed dates apply ROC 2012 default periods. They are an aid, not a substitute for checking the Rules, practice directions and any court orders. <span className="text-amber-300 font-medium">Always verify before relying on a date.</span>
            </p>
          </div>
        </TabsContent>

        {/* ── CHRONOLOGY ── */}
        <TabsContent value="chronology">
          <ChronologyPanel matterId={matter.id} />
        </TabsContent>
      </Tabs>

      {/* ─────────────── MODALS ─────────────── */}

      {/* Edit matter */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Matter">
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Matter title *</Label><Input value={editForm.title ?? ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Client</Label><Input value={editForm.clientName ?? ''} onChange={e => setEditForm(f => ({ ...f, clientName: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Status</Label>
              <Select value={editForm.status ?? 'active'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Plaintiff / Applicant</Label><Input value={editForm.plaintiff ?? ''} onChange={e => setEditForm(f => ({ ...f, plaintiff: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Defendant / Respondent</Label><Input value={editForm.defendant ?? ''} onChange={e => setEditForm(f => ({ ...f, defendant: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Suit / Case no.</Label><Input value={editForm.suitNo ?? ''} onChange={e => setEditForm(f => ({ ...f, suitNo: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Claim amount (RM)</Label><Input type="number" value={editForm.claimAmount ?? ''} onChange={e => setEditForm(f => ({ ...f, claimAmount: e.target.value }))} /></div>
          </div>
          <div className="space-y-1.5"><Label>Court</Label><Input value={editForm.court ?? ''} onChange={e => setEditForm(f => ({ ...f, court: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={editForm.notes ?? ''} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={saveEdit} disabled={updateMatter.isPending}>Save changes</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this matter?">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">This permanently deletes <span className="text-foreground font-medium">"{matter.title}"</span> and all its deadlines. This cannot be undone.</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={doDelete} disabled={deleteMatter.isPending}>Delete</Button>
          </div>
        </div>
      </Modal>

      {/* Add deadline */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Deadline">
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Title *</Label><Input value={dForm.title} onChange={e => setDForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. File defence" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Due date *</Label><Input type="date" value={dForm.dueDate} onChange={e => setDForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Category</Label>
              <Select value={dForm.category} onChange={e => setDForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{categoryMeta(c).label}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Basis (rule / authority)</Label><Input value={dForm.basis} onChange={e => setDForm(f => ({ ...f, basis: e.target.value }))} placeholder="e.g. O.18 r.2" /></div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={dForm.notes} onChange={e => setDForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={submitAdd} disabled={addDeadline.isPending}>Add deadline</Button>
          </div>
        </div>
      </Modal>

      {/* Compute from ROC */}
      <Modal isOpen={computeOpen} onClose={() => { setComputeOpen(false); setPreview([]); }} title="Compute Deadlines from ROC 2012">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Trigger event</Label>
              <Select value={trigger} onChange={e => { setTrigger(e.target.value); setPreview([]); }}>
                <option value="">Select a trigger…</option>
                {triggers?.map(t => <option key={t.trigger} value={t.trigger}>{t.label}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Date of that event</Label><Input type="date" value={triggerDate} onChange={e => { setTriggerDate(e.target.value); setPreview([]); }} /></div>
          </div>
          {selectedTrigger && <p className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3">{selectedTrigger.description}</p>}
          <Button variant="outline" className="w-full gap-2" onClick={runCompute} disabled={compute.isPending}>
            <Wand2 className="h-4 w-4" /> {compute.isPending ? 'Computing…' : 'Compute deadlines'}
          </Button>
          {preview.length > 0 && (
            <>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                <p className="text-xs text-muted-foreground">Select the deadlines to add:</p>
                {preview.map((p, i) => {
                  const cat = categoryMeta(p.category);
                  return (
                    <label key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/40 cursor-pointer transition-all">
                      <input type="checkbox" checked={!!picked[i]} onChange={e => setPicked(pk => ({ ...pk, [i]: e.target.checked }))} className="mt-1 accent-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{p.title}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cat.color}`}>{cat.label}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{fmtDate(p.dueDate)} · {p.basis}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => { setComputeOpen(false); setPreview([]); }}>Cancel</Button>
                <Button className="flex-1" onClick={saveComputed} disabled={addBulk.isPending}>Add selected to diary</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Edit deadline */}
      <Modal isOpen={!!editingDeadline} onClose={() => setEditingDeadline(null)} title="Edit Deadline">
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Title *</Label><Input value={edForm.title} onChange={e => setEdForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Due date *</Label><Input type="date" value={edForm.dueDate} onChange={e => setEdForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Category</Label>
              <Select value={edForm.category} onChange={e => setEdForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{categoryMeta(c).label}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Basis</Label><Input value={edForm.basis} onChange={e => setEdForm(f => ({ ...f, basis: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={edForm.notes} onChange={e => setEdForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setEditingDeadline(null)}>Cancel</Button>
            <Button className="flex-1" onClick={saveEditDeadline} disabled={updateDeadline.isPending}>Save changes</Button>
          </div>
        </div>
      </Modal>

      {/* Client create / edit */}
      <Modal isOpen={clientFormOpen} onClose={() => setClientFormOpen(false)} title={editingClient ? 'Edit Client' : 'New Client Record'}>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Full name *</Label><Input value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ahmad bin Ali" /></div>
          <div className="space-y-1.5"><Label>IC / Company no.</Label><Input value={clientForm.ic_or_company} onChange={e => setClientForm(f => ({ ...f, ic_or_company: e.target.value }))} placeholder="e.g. 800101-14-5678 or 123456-H" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Phone</Label><Input value={clientForm.phone} onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))} placeholder="e.g. 012-345 6789" /></div>
            <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={clientForm.email} onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} placeholder="client@email.com" /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea value={clientForm.notes} onChange={e => setClientForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setClientFormOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={saveClient} disabled={createClient.isPending || updateClient.isPending}>{editingClient ? 'Save changes' : 'Create client'}</Button>
          </div>
        </div>
      </Modal>

      {/* View filed document */}
      <Modal isOpen={!!viewDoc} onClose={() => setViewDoc(null)} title={viewDoc?.title ?? 'Document'}>
        {viewDoc && (
          <div className="space-y-4">
            <div className="flex justify-end"><ExportButtons title={viewDoc.title} content={viewDoc.content} /></div>
            <div className="bg-background border border-border rounded-lg p-4 max-h-[55vh] overflow-y-auto">
              <pre className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">{viewDoc.content}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
