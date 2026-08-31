import { useState, useMemo, useEffect } from "react";
import { Briefcase, ArrowLeft, ArrowRight, Download, CheckCircle, Search, FileText, AlertTriangle } from "lucide-react";
import { REPORTS, MATTER_WORKFLOW, buildLocalExportManifest } from "@/fixtures/lawyes-preview";
import type { RouterState } from "./use-router-state";
import { download } from "./shared";

export function MatterView({ state, updateState, navigate }: { state: RouterState; updateState: (updates: Partial<RouterState>, replace?: boolean) => void; navigate: (view: "home" | "search" | "draft") => void }) {
  const step = state.matterStep;
  const setStep = (newStep: number) => updateState({ matterStep: newStep });

  const [matterName, setMatterName] = useState(state.matterName || "");
  const [clientRef, setClientRef] = useState(state.clientRef || "");
  const [matterTask, setMatterTask] = useState(state.matterTask || "");
  const [acknowledged, setAcknowledged] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [exportFeedback, setExportFeedback] = useState("");

  const selectedMaterialsArray = useMemo(() => state.selectedMaterials ? state.selectedMaterials.split(",") : [], [state.selectedMaterials]);
  const selectedReports = useMemo(() => REPORTS.filter(r => selectedMaterialsArray.includes(r.id)), [selectedMaterialsArray]);

  // Sync back local state to router if it's confirmed (or we can just keep in local until step 2)
  const handleConfirm = () => {
    const newErrors: Record<string, string> = {};
    if (!matterName.trim()) newErrors.matterName = "Internal reference is required";
    if (!clientRef.trim()) newErrors.clientRef = "Client reference is required";
    if (!matterTask.trim()) newErrors.matterTask = "Purpose or question is required";
    if (selectedReports.length === 0) newErrors.materials = "At least one material must be selected";
    if (!acknowledged) newErrors.acknowledged = "You must acknowledge the verification requirement";

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      updateState({ matterName, clientRef, matterTask, matterStep: 2 });
    }
  };

  const handleExport = (type: "txt" | "json") => {
    const manifest = buildLocalExportManifest(selectedReports, `${matterName} (${clientRef})`);

    try {
      if (type === "json") {
        download("lawyes-matter-manifest.json", JSON.stringify(manifest, null, 2), "application/json");
      } else {
        const text = [
          `MATTER MANIFEST: ${manifest.createdFor}`,
          `Date: ${new Date().toISOString().split('T')[0]}`,
          `Kind: ${manifest.kind}`,
          "",
          "WARNINGS:",
          ...manifest.warnings.map(w => `- ${w}`),
          "",
          "SELECTED MATERIALS:",
          ...manifest.materials.map(m => `\nTitle: ${m.title}\nStatus: ${m.status}\nURL: ${m.sourceUrl}\nGap: ${m.verificationGap}`),
          "",
          "SOURCE GATEWAYS REQUIRED:",
          ...manifest.sourceIds.map(id => `- ${id}`)
        ].join("\n");
        download("lawyes-matter-manifest.txt", text, "text/plain");
      }
      setExportFeedback(`Exported ${type.toUpperCase()} successfully`);
    } catch {
      setExportFeedback(`Failed to export ${type.toUpperCase()}`);
    }
    setTimeout(() => setExportFeedback(""), 3000);
  };

  const handleRemoveMaterial = (id: string) => {
    const updated = selectedMaterialsArray.filter(x => x !== id);
    updateState({ selectedMaterials: updated.join(",") }, true);
  };

  return (
    <div className="min-h-[calc(100vh-73px)] md:min-h-[calc(100vh-65px)] bg-background py-8 px-5">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button onClick={() => navigate("home")} className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mb-4">
            <ArrowLeft size={16} /> Back to Home
          </button>
          <h1 className="text-3xl md:text-4xl font-serif text-foreground leading-tight mb-2">Matter Workspace</h1>
          <p className="text-foreground/70">{MATTER_WORKFLOW.localOnlyNotice}</p>
        </div>

        {step === 1 && (
          <div className="grid md:grid-cols-5 gap-8 animate-in fade-in duration-300">
            <div className="md:col-span-3 space-y-6">
              <div className="bg-white border border-border shadow-sm rounded-xl p-6 md:p-8">
                <h2 className="text-xl font-serif text-foreground mb-6">Matter Details</h2>

                <div className="space-y-5">
                  <div>
                    <label htmlFor="matterName" className="block text-sm font-medium text-foreground mb-1.5">Internal Reference <span className="text-destructive">*</span></label>
                    <input
                      id="matterName"
                      type="text"
                      value={matterName}
                      onChange={(e) => { setMatterName(e.target.value); if(errors.matterName) setErrors(e => ({...e, matterName: ""})) }}
                      placeholder="e.g. Kuching Land Dispute"
                      className={`w-full p-3 bg-background border ${errors.matterName ? 'border-destructive' : 'border-border'} rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all`}
                    />
                    {errors.matterName && <p className="text-xs text-destructive mt-1 font-medium">{errors.matterName}</p>}
                  </div>

                  <div>
                    <label htmlFor="clientRef" className="block text-sm font-medium text-foreground mb-1.5">Client Reference <span className="text-destructive">*</span></label>
                    <input
                      id="clientRef"
                      type="text"
                      value={clientRef}
                      onChange={(e) => { setClientRef(e.target.value); if(errors.clientRef) setErrors(e => ({...e, clientRef: ""})) }}
                      placeholder="e.g. CLI-2026-08"
                      className={`w-full p-3 bg-background border ${errors.clientRef ? 'border-destructive' : 'border-border'} rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all`}
                    />
                    {errors.clientRef && <p className="text-xs text-destructive mt-1 font-medium">{errors.clientRef}</p>}
                  </div>

                  <div>
                    <label htmlFor="matterTask" className="block text-sm font-medium text-foreground mb-1.5">Purpose or Open Questions <span className="text-destructive">*</span></label>
                    <textarea
                      id="matterTask"
                      value={matterTask}
                      onChange={(e) => { setMatterTask(e.target.value); if(errors.matterTask) setErrors(e => ({...e, matterTask: ""})) }}
                      placeholder="e.g. Verify current status of caveat..."
                      className={`w-full p-3 min-h-[100px] resize-y bg-background border ${errors.matterTask ? 'border-destructive' : 'border-border'} rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all`}
                    />
                    {errors.matterTask && <p className="text-xs text-destructive mt-1 font-medium">{errors.matterTask}</p>}
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-border">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="mt-0.5 shrink-0 relative flex items-center justify-center w-5 h-5 border border-border bg-white rounded group-hover:border-primary transition-colors">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(e) => { setAcknowledged(e.target.checked); if(errors.acknowledged) setErrors(e => ({...e, acknowledged: ""})) }}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                      />
                      {acknowledged && <CheckCircle size={14} className="text-primary pointer-events-none" />}
                    </div>
                    <span className="text-sm text-foreground/90 leading-tight select-none">I acknowledge that selections in this demonstration are not advice, approval, filing, or a complete matter record, and that all materials require verification.</span>
                  </label>
                  {errors.acknowledged && <p className="text-xs text-destructive mt-2 pl-8 font-medium">{errors.acknowledged}</p>}
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleConfirm}
                    className="flex items-center gap-2 px-8 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-all focus:outline-none focus:ring-4 focus:ring-primary/20"
                  >
                    Confirm Workspace <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 space-y-6">
              <div className="bg-white border border-border shadow-sm rounded-xl p-5 md:p-6 flex flex-col h-full max-h-[600px]">
                <h3 className="text-base font-serif text-foreground mb-4 flex items-center justify-between">
                  Selected Materials
                  <span className="text-xs font-sans font-bold bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">{selectedMaterialsArray.length}</span>
                </h3>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2 no-scrollbar">
                  {selectedReports.length > 0 ? selectedReports.map(r => (
                    <div key={r.id} className="p-3 border border-border rounded-lg bg-background text-sm relative group pr-12 focus-within:ring-2 focus-within:ring-primary/20">
                      <button
                        onClick={() => handleRemoveMaterial(r.id)}
                        className="absolute top-1/2 -translate-y-1/2 right-1 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-destructive md:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-destructive/30 rounded"
                        aria-label={`Remove ${r.title} from matter`}
                      >
                        ×
                      </button>
                      <strong className="block font-medium text-foreground mb-1 leading-snug">{r.title}</strong>
                      <span className="text-xs text-muted-foreground">{r.status} &middot; {r.jurisdiction}</span>
                    </div>
                  )) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-border rounded-xl">
                      <Search size={24} className="text-muted-foreground mb-2" />
                      <p className="text-sm font-medium text-foreground mb-1">No materials selected</p>
                      <p className="text-xs text-muted-foreground mb-4">You need at least one material to build a manifest.</p>
                      <button onClick={() => navigate("search")} className="px-4 py-2 bg-secondary/10 text-secondary text-xs font-bold uppercase tracking-wider rounded hover:bg-secondary/20 transition-colors">
                        Go to Search
                      </button>
                    </div>
                  )}
                </div>
                {errors.materials && <p className="text-xs text-destructive mt-3 font-medium text-center">{errors.materials}</p>}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-emerald-50 border-l-4 border-emerald-500 p-5 mb-6 text-sm text-emerald-900 flex gap-3 items-start shadow-sm">
              <CheckCircle size={20} className="shrink-0 text-emerald-600" />
              <div>
                <strong className="block text-base mb-1">Workspace Local Manifest Generated</strong>
                <p>This manifest is local to your browser session. It has not been saved to any server.</p>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white border border-border shadow-sm rounded-xl p-6 md:p-8">
                  <div className="flex justify-between items-start mb-6 border-b border-border pb-6">
                    <div>
                      <h2 className="text-2xl font-serif text-foreground mb-1">{matterName}</h2>
                      <p className="text-sm font-mono text-muted-foreground">REF: {clientRef}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span aria-live="polite" className="text-xs text-secondary font-medium text-right h-4">{exportFeedback}</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleExport("txt")} className="px-3 py-1.5 border border-border bg-white rounded text-xs font-bold hover:bg-muted transition-colors flex items-center gap-1.5"><Download size={14} /> TXT</button>
                        <button onClick={() => handleExport("json")} className="px-3 py-1.5 border border-border bg-white rounded text-xs font-bold hover:bg-muted transition-colors flex items-center gap-1.5"><Download size={14} /> JSON</button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Purpose / Open Questions</h3>
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{matterTask}</p>
                    </div>

                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 border-b border-border pb-2">Selected Materials ({selectedReports.length})</h3>
                      <div className="space-y-4">
                        {selectedReports.map(r => (
                          <div key={r.id} className="text-sm">
                            <strong className="block text-foreground font-medium mb-1">{r.title}</strong>
                            <div className="text-xs text-muted-foreground mb-1">{r.status} &middot; {r.citation || "No citation"} &middot; {r.jurisdiction}</div>
                            <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-100 mt-2">
                              <span className="font-bold">Gap:</span> {r.verificationGap}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-5">
                  <h3 className="font-serif text-lg text-secondary mb-3 flex items-center gap-2"><ArrowRight size={18} /> Next Actions</h3>
                  <div className="space-y-3">
                    <button onClick={() => navigate("search")} className="w-full text-left p-3 bg-white border border-border rounded-lg shadow-sm hover:border-primary/50 transition-colors">
                      <div className="flex items-center gap-2 font-medium text-sm text-foreground mb-1"><Search size={16} className="text-primary" /> Return to Search</div>
                      <p className="text-xs text-muted-foreground">Find more materials to add to this matter.</p>
                    </button>
                    <button onClick={() => navigate("draft")} className="w-full text-left p-3 bg-white border border-border rounded-lg shadow-sm hover:border-primary/50 transition-colors">
                      <div className="flex items-center gap-2 font-medium text-sm text-foreground mb-1"><FileText size={16} className="text-primary" /> Generate Draft</div>
                      <p className="text-xs text-muted-foreground">The client reference will carry over to the drafting tool.</p>
                    </button>
                  </div>
                </div>

                <div className="bg-background border border-border rounded-xl p-5 text-xs text-muted-foreground">
                  <h4 className="font-bold uppercase tracking-wider mb-2">Matter Workflow</h4>
                  <ol className="list-decimal pl-4 space-y-1.5">
                    {MATTER_WORKFLOW.stages.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                  <div className="mt-4 pt-4 border-t border-border flex items-start gap-2 text-amber-700">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{MATTER_WORKFLOW.handoffWarning}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}