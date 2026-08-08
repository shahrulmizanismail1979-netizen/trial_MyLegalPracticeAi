import { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  Check,
  Wand2,
  AlertTriangle,
  CircleCheck,
  Building2,
  Scale,
  Hash,
  Banknote,
  Clock,
  FileText,
  ArrowRight,
  GitBranch,
} from 'lucide-react';

const STATUS_OPTIONS = ['active', 'on-hold', 'closed'];
const CATEGORY_OPTIONS = [
  'limitation',
  'appearance',
  'pleading',
  'interlocutory',
  'hearing',
  'enforcement',
  'appeal',
  'custom',
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMoney(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(n);
}

function CountdownBadge({ due, status }: { due: string; status: string }) {
  if (status === 'done') {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><CircleCheck className="h-3.5 w-3.5" /> Done</span>;
  }
  const d = daysUntil(due);
  if (d < 0) return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> {Math.abs(d)}d overdue</span>;
  if (d === 0) return <span className="text-[11px] font-bold text-red-400">Due today</span>;
  if (d <= 7) return <span className="text-[11px] font-bold text-amber-400">in {d}d</span>;
  return <span className="text-[11px] font-medium text-muted-foreground">in {d}d</span>;
}

export default function MatterDetail() {
  const [, params] = useRoute('/app/matters/:id');
  const id = params?.id ? parseInt(params.id, 10) : null;
  const { data: matter, isLoading } = useMatter(id);
  const { toast } = useToast();

  const updateMatter = useUpdateMatter();
  const deleteMatter = useDeleteMatter();
  const { data: triggers } = useDeadlineTriggers();
  const compute = useComputeDeadlines();
  const addDeadline = useAddDeadline();
  const addBulk = useAddDeadlinesBulk();
  const updateDeadline = useUpdateDeadline();
  const deleteDeadline = useDeleteDeadline();

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

  const { data: matterWork } = useMatterWork(id);
  const [viewDoc, setViewDoc] = useState<MatterWorkItem | null>(null);
  const hubEntry = matter?.matterType ? findMatter(matter.matterType) : null;

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
    toast({
      title: 'Premium feature',
      description: `${action} needs an active subscription. Visit Subscription to upgrade.`,
      variant: 'destructive',
    });

  const openEdit = () => {
    setEditForm({
      title: matter.title,
      clientName: matter.clientName ?? '',
      actingFor: matter.actingFor ?? '',
      plaintiff: matter.plaintiff ?? '',
      defendant: matter.defendant ?? '',
      matterType: matter.matterType ?? '',
      court: matter.court ?? '',
      suitNo: matter.suitNo ?? '',
      claimAmount: matter.claimAmount ?? '',
      status: matter.status,
      notes: matter.notes ?? '',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.title?.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
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

  const submitAdd = async () => {
    if (!dForm.title.trim() || !dForm.dueDate) {
      toast({ title: 'Title and due date required', variant: 'destructive' });
      return;
    }
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
    if (!trigger || !triggerDate) {
      toast({ title: 'Pick a trigger and its date', variant: 'destructive' });
      return;
    }
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
    if (chosen.length === 0) {
      toast({ title: 'Select at least one deadline', variant: 'destructive' });
      return;
    }
    try {
      await addBulk.mutateAsync({
        matterId: matter.id,
        deadlines: chosen.map((c) => ({ title: c.title, dueDate: c.dueDate, category: c.category, basis: c.basis, notes: c.notes })),
      });
      toast({ title: `${chosen.length} deadline(s) added to the diary` });
      setComputeOpen(false);
      setPreview([]);
      setTrigger('');
      setTriggerDate('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) premiumToast('Adding deadlines');
      else toast({ title: 'Could not save', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const toggleDone = async (d: MatterDeadline) => {
    try {
      await updateDeadline.mutateAsync({ matterId: matter.id, id: d.id, status: d.status === 'done' ? 'pending' : 'done' });
    } catch (e) {
      toast({ title: 'Could not update', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const openEditDeadline = (d: MatterDeadline) => {
    setEditingDeadline(d);
    setEdForm({
      title: d.title,
      dueDate: d.dueDate.slice(0, 10),
      category: d.category,
      basis: d.basis ?? '',
      notes: d.notes ?? '',
    });
  };

  const saveEditDeadline = async () => {
    if (!editingDeadline) return;
    if (!edForm.title.trim() || !edForm.dueDate) {
      toast({ title: 'Title and due date required', variant: 'destructive' });
      return;
    }
    try {
      await updateDeadline.mutateAsync({ matterId: matter.id, id: editingDeadline.id, ...edForm });
      toast({ title: 'Deadline updated' });
      setEditingDeadline(null);
    } catch (e) {
      toast({ title: 'Could not update', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const removeDeadline = async (d: MatterDeadline) => {
    try {
      await deleteDeadline.mutateAsync({ matterId: matter.id, id: d.id });
    } catch (e) {
      toast({ title: 'Could not delete', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const deadlines = matter.deadlines ?? [];
  const pending = deadlines.filter((d) => d.status !== 'done');
  const done = deadlines.filter((d) => d.status === 'done');
  const money = formatMoney(matter.claimAmount);
  const selectedTrigger = triggers?.find((t) => t.trigger === trigger);

  const infoRows: { icon: typeof Building2; label: string; value: string }[] = [];
  if (matter.clientName) infoRows.push({ icon: Building2, label: 'Client', value: `${matter.clientName}${matter.actingFor ? ` (for the ${matter.actingFor})` : ''}` });
  if (matter.plaintiff || matter.defendant) infoRows.push({ icon: Scale, label: 'Parties', value: `${matter.plaintiff || '—'} v ${matter.defendant || '—'}` });
  if (matter.court) infoRows.push({ icon: Scale, label: 'Court', value: matter.court });
  if (matter.suitNo) infoRows.push({ icon: Hash, label: 'Suit no.', value: matter.suitNo });
  if (money) infoRows.push({ icon: Banknote, label: 'Claim', value: money });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href="/app/matters">
        <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" /> All matters
        </button>
      </Link>

      <PageHeader
        title={matter.title}
        description={matter.matterType ? `${hubEntry ? `${hubEntry.area.name} — ${hubEntry.matter.name}` : matter.matterType}${matter.status ? ` · ${matter.status}` : ''}` : undefined}
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={openEdit}><Pencil className="h-4 w-4" /> Edit</Button>
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        }
      />

      {/* Key info */}
      {infoRows.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {infoRows.map((r) => {
              const Icon = r.icon;
              return (
                <div key={r.label} className="flex items-center gap-2.5 text-sm">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">{r.label}:</span>
                  <span className="text-foreground font-medium truncate">{r.value}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {matter.notes && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Notes</p>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{matter.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Practice hub link — workflow, checklist & next drafts for this file */}
      {hubEntry && (
        <Card className="mb-6 border-primary/25 bg-primary/5">
          <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <GitBranch className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-serif font-semibold text-foreground">{hubEntry.matter.name} — workflow &amp; checklist</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Continue working this file: the step-by-step workflow, matter checklist and remaining cause papers. Drafts made there are filed straight into this matter.
                </p>
              </div>
            </div>
            <Link href={`/app/practice/${hubEntry.matter.id}?matter=${matter.id}`}>
              <Button className="gap-2">Continue drafting <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Documents filed in this matter */}
      <div className="flex items-center gap-2 mb-4 mt-8">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="font-serif font-bold text-lg text-foreground">Documents</h2>
        {(matterWork?.length ?? 0) > 0 && <Badge variant="outline">{matterWork!.length}</Badge>}
      </div>
      {(matterWork?.length ?? 0) === 0 ? (
        <Card className="mb-8">
          <CardContent className="p-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No documents filed yet.{hubEntry ? ' Use “Continue drafting” above — completed drafts are saved into this matter automatically.' : ' Drafts saved from the drafting tools can be filed into this matter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
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

      {/* Deadline diary */}
      <div className="flex items-center justify-between mb-4 mt-8">
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
              Add a date manually, or compute a full set from a ROC 2012 trigger — e.g. service of writ
              auto-generates appearance, defence and other downstream dates.
            </p>
            <Button className="gap-2" onClick={() => setComputeOpen(true)}><Wand2 className="h-4 w-4" /> Compute from a trigger</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {[...pending, ...done].map((d) => {
            const cat = categoryMeta(d.category);
            const isDone = d.status === 'done';
            return (
              <Card key={d.id} className={`transition-all ${isDone ? 'opacity-60' : ''}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <button
                    onClick={() => toggleDone(d)}
                    title={isDone ? 'Mark pending' : 'Mark done'}
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
                    <button onClick={() => openEditDeadline(d)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => removeDeadline(d)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
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
          Computed dates apply ROC 2012 default periods and roll forward when they fall on a weekend (O.3 r.2).
          They are an aid, not a substitute for checking the Rules, practice directions and any court orders or
          extensions in your matter. <span className="text-amber-300 font-medium">Always verify before relying on a date.</span>
        </p>
      </div>

      {/* ── Edit matter modal ── */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Matter">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Matter title *</Label>
            <Input value={editForm.title ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Input value={editForm.clientName ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, clientName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editForm.status ?? 'active'} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plaintiff / Applicant</Label>
              <Input value={editForm.plaintiff ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, plaintiff: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Defendant / Respondent</Label>
              <Input value={editForm.defendant ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, defendant: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Suit / Case no.</Label>
              <Input value={editForm.suitNo ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, suitNo: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Claim amount (RM)</Label>
              <Input type="number" value={editForm.claimAmount ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, claimAmount: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Court</Label>
            <Input value={editForm.court ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, court: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={editForm.notes ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={saveEdit} disabled={updateMatter.isPending}>Save changes</Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete matter confirm ── */}
      <Modal isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this matter?">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This permanently deletes <span className="text-foreground font-medium">“{matter.title}”</span> and all its deadlines. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={doDelete} disabled={deleteMatter.isPending}>Delete</Button>
          </div>
        </div>
      </Modal>

      {/* ── Add deadline modal ── */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Deadline">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={dForm.title} onChange={(e) => setDForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. File defence" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Due date *</Label>
              <Input type="date" value={dForm.dueDate} onChange={(e) => setDForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={dForm.category} onChange={(e) => setDForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{categoryMeta(c).label}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Basis (rule / authority)</Label>
            <Input value={dForm.basis} onChange={(e) => setDForm((f) => ({ ...f, basis: e.target.value }))} placeholder="e.g. O.18 r.2 — 14 days after defence" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={dForm.notes} onChange={(e) => setDForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={submitAdd} disabled={addDeadline.isPending}>Add deadline</Button>
          </div>
        </div>
      </Modal>

      {/* ── Compute from trigger modal ── */}
      <Modal isOpen={computeOpen} onClose={() => { setComputeOpen(false); setPreview([]); }} title="Compute Deadlines from ROC 2012">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Trigger event</Label>
              <Select value={trigger} onChange={(e) => { setTrigger(e.target.value); setPreview([]); }}>
                <option value="">Select a trigger…</option>
                {triggers?.map((t) => <option key={t.trigger} value={t.trigger}>{t.label}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date of that event</Label>
              <Input type="date" value={triggerDate} onChange={(e) => { setTriggerDate(e.target.value); setPreview([]); }} />
            </div>
          </div>

          {selectedTrigger && (
            <p className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3">{selectedTrigger.description}</p>
          )}

          <Button variant="outline" className="w-full gap-2" onClick={runCompute} disabled={compute.isPending}>
            <Wand2 className="h-4 w-4" /> {compute.isPending ? 'Computing…' : 'Compute deadlines'}
          </Button>

          {preview.length > 0 && (
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              <p className="text-xs text-muted-foreground">Select the deadlines to add to the diary:</p>
              {preview.map((p, i) => {
                const cat = categoryMeta(p.category);
                return (
                  <label key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/40 cursor-pointer transition-all">
                    <input type="checkbox" checked={!!picked[i]} onChange={(e) => setPicked((pk) => ({ ...pk, [i]: e.target.checked }))} className="mt-1 accent-primary" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{p.title}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cat.color}`}>{cat.label}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{fmtDate(p.dueDate)} · {p.basis}</div>
                      {p.notes && <div className="text-xs text-muted-foreground/80 mt-0.5">{p.notes}</div>}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {preview.length > 0 && (
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setComputeOpen(false); setPreview([]); }}>Cancel</Button>
              <Button className="flex-1" onClick={saveComputed} disabled={addBulk.isPending}>Add selected to diary</Button>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Edit deadline modal ── */}
      <Modal isOpen={!!editingDeadline} onClose={() => setEditingDeadline(null)} title="Edit Deadline">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={edForm.title} onChange={(e) => setEdForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Due date *</Label>
              <Input type="date" value={edForm.dueDate} onChange={(e) => setEdForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={edForm.category} onChange={(e) => setEdForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{categoryMeta(c).label}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Basis (rule / authority)</Label>
            <Input value={edForm.basis} onChange={(e) => setEdForm((f) => ({ ...f, basis: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={edForm.notes} onChange={(e) => setEdForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setEditingDeadline(null)}>Cancel</Button>
            <Button className="flex-1" onClick={saveEditDeadline} disabled={updateDeadline.isPending}>Save changes</Button>
          </div>
        </div>
      </Modal>

      {/* View filed document */}
      <Modal isOpen={!!viewDoc} onClose={() => setViewDoc(null)} title={viewDoc?.title ?? 'Document'}>
        {viewDoc && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <ExportButtons title={viewDoc.title} content={viewDoc.content} />
            </div>
            <div className="bg-background border border-border rounded-lg p-4 max-h-[55vh] overflow-y-auto">
              <pre className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">{viewDoc.content}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
