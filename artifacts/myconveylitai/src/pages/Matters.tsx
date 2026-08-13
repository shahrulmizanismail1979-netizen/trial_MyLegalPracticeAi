import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  FolderKanban, Plus, ArrowLeft, Loader2, FileText, CalendarClock, Building2, Users, X,
} from 'lucide-react';
import { MatterFileUpload, type ExtractedFile } from '@/components/MatterFileUpload';
import {
  useMatters,
  useCreateMatter,
  MATTER_TYPE_OPTIONS,
  matterTypeLabel,
  generateFileRef,
  fmtDate,
  type MatterInput,
} from '@/lib/matters';
import { useToast } from '@/hooks/use-toast';

const STATUS_FILTERS = ['all', 'open', 'closed'] as const;

export function Matters() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const { data: matters, isLoading } = useMatters(status === 'all' ? undefined : status);
  const createMatter = useCreateMatter();

  const [open, setOpen] = useState(false);
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([]);
  const [form, setForm] = useState<{ title: string; clientName: string; counterparty: string; matterType: string; propertyAddress: string; notes: string }>({
    title: '', clientName: '', counterparty: '', matterType: 'SPA', propertyAddress: '', notes: '',
  });

  const inputCls =
    'w-full bg-gold-950 border border-gold-700 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500';
  const labelCls = 'text-[11px] font-bold text-slate-400 uppercase tracking-wider';

  const submit = async () => {
    if (!form.title.trim()) {
      toast({ title: 'Matter title required', variant: 'destructive' });
      return;
    }
    try {
      const notesParts: string[] = [];
      if (form.propertyAddress.trim()) notesParts.push(`Property address: ${form.propertyAddress.trim()}`);
      if (form.notes.trim()) notesParts.push(form.notes.trim());
      const fileContext = extractedFiles.filter(f => f.text?.trim()).map(f => '=== ' + f.name + ' ===\n' + f.text.trim()).join('\n\n');
      if (fileContext) notesParts.push('--- Supporting Documents ---\n' + fileContext);
      const hasDocuments = extractedFiles.some(f => !!f.text?.trim());
      const matter = await createMatter.mutateAsync({
        title: form.title.trim(),
        clientName: form.clientName.trim() || null,
        counterparty: form.counterparty.trim() || null,
        matterType: form.matterType,
        reference: generateFileRef(),
        status: 'open',
        notes: notesParts.join('\n') || null,
        hasDocuments,
      } as MatterInput);
      toast({ title: 'Matter created', description: matter.reference ?? undefined });
      if (hasDocuments) {
        toast({ title: 'AI briefing in progress', description: 'An AI intake briefing is being generated from your uploaded documents. It will appear in the AI Insights tab.' });
      }
      setOpen(false);
      setExtractedFiles([]);
      setForm({ title: '', clientName: '', counterparty: '', matterType: 'SPA', propertyAddress: '', notes: '' });
      navigate(`/matters/${matter.id}`);
    } catch (e) {
      toast({ title: 'Could not create matter', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-gold-950 text-slate-200">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-amber-400 transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to workspace
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-3">
            <FolderKanban className="w-7 h-7 text-amber-500" />
            <div>
              <h1 className="font-serif font-bold text-2xl text-slate-50">Matter Files</h1>
              <p className="text-sm text-slate-400">Transaction files collecting your drafts, checklists & deadlines.</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 px-4 py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> New matter
          </button>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 mb-6">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border capitalize transition-colors ${
                status === s
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'text-slate-400 border-gold-800 hover:bg-gold-900'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-amber-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : (matters?.length ?? 0) === 0 ? (
          <div className="border border-gold-800 rounded-2xl p-12 text-center bg-gold-900/40">
            <FolderKanban className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="font-serif font-semibold text-slate-200 mb-1">No matter files yet</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-5">
              Create a matter file for a transaction, or save an AI draft/checklist/deadline schedule straight into one from the AI tools.
            </p>
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 px-4 py-2.5 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> New matter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matters!.map((m) => (
              <Link key={m.id} href={`/matters/${m.id}`} className="block border border-gold-800 rounded-2xl p-5 bg-gold-900/40 hover:border-amber-500/40 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="font-serif font-semibold text-slate-100 leading-snug">{m.title}</h3>
                    <span className={`shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                      m.status === 'closed'
                        ? 'text-slate-400 border-slate-600 bg-slate-500/10'
                        : 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                    }`}>{m.status}</span>
                  </div>
                  {m.reference && <p className="text-xs font-mono text-amber-500/80 mb-2">{m.reference}</p>}
                  <div className="space-y-1 text-xs text-slate-400">
                    {m.matterType && <p className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> {matterTypeLabel(m.matterType)}</p>}
                    {m.clientName && <p className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> {m.clientName}</p>}
                    {m.counterparty && <p className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {m.counterparty}</p>}
                    <p className="flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Updated {fmtDate(m.updatedAt)}</p>
                  </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gold-950/80 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg bg-gold-900 border border-gold-700 rounded-2xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif font-bold text-lg text-slate-50">New Matter File</h2>
              <button onClick={() => { setOpen(false); setExtractedFiles([]); }} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className={labelCls}>Matter title *</label>
                <input className={inputCls} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Ahmad — Purchase of No. 12 Jalan Damai" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelCls}>Matter type</label>
                  <select className={inputCls} value={form.matterType} onChange={(e) => setForm((f) => ({ ...f, matterType: e.target.value }))}>
                    {MATTER_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Client</label>
                  <input className={inputCls} value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} placeholder="Your client" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className={labelCls}>Other party</label>
                  <input className={inputCls} value={form.counterparty} onChange={(e) => setForm((f) => ({ ...f, counterparty: e.target.value }))} placeholder="Vendor / purchaser / bank" />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Property address</label>
                  <input className={inputCls} value={form.propertyAddress} onChange={(e) => setForm((f) => ({ ...f, propertyAddress: e.target.value }))} placeholder="Property / land description" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Notes</label>
                <textarea className={inputCls} rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Any extra context…" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Supporting Documents <span className="font-normal text-slate-500 text-xs normal-case">(optional — AI will read these)</span></label>
                <MatterFileUpload onFilesExtracted={setExtractedFiles} />
              </div>
              <p className="text-[11px] text-slate-500">A file reference (CVY/YYYY/NNNN) is generated automatically.</p>
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setOpen(false); setExtractedFiles([]); }} className="flex-1 text-sm font-semibold text-slate-300 bg-gold-800 hover:bg-gold-700 border border-gold-700 py-2.5 rounded-xl transition-colors">Cancel</button>
                <button onClick={submit} disabled={createMatter.isPending} className="flex-1 inline-flex items-center justify-center gap-2 text-sm font-bold text-slate-900 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 py-2.5 rounded-xl transition-colors">
                  {createMatter.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
