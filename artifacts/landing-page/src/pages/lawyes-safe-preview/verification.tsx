import { useState } from "react";
import { ArrowLeft, ArrowUpRight, CheckCircle, ShieldAlert, FileSearch, History, AlertTriangle } from "lucide-react";
import { SOURCES, AUDIT } from "@/fixtures/lawyes-preview";
import type { RouterState } from "./use-router-state";
import { SourceBadge } from "./shared";

export function VerificationView({ navigate }: { navigate: (view: "home") => void }) {
  const [selectedSource, setSelectedSource] = useState(SOURCES[0]?.id || "");

  const activeSource = SOURCES.find(s => s.id === selectedSource) || SOURCES[0];

  return (
    <div className="h-full overflow-y-auto bg-background py-8 px-5 animate-in fade-in duration-300">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <button onClick={() => navigate("home")} className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mb-4">
              <ArrowLeft size={16} /> Back to Home
            </button>
            <h1 className="text-3xl md:text-4xl font-serif text-foreground leading-tight">Sources &amp; Verification</h1>
          </div>
          <div className="hidden sm:block text-right">
            <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Audit Status</div>
            <div className="text-sm font-medium">{AUDIT.reviewedOn} &middot; {AUDIT.sourcesReviewed} sources reviewed</div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 h-[calc(100vh-180px)] min-h-[500px]">
          <div className="md:col-span-1 space-y-2 overflow-y-auto pr-2 no-scrollbar h-full">
            {SOURCES.map(source => (
              <button
                key={source.id}
                onClick={() => setSelectedSource(source.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${selectedSource === source.id ? 'bg-primary/5 border-primary shadow-sm' : 'bg-white border-border hover:border-primary/50'}`}
              >
                <div className="flex justify-between items-start mb-2 gap-2">
                  <h3 className="font-medium text-foreground text-sm leading-tight">{source.name}</h3>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <SourceBadge status={source.editorialStatus} />
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-1">{source.sourceType}</p>
              </button>
            ))}
          </div>

          <div className="md:col-span-2">
            {activeSource && (
              <div className="bg-white border border-border shadow-sm rounded-xl overflow-hidden h-full flex flex-col animate-in fade-in duration-300">
                <div className="p-6 md:p-8 bg-muted/20 border-b border-border">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <SourceBadge status={activeSource.editorialStatus} />
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 py-0.5 border border-border bg-white rounded">{activeSource.jurisdiction}</span>
                    </div>
                    <a href={activeSource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors rounded-md shadow-sm">
                      {activeSource.rightsStatus === "Official public source" ? "Open official source" : 
                       activeSource.id === "maria-copy" ? "Open public access copy" : "Open source gateway"} <ArrowUpRight size={14} />
                    </a>
                  </div>
                  <h2 className="text-2xl font-serif text-foreground mb-2">{activeSource.name}</h2>
                  <p className="text-sm text-foreground/80">{activeSource.sourceType} &middot; {activeSource.rightsStatus}</p>
                </div>

                <div className="p-6 md:p-8 flex-1 overflow-y-auto space-y-8">

                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-bold text-sm uppercase tracking-wider text-foreground flex items-center gap-2 border-b border-border pb-2">
                        <FileSearch size={16} className="text-primary" /> What you can find
                      </h3>
                      <ul className="space-y-2">
                        {activeSource.whatYouCanFind.map((item, i) => (
                          <li key={i} className="text-sm text-foreground/80 leading-relaxed flex items-start gap-2">
                            <span className="text-primary font-bold shrink-0 mt-0.5">&middot;</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-bold text-sm uppercase tracking-wider text-foreground flex items-center gap-2 border-b border-border pb-2">
                        <ShieldAlert size={16} className="text-amber-600" /> Access Requirements
                      </h3>
                      <ul className="space-y-2">
                        {activeSource.accessRequirements.map((item, i) => (
                          <li key={i} className="text-sm text-amber-900 leading-relaxed flex items-start gap-2">
                            <span className="text-amber-600 font-bold shrink-0 mt-0.5">&middot;</span> {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-secondary/5 border border-secondary/20 rounded-lg p-5">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-secondary flex items-center gap-2 mb-3">
                      <CheckCircle size={16} /> Required Verification Steps
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">A practitioner must perform these steps before relying on any material from this source.</p>
                    <ol className="list-decimal pl-4 space-y-2">
                      {activeSource.verificationSteps.map((step, i) => (
                        <li key={i} className="text-sm text-foreground/90 pl-1">{step}</li>
                      ))}
                    </ol>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-foreground flex items-center gap-2 border-b border-border pb-2">
                      <AlertTriangle size={16} className="text-muted-foreground" /> Usage Notes
                    </h3>
                    <ul className="space-y-2">
                      {activeSource.usageNotes.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                          <span className="text-muted-foreground font-bold shrink-0 mt-0.5">&middot;</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-foreground flex items-center gap-2 mb-3">
                      <History size={16} className="text-primary" /> Change History
                    </h3>
                    <div className="relative border-l border-border ml-3 pl-4 space-y-4">
                      {activeSource.changeHistory.map((item, i) => (
                        <div key={i} className="relative">
                          <span className="absolute -left-[21px] top-1.5 w-2 h-2 bg-background border border-primary rounded-full" />
                          <p className="text-sm text-muted-foreground">{item}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs font-medium text-foreground mt-4 ml-2">Last verified: {activeSource.lastVerified}</p>
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}