import React, { useState } from 'react';
import { Link, useRoute, useLocation } from 'wouter';
import {
  ArrowLeft, Pencil, Trash2, Plus, Check, Clock, AlertTriangle, CircleCheck,
  FileText, CalendarClock, Building2, Users, Hash, Copy, Download, X, Loader2,
  ChevronDown, ChevronRight, Sparkles, TrendingUp, TrendingDown, Minus, RefreshCw,
  ListChecks, Phone, Mail, Timer, User,
} from 'lucide-react';
import {
  useMatter,
  useMatterWork,
  useUpdateMatter,
  useDeleteMatter,
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
  matterTypeLabel,
  daysUntil,
  fmtDate,
  MATTER_TYPE_OPTIONS,
  type MatterDeadline,
  type MatterWorkItem,
  type ChecklistItem,
  type CaseInsights,
} from '@/lib/matters';
import { useToast } from '@/hooks/use-toast';

const CONVEY_STAGES = ['Instruction', 'SPA Execution', 'Financing', 'Stamping', 'Completion', 'Registration', 'Closed'];
const STATUS_OPTIONS = ['open', 'closed'];
type Tab = 'overview' | 'progress' | 'timeline' | 'documents' | 'checklist' | 'team' | 'time';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'progress', label: 'Transaction' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'documents', label: 'Documents' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'team', label: 'Team' },
  { id: 'time', label: 'Time' },
];

const inputCls = 'w-full bg-gold-950 border border-gold-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500';
const labelCls = 'text-[11px] font-bold text-slate-400 uppercase tracking-wider';

function CountdownBadge({ due, status }: { due: string; status: string }) {
  if (status === 'done') return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><CircleCheck className="w-3.5 h-3.5" /> Done</span>;
  const d = daysUntil(due);
  if (d < 0) return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400"><AlertTriangle className="w-3.5 h-3.5" /> {Math.abs(d)}d overdue</span>;
  if (d === 0) return <span className="text-[11px] font-bold text-red-400">Due today</span>;
  if (d <= 7) return <span className="text-[11px] font-bold text-amber-400">in {d}d</span>;
  return <span className="text-[11px] font-medium text-slate-400">in {d}d</span>;
}

// ── Transaction Progress (Convey-specific stage stepper) ────────────────────
function TransactionProgress({ matterId, currentStatus, matterType }: { matterId: number; currentStatus: string; matterType: string | null }) {
  const updateStage = useUpdateStage();
  const { toast } = useToast();
  const currentIdx = CONVEY_STAGES.indexOf(currentStatus);
  const pct = currentIdx >= 0 ? Math.round((currentIdx / (CONVEY_STAGES.length - 1)) * 100) : 0;

  const changeStage = async (stage: string) => {
    if (stage === currentStatus) return;
    try {
      await updateStage.mutateAsync({ id: matterId, stage });
      toast({ title: `Stage updated to "${stage}"` });
    } catch (e) {
      toast({ title: 'Could not update stage', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  return (
    <div className="border border-gold-800 rounded-2xl p-5 bg-gold-900/40 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Transaction Progress</p>
        <span className="text-xs font-bold text-amber-400">{pct}% complete</span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gold-800 rounded-full h-2">
        <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Stage pills */}
      <div className="flex flex-wrap gap-1.5">
        {CONVEY_STAGES.map((stage, idx) => {
          const isActive = stage === currentStatus;
          const isPast = idx < currentIdx;
          return (
            <button
              key={stage}
              onClick={() => changeStage(stage)}
              disabled={updateStage.isPending}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                isActive
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                  : isPast
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40'
                  : 'text-slate-500 border-gold-700 hover:border-gold-600 hover:text-slate-300'
              }`}
            >
              {isPast && <Check className="inline w-3 h-3 mr-1" />}
              {stage}
            </button>
          );
        })}
      </div>

      {/* Conveyancing workflow guide */}
      <div className="border-t border-gold-800 pt-4">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Transaction Type</p>
        <p className="text-sm text-amber-400 font-semibold">{matterType ? matterTypeLabel(matterType) : 'General Conveyancing'}</p>
        <div className="mt-3 space-y-1.5">
          {[
            { stage: 'Instruction', note: 'Client engagement, SPA review, identity checks' },
            { stage: 'SPA Execution', note: 'SPA signing, earnest deposit, requisitions' },
            { stage: 'Financing', note: 'Loan approval, facility letter, loan docs execution' },
            { stage: 'Stamping', note: 'Stamp duty assessment (LHDN), CKHT, SPA stamping' },
            { stage: 'Completion', note: 'Completion statement, balance purchase price, VP' },
            { stage: 'Registration', note: 'Form 14A, MOT, discharge of charge (if applicable)' },
          ].map((item) => {
            const idx = CONVEY_STAGES.indexOf(item.stage);
            const isCurrent = item.stage === currentStatus;
            const isDone = idx < currentIdx;
            return (
              <div key={item.stage} className={`flex items-start gap-2.5 py-1 ${isCurrent ? 'opacity-100' : isDone ? 'opacity-50' : 'opacity-30'}`}>
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isCurrent ? 'bg-amber-400' : isDone ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <div>
                  <p className={`text-xs font-semibold ${isCurrent ? 'text-amber-400' : isDone ? 'text-emerald-400' : 'text-slate-500'}`}>{item.stage}</p>
                  <p className="text-[11px] text-slate-500">{item.note}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── AI Insights ───────────────────────────────────────────────────────────────
function AiInsightsCard({ matterId }: { matterId: number }) {
  const { data: insights, isLoading, isError, refetch, isFetching } = useAiInsights(matterId);

  const riskColor = (rating: string) => {
    if (rating === 'High') return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (rating === 'Medium') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  };

  if (isLoading || isFetching) {
    return (
      <div className="border border-gold-800 rounded-2xl p-5 bg-gold-900/40">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          <span className="text-sm font-semibold text-slate-100">AI Transaction Intelligence</span>
        </div>
        <p className="text-sm text-slate-400 animate-pulse">Generating insights…</p>
      </div>
    );
  }

  if (isError || !insights) {
    return (
      <div className="border border-gold-800 rounded-2xl p-5 bg-gold-900/40 flex items-center justify-between">
        <span className="text-sm text-slate-400">AI insights unavailable</span>
        <button onClick={() => refetch()} className="inline-flex items-center gap-1.5 text-xs text-amber-400 border border-gold-700 px-2.5 py-1.5 rounded-lg hover:bg-gold-800 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border border-gold-800 rounded-2xl p-5 bg-gold-900/40">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-100">AI Transaction Summary</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${riskColor(insights.riskAssessment.rating)}`}>
              {insights.riskAssessment.rating} Risk
            </span>
            <button onClick={() => refetch()} className="text-slate-500 hover:text-slate-300"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <p className="text-sm text-slate-200 leading-relaxed">{insights.caseSummary}</p>
      </div>

      {insights.nextSteps.length > 0 && (
        <div className="border border-gold-800 rounded-2xl p-5 bg-gold-900/40">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Recommended Next Steps</p>
          <div className="space-y-2.5">
            {insights.nextSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                {step.priority === 'high' ? <TrendingUp className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" /> :
                 step.priority === 'medium' ? <Minus className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" /> :
                 <TrendingDown className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200">{step.action}</p>
                  {step.suggestedDeadline && <p className="text-xs text-slate-400 mt-0.5">⏱ {step.suggestedDeadline}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(insights.riskAssessment.keyStrengths.length > 0 || insights.riskAssessment.keyWeaknesses.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {insights.riskAssessment.keyStrengths.length > 0 && (
            <div className="border border-emerald-500/20 rounded-2xl p-4 bg-gold-900/40">
              <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2">Strengths</p>
              <ul className="space-y-1">
                {insights.riskAssessment.keyStrengths.map((s, i) => (
                  <li key={i} className="text-xs text-slate-300 flex gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" /> {s}</li>
                ))}
              </ul>
            </div>
          )}
          {insights.riskAssessment.keyWeaknesses.length > 0 && (
            <div className="border border-red-500/20 rounded-2xl p-4 bg-gold-900/40">
              <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider mb-2">Concerns</p>
              <ul className="space-y-1">
                {insights.riskAssessment.keyWeaknesses.map((w, i) => (
                  <li key={i} className="text-xs text-slate-300 flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" /> {w}</li>
                ))}
              </ul>
            </div>
          )}
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
  const [newText, setNewText] = useState('');

  const doneCount = (items ?? []).filter((i) => i.done).length;
  const total = items?.length ?? 0;

  if (isLoading) return <div className="p-8 text-center text-amber-400 animate-pulse">Loading checklist…</div>;

  return (
    <div className="space-y-4">
      {total > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gold-800 rounded-full h-1.5">
            <div className="bg-amber-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
          </div>
          <span className="text-xs text-slate-400 shrink-0">{doneCount}/{total}</span>
        </div>
      )}

      {(items ?? []).length === 0 ? (
        <div className="border border-gold-800 rounded-2xl p-8 text-center bg-gold-900/40">
          <ListChecks className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No checklist yet. AI will generate one automatically, or add items below.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {[...(items ?? [])].sort((a, b) => a.position - b.position).map((item) => (
            <div key={item.id} className={`border border-gold-800 rounded-xl bg-gold-900/40 p-3 flex items-center gap-3 ${item.done ? 'opacity-60' : ''}`}>
              <button
                onClick={() => updateItem.mutateAsync({ matterId, itemId: item.id, done: !item.done }).catch(() => toast({ title: 'Could not update', variant: 'destructive' }))}
                className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${item.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gold-700 hover:border-amber-500'}`}
              >
                {item.done && <Check className="w-3 h-3" />}
              </button>
              <span className={`text-sm flex-1 ${item.done ? 'line-through text-slate-500' : 'text-slate-100'}`}>{item.text}</span>
              <button onClick={() => deleteItem.mutateAsync({ matterId, itemId: item.id })} className="p-1 rounded text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          className={inputCls + ' flex-1'}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Add a checklist item…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newText.trim()) {
              addItem.mutateAsync({ matterId, text: newText.trim() }).then(() => setNewText('')).catch(() => toast({ title: 'Could not add', variant: 'destructive' }));
            }
          }}
        />
        <button
          onClick={() => { if (newText.trim()) addItem.mutateAsync({ matterId, text: newText.trim() }).then(() => setNewText('')).catch(() => toast({ title: 'Could not add', variant: 'destructive' })); }}
          disabled={addItem.isPending}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
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
  const [form, setForm] = useState({ name: '', company_name: '', email: '', phone: '', notes: '' });

  const submit = async () => {
    if (!form.name.trim()) { toast({ title: 'Name required', variant: 'destructive' }); return; }
    try {
      await createClient.mutateAsync({ name: form.name.trim(), company_name: form.company_name || undefined, email: form.email || undefined, phone: form.phone || undefined, notes: form.notes || undefined });
      toast({ title: 'Contact added' });
      setAddOpen(false);
      setForm({ name: '', company_name: '', email: '', phone: '', notes: '' });
    } catch { toast({ title: 'Could not add contact', variant: 'destructive' }); }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {matter.clientName && (
          <div className="border border-amber-500/30 rounded-2xl p-4 bg-gold-900/40">
            <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Purchaser / Client</p>
            <p className="font-semibold text-slate-100">{matter.clientName}</p>
          </div>
        )}
        {matter.counterparty && (
          <div className="border border-gold-800 rounded-2xl p-4 bg-gold-900/40">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Vendor / Other Party</p>
            <p className="font-semibold text-slate-100">{matter.counterparty}</p>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-100">Contact Directory</p>
          <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-gold-800 hover:bg-gold-700 border border-gold-700 px-2.5 py-1.5 rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        {isLoading ? null : (clients ?? []).length === 0 ? (
          <div className="border border-gold-800 rounded-2xl p-6 text-center bg-gold-900/40">
            <p className="text-sm text-slate-400">No contacts yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(clients ?? []).map((c) => (
              <div key={c.id} className="border border-gold-800 rounded-2xl p-4 bg-gold-900/40 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm text-slate-100">{c.name}</p>
                  {c.company_name && <p className="text-xs text-slate-400">{c.company_name}</p>}
                  {c.email && <p className="text-xs text-slate-400 flex items-center gap-1 mt-1"><Mail className="w-3 h-3" /> {c.email}</p>}
                  {c.phone && <p className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</p>}
                </div>
                <button onClick={() => deleteClient.mutateAsync(c.id)} className="p-1.5 rounded text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gold-950/80 backdrop-blur-sm" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-md bg-gold-900 border border-gold-700 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif font-bold text-lg text-slate-50">Add Contact</h2>
              <button onClick={() => setAddOpen(false)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5"><label className={labelCls}>Name *</label><input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="space-y-1.5"><label className={labelCls}>Company</label><input className={inputCls} value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className={labelCls}>Email</label><input className={inputCls} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
                <div className="space-y-1.5"><label className={labelCls}>Phone</label><input className={inputCls} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setAddOpen(false)} className="flex-1 text-sm font-semibold text-slate-300 bg-gold-800 hover:bg-gold-700 border border-gold-700 py-2.5 rounded-xl transition-colors">Cancel</button>
                <button onClick={submit} disabled={createClient.isPending} className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 py-2.5 rounded-xl transition-colors">
                  {createClient.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
  const [form, setForm] = useState({ description: '', minutes: '', entry_date: today });

  const submit = async () => {
    if (!form.description.trim() || !form.minutes || !form.entry_date) { toast({ title: 'All fields required', variant: 'destructive' }); return; }
    const mins = parseInt(form.minutes, 10);
    if (Number.isNaN(mins) || mins <= 0) { toast({ title: 'Enter valid minutes', variant: 'destructive' }); return; }
    try {
      await logTime.mutateAsync({ matterId, description: form.description.trim(), minutes: mins, entry_date: form.entry_date });
      toast({ title: 'Time logged' });
      setForm({ description: '', minutes: '', entry_date: today });
    } catch { toast({ title: 'Could not log time', variant: 'destructive' }); }
  };

  const totalH = Math.floor((timeData?.totalMinutes ?? 0) / 60);
  const totalM = (timeData?.totalMinutes ?? 0) % 60;

  return (
    <div className="space-y-4">
      <div className="border border-amber-500/30 rounded-2xl p-4 bg-gold-900/40 flex items-center gap-4">
        <Timer className="w-6 h-6 text-amber-400" />
        <div>
          <p className="text-2xl font-bold text-slate-50">{totalH}h {totalM}m</p>
          <p className="text-xs text-slate-400">Total time recorded</p>
        </div>
      </div>

      <div className="border border-gold-800 rounded-2xl p-5 bg-gold-900/40 space-y-3">
        <p className="text-sm font-semibold text-slate-100">Log Time</p>
        <div className="space-y-1.5"><label className={labelCls}>Description *</label><input className={inputCls} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Review SPA, requisitions, client meeting" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><label className={labelCls}>Minutes *</label><input type="number" min="1" className={inputCls} value={form.minutes} onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))} placeholder="e.g. 90" /></div>
          <div className="space-y-1.5"><label className={labelCls}>Date *</label><input type="date" className={inputCls} value={form.entry_date} onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))} /></div>
        </div>
        <button onClick={submit} disabled={logTime.isPending} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors">
          {logTime.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          <Plus className="w-4 h-4" /> Log time
        </button>
      </div>

      {(timeData?.entries ?? []).length === 0 ? (
        <div className="border border-gold-800 rounded-2xl p-6 text-center bg-gold-900/40"><p className="text-sm text-slate-400">No time entries yet.</p></div>
      ) : (
        <div className="space-y-2">
          {(timeData?.entries ?? []).map((entry) => (
            <div key={entry.id} className="border border-gold-800 rounded-xl bg-gold-900/40 p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">{entry.description}</p>
                <p className="text-xs text-slate-500">{fmtDate(entry.entry_date)}</p>
              </div>
              <span className="text-sm font-bold text-amber-400 shrink-0">{Math.floor(entry.minutes / 60)}h {entry.minutes % 60}m</span>
              <button onClick={() => deleteEntry.mutateAsync({ matterId, entryId: entry.id })} className="p-1.5 rounded text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function MatterDetail() {
  const [, params] = useRoute('/matters/:id');
  const [, navigate] = useLocation();
  const id = params?.id ? parseInt(params.id, 10) : null;
  const { data: matter, isLoading } = useMatter(id);
  const { data: work } = useMatterWork(id);
  const { toast } = useToast();

  const updateMatter = useUpdateMatter();
  const deleteMatter = useDeleteMatter();
  const addDeadline = useAddDeadline();
  const updateDeadline = useUpdateDeadline();
  const deleteDeadline = useDeleteDeadline();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '', clientName: '', counterparty: '', matterType: 'SPA', reference: '', status: 'open', notes: '',
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dForm, setDForm] = useState({ title: '', dueDate: '', notes: '' });
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (isLoading) return <div className="min-h-screen bg-gold-950 flex items-center justify-center text-amber-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!matter) {
    return (
      <div className="min-h-screen bg-gold-950 flex flex-col items-center justify-center gap-4 text-slate-300">
        <p>This matter could not be found.</p>
        <Link href="/matters"><a className="inline-flex items-center gap-2 text-sm text-amber-400"><ArrowLeft className="w-4 h-4" /> Back to matters</a></Link>
      </div>
    );
  }

  const openEdit = () => {
    setEditForm({ title: matter.title, clientName: matter.clientName ?? '', counterparty: matter.counterparty ?? '', matterType: matter.matterType ?? 'SPA', reference: matter.reference ?? '', status: matter.status, notes: matter.notes ?? '' });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.title.trim()) { toast({ title: 'Title required', variant: 'destructive' }); return; }
    try {
      await updateMatter.mutateAsync({ id: matter.id, title: editForm.title.trim(), clientName: editForm.clientName.trim() || null, counterparty: editForm.counterparty.trim() || null, matterType: editForm.matterType, reference: editForm.reference.trim() || null, status: editForm.status, notes: editForm.notes.trim() || null });
      toast({ title: 'Matter updated' });
      setEditOpen(false);
    } catch (e) {
      toast({ title: 'Could not update', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const doDelete = async () => {
    try { await deleteMatter.mutateAsync(matter.id); toast({ title: 'Matter deleted' }); navigate('/matters'); }
    catch (e) { toast({ title: 'Could not delete', description: e instanceof Error ? e.message : '', variant: 'destructive' }); }
  };

  const submitAdd = async () => {
    if (!dForm.title.trim() || !dForm.dueDate) { toast({ title: 'Title and due date required', variant: 'destructive' }); return; }
    try {
      await addDeadline.mutateAsync({ matterId: matter.id, title: dForm.title.trim(), dueDate: dForm.dueDate, notes: dForm.notes.trim() || undefined });
      toast({ title: 'Deadline added' });
      setAddOpen(false);
      setDForm({ title: '', dueDate: '', notes: '' });
    } catch (e) {
      toast({ title: 'Could not add deadline', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const toggleDone = async (d: MatterDeadline) => {
    try { await updateDeadline.mutateAsync({ matterId: matter.id, id: d.id, status: d.status === 'done' ? 'pending' : 'done' }); }
    catch { toast({ title: 'Could not update', variant: 'destructive' }); }
  };

  const copyDoc = async (w: MatterWorkItem) => {
    try { await navigator.clipboard.writeText(w.content); toast({ title: 'Copied' }); }
    catch { toast({ title: 'Could not copy', variant: 'destructive' }); }
  };

  const downloadDoc = (w: MatterWorkItem) => {
    const safe = w.title.replace(/[^\w\d\s-]+/g, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'document';
    const blob = new Blob([w.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${safe}.txt`; document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  const deadlines = matter.deadlines ?? [];
  const pending = deadlines.filter((d) => d.status !== 'done');
  const done = deadlines.filter((d) => d.status === 'done');

  return (
    <div className="min-h-screen bg-gold-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        <Link href="/matters">
          <a className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-amber-400 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> All matters
          </a>
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {matter.reference && <span className="text-xs font-mono text-slate-500">{matter.reference}</span>}
              {matter.matterType && <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">{matterTypeLabel(matter.matterType)}</span>}
            </div>
            <h1 className="font-serif font-bold text-2xl text-slate-50">{matter.title}</h1>
            {matter.clientName && (
              <p className="text-sm text-slate-400 mt-1">{matter.clientName}{matter.counterparty ? ` · ${matter.counterparty}` : ''}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={openEdit} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-300 bg-gold-800 hover:bg-gold-700 border border-gold-700 px-3 py-2 rounded-lg transition-colors"><Pencil className="w-4 h-4" /> Edit</button>
            <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-400 bg-gold-800 hover:bg-gold-700 border border-gold-700 px-3 py-2 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 border-b border-gold-800 mb-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-gold-700'
              }`}
            >
              {tab.label}
              {tab.id === 'documents' && (work?.length ?? 0) > 0 && (
                <span className="ml-1 text-[10px] bg-amber-500/15 text-amber-400 rounded-full px-1.5">{work!.length}</span>
              )}
              {tab.id === 'timeline' && pending.length > 0 && (
                <span className="ml-1 text-[10px] bg-red-500/15 text-red-400 rounded-full px-1.5">{pending.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {matter.notes && (
              <div className="border border-gold-800 rounded-2xl p-5 bg-gold-900/40">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-2">Notes</p>
                <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{matter.notes}</p>
              </div>
            )}
            {/* AI tool launch */}
            <div className="border border-amber-500/20 rounded-2xl p-4 bg-gold-900/40 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold text-sm text-slate-100">Draft for this matter</p>
                <p className="text-xs text-slate-400">AI tools pre-filled with transaction context</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link href="/dashboard">
                  <a className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-gold-800 hover:bg-gold-700 border border-gold-700 px-2.5 py-1.5 rounded-lg transition-colors">
                    <FileText className="w-3.5 h-3.5" /> Open AI Tools
                  </a>
                </Link>
              </div>
            </div>
            <AiInsightsCard matterId={matter.id} />
          </div>
        )}

        {activeTab === 'progress' && (
          <TransactionProgress matterId={matter.id} currentStatus={matter.status} matterType={matter.matterType} />
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-amber-500" />
                <h2 className="font-serif font-bold text-lg text-slate-100">Deadline Timeline</h2>
                {pending.length > 0 && <span className="text-xs font-bold text-slate-400 bg-gold-800 px-2 py-0.5 rounded-md">{pending.length} pending</span>}
              </div>
              <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 px-3 py-2 rounded-lg transition-colors"><Plus className="w-4 h-4" /> Add</button>
            </div>

            {deadlines.length === 0 ? (
              <div className="border border-gold-800 rounded-2xl p-8 text-center bg-gold-900/40"><CalendarClock className="w-8 h-8 text-slate-600 mx-auto mb-2" /><p className="text-sm text-slate-400">No deadlines yet. Add key transaction dates — completion date, VP delivery, consent expiry.</p></div>
            ) : (
              <div className="relative pl-6">
                <div className="absolute left-2.5 top-0 bottom-0 w-px bg-gold-800" />
                <div className="space-y-3">
                  {[...pending, ...done].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map((d) => {
                    const isDone = d.status === 'done';
                    return (
                      <div key={d.id} className={`relative flex items-start gap-3 ${isDone ? 'opacity-60' : ''}`}>
                        <button
                          onClick={() => toggleDone(d)}
                          className={`absolute -left-2.5 mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all bg-gold-950 ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gold-700 hover:border-amber-500'}`}
                        >
                          {isDone && <Check className="w-3 h-3" />}
                        </button>
                        <div className="border border-gold-800 rounded-xl bg-gold-900/40 p-3 flex items-center gap-3 flex-1">
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium ${isDone ? 'line-through text-slate-500' : 'text-slate-100'}`}>{d.title}</span>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5"><Clock className="w-3 h-3" /> {fmtDate(d.dueDate)}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <CountdownBadge due={d.dueDate} status={d.status} />
                            <button onClick={() => deleteDeadline.mutateAsync({ matterId: matter.id, id: d.id })} className="p-1.5 rounded text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              <h2 className="font-serif font-bold text-lg text-slate-100">Filed Documents</h2>
              {(work?.length ?? 0) > 0 && <span className="text-xs font-bold text-slate-400 bg-gold-800 px-2 py-0.5 rounded-md">{work!.length}</span>}
            </div>
            {(work?.length ?? 0) === 0 ? (
              <div className="border border-gold-800 rounded-2xl p-8 text-center bg-gold-900/40"><FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" /><p className="text-sm text-slate-400">No documents filed yet. Save an AI draft into this matter from the AI workspace.</p></div>
            ) : (
              <div className="space-y-3">
                {work!.map((w) => {
                  const isOpen = !!expanded[w.id];
                  return (
                    <div key={w.id} className="border border-gold-800 rounded-2xl bg-gold-900/40 overflow-hidden">
                      <div className="flex items-center gap-3 p-4">
                        <button onClick={() => setExpanded((s) => ({ ...s, [w.id]: !s[w.id] }))} className="text-slate-400 hover:text-slate-200">
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-slate-100 truncate">{w.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{fmtDate(w.updatedAt)}</p>
                        </div>
                        <button onClick={() => copyDoc(w)} className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-gold-800 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                        <button onClick={() => downloadDoc(w)} className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-gold-800 transition-colors"><Download className="w-3.5 h-3.5" /></button>
                      </div>
                      {isOpen && (
                        <div className="border-t border-gold-800 bg-gold-950 p-4 max-h-[420px] overflow-y-auto">
                          <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300 leading-relaxed">{w.content}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'checklist' && <ChecklistTab matterId={matter.id} />}
        {activeTab === 'team' && <TeamTab matter={matter} />}
        {activeTab === 'time' && <TimeTab matterId={matter.id} />}
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gold-950/80 backdrop-blur-sm" onClick={() => setEditOpen(false)}>
          <div className="w-full max-w-lg bg-gold-900 border border-gold-700 rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif font-bold text-lg text-slate-50">Edit Matter</h2>
              <button onClick={() => setEditOpen(false)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5"><label className={labelCls}>Matter title *</label><input className={inputCls} value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className={labelCls}>Transaction type</label>
                  <select className={inputCls} value={editForm.matterType} onChange={(e) => setEditForm((f) => ({ ...f, matterType: e.target.value }))}>
                    {MATTER_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5"><label className={labelCls}>Stage</label>
                  <select className={inputCls} value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                    {CONVEY_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><label className={labelCls}>Purchaser / Client</label><input className={inputCls} value={editForm.clientName} onChange={(e) => setEditForm((f) => ({ ...f, clientName: e.target.value }))} /></div>
                <div className="space-y-1.5"><label className={labelCls}>Vendor / Other party</label><input className={inputCls} value={editForm.counterparty} onChange={(e) => setEditForm((f) => ({ ...f, counterparty: e.target.value }))} /></div>
              </div>
              <div className="space-y-1.5"><label className={labelCls}>File reference</label><input className={inputCls} value={editForm.reference} onChange={(e) => setEditForm((f) => ({ ...f, reference: e.target.value }))} /></div>
              <div className="space-y-1.5"><label className={labelCls}>Notes</label><textarea className={inputCls} rows={4} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} /></div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditOpen(false)} className="flex-1 text-sm font-semibold text-slate-300 bg-gold-800 hover:bg-gold-700 border border-gold-700 py-2.5 rounded-xl transition-colors">Cancel</button>
                <button onClick={saveEdit} disabled={updateMatter.isPending} className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 py-2.5 rounded-xl transition-colors">
                  {updateMatter.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gold-950/80 backdrop-blur-sm" onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-md bg-gold-900 border border-gold-700 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif font-bold text-lg text-slate-50 mb-3">Delete this matter?</h2>
            <p className="text-sm text-slate-400 mb-5">This permanently deletes <span className="text-slate-200 font-medium">"{matter.title}"</span> and all its data. Cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 text-sm font-semibold text-slate-300 bg-gold-800 hover:bg-gold-700 border border-gold-700 py-2.5 rounded-xl transition-colors">Cancel</button>
              <button onClick={doDelete} disabled={deleteMatter.isPending} className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 py-2.5 rounded-xl transition-colors">
                {deleteMatter.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add deadline modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gold-950/80 backdrop-blur-sm" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-md bg-gold-900 border border-gold-700 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif font-bold text-lg text-slate-50">Add Deadline</h2>
              <button onClick={() => setAddOpen(false)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5"><label className={labelCls}>Title *</label><input className={inputCls} value={dForm.title} onChange={(e) => setDForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Completion date" /></div>
              <div className="space-y-1.5"><label className={labelCls}>Due date *</label><input type="date" className={inputCls} value={dForm.dueDate} onChange={(e) => setDForm((f) => ({ ...f, dueDate: e.target.value }))} /></div>
              <div className="space-y-1.5"><label className={labelCls}>Notes</label><textarea className={inputCls} rows={2} value={dForm.notes} onChange={(e) => setDForm((f) => ({ ...f, notes: e.target.value }))} /></div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setAddOpen(false)} className="flex-1 text-sm font-semibold text-slate-300 bg-gold-800 hover:bg-gold-700 border border-gold-700 py-2.5 rounded-xl transition-colors">Cancel</button>
                <button onClick={submitAdd} disabled={addDeadline.isPending} className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 py-2.5 rounded-xl transition-colors">
                  {addDeadline.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
