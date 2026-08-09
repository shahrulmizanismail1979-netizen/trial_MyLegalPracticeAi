import React, { useState } from 'react';
import { Link, useRoute, useLocation } from 'wouter';
import {
  ArrowLeft, Pencil, Trash2, Plus, Check, Clock, AlertTriangle, CircleCheck,
  FileText, CalendarClock, Building2, Users, Hash, Copy, Download, X, Loader2,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import {
  useMatter,
  useMatterWork,
  useUpdateMatter,
  useDeleteMatter,
  useAddDeadline,
  useUpdateDeadline,
  useDeleteDeadline,
  matterTypeLabel,
  daysUntil,
  fmtDate,
  MATTER_TYPE_OPTIONS,
  type MatterDeadline,
  type MatterWorkItem,
} from '@/lib/matters';
import { useToast } from '@/hooks/use-toast';

const STATUS_OPTIONS = ['open', 'closed'];

const KIND_LABEL: Record<string, string> = {
  draft: 'Draft',
  checklist: 'Checklist',
  deadlines: 'Deadline schedule',
  analysis: 'Analysis',
};

function CountdownBadge({ due, status }: { due: string; status: string }) {
  if (status === 'done') {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><CircleCheck className="w-3.5 h-3.5" /> Done</span>;
  }
  const d = daysUntil(due);
  if (d < 0) return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400"><AlertTriangle className="w-3.5 h-3.5" /> {Math.abs(d)}d overdue</span>;
  if (d === 0) return <span className="text-[11px] font-bold text-red-400">Due today</span>;
  if (d <= 7) return <span className="text-[11px] font-bold text-amber-400">in {d}d</span>;
  return <span className="text-[11px] font-medium text-slate-400">in {d}d</span>;
}

const inputCls =
  'w-full bg-gold-950 border border-gold-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500';
const labelCls = 'text-[11px] font-bold text-slate-400 uppercase tracking-wider';

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
    setEditForm({
      title: matter.title,
      clientName: matter.clientName ?? '',
      counterparty: matter.counterparty ?? '',
      matterType: matter.matterType ?? 'SPA',
      reference: matter.reference ?? '',
      status: matter.status,
      notes: matter.notes ?? '',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.title.trim()) { toast({ title: 'Title required', variant: 'destructive' }); return; }
    try {
      await updateMatter.mutateAsync({
        id: matter.id,
        title: editForm.title.trim(),
        clientName: editForm.clientName.trim() || null,
        counterparty: editForm.counterparty.trim() || null,
        matterType: editForm.matterType,
        reference: editForm.reference.trim() || null,
        status: editForm.status,
        notes: editForm.notes.trim() || null,
      });
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
      navigate('/matters');
    } catch (e) {
      toast({ title: 'Could not delete', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
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
    try {
      await updateDeadline.mutateAsync({ matterId: matter.id, id: d.id, status: d.status === 'done' ? 'pending' : 'done' });
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

  const copyDoc = async (w: MatterWorkItem) => {
    try {
      await navigator.clipboard.writeText(w.content);
      toast({ title: 'Copied to clipboard' });
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  const downloadDoc = (w: MatterWorkItem) => {
    const safe = w.title.replace(/[^\w\d\s-]+/g, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'document';
    const blob = new Blob([w.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safe}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  };

  const deadlines = matter.deadlines ?? [];
  const pending = deadlines.filter((d) => d.status !== 'done');
  const done = deadlines.filter((d) => d.status === 'done');

  const infoRows: { icon: typeof Building2; label: string; value: string }[] = [];
  if (matter.matterType) infoRows.push({ icon: FileText, label: 'Type', value: matterTypeLabel(matter.matterType) });
  if (matter.clientName) infoRows.push({ icon: Building2, label: 'Client', value: matter.clientName });
  if (matter.counterparty) infoRows.push({ icon: Users, label: 'Other party', value: matter.counterparty });
  if (matter.reference) infoRows.push({ icon: Hash, label: 'File ref', value: matter.reference });

  return (
    <div className="min-h-screen bg-gold-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        <Link href="/matters">
          <a className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-amber-400 transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> All matters
          </a>
        </Link>

        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="font-serif font-bold text-2xl text-slate-50">{matter.title}</h1>
            <p className="text-sm text-slate-400 mt-1 capitalize">
              {matter.matterType ? matterTypeLabel(matter.matterType) : ''}{matter.status ? ` · ${matter.status}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={openEdit} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-300 bg-gold-800 hover:bg-gold-700 border border-gold-700 px-3 py-2 rounded-lg transition-colors"><Pencil className="w-4 h-4" /> Edit</button>
            <button onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-red-400 bg-gold-800 hover:bg-gold-700 border border-gold-700 px-3 py-2 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Key info */}
        {infoRows.length > 0 && (
          <div className="border border-gold-800 rounded-2xl p-5 bg-gold-900/40 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {infoRows.map((r) => {
              const Icon = r.icon;
              return (
                <div key={r.label} className="flex items-center gap-2.5 text-sm">
                  <Icon className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="text-slate-400">{r.label}:</span>
                  <span className="text-slate-100 font-medium truncate">{r.value}</span>
                </div>
              );
            })}
          </div>
        )}

        {matter.notes && (
          <div className="border border-gold-800 rounded-2xl p-5 bg-gold-900/40 mb-6">
            <p className="text-[11px] uppercase tracking-wide text-slate-400 font-bold mb-2">Notes</p>
            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{matter.notes}</p>
          </div>
        )}

        {/* Filed documents */}
        <div className="flex items-center gap-2 mb-4 mt-8">
          <FileText className="w-5 h-5 text-amber-500" />
          <h2 className="font-serif font-bold text-lg text-slate-100">Filed documents</h2>
          {(work?.length ?? 0) > 0 && <span className="text-xs font-bold text-slate-400 bg-gold-800 px-2 py-0.5 rounded-md">{work!.length}</span>}
        </div>
        {(work?.length ?? 0) === 0 ? (
          <div className="border border-gold-800 rounded-2xl p-8 text-center bg-gold-900/40 mb-8">
            <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No documents filed yet. Save an AI draft, checklist or deadline schedule into this matter from the AI tools.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-8">
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
                      <p className="text-xs text-slate-500 mt-0.5">{KIND_LABEL[w.kind] ?? w.kind} · {fmtDate(w.updatedAt)}</p>
                    </div>
                    <button onClick={() => copyDoc(w)} title="Copy" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-gold-800 transition-colors"><Copy className="w-3.5 h-3.5" /></button>
                    <button onClick={() => downloadDoc(w)} title="Download .txt" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-gold-800 transition-colors"><Download className="w-3.5 h-3.5" /></button>
                  </div>
                  {isOpen && (
                    <div className="border-t border-gold-800 bg-gold-950 p-4 max-h-[420px] overflow-y-auto custom-scrollbar">
                      <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300 leading-relaxed">{w.content}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Deadlines */}
        <div className="flex items-center justify-between mb-4 mt-8">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-amber-500" />
            <h2 className="font-serif font-bold text-lg text-slate-100">Deadlines</h2>
            {pending.length > 0 && <span className="text-xs font-bold text-slate-400 bg-gold-800 px-2 py-0.5 rounded-md">{pending.length} pending</span>}
          </div>
          <button onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 px-3 py-2 rounded-lg transition-colors"><Plus className="w-4 h-4" /> Add</button>
        </div>

        {deadlines.length === 0 ? (
          <div className="border border-gold-800 rounded-2xl p-8 text-center bg-gold-900/40">
            <CalendarClock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No deadlines yet. Add key transaction dates such as completion, VP delivery or consent expiry.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...pending, ...done].map((d) => {
              const isDone = d.status === 'done';
              return (
                <div key={d.id} className={`border border-gold-800 rounded-xl bg-gold-900/40 p-4 flex items-center gap-3 ${isDone ? 'opacity-60' : ''}`}>
                  <button
                    onClick={() => toggleDone(d)}
                    title={isDone ? 'Mark pending' : 'Mark done'}
                    className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gold-700 hover:border-amber-500'
                    }`}
                  >
                    {isDone && <Check className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${isDone ? 'line-through text-slate-500' : 'text-slate-100'}`}>{d.title}</span>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <Clock className="w-3 h-3" /> {fmtDate(d.dueDate)}
                      {d.basis && <span className="truncate">· {d.basis}</span>}
                    </div>
                    {d.notes && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{d.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CountdownBadge due={d.dueDate} status={d.status} />
                    <button onClick={() => removeDeadline(d)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-gold-800 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gold-950/80 backdrop-blur-sm" onClick={() => setEditOpen(false)}>
          <div className="w-full max-w-lg bg-gold-900 border border-gold-700 rounded-2xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif font-bold text-lg text-slate-50">Edit Matter</h2>
              <button onClick={() => setEditOpen(false)} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className={labelCls}>Matter title *</label>
                <input className={inputCls} value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelCls}>Matter type</label>
                  <select className={inputCls} value={editForm.matterType} onChange={(e) => setEditForm((f) => ({ ...f, matterType: e.target.value }))}>
                    {MATTER_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Status</label>
                  <select className={inputCls} value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelCls}>Client</label>
                  <input className={inputCls} value={editForm.clientName} onChange={(e) => setEditForm((f) => ({ ...f, clientName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Other party</label>
                  <input className={inputCls} value={editForm.counterparty} onChange={(e) => setEditForm((f) => ({ ...f, counterparty: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>File reference</label>
                <input className={inputCls} value={editForm.reference} onChange={(e) => setEditForm((f) => ({ ...f, reference: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Notes</label>
                <textarea className={inputCls} rows={4} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
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
            <p className="text-sm text-slate-400 mb-5">This permanently deletes <span className="text-slate-200 font-medium">“{matter.title}”</span> and all its deadlines. This cannot be undone.</p>
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
              <div className="space-y-1.5">
                <label className={labelCls}>Title *</label>
                <input className={inputCls} value={dForm.title} onChange={(e) => setDForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Completion date" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Due date *</label>
                <input type="date" className={inputCls} value={dForm.dueDate} onChange={(e) => setDForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Notes</label>
                <textarea className={inputCls} rows={2} value={dForm.notes} onChange={(e) => setDForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
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
