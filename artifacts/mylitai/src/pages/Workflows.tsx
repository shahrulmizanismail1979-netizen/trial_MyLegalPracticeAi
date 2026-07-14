import { useState, useCallback } from 'react';
import { useListWorkflows } from '@/hooks/use-workflows';
import { PageHeader, Card, CardContent, CardHeader, CardTitle, Badge, Modal, Button } from '@/components/ui';
import { GitBranch, Clock, FileCheck, CheckCircle2, FileText, Volume2, VolumeX, ChevronRight, Eye, Download, Copy } from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Workflow = Record<string, any>;
import { SAMPLE_DOCUMENTS, getSampleDocument } from '@/lib/sample-documents';
import { speak, stop, isSupported, stripMarkdown } from '@/lib/tts';

// ─── TTS Button ────────────────────────────────────────────────────────────────
function TTSButton({ text, label = 'Listen' }: { text: string; label?: string }) {
  const [speaking, setSpeaking] = useState(false);
  if (!isSupported()) return null;
  const toggle = () => {
    if (speaking) { stop(); setSpeaking(false); }
    else { speak(stripMarkdown(text), () => setSpeaking(false)); setSpeaking(true); }
  };
  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
        speaking
          ? 'bg-primary/10 text-primary border-primary/40 animate-pulse'
          : 'bg-secondary text-muted-foreground border-border hover:text-primary hover:border-primary/40'
      }`}
    >
      {speaking ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
      {speaking ? 'Stop' : label}
    </button>
  );
}

// ─── Sample Document Viewer ─────────────────────────────────────────────────────
function SampleDocumentViewer({ doc }: { doc: typeof SAMPLE_DOCUMENTS[string] }) {
  const [copied, setCopied] = useState(false);
  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(doc.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [doc.content]);
  const download = useCallback(() => {
    const blob = new Blob([doc.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.name.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [doc]);
  return (
    <div className="space-y-4">
      <div className="bg-amber-950/20 border border-amber-800/30 rounded-lg px-4 py-2.5 text-sm text-amber-300/90">
        📌 Standard precedent template. Replace all <code className="bg-amber-900/30 px-1 rounded text-xs">[BRACKETED]</code> fields with actual case details. Verify current form requirements with the court registry before filing.
      </div>
      <div className="flex gap-2 flex-wrap">
        <TTSButton text={doc.description + '. ' + doc.content.substring(0, 600)} label="Listen (intro)" />
        <button onClick={copyToClipboard} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-secondary text-muted-foreground border-border hover:text-primary hover:border-primary/40 transition-colors">
          <Copy className="h-3 w-3" />{copied ? 'Copied!' : 'Copy Template'}
        </button>
        <button onClick={download} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-secondary text-muted-foreground border-border hover:text-primary hover:border-primary/40 transition-colors">
          <Download className="h-3 w-3" />Download
        </button>
      </div>
      <div className="bg-background border border-border rounded-xl p-6 font-mono text-xs leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto shadow-inner">
        {doc.content}
      </div>
    </div>
  );
}

// ─── Document Card (proper component — no hooks in map) ─────────────────────────
function DocumentCard({ doc }: { doc: string }) {
  const [open, setOpen] = useState(false);
  const sample = getSampleDocument(doc);
  return (
    <>
      <div
        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
          sample
            ? 'border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50'
            : 'border-border bg-card hover:border-border/60'
        }`}
        onClick={() => sample && setOpen(true)}
      >
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${sample ? 'bg-primary/10' : 'bg-secondary'}`}>
          <FileText className={`h-5 w-5 ${sample ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium block truncate">{doc}</span>
          {sample ? (
            <span className="text-[10px] text-primary flex items-center gap-1 mt-0.5">
              <Eye className="h-2.5 w-2.5" /> Click to view sample template
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground mt-0.5 block">Use AI Drafter to generate</span>
          )}
        </div>
      </div>
      {sample && (
        <Modal isOpen={open} onClose={() => setOpen(false)} title={sample.name}>
          <SampleDocumentViewer doc={sample} />
        </Modal>
      )}
    </>
  );
}

// ─── Visual Workflow Diagram ────────────────────────────────────────────────────
function WorkflowDiagram({ steps }: { steps: Workflow['steps'] }) {
  return (
    <div className="flex flex-col gap-0">
      {steps.map((step: any, idx: any) => (
        <div key={step.stepNumber} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold border-2 shrink-0 z-10 ${
              idx === 0
                ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30'
                : idx === steps.length - 1
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-card text-primary border-primary/60'
            }`}>
              {idx === steps.length - 1 ? <CheckCircle2 className="h-4 w-4" /> : step.stepNumber}
            </div>
            {idx < steps.length - 1 && (
              <div className="w-0.5 flex-1 min-h-[1.5rem] bg-gradient-to-b from-primary/50 to-primary/15 mt-1" />
            )}
          </div>
          <div className={`flex-1 ${idx < steps.length - 1 ? 'pb-5' : 'pb-1'}`}>
            <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h5 className="font-bold text-base text-foreground leading-tight">
                  Step {step.stepNumber}: {step.title}
                </h5>
                <TTSButton
                  text={`Step ${step.stepNumber}: ${step.title}. ${step.description}${step.notes ? '. Note: ' + step.notes : ''}`}
                />
              </div>
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{step.description}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {step.timeframe && (
                  <span className="flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md">
                    <Clock className="h-3 w-3" /> {step.timeframe}
                  </span>
                )}
                {step.documents.map((d: any, i: any) => (
                  <StepDocBadge key={i} doc={d} />
                ))}
              </div>
              {step.notes && (
                <p className="mt-3 text-xs italic text-muted-foreground border-l-2 border-primary/40 pl-2">
                  ⚠️ {step.notes}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Per-step document badge with inline sample viewer ───────────────────────
function StepDocBadge({ doc }: { doc: string }) {
  const [open, setOpen] = useState(false);
  const sample = getSampleDocument(doc);
  return (
    <>
      <span
        className={`flex items-center gap-1 px-2 py-1 rounded-md border transition-colors ${
          sample
            ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 cursor-pointer'
            : 'bg-secondary text-muted-foreground border-border'
        }`}
        onClick={() => sample && setOpen(true)}
        title={sample ? 'Click to view sample document' : undefined}
      >
        <FileText className="h-3 w-3 shrink-0" />
        {doc}
        {sample && <Eye className="h-3 w-3 ml-0.5 opacity-70" />}
      </span>
      {sample && (
        <Modal isOpen={open} onClose={() => setOpen(false)} title={sample.name}>
          <SampleDocumentViewer doc={sample} />
        </Modal>
      )}
    </>
  );
}

// ─── Main Workflows Page ────────────────────────────────────────────────────────
export default function Workflows() {
  const { data: workflows, isLoading } = useListWorkflows();
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  if (isLoading) return <div className="p-8 text-center text-primary animate-pulse">Loading Workflows...</div>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Procedural Workflows"
        description="Step-by-step visual guides for litigation procedures, execution proceedings, and administrative tasks. Click any workflow to explore its steps and access sample court documents."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {workflows?.map((wf: any) => (
          <Card
            key={wf.id}
            className="cursor-pointer hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5 transition-all"
            onClick={() => setSelectedWorkflow(wf)}
          >
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start mb-2">
                <Badge variant="secondary">{wf.category}</Badge>
                <div className="flex items-center text-muted-foreground text-xs font-mono">
                  <Clock className="h-3 w-3 mr-1" /> {wf.estimatedDuration}
                </div>
              </div>
              <CardTitle className="text-xl leading-snug">{wf.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{wf.description}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs font-medium text-foreground">
                  <span className="flex items-center gap-1"><GitBranch className="h-4 w-4 text-primary" /> {wf.steps.length} Steps</span>
                  <span className="flex items-center gap-1"><FileCheck className="h-4 w-4 text-primary" /> {wf.sampleDocuments.length} Documents</span>
                </div>
                <span className="text-xs text-primary flex items-center gap-1 font-medium">
                  View <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal isOpen={!!selectedWorkflow} onClose={() => setSelectedWorkflow(null)} title={selectedWorkflow?.title || ''}>
        {selectedWorkflow && (
          <div className="space-y-8 pb-6">
            {/* Metadata */}
            <div className="flex flex-wrap gap-3">
              <Badge>{selectedWorkflow.category}</Badge>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground bg-secondary px-3 py-1 rounded-full">
                <Clock className="h-4 w-4" /> {selectedWorkflow.estimatedDuration}
              </span>
              <TTSButton
                text={`${selectedWorkflow.title}. ${selectedWorkflow.description}. This applies to: ${selectedWorkflow.applicableTo}`}
                label="Listen to Overview"
              />
            </div>

            {/* Legal basis box */}
            <div className="bg-card border border-border rounded-xl p-4 text-sm space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Applicability & Legal Basis</h4>
              <p><strong className="text-foreground">Applies to:</strong> <span className="text-muted-foreground">{selectedWorkflow.applicableTo}</span></p>
              <p><strong className="text-foreground">Legal Basis:</strong> <span className="font-mono text-primary/80 text-xs">{selectedWorkflow.legalBasis}</span></p>
            </div>

            {/* Visual timeline */}
            <div>
              <div className="flex items-center justify-between mb-6 border-b border-border pb-3">
                <h4 className="text-xl font-serif font-bold flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-primary" /> Step-by-Step Procedure
                </h4>
                <TTSButton
                  text={selectedWorkflow.steps.map((s: any) => `Step ${s.stepNumber}: ${s.title}. ${s.description}`).join('. ')}
                  label="Listen to all steps"
                />
              </div>
              <WorkflowDiagram steps={selectedWorkflow.steps} />
            </div>

            {/* Sample documents */}
            {selectedWorkflow.sampleDocuments.length > 0 && (
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-primary mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Sample Court Documents & Precedents
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedWorkflow.sampleDocuments.map((doc: any, idx: any) => (
                    <DocumentCard key={idx} doc={doc} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <Eye className="h-3 w-3" /> Highlighted documents have sample templates. Use the AI Drafter (Forms section) to generate completed drafts.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
