import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { tierHasFeature } from "@/lib/tiers";
import UpgradePrompt from "@/components/upgrade-prompt";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const API_BASE = "/api/sya";

const FALLBACK_SAMPLE_QUESTIONS: Array<{ en: string; bm: string; ar: string }> = [
  {
    en: "What is the ruling on fasakh according to Mughni al-Muhtaj when a husband is mafqud (missing)?",
    bm: "Apakah hukum fasakh menurut Mughni al-Muhtaj apabila suami mafqud (hilang)?",
    ar: "ما حكم الفسخ عند مغني المحتاج إذا كان الزوج مفقوداً؟",
  },
  {
    en: "What are the conditions for valid hibah in Shafi'i fiqh as applied in Malaysian estate planning?",
    bm: "Apakah syarat-syarat hibah yang sah dalam fiqh Syafi'i seperti dipakai dalam perancangan harta Malaysia?",
    ar: "ما شروط صحة الهبة في الفقه الشافعي كما تطبق في التخطيط العقاري الماليزي؟",
  },
  {
    en: "How does Sabil al-Muhtadin treat zakat al-mal for monthly salaried employees?",
    bm: "Bagaimana Sabil al-Muhtadin menangani zakat al-mal untuk pekerja bergaji bulanan?",
    ar: "كيف يتناول سبيل المهتدين زكاة المال للموظفين بالراتب الشهري؟",
  },
  {
    en: "Compare the four schools' positions on triple talaq using the Mawsu'ah Fiqhiyyah Kuwaitiyyah",
    bm: "Bandingkan pendirian empat mazhab tentang talaq tiga sekaligus menggunakan Mawsu'ah Fiqhiyyah Kuwaitiyyah",
    ar: "قارن مواقف المذاهب الأربعة من الطلاق بالثلاث باستخدام الموسوعة الفقهية الكويتية",
  },
  {
    en: "What does AAOIFI Shariah Standards say about tawarruq munazzam in Malaysian Islamic banking?",
    bm: "Apakah pandangan Piawaian Syariah AAOIFI tentang tawarruq munazzam dalam perbankan Islam Malaysia?",
    ar: "ما موقف معايير أيوفي من التورق المنظم في المصرفية الإسلامية الماليزية؟",
  },
  {
    en: "How does Al-Furuq distinguish between a binding fatwa and a Shariah court judgment?",
    bm: "Bagaimana Al-Furuq membezakan antara fatwa yang mengikat dan penghakiman Mahkamah Syariah?",
    ar: "كيف يفرق الفروق بين الفتوى الملزمة وحكم المحكمة الشرعية؟",
  },
];

export default function KitabPage() {
  const { user } = useAuth();
  if (!tierHasFeature(user?.tier, "kitab")) {
    return (
      <UpgradePrompt
        requiredTier="premium"
        featureName="Kitab Reference & Analysis"
        featureNameBm="Rujukan & Analisis Kitab"
      />
    );
  }
  return <KitabPageInner />;
}

function KitabPageInner() {
  const { mode, ts } = useLanguage();
  const t = (en: string, bm: string, ar?: string) => ts(en, bm, ar);

  const [selectedKitab, setSelectedKitab] = useState<number[]>([]);
  const [query, setQuery] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [expandedKitab, setExpandedKitab] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: kitabList } = useQuery({
    queryKey: ["kitab-list"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/kitab/list`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: kitabDetail } = useQuery({
    queryKey: ["kitab-detail", expandedKitab],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/kitab/${expandedKitab}`, { credentials: "include" });
      return res.json();
    },
    enabled: !!expandedKitab,
  });

  const sampleQuestions = useMemo(() => {
    const fromKitab: Array<{ en: string; bm: string; ar: string }> = [];
    if (Array.isArray(kitabList)) {
      for (const k of kitabList) {
        if (Array.isArray(k.sampleQuestions)) {
          for (const q of k.sampleQuestions) {
            if (typeof q === "string" && q.length > 0) {
              fromKitab.push({ en: q, bm: q, ar: q });
            }
          }
        }
      }
    }
    return [...FALLBACK_SAMPLE_QUESTIONS, ...fromKitab].slice(0, 12);
  }, [kitabList]);

  const toggleKitab = (id: number) => {
    setSelectedKitab(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]);
  };

  const handleAnalyze = async () => {
    if (!query.trim()) return;
    setAnalyzing(true);
    setError("");
    setResult(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/kitab/analyze`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, kitabIds: selectedKitab.length > 0 ? selectedKitab : undefined, language: mode }),
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

  const categoryColors: Record<string, string> = {
    "Primary Fiqh Reference": "bg-emerald-900/30 text-emerald-400 border-emerald-800",
    "Essential Study Text": "bg-blue-900/30 text-blue-400 border-blue-800",
    "Commentary (Hashiyah)": "bg-violet-900/30 text-violet-400 border-violet-800",
    "Modern Encyclopedic Reference": "bg-amber-900/30 text-amber-400 border-amber-800",
    "Fatwa Collection": "bg-pink-900/30 text-pink-400 border-pink-800",
    "Foundational Text": "bg-red-900/30 text-red-400 border-red-800",
    "Intermediate Study Text": "bg-cyan-900/30 text-cyan-400 border-cyan-800",
    "Teaching Text": "bg-teal-900/30 text-teal-400 border-teal-800",
    "Legal Maxims (Qawa'id Fiqhiyyah)": "bg-orange-900/30 text-orange-400 border-orange-800",
    "Classical Fiqh Text": "bg-indigo-900/30 text-indigo-400 border-indigo-800",
    "Foundational Malay-Jawi Shafi'i Text": "bg-yellow-900/30 text-yellow-400 border-yellow-800",
    "Foundational Malay-Jawi Pondok Text": "bg-yellow-900/30 text-yellow-400 border-yellow-800",
    "Intermediate Shafi'i Reference": "bg-cyan-900/30 text-cyan-400 border-cyan-800",
    "Advanced Shafi'i Hashiyah": "bg-violet-900/30 text-violet-400 border-violet-800",
    "Modern Shafi'i Teaching Text": "bg-blue-900/30 text-blue-400 border-blue-800",
    "Legal Distinctions (Furuq)": "bg-orange-900/30 text-orange-400 border-orange-800",
    "Official Malaysian Tafsir": "bg-emerald-900/30 text-emerald-400 border-emerald-800",
    "Malaysian Judicial Practice Guideline": "bg-rose-900/30 text-rose-400 border-rose-800",
    "Maliki Primary Source": "bg-purple-900/30 text-purple-400 border-purple-800",
    "Hanafi Reference": "bg-purple-900/30 text-purple-400 border-purple-800",
    "Hanbali Comparative Reference": "bg-purple-900/30 text-purple-400 border-purple-800",
    "Usul al-Fiqh / Maqasid": "bg-orange-900/30 text-orange-400 border-orange-800",
    "Fatwa Methodology": "bg-pink-900/30 text-pink-400 border-pink-800",
    "Primary Hadith Source": "bg-red-900/30 text-red-400 border-red-800",
    "Hadith Commentary": "bg-red-900/30 text-red-400 border-red-800",
    "Hadith-Fiqh Commentary": "bg-red-900/30 text-red-400 border-red-800",
    "Contemporary Islamic Finance Standard": "bg-amber-900/30 text-amber-400 border-amber-800",
    "Malaysian Authoritative Resolution": "bg-rose-900/30 text-rose-400 border-rose-800",
    "Foundational Pondok Text": "bg-yellow-900/30 text-yellow-400 border-yellow-800",
    "Foundational Usul al-Fiqh": "bg-orange-900/30 text-orange-400 border-orange-800",
    "Comparative Reference": "bg-purple-900/30 text-purple-400 border-purple-800",
    "Encyclopedic Commentary": "bg-amber-900/30 text-amber-400 border-amber-800",
    "Introductory Study Text": "bg-cyan-900/30 text-cyan-400 border-cyan-800",
  };

  const getSample = (s: { en: string; bm: string; ar: string }) =>
    mode === "ar" ? s.ar : mode === "bm" ? s.bm : s.en;

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">{t("Kitab Reference & Analysis", "Rujukan & Analisis Kitab", "مرجع الكتب والتحليل")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t(
          "Classical Arabic & Malay-Jawi legal texts used by Malaysian Shariah practitioners with AI-powered analysis",
          "Kitab undang-undang Arab klasik dan Melayu-Jawi yang digunakan oleh pengamal Syariah Malaysia dengan analisis berkuasa AI",
          "نصوص قانونية كلاسيكية باللغة العربية والمالاوية-الجاوية يستخدمها ممارسو الشريعة في ماليزيا مع تحليل بالذكاء الاصطناعي"
        )}</p>
        {kitabList && (
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            <span className="px-2 py-1 rounded-full bg-secondary/10 border border-secondary/30 text-secondary">
              {t(`${kitabList.length} kitab in library`, `${kitabList.length} kitab dalam perpustakaan`, `${kitabList.length} كتاب في المكتبة`)}
            </span>
            <span className="px-2 py-1 rounded-full bg-yellow-900/20 border border-yellow-800/40 text-yellow-400">
              {t("Includes Malay-Jawi Pondok texts", "Termasuk teks Pondok Melayu-Jawi", "تشمل نصوص الفندق الملاوية-الجاوية")}
            </span>
            <span className="px-2 py-1 rounded-full bg-rose-900/20 border border-rose-800/40 text-rose-400">
              {t("Malaysian official references", "Rujukan rasmi Malaysia", "مراجع ماليزية رسمية")}
            </span>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <h2 className="font-serif font-semibold text-foreground">{t("Kitab Library", "Perpustakaan Kitab", "مكتبة الكتب")}</h2>
              <p className="text-xs text-muted-foreground">{t("Select kitab to focus analysis (optional)", "Pilih kitab untuk fokus analisis (pilihan)", "اختر كتباً لتركيز التحليل (اختياري)")}</p>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
              {kitabList?.map((k: any) => (
                <div key={k.id}>
                  <div
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedKitab.includes(k.id) ? "border-secondary bg-secondary/5" : "border-border/50 hover:border-secondary/30"}`}
                    onClick={() => toggleKitab(k.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-arabic text-secondary leading-relaxed" dir="rtl">{k.titleArabic}</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">{k.titleTranslit}</p>
                        <p className="text-xs text-muted-foreground">{k.author}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge className={`text-xs ${categoryColors[k.category] || "bg-muted"}`}>{k.category}</Badge>
                          <span className="text-xs text-muted-foreground">{k.school} | {k.volumes} vol.</span>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center ${selectedKitab.includes(k.id) ? "border-secondary bg-secondary" : "border-border"}`}>
                        {selectedKitab.includes(k.id) && <svg className="w-3 h-3 text-secondary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs mt-2 h-6 px-2" onClick={e => { e.stopPropagation(); setExpandedKitab(expandedKitab === k.id ? null : k.id); }}>
                      {expandedKitab === k.id ? t("Hide details", "Sembunyikan", "إخفاء التفاصيل") : t("View details", "Lihat butiran", "عرض التفاصيل")}
                    </Button>
                  </div>
                  {expandedKitab === k.id && kitabDetail && (
                    <div className="ml-3 mt-1 p-3 bg-muted/20 rounded-lg text-xs space-y-2">
                      <p className="text-foreground">{kitabDetail.description}</p>
                      <div>
                        <span className="font-semibold text-secondary">{t("Relevance to Malaysia:", "Kaitan dengan Malaysia:", "الصلة بماليزيا:")}</span>
                        <p className="text-muted-foreground mt-0.5">{kitabDetail.relevanceToMalaysia}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-secondary">{t("Key Topics:", "Topik Utama:", "المواضيع الرئيسية:")}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {kitabDetail.keyTopics?.map((topic: string, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">{topic}</Badge>
                          ))}
                        </div>
                      </div>
                      {Array.isArray(kitabDetail.notableRulings) && kitabDetail.notableRulings.length > 0 && (
                        <div>
                          <span className="font-semibold text-secondary">{t("Notable rulings & Malaysian application:", "Hukum penting & pemakaian di Malaysia:", "الأحكام البارزة وتطبيقها في ماليزيا:")}</span>
                          <ul className="list-disc list-inside space-y-1 mt-1 text-foreground">
                            {kitabDetail.notableRulings.map((r: string, i: number) => (
                              <li key={i} className="leading-relaxed">{r}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {Array.isArray(kitabDetail.sampleQuestions) && kitabDetail.sampleQuestions.length > 0 && (
                        <div>
                          <span className="font-semibold text-secondary">{t("Sample questions:", "Contoh soalan:", "أسئلة نموذجية:")}</span>
                          <div className="space-y-1 mt-1">
                            {kitabDetail.sampleQuestions.map((q: string, i: number) => (
                              <button
                                key={i}
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setQuery(q); setSelectedKitab([k.id]); }}
                                className="block w-full text-left text-xs italic text-foreground hover:text-secondary hover:underline"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <label className="text-sm font-medium text-foreground block">{t(
                "Ask about Islamic legal rulings from the kitab",
                "Tanya tentang hukum undang-undang Islam daripada kitab",
                "اسأل عن الأحكام الشرعية من الكتب"
              )}</label>
              <textarea
                value={query}
                onChange={e => setQuery(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder={t(
                  "e.g. What is the ruling on fasakh according to Mughni al-Muhtaj? What are the conditions for valid hibah in Shafi'i fiqh?",
                  "cth: Apakah hukum fasakh menurut Mughni al-Muhtaj? Apakah syarat-syarat hibah yang sah dalam fiqh Syafie?",
                  "مثال: ما حكم الفسخ عند مغني المحتاج؟ ما شروط صحة الهبة في الفقه الشافعي؟"
                )}
              />
              {selectedKitab.length > 0 && (
                <p className="text-xs text-secondary">{t(`Focused on ${selectedKitab.length} selected kitab`, `Tertumpu pada ${selectedKitab.length} kitab terpilih`, `مركّز على ${selectedKitab.length} كتاب مختار`)}</p>
              )}
              <Button onClick={handleAnalyze} disabled={analyzing || !query.trim()} className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground">
                {analyzing ? t("Analyzing Kitab...", "Menganalisis Kitab...", "يتم تحليل الكتاب...") : t("Analyze with AI", "Analisis dengan AI", "حلّل بالذكاء الاصطناعي")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h3 className="text-sm font-serif font-semibold text-foreground">{t("Sample questions to try", "Contoh soalan untuk dicuba", "أسئلة نموذجية للتجربة")}</h3>
              <p className="text-xs text-muted-foreground">{t("Tap any question to load it", "Ketik mana-mana soalan untuk memuatkannya", "اضغط على أي سؤال لتحميله")}</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {sampleQuestions.map((s, i) => {
                const text = typeof (s as any).en === "string" ? getSample(s as any) : (s as any);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setQuery(text)}
                    className="block w-full text-left text-xs p-2 rounded-md border border-border/50 hover:border-secondary/40 hover:bg-secondary/5 transition-colors text-foreground"
                  >
                    {text}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {error && <Card className="border-destructive/30"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

          {analyzing && (
            <div className="text-center py-12">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center animate-pulse">
                <svg className="w-7 h-7 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              <p className="text-sm text-muted-foreground">{t("AI is analyzing classical kitab references...", "AI sedang menganalisis rujukan kitab klasik...", "يقوم الذكاء الاصطناعي بتحليل المراجع الكلاسيكية...")}</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <Card className="border-secondary/30">
                <CardHeader className="pb-3"><h3 className="font-serif font-semibold text-secondary">{t("Analysis", "Analisis", "التحليل")}</h3></CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground leading-relaxed">{result.analysis}</p>
                </CardContent>
              </Card>

              {result.kitabReferences?.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><h3 className="font-serif font-semibold text-foreground">{t("Kitab References", "Rujukan Kitab", "مراجع الكتب")}</h3></CardHeader>
                  <CardContent className="space-y-3">
                    {result.kitabReferences.map((kr: any, i: number) => (
                      <div key={i} className="border border-border/50 rounded-lg p-3">
                        <h4 className="text-sm font-semibold text-secondary">{kr.title}</h4>
                        {kr.relevantChapter && <p className="text-xs text-muted-foreground">{t("Chapter", "Bab", "الباب")}: {kr.relevantChapter}</p>}
                        <p className="text-sm text-foreground mt-1">{kr.position}</p>
                        {kr.arabicExcerpt && (
                          <div className="mt-2 bg-muted/20 rounded p-2">
                            <p className="text-base font-arabic text-secondary text-right leading-relaxed" dir="rtl">{kr.arabicExcerpt}</p>
                            {kr.translation && <p className="text-xs text-muted-foreground mt-1 italic">{kr.translation}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {result.legalMaxims?.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><h3 className="font-serif font-semibold text-foreground">{t("Legal Maxims (Qawa'id Fiqhiyyah)", "Kaedah Fiqhiyyah", "القواعد الفقهية")}</h3></CardHeader>
                  <CardContent className="space-y-3">
                    {result.legalMaxims.map((lm: any, i: number) => (
                      <div key={i} className="border border-secondary/20 bg-secondary/5 rounded-lg p-3">
                        <p className="text-lg font-arabic text-secondary text-right leading-relaxed" dir="rtl">{lm.arabic}</p>
                        <p className="text-sm font-medium text-foreground mt-1">{lm.transliteration}</p>
                        <p className="text-sm text-muted-foreground">{lm.translation}</p>
                        <p className="text-xs text-muted-foreground mt-1 italic">{lm.application}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {result.modernApplication && (
                <Card>
                  <CardHeader className="pb-3"><h3 className="font-serif font-semibold text-foreground">{t("Modern Application in Malaysia", "Pemakaian Moden di Malaysia", "التطبيق المعاصر في ماليزيا")}</h3></CardHeader>
                  <CardContent><p className="text-sm text-foreground leading-relaxed">{result.modernApplication}</p></CardContent>
                </Card>
              )}

              {result.practicalGuidance && (
                <Card className="bg-secondary/5 border-secondary/20">
                  <CardHeader className="pb-3"><h3 className="font-serif font-semibold text-secondary">{t("Practical Guidance", "Panduan Praktikal", "التوجيه العملي")}</h3></CardHeader>
                  <CardContent><p className="text-sm text-foreground leading-relaxed">{result.practicalGuidance}</p></CardContent>
                </Card>
              )}

              <Card className="bg-muted/20">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground italic">
                    {t(
                      "AI-generated analysis based on kitab knowledge. Verify all citations against original texts.",
                      "Analisis dijana AI berdasarkan pengetahuan kitab. Sahkan semua petikan terhadap teks asal.",
                      "تحليل مُولَّد بالذكاء الاصطناعي بناءً على معرفة الكتب. تحقق من جميع المراجع مقابل النصوص الأصلية."
                    )}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {!result && !analyzing && !error && (
            <Card className="border-dashed border-border/50">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-secondary/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                </div>
                <h3 className="font-serif font-semibold text-foreground mb-2">{t("Kitab Analysis", "Analisis Kitab", "تحليل الكتب")}</h3>
                <p className="text-sm text-muted-foreground">{t(
                  `Ask any question about Islamic legal rulings. AI analyzes ${kitabList?.length || 44} authoritative texts spanning classical Arabic Shafi'i references, Malay-Jawi Nusantara works (Sabil al-Muhtadin, Hidayat al-Salikin, Furu' al-Masa'il, Bughyat al-Tullab), comparative four-school sources, the Mawsu'ah Fiqhiyyah Kuwaitiyyah, AAOIFI Shariah Standards, BNM SAC resolutions, JKSM judicial guidelines and more.`,
                  `Tanya sebarang soalan tentang hukum undang-undang Islam. AI menganalisis ${kitabList?.length || 44} teks berautoriti merangkumi rujukan Syafi'i Arab klasik, karya Melayu-Jawi Nusantara (Sabil al-Muhtadin, Hidayat al-Salikin, Furu' al-Masa'il, Bughyat al-Tullab), sumber perbandingan empat mazhab, Mawsu'ah Fiqhiyyah Kuwaitiyyah, Piawaian Syariah AAOIFI, Resolusi MPS BNM, Garis Panduan JKSM dan banyak lagi.`,
                  `اسأل أي سؤال عن الأحكام الشرعية. يحلل الذكاء الاصطناعي ${kitabList?.length || 44} نصاً موثوقاً يشمل المراجع الشافعية العربية الكلاسيكية، والأعمال الملاوية-الجاوية النوسانتارية، والمصادر المقارنة للمذاهب الأربعة، والموسوعة الفقهية الكويتية، ومعايير أيوفي الشرعية، وقرارات المجلس الاستشاري الشرعي لبنك نيغارا الماليزي، وتوجيهات إدارة القضاء الشرعي.`
                )}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
