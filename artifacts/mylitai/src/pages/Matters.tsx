import { useState } from 'react';
import { Link } from 'wouter';
import {
  useMatters,
  useCreateMatter,
  ApiError,
  type MatterInput,
} from '@/hooks/use-matters';
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
  Briefcase,
  Plus,
  Scale,
  ArrowRight,
  Building2,
  Hash,
  Sparkles,
} from 'lucide-react';

const MATTER_TYPES = [
  'Banking Recovery',
  'Order for Sale (O.83)',
  'Summary Judgment (O.14)',
  'Guarantor Suit',
  'Winding Up',
  'Bankruptcy',
  'Foreclosure',
  'General Civil Litigation',
  'Appeal',
  'Other',
];

const ACTING_FOR = ['Plaintiff', 'Defendant', 'Applicant', 'Respondent', 'Petitioner', 'Intervener'];

const COURTS = [
  'Magistrates Court',
  'Sessions Court',
  'High Court of Malaya',
  'High Court of Sabah & Sarawak',
  'Court of Appeal',
  'Federal Court',
];

const STATUS_META: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  'on-hold': { label: 'On Hold', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  closed: { label: 'Closed', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? STATUS_META.active;
}

const EMPTY: MatterInput = {
  title: '',
  clientName: '',
  actingFor: 'Plaintiff',
  plaintiff: '',
  defendant: '',
  matterType: MATTER_TYPES[0],
  court: COURTS[2],
  suitNo: '',
  claimAmount: '',
  status: 'active',
  notes: '',
};

function formatMoney(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(n);
}

export default function Matters() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data: matters, isLoading } = useMatters(statusFilter || undefined);
  const createMatter = useCreateMatter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MatterInput>(EMPTY);

  const set = (k: keyof MatterInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title?.trim()) {
      toast({ title: 'Matter name required', description: 'Give the matter a short identifying title.', variant: 'destructive' });
      return;
    }
    try {
      await createMatter.mutateAsync(form);
      toast({ title: 'Matter created', description: `“${form.title}” is now in your workspace.` });
      setOpen(false);
      setForm(EMPTY);
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        toast({
          title: 'Premium feature',
          description: 'Creating matters needs an active subscription. Visit Subscription to upgrade.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Could not create matter', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' });
      }
    }
  };

  const list = matters ?? [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Matters"
        description="Your case files. Each matter holds the parties, suit number, claim and a live deadline diary — so every limitation date and procedural step lives in one place."
        action={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Matter
          </Button>
        }
      />

      <div className="flex items-center gap-2 mb-6">
        {['', 'active', 'on-hold', 'closed'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              statusFilter === s
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'text-muted-foreground border-border hover:border-primary/30'
            }`}
          >
            {s === '' ? 'All' : statusMeta(s).label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-primary animate-pulse">Loading your matters…</div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-serif font-semibold text-foreground mb-1">No matters yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Open a matter for each case you act in. Record the parties and suit number, then build a deadline
              diary from ROC 2012 triggers — service, appearance, defence, O.14, set-down and more.
            </p>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Create your first matter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((m) => {
            const sm = statusMeta(m.status);
            const money = formatMoney(m.claimAmount);
            return (
              <Link key={m.id} href={`/app/matters/${m.id}`}>
                <Card className="flex flex-col hover:border-primary/50 transition-all cursor-pointer h-full group">
                  <CardContent className="p-5 flex flex-col gap-3 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sm.color}`}>
                        {sm.label}
                      </span>
                      {m.matterType && (
                        <span className="text-[10px] text-muted-foreground font-medium">{m.matterType}</span>
                      )}
                    </div>
                    <h3 className="font-serif font-bold text-base text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {m.title}
                    </h3>
                    <div className="space-y-1.5 text-xs text-muted-foreground flex-1">
                      {m.clientName && (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{m.clientName}{m.actingFor ? ` · for the ${m.actingFor}` : ''}</span>
                        </div>
                      )}
                      {m.suitNo && (
                        <div className="flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate font-mono">{m.suitNo}</span>
                        </div>
                      )}
                      {m.court && (
                        <div className="flex items-center gap-1.5">
                          <Scale className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{m.court}</span>
                        </div>
                      )}
                    </div>
                    {money && (
                      <Badge variant="outline" className="self-start">{money}</Badge>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-primary font-medium pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Open matter <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="New Matter">
        <div className="space-y-4">
          <div className="flex items-start gap-2 bg-primary/5 border border-primary/15 rounded-lg p-3">
            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Only a title is required. You can fill the rest now or later — and add deadlines once the matter is open.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Matter title *</Label>
            <Input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Maybank v Ahmad bin Ali — Recovery" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Input value={form.clientName ?? ''} onChange={(e) => set('clientName', e.target.value)} placeholder="e.g. Malayan Banking Bhd" />
            </div>
            <div className="space-y-1.5">
              <Label>Acting for</Label>
              <Select value={form.actingFor ?? ''} onChange={(e) => set('actingFor', e.target.value)}>
                {ACTING_FOR.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plaintiff / Applicant</Label>
              <Input value={form.plaintiff ?? ''} onChange={(e) => set('plaintiff', e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Defendant / Respondent</Label>
              <Input value={form.defendant ?? ''} onChange={(e) => set('defendant', e.target.value)} placeholder="Full name" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Matter type</Label>
              <Select value={form.matterType ?? ''} onChange={(e) => set('matterType', e.target.value)}>
                {MATTER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Court</Label>
              <Select value={form.court ?? ''} onChange={(e) => set('court', e.target.value)}>
                {COURTS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Suit / Case no.</Label>
              <Input value={form.suitNo ?? ''} onChange={(e) => set('suitNo', e.target.value)} placeholder="e.g. WA-22NCC-123-04/2026" />
            </div>
            <div className="space-y-1.5">
              <Label>Claim amount (RM)</Label>
              <Input
                type="number"
                value={form.claimAmount ?? ''}
                onChange={(e) => set('claimAmount', e.target.value)}
                placeholder="e.g. 850000"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Background, security documents, facility details…" rows={3} />
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={createMatter.isPending}>
              {createMatter.isPending ? 'Creating…' : 'Create matter'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
