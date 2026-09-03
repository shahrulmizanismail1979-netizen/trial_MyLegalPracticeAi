import { useState } from 'react';
import { Link } from 'wouter';
import {
  useMatters,
  useCreateMatter,
  useBriefingSummary,
  usePrepareMatter,
  ApiError,
  type MatterInput,
  type MatterBriefing,
  daysUntil,
} from '@/hooks/use-matters';
import { useSavedWork, useDeleteWork, kindMeta, type SavedWork } from '@/hooks/use-saved-work';
import { MatterFileUpload, type ExtractedFile } from '@/components/MatterFileUpload';
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
import { renderMarkdownLite } from '@/pages/MatterDetail';
import { useToast } from '@/hooks/use-toast';
import {
  Briefcase,
  Plus,
  Scale,
  ArrowRight,
  Building2,
  Hash,
  Sparkles,
  CalendarClock,
  AlertTriangle,
  CircleCheck,
  Layers,
  ListChecks,
  Loader2,
  ChevronRight,
  FolderOpen,
  FileText,
  Eye,
  Clock,
  Trash2,
} from 'lucide-react';

const MATTER_TYPES = [
  'Banking Recovery',
  'Order for Sale (O.83)',
  'Summary Judgment (O.14)',
  'Guarantor Suit',
  'Winding Up',
  'Bankruptcy',
  'Foreclosure',
  'General Civil Litigation',
  'Appeal',
  'Other',
];

const ACTING_FOR = ['Plaintiff', 'Defendant', 'Applicant', 'Respondent', 'Petitioner', 'Intervener'];

const COURTS = [
  'Magistrates Court',
  'Sessions Court',
  'High Court of Malaya',
  'High Court of Sabah & Sarawak',
  'Court of Appeal',
  'Federal Court',
];

const LIT_STAGES = ['Pre-Trial', 'Trial', 'Judgment', 'Appeal', 'Closed'];

const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  'on-hold': { label: 'On Hold', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  closed: { label: 'Closed', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  'Pre-Trial': { label: 'Pre-Trial', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  Trial: { label: 'Trial', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  Judgment: { label: 'Judgment', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  Appeal: { label: 'Appeal', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  Closed: { label: 'Closed', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? STATUS_META.active;
}

function formatMoney(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(n);
}

function NextDeadlineBadge({ deadlines }: { deadlines?: { dueDate: string; title: string; status: string }[] }) {
  if (!deadlines?.length) return null;
  const pending = deadlines.filter(d => d.status !== 'done');
  if (!pending.length) return <span className="text-[10px] text-emerald-400 flex items-center gap-1"><CircleCheck className="h-3 w-3" /> All done</span>;
  const next = pending.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
  const d = daysUntil(next.dueDate);
  if (d < 0) return (
    <span className="text-[10px] font-bold text-red-400 flex items-center gap-1 truncate">
      <AlertTriangle className="h-3 w-3 shrink-0" />{next.title.slice(0, 24)} — {Math.abs(d)}d overdue
    </span>
  );
  if (d === 0) return <span className="text-[10px] font-bold text-red-400 flex items-center gap-1 truncate"><CalendarClock className="h-3 w-3 shrink-0" /> {next.title.slice(0, 24)} — due today</span>;
  if (d <= 7) return <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-1 truncate"><CalendarClock className="h-3 w-3 shrink-0" /> {next.title.slice(0, 24)} — in {d}d</span>;
  return <span className="text-[10px] text-muted-foreground flex items-center gap-1 truncate"><CalendarClock className="h-3 w-3 shrink-0" /> {next.title.slice(0, 24)} — in {d}d</span>;
}

const EMPTY: MatterInput = {
  title: '',
  clientName: '',
  actingFor: 'Plaintiff',
  plaintiff: '',
  defendant: '',
  matterType: MATTER_TYPES[0],
  court: COURTS[2],
  suitNo: '',
  claimAmount: '',
  status: 'active',
  notes: '',
};

function fmtDate(iso: string) {
  // Display-only DD/MM/YYYY (Malaysian). Does not affect stored values or API payloads.
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── "Prepare with AI" modal ────────────────────────────────────────────────────

function PrepareModal({
  matter,
  onClose,
}: {
  matter: MatterBriefing | null;
  onClose: () => void;
}) {
  const prepare = usePrepareMatter();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastId, setLastId] = useState<number | null>(null);

  const step = matter?.next_step?.label;

  const run = async () => {
    if (!matter) return;
    setResult(null);
    setError(null);
    try {
      const res = await prepare.mutateAsync({ matterId: matter.id, step });
      setResult(res.preparation);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preparation failed. Please try again.');
    }
  };

  // Auto-run once per opened matter.
  if (matter && matter.id !== lastId && !prepare.isPending) {
    setLastId(matter.id);
    setResult(null);
    setError(null);
    void run();
  }

  return (
    <Modal isOpen={matter != null} onClose={() => { setLastId(null); onClose(); }} title="Prepare with AI">
      {matter && (
        <div className="space-y-3">
          <div>
            <p className="font-serif font-semibold text-foreground">{matter.title}</p>
            {step && (
              <p className="text-sm text-muted-foreground mt-0.5">
                Preparing for: <span className="font-medium text-foreground">{step}</span>
              </p>
            )}
          </div>

          {prepare.isPending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin" /> Assembling context and drafting your preparation…
            </div>
          )}

          {error && !prepare.isPending && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 space-y-3">
              <p className="text-sm font-semibold text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Preparation failed
              </p>
              <p className="text-sm text-red-300">{error}</p>
              <Button variant="outline" size="sm" className="gap-2" onClick={run}>
                <Sparkles className="h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}

          {result && !prepare.isPending && (
            <div className="pt-2 border-t border-border/50 max-h-[55vh] overflow-y-auto">
              <div className="mt-3">{renderMarkdownLite(result)}</div>
              <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
                <p className="text-[10px] text-muted-foreground/60">AI-generated · verify against the file before relying on it.</p>
                <Button variant="outline" size="sm" className="gap-2" onClick={run}>
                  <Sparkles className="h-3.5 w-3.5" /> Re-run
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── "My Cases" dashboard overview ──────────────────────────────────────────────

function MyCasesSection({ onPrepare }: { onPrepare: (m: MatterBriefing) => void }) {
  const { data, isLoading, isError, error, refetch } = useBriefingSummary();

  if (isLoading) {
    return (
      <div className="mb-8">
        <MyCasesHeading />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-5 h-44 animate-pulse" /></Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mb-8">
        <MyCasesHeading />
        <Card className="border-red-500/20">
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-semibold text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Couldn't load your cases
            </p>
            <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : 'Please try again.'}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const matters = data?.matters ?? [];
  if (matters.length === 0) {
    return (
      <div className="mb-8">
        <MyCasesHeading />
        <Card>
          <CardContent className="p-10 text-center">
            <Briefcase className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="text-base font-serif font-semibold text-foreground mb-1">No matters yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">Create a matter below to see your case overview here.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <MyCasesHeading />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {matters.map((m) => <MyCaseCard key={m.id} m={m} onPrepare={onPrepare} />)}
      </div>
    </div>
  );
}

function MyCasesHeading() {
  return (
    <div className="mb-4">
      <h2 className="font-serif text-xl font-bold text-foreground flex items-center gap-2">
        <Layers className="h-5 w-5 text-primary" /> My Cases
      </h2>
      <p className="text-sm text-muted-foreground mt-0.5">
        Where each matter stands, its next step, and one-click AI preparation.
      </p>
    </div>
  );
}

function MyCaseCard({ m, onPrepare }: { m: MatterBriefing; onPrepare: (m: MatterBriefing) => void }) {
  const isClosed = m.status?.toLowerCase() === 'closed';
  const sm = statusMeta(m.status);
  const nd = m.next_deadline;
  const ndDays = nd ? daysUntil(nd.due_date) : null;

  return (
    <Card className={`flex flex-col h-full ${isClosed ? 'opacity-60' : 'hover:border-primary/50'} transition-all`}>
      <CardContent className="p-5 flex flex-col gap-3 flex-1">
        <Link href={`/app/matters/${m.id}`}>
          <div className="cursor-pointer flex flex-col gap-2 group">
            <div className="flex items-start justify-between gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sm.color}`}>
                {sm.label}
              </span>
              {m.matter_type && (
                <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[120px]">{m.matter_type}</span>
              )}
            </div>
            <h3 className="font-serif font-bold text-base text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {m.title}
            </h3>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
              {m.stage_index >= 0 && m.stage_count > 0 && (
                <span className="inline-flex items-center gap-1"><Layers className="h-3 w-3" /> Stage {m.stage_index + 1} of {m.stage_count}</span>
              )}
              {m.checklist_total > 0 && (
                <span className="inline-flex items-center gap-1"><ListChecks className="h-3 w-3" /> {m.checklist_done}/{m.checklist_total} done</span>
              )}
            </div>
            {m.stage_index >= 0 && m.stage_count > 0 && (
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((m.stage_index + 1) / m.stage_count) * 100)}%` }} />
              </div>
            )}
            {nd && (
              <div className="flex items-center gap-2 text-[11px]">
                {m.overdue_count > 0 ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border text-red-400 bg-red-500/10 border-red-500/20">
                    <AlertTriangle className="h-3 w-3" /> {m.overdue_count} overdue
                  </span>
                ) : (
                  <CalendarClock className={`h-3.5 w-3.5 shrink-0 ${ndDays !== null && ndDays <= 7 ? 'text-amber-400' : 'text-muted-foreground'}`} />
                )}
                <span className="truncate text-muted-foreground">{nd.title}</span>
                <span className="text-muted-foreground/70 ml-auto shrink-0">{fmtDate(nd.due_date)}</span>
              </div>
            )}
          </div>
        </Link>

        {m.next_step && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
              Next: {m.next_step.label}
              {m.next_step.due_date && <span className="font-normal text-muted-foreground">· {fmtDate(m.next_step.due_date)}</span>}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 mt-auto pt-1">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => onPrepare(m)}>
            <Sparkles className="h-3.5 w-3.5" /> Prepare with AI
          </Button>
          <Link href={`/app/matters/${m.id}`} className="inline-flex items-center justify-center gap-1 rounded-md transition-all duration-200 bg-transparent hover:bg-secondary text-muted-foreground h-9 px-3 text-sm">
            Continue in Case Home <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Saved Drafts (not yet filed into a matter by ID) ──────────────────────────

function SavedDraftsSection() {
  const { data: allWork, isLoading } = useSavedWork();
  const deleteWork = useDeleteWork();
  const [viewing, setViewing] = useState<SavedWork | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SavedWork | null>(null);

  // Show all saved work that is NOT linked to a matter by ID.
  // This includes truly unfiled records AND records saved with only a text matter name
  // (e.g. from Chambers, Forms, BankingRecovery, DraftCauseModal) which have no matterId.
  const unlinked = (allWork ?? []).filter((w) => !w.matterId);

  if (isLoading || unlinked.length === 0) return null;

  // Group by matter name string (mirrors the old My Work grouping)
  const grouped = new Map<string, SavedWork[]>();
  for (const w of unlinked) {
    const key = w.matter?.trim() || 'Unfiled Drafts';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(w);
  }
  const groups = Array.from(grouped.entries());
  const totalCount = unlinked.length;

  return (
    <div className="mt-10">
      <div className="flex items-center gap-2 mb-2">
        <FolderOpen className="h-5 w-5 text-primary" />
        <h2 className="font-serif text-xl font-bold text-foreground">Saved Drafts</h2>
        <Badge variant="outline" className="ml-1">{totalCount}</Badge>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Drafts saved from AI tools that aren't linked to a matter yet. Open any matter and use the AI tools there to file new drafts directly into it.
      </p>

      <div className="space-y-8">
        {groups.map(([groupName, works]) => (
          <div key={groupName}>
            <div className="flex items-center gap-2 mb-3">
              <FolderOpen className="h-4 w-4 text-primary" />
              <h3 className="font-serif font-bold text-base text-foreground">{groupName}</h3>
              <Badge variant="outline" className="ml-1">{works.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {works.map((w) => {
                const meta = kindMeta(w.kind);
                return (
                  <Card key={w.id} className="flex flex-col hover:border-primary/50 transition-all">
                    <CardContent className="p-4 flex flex-col gap-3 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.color}`}>
                          {meta.label}
                        </span>
                        <FileText className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      </div>
                      <h3 className="font-medium text-sm text-foreground leading-snug line-clamp-2">{w.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
                        {w.content.replace(/[#*`>-]/g, '').slice(0, 120) || 'No content'}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {fmtDate(w.updatedAt)}
                      </div>
                      <div className="flex gap-1.5 pt-1">
                        <Button size="sm" variant="outline" className="flex-1 gap-1.5 h-8 text-xs" onClick={() => setViewing(w)}>
                          <Eye className="h-3.5 w-3.5" /> Open
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(w)} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* View modal */}
      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title={viewing?.title ?? 'Saved Draft'}>
        {viewing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${kindMeta(viewing.kind).color}`}>
                {kindMeta(viewing.kind).label}
              </span>
              <ExportButtons title={viewing.title} content={viewing.content} />
            </div>
            {viewing.matter && (
              <p className="text-xs text-muted-foreground">Matter: <span className="text-foreground">{viewing.matter}</span></p>
            )}
            <div className="bg-background border border-border rounded-xl p-5 max-h-[55vh] overflow-y-auto text-sm leading-relaxed">
              {renderMarkdownLite(viewing.content)}
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete saved draft?">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will permanently delete <span className="text-foreground font-medium">"{confirmDelete?.title}"</span>. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (confirmDelete) {
                  await deleteWork.mutateAsync(confirmDelete.id);
                  setConfirmDelete(null);
                }
              }}
              disabled={deleteWork.isPending}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function Matters() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [prepareMatter, setPrepareMatter] = useState<MatterBriefing | null>(null);
  const { data: matters, isLoading } = useMatters();
  const createMatter = useCreateMatter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MatterInput>(EMPTY);
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([]);

  const set = (k: keyof MatterInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title?.trim()) {
      toast({ title: 'Matter name required', description: 'Give the matter a short identifying title.', variant: 'destructive' });
      return;
    }
    try {
      const NOTES_BUDGET = 19_800;
      const manualPart = form.notes?.trim() ?? '';
      const SEP = '\n\n--- Supporting Documents ---\n';
      const fcBudget = Math.max(0, NOTES_BUDGET - manualPart.length - SEP.length);
      let fileContext = extractedFiles.filter(f => f.text?.trim()).map(f => '=== ' + f.name + ' ===\n' + f.text.trim()).join('\n\n');
      if (fileContext.length > fcBudget) {
        fileContext = fileContext.slice(0, Math.max(0, fcBudget - 60)) + '\n[… document text truncated — matter notes limit reached]';
      }
      const notes = fileContext ? (manualPart ? manualPart + SEP + fileContext : '--- Supporting Documents ---\n' + fileContext) : manualPart;
      const hasDocuments = extractedFiles.some(f => !!f.text?.trim());
      await createMatter.mutateAsync({ ...form, notes, hasDocuments });
      toast({ title: 'Matter created', description: `"${form.title}" is now in your workspace.` });
      if (hasDocuments) {
        toast({ title: 'AI briefing in progress', description: 'An AI intake briefing is being generated from your uploaded documents. It will appear in the AI Insights tab.' });
      }
      setOpen(false);
      setForm(EMPTY);
      setExtractedFiles([]);
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        toast({
          title: 'Premium feature',
          description: 'Creating matters needs an active subscription. Visit Subscription to upgrade.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Could not create matter', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' });
      }
    }
  };

  const list = matters ?? [];
  const filtered = statusFilter
    ? list.filter((matter) => matter.status?.toLowerCase() === statusFilter.toLowerCase())
    : list;
  const sorted = [...filtered].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Filter labels — include stage names too
  const allStages = ['', 'active', 'on-hold', ...LIT_STAGES.filter((stage) => stage !== 'Closed'), 'closed'];
  const filterLabels: Record<string, string> = {
    '': 'All',
    active: 'Active',
    'on-hold': 'On Hold',
    closed: 'Closed',
    ...Object.fromEntries(LIT_STAGES.map(s => [s, s])),
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Matters"
        description="Your active case files. Open a matter to access AI insights, the procedural checklist, deadline diary, and drafting tools — all in one place."
        action={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Matter
          </Button>
        }
      />

      {!statusFilter && <MyCasesSection onPrepare={setPrepareMatter} />}

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {allStages.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              statusFilter === s
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'text-muted-foreground border-border hover:border-primary/30'
            }`}
          >
            {filterLabels[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-primary animate-pulse">Loading your matters…</div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-serif font-semibold text-foreground mb-1">No matters yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Open a matter for each case you act in. Record the parties and suit number, then use AI to generate a procedural checklist, get case insights, and track every deadline automatically.
            </p>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Create your first matter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((m) => {
            const sm = statusMeta(m.status);
            const money = formatMoney(m.claimAmount);
            return (
              <Link key={m.id} href={`/app/matters/${m.id}`}>
                <Card className="flex flex-col hover:border-primary/50 transition-all cursor-pointer h-full group">
                  <CardContent className="p-5 flex flex-col gap-3 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sm.color}`}>
                        {sm.label}
                      </span>
                      {m.matterType && (
                        <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[120px]">{m.matterType}</span>
                      )}
                    </div>
                    <h3 className="font-serif font-bold text-base text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {m.title}
                    </h3>
                    <div className="space-y-1.5 text-xs text-muted-foreground flex-1">
                      {m.clientName && (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{m.clientName}{m.actingFor ? ` · for the ${m.actingFor}` : ''}</span>
                        </div>
                      )}
                      {m.suitNo && (
                        <div className="flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate font-mono">{m.suitNo}</span>
                        </div>
                      )}
                      {m.court && (
                        <div className="flex items-center gap-1.5">
                          <Scale className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{m.court}</span>
                        </div>
                      )}
                    </div>
                    {/* Next deadline countdown */}
                    <div className="pt-1 border-t border-border/50">
                      <NextDeadlineBadge deadlines={(m as { deadlines?: { dueDate: string; title: string; status: string }[] }).deadlines} />
                    </div>
                    {money && (
                      <Badge variant="outline" className="self-start">{money}</Badge>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-primary font-medium pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Continue in Case Home <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <SavedDraftsSection />

      <Modal isOpen={open} onClose={() => { setOpen(false); setExtractedFiles([]); }} title="New Matter">
        <div className="space-y-4">
          <div className="flex items-start gap-2 bg-primary/5 border border-primary/15 rounded-lg p-3">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Only a title is required. Once created, AI will auto-generate a procedural checklist and you can add deadlines, documents, and case insights.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Matter title *</Label>
            <Input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Maybank v Ahmad bin Ali — Recovery" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Input value={form.clientName ?? ''} onChange={(e) => set('clientName', e.target.value)} placeholder="e.g. Malayan Banking Bhd" />
            </div>
            <div className="space-y-1.5">
              <Label>Acting for</Label>
              <Select value={form.actingFor ?? ''} onChange={(e) => set('actingFor', e.target.value)}>
                {ACTING_FOR.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plaintiff / Applicant</Label>
              <Input value={form.plaintiff ?? ''} onChange={(e) => set('plaintiff', e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Defendant / Respondent</Label>
              <Input value={form.defendant ?? ''} onChange={(e) => set('defendant', e.target.value)} placeholder="Full name" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Matter type</Label>
              <Select value={form.matterType ?? ''} onChange={(e) => set('matterType', e.target.value)}>
                {MATTER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Court</Label>
              <Select value={form.court ?? ''} onChange={(e) => set('court', e.target.value)}>
                {COURTS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Suit / Case no.</Label>
              <Input value={form.suitNo ?? ''} onChange={(e) => set('suitNo', e.target.value)} placeholder="e.g. WA-22NCC-123-04/2026" />
            </div>
            <div className="space-y-1.5">
              <Label>Claim amount (RM)</Label>
              <Input
                type="number"
                value={form.claimAmount ?? ''}
                onChange={(e) => set('claimAmount', e.target.value)}
                placeholder="e.g. 850000"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Background, security documents, facility details…" rows={3} />
          </div>

          <div className="space-y-1.5">
            <Label>Supporting Documents <span className="font-normal text-muted-foreground text-xs">(optional — AI will read these)</span></Label>
            <MatterFileUpload onFilesExtracted={setExtractedFiles} />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); setExtractedFiles([]); }}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={createMatter.isPending}>
              {createMatter.isPending ? 'Creating…' : 'Create matter'}
            </Button>
          </div>
        </div>
      </Modal>

      <PrepareModal matter={prepareMatter} onClose={() => setPrepareMatter(null)} />
    </div>
  );
}
