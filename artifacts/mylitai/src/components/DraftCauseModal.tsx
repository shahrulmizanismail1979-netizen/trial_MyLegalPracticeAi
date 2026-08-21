import { useState, useRef, useCallback } from 'react';
import { emitRateLimit, readRateLimitRemaining } from '@/lib/rate-limit-bus';
import { Modal, Input, Textarea, Label, Button } from '@/components/ui';
import { FileText, Wand2, CheckCircle, AlertTriangle, Loader2, BookmarkPlus, Check } from 'lucide-react';
import { FileUploadDropzone, buildContextFromFiles, type ExtractedFile } from '@/components/FileUploadDropzone';
import { ExportButtons } from '@/components/ExportButtons';
import { useSaveWork } from '@/hooks/use-saved-work';
import { useToast } from '@/hooks/use-toast';
import { SaveToMatterPanel, type PracticeMatterRef } from '@/components/SaveToMatterPanel';
import { MatterPicker, buildMatterSummary } from '@/components/MatterPicker';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LegalForm = Record<string, any>;

// ─── Streaming draft hook (mirrors the Cause Papers page behaviour) ─────────
function useStreamingDraft() {
  const [draft, setDraft] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const startDraft = useCallback(async (formId: number, body: { clientName: string; caseDetails: string; additionalInfo: string }) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setDraft(''); setDisclaimer(''); setError(''); setIsDone(false); setIsStreaming(true);
    try {
      const response = await fetch(`/api/lit/forms/${formId}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 429) emitRateLimit(0);
        if (response.status === 413) {
          throw new Error(
            'The details or uploaded documents are too large to process. Please shorten the facts or remove some attachments and try again.',
          );
        }
        throw new Error(errData.error || `Server error: ${response.status}`);
      }
      const rl = readRateLimitRemaining(response);
      if (rl !== null) emitRateLimit(rl);
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) setDraft(prev => prev + data.content);
              if (data.done) {
                setIsDone(true);
                if (data.disclaimer) setDisclaimer(data.disclaimer);
                if (data.error) setError(data.error);
                setIsStreaming(false);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message || 'Failed to generate draft. Please try again.');
      }
      setIsStreaming(false);
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setDraft(''); setDisclaimer(''); setError(''); setIsStreaming(false); setIsDone(false);
  }, []);

  return { draft, disclaimer, isStreaming, isDone, error, startDraft, reset };
}

function SaveDraftButton({ title, matter, content }: { title: string; matter: string; content: string }) {
  const saveWork = useSaveWork();
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);
  const handleSave = async () => {
    try {
      await saveWork.mutateAsync({ kind: 'draft', title, matter: matter || null, content });
      setSaved(true);
      toast({ title: 'Draft saved', description: 'Find it under Saved Drafts on the Matters page.' });
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast({ title: 'Could not save', description: 'Please try again.', variant: 'destructive' });
    }
  };
  return (
    <button
      onClick={handleSave}
      disabled={saveWork.isPending || !content}
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-secondary text-muted-foreground border-border hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-50"
    >
      {saved ? <><Check className="h-3 w-3" /> Saved</> : <><BookmarkPlus className="h-3 w-3" /> Save Draft</>}
    </button>
  );
}

// ─── Reusable AI-draft modal for a selected cause paper ─────────────────────
export function DraftCauseModal({ form, onClose, practiceMatter, linkedMatterId }: {
  form: LegalForm | null;
  onClose: () => void;
  practiceMatter?: PracticeMatterRef;
  linkedMatterId?: number | null;
}) {
  const [formData, setFormData] = useState({ clientName: '', caseDetails: '', additionalInfo: '' });
  const [uploadedFiles, setUploadedFiles] = useState<ExtractedFile[]>([]);
  const { draft, disclaimer, isStreaming, isDone, error, startDraft, reset } = useStreamingDraft();

  const close = () => {
    reset();
    setFormData({ clientName: '', caseDetails: '', additionalInfo: '' });
    setUploadedFiles([]);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const fileContext = buildContextFromFiles(uploadedFiles);
    startDraft(form.id, { ...formData, additionalInfo: (formData.additionalInfo + fileContext).trim() });
  };

  const hasDraft = draft.length > 0;

  return (
    <Modal isOpen={!!form} onClose={close} title={`AI Draft: ${form?.title ?? ''}`}>
      {form && (
        <div
          data-testid="case-home-handoff-target"
          data-matter-id={linkedMatterId ?? undefined}
        >
          {!hasDraft && !isStreaming && (
            <div className="space-y-6">
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl text-sm">
                <div className="flex gap-2 items-start">
                  <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-primary mb-1">{form.formNumber} — Instructions</p>
                    <p className="text-muted-foreground">{form.instructions}</p>
                  </div>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="pb-1">
                  <MatterPicker
                    defaultMatterId={linkedMatterId}
                    onSelect={(m) => {
                      const summary = buildMatterSummary(m);
                      const parties = [m.plaintiff, m.defendant].filter(Boolean).join(' v. ')
                        || m.clientName
                        || '';
                      setFormData((p) => ({
                        ...p,
                        clientName: parties || p.clientName,
                        caseDetails: summary || p.caseDetails,
                      }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ph-clientName" className="text-foreground font-semibold">Parties Involved</Label>
                  <Input id="ph-clientName" required value={formData.clientName}
                    onChange={e => setFormData(p => ({ ...p, clientName: e.target.value }))}
                    placeholder="e.g. Maybank Islamic Bhd v. Ahmad bin Ali (NRIC: 800101-14-5555)" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ph-caseDetails" className="text-foreground font-semibold">Core Facts & Relief Sought</Label>
                  <Textarea id="ph-caseDetails" required rows={5} value={formData.caseDetails}
                    onChange={e => setFormData(p => ({ ...p, caseDetails: e.target.value }))}
                    placeholder="Describe the facts, key dates, amounts and the relief you are seeking. The more detail, the more accurate the draft." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ph-additionalInfo" className="text-foreground font-semibold">Additional Details <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                  <Input id="ph-additionalInfo" value={formData.additionalInfo}
                    onChange={e => setFormData(p => ({ ...p, additionalInfo: e.target.value }))}
                    placeholder="Account no., court file no., guarantors, specific dates, etc." />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground font-semibold">Supporting Documents <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                  <FileUploadDropzone
                    onFilesExtracted={setUploadedFiles}
                    label="Upload agreements, demand letters, prior orders, etc."
                    hint="PDF, DOCX, TXT  •  up to 5 files, 100 MB each. The AI will read these and use them as primary source material."
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <Button type="button" variant="outline" onClick={close} className="w-full">Cancel</Button>
                  <Button type="submit" className="w-full gap-2"><Wand2 className="h-4 w-4" /> Generate Draft</Button>
                </div>
              </form>
            </div>
          )}

          {(hasDraft || isStreaming) && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {isStreaming && !isDone ? (
                  <div className="flex items-center gap-2 text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm font-medium">Drafting document...</span>
                  </div>
                ) : isDone ? (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Draft complete</span>
                  </div>
                ) : null}
                {hasDraft && isDone && (
                  <div className="flex gap-2 flex-wrap items-center">
                    <SaveDraftButton title={form.title ?? 'Draft'} matter={formData.clientName} content={draft} />
                    <ExportButtons title={form.title ?? 'Draft'} content={draft} />
                  </div>
                )}
              </div>
              <div className="bg-background border border-border rounded-xl p-6 font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-[55vh] overflow-y-auto shadow-inner relative">
                {draft}
                {isStreaming && !isDone && (
                  <span className="inline-block w-2 h-4 bg-primary/70 animate-pulse ml-1 align-middle rounded-sm" />
                )}
              </div>
              {isDone && practiceMatter && (
                <SaveToMatterPanel
                  draftTitle={form.title ?? 'Draft'}
                  draftContent={draft}
                  parties={formData.clientName}
                  practiceMatter={practiceMatter}
                  linkedMatterId={linkedMatterId}
                />
              )}
              {isDone && disclaimer && (
                <div className="flex gap-2 items-start text-xs bg-amber-950/20 border border-amber-800/30 rounded-lg p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-amber-300/90">{disclaimer}</p>
                </div>
              )}
              {error && (
                <div className="text-sm text-red-400 bg-red-950/20 border border-red-800/30 rounded-lg p-3">{error}</div>
              )}
              {isDone && (
                <div className="flex gap-3 pt-2">
                  <Button onClick={close} variant="outline" className="flex-1">Close</Button>
                  <Button onClick={() => { reset(); setFormData({ clientName: '', caseDetails: '', additionalInfo: '' }); setUploadedFiles([]); }} className="flex-1 gap-2">
                    <Wand2 className="h-4 w-4" /> New Draft
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
