import { useState, useEffect, useMemo } from "react";
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

const ALL = "all";
const FEDERAL = "federal";

export default function FatwasPage() {
  const { t, mode } = useLanguage();
  const { gate } = useGate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stateFilter, setStateFilter] = useState<string>(ALL);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    const targetId = sessionStorage.getItem("navigateToFatwasId");
    if (targetId) {
      sessionStorage.removeItem("navigateToFatwasId");
      api.fatwas.get(Number(targetId)).then((f) => setSelected(f)).catch(() => {});
    }
  }, []);

  const { data: categories } = useQuery({ queryKey: ["fatwa-categories", gate], queryFn: api.fatwas.categories });
  const { data: fatwas, isLoading } = useQuery({
    queryKey: ["fatwas", gate, search, category],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (category !== "all") params.category = category;
      return api.fatwas.list(params);
    },
  });

  const uniqueCategories = categories?.map((c: any) => ({
    value: c.category,
    label: mode === "bm" ? c.categoryBm : c.category,
    count: c.count,
  })) || [];

  const list: any[] = Array.isArray(fatwas) ? fatwas : [];

  const states = useMemo(() => {
    const set = new Set<string>();
    list.forEach((f) => {
      if (f.state && f.state !== "Federal") set.add(f.state);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [list]);

  const filtered = useMemo(
    () =>
      list.filter((f) => {
        if (stateFilter === ALL) return true;
        if (stateFilter === FEDERAL) return !f.state || f.state === "Federal";
        return f.state === stateFilter;
      }),
    [list, stateFilter],
  );

  if (selected) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-4 text-muted-foreground">
          <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          {t("Back to Fatwas", "Kembali ke Fatwa")}
        </Button>
        <FatwaDetail fatwa={selected} />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">
          {t("Gazetted Fatwas", "Fatwa-Fatwa Bergazet")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("Gazetted fatwas issued by Malaysian Fatwa authorities", "Fatwa-fatwa bergazet yang dikeluarkan oleh pihak berkuasa fatwa Malaysia")}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <Input
          placeholder={mode === "bm" ? "Cari fatwa..." : "Search fatwas..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="h-10 rounded-md border border-border/60 bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-secondary/40"
        >
          <option value={ALL}>{t("All jurisdictions", "Semua bidang kuasa")}</option>
          <option value={FEDERAL}>{t("Federal / National", "Persekutuan / Kebangsaan")}</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

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
        <>
          <p className="text-xs text-muted-foreground">
            {filtered.length} {t("results", "keputusan")}
          </p>
          <div className="grid gap-3">
            {filtered.map((f: any) => (
              <Card key={f.id} className="border-border/50 cursor-pointer hover:border-secondary/30 transition-colors" onClick={() => setSelected(f)}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">{mode === "bm" ? f.categoryBm : f.category}</Badge>
                    <Badge variant="secondary" className="text-xs">{f.year}</Badge>
                    <Badge variant="outline" className="text-xs border-secondary/40 text-secondary">
                      {f.state && f.state !== "Federal" ? f.state : t("Federal / National", "Persekutuan / Kebangsaan")}
                    </Badge>
                    <Badge className={`text-xs ${f.status === "Active" ? "bg-green-900/30 text-green-400 border-green-800" : "bg-yellow-900/30 text-yellow-400 border-yellow-800"}`}>
                      {f.status === "Active" ? (mode === "bm" ? "Berkuat Kuasa" : "Active") : f.status}
                    </Badge>
                  </div>
                  <h3 className="font-serif font-semibold text-foreground text-sm">
                    {mode === "bm" ? f.titleBm : mode === "en" ? f.titleEn : `${f.titleEn} / ${f.titleBm}`}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {mode === "bm" ? f.issuingBodyBm : f.issuingBody}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {mode === "bm" ? f.summaryBm : f.summaryEn}
                  </p>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <p className="text-center py-12 text-muted-foreground text-sm">
                {t("No fatwas match your filters.", "Tiada fatwa sepadan dengan tapisan anda.")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FatwaDetail({ fatwa: f }: { fatwa: any }) {
  const { t, mode } = useLanguage();
  const [tab, setTab] = useState("summary");

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="outline">{mode === "bm" ? f.categoryBm : f.category}</Badge>
          <Badge variant="secondary">{f.year}</Badge>
          <Badge variant="outline" className="border-secondary/40 text-secondary">
            {f.state && f.state !== "Federal" ? f.state : t("Federal / National", "Persekutuan / Kebangsaan")}
          </Badge>
          <Badge className={`text-xs ${f.status === "Active" ? "bg-green-900/30 text-green-400 border-green-800" : "bg-yellow-900/30 text-yellow-400 border-yellow-800"}`}>
            {f.status === "Active" ? (mode === "bm" ? "Berkuat Kuasa" : "Active") : f.status}
          </Badge>
        </div>
        <h2 className="text-xl font-serif font-bold text-foreground">
          {mode === "bm" ? f.titleBm : mode === "en" ? f.titleEn : `${f.titleEn} / ${f.titleBm}`}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "bm" ? f.issuingBodyBm : f.issuingBody}
        </p>
        {f.gazetteRef && (
          <p className="text-xs text-secondary mt-1">{t("Gazette Ref", "Rujukan Warta")}: {f.gazetteRef}</p>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="summary" className="text-xs">{t("Summary", "Ringkasan")}</TabsTrigger>
          <TabsTrigger value="details" className="text-xs">{t("Full Details", "Butiran Penuh")}</TabsTrigger>
          {f.practitionerNotesEn && (
            <TabsTrigger value="practitioner" className="text-xs">{t("Practitioner Notes", "Nota Pengamal")}</TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {tab === "summary" && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            {mode === "bm" ? (
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{f.summaryBm}</p>
            ) : mode === "en" ? (
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{f.summaryEn}</p>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{f.summaryEn}</p>
                <hr className="my-3 border-border/50" />
                <p className="text-sm leading-relaxed text-muted-foreground italic whitespace-pre-line">{f.summaryBm}</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "details" && (
        <Card className="border-border/50">
          <CardContent className="p-4">
            {mode === "bm" ? (
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{f.detailsBm}</p>
            ) : mode === "en" ? (
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{f.detailsEn}</p>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{f.detailsEn}</p>
                <hr className="my-3 border-border/50" />
                <p className="text-sm leading-relaxed text-muted-foreground italic whitespace-pre-line">{f.detailsBm}</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "practitioner" && f.practitionerNotesEn && (
        <Card className="border-secondary/30 bg-secondary/5">
          <CardContent className="p-4">
            {mode === "bm" ? (
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{f.practitionerNotesBm}</p>
            ) : mode === "en" ? (
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{f.practitionerNotesEn}</p>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{f.practitionerNotesEn}</p>
                <hr className="my-3 border-border/50" />
                <p className="text-sm leading-relaxed text-muted-foreground italic whitespace-pre-line">{f.practitionerNotesBm}</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {f.relatedLegislation && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <h3 className="font-serif font-semibold text-sm">{t("Related Legislation", "Perundangan Berkaitan")}</h3>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-sm text-muted-foreground">{f.relatedLegislation}</p>
          </CardContent>
        </Card>
      )}

      {f.sourceUrl && (
        <Card className="border-secondary/30 bg-secondary/5">
          <CardHeader className="pb-2">
            <h3 className="font-serif font-semibold text-sm">{t("Official source", "Sumber rasmi")}</h3>
          </CardHeader>
          <CardContent>
            <a
              href={f.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-secondary hover:underline break-all"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3h7v7M10 14L21 3M21 14v7H3V3h7"/></svg>
              {t("Open the issuing authority's page", "Buka laman pihak berkuasa pengeluar")}
            </a>
            <p className="text-xs text-muted-foreground mt-2">
              {t(
                "Always verify against the official gazette — a fatwa carries the force of law only in states where it has been gazetted.",
                "Sentiasa sahkan dengan warta rasmi — sesuatu fatwa hanya berkuat kuasa undang-undang di negeri yang telah mewartakannya.",
              )}
            </p>
          </CardContent>
        </Card>
      )}

      <AnalyzeButton
        text={`Gazetted fatwa: ${f.titleEn}. Category: ${f.category}. Issuing body: ${f.issuingBody}. Summary: ${f.summaryEn}`}
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
            {t("Find related Quranic verses, cases, and provisions", "Cari ayat Al-Quran, kes, dan peruntukan berkaitan")}
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
