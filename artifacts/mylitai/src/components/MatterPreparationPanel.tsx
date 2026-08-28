import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { BookOpen, Check, CheckCircle2, Circle, ExternalLink, FileCheck2, Plus, Scale, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMatterPreparation, useUpdateMatterPreparation, type MatterPreparationState } from '@/hooks/use-matters';
import { Badge, Button, Card, CardContent, Input, Label, Textarea } from '@/components/ui';

type PreparationNotes = Pick<MatterPreparationState, 'issues' | 'evidence' | 'relief'>;
const EMPTY_STATE: MatterPreparationState = {
  issues: '',
  evidence: '',
  relief: '',
  filingReadiness: {},
  benchmarks: [],
  practiceChecklists: {},
  causePaperPacks: {},
};

const READINESS_ITEMS = [
  'Parties and capacity verified against source documents',
  'Material facts and chronology checked',
  'Issues and elements requiring proof identified',
  'Evidence mapped to each disputed issue',
  'Relief, interest and costs pleaded or addressed',
  'Authorities checked against an official or authorised source',
  'Cause papers, exhibits and pagination reviewed',
  'Service, filing fee and court deadline confirmed',
];

export function MatterPreparationPanel({
  matterId,
  plaintiff,
  defendant,
  documentCount,
}: {
  matterId: number;
  plaintiff?: string | null;
  defendant?: string | null;
  documentCount: number;
}) {
  const { toast } = useToast();
  const { data, isLoading, error } = useMatterPreparation(matterId);
  const update = useUpdateMatterPreparation();
  const [state, setState] = useState<MatterPreparationState>(EMPTY_STATE);
  const [benchmarkForm, setBenchmarkForm] = useState({
    caseName: '',
    citation: '',
    proposition: '',
    pinpoint: '',
    sourceUrl: '',
  });

  useEffect(() => {
    if (data) setState(data);
  }, [data]);

  const save = (patch: Partial<MatterPreparationState>) => {
    update.mutate({ matterId, ...patch }, {
      onSuccess: saved => setState(saved),
      onError: saveError => toast({
        title: 'Could not save matter preparation',
        description: saveError instanceof Error ? saveError.message : 'Please try again.',
        variant: 'destructive',
      }),
    });
  };

  const notes: PreparationNotes = state;
  const readiness = state.filingReadiness;
  const benchmarks = state.benchmarks;
  const readyCount = READINESS_ITEMS.filter((_, index) => readiness[String(index)]).length;
  const readyPercent = Math.round((readyCount / READINESS_ITEMS.length) * 100);

  if (isLoading) {
    return <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground animate-pulse">Loading saved matter preparation…</div>;
  }
  if (error) {
    return <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">Could not load saved matter preparation. Refresh the page to try again.</div>;
  }

  const addBenchmark = () => {
    const values = Object.values(benchmarkForm).map(value => value.trim());
    if (values.some(value => !value)) {
      toast({ title: 'Complete every precedent field', description: 'A source link and paragraph or page pinpoint are required.', variant: 'destructive' });
      return;
    }
    try {
      const url = new URL(benchmarkForm.sourceUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
    } catch {
      toast({ title: 'Enter a valid source URL', variant: 'destructive' });
      return;
    }
    const next = [...benchmarks, { id: Date.now(), ...benchmarkForm }];
    setState(current => ({ ...current, benchmarks: next }));
    save({ benchmarks: next });
    setBenchmarkForm({ caseName: '', citation: '', proposition: '', pinpoint: '', sourceUrl: '' });
    toast({ title: 'Source-backed benchmark saved' });
  };

  return (
    <div className="space-y-5">
      <Card className="border-primary/25">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                <h2 className="font-serif font-semibold text-foreground">Case theory and proof map</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Working notes are additive and do not alter the original matter record.</p>
            </div>
            <Badge variant="outline">{plaintiff || 'Applicant not recorded'} v {defendant || 'Respondent not recorded'}</Badge>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {([
              ['issues', 'Issues for determination', 'Set out each legal/factual issue and the elements requiring proof.'],
              ['evidence', 'Evidence map', 'Map witnesses, documents and admissions to each issue; note gaps or objections.'],
              ['relief', 'Relief and orders sought', 'Record declarations, damages, interest, costs and consequential orders.'],
            ] as const).map(([key, label, placeholder]) => (
              <div key={key}>
                <Label htmlFor={`preparation-${key}`} className="text-xs font-semibold">{label}</Label>
                <Textarea
                  id={`preparation-${key}`}
                  value={notes[key]}
                  onChange={event => setState(current => ({ ...current, [key]: event.target.value }))}
                  onBlur={() => save({ [key]: notes[key] })}
                  placeholder={placeholder}
                  rows={7}
                  className="mt-1.5"
                  data-testid={`input-matter-${key}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
            <span>{documentCount} filed document{documentCount === 1 ? '' : 's'} available for the evidence map.</span>
            <span><Check className="mr-1 inline h-3.5 w-3.5 text-emerald-400" />{update.isPending ? 'Saving matter preparation…' : 'Saved to this matter'}</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-primary" />
                <h2 className="font-serif font-semibold">Filing readiness</h2>
              </div>
              <Badge variant={readyCount === READINESS_ITEMS.length ? 'default' : 'outline'}>{readyPercent}% ready</Badge>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${readyPercent}%` }} />
            </div>
            <div className="mt-4 space-y-1">
              {READINESS_ITEMS.map((item, index) => {
                const done = !!readiness[String(index)];
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      const filingReadiness = { ...readiness, [String(index)]: !done };
                      setState(current => ({ ...current, filingReadiness }));
                      save({ filingReadiness });
                    }}
                    className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-secondary"
                    data-testid={`button-readiness-${index}`}
                  >
                    {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                    <span className={done ? 'text-muted-foreground line-through' : 'text-foreground'}>{item}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">Practitioner control only. Complete the court’s current checklist and e-filing requirements before filing.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h2 className="font-serif font-semibold">Precedent benchmarks</h2>
              </div>
              <Link href="/app/case-law" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline" data-testid="link-search-judgment-library">
                Search Judgment Library <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Save only a verified official or authorised source with a precise paragraph or page pinpoint.</p>

            <div className="mt-4 grid gap-2">
              <Input value={benchmarkForm.caseName} onChange={event => setBenchmarkForm(form => ({ ...form, caseName: event.target.value }))} placeholder="Case name" data-testid="input-benchmark-case" />
              <div className="grid grid-cols-2 gap-2">
                <Input value={benchmarkForm.citation} onChange={event => setBenchmarkForm(form => ({ ...form, citation: event.target.value }))} placeholder="Citation / case no." data-testid="input-benchmark-citation" />
                <Input value={benchmarkForm.pinpoint} onChange={event => setBenchmarkForm(form => ({ ...form, pinpoint: event.target.value }))} placeholder="Pinpoint e.g. [34]–[38]" data-testid="input-benchmark-pinpoint" />
              </div>
              <Textarea value={benchmarkForm.proposition} onChange={event => setBenchmarkForm(form => ({ ...form, proposition: event.target.value }))} placeholder="Proposition supported by this pinpoint" rows={2} data-testid="input-benchmark-proposition" />
              <Input type="url" value={benchmarkForm.sourceUrl} onChange={event => setBenchmarkForm(form => ({ ...form, sourceUrl: event.target.value }))} placeholder="Official / authorised source URL" data-testid="input-benchmark-source" />
              <Button size="sm" onClick={addBenchmark} className="w-full gap-2" data-testid="button-add-benchmark"><Plus className="h-3.5 w-3.5" /> Add verified benchmark</Button>
            </div>

            <div className="mt-4 space-y-2">
              {benchmarks.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No precedent benchmarks saved yet.</p>}
              {benchmarks.map(benchmark => (
                <div key={benchmark.id} className="rounded-lg border border-border p-3" data-testid={`card-benchmark-${benchmark.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{benchmark.caseName}</p>
                      <p className="text-xs text-primary">{benchmark.citation} · {benchmark.pinpoint}</p>
                    </div>
                    <button type="button" onClick={() => {
                      const next = benchmarks.filter(item => item.id !== benchmark.id);
                      setState(current => ({ ...current, benchmarks: next }));
                      save({ benchmarks: next });
                    }} className="text-muted-foreground hover:text-destructive" aria-label={`Remove ${benchmark.caseName}`} data-testid={`button-remove-benchmark-${benchmark.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-foreground/80">{benchmark.proposition}</p>
                  <a href={benchmark.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline" data-testid={`link-benchmark-source-${benchmark.id}`}>
                    Open supporting source <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}