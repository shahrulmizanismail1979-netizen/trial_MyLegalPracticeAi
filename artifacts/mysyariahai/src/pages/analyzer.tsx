import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";
import ExportActions from "@/components/export-actions";
import { MatterPicker, buildMatterSummary } from "@/components/MatterPicker";
import type { Matter } from "@/hooks/use-matters";
import { DraftDocument } from "@workspace/draft-export/react";

function formatAnalyzerText(result: AnalysisResult, t: (en: string, bm: string) => string): string {
  const lines: string[] = [];
  if (result.summary) lines.push(result.summary, "");
  if (result.quranicVerses?.length) {
    lines.push(t("Quranic Verses:", "Ayat Al-Quran:"));
    for (const v of result.quranicVerses) lines.push(`- ${v.reference}: ${v.relevance}`);
    lines.push("");
  }
  if (result.fatwas?.length) {
    lines.push(t("Fatwas:", "Fatwa:"));
    for (const f of result.fatwas) lines.push(`- ${f.title}: ${f.relevance}`);
    lines.push("");
  }
  if (result.provisions?.length) {
    lines.push(t("Statutory Provisions:", "Peruntukan Statut:"));
    for (const p of result.provisions) lines.push(`- ${p.title}: ${p.relevance}`);
    lines.push("");
  }
  if (result.cases?.length) {
    lines.push(t("Case Law:", "Kes Undang-Undang:"));
    for (const c of result.cases) lines.push(`- ${c.caseName}${c.citation ? ` (${c.citation})` : ""}: ${c.relevance}`);
    lines.push("");
  }
  if (result.practicalAdvice) lines.push(`${t("Practical Advice", "Nasihat Praktikal")}: ${result.practicalAdvice}`);
  return lines.join("\n").trim();
}

interface AnalysisResult {
  summary: string;
  quranicVerses: Array<{ id: number; reference: string; relevance: string }>;
  fatwas: Array<{ id: number; title: string; relevance: string }>;
  provisions: Array<{ id: number; title: string; relevance: string }>;
  cases: Array<{ id: number; caseName: string; citation: string; relevance: string }>;
  practicalAdvice: string;
  disclaimer: string;
}

const SUGGESTED_SCENARIOS = [
  {
    en: "A wife wants to file for fasakh (judicial divorce) because her husband has been absent for over two years without any financial support.",
    bm: "Seorang isteri ingin memfailkan fasakh kerana suaminya telah ghaib selama lebih dua tahun tanpa sebarang nafkah.",
  },
  {
    en: "A father passed away without a will, leaving behind a wife, two sons, one daughter, and his mother. How should the estate be distributed?",
    bm: "Seorang bapa meninggal dunia tanpa wasiat, meninggalkan isteri, dua anak lelaki, seorang anak perempuan, dan ibunya. Bagaimana harta pusaka perlu dibahagikan?",
  },
  {
    en: "A mother is seeking custody (hadhanah) of her 5-year-old child after divorce. The father claims she is unfit because she works full-time.",
    bm: "Seorang ibu menuntut hak penjagaan (hadhanah) anak berusia 5 tahun selepas perceraian. Bapa mendakwa ibu tidak layak kerana bekerja sepenuh masa.",
  },
  {
    en: "A client wants to challenge an Islamic bank's BBA (Bai Bithaman Ajil) facility claiming the profit rate is equivalent to riba.",
    bm: "Seorang klien ingin mencabar kemudahan BBA (Bai Bithaman Ajil) bank Islam dengan mendakwa kadar keuntungan adalah setara dengan riba.",
  },
  {
    en: "A Muslim woman married a man who later claimed to have converted to Islam but never practiced. She wants to annul the marriage.",
    bm: "Seorang wanita Islam berkahwin dengan seorang lelaki yang kemudian mendakwa telah memeluk Islam tetapi tidak pernah mengamalkannya. Beliau mahu membatalkan perkahwinan.",
  },
  {
    en: "A family disputes whether a property transfer made by a terminally ill father to one child constitutes a valid hibah or should be treated as part of the estate for faraid distribution.",
    bm: "Sebuah keluarga mempertikaikan sama ada pemindahan harta yang dibuat oleh bapa yang sakit tenat kepada seorang anak merupakan hibah yang sah atau harus dianggap sebagai sebahagian harta pusaka untuk pengagihan faraid.",
  },
];

export default function AnalyzerPage() {
  const { t, ts, mode } = useLanguage();
  const [, setLocation] = useLocation();
  const [situation, setSituation] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("summary");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const prefill = sessionStorage.getItem("analyzerPrefill");
    if (prefill) {
      sessionStorage.removeItem("analyzerPrefill");
      setSituation(prefill);
    }
  }, []);

  const { data: stats } = useQuery({
    queryKey: ["analyzer-stats"],
    queryFn: api.analyzer.stats,
  });

  const handleAnalyze = useCallback(async () => {
    if (!situation.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    setStreamText("");
    setResult(null);
    setError("");
    setActiveTab("summary");

    abortRef.current = new AbortController();

    try {
      const response = await api.analyzer.analyze(situation.trim(), mode === "bm" ? "bm" : "en");
      if (!response.ok) throw new Error("Analysis request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          try {
            const data = JSON.parse(payload);
            if (data.error) {
              setError(data.error);
              setIsAnalyzing(false);
              return;
            }
            if (data.done) {
              let jsonStr = fullContent.trim();
              if (jsonStr.startsWith("```")) {
                jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
              }
              try {
                const parsed = JSON.parse(jsonStr);
                setResult(parsed);
              } catch {
                setError(mode === "bm" ? "Gagal menganalisis respons AI" : "Failed to parse AI response");
              }
              setIsAnalyzing(false);
              return;
            }
            if (data.content) {
              fullContent += data.content;
              setStreamText(fullContent);
            }
          } catch {
            continue;
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setIsAnalyzing(false);
    }
  }, [situation, mode, isAnalyzing]);

  const navigateTo = (path: string, id: number) => {
    const keyMap: Record<string, string> = {
      "/quranic-verses": "navigateToQuranic-versesId",
      "/fatwas": "navigateToFatwasId",
      "/provisions": "navigateToProvisionsId",
      "/cases": "navigateToCaseId",
    };
    const key = keyMap[path];
    if (key) sessionStorage.setItem(key, String(id));
    setLocation(path);
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">
          {t("AI Shariah Legal Analyzer", "Penganalisis Undang-Undang Syariah AI")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "Describe your legal situation and AI will cross-reference Quranic verses, fatwas, provisions, and case laws",
            "Huraikan situasi undang-undang anda dan AI akan merujuk silang ayat Al-Quran, fatwa, peruntukan, dan kes undang-undang"
          )}
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-card/50 border-secondary/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-secondary">{stats.verses}</p>
              <p className="text-xs text-muted-foreground">{t("Quranic Verses", "Ayat Al-Quran")}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-secondary/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-secondary">{stats.fatwas}</p>
              <p className="text-xs text-muted-foreground">{t("Fatwas", "Fatwa")}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-secondary/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-secondary">{stats.provisions}</p>
              <p className="text-xs text-muted-foreground">{t("Provisions", "Peruntukan")}</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-secondary/20">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-secondary">{stats.cases}</p>
              <p className="text-xs text-muted-foreground">{t("Case Laws", "Kes Undang-Undang")}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-secondary/20">
        <CardContent className="p-4 space-y-3">
          <MatterPicker onSelect={(m: Matter) => {
            // situation ← formatted summary
            setSituation(buildMatterSummary(m));
          }} />
          <label className="text-sm font-medium text-foreground">
            {t("Describe your case or legal situation", "Huraikan kes atau situasi undang-undang anda")}
          </label>
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder={mode === "bm"
              ? "Contoh: Seorang isteri ingin memfailkan tuntutan fasakh kerana suami telah menghilang selama dua tahun tanpa memberi nafkah..."
              : "Example: A wife wants to file for fasakh (judicial divorce) because her husband has been absent for over two years without any financial support..."
            }
            className="w-full h-32 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50 resize-none"
            disabled={isAnalyzing}
            maxLength={2000}
          />
          <div className="flex items-center justify-between">
            <p className={`text-xs ${situation.length > 1800 ? "text-destructive" : "text-muted-foreground"}`}>
              {t(`${situation.length}/2000 characters`, `${situation.length}/2000 aksara`)}
            </p>
            <Button
              onClick={handleAnalyze}
              disabled={!situation.trim() || isAnalyzing}
              className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
            >
              {isAnalyzing ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4m0 12v4m-7.071-3.929l2.828-2.828m8.486-8.486l2.828-2.828M2 12h4m12 0h4M4.929 4.929l2.828 2.828m8.486 8.486l2.828 2.828" />
                  </svg>
                  {t("Analyzing...", "Menganalisis...")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  {t("Analyze Case", "Analisis Kes")}
                </span>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {!result && !isAnalyzing && !error && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {t("Suggested Scenarios", "Senario Cadangan")}
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SUGGESTED_SCENARIOS.map((s, i) => (
              <Card
                key={i}
                className="cursor-pointer hover:border-secondary/40 transition-colors border-border/50"
                onClick={() => setSituation(mode === "bm" ? s.bm : s.en)}
              >
                <CardContent className="p-3">
                  <p className="text-xs text-foreground line-clamp-3">
                    {mode === "bm" ? s.bm : s.en}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {isAnalyzing && streamText && (
        <Card className="border-secondary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4m0 12v4m-7.071-3.929l2.828-2.828m8.486-8.486l2.828-2.828M2 12h4m12 0h4M4.929 4.929l2.828 2.828m8.486 8.486l2.828 2.828" />
              </svg>
              <span className="text-sm font-medium text-secondary">
                {t("AI is analyzing your case...", "AI sedang menganalisis kes anda...")}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/30 rounded-md p-3 max-h-40 overflow-y-auto">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{streamText.substring(0, 500)}...</pre>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setError("")}>
              {t("Dismiss", "Tutup")}
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          <Card className="border-secondary/30 bg-secondary/5">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-secondary mb-2">
                {t("Analysis Summary", "Ringkasan Analisis")}
              </h3>
              <p className="text-sm text-foreground leading-relaxed">{result.summary}</p>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="verses" className="text-xs">
                {t("Quran", "Al-Quran")}
                {result.quranicVerses?.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{result.quranicVerses.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="fatwas" className="text-xs">
                {t("Fatwas", "Fatwa")}
                {result.fatwas?.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{result.fatwas.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="provisions" className="text-xs">
                {t("Provisions", "Peruntukan")}
                {result.provisions?.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{result.provisions.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="cases" className="text-xs">
                {t("Cases", "Kes")}
                {result.cases?.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{result.cases.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="verses" className="space-y-3 mt-3">
              {result.quranicVerses?.map((v, i) => (
                <Card key={i} className="border-border/50 hover:border-secondary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs border-secondary/30 text-secondary">{v.reference}</Badge>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{v.relevance}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-secondary flex-shrink-0"
                        onClick={() => navigateTo("/quranic-verses", v.id)}
                      >
                        {t("View", "Lihat")}
                        <svg className="w-3 h-3 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7"/></svg>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!result.quranicVerses || result.quranicVerses.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">{t("No relevant Quranic verses found", "Tiada ayat Al-Quran berkaitan ditemui")}</p>
              )}
            </TabsContent>

            <TabsContent value="fatwas" className="space-y-3 mt-3">
              {result.fatwas?.map((f, i) => (
                <Card key={i} className="border-border/50 hover:border-secondary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-foreground mb-1">{f.title}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{f.relevance}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-secondary flex-shrink-0"
                        onClick={() => navigateTo("/fatwas", f.id)}
                      >
                        {t("View", "Lihat")}
                        <svg className="w-3 h-3 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7"/></svg>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!result.fatwas || result.fatwas.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">{t("No relevant fatwas found", "Tiada fatwa berkaitan ditemui")}</p>
              )}
            </TabsContent>

            <TabsContent value="provisions" className="space-y-3 mt-3">
              {result.provisions?.map((p, i) => (
                <Card key={i} className="border-border/50 hover:border-secondary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-foreground mb-1">{p.title}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">{p.relevance}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-secondary flex-shrink-0"
                        onClick={() => navigateTo("/provisions", p.id)}
                      >
                        {t("View", "Lihat")}
                        <svg className="w-3 h-3 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7"/></svg>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!result.provisions || result.provisions.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">{t("No relevant provisions found", "Tiada peruntukan berkaitan ditemui")}</p>
              )}
            </TabsContent>

            <TabsContent value="cases" className="space-y-3 mt-3">
              {result.cases?.map((c, i) => (
                <Card key={i} className="border-border/50 hover:border-secondary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-foreground mb-1">{c.caseName}</h4>
                        <Badge variant="outline" className="text-xs mb-2">{c.citation}</Badge>
                        <p className="text-sm text-muted-foreground leading-relaxed">{c.relevance}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-secondary flex-shrink-0"
                        onClick={() => navigateTo("/cases", c.id)}
                      >
                        {t("View", "Lihat")}
                        <svg className="w-3 h-3 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5l7 7-7 7"/></svg>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!result.cases || result.cases.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">{t("No relevant cases found", "Tiada kes berkaitan ditemui")}</p>
              )}
            </TabsContent>
          </Tabs>

          {result.practicalAdvice && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-primary mb-2">
                  {t("Practical Advice", "Nasihat Praktikal")}
                </h3>
                <p className="text-sm text-foreground leading-relaxed">{result.practicalAdvice}</p>
              </CardContent>
            </Card>
          )}

          {result.disclaimer && (
            <p className="text-xs text-muted-foreground italic text-center">{result.disclaimer}</p>
          )}

          <DraftDocument content={formatAnalyzerText(result, ts)} />
          <ExportActions content={formatAnalyzerText(result, ts)} filenameBase={ts("AI Cross-Reference Analysis", "Analisis Rujukan Silang AI")} />
          <SaveToMatterPanel
            draftTitle={ts("AI Cross-Reference Analysis", "Analisis Rujukan Silang AI")}
            draftContent={formatAnalyzerText(result, ts)}
            kind="analysis"
          />

          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => { setResult(null); setSituation(""); setStreamText(""); }}
            >
              {t("New Analysis", "Analisis Baharu")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
