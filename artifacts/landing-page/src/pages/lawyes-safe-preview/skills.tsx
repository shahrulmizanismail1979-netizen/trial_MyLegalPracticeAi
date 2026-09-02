import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Layers,
  Lock,
  Search,
} from "lucide-react";
import {
  CAPABILITY_REGISTRY,
  type CapabilityCategory,
  type CapabilityReadiness,
} from "../../fixtures/lawyes-skills";
import type { RouterState } from "./use-router-state";

const ALL = "All";

function ReadinessBadge({ level }: { level: CapabilityReadiness }) {
  if (level === "Available in LAWYes preview") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2b7169] bg-[#e5f1ed] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#19514b]">
        <CheckCircle2 size={10} /> {level}
      </span>
    );
  }

  if (level === "Implemented; adapter required") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dcb96f] bg-[#fff5dc] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#936814]">
        <Lock size={10} /> {level}
      </span>
    );
  }

  if (level === "Implemented; verification pending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ca8a04] bg-[#fefce8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#854d0e]">
        <AlertTriangle size={10} /> {level}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#98a49e] bg-[#f3f4f0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#5e6964]">
      <Activity size={10} /> {level}
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
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CapabilityCategory | typeof ALL>(ALL);
  const [readiness, setReadiness] = useState<CapabilityReadiness | typeof ALL>(ALL);
  const [expandedId, setExpandedId] = useState<string | null>(state.capabilityId || null);

  const categories = useMemo(
    () => [...new Set(CAPABILITY_REGISTRY.map((capability) => capability.category))],
    [],
  );
  const readinessLevels = useMemo(
    () => [...new Set(CAPABILITY_REGISTRY.map((capability) => capability.readiness))],
    [],
  );

  const filteredCapabilities = useMemo(() => {
    const term = search.trim().toLowerCase();
    return CAPABILITY_REGISTRY.filter((capability) => {
      if (category !== ALL && capability.category !== category) return false;
      if (readiness !== ALL && capability.readiness !== readiness) return false;
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
  }, [category, readiness, search]);

  return (
    <div className="relative flex h-full flex-col bg-background animate-in fade-in duration-300">
      <div className="shrink-0 border-b border-border bg-white p-6 shadow-sm md:p-8">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-2 flex items-center gap-3 text-primary">
            <Layers size={24} />
            <h1 className="font-serif text-2xl font-bold text-foreground">LAWYes Skills</h1>
          </div>
          <p className="mb-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            A code-audited registry of capabilities that already exist across LAWYes specialist services.
            Specialist names stay visible for traceability, but no portal link is needed to understand what is available.
          </p>
          <p className="mb-6 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Only green capabilities run in this standalone preview. Every other capability remains discoverable here
            while its authentication, ownership, integration, or verification adapter is completed.
          </p>

          <div className="grid gap-3 md:grid-cols-[1fr_220px_240px]">
            <label className="relative">
              <span className="sr-only">Search skills</span>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                type="search"
                placeholder="Describe a task or search a skill..."
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
            <label>
              <span className="sr-only">Filter by readiness</span>
              <select
                value={readiness}
                onChange={(event) => setReadiness(event.target.value as CapabilityReadiness | typeof ALL)}
                className="w-full rounded-xl border border-input bg-white px-3 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                data-testid="select-skills-readiness"
              >
                <option value={ALL}>All readiness levels</option>
                {readinessLevels.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f9fafa] p-6 md:p-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span data-testid="status-capability-count">{filteredCapabilities.length} proven capability groups</span>
            <span>Registry scope: implemented code only</span>
          </div>

          {filteredCapabilities.map((capability) => {
            const expanded = expandedId === capability.id;
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
                      <span className="rounded border border-secondary/20 bg-secondary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary">
                        {capability.category}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{capability.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <ReadinessBadge level={capability.readiness} />
                      <span className="text-[11px] text-muted-foreground">
                        Current service: <strong className="text-foreground">{capability.currentService}</strong>
                      </span>
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-muted/50 bg-[#fffefa] px-6 pb-6 pt-5 animate-in slide-in-from-top-2" data-testid={`detail-capability-${capability.id}`}>
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-5">
                        <section>
                          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Required inputs</h3>
                          <ul className="space-y-1">
                            {capability.requiredInputs.map((input) => <li key={input} className="flex gap-2 text-sm"><span className="text-primary">•</span>{input}</li>)}
                          </ul>
                        </section>
                        <section>
                          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Output types</h3>
                          <ul className="space-y-1">
                            {capability.outputTypes.map((output) => <li key={output} className="flex gap-2 text-sm"><span className="text-secondary">•</span>{output}</li>)}
                          </ul>
                        </section>
                        <section>
                          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Current service routes</h3>
                          <ul className="space-y-1 font-mono text-xs text-foreground/80">
                            {capability.serviceRoutes.map((route) => <li key={route}>{route}</li>)}
                          </ul>
                        </section>
                      </div>

                      <div className="space-y-4">
                        <section className="rounded-lg border border-[#c7d0ca] bg-[#f8faf7] p-4">
                          <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#19514b]">Verification required</h3>
                          <p className="text-sm leading-relaxed text-[#425351]">{capability.verification}</p>
                        </section>
                        <section className="rounded-lg border border-[#dcb96f] bg-[#fff8e7] p-4">
                          <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[#936814]">Permissions</h3>
                          <p className="text-sm leading-relaxed text-[#6d5a38]">{capability.permissions}</p>
                        </section>
                        <section className="rounded-lg border border-border bg-white p-4">
                          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Adapter boundary</h3>
                          <dl className="space-y-2 text-xs leading-relaxed">
                            <div><dt className="font-bold text-foreground">Authentication</dt><dd className="text-muted-foreground">{capability.authModel}</dd></div>
                            <div><dt className="font-bold text-foreground">Ownership</dt><dd className="text-muted-foreground">{capability.ownershipModel}</dd></div>
                            <div><dt className="font-bold text-foreground">Phased adapter flag</dt><dd className="text-amber-800">{capability.adapterBoundary}</dd></div>
                          </dl>
                        </section>
                        {capability.workspaceDestination ? (
                          <button
                            onClick={() => navigate(capability.workspaceDestination!)}
                            className="flex w-full items-center justify-between rounded-lg bg-primary p-3 text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                            data-testid={`button-open-capability-${capability.id}`}
                          >
                            <span className="text-sm font-medium">Open available LAWYes skill</span>
                            <ArrowUpRight size={16} />
                          </button>
                        ) : (
                          <div className="rounded-lg border border-dashed border-border p-3 text-xs leading-relaxed text-muted-foreground" data-testid={`status-adapter-required-${capability.id}`}>
                            Discoverable now. Execution remains inside LAWYes only after the stated adapter boundary is complete.
                          </div>
                        )}
                      </div>
                    </div>

                    <section className="mt-6 border-t border-border pt-5">
                      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Try asking LAWYes</h3>
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
              <p className="text-lg font-medium">No proven capability matches those filters.</p>
              <p className="text-sm">Try another task, practice area, or readiness level.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}