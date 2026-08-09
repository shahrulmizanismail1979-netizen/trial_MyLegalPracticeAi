import { useState, useRef } from "react";
import { useLanguage } from "@/lib/language-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";

const API_BASE = "/api/sya";

function formatAnalysisText(result: any, t: (en: string, bm: string) => string): string {
  const lines: string[] = [];
  if (result.strengthAssessment) {
    lines.push(`${t("Strength Assessment", "Penilaian Kekuatan")}: ${result.strengthAssessment.overall ?? ""} (${result.strengthAssessment.score ?? "?"}/10)`);
    if (result.strengthAssessment.reasoning) lines.push(result.strengthAssessment.reasoning);
    lines.push("");
  }
  if (result.predictedOutcomes?.length) {
    lines.push(t("Predicted Outcomes:", "Keputusan Yang Diramalkan:"));
    for (const po of result.predictedOutcomes) {
      lines.push(`- [${po.probability}] ${po.outcome}`);
      if (po.basis) lines.push(`  ${po.basis}`);
    }
    lines.push("");
  }
  if (result.precedentCases?.length) {
    lines.push(t("Precedent Cases:", "Kes Terdahulu:"));
    for (const pc of result.precedentCases) {
      lines.push(`- ${pc.caseName}${pc.citation ? ` (${pc.citation})` : ""}`);
      if (pc.applicability) lines.push(`  ${pc.applicability}`);
    }
    lines.push("");
  }
  const sa = result.strategicAdvice;
  if (sa) {
    lines.push(t("Strategic Advice:", "Nasihat Strategik:"));
    if (sa.strengths?.length) lines.push(`${t("Strengths", "Kekuatan")}: ${sa.strengths.join("; ")}`);
    if (sa.weaknesses?.length) lines.push(`${t("Weaknesses", "Kelemahan")}: ${sa.weaknesses.join("; ")}`);
    if (sa.recommendations?.length) lines.push(`${t("Recommendations", "Cadangan")}: ${sa.recommendations.join("; ")}`);
    if (sa.evidenceNeeded?.length) lines.push(`${t("Evidence Needed", "Bukti Diperlukan")}: ${sa.evidenceNeeded.join("; ")}`);
  }
  return lines.join("\n").trim();
}

const CASE_TYPES = [
  { value: "nafkah", labelEn: "Nafkah (Maintenance)", labelBm: "Nafkah" },
  { value: "hadhanah", labelEn: "Hadhanah (Custody)", labelBm: "Hadhanah" },
  { value: "fasakh", labelEn: "Fasakh (Judicial Dissolution)", labelBm: "Fasakh" },
  { value: "talaq", labelEn: "Talaq (Divorce)", labelBm: "Talaq" },
  { value: "mutah", labelEn: "Mut'ah (Consolatory Gift)", labelBm: "Mut'ah" },
  { value: "harta-sepencarian", labelEn: "Harta Sepencarian", labelBm: "Harta Sepencarian" },
  { value: "faraid", labelEn: "Faraid (Inheritance)", labelBm: "Faraid" },
  { value: "polygamy", labelEn: "Polygamy Application", labelBm: "Permohonan Poligami" },
  { value: "wakaf", labelEn: "Wakaf (Endowment)", labelBm: "Wakaf" },
  { value: "criminal", labelEn: "Shariah Criminal Offence", labelBm: "Kesalahan Jenayah Syariah" },
  { value: "other", labelEn: "Other", labelBm: "Lain-lain" },
];

export default function CaseAnalysisPage() {
  const { mode } = useLanguage();
  const t = (en: string, bm: string) => mode === "bm" ? bm : en;

  const [caseType, setCaseType] = useState("");
  const [facts, setFacts] = useState("");
  const [parties, setParties] = useState("");
  const [reliefSought, setReliefSought] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const handleAnalyze = async () => {
    if (!facts.trim()) return;
    setAnalyzing(true);
    setError("");
    setResult(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/case-analysis/predict`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseType, facts, parties, reliefSought, language: mode }),
        signal: controller.signal,
      });

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
            const data = JSON.parse(line.slice(6));
            if (data.error) { setError(data.error); break; }
            if (data.content) fullText += data.content;
          }
        }
      }

      const cleaned = fullText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      setResult(JSON.parse(cleaned));
    } catch (err: any) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const strengthColor = (s: string) => {
    if (s === "Strong") return "text-emerald-400";
    if (s === "Moderate") return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">{t("Case Analysis & Prediction", "Analisis & Ramalan Kes")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("AI analyzes your case facts against precedent cases to predict likely outcomes", "AI menganalisis fakta kes anda terhadap kes-kes terdahulu untuk meramalkan keputusan yang mungkin")}</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3"><h2 className="font-serif font-semibold text-foreground">{t("Case Details", "Butiran Kes")}</h2></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Case Type", "Jenis Kes")}</label>
                <Select value={caseType} onValueChange={setCaseType}>
                  <SelectTrigger><SelectValue placeholder={t("Select case type", "Pilih jenis kes")} /></SelectTrigger>
                  <SelectContent>
                    {CASE_TYPES.map(ct => (
                      <SelectItem key={ct.value} value={ct.value}>{mode === "bm" ? ct.labelBm : ct.labelEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Parties", "Pihak-Pihak")}</label>
                <Input value={parties} onChange={e => setParties(e.target.value)} placeholder={t("e.g. Wife (Plaintiff) v Husband (Defendant)", "cth: Isteri (Plaintif) lwn Suami (Defendan)")} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Relief Sought", "Remedi Yang Dituntut")}</label>
                <Input value={reliefSought} onChange={e => setReliefSought(e.target.value)} placeholder={t("e.g. Nafkah RM3,000/month", "cth: Nafkah RM3,000/bulan")} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Case Facts", "Fakta Kes")} *</label>
                <textarea
                  value={facts}
                  onChange={e => setFacts(e.target.value)}
                  rows={8}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={t(
                    "Describe the case facts in detail. Include: parties' background, timeline, key events, evidence available, any prior proceedings...",
                    "Huraikan fakta kes secara terperinci. Sertakan: latar belakang pihak-pihak, garis masa, peristiwa utama, bukti yang tersedia, prosiding terdahulu..."
                  )}
                />
              </div>
              <Button onClick={handleAnalyze} disabled={analyzing || !facts.trim()} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                {analyzing ? t("Analyzing...", "Menganalisis...") : t("Analyze Case", "Analisis Kes")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {error && <Card className="border-destructive/30"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

          {analyzing && (
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center animate-pulse">
                <svg className="w-7 h-7 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              </div>
              <p className="text-sm text-muted-foreground">{t("AI is analyzing against 149+ precedent cases...", "AI sedang menganalisis terhadap 149+ kes terdahulu...")}</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <Card className="border-secondary/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-serif font-semibold text-foreground">{t("Strength Assessment", "Penilaian Kekuatan")}</h3>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${strengthColor(result.strengthAssessment?.overall)}`}>{result.strengthAssessment?.score}/10</span>
                      <Badge className={`${result.strengthAssessment?.overall === "Strong" ? "bg-emerald-900/30 text-emerald-400" : result.strengthAssessment?.overall === "Moderate" ? "bg-amber-900/30 text-amber-400" : "bg-red-900/30 text-red-400"}`}>
                        {result.strengthAssessment?.overall}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{result.strengthAssessment?.reasoning}</p>
                  {result.caseClassification && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Badge variant="outline">{result.caseClassification.primaryArea}</Badge>
                      <Badge variant="outline">{result.caseClassification.subCategory}</Badge>
                      <Badge variant="outline">{result.caseClassification.jurisdiction}</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {result.predictedOutcomes?.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><h3 className="font-serif font-semibold text-foreground">{t("Predicted Outcomes", "Keputusan Yang Diramalkan")}</h3></CardHeader>
                  <CardContent className="space-y-3">
                    {result.predictedOutcomes.map((po: any, i: number) => (
                      <div key={i} className="border border-border/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={po.probability === "High" ? "bg-emerald-900/30 text-emerald-400" : po.probability === "Medium" ? "bg-amber-900/30 text-amber-400" : "bg-red-900/30 text-red-400"}>
                            {po.probability}
                          </Badge>
                        </div>
                        <p className="text-sm text-foreground">{po.outcome}</p>
                        <p className="text-xs text-muted-foreground mt-1">{po.basis}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {result.precedentCases?.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><h3 className="font-serif font-semibold text-foreground">{t("Precedent Cases", "Kes Terdahulu")}</h3></CardHeader>
                  <CardContent className="space-y-2">
                    {result.precedentCases.map((pc: any, i: number) => (
                      <div key={i} className="border border-border/50 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-foreground">{pc.caseName}</h4>
                        <p className="text-xs text-secondary font-mono">{pc.citation}</p>
                        <p className="text-xs text-muted-foreground mt-1">{pc.applicability}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {result.strategicAdvice && (
                <Card>
                  <CardHeader className="pb-3"><h3 className="font-serif font-semibold text-foreground">{t("Strategic Advice", "Nasihat Strategik")}</h3></CardHeader>
                  <CardContent className="space-y-3">
                    {result.strategicAdvice.strengths?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-emerald-400 mb-1">{t("Strengths", "Kekuatan")}</h4>
                        <ul className="text-xs text-muted-foreground space-y-1">{result.strategicAdvice.strengths.map((s: string, i: number) => <li key={i}>- {s}</li>)}</ul>
                      </div>
                    )}
                    {result.strategicAdvice.weaknesses?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-red-400 mb-1">{t("Weaknesses", "Kelemahan")}</h4>
                        <ul className="text-xs text-muted-foreground space-y-1">{result.strategicAdvice.weaknesses.map((s: string, i: number) => <li key={i}>- {s}</li>)}</ul>
                      </div>
                    )}
                    {result.strategicAdvice.recommendations?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-secondary mb-1">{t("Recommendations", "Cadangan")}</h4>
                        <ul className="text-xs text-muted-foreground space-y-1">{result.strategicAdvice.recommendations.map((s: string, i: number) => <li key={i}>- {s}</li>)}</ul>
                      </div>
                    )}
                    {result.strategicAdvice.evidenceNeeded?.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-blue-400 mb-1">{t("Evidence Needed", "Bukti Diperlukan")}</h4>
                        <ul className="text-xs text-muted-foreground space-y-1">{result.strategicAdvice.evidenceNeeded.map((s: string, i: number) => <li key={i}>- {s}</li>)}</ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className="bg-muted/20">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground italic">
                    {t("This is AI-generated analysis based on precedent cases. All predictions are indicative only and should not be relied upon as legal advice. Consult a qualified Peguam Syarie.", "Ini adalah analisis yang dijana AI berdasarkan kes terdahulu. Semua ramalan adalah indikatif sahaja dan tidak boleh dijadikan nasihat undang-undang. Rujuk Peguam Syarie yang berkelayakan.")}
                  </p>
                </CardContent>
              </Card>

              <SaveToMatterPanel
                draftTitle={t("Case Analysis & Prediction", "Analisis & Ramalan Kes")}
                draftContent={formatAnalysisText(result, t)}
                parties={parties || undefined}
                kind="analysis"
                matterType={caseType || undefined}
              />
            </div>
          )}

          {!result && !analyzing && !error && (
            <Card className="border-dashed border-border/50">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-secondary/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                </div>
                <h3 className="font-serif font-semibold text-foreground mb-2">{t("AI Case Prediction", "Ramalan Kes AI")}</h3>
                <p className="text-sm text-muted-foreground">{t("Enter your case details on the left. The AI will analyze against 149+ precedent cases and predict likely outcomes.", "Masukkan butiran kes anda di sebelah kiri. AI akan menganalisis terhadap 149+ kes terdahulu dan meramalkan keputusan.")}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
