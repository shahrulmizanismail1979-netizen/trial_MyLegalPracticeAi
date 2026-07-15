import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { tierHasFeature } from "@/lib/tiers";
import UpgradePrompt from "@/components/upgrade-prompt";
import ExportActions from "@/components/export-actions";
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

const API_BASE = "/api/sya";

export default function LegalOpinionPage() {
  const { user } = useAuth();
  if (!tierHasFeature(user?.tier, "aiToolkit")) {
    return (
      <UpgradePrompt
        requiredTier="professional"
        featureName="Legal Opinion Writer"
        featureNameBm="Penulis Pendapat Undang-undang"
      />
    );
  }
  return <LegalOpinionPageInner />;
}

function LegalOpinionPageInner() {
  const { mode } = useLanguage();
  const t = (en: string, bm: string) => mode === "bm" ? bm : en;

  const [area, setArea] = useState("");
  const [scenario, setScenario] = useState("");
  const [clientPosition, setClientPosition] = useState("");
  const [specificQuestions, setSpecificQuestions] = useState("");
  const [opinionLang, setOpinionLang] = useState("bm");
  const [generating, setGenerating] = useState(false);
  const [generatedOpinion, setGeneratedOpinion] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const { data: areas } = useQuery({
    queryKey: ["opinion-areas"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/legal-opinion/areas`, { credentials: "include" });
      return res.json();
    },
  });

  const handleGenerate = async () => {
    if (!scenario.trim()) return;
    setGenerating(true);
    setError("");
    setGeneratedOpinion("");

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/legal-opinion/generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, scenario, clientPosition, specificQuestions, language: opinionLang }),
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
              if (data.content) { fullText += data.content; setGeneratedOpinion(fullText); }
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


  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">{t("Legal Opinion Writer", "Penulis Pendapat Undang-Undang")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("AI-powered structured legal opinion drafting with full citations", "Penulisan pendapat undang-undang berstruktur berkuasa AI dengan petikan lengkap")}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><h2 className="font-serif font-semibold text-foreground">{t("Opinion Parameters", "Parameter Pendapat")}</h2></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Area of Law", "Bidang Undang-Undang")}</label>
                <Select value={area} onValueChange={setArea}>
                  <SelectTrigger><SelectValue placeholder={t("Select area", "Pilih bidang")} /></SelectTrigger>
                  <SelectContent>
                    {areas?.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>{mode === "bm" ? a.titleBm : a.titleEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Output Language", "Bahasa Output")}</label>
                <Select value={opinionLang} onValueChange={setOpinionLang}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bm">Bahasa Melayu</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Scenario / Facts", "Senario / Fakta")} *</label>
                <textarea
                  value={scenario}
                  onChange={e => setScenario(e.target.value)}
                  rows={6}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={t(
                    "Describe the full factual scenario requiring legal opinion. Include: parties involved, timeline, specific circumstances, any prior proceedings...",
                    "Huraikan senario fakta penuh yang memerlukan pendapat undang-undang. Sertakan: pihak-pihak terlibat, garis masa, keadaan khusus, prosiding terdahulu..."
                  )}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Client's Position (optional)", "Pendirian Klien (pilihan)")}</label>
                <textarea
                  value={clientPosition}
                  onChange={e => setClientPosition(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={t("What is the client seeking or arguing?", "Apa yang dimohon atau dihujahkan oleh klien?")}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{t("Specific Questions (optional)", "Soalan Khusus (pilihan)")}</label>
                <textarea
                  value={specificQuestions}
                  onChange={e => setSpecificQuestions(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder={t("Any specific legal questions you need addressed?", "Sebarang soalan undang-undang khusus yang perlu dijawab?")}
                />
              </div>
              <Button onClick={handleGenerate} disabled={generating || !scenario.trim()} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                {generating ? t("Generating Opinion...", "Menjana Pendapat...") : t("Generate Legal Opinion", "Jana Pendapat Undang-Undang")}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          {error && <Card className="border-destructive/30 mb-4"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

          {generatedOpinion ? (
            <Card className="border-secondary/30">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3">
                  <h2 className="font-serif font-semibold text-secondary">{t("Legal Opinion", "Pendapat Undang-Undang")}</h2>
                  <ExportActions content={generatedOpinion} filenameBase={t("Legal Opinion", "Pendapat Undang-Undang")} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-white/5 rounded-lg p-4 prose prose-sm prose-invert max-w-none overflow-auto max-h-[75vh]">
                  <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">{generatedOpinion}</pre>
                </div>
                <p className="text-xs text-muted-foreground italic mt-3">
                  {t("AI-generated legal opinion. Must be reviewed and verified by qualified counsel before use.", "Pendapat undang-undang dijana AI. Mesti disemak dan disahkan oleh peguam berkelayakan sebelum digunakan.")}
                </p>
              </CardContent>
            </Card>
          ) : generating ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center animate-pulse">
                <svg className="w-7 h-7 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </div>
              <p className="text-sm text-muted-foreground">{t("AI is drafting your legal opinion with full citations...", "AI sedang merangka pendapat undang-undang anda dengan petikan lengkap...")}</p>
            </div>
          ) : (
            <Card className="border-dashed border-border/50">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-secondary/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <h3 className="font-serif font-semibold text-foreground mb-2">{t("AI Legal Opinion", "Pendapat Undang-Undang AI")}</h3>
                <p className="text-sm text-muted-foreground">{t("Describe a legal scenario and the AI will generate a formal legal opinion with proper structure, citations to Malaysian Shariah legislation, case law, fatwas, and Quranic references.", "Huraikan senario undang-undang dan AI akan menjana pendapat undang-undang rasmi dengan struktur yang betul, petikan perundangan Syariah Malaysia, kes undang-undang, fatwa, dan rujukan Al-Quran.")}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
