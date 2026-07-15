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

export default function ProvisionsPage() {
  const { t, mode } = useLanguage();
  const { gate } = useGate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    const targetId = sessionStorage.getItem("navigateToProvisionsId");
    if (targetId) {
      sessionStorage.removeItem("navigateToProvisionsId");
      api.provisions.get(Number(targetId)).then((p) => setSelected(p)).catch(() => {});
    }
  }, []);

  const { data: categories } = useQuery({ queryKey: ["provision-categories", gate], queryFn: api.provisions.categories });
  const { data: provisions, isLoading } = useQuery({
    queryKey: ["provisions", gate, search, category],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (category !== "all") params.category = category;
      return api.provisions.list(params);
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
          {t("Back to Provisions", "Kembali ke Peruntukan")}
        </Button>
        <ProvisionDetail provision={selected} />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">
          {t("Legal Provisions", "Peruntukan Undang-Undang")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Comprehensive reference of Malaysian Shariah legal provisions", "Rujukan komprehensif peruntukan undang-undang Syariah Malaysia")}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder={mode === "bm" ? "Cari peruntukan..." : "Search provisions..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge
          variant={category === "all" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setCategory("all")}
        >
          {t("All", "Semua")}
        </Badge>
        {uniqueCategories.map((c: any) => (
          <Badge
            key={c.value}
            variant={category === c.value ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setCategory(c.value)}
          >
            {c.label} ({c.count})
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {provisions?.map((p: any) => (
            <Card
              key={p.id}
              className="border-border/50 cursor-pointer hover:border-secondary/30 transition-colors"
              onClick={() => setSelected(p)}
            >
              <CardContent className="p-4">
                <Badge variant="outline" className="mb-2 text-xs">
                  {mode === "bm" ? p.categoryBm : p.category}
                </Badge>
                <h3 className="font-serif font-semibold text-foreground text-sm">
                  {mode === "bm" ? p.titleBm : mode === "en" ? p.titleEn : `${p.titleEn} / ${p.titleBm}`}
                </h3>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                  {mode === "bm" ? p.overviewBm : p.overviewEn}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function RelatedCasesLinks({ relatedCasesText }: { relatedCasesText: string }) {
  const { mode } = useLanguage();
  const [, navigate] = useLocation();

  const { data: allCases } = useQuery({
    queryKey: ["all-cases-for-linking"],
    queryFn: () => api.cases.list(),
    staleTime: 5 * 60 * 1000,
  });

  const parts: { text: string; caseId?: number; caseName?: string }[] = [];

  if (!allCases || allCases.length === 0) {
    parts.push({ text: relatedCasesText });
  } else {
    let remaining = relatedCasesText;
    const sortedCases = [...allCases].sort((a: any, b: any) => b.caseName.length - a.caseName.length);

    const matches: { start: number; end: number; caseId: number; caseName: string }[] = [];
    for (const c of sortedCases) {
      const idx = remaining.indexOf(c.caseName);
      if (idx !== -1) {
        const overlap = matches.some(
          (m) => (idx >= m.start && idx < m.end) || (idx + c.caseName.length > m.start && idx + c.caseName.length <= m.end)
        );
        if (!overlap) {
          matches.push({ start: idx, end: idx + c.caseName.length, caseId: c.id, caseName: c.caseName });
        }
      }
    }

    matches.sort((a, b) => a.start - b.start);

    let pos = 0;
    for (const m of matches) {
      if (m.start > pos) {
        parts.push({ text: remaining.slice(pos, m.start) });
      }
      parts.push({ text: m.caseName, caseId: m.caseId, caseName: m.caseName });
      pos = m.end;
    }
    if (pos < remaining.length) {
      parts.push({ text: remaining.slice(pos) });
    }
  }

  const handleCaseClick = (caseId: number) => {
    sessionStorage.setItem("navigateToCaseId", String(caseId));
    navigate("/cases");
  };

  return (
    <span className="text-sm leading-relaxed">
      {parts.map((part, i) =>
        part.caseId ? (
          <button
            key={i}
            onClick={() => handleCaseClick(part.caseId!)}
            className="text-secondary hover:text-secondary/80 underline underline-offset-2 cursor-pointer font-medium"
            title={mode === "bm" ? "Lihat butiran kes" : "View case details"}
          >
            {part.text}
          </button>
        ) : (
          <span key={i} className="text-muted-foreground">{part.text}</span>
        )
      )}
    </span>
  );
}

function ProvisionDetail({ provision: p }: { provision: any }) {
  const { t, mode } = useLanguage();
  const [tab, setTab] = useState("overview");

  const sections = [
    { key: "overview", label: t("Overview", "Gambaran"), en: p.overviewEn, bm: p.overviewBm },
    { key: "principles", label: t("Principles", "Prinsip"), en: p.principlesEn, bm: p.principlesBm },
    { key: "legislation", label: t("Legislation", "Perundangan"), en: p.legislationEn, bm: p.legislationBm },
    { key: "practical", label: t("Practical Notes", "Nota Praktikal"), en: p.practicalNotesEn, bm: p.practicalNotesBm },
  ];

  return (
    <div className="space-y-4">
      <div>
        <Badge variant="outline" className="mb-2">
          {mode === "bm" ? p.categoryBm : p.category}
        </Badge>
        <h2 className="text-xl font-serif font-bold text-foreground">
          {mode === "bm" ? p.titleBm : mode === "en" ? p.titleEn : `${p.titleEn} / ${p.titleBm}`}
        </h2>
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
              <div className="prose prose-sm max-w-none text-foreground/90">
                {mode === "bm" ? (
                  <p className="whitespace-pre-line text-sm">{s.bm}</p>
                ) : mode === "en" ? (
                  <p className="whitespace-pre-line text-sm">{s.en}</p>
                ) : (
                  <>
                    <p className="whitespace-pre-line text-sm">{s.en}</p>
                    <hr className="my-3 border-border/50" />
                    <p className="whitespace-pre-line text-sm text-muted-foreground italic">{s.bm}</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )
      ))}

      {p.relatedCases && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <h3 className="font-serif font-semibold text-sm">{t("Related Cases", "Kes Berkaitan")}</h3>
          </CardHeader>
          <CardContent className="pb-4">
            <RelatedCasesLinks relatedCasesText={p.relatedCases} />
          </CardContent>
        </Card>
      )}

      <AnalyzeButton
        text={`Legal provision: ${p.titleEn}. Category: ${p.category}. Overview: ${p.overviewEn}`}
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
