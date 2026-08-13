import { useState } from 'react';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FolderKanban, FolderPlus, Loader2, ArrowRight, CalendarClock, AlertTriangle, CircleCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMatters, useCreateMatter, daysUntil } from '@/hooks/use-matters';
import { MatterFileUpload, type ExtractedFile } from '@/components/MatterFileUpload';

const LIT_STAGES = ['Pre-Trial', 'Trial', 'Judgment', 'Appeal', 'Closed'];

const STAGE_COLORS: Record<string, string> = {
  active: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  'on-hold': 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  closed: 'text-slate-400 border-slate-500/30 bg-slate-500/10',
  'Pre-Trial': 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  Trial: 'text-violet-400 border-violet-500/30 bg-violet-500/10',
  Judgment: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  Appeal: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  Closed: 'text-slate-400 border-slate-500/30 bg-slate-500/10',
};

function stageLabel(s: string) {
  if (s === 'active') return 'Active';
  if (s === 'on-hold') return 'On Hold';
  return s;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function NextDeadlineBadge({ deadlines }: { deadlines?: { dueDate: string; title: string; status: string }[] }) {
  if (!deadlines?.length) return null;
  const pending = deadlines.filter(d => d.status !== 'done');
  if (!pending.length) return <span className="text-[10px] text-emerald-400 flex items-center gap-1"><CircleCheck className="h-3 w-3" /> All done</span>;
  const next = pending.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
  const d = daysUntil(next.dueDate);
  if (d < 0) return <span className="text-[10px] font-bold text-red-400 flex items-center gap-1 truncate"><AlertTriangle className="h-3 w-3 shrink-0" />{next.title.slice(0, 22)} — {Math.abs(d)}d overdue</span>;
  if (d === 0) return <span className="text-[10px] font-bold text-red-400 flex items-center gap-1 truncate"><CalendarClock className="h-3 w-3 shrink-0" /> {next.title.slice(0, 22)} — due today</span>;
  if (d <= 7) return <span className="text-[10px] font-semibold text-amber-400 flex items-center gap-1 truncate"><CalendarClock className="h-3 w-3 shrink-0" /> {next.title.slice(0, 22)} — in {d}d</span>;
  return <span className="text-[10px] text-muted-foreground flex items-center gap-1 truncate"><CalendarClock className="h-3 w-3 shrink-0" /> {next.title.slice(0, 22)} — in {d}d</span>;
}

export default function Matters() {
  const { data: matters, isLoading } = useMatters();
  const createMatter = useCreateMatter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const year = new Date().getFullYear();
      const baseNotes = `File Ref: MLA/${year}/${Math.floor(1000 + Math.random() * 9000)}`;
      const NOTES_BUDGET = 19_800;
      const SEP = '\n\n--- Supporting Documents ---\n';
      const fcBudget = Math.max(0, NOTES_BUDGET - baseNotes.length - SEP.length);
      let fileContext = extractedFiles.filter(f => f.text?.trim()).map(f => '=== ' + f.name + ' ===\n' + f.text.trim()).join('\n\n');
      if (fileContext.length > fcBudget) {
        fileContext = fileContext.slice(0, Math.max(0, fcBudget - 60)) + '\n[… document text truncated — matter notes limit reached]';
      }
      const notes = fileContext ? baseNotes + SEP + fileContext : baseNotes;
      const hasDocuments = extractedFiles.some(f => !!f.text?.trim());
      await createMatter.mutateAsync({
        title: title.trim(),
        clientName: clientName.trim() || null,
        status: 'active',
        notes,
        hasDocuments,
      });
      setOpen(false);
      setTitle('');
      setClientName('');
      setExtractedFiles([]);
      toast({ title: 'Matter created', description: 'AI is generating a procedural checklist…' });
      if (hasDocuments) {
        toast({ title: 'AI briefing in progress', description: 'An AI intake briefing is being generated from your uploaded documents. It will appear in the AI Insights tab.' });
      }
    } catch (e) {
      toast({ title: 'Could not create matter', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  // Sort by most recently updated
  const sorted = [...(matters ?? [])].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-[hsl(var(--gold))]" /> Matters
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your active case files — AI insights, checklists, deadlines, and documents in one place.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setOpen(true)}>
          <FolderPlus className="h-4 w-4" /> New matter
        </Button>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground animate-pulse">Loading matters…</div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <FolderKanban className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-serif font-semibold text-foreground mb-1">No matters yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Create one here or finish a draft in the Drafting Studio and choose "File into Matter". AI will auto-generate a procedural checklist on creation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map(m => {
            const colorClass = STAGE_COLORS[m.status] ?? STAGE_COLORS.active;
            return (
              <Link key={m.id} href={`/matters/${m.id}`}>
                <Card className="cursor-pointer hover:border-[hsl(var(--gold))]/50 transition-colors h-full group">
                  <CardContent className="p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-serif font-semibold text-foreground group-hover:text-[hsl(var(--gold))] transition-colors leading-snug line-clamp-2">{m.title}</p>
                      <Badge variant="outline" className={`capitalize shrink-0 text-[10px] ${colorClass}`}>{stageLabel(m.status)}</Badge>
                    </div>
                    {m.clientName && <p className="text-sm text-muted-foreground">Client: {m.clientName}</p>}
                    <div className="border-t border-border/40 pt-2">
                      <NextDeadlineBadge deadlines={(m as { deadlines?: { dueDate: string; title: string; status: string }[] }).deadlines} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" /> Updated {fmtDate(m.updatedAt)}
                      </p>
                      <span className="text-xs text-[hsl(var(--gold))] inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Open <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setExtractedFiles([]); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New matter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Matter title</Label>
              <Input className="mt-1" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Maybank v Ahmad — Loan Recovery" />
            </div>
            <div>
              <Label>Client (optional)</Label>
              <Input className="mt-1" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Maybank Bhd" />
            </div>
            <div className="space-y-1.5">
              <Label>Supporting Documents <span className="font-normal text-muted-foreground text-xs">(optional — AI will read these)</span></Label>
              <MatterFileUpload onFilesExtracted={setExtractedFiles} />
            </div>
            <p className="text-xs text-muted-foreground">AI will auto-generate a procedural checklist after creation.</p>
            <Button className="w-full gap-2" onClick={handleCreate} disabled={createMatter.isPending || !title.trim()}>
              {createMatter.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
              Create matter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
