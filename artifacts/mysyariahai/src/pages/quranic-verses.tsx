import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { useGate } from "@/lib/gate-context";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function QuranicVersesPage() {
  const { t, mode } = useLanguage();
  const { gate } = useGate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    const targetId = sessionStorage.getItem("navigateToQuranic-versesId");
    if (targetId) {
      sessionStorage.removeItem("navigateToQuranic-versesId");
      api.quranicVerses.get(Number(targetId)).then((v) => setSelected(v)).catch(() => {});
    }
  }, []);

  const { data: categories } = useQuery({ queryKey: ["quran-categories", gate], queryFn: api.quranicVerses.categories });
  const { data: verses, isLoading } = useQuery({
    queryKey: ["quranic-verses", gate, search, category],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (category !== "all") params.category = category;
      return api.quranicVerses.list(params);
    },
  });

  const uniqueCategories = categories?.map((c: any) => ({
    value: c.category,
    label: mode === "bm" ? c.categoryBm : c.category,
    count: c.count,
  })) || [];

  if (selected) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-4 text-muted-foreground">
          <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          {t("Back to Quranic Verses", "Kembali ke Ayat Al-Quran")}
        </Button>
        <VerseDetail verse={selected} />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">
          {t("Quranic Verses", "Ayat-Ayat Al-Quran")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Quranic foundations for Malaysian Shariah legal provisions", "Asas Al-Quran bagi peruntukan undang-undang Syariah Malaysia")}
        </p>
      </div>

      <Input
        placeholder={mode === "bm" ? "Cari ayat..." : "Search verses..."}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant={category === "all" ? "default" : "outline"} className="cursor-pointer" onClick={() => setCategory("all")}>
          {t("All", "Semua")}
        </Badge>
        {uniqueCategories.map((c: any) => (
          <Badge key={c.value} variant={category === c.value ? "default" : "outline"} className="cursor-pointer" onClick={() => setCategory(c.value)}>
            {c.label} ({c.count})
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {verses?.map((v: any) => (
            <Card key={v.id} className="border-border/50 cursor-pointer hover:border-secondary/30 transition-colors" onClick={() => setSelected(v)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">{mode === "bm" ? v.categoryBm : v.category}</Badge>
                  <Badge variant="secondary" className="text-xs">
                    {v.surahName} {v.ayahRange}
                  </Badge>
                </div>
                <p className="text-right font-arabic text-base leading-loose text-secondary/90 mb-2" dir="rtl">
                  {v.textArabic.length > 120 ? v.textArabic.substring(0, 120) + "..." : v.textArabic}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {mode === "bm" ? v.translationBm : v.translationEn}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function VerseDetail({ verse: v }: { verse: any }) {
  const { t, mode } = useLanguage();

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline">{mode === "bm" ? v.categoryBm : v.category}</Badge>
          <Badge variant="secondary">{v.surahName} ({mode === "bm" ? v.surahNameBm : v.surahName})</Badge>
          <Badge className="text-xs">
            {t("Surah", "Surah")} {v.surahNumber} : {v.ayahRange}
          </Badge>
        </div>
      </div>

      <Card className="border-secondary/20 bg-secondary/5">
        <CardHeader className="pb-2">
          <h3 className="font-serif font-semibold text-sm">{t("Arabic Text", "Teks Arab")}</h3>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-right text-xl leading-[2.5] text-foreground font-arabic" dir="rtl">
            {v.textArabic}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <h3 className="font-serif font-semibold text-sm">{t("Translation", "Terjemahan")}</h3>
        </CardHeader>
        <CardContent className="pb-4">
          {mode === "bm" ? (
            <p className="text-sm leading-relaxed text-foreground/90">{v.translationBm}</p>
          ) : mode === "en" ? (
            <p className="text-sm leading-relaxed text-foreground/90">{v.translationEn}</p>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-foreground/90">{v.translationEn}</p>
              <hr className="my-3 border-border/50" />
              <p className="text-sm leading-relaxed text-muted-foreground italic">{v.translationBm}</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <h3 className="font-serif font-semibold text-sm">{t("Legal Relevance", "Relevansi Undang-Undang")}</h3>
        </CardHeader>
        <CardContent className="pb-4">
          {mode === "bm" ? (
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{v.relevanceBm}</p>
          ) : mode === "en" ? (
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{v.relevanceEn}</p>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{v.relevanceEn}</p>
              <hr className="my-3 border-border/50" />
              <p className="text-sm leading-relaxed text-muted-foreground italic whitespace-pre-line">{v.relevanceBm}</p>
            </>
          )}
        </CardContent>
      </Card>

      {v.practitionerNotesEn && (
        <Card className="border-secondary/30 bg-secondary/5">
          <CardHeader className="pb-2">
            <h3 className="font-serif font-semibold text-sm">{t("Practitioner Notes", "Nota Pengamal")}</h3>
          </CardHeader>
          <CardContent className="pb-4">
            {mode === "bm" ? (
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{v.practitionerNotesBm}</p>
            ) : mode === "en" ? (
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{v.practitionerNotesEn}</p>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{v.practitionerNotesEn}</p>
                <hr className="my-3 border-border/50" />
                <p className="text-sm leading-relaxed text-muted-foreground italic whitespace-pre-line">{v.practitionerNotesBm}</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {v.relatedLegislation && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <h3 className="font-serif font-semibold text-sm">{t("Related Legislation", "Perundangan Berkaitan")}</h3>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-sm text-muted-foreground">{v.relatedLegislation}</p>
          </CardContent>
        </Card>
      )}

      <AnalyzeButton
        text={`Quranic verse: Surah ${v.surahName} ${v.ayahRange}. Category: ${v.category}. Legal relevance: ${v.relevanceEn}`}
      />
    </div>
  );
}

function AnalyzeButton({ text }: { text: string }) {
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  return (
    <Card className="border-secondary/20 bg-secondary/5">
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-secondary">
            {t("Cross-Reference with AI", "Rujuk Silang dengan AI")}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("Find related fatwas, cases, provisions, and more verses", "Cari fatwa, kes, peruntukan, dan ayat lain berkaitan")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-secondary/30 text-secondary hover:bg-secondary/10"
          onClick={() => {
            sessionStorage.setItem("analyzerPrefill", text);
            navigate("/analyzer");
          }}
        >
          <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          {t("Analyze", "Analisis")}
        </Button>
      </CardContent>
    </Card>
  );
}
