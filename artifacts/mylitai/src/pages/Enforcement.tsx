import React, { useState } from 'react';
import { emitRateLimit, readRateLimitRemaining } from '@/lib/rate-limit-bus';
import { DraftDocument, DraftExportButtons } from '@workspace/draft-export/react';
import {
  Gavel,
  Loader2,
  AlertTriangle,
  Check,
  BookmarkPlus,
  CircleAlert,
  ScrollText,
  Coins,
  Target,
  ListChecks,
  ThumbsUp,
  ThumbsDown,
  Library,
  Compass,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Label,
  Input,
  Textarea,
  Select,
  PageHeader,
} from '@/components/ui';
import { useToast } from '@/hooks/use-toast';
import { useSaveWork } from '@/hooks/use-saved-work';
import { useMatters } from '@/hooks/use-matters';
import { MatterPicker, buildMatterSummary } from '@/components/MatterPicker';
import {
  useEnforcementMethods,
  debtorLabel,
  type EnforcementMethod,
} from '@/hooks/use-enforcement';

// ─── SSE streaming utility ────────────────────────────────────────────────────
async function streamFromEndpoint(
  endpoint: string,
  body: Record<string, unknown>,
  onChunk: (text: string) => void,
  onDone: (disclaimer?: string) => void,
  onError: (msg: string) => void,
) {
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    if (response.status === 429) { emitRateLimit(0); onError('Too many AI requests. Please try again shortly.'); return; }
    onError(response.status === 402 ? 'A subscription is required for this tool.' : 'Server error');
    return;
  }
  const rl = readRateLimitRemaining(response);
  if (rl !== null) emitRateLimit(rl);
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) { onError('No stream'); return; }
  let buffer = '';
  let finished = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.error) { finished = true; onError(data.error); return; }
        if (data.done) { finished = true; onDone(data.disclaimer); return; }
        if (data.content) onChunk(data.content);
      } catch { /* ignore partial */ }
    }
  }
  if (!finished) onDone();
}

// ─── Compact markdown renderer ───────────────────────────────────────────────
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part)) return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(part)) return <code key={i} className="bg-primary/10 text-primary px-1 rounded text-[11px]">{part.slice(1, -1)}</code>;
    return part;
  });
}

function LegalOutput({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="bg-background/60 border border-border rounded-lg p-5 max-h-[55vh] overflow-y-auto space-y-0.5 font-mono text-[13px] leading-relaxed">
      {lines.map((line, i) => {
        if (/^#{1,3}\s/.test(line)) {
          const level = line.match(/^(#+)/)?.[1].length ?? 1;
          const content = line.replace(/^#+\s*/, '');
          const cls = level === 1 ? 'text-lg font-serif font-bold text-primary mt-6 mb-2'
            : level === 2 ? 'text-base font-bold text-primary mt-5 mb-1'
            : 'text-sm font-bold text-foreground mt-4 mb-1 uppercase tracking-wide';
          return <div key={i} className={cls}>{renderInline(content)}</div>;
        }
        if (/^---/.test(line)) return <hr key={i} className="border-border my-3" />;
        if (/^(\d+)\.\s/.test(line)) {
          return (
            <div key={i} className="flex gap-2 my-0.5 ml-2">
              <span className="text-primary font-bold shrink-0 text-sm">{line.match(/^(\d+)\./)?.[1]}.</span>
              <span className="text-sm text-foreground/90 leading-relaxed">{renderInline(line.replace(/^\d+\.\s*/, ''))}</span>
            </div>
          );
        }
        if (/^[-•|]\s/.test(line)) {
          return (
            <div key={i} className="flex gap-2 my-0.5 ml-4">
              <span className="text-primary shrink-0 mt-1">•</span>
              <span className="text-sm text-foreground/90 leading-relaxed">{renderInline(line.replace(/^[-•|]\s*/, ''))}</span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return <p key={i} className="text-sm text-foreground/90 leading-relaxed my-0.5">{renderInline(line)}</p>;
      })}
    </div>
  );
}

const DEBTOR_BADGE: Record<EnforcementMethod['debtor'], string> = {
  individual: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  company: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  any: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

// ─── Shared output block (export / save / link to matter) ─────────────────────
function OutputBlock({
  output,
  disclaimer,
  generating,
  kind,
  title,
}: {
  output: string;
  disclaimer?: string;
  generating: boolean;
  kind: string;
  title: string;
}) {
  const { data: matters } = useMatters();
  const { toast } = useToast();
  const saveWork = useSaveWork();
  const [saved, setSaved] = useState(false);
  const [matterId, setMatterId] = useState('');

  const save = async () => {
    const id = matterId ? Number(matterId) : null;
    const matterName = id ? matters?.find((m) => m.id === id)?.title ?? null : null;
    try {
      await saveWork.mutateAsync({ kind, title, matter: matterName, matterId: id, content: output });
      setSaved(true);
      toast({ title: 'Draft saved', description: matterName ? `Filed into ${matterName}.` : 'Find it under Saved Drafts on the Matters page.' });
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast({ title: 'Could not save', description: 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">{title}</span>
        <DraftExportButtons title={title} content={output} />
      </div>
      <DraftDocument content={output} />
      {disclaimer && (
        <div className="flex gap-2 items-start p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-500/90 leading-relaxed">{disclaimer}</p>
        </div>
      )}
      {!generating && (
        <div className="flex items-end gap-2 flex-wrap pt-1">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Link to matter (optional)</Label>
            <Select className="mt-1" value={matterId} onChange={(e) => setMatterId(e.target.value)}>
              <option value="">No matter</option>
              {matters?.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </Select>
          </div>
          <Button variant="outline" size="sm" className="h-11 gap-1.5" onClick={save} disabled={saveWork.isPending}>
            {saved ? <><Check className="h-4 w-4" />Saved</> : <><BookmarkPlus className="h-4 w-4" />Save Draft</>}
          </Button>
        </div>
      )}
    </div>
  );
}

type Tab = 'advisor' | 'costs' | 'library';

export default function Enforcement() {
  const { data, isLoading, isError } = useEnforcementMethods();
  const [tab, setTab] = useState<Tab>('advisor');

  // Advisor state
  const [adv, setAdv] = useState({ debtorType: '', judgmentSum: '', judgmentDate: '', knownAssets: '', debtorProfile: '', priorSteps: '', additionalDetails: '' });
  const [advOut, setAdvOut] = useState('');
  const [advDisc, setAdvDisc] = useState<string | undefined>();
  const [advGen, setAdvGen] = useState(false);
  const [advErr, setAdvErr] = useState<string | null>(null);

  // Bill of costs state
  const [boc, setBoc] = useState({ court: '', suitNo: '', parties: '', basis: 'standard', costsOrder: '', workDone: '', attendances: '', disbursements: '', counselFees: '', additionalDetails: '' });
  const [bocOut, setBocOut] = useState('');
  const [bocDisc, setBocDisc] = useState<string | undefined>();
  const [bocGen, setBocGen] = useState(false);
  const [bocErr, setBocErr] = useState<string | null>(null);

  const runAdvise = async () => {
    setAdvGen(true); setAdvOut(''); setAdvDisc(undefined); setAdvErr(null);
    try {
      await streamFromEndpoint('/api/lit/enforcement/advise', adv,
        (t) => setAdvOut((p) => p + t),
        (d) => { setAdvDisc(d); setAdvGen(false); },
        (m) => { setAdvErr(m); setAdvGen(false); });
    } catch { setAdvErr('Could not generate. Please try again.'); setAdvGen(false); }
  };

  const runBoc = async () => {
    setBocGen(true); setBocOut(''); setBocDisc(undefined); setBocErr(null);
    try {
      await streamFromEndpoint('/api/lit/enforcement/bill-of-costs', boc,
        (t) => setBocOut((p) => p + t),
        (d) => { setBocDisc(d); setBocGen(false); },
        (m) => { setBocErr(m); setBocGen(false); });
    } catch { setBocErr('Could not generate. Please try again.'); setBocGen(false); }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'advisor', label: 'Strategy Advisor', icon: Compass },
    { id: 'costs', label: 'Bill of Costs (O.59)', icon: Coins },
    { id: 'library', label: 'Methods Library', icon: Library },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Enforcement & Costs"
        description="Get a prioritised post-judgment enforcement strategy, draft an Order 59 Bill of Costs, and browse the enforcement methods library."
      />

      <div className="flex gap-2 mb-6 border-b border-border">
        {tabs.map((tb) => {
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <tb.icon className="h-4 w-4" />{tb.label}
            </button>
          );
        })}
      </div>

      {/* Strategy Advisor */}
      {tab === 'advisor' && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Describe the judgment and what you know about the debtor. The advisor recommends a prioritised, sequenced enforcement strategy grounded in Orders 45–52 ROC 2012.
            </p>
            <MatterPicker
              onSelect={(m) => {
                const summary = buildMatterSummary(m);
                setAdv((prev) => ({
                  ...prev,
                  judgmentSum: m.claimAmount ? `RM ${m.claimAmount}` : prev.judgmentSum,
                  additionalDetails: summary || prev.additionalDetails,
                }));
              }}
            />
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>Debtor type</Label>
                <Select className="mt-1" value={adv.debtorType} onChange={(e) => setAdv({ ...adv, debtorType: e.target.value })}>
                  <option value="">Select…</option>
                  <option value="individual">Individual</option>
                  <option value="company">Company</option>
                </Select>
              </div>
              <div>
                <Label>Judgment sum</Label>
                <Input className="mt-1" placeholder="e.g. RM 850,000.00" value={adv.judgmentSum} onChange={(e) => setAdv({ ...adv, judgmentSum: e.target.value })} />
              </div>
              <div>
                <Label>Date of judgment</Label>
                <Input type="date" className="mt-1" value={adv.judgmentDate} onChange={(e) => setAdv({ ...adv, judgmentDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Known assets of the debtor</Label>
              <Textarea className="mt-1" rows={2} placeholder="Bank accounts, land, vehicles, shares… leave blank if unknown" value={adv.knownAssets} onChange={(e) => setAdv({ ...adv, knownAssets: e.target.value })} />
            </div>
            <div>
              <Label>Debtor profile / circumstances</Label>
              <Textarea className="mt-1" rows={2} placeholder="Trading status, solvency, other creditors, conduct…" value={adv.debtorProfile} onChange={(e) => setAdv({ ...adv, debtorProfile: e.target.value })} />
            </div>
            <div>
              <Label>Steps already taken (optional)</Label>
              <Input className="mt-1" placeholder="e.g. WSS attempted, account empty" value={adv.priorSteps} onChange={(e) => setAdv({ ...adv, priorSteps: e.target.value })} />
            </div>
            <Button onClick={runAdvise} disabled={advGen} className="w-full gap-2">
              {advGen ? <><Loader2 className="h-4 w-4 animate-spin" /> Advising…</> : <><Compass className="h-4 w-4" /> Recommend strategy</>}
            </Button>
            {advErr && <div className="flex items-center gap-2 text-sm text-destructive"><CircleAlert className="h-4 w-4" />{advErr}</div>}
            {advOut && <OutputBlock output={advOut} disclaimer={advDisc} generating={advGen} kind="enforcement" title="Enforcement strategy" />}
          </CardContent>
        </Card>
      )}

      {/* Bill of Costs */}
      {tab === 'costs' && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Draft an Order 59 Bill of Costs for taxation — Part I (work done), Part II (taxation), Part III (disbursements). Anything left blank becomes a placeholder.
            </p>
            <MatterPicker
              onSelect={(m) => {
                const parties = [m.plaintiff, m.defendant].filter(Boolean).join(' v. ')
                  || m.clientName
                  || '';
                setBoc((prev) => ({
                  ...prev,
                  court: m.court || prev.court,
                  suitNo: m.suitNo || prev.suitNo,
                  parties: parties || prev.parties,
                }));
              }}
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Court / registry</Label>
                <Input className="mt-1" placeholder="e.g. High Court of Malaya at Kuala Lumpur" value={boc.court} onChange={(e) => setBoc({ ...boc, court: e.target.value })} />
              </div>
              <div>
                <Label>Suit / cause number</Label>
                <Input className="mt-1" placeholder="e.g. WA-22NCC-123-04/2026" value={boc.suitNo} onChange={(e) => setBoc({ ...boc, suitNo: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Parties</Label>
              <Input className="mt-1" placeholder="e.g. ABC Bank Bhd (Plaintiff) v. XYZ Sdn Bhd (Defendant)" value={boc.parties} onChange={(e) => setBoc({ ...boc, parties: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Basis of taxation</Label>
                <Select className="mt-1" value={boc.basis} onChange={(e) => setBoc({ ...boc, basis: e.target.value })}>
                  {data?.costsBases.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </div>
              <div>
                <Label>Costs order being taxed</Label>
                <Input className="mt-1" placeholder="e.g. 'costs to be taxed' per order dated …" value={boc.costsOrder} onChange={(e) => setBoc({ ...boc, costsOrder: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Work done (getting-up, drafting, perusals, correspondence)</Label>
              <Textarea className="mt-1" rows={2} placeholder="Describe the work; leave blank for standard heads with placeholders" value={boc.workDone} onChange={(e) => setBoc({ ...boc, workDone: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Attendances / hearings</Label>
                <Textarea className="mt-1" rows={2} placeholder="Case management, hearings, trial days…" value={boc.attendances} onChange={(e) => setBoc({ ...boc, attendances: e.target.value })} />
              </div>
              <div>
                <Label>Counsel's fees</Label>
                <Textarea className="mt-1" rows={2} placeholder="Getting-up / brief / refreshers" value={boc.counselFees} onChange={(e) => setBoc({ ...boc, counselFees: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Disbursements</Label>
              <Textarea className="mt-1" rows={2} placeholder="Filing fees, service, sealed copies, travelling…" value={boc.disbursements} onChange={(e) => setBoc({ ...boc, disbursements: e.target.value })} />
            </div>
            <Button onClick={runBoc} disabled={bocGen} className="w-full gap-2">
              {bocGen ? <><Loader2 className="h-4 w-4 animate-spin" /> Drafting…</> : <><ScrollText className="h-4 w-4" /> Draft Bill of Costs</>}
            </Button>
            {bocErr && <div className="flex items-center gap-2 text-sm text-destructive"><CircleAlert className="h-4 w-4" />{bocErr}</div>}
            {bocOut && <OutputBlock output={bocOut} disclaimer={bocDisc} generating={bocGen} kind="costs" title="Bill of Costs" />}
          </CardContent>
        </Card>
      )}

      {/* Methods Library */}
      {tab === 'library' && (
        <div>
          {isLoading && <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center"><Loader2 className="h-5 w-5 animate-spin" /> Loading…</div>}
          {isError && <div className="flex items-center gap-2 text-destructive py-12 justify-center"><CircleAlert className="h-5 w-5" /> Could not load the methods library.</div>}
          {data && (
            <div className="grid md:grid-cols-2 gap-4">
              {data.methods.map((m) => (
                <Card key={m.id}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Gavel className="h-5 w-5 text-primary shrink-0" />
                        <h3 className="font-serif text-lg font-semibold text-foreground leading-tight">{m.shortName}</h3>
                      </div>
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${DEBTOR_BADGE[m.debtor]}`}>{debtorLabel(m.debtor)}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{m.basis}</Badge>
                    <p className="text-sm text-foreground/85 leading-relaxed">{m.summary}</p>
                    <div className="flex gap-2 items-start text-xs text-muted-foreground">
                      <Target className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" /><span>{m.targets}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-400 mb-1"><ThumbsUp className="h-3 w-3" />Pros</span>
                        <ul className="space-y-0.5">{m.pros.map((p, i) => <li key={i} className="text-[11px] text-foreground/75 leading-snug">• {p}</li>)}</ul>
                      </div>
                      <div>
                        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-rose-400 mb-1"><ThumbsDown className="h-3 w-3" />Cons</span>
                        <ul className="space-y-0.5">{m.cons.map((c, i) => <li key={i} className="text-[11px] text-foreground/75 leading-snug">• {c}</li>)}</ul>
                      </div>
                    </div>
                    <div>
                      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-foreground mb-1"><ListChecks className="h-3 w-3 text-primary" />Prerequisites</span>
                      <ul className="space-y-0.5">{m.prerequisites.map((p, i) => <li key={i} className="text-[11px] text-foreground/75 leading-snug">• {p}</li>)}</ul>
                    </div>
                    <div className="flex gap-2 items-start text-[11px] text-amber-500/90 border-t border-border pt-2">
                      <Coins className="h-3.5 w-3.5 shrink-0 mt-0.5" /><span>{m.courtFee}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
