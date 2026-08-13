import { useMemo, useState } from 'react';
import { Link, useRoute, useSearch } from 'wouter';
import { useMatter } from '@/hooks/use-matters';
import { useListWorkflows } from '@/hooks/use-workflows';
import { useListForms } from '@/hooks/use-forms';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { PageHeader, Card, CardContent, CardHeader, CardTitle, Badge, Button } from '@/components/ui';
import { ArrowLeft, ArrowRight, GitBranch, ListChecks, FileText, Wand2, Clock, CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { findMatter } from '@/data/practice-hub';
import { DraftCauseModal, type LegalForm } from '@/components/DraftCauseModal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Workflow = Record<string, any>;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Best-effort match of a workflow step's document name to a drafteable form. */
function matchForm(docName: string, forms: LegalForm[]): LegalForm | null {
  const doc = normalize(docName);
  if (!doc) return null;
  let best: LegalForm | null = null;
  let bestScore = 0;
  for (const f of forms) {
    const title = normalize(String(f.title ?? ''));
    let score = 0;
    // Only match on meaningful title containment or strong word overlap —
    // form numbers are ambiguous (e.g. several papers share an order number)
    // and must never drive a draft button to the wrong precedent.
    if (title && (doc.includes(title) || title.includes(doc))) {
      score = Math.min(title.length, doc.length);
      if (score < 12) score = 0; // too short to be a trustworthy containment
    } else {
      const dw = new Set(doc.split(' ').filter(w => w.length > 3));
      const shared = title.split(' ').filter(w => w.length > 3 && dw.has(w));
      if (shared.length >= 3) score = shared.length;
    }
    if (score > bestScore) { bestScore = score; best = f; }
  }
  return best;
}

export default function PracticeMatter() {
  const [, params] = useRoute('/app/practice/:matterId');
  const matterId = params?.matterId ?? '';
  const entry = findMatter(matterId);

  // Optional link to an open matter file (?matter=<id>) — drafts made here are
  // filed into that matter, and the checklist is scoped to the file.
  const search = useSearch();
  const linkedMatterId = (() => {
    const v = new URLSearchParams(search).get('matter');
    const n = v ? parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  const { data: linkedMatter } = useMatter(linkedMatterId);

  const { data: workflows, isLoading: wfLoading } = useListWorkflows();
  const { data: forms, isLoading: formsLoading } = useListForms();
  const checklistKey = linkedMatterId ? `practice.checklist.matter.${linkedMatterId}` : `practice.checklist.${matterId}`;
  const [checked, setChecked] = usePersistentState<Record<string, boolean>>(checklistKey, {});
  const [draftForm, setDraftForm] = useState<LegalForm | null>(null);
  const [openWorkflow, setOpenWorkflow] = useState<number | null>(null);

  const matchedWorkflows: Workflow[] = useMemo(() => {
    if (!entry || !workflows) return [];
    return (workflows as Workflow[]).filter(w =>
      entry.matter.workflowKeywords.some(k => String(w.title ?? '').toLowerCase().includes(k)),
    );
  }, [entry, workflows]);

  const matterForms: LegalForm[] = useMemo(() => {
    if (!entry || !forms) return [];
    const wanted = new Set(entry.matter.formNumbers);
    return (forms as LegalForm[]).filter(f => wanted.has(String(f.formNumber)));
  }, [entry, forms]);

  if (!entry) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-muted-foreground">Matter type not found.</p>
        <Link href="/app/practice" className="inline-flex items-center justify-center gap-2 rounded-md transition-all duration-200 border border-border bg-transparent hover:bg-secondary text-foreground h-11 px-6 font-medium"><ArrowLeft className="h-4 w-4" /> Back to Your Online LA</Link>
      </div>
    );
  }

  const { area, matter } = entry;
  const doneCount = matter.checklist.filter((_, i) => checked[String(i)]).length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href="/app/practice" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" /> Your Online LA / {area.name}
      </Link>
      <PageHeader title={matter.name} description={matter.summary} />

      {linkedMatter && (
        <div className="mb-6 -mt-2 bg-primary/5 border border-primary/25 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-foreground">
            <span className="text-muted-foreground">Working in file:</span>{' '}
            <span className="font-semibold text-primary">{linkedMatter.title}</span>
            {' '}<span className="text-xs text-muted-foreground">— drafts made here will be filed into this matter.</span>
          </p>
          <Link href={`/app/matters/${linkedMatter.id}`} className="inline-flex items-center justify-center gap-1.5 rounded-md transition-all duration-200 border border-border bg-transparent hover:bg-secondary text-foreground h-9 px-3 text-sm"><ArrowRight className="h-3.5 w-3.5" /> Open matter file</Link>
        </div>
      )}

      {matter.moduleLink && (
        <div className="mb-6 -mt-2">
          <Link href={matter.moduleLink.path} className="inline-flex items-center justify-center gap-2 rounded-md transition-all duration-200 border border-primary/30 bg-transparent hover:bg-secondary text-primary h-11 px-6 font-medium">
            <ExternalLink className="h-4 w-4" /> {matter.moduleLink.label}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Left column: checklist ─────────────────────────────── */}
        <Card className="lg:sticky lg:top-6">
          <CardHeader className="pb-3 border-b border-border bg-secondary/10">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" /> Matter Checklist</span>
              <Badge variant="outline">{doneCount}/{matter.checklist.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-1">
            {matter.checklist.map((item, i) => {
              const isDone = !!checked[String(i)];
              return (
                <button
                  key={i}
                  onClick={() => setChecked(prev => ({ ...prev, [String(i)]: !prev[String(i)] }))}
                  className={`w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${isDone ? 'text-muted-foreground line-through decoration-primary/40' : 'text-foreground hover:bg-secondary'}`}
                >
                  {isDone
                    ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    : <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                  {item}
                </button>
              );
            })}
            <p className="text-[11px] text-muted-foreground pt-2 px-2.5">Progress is saved on this device.</p>
          </CardContent>
        </Card>

        {/* ── Right column: workflow + cause papers ───────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <section>
            <h2 className="font-serif font-bold text-lg text-foreground flex items-center gap-2 mb-3">
              <GitBranch className="h-5 w-5 text-primary" /> Workflow — Start to Finish
            </h2>
            {wfLoading ? (
              <div className="text-sm text-primary animate-pulse p-4">Loading workflows...</div>
            ) : matchedWorkflows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No detailed workflow is available for this matter yet. See the <Link href="/app/workflows" className="text-primary underline">Workflows library</Link>.</p>
            ) : (
              <div className="space-y-3">
                {matchedWorkflows.map((wf: Workflow) => {
                  const isOpen = openWorkflow === wf.id || matchedWorkflows.length === 1;
                  const steps: Workflow[] = Array.isArray(wf.steps) ? wf.steps : [];
                  return (
                    <Card key={wf.id}>
                      <button className="w-full text-left" onClick={() => setOpenWorkflow(isOpen && matchedWorkflows.length > 1 ? null : wf.id)}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-base leading-snug">{wf.title}</CardTitle>
                              <p className="text-xs text-muted-foreground mt-1">{wf.description}</p>
                            </div>
                            <Badge variant="outline" className="gap-1 shrink-0"><Clock className="h-3 w-3" /> {wf.estimatedDuration}</Badge>
                          </div>
                        </CardHeader>
                      </button>
                      {isOpen && (
                        <CardContent className="pt-0">
                          <ol className="relative border-l border-primary/20 ml-3 space-y-5 py-1">
                            {steps.map((step: Workflow, idx: number) => (
                              <li key={idx} className="ml-5">
                                <span className="absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 border border-primary/30 text-[10px] font-bold text-primary">{step.stepNumber ?? idx + 1}</span>
                                <p className="font-semibold text-sm text-foreground">{step.title}</p>
                                {step.timeframe && <p className="text-[11px] text-primary/80 font-medium mt-0.5 flex items-center gap-1"><Clock className="h-3 w-3" /> {step.timeframe}</p>}
                                <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                                {Array.isArray(step.documents) && step.documents.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {step.documents.map((doc: string, di: number) => {
                                      const form = matchForm(doc, (forms as LegalForm[]) ?? []);
                                      return form ? (
                                        <button
                                          key={di}
                                          onClick={() => setDraftForm(form)}
                                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition-colors"
                                          title={`AI Draft: ${form.title}`}
                                        >
                                          <Wand2 className="h-3 w-3" /> {doc}
                                        </button>
                                      ) : (
                                        <span key={di} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-border bg-secondary text-muted-foreground">
                                          <FileText className="h-3 w-3" /> {doc}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                {step.notes && <p className="text-[11px] text-amber-300/80 mt-1.5">{step.notes}</p>}
                              </li>
                            ))}
                          </ol>
                          {wf.legalBasis && <p className="text-[11px] text-muted-foreground mt-4 font-mono">{wf.legalBasis}</p>}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-serif font-bold text-lg text-foreground flex items-center gap-2 mb-3">
              <FileText className="h-5 w-5 text-primary" /> Cause Papers for this Matter
            </h2>
            {formsLoading ? (
              <div className="text-sm text-primary animate-pulse p-4">Loading cause papers...</div>
            ) : matterForms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No specific cause papers mapped — browse the full <Link href="/app/forms" className="text-primary underline">Cause Papers library</Link>.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matterForms.map((form: LegalForm) => (
                  <Card key={form.id} className="flex flex-col hover:border-primary/50 transition-all">
                    <CardContent className="p-4 flex flex-col gap-3 flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <Badge className="font-mono text-[10px]">{form.formNumber}</Badge>
                        <Badge variant="outline" className="text-[10px]">{form.category}</Badge>
                      </div>
                      <p className="font-semibold text-sm text-foreground leading-snug">{form.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{form.purpose}</p>
                      <Button size="sm" onClick={() => setDraftForm(form)} className="w-full gap-2 mt-auto">
                        <Wand2 className="h-3.5 w-3.5" /> AI Draft This Document
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Link href="/app/forms" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                Browse all 65 cause papers <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>
        </div>
      </div>

      <DraftCauseModal
        form={draftForm}
        onClose={() => setDraftForm(null)}
        practiceMatter={{ id: matter.id, name: matter.name, areaName: area.name }}
        linkedMatterId={linkedMatterId}
      />
    </div>
  );
}
