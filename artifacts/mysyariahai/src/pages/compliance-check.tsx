import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { tierHasFeature } from "@/lib/tiers";
import UpgradePrompt from "@/components/upgrade-prompt";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_BASE = "/api/sya";

const VERDICT_COLORS: Record<string, string> = {
  "COMPLIANT": "bg-emerald-900/30 text-emerald-400 border-emerald-800",
  "NON-COMPLIANT": "bg-red-900/30 text-red-400 border-red-800",
  "CONDITIONALLY_COMPLIANT": "bg-amber-900/30 text-amber-400 border-amber-800",
  "REQUIRES_MODIFICATION": "bg-orange-900/30 text-orange-400 border-orange-800",
};

const SEVERITY_COLORS: Record<string, string> = {
  "Critical": "text-red-400",
  "Major": "text-orange-400",
  "Minor": "text-amber-400",
  "None": "text-emerald-400",
};

export default function ComplianceCheckPage() {
  const { user } = useAuth();
  if (!tierHasFeature(user?.tier, "aiToolkit")) {
    return (
      <UpgradePrompt
        requiredTier="professional"
        featureName="Shariah Compliance Checker"
        featureNameBm="Pemeriksa Pematuhan Syariah"
      />
    );
  }
  return <ComplianceCheckPageInner />;
}

function ComplianceCheckPageInner() {
  const { mode } = useLanguage();
  const t = (en: string, bm: string) => mode === "bm" ? bm : en;

  const [transactionType, setTransactionType] = useState("");
  const [description, setDescription] = useState("");
  const [partiesInvolved, setPartiesInvolved] = useState("");
  const [contractTerms, setContractTerms] = useState("");
  const [concerns, setConcerns] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const { data: txTypes } = useQuery({
    queryKey: ["compliance-types"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/compliance-check/types`, { credentials: "include" });
      return res.json();
    },
  });

  const handleAnalyze = async () => {
    if (!description.trim()) return;
    setAnalyzing(true);
    setError("");
    setResult(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/compliance-check/analyze`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionType, description, partiesInvolved, contractTerms, concerns, language: mode }),
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
              if (data.content) fullText += data.content;
            } catch {}
          }
        }
      }
      try {
        const cleaned = fullText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        setResult(JSON.parse(cleaned));
      } catch {
        setError(mode === "bm" ? "Gagal memproses respons AI. Sila cuba lagi." : "Failed to parse AI response. Please try again.");
      }
    } catch (err: any) {
      if (err.name !== "AbortError") setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">{t("Shariah Compliance Checker", "Penyemak Pematuhan Syariah")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("AI-powered Shariah compliance review for transactions, contracts & arrangements", "Semakan pematuhan Syariah berkuasa AI untuk transaksi, kontrak & aturan")}</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3"><h2 className="font-serif font-semibold text-foreground">{t("Transaction Details", "Butiran Transaksi")}</h2></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Transaction Type", "Jenis Transaksi")}</label>
                <Select value={transactionType} onValueChange={setTransactionType}>
                  <SelectTrigger><SelectValue placeholder={t("Select type", "Pilih jenis")} /></SelectTrigger>
                  <SelectContent>
                    {txTypes?.map((tt: any) => (
                      <SelectItem key={tt.id} value={tt.id}>{mode === "bm" ? tt.titleBm : tt.titleEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Description", "Penerangan")} *</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={t("Describe the transaction, contract, or arrangement in detail...", "Huraikan transaksi, kontrak, atau aturan secara terperinci...")}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Parties Involved", "Pihak Terlibat")}</label>
                <textarea value={partiesInvolved} onChange={e => setPartiesInvolved(e.target.value)} rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={t("Who are the parties?", "Siapakah pihak-pihak?")}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Key Contract Terms", "Syarat Kontrak Utama")}</label>
                <textarea value={contractTerms} onChange={e => setContractTerms(e.target.value)} rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={t("Key terms, pricing, conditions...", "Syarat utama, harga, kondisi...")}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Specific Concerns", "Kebimbangan Khusus")}</label>
                <textarea value={concerns} onChange={e => setConcerns(e.target.value)} rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={t("Any specific Shariah concerns?", "Sebarang kebimbangan Syariah khusus?")}
                />
              </div>
              <Button onClick={handleAnalyze} disabled={analyzing || !description.trim()} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                {analyzing ? t("Analyzing...", "Menganalisis...") : t("Check Compliance", "Semak Pematuhan")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {error && <Card className="border-destructive/30"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

          {analyzing && (
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center animate-pulse">
                <svg className="w-7 h-7 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-sm text-muted-foreground">{t("AI is conducting Shariah compliance review...", "AI sedang menjalankan semakan pematuhan Syariah...")}</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <Card className={`border-2 ${result.overallVerdict === "COMPLIANT" ? "border-emerald-800/50" : result.overallVerdict === "NON-COMPLIANT" ? "border-red-800/50" : "border-amber-800/50"}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Badge className={`text-sm px-3 py-1 ${VERDICT_COLORS[result.overallVerdict] || "bg-muted"}`}>
                      {result.overallVerdict?.replace(/_/g, " ")}
                    </Badge>
                    <span className={`text-3xl font-bold ${result.complianceScore >= 7 ? "text-emerald-400" : result.complianceScore >= 4 ? "text-amber-400" : "text-red-400"}`}>
                      {result.complianceScore}/10
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{result.summary}</p>
                </CardContent>
              </Card>

              {result.prohibitedElements?.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><h3 className="font-serif font-semibold text-foreground">{t("Prohibited Elements Check", "Semakan Elemen Larangan")}</h3></CardHeader>
                  <CardContent className="space-y-2">
                    {result.prohibitedElements.map((pe: any, i: number) => (
                      <div key={i} className="flex items-center justify-between border border-border/50 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${pe.detected ? "bg-red-900/30" : "bg-emerald-900/30"}`}>
                            {pe.detected ? (
                              <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
                            ) : (
                              <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7" /></svg>
                            )}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-foreground">{pe.element}</span>
                            <span className="text-xs text-muted-foreground ml-2">({pe.arabicTerm})</span>
                            <p className="text-xs text-muted-foreground mt-0.5">{pe.details}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-medium ${SEVERITY_COLORS[pe.severity] || "text-muted-foreground"}`}>{pe.severity}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {result.shariahPrinciples?.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><h3 className="font-serif font-semibold text-foreground">{t("Shariah Principles", "Prinsip Syariah")}</h3></CardHeader>
                  <CardContent className="space-y-2">
                    {result.shariahPrinciples.map((sp: any, i: number) => (
                      <div key={i} className="border border-border/50 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={sp.status === "SATISFIED" ? "bg-emerald-900/30 text-emerald-400" : sp.status === "VIOLATED" ? "bg-red-900/30 text-red-400" : "bg-amber-900/30 text-amber-400"}>
                            {sp.status}
                          </Badge>
                          <span className="text-sm font-medium text-foreground">{sp.principle}</span>
                          <span className="text-xs text-secondary">({sp.arabicTerm})</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{sp.explanation}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {result.modifications?.length > 0 && (
                <Card className="border-amber-800/30">
                  <CardHeader className="pb-3"><h3 className="font-serif font-semibold text-amber-400">{t("Required Modifications", "Pengubahsuaian Diperlukan")}</h3></CardHeader>
                  <CardContent className="space-y-2">
                    {result.modifications.map((mod: any, i: number) => (
                      <div key={i} className="border border-amber-800/30 bg-amber-900/10 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">{mod.priority}</Badge>
                          <span className="text-sm font-medium text-foreground">{mod.issue}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{t("Current", "Semasa")}: {mod.currentState}</p>
                        <p className="text-xs text-secondary mt-0.5">{t("Required", "Diperlukan")}: {mod.requiredChange}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {result.practicalAdvice && (
                <Card className="bg-secondary/5 border-secondary/20">
                  <CardHeader className="pb-3"><h3 className="font-serif font-semibold text-secondary">{t("Practical Advice", "Nasihat Praktikal")}</h3></CardHeader>
                  <CardContent><p className="text-sm text-foreground leading-relaxed">{result.practicalAdvice}</p></CardContent>
                </Card>
              )}

              <Card className="bg-muted/20">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground italic">{t("AI-generated compliance assessment. Consult qualified Shariah advisors for binding opinions.", "Penilaian pematuhan dijana AI. Rujuk penasihat Syariah berkelayakan untuk pendapat mengikat.")}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {!result && !analyzing && !error && (
            <Card className="border-dashed border-border/50">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-secondary/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="font-serif font-semibold text-foreground mb-2">{t("Shariah Compliance Review", "Semakan Pematuhan Syariah")}</h3>
                <p className="text-sm text-muted-foreground">{t("Describe a transaction, contract, or arrangement. AI will check for riba, gharar, maysir, and other prohibited elements, and assess compliance with Shariah principles.", "Huraikan transaksi, kontrak, atau aturan. AI akan menyemak riba, gharar, maysir, dan elemen larangan lain, serta menilai pematuhan dengan prinsip Syariah.")}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
