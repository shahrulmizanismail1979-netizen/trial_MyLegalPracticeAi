import { useState } from 'react';
import { Link, useRoute } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  FileText,
  CalendarClock,
  AlertTriangle,
  CircleCheck,
  FolderKanban,
} from 'lucide-react';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { useMatter, useMatterWork, daysUntil, type MatterWorkItem } from '@/hooks/use-matters';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function Countdown({ due, status }: { due: string; status: string }) {
  if (status === 'done') {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><CircleCheck className="h-3.5 w-3.5" /> Done</span>;
  }
  const d = daysUntil(due);
  if (d < 0) return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> {Math.abs(d)}d overdue</span>;
  if (d === 0) return <span className="text-[11px] font-bold text-red-400">Due today</span>;
  if (d <= 7) return <span className="text-[11px] font-bold text-amber-400">in {d}d</span>;
  return <span className="text-[11px] text-muted-foreground">in {d}d</span>;
}

export default function MatterFile() {
  const [, params] = useRoute('/matters/:id');
  const id = params?.id ? parseInt(params.id, 10) : null;
  const { data: matter, isLoading } = useMatter(id);
  const { data: work } = useMatterWork(id);
  const [viewDoc, setViewDoc] = useState<MatterWorkItem | null>(null);

  if (isLoading) return <div className="p-10 text-center text-muted-foreground animate-pulse">Loading matter…</div>;
  if (!matter) {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground mb-4">This matter could not be found.</p>
        <Link href="/matters"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back to matters</Button></Link>
      </div>
    );
  }

  const deadlines = (matter.deadlines ?? []).filter(d => d.status !== 'done');

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/matters">
        <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[hsl(var(--gold))] transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" /> All matters
        </button>
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-[hsl(var(--gold))]" /> {matter.title}
          </h1>
          {matter.clientName && <p className="text-sm text-muted-foreground mt-1">Client: {matter.clientName}</p>}
        </div>
        <Badge variant="outline" className="capitalize">{matter.status}</Badge>
      </div>

      {matter.notes && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Notes</p>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{matter.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      <div className="flex items-center gap-2 mb-4 mt-8">
        <FileText className="h-5 w-5 text-[hsl(var(--gold))]" />
        <h2 className="font-serif font-bold text-lg text-foreground">Documents</h2>
        {(work?.length ?? 0) > 0 && <Badge variant="outline">{work!.length}</Badge>}
      </div>
      {(work?.length ?? 0) === 0 ? (
        <Card className="mb-8">
          <CardContent className="p-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No documents filed yet. Generate a draft in the Drafting Studio and choose “File into Matter”.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
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

      {/* Deadlines */}
      <div className="flex items-center justify-between mb-4 mt-8">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-[hsl(var(--gold))]" />
          <h2 className="font-serif font-bold text-lg text-foreground">Deadlines</h2>
          {deadlines.length > 0 && <Badge variant="outline">{deadlines.length} pending</Badge>}
        </div>
        <Link href="/diary"><Button variant="outline" size="sm" className="gap-1.5"><CalendarClock className="h-3.5 w-3.5" /> Open Diary</Button></Link>
      </div>
      {(matter.deadlines?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarClock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No deadlines recorded for this matter yet. Manage the full diary — including ROC-computed timelines — in MyLitAI or the Diary.</p>
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

      {/* Document viewer */}
      <Dialog open={!!viewDoc} onOpenChange={(o) => { if (!o) setViewDoc(null); }}>
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
