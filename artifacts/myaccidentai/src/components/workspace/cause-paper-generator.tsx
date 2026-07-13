import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Copy, Download, Sparkles, Folder, Check } from "lucide-react";
import { templates, defaultCase, type CaseDetails, type TemplateDef } from "./templates";

type Props = { initialTemplateId?: string };

export function CausePaperGenerator({ initialTemplateId }: Props) {
  const [selectedId, setSelectedId] = useState<string>(initialTemplateId || templates[0].id);
  const [details, setDetails] = useState<CaseDetails>(defaultCase);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const categories = useMemo(() => Array.from(new Set(templates.map(t => t.category))), []);
  const visibleTemplates = useMemo(
    () => templates.filter(t => !filterCat || t.category === filterCat),
    [filterCat]
  );

  const selected: TemplateDef = templates.find(t => t.id === selectedId) || templates[0];
  const generated = useMemo(() => selected.build(details), [selected, details]);

  const update = (k: keyof CaseDetails, v: string) => setDetails(d => ({ ...d, [k]: v }));

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generated], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = selected.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
    a.download = `${safeName}_${details.suitNo}${details.year}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-serif font-bold text-base">AI Cause Paper Generator</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Pilih jenis dokumen, isi butiran kes anda, dan dapatkan cause paper dalam format Mahkamah Malaysia. Salin atau muat turun sebagai fail teks untuk diedit dalam Word.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Template Library ({templates.length})</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button
                onClick={() => setFilterCat(null)}
                className={`text-[11px] px-2 py-1 rounded ${!filterCat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                data-testid="filter-cat-all"
              >
                All
              </button>
              {categories.map(c => (
                <button
                  key={c}
                  onClick={() => setFilterCat(c)}
                  className={`text-[11px] px-2 py-1 rounded inline-flex items-center gap-1 ${filterCat === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                  data-testid={`filter-cat-${c}`}
                >
                  <Folder className="h-2.5 w-2.5" /> {c}
                </button>
              ))}
            </div>
            <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
              {visibleTemplates.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  data-testid={`template-${t.id}`}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                    selectedId === t.id
                      ? "bg-primary/10 border-primary/40"
                      : "border-transparent hover:bg-muted/60"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <FileText className={`h-4 w-4 flex-shrink-0 mt-0.5 ${selectedId === t.id ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-medium leading-snug">{t.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{t.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Case Details</div>

            <Section title="Court & Parties">
              <Field label="Court" value={details.court} onChange={v => update("court", v)} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Suit No." value={details.suitNo} onChange={v => update("suitNo", v)} />
                <Field label="Year" value={details.year} onChange={v => update("year", v)} />
              </div>
              <Field label="Plaintiff Name" value={details.plaintiffName} onChange={v => update("plaintiffName", v)} />
              <Field label="Plaintiff IC" value={details.plaintiffIc} onChange={v => update("plaintiffIc", v)} />
              <Field label="Plaintiff Address" value={details.plaintiffAddress} onChange={v => update("plaintiffAddress", v)} />
              <Field label="Defendant Name" value={details.defendantName} onChange={v => update("defendantName", v)} />
              <Field label="Defendant IC" value={details.defendantIc} onChange={v => update("defendantIc", v)} />
              <Field label="Defendant Address" value={details.defendantAddress} onChange={v => update("defendantAddress", v)} />
              <Field label="Insurer Name" value={details.insurerName} onChange={v => update("insurerName", v)} />
              <Field label="Insurer Address" value={details.insurerAddress} onChange={v => update("insurerAddress", v)} />
            </Section>

            <Section title="Accident">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Date" value={details.accidentDate} onChange={v => update("accidentDate", v)} />
                <Field label="Time" value={details.accidentTime} onChange={v => update("accidentTime", v)} />
              </div>
              <Field label="Place" value={details.accidentPlace} onChange={v => update("accidentPlace", v)} />
              <Field label="Plaintiff Vehicle" value={details.plaintiffVehicle} onChange={v => update("plaintiffVehicle", v)} />
              <Field label="Defendant Vehicle" value={details.defendantVehicle} onChange={v => update("defendantVehicle", v)} />
              <Field label="Police Report No." value={details.policeReportNo} onChange={v => update("policeReportNo", v)} />
            </Section>

            <Section title="Damages">
              <Field label="Injuries Summary" value={details.injuriesSummary} onChange={v => update("injuriesSummary", v)} />
              <Field label="Special Damages" value={details.specialDamages} onChange={v => update("specialDamages", v)} />
              <Field label="General Damages (estimate)" value={details.generalDamagesEstimate} onChange={v => update("generalDamagesEstimate", v)} />
            </Section>

            <Section title="Solicitor">
              <Field label="Firm" value={details.solicitorFirm} onChange={v => update("solicitorFirm", v)} />
              <Field label="Address" value={details.solicitorAddress} onChange={v => update("solicitorAddress", v)} />
              <Field label="Filing Date" value={details.filingDate} onChange={v => update("filingDate", v)} />
            </Section>
          </div>
        </aside>

        <section className="lg:col-span-8">
          <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-24">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{selected.name}</div>
                <div className="text-[11px] text-muted-foreground">{selected.category}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1.5" data-testid="button-copy">
                  {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                </Button>
                <Button size="sm" onClick={handleDownload} className="gap-1.5" data-testid="button-download">
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            </div>
            <pre
              className="text-xs leading-relaxed font-mono whitespace-pre-wrap p-5 overflow-auto max-h-[70vh] bg-background"
              data-testid="preview-document"
            >
              {generated}
            </pre>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 px-1">
            Generated drafts are starting points only. Always review and adapt to specific facts, current rules, and applicable practice directions before filing. Verify all citations against primary sources.
          </p>
        </section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-3 first:border-0 first:pt-0 space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-primary/70">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground block mb-1">{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs bg-background"
      />
    </div>
  );
}
