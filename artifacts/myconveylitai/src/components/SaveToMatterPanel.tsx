import React, { useState } from 'react';
import { Link } from 'wouter';
import {
  FolderKanban, FolderPlus, Check, Loader2, ArrowRight,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  useMatters,
  useCreateMatter,
  useSaveWork,
  generateFileRef,
  MATTER_TYPE_OPTIONS,
} from '@/lib/matters';

/**
 * Shown under an AI generation result: turns the output into a filed document
 * inside a conveyancing matter (create new transaction file, or file into an
 * existing one). On success it links to the matter file.
 */
export function SaveToMatterPanel({
  title,
  kind,
  content,
}: {
  title: string;
  kind: string;
  content: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: matters } = useMatters();
  const createMatter = useCreateMatter();
  const saveWork = useSaveWork();

  const [mode, setMode] = useState<'idle' | 'new' | 'existing'>('idle');
  const [matterTitle, setMatterTitle] = useState(title);
  const [clientName, setClientName] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [matterType, setMatterType] = useState('SPA');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [existingId, setExistingId] = useState('');
  const [saved, setSaved] = useState<{ id: number; title: string } | null>(null);

  if (!content || !content.trim()) return null;

  const busy = createMatter.isPending || saveWork.isPending;

  const fileInto = async (matterId: number, mTitle: string) => {
    await saveWork.mutateAsync({
      kind,
      title,
      matter: mTitle,
      matterId,
      content,
    });
    qc.invalidateQueries({ queryKey: ['convey-matters', 'work', matterId] });
    setSaved({ id: matterId, title: mTitle });
    toast({ title: 'Filed into matter', description: `Saved “${title}” to ${mTitle}.` });
  };

  const handleCreate = async () => {
    if (!matterTitle.trim()) return;
    try {
      const fileRef = generateFileRef();
      const notesParts: string[] = [];
      if (propertyAddress.trim()) notesParts.push(`Property address: ${propertyAddress.trim()}`);
      notesParts.push('Opened from MyConveyLitAI AI tools.');
      const matter = await createMatter.mutateAsync({
        title: matterTitle.trim(),
        clientName: clientName.trim() || null,
        counterparty: counterparty.trim() || null,
        matterType,
        reference: fileRef,
        status: 'open',
        notes: notesParts.join('\n'),
      });
      await fileInto(matter.id, matter.title);
    } catch {
      toast({ title: 'Could not create matter', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const handleExisting = async () => {
    const id = parseInt(existingId, 10);
    if (!id) return;
    const m = (matters ?? []).find((x) => x.id === id);
    try {
      await fileInto(id, m?.title ?? `Matter #${id}`);
    } catch {
      toast({ title: 'Could not save to matter', description: 'Please try again.', variant: 'destructive' });
    }
  };

  if (saved) {
    return (
      <div className="mt-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-emerald-300">
          <Check className="w-4 h-4" /> Filed into <span className="font-semibold">{saved.title}</span>
        </div>
        <Link href={`/matters/${saved.id}`}>
          <a className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg transition-colors">
            Open matter file <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </Link>
      </div>
    );
  }

  const inputCls =
    'w-full bg-gold-950 border border-gold-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500';
  const labelCls = 'text-[11px] font-bold text-slate-400 uppercase tracking-wider';

  return (
    <div className="mt-4 bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-amber-400 flex items-center gap-2">
        <FolderKanban className="w-4 h-4" /> Save this into a matter file?
      </p>
      <p className="text-xs text-slate-400">
        The matter file keeps all your drafts, checklists and deadline schedules for a transaction together.
      </p>

      {mode === 'idle' && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setMode('new')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 bg-amber-500 hover:bg-amber-400 px-3 py-2 rounded-lg transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" /> Create new matter
          </button>
          {(matters?.length ?? 0) > 0 && (
            <button
              onClick={() => setMode('existing')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 bg-gold-800 hover:bg-gold-700 border border-gold-700 px-3 py-2 rounded-lg transition-colors"
            >
              <FolderKanban className="w-3.5 h-3.5" /> File into existing matter
            </button>
          )}
        </div>
      )}

      {mode === 'new' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Matter title</label>
            <input className={inputCls} value={matterTitle} onChange={(e) => setMatterTitle(e.target.value)} placeholder="e.g. Ahmad — Purchase of No. 12 Jalan Damai" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className={labelCls}>Matter type</label>
              <select className={inputCls} value={matterType} onChange={(e) => setMatterType(e.target.value)}>
                {MATTER_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Client</label>
              <input className={inputCls} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Your client" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className={labelCls}>Other party</label>
              <input className={inputCls} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="Vendor / purchaser / bank" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Property address</label>
              <input className={inputCls} value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} placeholder="Property / land" />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={busy || !matterTitle.trim()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-lg transition-colors"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
              Create &amp; file
            </button>
            <button onClick={() => setMode('idle')} disabled={busy} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg transition-colors">Back</button>
          </div>
          <p className="text-[11px] text-slate-500">A file reference (CVY/YYYY/NNNN) is generated automatically.</p>
        </div>
      )}

      {mode === 'existing' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className={labelCls}>Choose matter</label>
            <select className={inputCls} value={existingId} onChange={(e) => setExistingId(e.target.value)}>
              <option value="">Select a matter…</option>
              {(matters ?? []).map((m) => (
                <option key={m.id} value={String(m.id)}>{m.reference ? `${m.reference} — ` : ''}{m.title}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExisting}
              disabled={busy || !existingId}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-lg transition-colors"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              File here
            </button>
            <button onClick={() => setMode('idle')} disabled={busy} className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg transition-colors">Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
