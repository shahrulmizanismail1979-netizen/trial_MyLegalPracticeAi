import { useState } from "react";
import { Gavel, ShieldCheck, Landmark, BookOpen, FileText, Briefcase, ArrowLeft, ArrowRight, ArrowUpRight, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { PRACTICE_CENTRES, COVERAGE, AUDIT, CHECKLISTS, DECISION_TREES, RESOURCES, PLAYBOOKS } from "@/fixtures/lawyes-preview";
import type { RouterState } from "./use-router-state";
import { SourceBadge, Provenance } from "./shared";

const ICONS: Record<string, React.ReactNode> = {
  "civil-litigation": <Gavel size={24} />,
  "criminal-litigation": <ShieldCheck size={24} />,
  "conveyancing-land": <Landmark size={24} />,
  "ncr-native-law": <BookOpen size={24} />,
  "probate-estates": <FileText size={24} />,
  "professional-practice": <Briefcase size={24} />,
};

export function PracticeView({ state, updateState, navigate }: { state: RouterState; updateState: (updates: Partial<RouterState>) => void; navigate: (view: "home") => void }) {
  const [expandedSection, setExpandedSection] = useState<string | null>("coverage");

  const centre = PRACTICE_CENTRES.find(p => p.id === state.practiceCentre);

  if (!centre) {
    return (
      <div className="h-full overflow-y-auto bg-background py-8 px-5 animate-in fade-in duration-300">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 text-center max-w-3xl mx-auto">
            <h1 className="text-3xl md:text-4xl font-serif text-foreground mb-4">Malaysia Practice &amp; State Sources</h1>
            <p className="text-lg text-foreground/70 leading-relaxed">Navigate Malaysian legal work nationwide, with jurisdiction-specific source paths and safeguards. Sarawak land, NCR and Native Law remain clearly identified specialist pathways.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PRACTICE_CENTRES.map((pc) => (
              <button
                key={pc.id}
                onClick={() => updateState({ practiceCentre: pc.id })}
                className="group text-left p-6 bg-white border border-border rounded-xl shadow-sm hover:shadow-md hover:border-primary/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 flex flex-col h-full"
              >
                <div className="p-3 bg-primary/10 text-primary w-fit rounded-lg mb-5 group-hover:scale-110 transition-transform">
                  {ICONS[pc.id] || <Gavel size={24} />}
                </div>
                <h2 className="text-xl font-serif text-foreground mb-2 group-hover:text-primary transition-colors">
                  {pc.name}
                </h2>
                 <span className="mb-3 w-fit rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                   {pc.jurisdiction === "Malaysia" ? "Malaysia-wide" : `${pc.jurisdiction} specialist`}
                 </span>
                <p className="text-sm text-foreground/70 leading-relaxed line-clamp-2 mb-6">
                  {pc.overview}
                </p>
                <div className="mt-auto pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium group-hover:text-primary transition-colors flex items-center gap-1">Open centre <ArrowUpRight size={14} /></span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-16 bg-white border border-border rounded-xl p-6 md:p-8 flex flex-col items-center text-center">
            <h3 className="font-serif text-xl mb-2">Practice Centre source review</h3>
            <p className="text-sm text-muted-foreground max-w-2xl mb-6">Every path remains verification-required and is not a completeness claim. No access record is upgraded without source, paragraph and human checks.</p>
            <div className="flex flex-wrap justify-center gap-6">
              <div className="text-center">
                <span className="block text-3xl font-serif text-primary mb-1">{COVERAGE.length}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Coverage Paths</span>
              </div>
              <div className="text-center">
                <span className="block text-3xl font-serif text-primary mb-1">{AUDIT.verifiedCurrentAdditions}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Verified Sources</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Detailed Centre View
  const knownMappings: Record<string, string[]> = {
    "civil-litigation": ["civil", "public"],
    "criminal-litigation": ["criminal"],
    "conveyancing-land": ["land", "commercial", "local-government", "state-regulatory", "insolvency"],
    "ncr-native-law": ["native"],
    "probate-estates": ["probate", "family"],
    "professional-practice": ["professional"],
  };
  const specificCoverage = COVERAGE.filter(c => (knownMappings[centre.id] || []).includes(c.id));

  const relatedPlaybooks = PLAYBOOKS.filter(p => p.track.toLowerCase().includes(centre.name.split(" ")[0].toLowerCase()) || (centre.id === "conveyancing-land" && p.track === "Conveyancing / land"));

  const centreChecklists = CHECKLISTS.filter(c => {
    if (centre.id === "civil-litigation") return c.id.includes("civil");
    if (centre.id === "criminal-litigation") return c.id.includes("criminal");
    if (centre.id === "conveyancing-land") return c.id.includes("land");
    if (centre.id === "ncr-native-law") return c.id.includes("land") || c.title.includes("NCR");
    return false;
  });

  const centreTrees = DECISION_TREES.filter(t => {
    if (centre.id === "civil-litigation" || centre.id === "criminal-litigation") return t.id.includes("court");
    if (centre.id === "conveyancing-land" || centre.id === "ncr-native-law") return t.id.includes("land") || t.id.includes("ncr");
    return false;
  });

  const hasChecklists = centreChecklists.length > 0 || centreTrees.length > 0;

  const AccordionHeader = ({ id, title, count }: { id: string, title: string, count?: number }) => (
    <button
      onClick={() => setExpandedSection(expandedSection === id ? null : id)}
      className="w-full flex items-center justify-between p-5 bg-background border-b border-border hover:bg-muted/50 transition-colors focus:outline-none focus:bg-muted/50"
    >
      <h3 className="font-serif text-lg text-foreground flex items-center gap-2">
        {title} {count !== undefined && <span className="text-xs font-sans font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{count}</span>}
      </h3>
      {expandedSection === id ? <ChevronUp size={20} className="text-muted-foreground" /> : <ChevronDown size={20} className="text-muted-foreground" />}
    </button>
  );

  return (
    <div className="h-full overflow-y-auto bg-background py-8 px-5 animate-in fade-in duration-300">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button onClick={() => updateState({ practiceCentre: "" })} className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mb-4">
            <ArrowLeft size={16} /> Back to Practice Centres
          </button>
        </div>

        <div className="bg-white border border-border shadow-sm rounded-xl overflow-hidden mb-8">
          <div className="p-6 md:p-8 bg-primary/5 border-b border-border">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-primary/10 text-primary rounded-lg shrink-0">
                {ICONS[centre.id]}
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-serif text-foreground leading-tight">{centre.name}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Scope: {centre.jurisdiction === "Malaysia" ? "Malaysia-wide" : `${centre.jurisdiction} specialist`} &middot; Status: {centre.verificationStatus} &middot; Updated {centre.updatedOn}
                </p>
              </div>
            </div>
            <p className="text-foreground/80 leading-relaxed max-w-2xl">{centre.overview}</p>
            <p className="mt-3 max-w-2xl rounded-lg border border-primary/15 bg-white/70 px-3 py-2 text-sm text-foreground/70">{centre.scopeNote}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-0 border-b border-border">
            <div className="p-6 border-b md:border-b-0 md:border-r border-border">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Suitable for</h4>
              <ul className="space-y-2">
                {centre.suitableFor.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                    <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Limits &amp; Warnings</h4>
              <ul className="space-y-2">
                {centre.limits.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                    <span className="shrink-0 mt-0.5 font-bold text-amber-600">!</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-6 bg-muted/20">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Workflow Stages</h4>
            <div className="flex flex-wrap gap-2 md:gap-4">
              {centre.workflowStages.map((stage, i) => (
                <div key={i} className="flex items-center gap-2 md:gap-4">
                  <div className="flex items-center gap-3 bg-white border border-border px-3 py-2 rounded-lg text-sm shadow-sm">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <span className="font-medium">{stage}</span>
                  </div>
                  {i < centre.workflowStages.length - 1 && <ArrowRight size={16} className="text-muted-foreground hidden md:block" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Expandable Sections */}
        <div className="bg-white border border-border shadow-sm rounded-xl overflow-hidden">

          <AccordionHeader id="coverage" title="Coverage Paths & Gateways" count={specificCoverage.length} />
          {expandedSection === "coverage" && (
            <div className="p-6 bg-background animate-in slide-in-from-top-2 duration-200">
              <div className="grid sm:grid-cols-2 gap-4">
                {specificCoverage.map(item => (
                  <div key={item.id} className="bg-white border border-border p-4 rounded-lg">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="font-medium text-foreground">{item.label}</h4>
                      <SourceBadge status={item.status} />
                    </div>
                    <p className="text-[11px] italic text-muted-foreground mb-3">{item.bmLabel}</p>
                    <p className="text-xs text-foreground/80 leading-relaxed mb-3">{item.coverageNote}</p>
                    <Provenance sourceId={item.sourceId} compact />
                  </div>
                ))}
              </div>
            </div>
          )}

          <AccordionHeader id="workflows" title="Drafting & Playbooks" count={relatedPlaybooks.length} />
          {expandedSection === "workflows" && (
            <div className="p-6 bg-background animate-in slide-in-from-top-2 duration-200">
              {relatedPlaybooks.length > 0 ? (
                <div className="grid gap-4">
                  {relatedPlaybooks.map(pb => (
                    <div key={pb.id} className="bg-white border border-border p-5 rounded-lg flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1">{pb.track}</div>
                        <h4 className="font-serif text-lg text-foreground mb-1">{pb.title}</h4>
                        <p className="text-sm text-muted-foreground">{pb.examples[0]}</p>
                      </div>
                      <button onClick={() => updateState({ view: "draft", playbook: pb.id })} className="shrink-0 px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-md text-sm font-medium transition-colors">
                        Open Playbook
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground p-4 text-center border border-dashed border-border rounded-lg">No automated playbooks currently available for this practice area.</p>
              )}
            </div>
          )}

          <AccordionHeader id="examples" title="Category Examples & Source Notes" count={centre.examples.length + centre.sourceNotes.length} />
          {expandedSection === "examples" && (
            <div className="p-6 bg-background animate-in slide-in-from-top-2 duration-200 grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-bold text-sm text-foreground mb-3">Illustrative use examples</h4>
                <ul className="space-y-2">
                  {centre.examples.map((example, i) => (
                    <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                      <span className="text-primary font-bold shrink-0">&middot;</span> {example}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-sm text-foreground mb-3">Source notes</h4>
                <ul className="space-y-2">
                  {centre.sourceNotes.map((note, i) => (
                    <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                      <span className="text-secondary font-bold shrink-0">&middot;</span> {note}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <AccordionHeader id="checklists" title="Checklists & Decision Trees" count={centreChecklists.length + centreTrees.length} />
          {expandedSection === "checklists" && (
            <div className="p-6 bg-background animate-in slide-in-from-top-2 duration-200">
              <p className="text-sm text-muted-foreground mb-6">Procedural aides intended for orientation. Do not calculate deadlines, rights, or outcomes from these guides.</p>

              {hasChecklists ? (
                <div className="grid md:grid-cols-2 gap-6">
                  {centreChecklists.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-2 border-b border-border pb-2"><CheckCircle size={16} className="text-secondary" /> Procedural Checklists</h4>
                      {centreChecklists.map(c => (
                        <div key={c.id} className="bg-white border border-border p-4 rounded-lg">
                          <strong className="block text-sm mb-2">{c.title}</strong>
                          <ul className="space-y-1">
                            {c.items.slice(0,3).map((item, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5"><span className="text-secondary font-bold shrink-0 mt-0.5">&middot;</span> {item}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                  {centreTrees.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-2 border-b border-border pb-2"><ArrowUpRight size={16} className="text-secondary" /> Decision Trees</h4>
                      {centreTrees.map(c => (
                        <div key={c.id} className="bg-white border border-border p-4 rounded-lg">
                          <strong className="block text-sm mb-2">{c.title}</strong>
                          <ul className="space-y-1">
                            {c.questions.slice(0,3).map((item, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5"><span className="text-secondary font-bold shrink-0 mt-0.5">?</span> {item}</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground p-4 text-center border border-dashed border-border rounded-lg">No category-specific reviewed item in this preview.</p>
              )}
            </div>
          )}

          <AccordionHeader id="notices" title="Gap Notices & Warnings" count={centre.gapNotices.length} />
          {expandedSection === "notices" && (
            <div className="p-6 bg-amber-50 animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-3">
                {centre.gapNotices.map((notice, i) => {
                  const [label, text] = notice.split(": ");
                  return (
                    <div key={i} className="text-sm text-amber-900 bg-white border border-amber-200 p-3 rounded shadow-sm">
                      <strong className="font-bold">{label}: </strong> {text}
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 pt-4 border-t border-amber-200 text-xs text-amber-700 max-w-2xl">
                <strong className="block mb-1">Verification Steps Required:</strong>
                <ol className="list-decimal pl-4 space-y-1">
                  {centre.verificationSteps.map((step, i) => <li key={i}>{step}</li>)}
                </ol>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}