import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PenTool, Search, ChevronDown, ChevronUp, FileText, Copy, Bot, Loader2, AlertCircle, FileDown, Download, Lock } from 'lucide-react';
import { useLocation } from 'wouter';
import { FORMS_LIBRARY, FORM_CATEGORIES, type FormDoc } from '@/lib/formsData';
import { useApp } from '@/contexts/AppContext';
import { useGenerateDraft } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { downloadDocx, downloadAndOpenInGoogleDocs } from '@/lib/exportDocx';
import { hasTier, EXPORT_MIN_TIER, TIER_LABELS, requiredTierForTool } from '@/lib/tier';
import { DraftDocument, DraftExportButtons } from '@workspace/draft-export/react';

function FormCard({ form }: { form: FormDoc }) {
  const [open, setOpen] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [downloading, setDownloading] = useState<null | 'word' | 'gdocs'>(null);
  const { toast } = useToast();
  const { currentUser } = useApp();
  const [, navigate] = useLocation();
  const canExport =
    !!currentUser?.grandfathered || hasTier(currentUser?.tier, EXPORT_MIN_TIER);

  const handleCopy = () => {
    navigator.clipboard.writeText(form.sample)
      .then(() => toast({ title: 'Sample copied to clipboard' }))
      .catch(() => toast({ title: 'Copy failed', variant: 'destructive' }));
  };

  const handleExport = async (target: 'word' | 'gdocs') => {
    setDownloading(target);
    try {
      const title = `${form.formNumber} — ${form.name}`;
      if (target === 'word') {
        await downloadDocx({ title, content: form.sample, docType: 'land-office', filename: `${form.formNumber}_${form.name}` });
        toast({ title: 'Sample downloaded as Word', description: `${form.formNumber}.docx — Land Office formatted` });
      } else {
        await downloadAndOpenInGoogleDocs({ title, content: form.sample, docType: 'land-office', filename: `${form.formNumber}_${form.name}` });
        toast({ title: 'Opening Google Docs…', description: 'In Docs: File → Open → Upload → drag the just-downloaded .docx file.' });
      }
    } catch (err) {
      toast({ title: 'Export failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-gold-900 border border-gold-800 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full p-5 flex items-start gap-4 text-left hover:bg-gold-800/40 transition-colors group">
        <div className="p-2.5 bg-gold-800 rounded-xl shrink-0">
          <FileText className="w-5 h-5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{form.formNumber}</span>
            <span className="text-xs text-slate-500 bg-gold-800 px-2 py-0.5 rounded">{form.category}</span>
          </div>
          <h3 className="font-serif font-bold text-slate-100 text-base group-hover:text-amber-400 transition-colors">{form.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5 italic">{form.nameMs}</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-1" />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-gold-800 px-5 py-5 space-y-5">
              {/* Legal Basis */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Legal Basis</p>
                <p className="text-xs text-amber-400 font-mono bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2">{form.legalBasis}</p>
              </div>

              {/* Purpose */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Purpose & Function</p>
                <p className="text-sm text-slate-300 leading-relaxed">{form.purpose}</p>
              </div>

              {/* Who Uses It */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Who Uses It / Who Executes It</p>
                <p className="text-sm text-slate-300 leading-relaxed">{form.whoUses}</p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Key Fields */}
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Key Information Required</p>
                  <ul className="space-y-1.5">
                    {form.keyFields.map((f, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                        <span className="text-amber-500 mt-0.5 shrink-0">▸</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Practical Info */}
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Stamp Duty</p>
                    <p className="text-xs text-slate-300">{form.stampDuty}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Filing Timeline</p>
                    <p className="text-xs text-slate-300">{form.timeline}</p>
                  </div>
                </div>
              </div>

              {/* Important Notes */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Important Notes & Common Pitfalls
                </p>
                <ul className="space-y-1.5">
                  {form.importantNotes.map((n, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-amber-200/80">
                      <span className="text-amber-500 mt-0.5 shrink-0">!</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Sample */}
              <div>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <button onClick={() => setSampleOpen(v => !v)} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-200 transition-colors">
                    <FileText className="w-3.5 h-3.5" />
                    {sampleOpen ? 'Hide Sample Document' : 'View Sample Document'}
                    {sampleOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {sampleOpen && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-gold-800 px-3 py-1.5 rounded-lg border border-gold-700 transition-colors" title="Copy plain text">
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                      {canExport ? (
                        <>
                          <button
                            onClick={() => handleExport('word')}
                            disabled={downloading !== null}
                            className="flex items-center gap-1.5 text-xs text-amber-100 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors font-semibold shadow"
                            title="Download as MS Word — Land Office format"
                          >
                            {downloading === 'word' ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />} Word
                          </button>
                          <button
                            onClick={() => handleExport('gdocs')}
                            disabled={downloading !== null}
                            className="flex items-center gap-1.5 text-xs text-amber-100 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors font-semibold shadow"
                            title="Download .docx and open Google Docs to upload"
                          >
                            {downloading === 'gdocs' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Google Docs
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => navigate('/pricing')}
                          data-testid="button-export-locked"
                          className="flex items-center gap-1.5 text-xs text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors font-semibold"
                          title={`Document export requires the ${TIER_LABELS[EXPORT_MIN_TIER]} plan`}
                        >
                          <Lock className="w-3 h-3" /> Unlock downloads
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <AnimatePresence initial={false}>
                  {sampleOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="bg-gold-950 border border-gold-700 rounded-xl p-4">
                        <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300 leading-relaxed">{form.sample}</pre>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2 italic">
                        Word/Google Docs export uses official Malaysian Land Office layout (A4, Times New Roman 12pt, MALAYSIA / Pejabat Tanah header, Ruj. Kami / Tarikh, signature & witness blocks).
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function AIDrafterPanel() {
  const { setAiMode, setIsAiPanelOpen, setDrafterInitialType, currentUser } = useApp();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const draftMutation = useGenerateDraft();
  const [language, setLanguage] = useState<'en' | 'bm'>('en');
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');

  const canDraft =
    !!currentUser?.grandfathered || hasTier(currentUser?.tier, requiredTierForTool('drafter'));

  const handleGenerate = async () => {
    if (!canDraft) {
      toast({
        title: `AI Drafter requires the ${TIER_LABELS[requiredTierForTool('drafter')]} plan`,
        description: 'Upgrade to unlock document drafting.',
        variant: 'destructive',
      });
      navigate('/pricing');
      return;
    }
    if (!prompt.trim()) {
      toast({ title: 'Please describe what you want to draft', variant: 'destructive' });
      return;
    }
    const langInstruction = language === 'bm'
      ? 'IMPORTANT: Draft the document ENTIRELY in Bahasa Malaysia (Bahasa Melayu). Use formal legal Bahasa Malaysia. All headings, clauses, and text must be in Bahasa Malaysia.'
      : 'Draft the document in English. Use formal Malaysian legal English.';
    try {
      const res = await draftMutation.mutateAsync({
        data: {
          clauseType: prompt,
          variables: langInstruction
        }
      });
      setResult(res.draft);
    } catch {
      toast({ title: 'Draft generation failed', variant: 'destructive' });
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result)
      .then(() => toast({ title: 'Copied to clipboard' }))
      .catch(() => toast({ title: 'Copy failed', variant: 'destructive' }));
  };

  return (
    <div className="bg-gold-900 border border-gold-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-amber-500/10 rounded-lg">
          <Bot className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h3 className="font-serif font-bold text-slate-100">Quick AI Drafter</h3>
          <p className="text-xs text-slate-400">Generate any Malaysian legal document or clause instantly</p>
        </div>
      </div>

      {/* Language Toggle */}
      <div className="flex gap-2">
        <button onClick={() => setLanguage('en')} data-testid="lang-en"
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${language === 'en' ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-gold-950 border-gold-700 text-slate-400'}`}>
          English
        </button>
        <button onClick={() => setLanguage('bm')} data-testid="lang-bm"
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${language === 'bm' ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-gold-950 border-gold-700 text-slate-400'}`}>
          Bahasa Melayu
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Describe what you want to draft {language === 'bm' ? '(akan dijana dalam Bahasa Melayu)' : '(will be drafted in English)'}
        </label>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
          placeholder={language === 'bm' ? 'Contoh: Surat tuntutan tunggakan sewa kepada penyewa yang ingkar' : 'e.g. LAD clause for late delivery of VP in Schedule H SPA'}
          className="w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 resize-none"
        />
      </div>

      <button onClick={handleGenerate} disabled={draftMutation.isPending || !prompt.trim()} data-testid="btn-quick-draft"
        className="w-full py-3 bg-amber-500 text-slate-900 font-bold rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        {draftMutation.isPending ? <><Loader2 className="w-5 h-5 animate-spin" /> Drafting...</> : <><Bot className="w-5 h-5" /> Generate Draft</>}
      </button>

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Generated Draft</p>
            <DraftExportButtons title="Conveyancing Draft" content={result} hideMarkdown />
          </div>
          <div className="bg-gold-950 border border-gold-700 rounded-xl p-4 text-slate-300">
            <DraftDocument content={result} />
          </div>
          <p className="text-xs text-slate-500 mt-2">Open the AI Drafter panel for the full template library with 170+ templates.</p>
          <button onClick={() => { setAiMode('drafter'); setIsAiPanelOpen(true); }} className="mt-2 text-xs text-amber-500 hover:text-amber-400 underline">
            Open full AI Drafter panel →
          </button>
        </motion.div>
      )}
    </div>
  );
}

export function FormsSection() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return FORMS_LIBRARY.filter(f => {
      const matchSearch = !q || f.name.toLowerCase().includes(q) || f.formNumber.toLowerCase().includes(q) || f.nameMs.toLowerCase().includes(q) || f.purpose.toLowerCase().includes(q) || f.legalBasis.toLowerCase().includes(q);
      const matchCat = !activeCategory || f.category === activeCategory;
      return matchSearch && matchCat;
    });
  }, [search, activeCategory]);

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <PenTool className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-slate-100">Part 3: Forms & Document Library</h1>
            <p className="text-slate-400 text-sm">{FORMS_LIBRARY.length} statutory forms & precedents with encyclopedic definitions, correct samples, and AI drafting in English & Bahasa Melayu</p>
          </div>
        </div>
      </div>

      {/* AI Drafter Panel */}
      <div className="mb-8">
        <AIDrafterPanel />
      </div>

      <div className="mb-6">
        <h2 className="font-serif font-bold text-slate-200 text-xl mb-1">Statutory Forms & Precedents Library</h2>
        <p className="text-sm text-slate-400">Click any form to expand its full definition, legal basis, key fields, important notes, and a correct sample document.</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input data-testid="input-form-search" type="text" placeholder="Search forms by name, number, or purpose..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-gold-900 border border-gold-700 rounded-xl pl-11 pr-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-500" />
        {search && <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">Clear</button>}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setActiveCategory(null)} className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${!activeCategory ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-gold-900 border-gold-700 text-slate-400'}`}>
          All ({FORMS_LIBRARY.length})
        </button>
        {FORM_CATEGORIES.map(cat => {
          const count = FORMS_LIBRARY.filter(f => f.category === cat).length;
          return (
            <button key={cat} onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${activeCategory === cat ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-gold-900 border-gold-700 text-slate-400 hover:border-slate-600'}`}>
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {(search || activeCategory) && (
        <p className="text-xs text-slate-500 mb-4">Showing {filtered.length} of {FORMS_LIBRARY.length} forms</p>
      )}

      <div className="space-y-3">
        {filtered.length > 0 ? filtered.map(f => <FormCard key={f.id} form={f} />) : (
          <div className="text-center py-16 text-slate-500">
            <PenTool className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No forms found</p>
          </div>
        )}
      </div>
    </div>
  );
}
