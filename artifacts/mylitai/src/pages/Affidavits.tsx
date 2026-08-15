import React, { useMemo, useState } from 'react';
import { emitRateLimit, readRateLimitRemaining } from '@/lib/rate-limit-bus';
import { DraftExportButtons } from '@workspace/draft-export/react';
import {
  FileSignature,
  ScrollText,
  Loader2,
  AlertTriangle,
  Check,
  BookmarkPlus,
  ChevronRight,
  CircleAlert,
  Paperclip,
  FileText,
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
import { useMatters } from '@/hooks/use-matters';
import {
  useAffidavitTypes,
  type AffidavitType,
  type AffidavitField,
} from '@/hooks/use-affidavits';
import { MatterPicker, buildMatterSummary } from '@/components/MatterPicker';

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
    onError(response.status === 402 ? 'A subscription is required to draft documents.' : 'Server error');
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

const CATEGORY_BADGE: Record<string, string> = {
  affidavit: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  supporting: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

export default function Affidavits() {
  const { data, isLoading, isError } = useAffidavitTypes();
  const { data: matters } = useMatters();
  const { toast } = useToast();
  const saveWork = useSaveWork();

  const [activeTypeId, setActiveTypeId] = useState<string | null>(null);

  // Draft modal state
  const [draftFor, setDraftFor] = useState<AffidavitType | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [output, setOutput] = useState('');
  const [disclaimer, setDisclaimer] = useState<string | undefined>();
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveMatterId, setSaveMatterId] = useState<string>('');

  const fields: AffidavitField[] = data?.fields ?? [];

  const activeType = useMemo(
    () => data?.types.find((t) => t.id === activeTypeId) ?? null,
    [data, activeTypeId],
  );

  const openDraft = (type: AffidavitType) => {
    setDraftFor(type);
    setForm({});
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
        '/api/lit/affidavits/draft',
        { typeId: draftFor.id, ...form },
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
        title: draftFor.name,
        matter: matterName,
        matterId,
        content: output,
      });
      setSaved(true);
      toast({ title: 'Draft saved', description: matterName ? `Filed into ${matterName}.` : 'Find it under Saved Drafts on the Matters page.' });
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast({ title: 'Could not save', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const affidavits = data?.types.filter((t) => t.category === 'affidavit') ?? [];
  const supporting = data?.types.filter((t) => t.category === 'supporting') ?? [];

  const renderCard = (type: AffidavitType) => {
    const active = type.id === activeTypeId;
    return (
      <button
        key={type.id}
        onClick={() => setActiveTypeId(active ? null : type.id)}
        className={`text-left p-5 rounded-xl border transition-all ${active ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' : 'border-border bg-card hover:border-primary/40'}`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="font-serif font-semibold text-foreground leading-tight">{type.name}</span>
          <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${active ? 'rotate-90 text-primary' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_BADGE[type.category]}`}>
            {type.category === 'affidavit' ? 'Affidavit' : 'Supporting'}
          </span>
          {type.hasExhibits && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Paperclip className="h-3 w-3" /> Exhibits</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{type.description}</p>
      </button>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Affidavits & Supporting Documents"
        description="Draft the deposition-based and ancillary documents that go with your cause papers — affidavits in support, reply and opposition, supplementary affidavits, affidavits verifying documents and of service, plus notices of demand and certificates of urgency."
      />

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading document types…
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 text-destructive py-12 justify-center">
          <CircleAlert className="h-5 w-5" /> Could not load the document library.
        </div>
      )}

      {data && (
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <FileSignature className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-xl font-semibold text-foreground">Affidavits</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {affidavits.map(renderCard)}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-xl font-semibold text-foreground">Supporting documents</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {supporting.map(renderCard)}
            </div>
          </div>

          {/* Active type detail */}
          {activeType && (
            <Card>
              <CardContent className="p-6 space-y-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="font-serif text-2xl font-bold text-primary">{activeType.name}</h3>
                    <Badge variant="outline" className="text-[11px] mt-2">{activeType.basis}</Badge>
                  </div>
                  <Button size="sm" className="gap-1.5 shrink-0" onClick={() => openDraft(activeType)}>
                    <FileSignature className="h-4 w-4" /> Draft this
                  </Button>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-1">When to use</h4>
                  <p className="text-sm text-foreground/85 leading-relaxed">{activeType.whenToUse}</p>
                </div>

                <div className="flex gap-2 items-start p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <ul className="space-y-1">
                    {activeType.caveats.map((c, i) => (
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
      <Modal isOpen={!!draftFor} onClose={() => { if (!generating) setDraftFor(null); }} title={draftFor ? `Draft: ${draftFor.name}` : ''}>
        {draftFor && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {draftFor.basis}. Fill in what you have — anything left blank becomes a [PLACEHOLDER] in the draft.
            </p>
            <MatterPicker
              onSelect={(m) => {
                const summary = buildMatterSummary(m);
                const parties = [m.plaintiff, m.defendant].filter(Boolean).join(' v. ')
                  || m.clientName
                  || '';
                setForm((prev) => ({
                  ...prev,
                  facts: summary || (prev.facts ?? ''),
                  parties: parties || (prev.parties ?? ''),
                  deponentName: m.clientName || (prev.deponentName ?? ''),
                }));
              }}
            />
            {fields.map((field) => (
              <div key={field.key}>
                <Label>{field.label}</Label>
                {field.long ? (
                  <Textarea
                    className="mt-1"
                    rows={field.key === 'facts' ? 4 : 2}
                    placeholder={field.placeholder}
                    value={form[field.key] ?? ''}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  />
                ) : (
                  <Input
                    className="mt-1"
                    placeholder={field.placeholder}
                    value={form[field.key] ?? ''}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  />
                )}
              </div>
            ))}

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
                  <DraftExportButtons title={draftFor?.name ?? 'Affidavit'} content={output} />
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
                      {saved ? <><Check className="h-4 w-4" />Saved</> : <><BookmarkPlus className="h-4 w-4" />Save Draft</>}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
