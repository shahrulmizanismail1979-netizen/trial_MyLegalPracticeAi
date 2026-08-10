import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/lib/language-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";
import { consumeSse } from "@/lib/sse";

const API_BASE = "/api/sya";

const AREAS = [
  { id: "family-law", titleEn: "Islamic Family Law", titleBm: "Undang-Undang Keluarga Islam" },
  { id: "inheritance", titleEn: "Inheritance & Succession (Faraid/Wasiat/Hibah)", titleBm: "Pewarisan & Pusaka" },
  { id: "financial", titleEn: "Islamic Finance & Banking", titleBm: "Kewangan & Perbankan Islam" },
  { id: "criminal", titleEn: "Shariah Criminal Law", titleBm: "Undang-Undang Jenayah Syariah" },
  { id: "property", titleEn: "Islamic Property Law (Wakaf/Harta)", titleBm: "Undang-Undang Harta Islam" },
  { id: "procedure", titleEn: "Shariah Court Procedure", titleBm: "Tatacara Mahkamah Syariah" },
  { id: "constitutional", titleEn: "Constitutional Islamic Law", titleBm: "Perlembagaan Islam" },
  { id: "muamalat", titleEn: "Commercial Transactions (Muamalat)", titleBm: "Muamalat" },
  { id: "administration", titleEn: "Islamic Administration", titleBm: "Pentadbiran Islam" },
];

type ToolStatus = "idle" | "running" | "done" | "error";

interface ToolState {
  status: ToolStatus;
  output: string;
  error: string;
  abort?: AbortController;
}

const initialTool = (): ToolState => ({ status: "idle", output: "", error: "" });

export default function CaseWorkspacePage() {
  const { mode } = useLanguage();
  const t = (en: string, bm: string) => mode === "bm" ? bm : en;

  const [area, setArea] = useState("family-law");
  const [scenario, setScenario] = useState("");
  const [parties, setParties] = useState("");
  const [reliefSought, setReliefSought] = useState("");
  const [clientPosition, setClientPosition] = useState("");
  const [specificQuestions, setSpecificQuestions] = useState("");
  const [outputLang, setOutputLang] = useState<"en" | "bm">(mode === "bm" ? "bm" : "en");
  const [activeTab, setActiveTab] = useState<"analyzer" | "case-analysis" | "legal-opinion">("analyzer");

  const [analyzer, setAnalyzer] = useState<ToolState>(initialTool());
  const [caseAnalysis, setCaseAnalysis] = useState<ToolState>(initialTool());
  const [legalOpinion, setLegalOpinion] = useState<ToolState>(initialTool());

  const analyzerRef = useRef<AbortController | null>(null);
  const caseRef = useRef<AbortController | null>(null);
  const opinionRef = useRef<AbortController | null>(null);

  // Pre-fill scenario from sessionStorage (e.g., handed off from Client Intake)
  useEffect(() => {
    const seed = sessionStorage.getItem("caseWorkspaceSeed");
    if (!seed) return;
    sessionStorage.removeItem("caseWorkspaceSeed");
    try {
      const data = JSON.parse(seed);
      if (data.scenario) setScenario(data.scenario);
      if (data.parties) setParties(data.parties);
      if (data.reliefSought) setReliefSought(data.reliefSought);
      if (data.area && AREAS.find(a => a.id === data.area)) setArea(data.area);
      if (data.clientPosition) setClientPosition(data.clientPosition);
    } catch {}
  }, []);

  const stopAll = () => {
    analyzerRef.current?.abort();
    caseRef.current?.abort();
    opinionRef.current?.abort();
  };

  const runStream = async (
    setState: (updater: (s: ToolState) => ToolState) => void,
    abortRef: React.MutableRefObject<AbortController | null>,
    url: string,
    body: Record<string, unknown>,
  ) => {
    // Cancel any prior run for this tool, then claim the slot with our controller.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // All state writes inside this run must be guarded — if the slot has been
    // taken over by a newer run (abortRef.current !== controller), our writes
    // would clobber the newer run's state.
    const safeSet = (updater: (s: ToolState) => ToolState) => {
      if (controller.signal.aborted || abortRef.current !== controller) return;
      setState(updater);
    };
    safeSet(() => ({ status: "running", output: "", error: "" }));
    let full = "";
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      await consumeSse(res, {
        signal: controller.signal,
        onEvent: (e) => {
          if (typeof e.content === "string") {
            full += e.content;
            safeSet(() => ({ status: "running", output: full, error: "" }));
          }
        },
        onError: (msg) => safeSet((s) => ({ ...s, error: msg })),
      });
      safeSet((s) => ({ ...s, status: s.error ? "error" : "done" }));
    } catch (e: any) {
      if (e.name === "AbortError") {
        // Don't touch state on abort — the run that aborted us already set fresh state.
        return;
      }
      safeSet(() => ({ status: "error", output: full, error: e.message || "Failed" }));
    }
  };

  const runAnalyzer = () =>
    runStream(setAnalyzer, analyzerRef, `${API_BASE}/analyzer/analyze`, {
      situation: scenario,
      language: outputLang,
    });

  const runCaseAnalysis = () =>
    runStream(setCaseAnalysis, caseRef, `${API_BASE}/case-analysis/predict`, {
      caseType: AREAS.find(a => a.id === area)?.titleEn,
      facts: scenario,
      parties,
      reliefSought,
      language: outputLang,
    });

  const runLegalOpinion = () =>
    runStream(setLegalOpinion, opinionRef, `${API_BASE}/legal-opinion/generate`, {
      area,
      scenario,
      clientPosition,
      specificQuestions,
      language: outputLang,
    });

  const runAll = () => {
    if (!scenario.trim()) return;
    runAnalyzer();
    runCaseAnalysis();
    runLegalOpinion();
  };

  useEffect(() => stopAll, []);

  const tabBadge = (s: ToolState) => {
    if (s.status === "running") return <Badge className="ml-2 bg-amber-100 text-amber-700">…</Badge>;
    if (s.status === "done") return <Badge className="ml-2 bg-emerald-100 text-emerald-700">✓</Badge>;
    if (s.status === "error") return <Badge className="ml-2 bg-rose-100 text-rose-700">!</Badge>;
    return null;
  };

  // Best-effort pretty-rendering for analyzer/case-analysis JSON output
  const renderJsonOrText = (raw: string) => {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        return <pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-900/50 p-3 rounded border">{JSON.stringify(parsed, null, 2)}</pre>;
      } catch {
        // Stream may not be complete yet — fall through to raw text
      }
    }
    return <pre className="whitespace-pre-wrap text-sm">{raw}</pre>;
  };

  const anyRunning = analyzer.status === "running" || caseAnalysis.status === "running" || legalOpinion.status === "running";

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="case-workspace-title">
          {t("Case Workspace", "Ruang Kerja Kes")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t(
            "Type the facts of your case once. Get cross-references, precedent prediction, and a draft legal opinion in one place.",
            "Taipkan fakta kes anda sekali sahaja. Dapatkan rujukan silang, ramalan duluan, dan draf pendapat undang-undang serentak."
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2 h-fit">
          <CardHeader>
            <h2 className="font-semibold">{t("Case Facts", "Fakta Kes")}</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Area of Law", "Bidang Undang-Undang")}</label>
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger data-testid="cw-area"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AREAS.map(a => (
                    <SelectItem key={a.id} value={a.id}>{mode === "bm" ? a.titleBm : a.titleEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                {t("Facts / Scenario", "Fakta / Senario")} <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={scenario}
                onChange={e => setScenario(e.target.value)}
                placeholder={t(
                  "Describe the case facts in plain language…",
                  "Huraikan fakta kes dalam bahasa biasa…"
                )}
                className="min-h-32"
                data-testid="cw-scenario"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t("Parties", "Pihak-Pihak")}</label>
              <Input value={parties} onChange={e => setParties(e.target.value)} placeholder={t("e.g. Plaintiff: Ahmad bin Hassan; Defendant: Siti binti…", "cth. Plaintif: Ahmad bin Hassan; Defendan: Siti binti…")} data-testid="cw-parties" />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t("Relief Sought", "Relief Dipohon")}</label>
              <Input value={reliefSought} onChange={e => setReliefSought(e.target.value)} placeholder={t("e.g. Hadhanah of child; Fasakh; Mut'ah of RM…", "cth. Hadhanah anak; Fasakh; Mut'ah RM…")} data-testid="cw-relief" />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t("Your Client's Position", "Pendirian Klien Anda")}</label>
              <Textarea value={clientPosition} onChange={e => setClientPosition(e.target.value)} placeholder={t("How does your client see this matter?", "Bagaimana klien anda melihat perkara ini?")} className="min-h-16" data-testid="cw-position" />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t("Specific Legal Questions", "Soalan Undang-Undang Spesifik")}</label>
              <Textarea value={specificQuestions} onChange={e => setSpecificQuestions(e.target.value)} placeholder={t("e.g. Can a non-Muslim convert claim hadhanah?", "cth. Bolehkah saudara baru menuntut hadhanah?")} className="min-h-16" data-testid="cw-questions" />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t("Output Language", "Bahasa Output")}</label>
              <Select value={outputLang} onValueChange={v => setOutputLang(v as any)}>
                <SelectTrigger data-testid="cw-lang"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="bm">Bahasa Melayu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={runAll} disabled={!scenario.trim() || anyRunning} className="w-full" data-testid="cw-run-all">
                {anyRunning
                  ? t("Running…", "Sedang Jalan…")
                  : t("Run All Three Analyses", "Jalankan Ketiga-tiga Analisis")}
              </Button>
              {anyRunning && (
                <Button variant="outline" onClick={stopAll} data-testid="cw-stop">
                  {t("Stop", "Henti")}
                </Button>
              )}
              <p className="text-xs text-gray-500 italic">
                {t(
                  "Or open the tabs on the right and run them individually.",
                  "Atau buka tab di kanan dan jalankan satu per satu."
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 min-h-[600px]">
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
              <TabsList className="w-full grid grid-cols-3" data-testid="cw-tabs">
                <TabsTrigger value="analyzer" data-testid="cw-tab-analyzer">
                  {t("Cross-References", "Rujukan Silang")}{tabBadge(analyzer)}
                </TabsTrigger>
                <TabsTrigger value="case-analysis" data-testid="cw-tab-case">
                  {t("Precedent & Strength", "Duluan & Kekuatan")}{tabBadge(caseAnalysis)}
                </TabsTrigger>
                <TabsTrigger value="legal-opinion" data-testid="cw-tab-opinion">
                  {t("Legal Opinion", "Pendapat Undang-Undang")}{tabBadge(legalOpinion)}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="analyzer" className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t(
                      "Cross-references your facts against verses, fatwas, provisions, and case law in the database.",
                      "Merujuk silang fakta anda dengan ayat, fatwa, peruntukan, dan kes dalam pangkalan data."
                    )}
                  </p>
                  <Button size="sm" variant="outline" onClick={runAnalyzer} disabled={!scenario.trim() || analyzer.status === "running"} data-testid="cw-run-analyzer">
                    {analyzer.status === "running" ? t("Running…", "Berjalan…") : t("Run", "Jalankan")}
                  </Button>
                </div>
                {analyzer.error && <p className="text-sm text-red-600">{analyzer.error}</p>}
                <div data-testid="cw-output-analyzer">{renderJsonOrText(analyzer.output) || <p className="text-gray-400 italic text-sm">{t("Not yet run.", "Belum dijalankan.")}</p>}</div>
                {analyzer.output && analyzer.status !== "running" && (
                  <SaveToMatterPanel
                    draftTitle={t("AI Cross-Reference Analysis", "Analisis Rujukan Silang AI")}
                    draftContent={analyzer.output}
                    parties={parties || undefined}
                    kind="analysis"
                    matterType={AREAS.find(a => a.id === area)?.titleEn || undefined}
                  />
                )}
              </TabsContent>

              <TabsContent value="case-analysis" className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t(
                      "Identifies similar precedent cases and assesses strength + likely outcome.",
                      "Mengenal pasti kes duluan serupa dan menilai kekuatan + kemungkinan keputusan."
                    )}
                  </p>
                  <Button size="sm" variant="outline" onClick={runCaseAnalysis} disabled={!scenario.trim() || caseAnalysis.status === "running"} data-testid="cw-run-case">
                    {caseAnalysis.status === "running" ? t("Running…", "Berjalan…") : t("Run", "Jalankan")}
                  </Button>
                </div>
                {caseAnalysis.error && <p className="text-sm text-red-600">{caseAnalysis.error}</p>}
                <div data-testid="cw-output-case">{renderJsonOrText(caseAnalysis.output) || <p className="text-gray-400 italic text-sm">{t("Not yet run.", "Belum dijalankan.")}</p>}</div>
                {caseAnalysis.output && caseAnalysis.status !== "running" && (
                  <SaveToMatterPanel
                    draftTitle={t("Case Analysis & Prediction", "Analisis & Ramalan Kes")}
                    draftContent={caseAnalysis.output}
                    parties={parties || undefined}
                    kind="analysis"
                    matterType={AREAS.find(a => a.id === area)?.titleEn || undefined}
                  />
                )}
              </TabsContent>

              <TabsContent value="legal-opinion" className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t(
                      "Drafts a formal Pendapat Undang-Undang citing the database and addressing your specific questions.",
                      "Menyiapkan draf Pendapat Undang-Undang formal yang merujuk pangkalan data dan soalan spesifik anda."
                    )}
                  </p>
                  <Button size="sm" variant="outline" onClick={runLegalOpinion} disabled={!scenario.trim() || legalOpinion.status === "running"} data-testid="cw-run-opinion">
                    {legalOpinion.status === "running" ? t("Running…", "Berjalan…") : t("Run", "Jalankan")}
                  </Button>
                </div>
                {legalOpinion.error && <p className="text-sm text-red-600">{legalOpinion.error}</p>}
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap" data-testid="cw-output-opinion">
                  {legalOpinion.output || <p className="text-gray-400 italic text-sm">{t("Not yet run.", "Belum dijalankan.")}</p>}
                </div>
                {legalOpinion.output && legalOpinion.status !== "running" && (
                  <SaveToMatterPanel
                    draftTitle={t("Legal Opinion", "Pendapat Undang-Undang")}
                    draftContent={legalOpinion.output}
                    parties={parties || undefined}
                    kind="opinion"
                    matterType={AREAS.find(a => a.id === area)?.titleEn || undefined}
                  />
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
