import { aiStreamFetch } from "@/lib/ai-stream-fetch";
import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { tierHasFeature } from "@/lib/tiers";
import UpgradePrompt from "@/components/upgrade-prompt";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { consumeSse } from "@/lib/sse";
import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";

const API_BASE = "/api/sya";

interface Surah {
  number: number;
  nameEn: string;
  nameBm: string;
  nameAr: string;
  ayahCount: number;
  revelation: "Makki" | "Madani";
}

export default function TafsirPage() {
  const { user } = useAuth();
  if (!tierHasFeature(user?.tier, "tafsir")) {
    return (
      <UpgradePrompt
        requiredTier="premium"
        featureName="AI Tafsir Al-Quran"
        featureNameBm="AI Tafsir Al-Quran"
      />
    );
  }
  return <TafsirPageInner />;
}

function TafsirPageInner() {
  const { mode } = useLanguage();
  const t = (en: string, bm: string, ar?: string) => mode === "bm" ? bm : mode === "ar" && ar ? ar : en;
  const isAr = mode === "ar";

  const [surah, setSurah] = useState<number>(1);
  const [ayah, setAyah] = useState<number>(1);
  const [tafsirLang, setTafsirLang] = useState<"en" | "bm" | "ar">(mode === "ar" ? "en" : (mode as "en" | "bm"));
  const [focus, setFocus] = useState("comprehensive");
  const [search, setSearch] = useState("");
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const { data: surahs } = useQuery<Surah[]>({
    queryKey: ["tafsir-surahs"],
    queryFn: async () => {
      const r = await aiStreamFetch(`${API_BASE}/tafsir/surahs`, { credentials: "include" });
      return r.json();
    },
  });

  const filteredSurahs = useMemo(() => {
    if (!surahs) return [];
    const q = search.trim().toLowerCase();
    if (!q) return surahs;
    return surahs.filter(s =>
      String(s.number).startsWith(q) ||
      s.nameEn.toLowerCase().includes(q) ||
      s.nameBm.toLowerCase().includes(q) ||
      s.nameAr.includes(q)
    );
  }, [surahs, search]);

  const currentSurah = surahs?.find(s => s.number === surah);

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    setOutput("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await aiStreamFetch(`${API_BASE}/tafsir/generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surah, ayah, language: tafsirLang, focus }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      let full = "";
      await consumeSse(res, {
        signal: controller.signal,
        onEvent: (d) => {
          if (typeof d.content === "string") {
            full += d.content;
            setOutput(full);
          }
        },
        onError: (msg) => setError(msg),
      });
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message || "Failed");
    } finally {
      setGenerating(false);
    }
  };

  const isRtl = tafsirLang === "ar";

  return (
    <div className={`p-6 max-w-7xl mx-auto ${isAr ? "rtl" : ""}`} dir={isAr ? "rtl" : "ltr"}>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="tafsir-title">
          {t("AI Tafsir Al-Quran", "Tafsir AI Al-Quran", "تفسير القرآن بالذكاء الاصطناعي")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t(
            "Scholarly tafsir for any ayah, drawing on al-Tabari, Ibn Kathir, al-Qurtubi, al-Razi, al-Jalalayn, and Tafsir Pimpinan Ar-Rahman.",
            "Tafsir ilmiah untuk mana-mana ayat, berdasarkan al-Tabari, Ibn Kathir, al-Qurtubi, al-Razi, al-Jalalayn, dan Tafsir Pimpinan Ar-Rahman.",
            "تفسير علمي لأي آية، مستند إلى الطبري وابن كثير والقرطبي والرازي والجلالين."
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <h2 className="font-semibold text-lg">{t("Select Ayah", "Pilih Ayat", "اختر الآية")}</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Search Surah", "Cari Surah", "ابحث عن سورة")}</label>
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t("Number, name (Al-Baqarah, البقرة)", "Nombor, nama (Al-Baqarah, البقرة)", "الرقم أو الاسم")}
                data-testid="tafsir-surah-search"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t("Surah", "Surah", "السورة")}</label>
              <Select value={String(surah)} onValueChange={v => { setSurah(Number(v)); setAyah(1); }}>
                <SelectTrigger data-testid="tafsir-surah-select"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {filteredSurahs.map(s => (
                    <SelectItem key={s.number} value={String(s.number)}>
                      {s.number}. {s.nameEn} — {s.nameAr} ({s.ayahCount} {t("ayat", "ayat", "آية")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                {t("Ayah", "Ayat", "الآية")} {currentSurah && <span className="text-gray-400">(1–{currentSurah.ayahCount})</span>}
              </label>
              <Input
                type="number"
                min={1}
                max={currentSurah?.ayahCount ?? 1}
                value={ayah}
                onChange={e => setAyah(Math.max(1, Math.min(currentSurah?.ayahCount ?? 1, Number(e.target.value) || 1)))}
                data-testid="tafsir-ayah-input"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t("Tafsir Language", "Bahasa Tafsir", "لغة التفسير")}</label>
              <Select value={tafsirLang} onValueChange={v => setTafsirLang(v as any)}>
                <SelectTrigger data-testid="tafsir-lang-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="bm">Bahasa Melayu</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">{t("Focus", "Fokus", "التركيز")}</label>
              <Select value={focus} onValueChange={setFocus}>
                <SelectTrigger data-testid="tafsir-focus-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comprehensive">{t("Comprehensive", "Menyeluruh", "شامل")}</SelectItem>
                  <SelectItem value="ahkam">{t("Ahkam (Legal Rulings)", "Ahkam (Hukum)", "الأحكام")}</SelectItem>
                  <SelectItem value="linguistic">{t("Linguistic & Balaghah", "Bahasa & Balaghah", "اللغة والبلاغة")}</SelectItem>
                  <SelectItem value="asbab">{t("Asbab al-Nuzul", "Asbab al-Nuzul", "أسباب النزول")}</SelectItem>
                  <SelectItem value="malaysia">{t("Malaysian Application", "Aplikasi Malaysia", "التطبيق الماليزي")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={generating || !surah || !ayah}
              data-testid="tafsir-generate-btn"
            >
              {generating
                ? t("Generating...", "Menjana...", "جاري الإنشاء...")
                : t("Generate Tafsir", "Jana Tafsir", "إنشاء التفسير")}
            </Button>
            {error && <p className="text-sm text-red-600" data-testid="tafsir-error">{error}</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 min-h-[500px]">
          <CardHeader className="flex flex-row items-center gap-2 flex-wrap">
            {currentSurah && (
              <>
                <h2 className="font-semibold text-lg">
                  {currentSurah.nameEn} ({currentSurah.nameAr}) {surah}:{ayah}
                </h2>
                <Badge variant="outline">{currentSurah.revelation}</Badge>
              </>
            )}
          </CardHeader>
          <CardContent>
            {!output && !generating && (
              <p className="text-gray-500 italic">
                {t(
                  "Pick a surah and ayah on the left, then generate. The tafsir will stream in here.",
                  "Pilih surah dan ayat di sebelah kiri, kemudian jana. Tafsir akan dipancarkan di sini.",
                  "اختر سورة وآية على اليسار، ثم انشئ التفسير."
                )}
              </p>
            )}
            <div
              className={`${isRtl ? "rtl text-right" : ""}`}
              dir={isRtl ? "rtl" : "ltr"}
              data-testid="tafsir-output"
            >
              {output && !generating && !error && <DraftExportButtons title="Tafsir Analysis" content={output} hideMarkdown />}
              {output && <DraftDocument content={output} />}
              {generating && <span className="animate-pulse text-emerald-600">▋</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
