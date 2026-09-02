import { useState } from "react";
import { Search, FileText, Briefcase, Gavel, ArrowRight, ShieldAlert } from "lucide-react";
import type { RouterState } from "./use-router-state";

export function HomeView({ state, navigate }: { state: RouterState; navigate: (view: "search" | "draft" | "matter" | "practice", params?: Partial<RouterState>) => void }) {
  const [q, setQ] = useState(state.q || "");

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (q.trim()) navigate("search", { q });
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto no-scrollbar pb-24 md:pb-8 relative animate-in fade-in duration-500">
      <div className="flex-1 flex flex-col justify-center items-center max-w-4xl mx-auto w-full px-4 md:px-8 py-12 md:py-24">

        {/* Central Instruction Surface */}
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-secondary">
          Find the law. Draft the document. Prepare the matter.
        </h2>
        <h1 className="text-3xl md:text-5xl font-serif text-foreground text-center mb-10 tracking-tight">
          How can I assist your practice today?
        </h1>

        <form onSubmit={handleSubmit} className="w-full max-w-3xl bg-white border border-border shadow-sm rounded-2xl p-2 focus-within:ring-4 focus-within:ring-primary/10 focus-within:border-primary transition-all flex flex-col mb-16">
          <textarea
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Describe your legal issue, search for a case, or ask a question..."
            aria-label="Search judgments, principles, and legal materials"
            data-testid="input-lawyes-instruction"
            className="w-full resize-none outline-none p-4 text-lg bg-transparent text-foreground placeholder:text-muted-foreground min-h-[120px]"
          />
          <div className="flex justify-between items-center px-3 pb-2 pt-1 border-t border-muted/50 mt-2">
            <div className="flex gap-2 items-center">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold px-2 py-1 bg-muted/50 rounded flex items-center gap-1.5">
                 <ShieldAlert size={12} className="text-secondary" />
                 Safe Preview Mode
              </span>
            </div>
            <button
              type="submit"
              disabled={!q.trim()}
              className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
              aria-label="Submit search"
              data-testid="button-submit-instruction"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </form>

        {/* 4 Primary Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
          <button onClick={() => navigate("search")} className="group text-left p-5 bg-white border border-border rounded-xl hover:border-primary/40 hover:shadow-md transition-all flex flex-col gap-3 focus:outline-none focus:ring-2 focus:ring-primary/20" data-testid="button-action-search">
             <div className="w-10 h-10 rounded-lg bg-primary/5 text-primary flex items-center justify-center group-hover:scale-110 transition-transform"><Search size={20} /></div>
             <div>
               <h2 className="font-medium text-foreground mb-1 group-hover:text-primary transition-colors">Search Law &amp; Cases</h2>
               <div className="text-xs text-muted-foreground leading-relaxed">Find verified judgments, records, and statutes.</div>
             </div>
          </button>

          <button onClick={() => navigate("draft")} className="group text-left p-5 bg-white border border-border rounded-xl hover:border-primary/40 hover:shadow-md transition-all flex flex-col gap-3 focus:outline-none focus:ring-2 focus:ring-primary/20" data-testid="button-action-draft">
             <div className="w-10 h-10 rounded-lg bg-primary/5 text-primary flex items-center justify-center group-hover:scale-110 transition-transform"><FileText size={20} /></div>
             <div>
               <h2 className="font-medium text-foreground mb-1 group-hover:text-primary transition-colors">Draft a Legal Document</h2>
               <div className="text-xs text-muted-foreground leading-relaxed">Editable templates with guided logic paths.</div>
             </div>
          </button>

          <button onClick={() => navigate("matter")} className="group text-left p-5 bg-white border border-border rounded-xl hover:border-primary/40 hover:shadow-md transition-all flex flex-col gap-3 focus:outline-none focus:ring-2 focus:ring-primary/20" data-testid="button-action-matter">
             <div className="w-10 h-10 rounded-lg bg-primary/5 text-primary flex items-center justify-center group-hover:scale-110 transition-transform"><Briefcase size={20} /></div>
             <div>
               <h2 className="font-medium text-foreground mb-1 group-hover:text-primary transition-colors">Work on a Matter</h2>
               <div className="text-xs text-muted-foreground leading-relaxed">Consolidate findings into a local workspace.</div>
             </div>
          </button>

          <button onClick={() => navigate("practice")} className="group text-left p-5 bg-primary text-white border border-primary rounded-xl hover:bg-primary/95 hover:shadow-md transition-all flex flex-col gap-3 relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/50" data-testid="button-action-practice">
             <div className="absolute right-0 top-0 w-24 h-24 bg-white/5 rounded-bl-full -mr-4 -mt-4 pointer-events-none"></div>
             <div className="w-10 h-10 rounded-lg bg-white/10 text-secondary flex items-center justify-center group-hover:scale-110 transition-transform relative z-10"><Gavel size={20} /></div>
             <div className="relative z-10">
               <h2 className="font-medium mb-1">Sarawak Practice Centre</h2>
               <div className="text-xs text-white/70 leading-relaxed">Specific workflows for Sarawak litigation.</div>
             </div>
          </button>
        </div>

        <div className="mt-8 w-full rounded-xl border border-secondary/20 bg-secondary/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground" data-testid="status-safe-preview-demonstration">
          <span className="font-semibold text-foreground">Safe Preview Demonstration</span>
          {" "}Uses reviewed local fixtures only. No production API, database, authentication, billing, upload, AI, persistence, or server write is active.
        </div>
      </div>
    </div>
  );
}
