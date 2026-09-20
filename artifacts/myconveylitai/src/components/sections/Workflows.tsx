import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitCommit, Search, ChevronDown, ChevronUp, FileText, Bot, Loader2, AlertCircle, Clock, Scale, Lightbulb } from 'lucide-react';
import { WORKFLOWS, WORKFLOW_CATEGORIES, type Workflow, type WFStep } from '@/lib/workflowData';
import { useApp } from '@/contexts/AppContext';
import type { DocumentType } from '@/lib/data';
import { useSendChatMessage } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { DraftDocument, DraftExportButtons } from '@workspace/draft-export/react';

const DIFFICULTY_COLOR: Record<string, string> = {
  Basic: 'bg-green-500/10 text-green-400 border-green-500/20',
  Intermediate: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Advanced: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function DocButton({ doc, onClick }: { doc: any; onClick: (d: any) => void }) {
  const colors = { template: 'bg-blue-500/10 text-blue-400', form: 'bg-amber-500/10 text-amber-400', letter: 'bg-emerald-500/10 text-emerald-400' };
  const labels = { template: 'Template', form: 'Statutory Form', letter: 'Letter' };
  return (
    <button onClick={() => onClick(doc)} className="flex items-center gap-2 bg-gold-950 hover:bg-gold-800 border border-gold-800 hover:border-slate-600 rounded-xl p-3 pr-4 transition-all text-left group">
      <div className={`p-1.5 rounded-lg ${colors[doc.type as keyof typeof colors] || colors.template}`}>
        <FileText className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-200 group-hover:text-white">{doc.title}</p>
        <p className="text-[10px] text-slate-500 uppercase tracking-wide">{labels[doc.type as keyof typeof labels] || 'Document'}</p>
      </div>
    </button>
  );
}

function StepAI({ step, workflow }: { step: WFStep; workflow: Workflow }) {
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState('');
  const chatMutation = useSendChatMessage();
  const { toast } = useToast();

  const handleAsk = async () => {
    setOpen(true);
    if (response) return;
    try {
      const result = await chatMutation.mutateAsync({
        data: {
          history: [],
          message: `In the context of Malaysian conveyancing legal practice, I need a detailed explanation of the following workflow step:\n\nWorkflow: "${workflow.title}"\nPhase: ${step.phase}\nStep: ${step.label}\n${step.legalBasis ? `Legal Basis: ${step.legalBasis}` : ''}\n\nPlease explain:\n1. What exactly happens at this step (practically and legally)?\n2. Who does what (solicitor, client, bank, Land Office)?\n3. What documents are needed?\n4. What pitfalls or common mistakes should a practitioner watch out for?\n5. Any relevant Malaysian legislation or case law?\n\nPlease be thorough and practical, as if advising a junior solicitor.`
        }
      });
      setResponse(result.response);
    } catch {
      toast({ title: 'AI explanation failed', variant: 'destructive' });
    }
  };

  return (
    <div className="mt-3">
      <button onClick={handleAsk} disabled={chatMutation.isPending && open} className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-amber-400 transition-colors">
        <Bot className="w-3.5 h-3.5" />
        {chatMutation.isPending && open ? 'Asking AI...' : 'Ask AI to explain this step'}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-3">
            <div className="bg-gold-950 border border-gold-700 rounded-xl p-4">
              {chatMutation.isPending && !response ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  <span>Consulting AI Legal Tutor...</span>
                </div>
              ) : response ? (
                <div className="space-y-3 text-slate-300">
                  <DraftExportButtons title="Workflow Guidance" content={response} hideMarkdown />
                  <DraftDocument content={response} />
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const [open, setOpen] = useState(false);
  const { setSelectedDocument } = useApp();

  const handleDocClick = (doc: any) => {
    setSelectedDocument({ id: doc.id, title: doc.title, type: doc.type, content: doc.sample });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-gold-900 border border-gold-800 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full p-5 flex items-start gap-4 text-left hover:bg-gold-800/40 transition-colors group">
        <div className="p-2.5 bg-gold-800 rounded-xl shrink-0 mt-0.5">
          <GitCommit className="w-5 h-5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-mono text-slate-500">{workflow.id}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${DIFFICULTY_COLOR[workflow.difficulty]}`}>{workflow.difficulty}</span>
          </div>
          <h3 className="font-serif font-bold text-slate-100 text-base group-hover:text-amber-400 transition-colors">{workflow.title}</h3>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-slate-500"><Clock className="w-3 h-3" />{workflow.duration}</span>
            <span className="text-xs text-slate-500">{workflow.steps.length} steps</span>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-gold-800">
              {/* Summary */}
              <div className="px-6 py-4 bg-gold-950/30">
                <p className="text-sm text-slate-400 leading-relaxed">{workflow.summary}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {workflow.legislation.map(l => (
                    <span key={l} className="text-xs text-amber-500/70 bg-amber-500/5 border border-amber-500/15 px-2 py-0.5 rounded-full">{l}</span>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div className="px-6 py-6">
                <div className="relative border-l-2 border-gold-800 ml-4 space-y-8">
                  {workflow.steps.map((step, i) => (
                    <div key={step.id} className="relative pl-8">
                      {/* Node */}
                      <div className="absolute -left-[9px] top-1 w-4 h-4 bg-gold-900 rounded-full border-2 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]" />

                      <div className="space-y-1 mb-2">
                        <p className="text-xs font-bold text-amber-500 uppercase tracking-widest">Phase {i + 1} — {step.phase}</p>
                        <p className="font-semibold text-slate-100 text-sm">{step.label}</p>
                        {step.timeframe && (
                          <p className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />{step.timeframe}</p>
                        )}
                      </div>

                      {/* Legal Basis */}
                      {step.legalBasis && (
                        <div className="flex items-start gap-1.5 mb-2">
                          <Scale className="w-3 h-3 text-slate-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-slate-500">{step.legalBasis}</p>
                        </div>
                      )}

                      {/* Tip */}
                      {step.tip && (
                        <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3 mb-3 flex items-start gap-2">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-300/80">{step.tip}</p>
                        </div>
                      )}

                      {/* Documents */}
                      {step.documents && step.documents.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {step.documents.map(doc => (
                            <DocButton key={doc.id} doc={doc} onClick={handleDocClick} />
                          ))}
                        </div>
                      )}

                      {/* AI explain */}
                      <StepAI step={step} workflow={workflow} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function WorkflowsSection() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return WORKFLOWS.filter(w => {
      const matchSearch = !q || w.title.toLowerCase().includes(q) || w.summary.toLowerCase().includes(q) || w.id.toLowerCase().includes(q);
      const matchCat = !activeCategory || w.category === activeCategory;
      return matchSearch && matchCat;
    });
  }, [search, activeCategory]);

  const countByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    WORKFLOW_CATEGORIES.forEach(c => { map[c] = WORKFLOWS.filter(w => w.category === c).length; });
    return map;
  }, []);

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <GitCommit className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-slate-100">Part 2: Conveyancing Workflows</h1>
            <p className="text-slate-400 text-sm">{WORKFLOWS.length} transactions — step-by-step with documents, legal basis, and AI explanations per step</p>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 bg-blue-500/5 border border-blue-500/20 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-300/80">Click any workflow to expand steps. Click "Ask AI to explain this step" for a detailed practitioner-level explanation of any individual step.</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input data-testid="input-workflow-search" type="text" placeholder="Search workflows..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-gold-900 border border-gold-700 rounded-xl pl-11 pr-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-500" />
        {search && <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">Clear</button>}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setActiveCategory(null)} data-testid="filter-all-workflows"
          className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${!activeCategory ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-gold-900 border-gold-700 text-slate-400'}`}>
          All ({WORKFLOWS.length})
        </button>
        {WORKFLOW_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${activeCategory === cat ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-gold-900 border-gold-700 text-slate-400 hover:border-slate-600'}`}>
            {cat} ({countByCategory[cat] || 0})
          </button>
        ))}
      </div>

      {(search || activeCategory) && (
        <p className="text-xs text-slate-500 mb-4">Showing {filtered.length} of {WORKFLOWS.length} workflows</p>
      )}

      <div className="space-y-3">
        {filtered.length > 0 ? filtered.map(w => <WorkflowCard key={w.id} workflow={w} />) : (
          <div className="text-center py-16 text-slate-500">
            <GitCommit className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No workflows found</p>
          </div>
        )}
      </div>
    </div>
  );
}
