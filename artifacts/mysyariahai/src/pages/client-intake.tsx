import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { tierHasFeature } from "@/lib/tiers";
import UpgradePrompt from "@/components/upgrade-prompt";
import ExportActions from "@/components/export-actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const API_BASE = "/api/sya";

export default function ClientIntakePage() {
  const { user } = useAuth();
  if (!tierHasFeature(user?.tier, "aiToolkit")) {
    return (
      <UpgradePrompt
        requiredTier="professional"
        featureName="Client Intake Assistant"
        featureNameBm="Pembantu Pengambilan Klien"
      />
    );
  }
  return <ClientIntakePageInner />;
}

function ClientIntakePageInner() {
  const { mode } = useLanguage();
  const t = (en: string, bm: string) => mode === "bm" ? bm : en;
  const [, setLocation] = useLocation();

  const [selectedType, setSelectedType] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [generatedBrief, setGeneratedBrief] = useState("");
  const [error, setError] = useState("");
  const [currentSection, setCurrentSection] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const { data: templates } = useQuery({
    queryKey: ["intake-templates"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/client-intake/templates`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: template } = useQuery({
    queryKey: ["intake-template", selectedType],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/client-intake/template/${selectedType}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedType,
  });

  const handleSelectType = (type: string) => {
    setSelectedType(type);
    setFormData({});
    setCurrentSection(0);
    setGeneratedBrief("");
  };

  const handleGenerateBrief = async () => {
    setGenerating(true);
    setError("");
    setGeneratedBrief("");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/client-intake/generate-brief`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseType: selectedType, intakeData: formData, language: mode }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      let fullText = "";
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.error) { setError(data.error); break; }
              if (data.content) { fullText += data.content; setGeneratedBrief(fullText); }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const totalSections = template?.sections?.length || 0;
  const currentSectionData = template?.sections?.[currentSection];
  const filledFields = Object.keys(formData).filter(k => formData[k]?.trim()).length;
  const totalFields = template?.sections?.reduce((acc: number, s: any) => acc + s.fields.length, 0) || 0;
  const requiredFields = template?.sections?.reduce((acc: number, s: any) => acc + s.fields.filter((f: any) => f.required).length, 0) || 0;
  const filledRequired = template?.sections?.reduce((acc: number, s: any) => acc + s.fields.filter((f: any) => f.required && formData[f.key]?.trim()).length, 0) || 0;

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">{t("Client Intake Assistant", "Pembantu Pengambilan Klien")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("Structured case intake forms that generate AI-powered case briefs", "Borang pengambilan kes berstruktur yang menjana ringkasan kes berkuasa AI")}</p>
      </div>

      {error && (
        <Card className="border-destructive/30"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>
      )}

      {!selectedType ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates?.map((tmpl: any) => (
            <Card key={tmpl.id} className="cursor-pointer hover:border-secondary/30 transition-colors" onClick={() => handleSelectType(tmpl.id)}>
              <CardContent className="p-5">
                <h3 className="font-serif font-semibold text-foreground mb-1">{mode === "bm" ? tmpl.titleBm : tmpl.titleEn}</h3>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">{tmpl.sectionCount} {t("sections", "bahagian")}</Badge>
                  <Badge variant="outline" className="text-xs">{tmpl.fieldCount} {t("fields", "medan")}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : generatedBrief ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => { setGeneratedBrief(""); setCurrentSection(0); }}>
              {t("Back to Form", "Kembali ke Borang")}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const tpl = templates?.find((tt: any) => tt.id === selectedType);
                  const partyName = formData.client_name || formData.plaintiff || "";
                  const opposingName = formData.spouse_name || formData.defendant || "";
                  const seed = {
                    scenario: generatedBrief,
                    parties: [partyName, opposingName].filter(Boolean).join(" v. "),
                    reliefSought: tpl ? (mode === "bm" ? tpl.titleBm : tpl.titleEn) : "",
                    area: "family-law",
                    clientPosition: formData.client_position || "",
                  };
                  sessionStorage.setItem("caseWorkspaceSeed", JSON.stringify(seed));
                  setLocation("/case-workspace");
                }}
                data-testid="intake-open-workspace"
              >
                {t("Open in Case Workspace", "Buka dalam Ruang Kerja Kes")} →
              </Button>
            </div>
            <ExportActions content={generatedBrief} filenameBase={t("Case Brief", "Ringkasan Kes")} />
          </div>
          <Card className="border-secondary/30">
            <CardHeader className="pb-3"><h2 className="font-serif font-semibold text-secondary">{t("Generated Case Brief", "Ringkasan Kes Yang Dijana")}</h2></CardHeader>
            <CardContent>
              <div className="bg-white/5 rounded-lg p-4 prose prose-sm prose-invert max-w-none overflow-auto max-h-[70vh]">
                <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">{generatedBrief}</pre>
              </div>
              <p className="text-xs text-muted-foreground italic mt-3">{t("AI-generated case brief. Review and verify all details.", "Ringkasan kes dijana AI. Semak dan sahkan semua butiran.")}</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-serif font-semibold text-foreground text-sm">{mode === "bm" ? templates?.find((t: any) => t.id === selectedType)?.titleBm : templates?.find((t: any) => t.id === selectedType)?.titleEn}</h2>
                  <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => { setSelectedType(""); setFormData({}); }}>
                    {t("Change", "Tukar")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {template?.sections?.map((section: any, i: number) => {
                  const sectionFilled = section.fields.filter((f: any) => formData[f.key]?.trim()).length;
                  return (
                    <div
                      key={i}
                      onClick={() => setCurrentSection(i)}
                      className={`flex items-center justify-between px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                        currentSection === i ? "bg-secondary/10 text-secondary" : "text-muted-foreground hover:bg-muted/30"
                      }`}
                    >
                      <span className="truncate">{mode === "bm" ? section.labelBm : section.labelEn}</span>
                      <span className="text-xs">{sectionFilled}/{section.fields.length}</span>
                    </div>
                  );
                })}
                <div className="pt-3 border-t border-border/30 mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>{t("Progress", "Kemajuan")}</span>
                    <span>{filledFields}/{totalFields}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-secondary rounded-full transition-all" style={{ width: `${totalFields > 0 ? (filledFields / totalFields) * 100 : 0}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {currentSectionData && (
              <Card>
                <CardHeader className="pb-3">
                  <h2 className="font-serif font-semibold text-foreground">{mode === "bm" ? currentSectionData.labelBm : currentSectionData.labelEn}</h2>
                  <p className="text-xs text-muted-foreground">{t(`Section ${currentSection + 1} of ${totalSections}`, `Bahagian ${currentSection + 1} daripada ${totalSections}`)}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentSectionData.fields.map((field: any) => {
                    if (field.type.startsWith("select:")) {
                      const options = field.type.replace("select:", "").split("|");
                      return (
                        <div key={field.key}>
                          <label className="text-sm font-medium text-foreground mb-1.5 block">
                            {mode === "bm" ? field.labelBm : field.labelEn}
                            {field.required && <span className="text-red-400 ml-1">*</span>}
                          </label>
                          <select
                            value={formData[field.key] || ""}
                            onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="">{t("Select...", "Pilih...")}</option>
                            {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        </div>
                      );
                    }
                    return (
                      <div key={field.key}>
                        <label className="text-sm font-medium text-foreground mb-1.5 block">
                          {mode === "bm" ? field.labelBm : field.labelEn}
                          {field.required && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        {field.type === "textarea" ? (
                          <textarea
                            value={formData[field.key] || ""}
                            onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                            rows={3}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder={field.placeholder}
                          />
                        ) : (
                          <Input
                            value={formData[field.key] || ""}
                            onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                            placeholder={field.placeholder}
                          />
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {currentSection > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setCurrentSection(prev => prev - 1)}>
                    {t("Previous", "Sebelumnya")}
                  </Button>
                )}
                {currentSection < totalSections - 1 && (
                  <Button variant="outline" size="sm" onClick={() => setCurrentSection(prev => prev + 1)}>
                    {t("Next Section", "Bahagian Seterusnya")}
                  </Button>
                )}
              </div>
              <Button
                onClick={handleGenerateBrief}
                disabled={generating || filledRequired < requiredFields}
                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
              >
                {generating ? t("Generating Brief...", "Menjana Ringkasan...") : t("Generate Case Brief", "Jana Ringkasan Kes")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
