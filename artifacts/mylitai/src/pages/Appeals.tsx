import React, { useMemo, useState } from 'react';
import { emitRateLimit, readRateLimitRemaining } from '@/lib/rate-limit-bus';
import {
  Gavel,
  Scale,
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
  Lock,
  ArrowRight,
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
  Select,
  Textarea,
} from '@/components/ui';
import { useToast } from '@/hooks/use-toast';
import { useSaveWork } from '@/hooks/use-saved-work';
import { useMatters, useAddDeadlinesBulk } from '@/hooks/use-matters';
import {
  useAppealPathways,
  appealTimelineToDeadlines,
  routeForum,
  type AppealPathway,
  type AppealCausePaper,
  type ForumResult,
} from '@/hooks/use-appeals';

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
    onError(response.status === 402 ? 'A subscription is required to draft cause papers.' : 'Server error');
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

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(n);

export default function Appeals() {
  const { data, isLoading, isError } = useAppealPathways();
  const { data: matters } = useMatters();
  const { toast } = useToast();
  const saveWork = useSaveWork();
  const addBulk = useAddDeadlinesBulk();

  // Forum router
  const [forumAmount, setForumAmount] = useState('');
  const [forumResult, setForumResult] = useState<ForumResult | null>(null);
  const [forumLoading, setForumLoading] = useState(false);

  const [activePathwayId, setActivePathwayId] = useState<string | null>(null);

  // Draft modal state
  const [draftFor, setDraftFor] = useState<{ pathway: AppealPathway; paper: AppealCausePaper } | null>(null);
  const [form, setForm] = useState({ court: '', parties: '', decision: '', grounds: '', questionsOfLaw: '', additionalDetails: '' });
  const [output, setOutput] = useState('');
  const [disclaimer, setDisclaimer] = useState<string | undefined>();
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveMatterId, setSaveMatterId] = useState<string>('');

  // Apply-timeline modal state
  const [timelinePathway, setTimelinePathway] = useState<AppealPathway | null>(null);
  const [timelineMatterId, setTimelineMatterId] = useState<string>('');
  const [anchorDate, setAnchorDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const activePathway = useMemo(
    () => data?.pathways.find((p) => p.id === activePathwayId) ?? null,
    [data, activePathwayId],
  );

  const runForum = async () => {
    const raw = forumAmount.trim().replace(/,/g, '');
    const amt = Number(raw);
    if (raw === '' || !Number.isFinite(amt) || amt < 0) {
      toast({ title: 'Enter a valid amount', description: 'Provide the amount in dispute as a non-negative number (RM).', variant: 'destructive' });
      return;
    }
    setForumLoading(true);
    try {
      setForumResult(await routeForum(amt));
    } catch (e) {
      toast({ title: 'Could not route forum', description: e instanceof Error ? e.message : 'Try again.', variant: 'destructive' });
    } finally {
      setForumLoading(false);
    }
  };

  const openDraft = (pathway: AppealPathway, paper: AppealCausePaper) => {
    setDraftFor({ pathway, paper });
    setForm({ court: '', parties: '', decision: '', grounds: '', questionsOfLaw: '', additionalDetails: '' });
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
        '/api/lit/appeals/draft',
        { pathwayId: draftFor.pathway.id, causePaperId: draftFor.paper.id, ...form },
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
        title: `${draftFor.paper.name} — ${draftFor.pathway.shortName}`,
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
    if (!timelinePathway || !timelineMatterId) return;
    const deadlines = appealTimelineToDeadlines(timelinePathway, new Date(anchorDate).toISOString());
    try {
      await addBulk.mutateAsync({ matterId: Number(timelineMatterId), deadlines });
      toast({ title: 'Timeline added to diary', description: `${deadlines.length} deadline(s) added to the matter.` });
      setTimelinePathway(null);
      setTimelineMatterId('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Please try again.';
      toast({ title: 'Could not add timeline', description: msg, variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Appeals & Jurisdiction"
        description="Route a claim to the right court by value, then work the appeal ladder — Subordinate Court to High Court, High Court to Court of Appeal, Court of Appeal to Federal Court — with cause papers and strict time limits diarised against a matter."
      />

      {/* Forum router */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-xl font-semibold text-foreground">Forum router</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Enter the amount in dispute to see the likely court of first instance. Forum is not decided by value alone — the nature of the claim can compel the High Court regardless.
          </p>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label>Amount in dispute (RM)</Label>
              <Input
                className="mt-1"
                inputMode="decimal"
                placeholder="e.g. 250000"
                value={forumAmount}
                onChange={(e) => setForumAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runForum(); }}
              />
            </div>
            <Button onClick={runForum} disabled={forumLoading} className="gap-2 h-11">
              {forumLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Route
            </Button>
          </div>

          {forumResult && (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="font-serif text-lg font-bold text-primary">{forumResult.forum.name}</span>
                <Badge variant="outline" className="text-[10px]">{forumResult.forum.statute}</Badge>
              </div>
              <p className="text-sm text-foreground/90">{forumResult.rationale}</p>
              <p className="text-xs text-muted-foreground mt-1.5">{forumResult.forum.scope}</p>
              <div className="flex gap-2 items-start mt-3 p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-500/90 leading-relaxed">{forumResult.note}</p>
              </div>
            </div>
          )}

          {data && (
            <div className="grid sm:grid-cols-3 gap-2 mt-5">
              {data.forumTiers.map((t) => (
                <div key={t.id} className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="text-sm font-semibold text-foreground">{t.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {t.min === null ? 'Up to' : `Above ${fmtMoney(t.min)}`}
                    {t.max === null ? ' (unlimited)' : t.min === null ? ` ${fmtMoney(t.max)}` : ` to ${fmtMoney(t.max)}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading appeal pathways…
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 text-destructive py-12 justify-center">
          <CircleAlert className="h-5 w-5" /> Could not load the appeal pathways.
        </div>
      )}

      {data && (
        <div className="space-y-8">
          {/* Pathway picker */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Gavel className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-xl font-semibold text-foreground">Appeal ladder</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {data.pathways.map((p) => {
                const active = p.id === activePathwayId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePathwayId(active ? null : p.id)}
                    className={`text-left p-5 rounded-xl border transition-all ${active ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' : 'border-border bg-card hover:border-primary/40'}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-serif font-semibold text-foreground leading-tight">{p.shortName}</span>
                      <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${active ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    {p.leaveRequired && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border mb-2 bg-amber-500/10 text-amber-400 border-amber-500/20">
                        <Lock className="h-3 w-3" /> Leave required
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.summary}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active pathway detail */}
          {activePathway && (
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="font-serif text-2xl font-bold text-primary">{activePathway.name}</h3>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <span>{activePathway.fromForum}</span>
                      <ArrowRight className="h-4 w-4 text-primary" />
                      <span>{activePathway.toForum}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setTimelinePathway(activePathway); setTimelineMatterId(''); }}>
                    <CalendarPlus className="h-4 w-4" /> Add timeline to a matter
                  </Button>
                </div>

                {/* Leave banner */}
                <div className={`flex gap-2 items-start p-3 rounded-lg border ${activePathway.leaveRequired ? 'border-amber-500/20 bg-amber-500/5' : 'border-border bg-background/40'}`}>
                  {activePathway.leaveRequired ? <Lock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> : <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />}
                  <p className="text-xs text-foreground/85 leading-relaxed">
                    <span className="font-semibold">{activePathway.leaveRequired ? 'Leave required. ' : 'No leave ordinarily required. '}</span>
                    {activePathway.leaveNote}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-2">Prerequisites</h4>
                  <ul className="space-y-1.5">
                    {activePathway.prerequisites.map((p, i) => (
                      <li key={i} className="flex gap-2 text-sm text-foreground/85"><ListChecks className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>{p}</span></li>
                    ))}
                  </ul>
                </div>

                {/* Cause papers */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-3">Cause papers</h4>
                  <div className="space-y-2">
                    {activePathway.causePapers.map((paper) => (
                      <div key={paper.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-background/40">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{paper.name}</span>
                            <Badge variant="outline" className="text-[10px]">{paper.basis}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{paper.description}</p>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => openDraft(activePathway, paper)}>
                          <FileSignature className="h-3.5 w-3.5" /> Draft
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-1">Standard timeline</h4>
                  <p className="text-xs text-muted-foreground mb-3">Anchored to: <span className="text-foreground/80">{activePathway.anchorLabel}</span></p>
                  <div className="space-y-2">
                    {activePathway.timeline.map((step, i) => (
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
                    {activePathway.caveats.map((c, i) => (
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
              {draftFor.pathway.shortName} · {draftFor.paper.basis}. Fill in what you have — anything left blank becomes a [PLACEHOLDER] in the draft.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Appellate court / registry</Label>
                <Input className="mt-1" placeholder="e.g. Court of Appeal of Malaysia" value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} />
              </div>
              <div>
                <Label>Parties</Label>
                <Input className="mt-1" placeholder="e.g. XYZ Sdn Bhd (Appellant) v. ABC Bank (Respondent)" value={form.parties} onChange={(e) => setForm({ ...form, parties: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Decision appealed against</Label>
              <Input className="mt-1" placeholder="e.g. Judgment of the High Court at KL dated 12.05.2026, Suit No…" value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value })} />
            </div>
            <div>
              <Label>Grounds / complaints with the decision</Label>
              <Textarea className="mt-1" rows={3} placeholder="Why the decision is wrong in law / fact…" value={form.grounds} onChange={(e) => setForm({ ...form, grounds: e.target.value })} />
            </div>
            {draftFor.pathway.leaveRequired && (
              <div>
                <Label>Proposed questions of law (for leave)</Label>
                <Textarea className="mt-1" rows={2} placeholder="The questions said to satisfy s.96 CJA…" value={form.questionsOfLaw} onChange={(e) => setForm({ ...form, questionsOfLaw: e.target.value })} />
              </div>
            )}
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
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => { navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                    {copied ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
                  </Button>
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
      <Modal isOpen={!!timelinePathway} onClose={() => setTimelinePathway(null)} title={timelinePathway ? `Add ${timelinePathway.shortName} timeline` : ''}>
        {timelinePathway && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This adds {timelinePathway.timeline.length} standard deadline(s) to a matter's diary, counted from your anchor date ({timelinePathway.anchorLabel.toLowerCase()}).
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
              <Label>{timelinePathway.anchorLabel}</Label>
              <Input type="date" className="mt-1" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
            </div>
            <div className="rounded-lg border border-border bg-background/40 p-3 space-y-1.5">
              {appealTimelineToDeadlines(timelinePathway, new Date(anchorDate).toISOString()).map((d, i) => (
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
              Appeal periods are strict and indicative here — verify each against the sealed order, the correct forum and the current rules before relying on them.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
