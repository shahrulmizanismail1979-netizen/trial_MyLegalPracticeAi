import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { useGate } from "@/lib/gate-context";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";

export default function CasesPage() {
  const { t, mode } = useLanguage();
  const { gate } = useGate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<any>(null);

  const { data: categories } = useQuery({ queryKey: ["case-categories", gate], queryFn: api.cases.categories });
  const { data: cases, isLoading } = useQuery({
    queryKey: ["cases", gate, search, category],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (category !== "all") params.category = category;
      return api.cases.list(params);
    },
  });

  useEffect(() => {
    const targetCaseId = sessionStorage.getItem("navigateToCaseId");
    if (targetCaseId) {
      sessionStorage.removeItem("navigateToCaseId");
      api.cases.get(Number(targetCaseId)).then((c) => setSelected(c)).catch(() => {});
    }
  }, []);

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
          {t("Back to Cases", "Kembali ke Kes")}
        </Button>
        <CaseDetail caseLaw={selected} />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">
          {t("Case Laws", "Kes Undang-Undang")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Reference library of Malaysian Shariah court decisions", "Perpustakaan rujukan keputusan mahkamah Syariah Malaysia")}
        </p>
      </div>

      <Input
        placeholder={mode === "bm" ? "Cari kes..." : "Search cases..."}
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
        <div className="grid gap-3">
          {cases?.map((c: any) => (
            <Card key={c.id} className="border-border/50 cursor-pointer hover:border-secondary/30 transition-colors" onClick={() => setSelected(c)}>
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">{mode === "bm" ? c.categoryBm : c.category}</Badge>
                  <Badge variant="secondary" className="text-xs">{c.year}</Badge>
                  <span className="text-xs text-muted-foreground">{c.court}</span>
                </div>
                <h3 className="font-serif font-semibold text-foreground text-sm">{c.caseName}</h3>
                <p className="text-xs text-secondary mt-1">{c.citation}</p>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {mode === "bm" ? c.factsBm : c.factsEn}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CaseDetail({ caseLaw: c }: { caseLaw: any }) {
  const { t, mode } = useLanguage();
  const [tab, setTab] = useState("facts");

  const sections = [
    { key: "facts", label: t("Facts", "Fakta"), en: c.factsEn, bm: c.factsBm },
    { key: "issues", label: t("Issues", "Isu"), en: c.issuesEn, bm: c.issuesBm },
    { key: "held", label: t("Held", "Keputusan"), en: c.heldEn, bm: c.heldBm },
    { key: "significance", label: t("Significance", "Kepentingan"), en: c.significanceEn, bm: c.significanceBm },
    ...(c.practitionerNotesEn
      ? [{ key: "practitioner", label: t("Practitioner Notes", "Nota Pengamal"), en: c.practitionerNotesEn, bm: c.practitionerNotesBm }]
      : []),
  ];

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="outline">{mode === "bm" ? c.categoryBm : c.category}</Badge>
          <Badge variant="secondary">{c.year}</Badge>
        </div>
        <h2 className="text-xl font-serif font-bold text-foreground">{c.caseName}</h2>
        <p className="text-sm text-secondary mt-1">{c.citation}</p>
        <p className="text-xs text-muted-foreground mt-1">{mode === "bm" ? c.courtBm : c.court} | {c.judge}</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {sections.map((s) => (
            <TabsTrigger key={s.key} value={s.key} className="text-xs">{s.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {sections.map((s) => (
        s.key === tab && (
          <Card key={s.key} className="border-border/50">
            <CardContent className="p-4">
              {mode === "bm" ? (
                <p className="whitespace-pre-line text-sm text-foreground/90">{s.bm}</p>
              ) : mode === "en" ? (
                <p className="whitespace-pre-line text-sm text-foreground/90">{s.en}</p>
              ) : (
                <>
                  <p className="whitespace-pre-line text-sm text-foreground/90">{s.en}</p>
                  <hr className="my-3 border-border/50" />
                  <p className="whitespace-pre-line text-sm text-muted-foreground italic">{s.bm}</p>
                </>
              )}
            </CardContent>
          </Card>
        )
      ))}

      {c.legislation && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <h3 className="font-serif font-semibold text-sm">{t("Related Legislation", "Perundangan Berkaitan")}</h3>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-sm text-muted-foreground">{c.legislation}</p>
          </CardContent>
        </Card>
      )}

      {c.tags && (
        <div className="flex flex-wrap gap-1.5">
          {c.tags.split(",").map((tag: string) => (
            <Badge key={tag.trim()} variant="outline" className="text-xs">{tag.trim()}</Badge>
          ))}
        </div>
      )}

      <AnalyzeButton
        text={`Case law: ${c.caseName} ${c.citation}. Category: ${c.category}. Facts: ${c.factsEn}. Held: ${c.heldEn}`}
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
            {t("Find related Quranic verses, fatwas, cases, and provisions", "Cari ayat Al-Quran, fatwa, kes, dan peruntukan berkaitan")}
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
