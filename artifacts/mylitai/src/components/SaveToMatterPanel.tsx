import { useState } from 'react';
import { Link } from 'wouter';
import { Button, Input, Label, Select } from '@/components/ui';
import { FolderKanban, FolderPlus, Check, Loader2, ArrowRight } from 'lucide-react';
import { useMatters, useCreateMatter, useMatter } from '@/hooks/use-matters';
import { useSaveWork } from '@/hooks/use-saved-work';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export interface PracticeMatterRef {
  id: string;
  name: string;
  areaName: string;
}

function generateFileRef(): string {
  const year = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 9000);
  return `MLA/${year}/${n}`;
}

/**
 * Shown after an AI draft completes inside the practice hub: turns the
 * drafting session into a matter file (create new or file into existing),
 * so the draft is saved against the matter and the matter carries the
 * practice-hub workflow/checklist link.
 */
export function SaveToMatterPanel({
  draftTitle,
  draftContent,
  parties,
  practiceMatter,
  linkedMatterId,
}: {
  draftTitle: string;
  draftContent: string;
  parties: string;
  practiceMatter: PracticeMatterRef;
  linkedMatterId?: number | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: matters } = useMatters();
  const { data: linkedMatter } = useMatter(linkedMatterId ?? null);
  const createMatter = useCreateMatter();
  const saveWork = useSaveWork();

  const [mode, setMode] = useState<'idle' | 'new' | 'existing'>(linkedMatterId ? 'existing' : 'idle');
  const [title, setTitle] = useState(parties || draftTitle);
  const [existingId, setExistingId] = useState<string>(linkedMatterId ? String(linkedMatterId) : '');
  const [savedMatter, setSavedMatter] = useState<{ id: number; title: string } | null>(null);

  const busy = createMatter.isPending || saveWork.isPending;

  const fileDraft = async (matterId: number, matterTitle: string) => {
    await saveWork.mutateAsync({
      kind: 'draft',
      title: draftTitle,
      matter: matterTitle,
      matterId,
      content: draftContent,
    });
    qc.invalidateQueries({ queryKey: ['matters', 'work', matterId] });
    setSavedMatter({ id: matterId, title: matterTitle });
    toast({ title: 'Filed into matter', description: `Saved “${draftTitle}” to ${matterTitle}.` });
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const fileRef = generateFileRef();
      const matter = await createMatter.mutateAsync({
        title: title.trim(),
        clientName: parties || null,
        matterType: practiceMatter.id,
        status: 'active',
        notes: `File Ref: ${fileRef}\nPractice area: ${practiceMatter.areaName} — ${practiceMatter.name}\nOpened from Your Online LA drafting.`,
      });
      await fileDraft(matter.id, matter.title);
    } catch (err) {
      toast({
        title: 'Could not create matter',
        description: err instanceof Error && err.message ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleExisting = async () => {
    const id = parseInt(existingId, 10);
    if (!id) return;
    const m = (matters ?? []).find(x => x.id === id) ?? (linkedMatter && linkedMatter.id === id ? linkedMatter : null);
    try {
      await fileDraft(id, m?.title ?? `Matter #${id}`);
    } catch (err) {
      toast({
        title: 'Could not save to matter',
        description: err instanceof Error && err.message ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (savedMatter) {
    return (
      <div className="bg-emerald-950/20 border border-emerald-800/30 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-emerald-300">
          <Check className="h-4 w-4" /> Filed into <span className="font-semibold">{savedMatter.title}</span>
        </div>
        <Link href={`/app/matters/${savedMatter.id}`} className="inline-flex items-center justify-center gap-1.5 rounded-md transition-all duration-200 border border-emerald-800/40 bg-transparent hover:bg-secondary text-emerald-300 h-9 px-3 text-sm">
          Open matter file <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-primary flex items-center gap-2">
        <FolderKanban className="h-4 w-4" /> Save this draft into a matter file?
      </p>
      <p className="text-xs text-muted-foreground">
        The matter keeps all your drafts together, carries the {practiceMatter.name} workflow &amp; checklist, and tracks deadlines from the Deadline Diary.
      </p>

      {mode === 'idle' && (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => setMode('new')} className="gap-1.5">
            <FolderPlus className="h-3.5 w-3.5" /> Create new matter
          </Button>
          {(matters?.length ?? 0) > 0 && (
            <Button size="sm" variant="outline" onClick={() => setMode('existing')} className="gap-1.5">
              <FolderKanban className="h-3.5 w-3.5" /> File into existing matter
            </Button>
          )}
        </div>
      )}

      {mode === 'new' && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Matter title</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Maybank v Ahmad — Loan Recovery" />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} disabled={busy || !title.trim()} className="gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderPlus className="h-3.5 w-3.5" />}
              Create &amp; file draft
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode('idle')} disabled={busy}>Back</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">A file reference is generated automatically; deadlines can be computed from the matter page.</p>
        </div>
      )}

      {mode === 'existing' && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Choose matter</Label>
          <Select value={existingId} onChange={e => setExistingId(e.target.value)}>
            <option value="">Select a matter…</option>
            {(matters ?? []).map(m => (
              <option key={m.id} value={String(m.id)}>{m.title}</option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleExisting} disabled={busy || !existingId} className="gap-1.5">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              File draft here
            </Button>
            {!linkedMatterId && <Button size="sm" variant="ghost" onClick={() => setMode('idle')} disabled={busy}>Back</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
