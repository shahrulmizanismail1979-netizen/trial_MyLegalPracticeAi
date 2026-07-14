import React, { useMemo, useState } from 'react';
import {
  Landmark,
  ShieldCheck,
  ListChecks,
  ScrollText,
  Loader2,
  AlertTriangle,
  Check,
  Copy,
  BookmarkPlus,
  CalendarPlus,
  ChevronRight,
  FileSignature,
  CircleAlert,
  Search,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Modal,
  PageHeader,
  Label,
  Input,
  Textarea,
  Select,
} from '@/components/ui';
import { useToast } from '@/hooks/use-toast';
import { useSaveWork } from '@/hooks/use-saved-work';
import { useMatters, useAddDeadlinesBulk } from '@/hooks/use-matters';
import {
  useRecoveryPathways,
  debtorLabel,
  timelineToDeadlines,
  type RecoveryTrack,
  type CausePaper,
} from '@/hooks/use-banking-recovery';

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
    onError(response.status === 402 ? 'A subscription is required to draft cause papers.' : 'Server error');
    return;
  }
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
  // Stream closed without a terminal frame — clear the loading state.
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
        if (/^[-•]\s/.test(line)) {
          return (
            <div key={i} className="flex gap-2 my-0.5 ml-4">
              <span className="text-primary shrink-0 mt-1">•</span>
              <span className="text-sm text-foreground/90 leading-relaxed">{renderInline(line.replace(/^[-•]\s*/, ''))}</span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return <p key={i} className="text-sm text-foreground/90 leading-relaxed my-0.5">{renderInline(line)}</p>;
      })}
    </div>
  );
}

const DEBTOR_BADGE: Record<RecoveryTrack['debtor'], string> = {
  individual: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  company: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  any: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export default function BankingRecovery() {
  const { data, isLoading, isError } = useRecoveryPathways();
  const { data: matters } = useMatters();
  const { toast } = useToast();
  const saveWork = useSaveWork();
  const addBulk = useAddDeadlinesBulk();

  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Draft modal state
  const [draftFor, setDraftFor] = useState<{ track: RecoveryTrack; paper: CausePaper } | null>(null);
  const [form, setForm] = useState({ court: '', parties: '', facts: '', security: '', amount: '', additionalDetails: '' });
  const [output, setOutput] = useState('');
  const [disclaimer, setDisclaimer] = useState<string | undefined>();
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveMatterId, setSaveMatterId] = useState<string>('');

  // Apply-timeline modal state
  const [timelineTrack, setTimelineTrack] = useState<RecoveryTrack | null>(null);
  const [timelineMatterId, setTimelineMatterId] = useState<string>('');
  const [anchorDate, setAnchorDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const activeTrack = useMemo(
    () => data?.tracks.find((t) => t.id === activeTrackId) ?? null,
    [data, activeTrackId],
  );

  const checklistDone = data ? data.dueDiligence.filter((d) => checked[d.id]).length : 0;

  const openDraft = (track: RecoveryTrack, paper: CausePaper) => {
    setDraftFor({ track, paper });
    setForm({ court: '', parties: '', facts: '', security: '', amount: '', additionalDetails: '' });
    setOutput('');
    setDisclaimer(undefined);
    setGenError(null);
    setSaved(false);
    setSaveMatterId('');
  };

  const runDraft = async () => {
    if (!draftFor) return;
    setGenerating(true);
    setOutput('');
    setDisclaimer(undefined);
    setGenError(null);
    try {
      await streamFromEndpoint(
        '/api/lit/banking-recovery/draft',
        { trackId: draftFor.track.id, causePaperId: draftFor.paper.id, ...form },
        (text) => setOutput((prev) => prev + text),
        (d) => { setDisclaimer(d); setGenerating(false); },
        (msg) => { setGenError(msg); setGenerating(false); },
      );
    } catch {
      setGenError('Could not generate the draft. Please try again.');
      setGenerating(false);
    }
  };

  const saveDraft = async () => {
    if (!draftFor || !output) return;
    const matterId = saveMatterId ? Number(saveMatterId) : null;
    const matterName = matterId ? matters?.find((m) => m.id === matterId)?.title ?? null : null;
    try {
      await saveWork.mutateAsync({
        kind: 'draft',
        title: `${draftFor.paper.name} — ${draftFor.track.shortName}`,
        matter: matterName,
        matterId,
        content: output,
      });
      setSaved(true);
      toast({ title: 'Saved to My Work', description: matterName ? `Linked to ${matterName}.` : 'Find it later under "My Work".' });
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast({ title: 'Could not save', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const applyTimeline = async () => {
    if (!timelineTrack || !timelineMatterId) return;
    const deadlines = timelineToDeadlines(timelineTrack, new Date(anchorDate).toISOString());
    try {
      await addBulk.mutateAsync({ matterId: Number(timelineMatterId), deadlines });
      toast({
        title: 'Timeline added to diary',
        description: `${deadlines.length} deadline(s) added to the matter.`,
      });
      setTimelineTrack(null);
      setTimelineMatterId('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Please try again.';
      toast({ title: 'Could not add timeline', description: msg, variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Banking Recovery"
        description="Choose a recovery pathway, run the pre-action debtor due-diligence, draft the cause papers and diarise the standard timeline against a matter."
      />

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading pathways…
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 text-destructive py-12 justify-center">
          <CircleAlert className="h-5 w-5" /> Could not load the recovery pathways.
        </div>
      )}

      {data && (
        <div className="space-y-8">
          {/* Due diligence checklist */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h2 className="font-serif text-xl font-semibold text-foreground">Pre-action debtor due diligence</h2>
                </div>
                <Badge variant="secondary">{checklistDone} / {data.dueDiligence.length} done</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Run these searches before electing a route — there is little point bankrupting or winding up a debtor with no recoverable assets.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {data.dueDiligence.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setChecked((c) => ({ ...c, [item.id]: !c[item.id] }))}
                    className="text-left flex gap-3 p-3 rounded-lg border border-border hover:border-primary/40 bg-background/40 transition-colors"
                  >
                    <span className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border flex items-center justify-center ${checked[item.id] ? 'bg-primary border-primary' : 'border-border'}`}>
                      {checked[item.id] && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                    </span>
                    <span>
                      <span className={`block text-sm font-medium ${checked[item.id] ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{item.label}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.detail}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-primary/80"><Search className="h-3 w-3" />{item.source}</span>
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Track picker */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Landmark className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-xl font-semibold text-foreground">Recovery pathways</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.tracks.map((track) => {
                const active = track.id === activeTrackId;
                return (
                  <button
                    key={track.id}
                    onClick={() => setActiveTrackId(active ? null : track.id)}
                    className={`text-left p-5 rounded-xl border transition-all ${active ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' : 'border-border bg-card hover:border-primary/40'}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-serif font-semibold text-foreground leading-tight">{track.shortName}</span>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${active ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-2 ${DEBTOR_BADGE[track.debtor]}`}>{debtorLabel(track.debtor)}</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">{track.summary}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active track detail */}
          {activeTrack && (
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="font-serif text-2xl font-bold text-primary">{activeTrack.name}</h3>
                    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border mt-2 ${DEBTOR_BADGE[activeTrack.debtor]}`}>{debtorLabel(activeTrack.debtor)}</span>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setTimelineTrack(activeTrack); setTimelineMatterId(''); }}>
                    <CalendarPlus className="h-4 w-4" /> Add timeline to a matter
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-2">When to use</h4>
                    <ul className="space-y-1.5">
                      {activeTrack.whenToUse.map((w, i) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground/85"><span className="text-primary mt-1">•</span><span>{w}</span></li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-2">Prerequisites</h4>
                    <ul className="space-y-1.5">
                      {activeTrack.prerequisites.map((p, i) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground/85"><ListChecks className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>{p}</span></li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Cause papers */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-3">Cause papers</h4>
                  <div className="space-y-2">
                    {activeTrack.causePapers.map((paper) => (
                      <div key={paper.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-background/40">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{paper.name}</span>
                            <Badge variant="outline" className="text-[10px]">{paper.basis}</Badge>
                            {paper.preAction && <Badge variant="secondary" className="text-[10px]">Pre-action</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{paper.description}</p>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => openDraft(activeTrack, paper)}>
                          <FileSignature className="h-3.5 w-3.5" /> Draft
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-1">Standard timeline</h4>
                  <p className="text-xs text-muted-foreground mb-3">Anchored to: <span className="text-foreground/80">{activeTrack.anchorLabel}</span></p>
                  <div className="space-y-2">
                    {activeTrack.timeline.map((step, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-background/40">
                        <span className="text-xs font-mono font-bold text-primary shrink-0 w-16">+{step.offsetDays}d</span>
                        <div className="flex-1">
                          <span className="text-sm text-foreground">{step.label}</span>
                          <span className="block text-[11px] text-muted-foreground">{step.basis}{step.notes ? ` — ${step.notes}` : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Caveats */}
                <div className="flex gap-2 items-start p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <ul className="space-y-1">
                    {activeTrack.caveats.map((c, i) => (
                      <li key={i} className="text-xs text-amber-500/90 leading-relaxed">{c}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Draft modal */}
      <Modal isOpen={!!draftFor} onClose={() => { if (!generating) setDraftFor(null); }} title={draftFor ? `Draft: ${draftFor.paper.name}` : ''}>
        {draftFor && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {draftFor.track.shortName} · {draftFor.paper.basis}. Fill in what you have — anything left blank becomes a [PLACEHOLDER] in the draft.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Court / registry</Label>
                <Input className="mt-1" placeholder="e.g. High Court of Malaya at Kuala Lumpur" value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} />
              </div>
              <div>
                <Label>Outstanding amount</Label>
                <Input className="mt-1" placeholder="e.g. RM 1,250,000.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Parties</Label>
              <Input className="mt-1" placeholder="e.g. ABC Bank Bhd (Plaintiff) v. XYZ Sdn Bhd (Defendant)" value={form.parties} onChange={(e) => setForm({ ...form, parties: e.target.value })} />
            </div>
            <div>
              <Label>Facility / default facts</Label>
              <Textarea className="mt-1" rows={3} placeholder="Facility type, date of letter of offer, default details, demand served…" value={form.facts} onChange={(e) => setForm({ ...form, facts: e.target.value })} />
            </div>
            <div>
              <Label>Security particulars (charge / guarantee)</Label>
              <Textarea className="mt-1" rows={2} placeholder="Charge presentation no., land title, guarantee date & guarantor…" value={form.security} onChange={(e) => setForm({ ...form, security: e.target.value })} />
            </div>
            <div>
              <Label>Additional details (optional)</Label>
              <Textarea className="mt-1" rows={2} placeholder="Anything else the draft should reflect" value={form.additionalDetails} onChange={(e) => setForm({ ...form, additionalDetails: e.target.value })} />
            </div>

            <Button onClick={runDraft} disabled={generating} className="w-full gap-2">
              {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Drafting…</> : <><ScrollText className="h-4 w-4" /> Generate draft</>}
            </Button>

            {genError && (
              <div className="flex items-center gap-2 text-sm text-destructive"><CircleAlert className="h-4 w-4" />{genError}</div>
            )}

            {output && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Draft</span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                      {copied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
                    </Button>
                  </div>
                </div>
                <LegalOutput text={output} />
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
                      <Select className="mt-1" value={saveMatterId} onChange={(e) => setSaveMatterId(e.target.value)}>
                        <option value="">No matter</option>
                        {matters?.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </Select>
                    </div>
                    <Button variant="outline" size="sm" className="h-11 gap-1.5" onClick={saveDraft} disabled={saveWork.isPending}>
                      {saved ? <><Check className="h-4 w-4" />Saved</> : <><BookmarkPlus className="h-4 w-4" />Save to My Work</>}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Apply timeline modal */}
      <Modal isOpen={!!timelineTrack} onClose={() => setTimelineTrack(null)} title={timelineTrack ? `Add ${timelineTrack.shortName} timeline` : ''}>
        {timelineTrack && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This adds {timelineTrack.timeline.length} standard deadline(s) to a matter's diary, counted from your anchor date ({timelineTrack.anchorLabel.toLowerCase()}).
            </p>
            <div>
              <Label>Matter</Label>
              <Select className="mt-1" value={timelineMatterId} onChange={(e) => setTimelineMatterId(e.target.value)}>
                <option value="">Select a matter…</option>
                {matters?.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </Select>
              {(!matters || matters.length === 0) && (
                <p className="text-xs text-muted-foreground mt-1">No matters yet — create one under Matters first.</p>
              )}
            </div>
            <div>
              <Label>{timelineTrack.anchorLabel}</Label>
              <Input type="date" className="mt-1" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-3 space-y-1.5">
              {timelineToDeadlines(timelineTrack, new Date(anchorDate).toISOString()).map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-foreground/85">{d.title}</span>
                  <span className="text-muted-foreground font-mono shrink-0">{new Date(d.dueDate).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
            <Button className="w-full gap-2" onClick={applyTimeline} disabled={!timelineMatterId || addBulk.isPending}>
              {addBulk.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</> : <><CalendarPlus className="h-4 w-4" /> Add to diary</>}
            </Button>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Dates are indicative ordinary periods — verify against the sealed cause papers, the correct forum and any specific directions before relying on them.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
