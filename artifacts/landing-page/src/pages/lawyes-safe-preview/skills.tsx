import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Layers,
  Search,
} from "lucide-react";
import {
  PUBLIC_CAPABILITY_REGISTRY,
  type CapabilityCategory,
} from "../../fixtures/lawyes-skills";
import { LIVE_PORTALS } from "../../lib/product-catalog";
import type { RouterState } from "./use-router-state";

const ALL = "All";
const PORTAL_ID_BY_SERVICE: Record<string, string> = {
  MyLitAI: "lit",
  MyConveyLitAI: "convey",
  MyCorpLegalAI: "corporate",
  MyCrimAI: "criminal",
  MySyalitAI: "syariah",
  MyCorpCommBankLitAI: "ccb",
  MyAccidentAI: "accident",
  MyLawAcad: "acad",
  MyLawFirmAi: "firm",
};

function specialistDestination(currentService: string) {
  const litigationPortal = LIVE_PORTALS.find((portal) => portal.id === "lit");
  if (currentService === "MyLitAI IRAC") {
    const iracVersion = litigationPortal?.versions?.find((version) => version.badge === "Version 2");
    return iracVersion ? { label: "MyLitAI IRAC", url: iracVersion.url } : null;
  }

  const portalId = PORTAL_ID_BY_SERVICE[currentService];
  const portal = LIVE_PORTALS.find((entry) => entry.id === portalId);
  return portal ? { label: portal.title, url: portal.url } : null;
}

function AvailabilityBadge({ availableHere }: { availableHere: boolean }) {
  if (availableHere) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2b7169] bg-[#e5f1ed] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#19514b]">
        <CheckCircle2 size={10} /> Available in preview
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-[#cbd5e1] bg-[#f8fafc] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#475569]">
      Live specialist service
    </span>
  );
}

export function SkillsView({
  state,
  navigate,
}: {
  state: RouterState;
  navigate: (view: RouterState["view"], params?: Partial<RouterState>) => void;
}) {
  const [search, setSearch] = useState(state.q || "");
  const [category, setCategory] = useState<CapabilityCategory | typeof ALL>(ALL);
  const [expandedId, setExpandedId] = useState<string | null>(state.capabilityId || null);

  const categories = useMemo(
    () => [...new Set(PUBLIC_CAPABILITY_REGISTRY.map((capability) => capability.category))],
    [],
  );
  const filteredCapabilities = useMemo(() => {
    const term = search.trim().toLowerCase();
    return PUBLIC_CAPABILITY_REGISTRY.filter((capability) => {
      if (category !== ALL && capability.category !== category) return false;
      if (!term) return true;
      const searchable = [
        capability.name,
        capability.description,
        capability.category,
        capability.currentService,
        ...capability.keywords,
        ...capability.examples,
      ].join(" ").toLowerCase();
      return searchable.includes(term);
    });
  }, [category, search]);

  return (
    <div className="relative flex h-full flex-col bg-background animate-in fade-in duration-300">
      <div className="shrink-0 border-b border-border bg-white p-6 shadow-sm md:p-8">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-2 flex items-center gap-3 text-primary">
            <Layers size={24} />
            <h1 className="font-serif text-2xl font-bold text-foreground">LAWYes Tools</h1>
          </div>
          <p className="mb-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Find the right LAWYes tool for your legal task. Search by what you need to do, or browse by practice area.
              Demonstration tools can be tried here. Live tools open their dedicated LAWYes specialist service.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-[1fr_240px]">
            <label className="relative">
              <span className="sr-only">Search tools</span>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                type="search"
                placeholder="Describe a task or search a tool..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-input bg-muted/30 py-3 pl-10 pr-4 text-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                data-testid="input-skills-search"
              />
            </label>
            <label>
              <span className="sr-only">Filter by practice area</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as CapabilityCategory | typeof ALL)}
                className="w-full rounded-xl border border-input bg-white px-3 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                data-testid="select-skills-category"
              >
                <option value={ALL}>All practice areas</option>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-background/50 p-6 md:p-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span data-testid="status-capability-count">{filteredCapabilities.length} tools and services</span>
            <span>Choose a tool to see what it can do</span>
          </div>

          {filteredCapabilities.map((capability) => {
            const expanded = expandedId === capability.id;
            const specialist = specialistDestination(capability.currentService);
            return (
              <article
                key={capability.id}
                className="overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-all hover:border-primary/30"
                data-testid={`card-capability-${capability.id}`}
              >
                <button
                  className="flex w-full items-start gap-4 px-6 py-5 text-left transition-colors focus:bg-muted/10 focus:outline-none"
                  onClick={() => setExpandedId(expanded ? null : capability.id)}
                  aria-expanded={expanded}
                  data-testid={`button-toggle-capability-${capability.id}`}
                >
                  <div className="mt-1 text-primary">
                    {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-3">
                      <h2 className="font-serif text-lg font-semibold text-foreground">{capability.name}</h2>
                      <span className="rounded border border-border bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">
                        {capability.category}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{capability.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <AvailabilityBadge availableHere={Boolean(capability.workspaceDestination)} />
                      <span className="text-[11px] text-muted-foreground">
                        {capability.workspaceDestination ? "LAWYes demonstration" : `Available in ${specialist?.label ?? "the specialist services catalogue"}`}
                      </span>
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-muted/50 bg-card px-6 pb-6 pt-5 animate-in slide-in-from-top-2" data-testid={`detail-capability-${capability.id}`}>
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-5">
                        <section>
                          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">What you will need</h3>
                          <ul className="space-y-1">
                            {capability.requiredInputs.map((input) => <li key={input} className="flex gap-2 text-sm"><span className="text-primary">•</span>{input}</li>)}
                          </ul>
                        </section>
                        <section>
                          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">What you will receive</h3>
                          <ul className="space-y-1">
                            {capability.outputTypes.map((output) => <li key={output} className="flex gap-2 text-sm"><span className="text-secondary">•</span>{output}</li>)}
                          </ul>
                        </section>
                      </div>

                      <div className="space-y-4">
                        <section className="rounded-lg border border-[#c7d0ca] bg-[#f8faf7] p-4">
                          <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#19514b]">Important</h3>
                          <p className="text-sm leading-relaxed text-[#425351]">
                            LAWYes provides legal support tools, not legal advice. Review generated work and source material before relying on it.
                          </p>
                        </section>
                        {capability.workspaceDestination ? (
                          <button
                            onClick={() => navigate(capability.workspaceDestination!)}
                            className="flex w-full items-center justify-between rounded-lg bg-primary p-3 text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                            data-testid={`button-open-capability-${capability.id}`}
                          >
                            <span className="text-sm font-medium">Open this LAWYes tool</span>
                            <ArrowUpRight size={16} />
                          </button>
                        ) : (
                          <div>
                            <a
                              href={specialist?.url ?? "/apps#apps"}
                              className="flex w-full items-center justify-between rounded-lg border border-primary/20 bg-white p-3 text-primary transition-colors hover:bg-primary/5"
                              data-testid={`link-specialist-capability-${capability.id}`}
                            >
                              <span className="text-sm font-medium">
                                {specialist ? `Open ${specialist.label}` : "View specialist services"}
                              </span>
                              <ArrowUpRight size={16} />
                            </a>
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                              Opens the live specialist service. Sign-in or an active plan may be required.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <section className="mt-6 border-t border-border pt-5">
                      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Example requests</h3>
                      <div className="flex flex-wrap gap-2">
                        {capability.examples.map((example) => (
                          <span key={example} className="rounded-md border border-muted bg-muted/30 px-3 py-2 text-xs text-foreground">
                            “{example}”
                          </span>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </article>
            );
          })}

          {filteredCapabilities.length === 0 && (
            <div className="py-16 text-center text-muted-foreground" data-testid="status-no-capabilities">
              <Layers size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No LAWYes tool matches that search.</p>
              <p className="text-sm">Try another task or practice area.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}