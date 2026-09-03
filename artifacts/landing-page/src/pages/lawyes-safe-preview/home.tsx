import { useState, useMemo } from "react";
import { Search, FileText, Briefcase, Gavel, ArrowUp, ShieldAlert, Sparkles, ChevronRight, Layers, BookOpen, CreditCard, HeartHandshake, ShieldCheck, LogIn, Grid, ExternalLink } from "lucide-react";
import type { RouterState } from "./use-router-state";
import { findCapabilities } from "../../fixtures/lawyes-skills";
import { LIVE_PORTALS } from "../../lib/product-catalog";
import { FrontDoorAssistant } from "../../components/front-door-assistant";

export function HomeView({ state, navigate }: { state: RouterState; navigate: (view: "search" | "draft" | "matter" | "practice" | "skills", params?: Partial<RouterState>) => void }) {
  const [q, setQ] = useState(state.q || "");

  const matchedSkills = useMemo(() => {
    return findCapabilities(q);
  }, [q]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!q.trim()) return;
    const firstMatch = matchedSkills[0];
    if (firstMatch?.workspaceDestination) {
      navigate(firstMatch.workspaceDestination, { q });
      return;
    }
    if (firstMatch) {
      navigate("skills", { q, capabilityId: firstMatch.id });
      return;
    }
    navigate("skills", { q });
  };

  return (
    <div data-testid="lawyes-conversation-canvas" className="h-full flex flex-col relative animate-in fade-in duration-500 bg-background text-foreground overflow-y-auto no-scrollbar pb-[100px] md:pb-8">
      <div className="flex-1 flex flex-col justify-start md:justify-center items-center max-w-5xl mx-auto w-full px-4 md:px-8 pt-12 md:pt-16 pb-8">
        <div className="w-full max-w-3xl flex flex-col items-center">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground text-center">
          Malaysia-wide legal work &middot; Explicit Sarawak Specialization &middot; Jurisdiction-specific safeguards
        </h2>
        <h1 className="text-3xl md:text-4xl font-serif text-foreground text-center mb-8 tracking-tight">
          How can I assist your practice today?
        </h1>

        <form aria-label="Legal instruction composer" data-testid="lawyes-instruction-composer" onSubmit={handleSubmit} className="w-full bg-card border border-border shadow-md rounded-[24px] p-2 focus-within:ring-2 focus-within:ring-primary/20 transition-all flex flex-col mb-8 relative">
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
            className="w-full resize-none outline-none p-4 text-base bg-transparent text-foreground placeholder:text-muted-foreground min-h-[120px]"
          />

          {/* Capability routing suggestions */}
          <div className="px-4 pb-2 flex flex-col gap-2">
            {q.trim() && matchedSkills.length > 0 ? (
              <div className="animate-in fade-in slide-in-from-top-1 space-y-1.5 mb-2" data-testid="container-skill-suggestions">
                <div className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5 px-1">
                  <Sparkles size={12} /> Suggested Capabilities
                </div>
                {matchedSkills.map(skill => (
                  <button
                    key={skill.id}
                    onClick={(e) => {
                      e.preventDefault();
                      if (skill.workspaceDestination) {
                        navigate(skill.workspaceDestination, { q });
                      } else {
                        navigate("skills", { q, capabilityId: skill.id });
                      }
                    }}
                    className="w-full flex items-center justify-between text-left px-3 py-2.5 rounded-xl bg-muted/50 hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-colors group focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid={`button-suggested-skill-${skill.id}`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="shrink-0 w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Layers size={14} />
                      </div>
                      <div className="truncate">
                        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{skill.name}</div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex justify-between items-center gap-3 px-2 pb-2">
             <div className="flex items-center">
               {!q.trim() && (
                 <div className="animate-in fade-in" data-testid="container-browse-skills">
                  <button
                    onClick={(e) => { e.preventDefault(); navigate("skills"); }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                    data-testid="button-browse-skills-inline"
                  >
                     <Layers size={14} /> Tools
                  </button>
                </div>
               )}
             </div>

            <button
              type="submit"
              disabled={!q.trim()}
              className="w-10 h-10 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 flex items-center justify-center shrink-0"
              aria-label="Submit instruction"
              data-testid="button-submit-instruction"
            >
              <ArrowUp size={20} strokeWidth={2.5} />
            </button>
          </div>
        </form>

        {/* 4 Primary Actions as Suggestion Chips */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 w-full animate-in fade-in slide-in-from-bottom-2">
          <button onClick={() => navigate("search")} className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-full hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm hover:shadow" data-testid="button-action-search">
             <Search size={16} className="text-primary" />
             <h2 className="text-sm font-medium">Search Law &amp; Cases</h2>
          </button>

          <button onClick={() => navigate("draft")} className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-full hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm hover:shadow" data-testid="button-action-draft">
             <FileText size={16} className="text-primary" />
             <h2 className="text-sm font-medium">Draft a Legal Document</h2>
          </button>

          <button onClick={() => navigate("matter")} className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-full hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm hover:shadow" data-testid="button-action-matter">
             <Briefcase size={16} className="text-primary" />
             <h2 className="text-sm font-medium">Work on a Matter</h2>
          </button>

          <button onClick={() => navigate("practice")} className="flex items-center gap-2 px-4 py-2.5 bg-card border border-primary/30 rounded-full hover:border-primary/60 hover:bg-primary/5 transition-all text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 shadow-sm hover:shadow" data-testid="button-action-practice">
             <Gavel size={16} className="text-primary" />
              <h2 className="text-sm font-medium">Malaysia Practice &amp; State Sources</h2>
          </button>
        </div>
        <div className="mt-5 flex items-center gap-1.5 text-[10px] text-muted-foreground" data-testid="status-safe-preview-demonstration">
          <ShieldAlert size={12} />
          <span>Safe Preview Demonstration</span>
        </div>
        </div>

        {/* Platform Depth Integration */}
        <div className="w-full mt-16 mb-4 border-t border-border pt-10 animate-in fade-in slide-in-from-bottom-4">
          <div className="mb-7 max-w-3xl">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              The complete LAWYes platform
            </p>
            <h2 className="font-serif text-2xl text-foreground md:text-3xl">
              Your workspace is only the beginning.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">
              Continue into reviewed Malaysian judgments, persistent matter work, specialist practice
              systems, professional access plans, contributions, and the platform&apos;s security and
              verification commitments.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 text-left">
            {/* Core Platform */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Layers size={14} /> Core Platform
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a href="/mylitai/app/case-law" className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-sm group shadow-sm" data-testid="link-home-judgment-library">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><BookOpen size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold group-hover:text-primary transition-colors">Judgment Library</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Reviewed Malaysian case-law research</div>
                  </div>
                </a>
                <a href="/lawyes" className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-sm group shadow-sm" data-testid="link-home-my-matters">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Briefcase size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold group-hover:text-primary transition-colors">My Matters</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Documents, discussions, tasks and deadlines</div>
                  </div>
                </a>
                <a href="/apps#pricing" className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-sm group shadow-sm" data-testid="link-home-pricing">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><CreditCard size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold group-hover:text-primary transition-colors">Pricing &amp; Access</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Individual, firm, corporate and education plans</div>
                  </div>
                </a>
                <a href="/sign-in" className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-sm group shadow-sm" data-testid="link-home-sign-in">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><LogIn size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold group-hover:text-primary transition-colors">Sign In</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Return to your account and subscribed services</div>
                  </div>
                </a>
                <a href="/contribute" className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-sm group shadow-sm" data-testid="link-home-contribute">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><HeartHandshake size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold group-hover:text-primary transition-colors">Contribute</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Help expand the reviewed Malaysian corpus</div>
                  </div>
                </a>
                <a href="/apps#about" className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-sm group shadow-sm" data-testid="link-home-trust">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><ShieldCheck size={16} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold group-hover:text-primary transition-colors">Trust &amp; Security</div>
                    <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Privacy, verification and professional safeguards</div>
                  </div>
                </a>
              </div>
            </div>

            {/* Specialist Portals */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Grid size={14} /> Specialist Practice Systems
                </h3>
                <a href="/apps" className="text-[10px] font-bold text-primary hover:underline" data-testid="link-home-all-portals">VIEW CATALOG</a>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {LIVE_PORTALS.map(portal => (
                  <a key={portal.id} href={portal.url} className="flex flex-col gap-1.5 p-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all group shadow-sm" data-testid={`link-home-portal-${portal.id}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold group-hover:text-primary transition-colors">{portal.title}</span>
                      <ExternalLink size={12} className="text-muted-foreground group-hover:text-primary shrink-0 ml-1" />
                    </div>
                    <span className="text-[10px] text-primary uppercase tracking-wider font-semibold">{portal.tag}</span>
                    <span className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">{portal.description}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <FrontDoorAssistant workspace />
    </div>
  );
}
