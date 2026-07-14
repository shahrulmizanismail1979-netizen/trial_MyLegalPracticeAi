import { useState } from 'react';
import { Link } from 'wouter';
import {
  useBundles,
  useBundleTypes,
  useCreateBundle,
  type BundleInput,
} from '@/hooks/use-bundles';
import { useMatters } from '@/hooks/use-matters';
import {
  PageHeader,
  Card,
  CardContent,
  Badge,
  Button,
  Modal,
  Input,
  Label,
  Select,
} from '@/components/ui';
import { useToast } from '@/hooks/use-toast';
import { Layers, Plus, FileStack, ArrowRight, Scale, Hash, Sparkles } from 'lucide-react';

const EMPTY: BundleInput = {
  title: '',
  bundleType: 'common-agreed-A',
  court: '',
  suitNo: '',
  parties: '',
  startPage: 1,
  matterId: null,
};

export default function Bundles() {
  const { data: bundles, isLoading } = useBundles();
  const { data: types } = useBundleTypes();
  const { data: matters } = useMatters();
  const createBundle = useCreateBundle();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BundleInput>(EMPTY);

  const set = (k: keyof BundleInput, v: string | number | null) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title?.trim()) {
      toast({ title: 'Bundle title required', description: 'Give the bundle a short identifying title.', variant: 'destructive' });
      return;
    }
    try {
      await createBundle.mutateAsync(form);
      toast({ title: 'Bundle created', description: `“${form.title}” is ready — add documents to build the index.` });
      setOpen(false);
      setForm(EMPTY);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Please try again.';
      toast({
        title: msg.includes('subscription') || msg.includes('402') ? 'Premium feature' : 'Could not create bundle',
        description: msg,
        variant: 'destructive',
      });
    }
  };

  const typeName = (id: string) => types?.bundleTypes.find((t) => t.id === id)?.name ?? id;
  const list = bundles ?? [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Bundle Builder"
        description="Assemble court bundles — pleadings, the common agreed bundle (Parts A/B/C), witness statements under O.38 — with a tab-by-tab index and automatic, running pagination."
        action={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Bundle
          </Button>
        }
      />

      {isLoading ? (
        <div className="p-8 text-center text-primary animate-pulse">Loading bundles…</div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileStack className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-serif font-semibold text-foreground mb-1">No bundles yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Create a bundle, add each document with its page count, and the index and pagination build
              themselves — ready to settle and file for the pre-trial case management.
            </p>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Create your first bundle
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((b) => (
            <Link key={b.id} href={`/app/bundles/${b.id}`}>
              <Card className="flex flex-col hover:border-primary/50 transition-all cursor-pointer h-full group">
                <CardContent className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <Layers className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-[10px] text-muted-foreground font-medium text-right">{typeName(b.bundleType)}</span>
                  </div>
                  <h3 className="font-serif font-bold text-base text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {b.title}
                  </h3>
                  <div className="space-y-1.5 text-xs text-muted-foreground flex-1">
                    {b.parties && <div className="truncate">{b.parties}</div>}
                    {b.suitNo && (
                      <div className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 shrink-0" /><span className="truncate font-mono">{b.suitNo}</span></div>
                    )}
                    {b.court && (
                      <div className="flex items-center gap-1.5"><Scale className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{b.court}</span></div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-primary font-medium pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Open bundle <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="New Bundle">
        <div className="space-y-4">
          <div className="flex items-start gap-2 bg-primary/5 border border-primary/15 rounded-lg p-3">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">Only a title is required. Add documents after the bundle is created — the index and pagination compute automatically.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Bundle title *</Label>
            <Input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Common Agreed Bundle of Documents" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bundle type</Label>
              <Select value={form.bundleType ?? ''} onChange={(e) => set('bundleType', e.target.value)}>
                {types?.bundleTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>First page number</Label>
              <Input type="number" min={1} value={form.startPage ?? 1} onChange={(e) => set('startPage', Math.max(1, Number(e.target.value) || 1))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Parties</Label>
            <Input value={form.parties ?? ''} onChange={(e) => set('parties', e.target.value)} placeholder="e.g. ABC Bank Bhd v XYZ Sdn Bhd & Ors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Court</Label>
              <Input value={form.court ?? ''} onChange={(e) => set('court', e.target.value)} placeholder="e.g. High Court of Malaya at KL" />
            </div>
            <div className="space-y-1.5">
              <Label>Suit no.</Label>
              <Input value={form.suitNo ?? ''} onChange={(e) => set('suitNo', e.target.value)} placeholder="e.g. WA-22NCC-123-04/2026" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Link to matter (optional)</Label>
            <Select value={form.matterId ?? ''} onChange={(e) => set('matterId', e.target.value ? Number(e.target.value) : null)}>
              <option value="">No matter</option>
              {matters?.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </Select>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={createBundle.isPending}>
              {createBundle.isPending ? 'Creating…' : 'Create bundle'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
