import { useState, useEffect } from "react";
import { ArrowLeft, Check, ChevronRight, FileText, AlertTriangle } from "lucide-react";
import { PLAYBOOKS, SOURCES } from "@/fixtures/lawyes-preview";
import type { RouterState } from "./use-router-state";
import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";

export function DraftView({ state, updateState, navigate }: { state: RouterState; updateState: (updates: Partial<RouterState>, replace?: boolean) => void; navigate: (view: "home" | "matter") => void }) {
  const step = state.draftStep;
  const setStep = (newStep: number) => updateState({ draftStep: newStep });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedPlaybook = PLAYBOOKS.find(p => p.id === state.playbook) || null;
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [checks, setChecks] = useState<boolean[]>([]);
  const [generatedDraft, setGeneratedDraft] = useState("");

  // Safe field reset when playbook changes
  useEffect(() => {
    if (selectedPlaybook) {
      const initialData: Record<string, any> = {};
      selectedPlaybook.intakeFields.forEach(f => {
        if (f.id === 'clientReference' && state.clientRef) {
          initialData[f.id] = state.clientRef;
        } else {
          initialData[f.id] = f.defaultValue || (f.type === 'checkbox' ? false : "");
        }
      });
      setFormData(initialData);
      setChecks(new Array(selectedPlaybook.safeguards.length).fill(false));
      if (step === 1) setStep(2);
      setErrors({});
    }
  }, [state.playbook, state.clientRef]);

  const handleSelectPlaybook = (id: string) => {
    updateState({ playbook: id });
  };

  const handleFieldChange = (id: string, value: any) => {
    setFormData(prev => ({ ...prev, [id]: value }));
    if (errors[id]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const validateForm = () => {
    if (!selectedPlaybook) return false;
    const newErrors: Record<string, string> = {};
    let firstInvalid = "";

    selectedPlaybook.intakeFields.forEach(f => {
      if (f.required && !formData[f.id]) {
        newErrors[f.id] = `${f.label} is required`;
        if (!firstInvalid) firstInvalid = f.id;
      }
    });

    if (checks.some(c => !c)) {
      newErrors["safeguards"] = "All safeguards must be acknowledged";
      if (!firstInvalid) firstInvalid = "safeguards";
    }

    setErrors(newErrors);

    if (firstInvalid) {
      const el = document.getElementById(`field-${firstInvalid}`);
      if (el) el.focus();
      return false;
    }

    return true;
  };

  const handleGenerate = () => {
    if (!selectedPlaybook) return;
    if (!validateForm()) return;

    const sections = selectedPlaybook.sections.map(s => {
      return `\n=== ${s.title.toUpperCase()} ===\n[${s.purpose}]\n` + s.prompts.map(p => `• ${p}`).join("\n");
    }).join("\n");

    const intakeSummary = selectedPlaybook.intakeFields.map(f => `${f.label}: ${formData[f.id] || 'Not stated'}`).join("\n");

    const draft = [
      "LAWYES SAFE PREVIEW — PRACTITIONER-REVIEW TEMPLATE",
      `Pack: ${selectedPlaybook.title}`,
      `Jurisdiction: ${selectedPlaybook.jurisdiction}`,
      state.matterName ? `Matter: ${state.matterName}` : null,
      state.matterTask ? `Task/Purpose: ${state.matterTask}` : null,
      state.matterInstructions ? `Instructions: ${state.matterInstructions}` : null,
      "",
      "INTAKE RECORD",
      intakeSummary,
      "",
      "SOURCE MANIFEST (VERIFICATION REQUIRED)",
      ...selectedPlaybook.sourceIds.map((id) => `- ${SOURCES.find((source) => source.id === id)?.name || id}: check underlying item before reliance`),
      "",
      "RISK & UNCERTAINTY MANIFEST",
      ...selectedPlaybook.riskFlags.map((flag) => `- [FLAG] ${flag}`),
      ...selectedPlaybook.knownGaps.map((gap) => `- [GAP] ${gap}`),
      ...selectedPlaybook.uncertaintyPrompts.map((prompt) => `- [UNRESOLVED] ${prompt}`),
      "",
      "STRUCTURE",
      ...selectedPlaybook.structure.map((item) => `- ${item}`),
      sections,
      "",
      "========================================",
      "WARNING: This is an editable local template. It is not legal advice, a court form, or a filing confirmation. Practitioner review is strictly required before use.",
      "========================================"
    ].filter(x => x !== null).join("\n");

    setGeneratedDraft(draft);
    setStep(3);
  };

  return (
    <div className="h-full overflow-y-auto bg-background py-8 px-5 animate-in fade-in duration-300">
      <div className="max-w-4xl mx-auto">
        {/* Header / Breadcrumb */}
        <div className="mb-8">
          <button onClick={() => navigate("home")} className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mb-4">
            <ArrowLeft size={16} /> Back to Home
          </button>
          <h1 className="text-3xl md:text-4xl font-serif text-foreground leading-tight">Drafting Studio</h1>
          <p className="mt-2 max-w-3xl text-foreground/70">Select a working pack, enter only known instructions, and acknowledge its safeguards. The result organises an intake record, source manifest, open questions, risks and drafting headings; it is not a prescribed form or completed cause paper.</p>
        </div>

        {/* Step 1: Select Playbook */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-xl font-medium text-foreground mb-4">Select a practitioner pack</h2>
            <div className="rounded-lg border border-border bg-white p-4 text-sm text-muted-foreground">
              <strong className="text-foreground">Before you start:</strong> have the internal matter reference, exact party or charge details, relevant dates, the requested task, and supporting records ready. Enter “Not stated” rather than filling a gap with an assumption.
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {PLAYBOOKS.map(pack => (
                <button
                  key={pack.id}
                  onClick={() => handleSelectPlaybook(pack.id)}
                  className="text-left p-6 bg-white border border-border rounded-xl shadow-sm hover:border-primary/50 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <div className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-2">{pack.track}</div>
                  <h3 className="text-lg font-serif text-foreground mb-2">{pack.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{pack.examples[0]}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Intake */}
        {step === 2 && selectedPlaybook && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-white border border-border shadow-sm rounded-xl overflow-hidden">
              <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-serif text-foreground">{selectedPlaybook.title}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{selectedPlaybook.track} &middot; {selectedPlaybook.jurisdiction}</p>
                </div>
                <button onClick={() => updateState({ playbook: "" })} className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Change Pack</button>
              </div>

              <div className="p-6 md:p-8 space-y-10">
                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-5">Matter Details</h3>
                  <p className="-mt-3 mb-5 max-w-2xl text-sm leading-relaxed text-muted-foreground">Record supplied information exactly. This form does not verify identity, ownership, title, forum, urgency, dates, or procedural compliance.</p>
                  <div className="space-y-5">
                    {selectedPlaybook.intakeFields.map(field => (
                      <div key={field.id} className="max-w-2xl">
                        <label htmlFor={`field-${field.id}`} className="block text-sm font-medium text-foreground mb-1.5">
                          {field.label} {field.required && <span className="text-destructive">*</span>}
                        </label>
                        {field.type === 'textarea' ? (
                          <textarea
                            id={`field-${field.id}`}
                            value={formData[field.id] || ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            placeholder={field.placeholder}
                            className={`w-full p-3 bg-background border ${errors[field.id] ? 'border-destructive focus:ring-destructive/20' : 'border-border focus:ring-primary/20 focus:border-primary'} rounded-md text-sm min-h-[100px] resize-y focus:outline-none focus:ring-4 transition-all`}
                          />
                        ) : field.type === 'select' && field.options ? (
                          <select
                            id={`field-${field.id}`}
                            value={formData[field.id] || ""}
                            onChange={(e) => handleFieldChange(field.id, e.target.value)}
                            className={`w-full p-3 bg-background border ${errors[field.id] ? 'border-destructive focus:ring-destructive/20' : 'border-border focus:ring-primary/20 focus:border-primary'} rounded-md text-sm focus:outline-none focus:ring-4 transition-all appearance-none`}
                          >
                            <option value="">Select an option</option>
                            {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input
                            id={`field-${field.id}`}
                            type={field.type}
                            value={formData[field.id] || ""}
                            onChange={(e) => handleFieldChange(field.id, field.type === 'checkbox' ? e.target.checked : e.target.value)}
                            placeholder={field.placeholder}
                            className={`w-full p-3 bg-background border ${errors[field.id] ? 'border-destructive focus:ring-destructive/20' : 'border-border focus:ring-primary/20 focus:border-primary'} rounded-md text-sm focus:outline-none focus:ring-4 transition-all`}
                          />
                        )}
                        {errors[field.id] && <p className="text-xs text-destructive mt-1.5 font-medium">{errors[field.id]}</p>}
                      </div>
                    ))}
                  </div>
                </section>

                <section className="border-t border-border pt-8">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-5 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" /> Mandatory Safeguards
                  </h3>
                  <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-5 space-y-4">
                    {selectedPlaybook.safeguards.map((sg, i) => (
                      <label key={i} className="flex items-start gap-3 cursor-pointer group">
                        <div className="mt-0.5 shrink-0 relative flex items-center justify-center w-5 h-5 border border-amber-300 bg-white rounded shadow-sm group-hover:border-amber-500 transition-colors">
                          <input
                            type="checkbox"
                            id={`field-safeguards-${i}`}
                            checked={checks[i] || false}
                            onChange={(e) => {
                              const next = [...checks];
                              next[i] = e.target.checked;
                              setChecks(next);
                              if (errors["safeguards"] && next.every(c => c)) {
                                setErrors(prev => { const n = {...prev}; delete n["safeguards"]; return n; });
                              }
                            }}
                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                          />
                          {checks[i] && <Check size={14} className="text-amber-600 pointer-events-none" />}
                        </div>
                        <span className="text-sm text-amber-900 leading-tight select-none">{sg}</span>
                      </label>
                    ))}
                    {errors["safeguards"] && <p className="text-xs text-destructive font-medium pl-8" id="field-safeguards">{errors["safeguards"]}</p>}
                  </div>
                </section>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleGenerate}
                    className="flex items-center gap-2 px-8 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-all focus:outline-none focus:ring-4 focus:ring-primary/20"
                  >
                    Generate Template <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Result */}
        {step === 3 && selectedPlaybook && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-amber-50 border-l-4 border-amber-500 p-5 mb-6 text-sm text-amber-900 flex gap-3 items-start shadow-sm">
              <AlertTriangle size={20} className="shrink-0 text-amber-600" />
              <div>
                <strong className="block text-base mb-1">Practitioner review strictly required</strong>
                <p>This draft is an unverified local template. It has not been reviewed by counsel and is not a finalized document. Ensure you independently verify all cited legislation, rules of court, and precedents before any reliance.</p>
                <p className="mt-2">Also compare every fact and name with the file, confirm the current form and registry requirements, check dates and calculations independently, resolve every flagged gap, and record the reviewer and review date.</p>
              </div>
            </div>

            <div className="bg-white border border-border shadow-sm rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <FileText size={16} className="text-primary" />
                  {selectedPlaybook.title} (Draft Template)
                </div>
                <DraftExportButtons
                  title={`${selectedPlaybook.title} Draft Template`}
                  content={generatedDraft}
                />
              </div>
              <div className="p-6 md:p-8 bg-[#fafafa]">
                <DraftDocument content={generatedDraft} />
              </div>
              <div className="p-4 border-t border-border bg-muted/20 flex justify-between">
                <button onClick={() => setStep(2)} className="px-4 py-2 border border-border bg-white rounded text-sm font-medium hover:bg-muted transition-colors">Edit inputs</button>
                <button onClick={() => { updateState({ playbook: "" }); setStep(1); }} className="px-4 py-2 border border-border bg-white rounded text-sm font-medium hover:bg-muted transition-colors">Start new draft</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}