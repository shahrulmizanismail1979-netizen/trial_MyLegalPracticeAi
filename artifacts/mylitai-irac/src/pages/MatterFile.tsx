import { useState, useRef } from 'react';
import { Link, useRoute } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft, FileText, CalendarClock, AlertTriangle, CircleCheck,
  FolderKanban, Sparkles, RefreshCw, Shield, ShieldCheck, ShieldAlert,
  CheckSquare, Timer, Users, GitBranch, Plus, Check, Trash2,
  Clock, Building2, Scale, Mail, Phone, CreditCard,
  Loader2, ChevronRight, ClipboardList, ChevronDown,
} from 'lucide-react';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import {
  useMatter, useMatterWork, daysUntil, type MatterWorkItem,
  useAIInsights, useRefreshInsights, AI_BRIEFING_POLL_TIMEOUT_MS, useIntakeBriefing, useGenerateIntakeBriefing, useChecklist,
  useAddChecklistItem, useToggleChecklistItem, useDeleteChecklistItem,
  useStageHistory, useAdvanceStage,
  useTimeEntries, useAddTimeEntry, useDeleteTimeEntry,
  useClients, useCreateClient, useUpdateClient, type MatterClient,
} from '@/hooks/use-matters';
import { useToast } from '@/hooks/use-toast';

// ── Constants ─────────────────────────────────────────────────────────────────
const LIT_STAGES = ['Pre-Trial', 'Trial', 'Judgment', 'Appeal', 'Closed'] as const;
type LitStage = typeof LIT_STAGES[number];

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

function minutesToHm(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? (min > 0 ? `${h}h ${min}m` : `${h}h`) : `${min}m`;
}

function Countdown({ due, status }: { due: string; status: string }) {
  if (status === 'done') return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><CircleCheck className="h-3.5 w-3.5" /> Done</span>;
  const d = daysUntil(due);
  if (d < 0) return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> {Math.abs(d)}d overdue</span>;
  if (d === 0) return <span className="text-[11px] font-bold text-red-400">Due today</span>;
  if (d <= 7) return <span className="text-[11px] font-bold text-amber-400">in {d}d</span>;
  return <span className="text-[11px] text-muted-foreground">in {d}d</span>;
}

// ── Stage tracker ─────────────────────────────────────────────────────────────

function StageTracker({ matterId, current, onAdvance }: { matterId: number; current: string; onAdvance: (s: string) => void }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const currentIdx = LIT_STAGES.indexOf(current as LitStage);
  const isStaged = currentIdx >= 0;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="h-4 w-4 text-[hsl(var(--gold))]" />
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
                onClick={() => active ? null : setConfirming(stage)}
                disabled={active}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all ${
                  active ? 'bg-[hsl(var(--gold))] text-[hsl(var(--oxford-deep))] border-[hsl(var(--gold))]'
                  : done ? 'bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30 line-through opacity-60'
                  : isNext ? 'border-[hsl(var(--gold))]/40 text-[hsl(var(--gold))] hover:bg-[hsl(var(--gold))]/10 cursor-pointer'
                  : 'border-border text-muted-foreground hover:border-[hsl(var(--gold))]/30 cursor-pointer'
                }`}
              >
                {stage}
              </button>
              {i < LIT_STAGES.length - 1 && <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${done ? 'text-[hsl(var(--gold))]/40' : 'text-border'}`} />}
            </div>
          );
        })}
      </div>
      {confirming && (
        <div className="mt-3 p-3 bg-[hsl(var(--oxford-deep))]/60 rounded-lg border border-[hsl(var(--gold))]/20 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-foreground">Set stage to <span className="font-semibold text-[hsl(var(--gold))]">{confirming}</span>?</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>Cancel</Button>
            <Button size="sm" className="bg-[hsl(var(--gold))] text-[hsl(var(--oxford-deep))] hover:bg-[hsl(var(--gold))]/90" onClick={() => { onAdvance(confirming); setConfirming(null); }}>Confirm</Button>
          </div>
        </div>
      )}
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
              {generate.isPending ? 'Generating…' : 'Generate Intake Briefing'}
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

  // While waiting for a background job that hasn't finished yet, show a
  // "generating" state instead of the error/empty state. We poll the endpoint
  // automatically (see useAIInsights) and flip to this banner until data
  // arrives or the 3-minute timeout elapses.
  const withinPollWindow = Date.now() - mountedAt.current < AI_BRIEFING_POLL_TIMEOUT_MS;
  const isGenerating = isLoading || (!insights && withinPollWindow);

  if (isGenerating) {
    return (
      <div className="card-elegant p-5 mb-5">
        <div className="flex items-center gap-2 text-[hsl(var(--gold))] mb-3">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold font-serif">AI Case Insights</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating AI briefing from your uploaded documents…
        </div>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="card-elegant p-5 mb-5">
        <div className="flex items-center gap-2 text-[hsl(var(--gold))] mb-3">
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-semibold font-serif">AI Case Insights</span>
        </div>
        <p className="text-sm text-muted-foreground mb-3">Could not load insights.</p>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => refresh.mutate(matterId)} disabled={refresh.isPending}>
          <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} /> Generate insights
        </Button>
      </div>
    );
  }

  const risk = RISK_META[insights.riskAssessment.rating] ?? RISK_META.Medium;
  const RiskIcon = risk.icon;

  return (
    <div className="card-elegant p-5 mb-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[hsl(var(--gold))]" />
          <span className="text-sm font-semibold font-serif text-foreground">AI Case Insights</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${risk.color}`}>
            <RiskIcon className="h-3.5 w-3.5" /> {risk.label}
          </span>
          <button onClick={() => refresh.mutate(matterId)} disabled={refresh.isPending} className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground" title="Refresh insights">
            <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Case Summary</p>
        <p className="text-sm text-foreground/90 leading-relaxed">{insights.caseSummary}</p>
      </div>

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

      {(insights.riskAssessment.keyStrengths.length > 0 || insights.riskAssessment.keyWeaknesses.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[hsl(var(--gold))]/10">
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
      <p className="text-[10px] text-muted-foreground/60">AI-generated · cached {fmtDate(insights.cachedAt)} · not a substitute for professional judgment</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MatterFile() {
  const [, params] = useRoute('/matters/:id');
  const id = params?.id ? parseInt(params.id, 10) : null;
  const { data: matter, isLoading } = useMatter(id);
  const { data: work } = useMatterWork(id);
  const { data: checklist } = useChecklist(id);
  const { data: timeData } = useTimeEntries(id);
  const { data: clients } = useClients();
  const { toast } = useToast();

  const advanceStage = useAdvanceStage();
  const addChecklistItem = useAddChecklistItem();
  const toggleItem = useToggleChecklistItem();
  const deleteItem = useDeleteChecklistItem();
  const addTimeEntry = useAddTimeEntry();
  const deleteTimeEntry = useDeleteTimeEntry();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const refresh = useRefreshInsights();

  const [viewDoc, setViewDoc] = useState<MatterWorkItem | null>(null);

  // Checklist state
  const [newItemText, setNewItemText] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Time state
  const [timeFormOpen, setTimeFormOpen] = useState(false);
  const [timeForm, setTimeForm] = useState({ description: '', hours: '', minutes: '', entry_date: '' });

  // Client state
  const [clientFormOpen, setClientFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<MatterClient | null>(null);
  const [clientForm, setClientForm] = useState({ name: '', ic_or_company: '', phone: '', email: '', notes: '' });

  if (isLoading) return <div className="p-10 text-center text-muted-foreground animate-pulse">Loading matter…</div>;
  if (!matter) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground mb-4">This matter could not be found.</p>
        <Button asChild variant="outline" className="gap-2"><Link href="/matters"><ArrowLeft className="h-4 w-4" /> Back to matters</Link></Button>
      </div>
    );
  }

  // ── Handlers ──

  const handleAdvanceStage = async (stage: string) => {
    try {
      await advanceStage.mutateAsync({ matterId: matter.id, stage });
      toast({ title: `Stage set to ${stage}` });
    } catch (e) {
      toast({ title: 'Could not update stage', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const submitNewItem = async () => {
    if (!newItemText.trim()) return;
    try {
      await addChecklistItem.mutateAsync({ matterId: matter.id, item_text: newItemText.trim() });
      setNewItemText(''); setAddingItem(false);
    } catch (e) {
      toast({ title: 'Could not add item', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const submitTimeEntry = async () => {
    if (!timeForm.description.trim()) { toast({ title: 'Description required', variant: 'destructive' }); return; }
    const totalMinutes = parseInt(timeForm.hours || '0', 10) * 60 + parseInt(timeForm.minutes || '0', 10);
    if (totalMinutes <= 0) { toast({ title: 'Enter at least 1 minute', variant: 'destructive' }); return; }
    try {
      await addTimeEntry.mutateAsync({ matterId: matter.id, description: timeForm.description.trim(), minutes: totalMinutes, entry_date: timeForm.entry_date || undefined });
      toast({ title: 'Time logged' });
      setTimeFormOpen(false);
      setTimeForm({ description: '', hours: '', minutes: '', entry_date: '' });
    } catch (e) {
      toast({ title: 'Could not log time', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

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
      if (editingClient) { await updateClient.mutateAsync({ id: editingClient.id, ...clientForm }); toast({ title: 'Client updated' }); }
      else { await createClient.mutateAsync(clientForm); toast({ title: 'Client created' }); }
      setClientFormOpen(false);
    } catch (e) { toast({ title: 'Could not save client', description: e instanceof Error ? e.message : '', variant: 'destructive' }); }
  };

  // ── Computed values ──
  const deadlines = matter.deadlines ?? [];
  const pendingDeadlines = deadlines.filter(d => d.status !== 'done');
  const checklistItems = checklist ?? [];
  const doneItems = checklistItems.filter(i => i.done);
  const progressPct = checklistItems.length > 0 ? Math.round((doneItems.length / checklistItems.length) * 100) : 0;
  const totalMinutes = timeData?.totalMinutes ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/matters" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[hsl(var(--gold))] transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" /> All matters
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-[hsl(var(--gold))]" /> {matter.title}
          </h1>
          {matter.clientName && <p className="text-sm text-muted-foreground mt-1">Client: {matter.clientName}</p>}
        </div>
        <Badge variant="outline" className="capitalize text-[hsl(var(--gold))] border-[hsl(var(--gold))]/30">{matter.status}</Badge>
      </div>

      {/* Stage tracker */}
      <StageTracker matterId={matter.id} current={matter.status} onAdvance={handleAdvanceStage} />

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Documents
            {(work?.length ?? 0) > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{work!.length}</Badge>}
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
          <TabsTrigger value="diary" className="gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> Diary
            {pendingDeadlines.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{pendingDeadlines.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── OVERVIEW ── */}
        <TabsContent value="overview">
          {matter.notes && (
            <Card className="mb-5">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Notes</p>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{matter.notes}</p>
              </CardContent>
            </Card>
          )}
          <IntakeBriefingPanel matterId={matter.id} />
          <AIInsightsPanel matterId={matter.id} />
        </TabsContent>

        {/* ── DOCUMENTS ── */}
        <TabsContent value="documents">
          {(work?.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No documents filed yet. Generate a draft in the Drafting Studio and choose "File into Matter".
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {work!.map(w => (
                <Card key={w.id} className="cursor-pointer hover:border-[hsl(var(--gold))]/50 transition-colors" onClick={() => setViewDoc(w)}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <FileText className="h-4 w-4 text-[hsl(var(--gold))] mt-1 shrink-0" />
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
                  <div className="h-full bg-[hsl(var(--gold))] rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2 mb-4">
            {checklistItems.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">AI is generating a procedural checklist. Reload in a moment, or add steps manually.</p>
                </CardContent>
              </Card>
            )}
            {checklistItems.map(item => (
              <Card key={item.id} className={item.done ? 'opacity-60' : ''}>
                <CardContent className="p-3 flex items-center gap-3">
                  <button
                    onClick={() => toggleItem.mutate({ matterId: matter.id, itemId: item.id, done: !item.done })}
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                      item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border hover:border-[hsl(var(--gold))]'
                    }`}
                  >
                    {item.done && <Check className="h-3 w-3" />}
                  </button>
                  <span className={`flex-1 text-sm ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.item_text}</span>
                  <button onClick={() => deleteItem.mutate({ matterId: matter.id, itemId: item.id })} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>

          {addingItem ? (
            <Card>
              <CardContent className="p-3 flex items-center gap-2">
                <Input value={newItemText} onChange={e => setNewItemText(e.target.value)} placeholder="Describe the step…" className="flex-1"
                  onKeyDown={e => { if (e.key === 'Enter') submitNewItem(); if (e.key === 'Escape') setAddingItem(false); }} autoFocus />
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
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-4">Case Parties</p>
              <div className="space-y-3">
                {matter.clientName && (
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-[hsl(var(--gold))] shrink-0" />
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
                  <p className="text-sm text-muted-foreground">No parties recorded. Manage details in the matter settings.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Client Contact Record</p>
              {!matchedClient && (
                <Button size="sm" className="gap-1.5 bg-[hsl(var(--gold))] text-[hsl(var(--oxford-deep))] hover:bg-[hsl(var(--gold))]/90" onClick={openClientCreate}>
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
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openClientEdit(matchedClient)}>Edit</Button>
                  </div>
                  <div className="space-y-2">
                    {matchedClient.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-3.5 w-3.5 text-muted-foreground" /><a href={`tel:${matchedClient.phone}`} className="hover:text-[hsl(var(--gold))]">{matchedClient.phone}</a></div>}
                    {matchedClient.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-3.5 w-3.5 text-muted-foreground" /><a href={`mailto:${matchedClient.email}`} className="hover:text-[hsl(var(--gold))]">{matchedClient.email}</a></div>}
                    {matchedClient.ic_or_company && <div className="flex items-center gap-2 text-sm"><CreditCard className="h-3.5 w-3.5 text-muted-foreground" /><span>{matchedClient.ic_or_company}</span></div>}
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
          {totalMinutes > 0 && (
            <Card className="mb-4">
              <CardContent className="p-4 flex items-center gap-4">
                <Timer className="h-5 w-5 text-[hsl(var(--gold))] shrink-0" />
                <div>
                  <p className="text-lg font-bold text-foreground">{minutesToHm(totalMinutes)}</p>
                  <p className="text-xs text-muted-foreground">Total time recorded</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Time entries</h3>
            <Button size="sm" className="gap-2 bg-[hsl(var(--gold))] text-[hsl(var(--oxford-deep))] hover:bg-[hsl(var(--gold))]/90" onClick={() => setTimeFormOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Log time
            </Button>
          </div>

          {timeFormOpen && (
            <Card className="mb-4">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Log time</p>
                <div className="space-y-1.5"><Label>Description *</Label><Input value={timeForm.description} onChange={e => setTimeForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Drafted affidavit" /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5"><Label>Hours</Label><Input type="number" min="0" value={timeForm.hours} onChange={e => setTimeForm(f => ({ ...f, hours: e.target.value }))} placeholder="0" /></div>
                  <div className="space-y-1.5"><Label>Minutes</Label><Input type="number" min="0" max="59" value={timeForm.minutes} onChange={e => setTimeForm(f => ({ ...f, minutes: e.target.value }))} placeholder="0" /></div>
                  <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={timeForm.entry_date} onChange={e => setTimeForm(f => ({ ...f, entry_date: e.target.value }))} /></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={submitTimeEntry} disabled={addTimeEntry.isPending}>{addTimeEntry.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setTimeFormOpen(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!timeData?.entries.length ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Timer className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No time recorded yet.</p>
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
                    <span className="text-sm font-semibold text-[hsl(var(--gold))] shrink-0">{minutesToHm(entry.minutes)}</span>
                    <button onClick={() => deleteTimeEntry.mutate({ matterId: matter.id, entryId: entry.id })} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── DIARY ── */}
        <TabsContent value="diary">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-[hsl(var(--gold))]" />
              <h2 className="font-serif font-bold text-lg text-foreground">Deadlines</h2>
              {pendingDeadlines.length > 0 && <Badge variant="outline">{pendingDeadlines.length} pending</Badge>}
            </div>
            <Button asChild variant="outline" size="sm" className="gap-1.5"><Link href="/diary"><CalendarClock className="h-3.5 w-3.5" /> Open Diary</Link></Button>
          </div>

          {(matter.deadlines?.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CalendarClock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No deadlines recorded. Manage the full diary — including ROC-computed timelines — in MyLitAI or the Diary.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {matter.deadlines.map(d => (
                <Card key={d.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(d.dueDate)}{d.basis ? ` · ${d.basis}` : ''}</p>
                    </div>
                    <Countdown due={d.dueDate} status={d.status} />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── MODALS ── */}

      {/* Client form */}
      <Dialog open={clientFormOpen} onOpenChange={setClientFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'Edit Client' : 'New Client Record'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Full name *</Label><Input className="mt-1" value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ahmad bin Ali" /></div>
            <div><Label>IC / Company no.</Label><Input className="mt-1" value={clientForm.ic_or_company} onChange={e => setClientForm(f => ({ ...f, ic_or_company: e.target.value }))} placeholder="e.g. 800101-14-5678" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Phone</Label><Input className="mt-1" value={clientForm.phone} onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))} placeholder="012-345 6789" /></div>
              <div><Label>Email</Label><Input className="mt-1" type="email" value={clientForm.email} onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} placeholder="client@email.com" /></div>
            </div>
            <div><Label>Notes</Label><Textarea className="mt-1" value={clientForm.notes} onChange={e => setClientForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full bg-[hsl(var(--gold))] text-[hsl(var(--oxford-deep))] hover:bg-[hsl(var(--gold))]/90" onClick={saveClient} disabled={createClient.isPending || updateClient.isPending}>
              {editingClient ? 'Save changes' : 'Create client'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document viewer */}
      <Dialog open={!!viewDoc} onOpenChange={o => { if (!o) setViewDoc(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewDoc?.title ?? 'Document'}</DialogTitle>
          </DialogHeader>
          {viewDoc && (
            <ScrollArea className="max-h-[60vh] rounded-md border border-border p-4">
              <MarkdownRenderer content={viewDoc.content} />
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
