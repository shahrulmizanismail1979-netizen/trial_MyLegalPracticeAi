import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, ArrowRight, Gavel, Search, Bot, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useSendChatMessage } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { CASES, type CaseDef } from '@/lib/casesData';

const ALL_TAGS = Array.from(new Set(CASES.flatMap(c => c.tags))).sort();

function CaseVisualSummary({ caseItem }: { caseItem: CaseDef }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const chatMutation = useSendChatMessage();
  const { toast } = useToast();

  const handleGenerate = async () => {
    setOpen(true);
    if (summary) return;
    try {
      const result = await chatMutation.mutateAsync({
        data: {
          history: [],
          message: `Create an illustrated, step-by-step visual story summary of this Malaysian land law case for law students. Make it vivid, easy to understand, and educational.

CASE: ${caseItem.title}
CITATION: ${caseItem.citation}
TOPIC: ${caseItem.topic}
FACTS: ${caseItem.facts}
HELD: ${caseItem.held}
SIGNIFICANCE: ${caseItem.significance}

Please structure your response as:
🏠 THE STORY (narrate the facts as a story with named characters and a clear timeline)
⚖️ THE LEGAL QUESTION (what the court had to decide)
📜 WHAT THE COURT DECIDED (the holding explained simply)
🎯 WHY IT MATTERS (practical importance for legal practitioners)
💡 REMEMBER THIS BECAUSE... (a memorable hook or mnemonic for students)

Use clear, simple language as if explaining to a first-year law student. Use analogies where helpful.`
        }
      });
      setSummary(result.response);
    } catch {
      toast({ title: 'AI summary failed', variant: 'destructive' });
    }
  };

  return (
    <div className="mt-4 border-t border-gold-800 pt-4">
      <button onClick={handleGenerate} disabled={chatMutation.isPending && open}
        className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-amber-400 transition-colors">
        {chatMutation.isPending && open ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating AI Summary...</> : <><Bot className="w-4 h-4" /> Generate AI Visual Case Summary</>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-3">
            <div className="bg-gold-950 border border-amber-500/20 rounded-xl p-5">
              {chatMutation.isPending && !summary ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin text-amber-500" /><span>AI is analysing the case...</span></div>
              ) : (
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-relaxed">{summary}</pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CaseCard({ c, index }: { c: CaseDef; index: number }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.04, 0.5) }}
      className="bg-gold-900 border border-gold-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="bg-gold-950 p-5 border-b border-gold-800">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div>
            <h2 className="text-lg md:text-xl font-bold font-serif text-slate-100">{c.title}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-amber-500 font-mono text-xs bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{c.citation}</span>
              <span className="text-slate-500 text-xs flex items-center gap-1"><Gavel className="w-3 h-3" />{c.topic}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {c.tags.map(t => <span key={t} className="text-xs text-slate-500 bg-gold-800 border border-gold-700 px-2 py-0.5 rounded-full">{t}</span>)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Left: Facts, Issue, Held */}
        <div className="p-5 border-b lg:border-b-0 lg:border-r border-gold-800 space-y-4">
          <div>
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> Issue</h3>
            <p className="text-slate-300 text-sm leading-relaxed font-medium">{c.issue}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> Facts</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{c.facts}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> Held</h3>
            <p className="text-slate-100 font-medium text-sm leading-relaxed bg-gold-800/50 p-4 rounded-xl border border-gold-700/50">{c.held}</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Significance</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{c.significance}</p>
          </div>
        </div>

        {/* Right: Visual Diagram */}
        <div className="p-5 bg-gold-950/30 flex flex-col">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 text-center">Visual Diagram</div>
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex justify-between items-center mb-4 relative">
              <div className="absolute top-1/2 left-0 w-full h-px bg-gold-800 -z-10" />
              <div className="bg-gold-800 p-3 rounded-lg text-xs font-bold text-slate-200 border border-gold-700 max-w-[42%] text-center z-10">{c.diagram.parties[0]}</div>
              <div className="bg-gold-900 rounded-full p-1 z-10"><ArrowRight className="text-amber-500 w-4 h-4" /></div>
              <div className="bg-gold-800 p-3 rounded-lg text-xs font-bold text-slate-200 border border-gold-700 max-w-[42%] text-center z-10">{c.diagram.parties[1]}</div>
            </div>
            <div className="bg-rose-500/10 text-rose-300 text-sm p-3 rounded-xl font-medium mb-3 text-center border border-rose-500/20">
              <span className="font-bold text-rose-400 block text-xs uppercase mb-1">Issue</span>
              {c.diagram.issue}
            </div>
            <div className="bg-emerald-500/10 text-emerald-300 text-sm p-3 rounded-xl font-medium text-center border border-emerald-500/20">
              <span className="font-bold text-emerald-400 block text-xs uppercase mb-1">Result</span>
              {c.diagram.result}
            </div>
          </div>

          {/* AI Case Summariser */}
          <CaseVisualSummary caseItem={c} />
        </div>
      </div>
    </motion.div>
  );
}

export function CasesSection() {
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('All');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return CASES.filter(c => {
      const matchSearch = !q || c.title.toLowerCase().includes(q) || c.citation.toLowerCase().includes(q) || c.topic.toLowerCase().includes(q) || c.facts.toLowerCase().includes(q) || c.held.toLowerCase().includes(q);
      const matchTag = activeTag === 'All' || c.tags.includes(activeTag);
      return matchSearch && matchTag;
    });
  }, [search, activeTag]);

  return (
    <div className="max-w-5xl mx-auto pb-24">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <Briefcase className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-slate-100">Part 4: Leading Cases in Conveyancing</h1>
            <p className="text-slate-400 text-sm">{CASES.length} landmark Malaysian cases with facts, issues, holdings, visual diagrams & AI case simplifier</p>
          </div>
        </div>
        <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-xl p-3 mt-3">
          <Bot className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-300/80">Each case has an AI Case Summariser — click "Generate AI Visual Case Summary" to get a plain-English illustrated breakdown of the case, perfect for exam revision.</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input data-testid="input-case-search" type="text" placeholder="Search cases by name, citation, topic, or keyword..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-gold-900 border border-gold-700 rounded-xl pl-11 pr-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-500" />
        {search && <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">Clear</button>}
      </div>

      {/* Tag filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setActiveTag('All')} className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${activeTag === 'All' ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-gold-800 border-gold-700 text-slate-400'}`}>
          All ({CASES.length})
        </button>
        {ALL_TAGS.map(tag => (
          <button key={tag} onClick={() => setActiveTag(tag === activeTag ? 'All' : tag)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${activeTag === tag ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-gold-800 border-gold-700 text-slate-400 hover:border-slate-600'}`}>
            {tag}
          </button>
        ))}
      </div>

      {(search || activeTag !== 'All') && (
        <p className="text-xs text-slate-500 mb-4">Showing {filtered.length} of {CASES.length} cases</p>
      )}

      <div className="space-y-6">
        {filtered.map((c, i) => <CaseCard key={c.id} c={c} index={i} />)}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <Gavel className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No cases found</p>
            <p className="text-xs mt-1">Try a different search term or clear the tag filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
