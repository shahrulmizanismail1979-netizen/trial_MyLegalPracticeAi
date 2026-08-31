import { Search, FileText, Briefcase, Sparkles, Gavel, FileCheck, ArrowRight, ArrowUpRight } from "lucide-react";
import { AUDIT } from "@/fixtures/lawyes-preview";
import type { RouterState } from "./use-router-state";

export function HomeView({ state, navigate }: { state: RouterState; navigate: (view: "search" | "draft" | "matter" | "practice", params?: Partial<RouterState>) => void }) {
  return (
    <div className="px-5 py-12 md:py-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-3xl mx-auto text-center mb-16">
        <h1 className="text-4xl md:text-5xl lg:text-6xl text-foreground font-serif leading-[1.1] mb-6">
          Find the law. Draft the document. Build the matter.
        </h1>
        <p className="text-lg md:text-xl text-foreground/70 leading-relaxed max-w-2xl mx-auto">
          Dependable Sarawak practitioner workspace. Verified precedent, authoritative gateways, and editable templates to anchor your practice.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const q = fd.get("q") as string;
            navigate("search", { q });
          }}
          className="mt-10 max-w-2xl mx-auto relative group"
        >
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
            <Sparkles size={20} />
          </div>
          <input
            type="text"
            name="q"
            defaultValue={state.q}
            placeholder="Describe your legal issue, search for a case, or ask a question..."
            className="w-full pl-12 pr-20 py-5 text-lg border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl shadow-sm transition-all outline-none"
            aria-label="Search judgments, principles, or legislation. Press Enter to submit."
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground text-xs font-medium bg-muted px-2 py-1 rounded hidden sm:block">
            Enter ↵
          </div>
        </form>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        <button onClick={() => navigate("search")} className="group text-left p-6 bg-white border border-border rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 flex flex-col h-full">
          <div className="p-3 bg-secondary/10 text-secondary w-fit rounded-lg mb-5 group-hover:scale-110 transition-transform">
            <Search size={24} />
          </div>
          <h2 className="text-xl font-serif text-foreground mb-2 flex justify-between items-center">
            Search Law &amp; Cases
            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-secondary" />
          </h2>
          <p className="text-sm text-foreground/70 leading-relaxed mb-6">
            Search published judgments, access records, and verified statutes specific to Sabah and Sarawak.
          </p>
          <div className="mt-auto pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>{AUDIT.publishedReports} verified reports</span>
            <span className="font-medium group-hover:text-primary transition-colors">Explore &rarr;</span>
          </div>
        </button>

        <button onClick={() => navigate("draft")} className="group text-left p-6 bg-white border border-border rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 flex flex-col h-full">
          <div className="p-3 bg-secondary/10 text-secondary w-fit rounded-lg mb-5 group-hover:scale-110 transition-transform">
            <FileText size={24} />
          </div>
          <h2 className="text-xl font-serif text-foreground mb-2 flex justify-between items-center">
            Draft a Legal Document
            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-secondary" />
          </h2>
          <p className="text-sm text-foreground/70 leading-relaxed mb-6">
            Build editable templates with guided intake, practitioner-review checklists, and built-in source maps.
          </p>
          <div className="mt-auto pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>{AUDIT.precedentsAdded} precedents</span>
            <span className="font-medium group-hover:text-primary transition-colors">Start draft &rarr;</span>
          </div>
        </button>

        <button onClick={() => navigate("matter")} className="group text-left p-6 bg-white border border-border rounded-xl shadow-sm hover:shadow-md hover:border-primary/30 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 flex flex-col h-full">
          <div className="p-3 bg-secondary/10 text-secondary w-fit rounded-lg mb-5 group-hover:scale-110 transition-transform">
            <Briefcase size={24} />
          </div>
          <h2 className="text-xl font-serif text-foreground mb-2 flex justify-between items-center">
            Work on a Matter
            <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-secondary" />
          </h2>
          <p className="text-sm text-foreground/70 leading-relaxed mb-6">
            Bundle search findings, draft instructions, and local exports into a focused practitioner workspace.
          </p>
          <div className="mt-auto pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Local session only</span>
            <span className="font-medium group-hover:text-primary transition-colors">Open matter &rarr;</span>
          </div>
        </button>

        <button onClick={() => navigate("practice")} className="group text-left p-6 bg-primary text-white border border-primary rounded-xl shadow-md hover:shadow-lg hover:bg-primary/95 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 flex flex-col h-full relative overflow-hidden">
          <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-bl-full -mr-8 -mt-8"></div>
          <div className="p-3 bg-white/10 text-white w-fit rounded-lg mb-5 group-hover:scale-110 transition-transform relative z-10">
            <Gavel size={24} />
          </div>
          <h2 className="text-xl font-serif text-white mb-2 flex justify-between items-center relative z-10">
            Sarawak Practice Centre
            <ArrowUpRight size={16} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-white/80" />
          </h2>
          <p className="text-sm text-white/80 leading-relaxed mb-6 relative z-10">
            Navigate specific procedural workflows, checklists, and source paths for local litigation and native law.
          </p>
          <div className="mt-auto pt-4 border-t border-white/20 flex items-center justify-between text-xs text-white/70 relative z-10">
            <span>{AUDIT.verifiedCurrentAdditions} verified sources</span>
            <span className="font-medium text-white group-hover:text-white transition-colors">Enter centre &rarr;</span>
          </div>
        </button>
      </div>

      <div className="mt-16 max-w-4xl mx-auto border border-amber-200 bg-amber-50/50 rounded-lg p-5 text-sm flex gap-4 text-amber-900">
        <FileCheck size={20} className="shrink-0 text-amber-600" />
        <div>
          <strong className="font-bold">Safe Preview Demonstration</strong>
          <p className="mt-1 opacity-90">This is a local, in-memory preview of the LAWYes Sarawak interface. It does not connect to a live database, save data, or provide substantive legal advice. Any text exported or printed is for demonstration only.</p>
        </div>
      </div>
    </div>
  );
}