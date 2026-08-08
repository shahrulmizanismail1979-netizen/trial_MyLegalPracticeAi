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
import { FolderKanban, FolderPlus, Loader2, ArrowRight, CalendarClock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMatters, useCreateMatter } from '@/hooks/use-matters';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Matters() {
  const { data: matters, isLoading } = useMatters();
  const createMatter = useCreateMatter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const year = new Date().getFullYear();
      await createMatter.mutateAsync({
        title: title.trim(),
        clientName: clientName.trim() || null,
        status: 'active',
        notes: `File Ref: MLA/${year}/${Math.floor(1000 + Math.random() * 9000)}`,
      });
      setOpen(false);
      setTitle('');
      setClientName('');
      toast({ title: 'Matter created' });
    } catch (e) {
      toast({ title: 'Could not create matter', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-[hsl(var(--gold))]" /> Matters
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your matter files — drafts filed from the Drafting Studio, deadlines and case details in one place. Shared with MyLitAI.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setOpen(true)}>
          <FolderPlus className="h-4 w-4" /> New matter
        </Button>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted-foreground animate-pulse">Loading matters…</div>
      ) : (matters?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <FolderKanban className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-serif font-semibold text-foreground mb-1">No matters yet</p>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Create one here, or finish a draft in the Drafting Studio and choose “File into Matter”.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matters!.map(m => (
            <Link key={m.id} href={`/matters/${m.id}`}>
              <Card className="cursor-pointer hover:border-[hsl(var(--gold))]/50 transition-colors h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-serif font-semibold text-foreground">{m.title}</p>
                    <Badge variant="outline" className="capitalize shrink-0">{m.status}</Badge>
                  </div>
                  {m.clientName && <p className="text-sm text-muted-foreground mt-1">Client: {m.clientName}</p>}
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5" /> Updated {fmtDate(m.updatedAt)}
                    </p>
                    <span className="text-xs text-[hsl(var(--gold))] inline-flex items-center gap-1">
                      Open <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
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
