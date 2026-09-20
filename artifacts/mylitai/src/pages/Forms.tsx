import { useState, useRef, useCallback } from 'react';
import { emitRateLimit, readRateLimitRemaining } from '@/lib/rate-limit-bus';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { useListForms } from '@/hooks/use-forms';
import { PageHeader, Card, CardContent, CardHeader, CardTitle, Badge, Button, Modal, Input, Textarea, Label } from '@/components/ui';
import { FileText, Wand2, CheckCircle, AlertTriangle, Loader2, Volume2, VolumeX, Eye, BookmarkPlus, Check } from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LegalForm = Record<string, any>;
import { SAMPLE_DOCUMENTS } from '@/lib/sample-documents';
import { speak, stop, isSupported, stripMarkdown } from '@/lib/tts';
import { FileUploadDropzone, buildContextFromFiles, type ExtractedFile } from '@/components/FileUploadDropzone';
import { ExportButtons } from '@/components/ExportButtons';
import { useSaveWork } from '@/hooks/use-saved-work';
import { useToast } from '@/hooks/use-toast';
import { DraftDocument } from '@workspace/draft-export/react';

// ─── Save draft ──────────────────────────────────────────────────────────────
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

// ─── TTS Button ─────────────────────────────────────────────────────────────────
function TTSButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  if (!isSupported()) return null;
  const toggle = () => {
    if (speaking) { stop(); setSpeaking(false); }
    else { speak(stripMarkdown(text), () => setSpeaking(false)); setSpeaking(true); }
  };
  return (
    <button onClick={toggle} className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${speaking ? 'bg-primary/10 text-primary border-primary/40 animate-pulse' : 'bg-secondary text-muted-foreground border-border hover:text-primary hover:border-primary/40'}`}>
      {speaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
      {speaking ? 'Stop' : 'Listen to Draft'}
    </button>
  );
}

// ─── Sample document preview button ─────────────────────────────────────────────
function SamplePreviewButton({ formTitle }: { formTitle: string }) {
  const [open, setOpen] = useState(false);
  // Try to find a matching sample document
  const lowerTitle = formTitle.toLowerCase();
  const matchKey = Object.keys(SAMPLE_DOCUMENTS).find(k => {
    const lk = k.toLowerCase();
    return lowerTitle.includes(lk.split(' ')[0]) || lk.includes(lowerTitle.split(' ')[0]);
  });
  const sample = matchKey ? SAMPLE_DOCUMENTS[matchKey] : null;
  if (!sample) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-secondary text-muted-foreground border-border hover:text-primary hover:border-primary/40 transition-colors"
      >
        <Eye className="h-3 w-3" /> View Sample Template
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={`Sample: ${sample.name}`}>
        <div className="space-y-4">
          <div className="bg-amber-950/20 border border-amber-800/30 rounded-lg px-4 py-2.5 text-sm text-amber-300/90">
            📌 This is a standard precedent template. Replace all [BRACKETED] fields with actual case details.
          </div>
          <div className="bg-background border border-border rounded-xl p-6 font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto shadow-inner">
            {sample.content}
          </div>
        </div>
      </Modal>
    </>
  );
}

// ─── Streaming draft hook ─────────────────────────────────────────────────────
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

    setDraft('');
    setDisclaimer('');
    setError('');
    setIsDone(false);
    setIsStreaming(true);

    try {
      const response = await fetch(`/api/lit/forms/${formId}/draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 429) emitRateLimit(0);
        throw new Error(
          response.status === 429
            ? 'Too many AI requests. Please try again shortly.'
            : `Server error: ${response.status}`
        );
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
              if (data.content) {
                setDraft(prev => prev + data.content);
              }
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
    } catch (err: any) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('Failed to generate draft. Please try again.');
      }
      setIsStreaming(false);
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setDraft('');
    setDisclaimer('');
    setError('');
    setIsStreaming(false);
    setIsDone(false);
  }, []);

  return { draft, disclaimer, isStreaming, isDone, error, startDraft, reset };
}

// ─── Main Forms Page ─────────────────────────────────────────────────────────
export default function Forms() {
  const { data: forms, isLoading } = useListForms();
  const [selectedForm, setSelectedForm] = useState<LegalForm | null>(null);
  const [formData, setFormData] = usePersistentState('forms.formData', { clientName: '', caseDetails: '', additionalInfo: '' });
  const [uploadedFiles, setUploadedFiles] = useState<ExtractedFile[]>([]);

  const { draft, disclaimer, isStreaming, isDone, error, startDraft, reset } = useStreamingDraft();

  if (isLoading) return <div className="p-8 text-center text-primary animate-pulse">Loading Forms...</div>;

  const handleDraftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForm) return;
    const fileContext = buildContextFromFiles(uploadedFiles);
    const enrichedAdditional = (formData.additionalInfo + fileContext).trim();
    startDraft(selectedForm.id, { ...formData, additionalInfo: enrichedAdditional });
  };

  const closeDraftModal = () => {
    reset();
    setSelectedForm(null);
    setFormData({ clientName: '', caseDetails: '', additionalInfo: '' });
    setUploadedFiles([]);
  };

  const hasDraft = draft.length > 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Cause Papers & AI Drafter"
        description="Access official court forms and use AI to generate accurate, properly-formatted drafts for Malaysian courts."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {forms?.map((form: any) => (
          <Card key={form.id} className="flex flex-col hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 transition-all">
            <CardHeader className="pb-3 border-b border-border bg-secondary/10">
              <div className="flex justify-between items-start mb-2">
                <Badge className="font-mono">{form.formNumber}</Badge>
                <Badge variant="outline">{form.category}</Badge>
              </div>
              <CardTitle className="text-lg leading-tight">{form.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-5 flex flex-col gap-4">
              <p className="text-sm text-muted-foreground flex-1 line-clamp-3">{form.purpose}</p>

              <div className="text-xs space-y-1.5 font-medium bg-background p-3 rounded-lg border border-border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Filing Fee:</span>
                  <span className="text-foreground">{form.filingFee}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Authority:</span>
                  <span className="text-foreground font-mono text-[10px]">{form.authorizedBy}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <SamplePreviewButton formTitle={form.title} />
              </div>

              <Button onClick={() => setSelectedForm(form)} className="w-full gap-2 mt-auto">
                <Wand2 className="h-4 w-4" /> AI Draft This Form
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal isOpen={!!selectedForm} onClose={closeDraftModal} title={`AI Draft: ${selectedForm?.title}`}>
        {selectedForm && (
          <div>
            {/* Input form — collapses when drafting starts */}
            {!hasDraft && !isStreaming && (
              <div className="space-y-6">
                <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl text-sm">
                  <div className="flex gap-2 items-start">
                    <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-primary mb-1">{selectedForm.formNumber} — Instructions</p>
                      <p className="text-muted-foreground">{selectedForm.instructions}</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleDraftSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="clientName" className="text-foreground font-semibold">Parties Involved</Label>
                    <Input
                      id="clientName"
                      required
                      value={formData.clientName}
                      onChange={e => setFormData(p => ({ ...p, clientName: e.target.value }))}
                      placeholder="e.g. Maybank Islamic Bhd v. Ahmad bin Ali (NRIC: 800101-14-5555)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="caseDetails" className="text-foreground font-semibold">Core Facts & Relief Sought</Label>
                    <Textarea
                      id="caseDetails"
                      required
                      rows={5}
                      value={formData.caseDetails}
                      onChange={e => setFormData(p => ({ ...p, caseDetails: e.target.value }))}
                      placeholder="Describe the loan facility, amount, default date, property details (for OS), outstanding sum, and what you are claiming. The more detail you provide, the more accurate the draft."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="additionalInfo" className="text-foreground font-semibold">Additional Details <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <Input
                      id="additionalInfo"
                      value={formData.additionalInfo}
                      onChange={e => setFormData(p => ({ ...p, additionalInfo: e.target.value }))}
                      placeholder="Account no., charge details, guarantors, specific dates, court file no., etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground font-semibold">Supporting Documents <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                    <FileUploadDropzone
                      onFilesExtracted={setUploadedFiles}
                      label="Upload facility agreements, charges, demand letters, etc."
                      hint="PDF, DOCX, TXT  •  up to 5 files, 100 MB each. The AI will read these and use them as primary source material."
                    />
                  </div>
                  <div className="pt-2 flex gap-3">
                    <Button type="button" variant="outline" onClick={closeDraftModal} className="w-full">Cancel</Button>
                    <Button type="submit" className="w-full gap-2">
                      <Wand2 className="h-4 w-4" /> Generate Draft
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Streaming output */}
            {(hasDraft || isStreaming) && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {/* Status bar */}
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
                  {hasDraft && (
                    <div className="flex gap-2 flex-wrap items-center">
                      <TTSButton text={draft} />
                      {isDone && (
                        <SaveDraftButton
                          title={selectedForm?.title ?? 'Draft'}
                          matter={formData.clientName}
                          content={draft}
                        />
                      )}
                      {isDone && (
                        <ExportButtons
                          title={selectedForm?.title ?? 'Draft'}
                          content={draft}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Document output */}
                <div className="bg-background border border-border rounded-xl p-6 text-sm leading-relaxed max-h-[55vh] overflow-y-auto shadow-inner relative">
                  <DraftDocument content={draft} />
                  {isStreaming && !isDone && (
                    <span className="inline-block w-2 h-4 bg-primary/70 animate-pulse ml-1 align-middle rounded-sm" />
                  )}
                </div>

                {/* Disclaimer */}
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
                    <Button onClick={closeDraftModal} variant="outline" className="flex-1">Close</Button>
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
    </div>
  );
}
