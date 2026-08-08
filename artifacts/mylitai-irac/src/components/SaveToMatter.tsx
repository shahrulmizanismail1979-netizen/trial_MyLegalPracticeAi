import { useState } from 'react';
import { Link } from 'wouter';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderKanban, FolderPlus, Check, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useMatters, useCreateMatter, fileWorkIntoMatter } from '@/hooks/use-matters';

const selectCls =
  'flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold))] mt-1';

function generateFileRef(): string {
  const year = new Date().getFullYear();
  return `MLA/${year}/${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Post-draft action: file the generated document into a matter file
 * (create a new matter or pick an existing one). Complements SaveToVault.
 */
export function SaveToMatter({
  kind,
  defaultTitle,
  content,
  disabled,
}: {
  kind: string;
  defaultTitle: string;
  content: string;
  disabled?: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: matters } = useMatters();
  const createMatter = useCreateMatter();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [title, setTitle] = useState(defaultTitle);
  const [matterTitle, setMatterTitle] = useState('');
  const [existingId, setExistingId] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMatter, setSavedMatter] = useState<{ id: number; title: string } | null>(null);

  const fileInto = async (matterId: number, mTitle: string) => {
    await fileWorkIntoMatter({ kind, title: title.trim() || defaultTitle, matter: mTitle, matterId, content });
    qc.invalidateQueries({ queryKey: ['matters', 'work', matterId] });
    setSavedMatter({ id: matterId, title: mTitle });
    setOpen(false);
    toast({ title: 'Filed into matter', description: `Saved to ${mTitle}.` });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === 'new') {
        if (!matterTitle.trim()) return;
        const matter = await createMatter.mutateAsync({
          title: matterTitle.trim(),
          status: 'active',
          notes: `File Ref: ${generateFileRef()}\nOpened from IRAC Drafting Studio.`,
        });
        await fileInto(matter.id, matter.title);
      } else {
        const id = parseInt(existingId, 10);
        if (!id) return;
        const m = (matters ?? []).find(x => x.id === id);
        await fileInto(id, m?.title ?? `Matter #${id}`);
      }
    } catch (e) {
      toast({
        title: 'Could not file into matter',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (savedMatter) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
          <Check className="h-4 w-4" /> Filed into {savedMatter.title}
        </span>
        <Link href={`/matters/${savedMatter.id}`}>
          <Button size="sm" variant="outline" className="gap-1.5">
            Open matter <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </span>
    );
  }

  return (
    <>
      <Button variant="outline" className="gap-2" disabled={disabled} onClick={() => setOpen(true)}>
        <FolderKanban className="h-4 w-4" /> File into Matter
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5" /> File into a matter
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Document title</Label>
              <Input className="mt-1" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={mode === 'new' ? 'default' : 'outline'}
                className="gap-1.5"
                onClick={() => setMode('new')}
              >
                <FolderPlus className="h-3.5 w-3.5" /> New matter
              </Button>
              <Button
                size="sm"
                variant={mode === 'existing' ? 'default' : 'outline'}
                className="gap-1.5"
                onClick={() => setMode('existing')}
                disabled={(matters?.length ?? 0) === 0}
              >
                <FolderKanban className="h-3.5 w-3.5" /> Existing matter
              </Button>
            </div>
            {mode === 'new' ? (
              <div>
                <Label>Matter title</Label>
                <Input
                  className="mt-1"
                  value={matterTitle}
                  onChange={e => setMatterTitle(e.target.value)}
                  placeholder="e.g. Maybank v Ahmad — Loan Recovery"
                />
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  A file reference is generated automatically; the matter appears under Case Files → Matters.
                </p>
              </div>
            ) : (
              <div>
                <Label>Choose matter</Label>
                <select className={selectCls} value={existingId} onChange={e => setExistingId(e.target.value)}>
                  <option value="">Select a matter…</option>
                  {(matters ?? []).map(m => (
                    <option key={m.id} value={String(m.id)}>{m.title}</option>
                  ))}
                </select>
              </div>
            )}
            <Button
              className="w-full gap-2"
              onClick={handleSave}
              disabled={saving || (mode === 'new' ? !matterTitle.trim() : !existingId)}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {mode === 'new' ? 'Create matter & file draft' : 'File draft here'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
