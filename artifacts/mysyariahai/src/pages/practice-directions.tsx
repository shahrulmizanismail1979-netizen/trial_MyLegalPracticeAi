import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { useGate } from "@/lib/gate-context";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PracticeDirectionsPage() {
  const { t, mode } = useLanguage();
  const { gate } = useGate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [state, setState] = useState("all");
  const [docType, setDocType] = useState("all");
  const [selected, setSelected] = useState<any>(null);

  const { data: categories } = useQuery({
    queryKey: ["pd-categories", gate],
    queryFn: api.practiceDirections.categories,
  });
  const { data: states } = useQuery({
    queryKey: ["pd-states", gate],
    queryFn: api.practiceDirections.states,
  });
  const { data: directions, isLoading } = useQuery({
    queryKey: ["practice-directions", gate, search, category, state, docType],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (category !== "all") params.category = category;
      if (state !== "all") params.state = state;
      if (docType !== "all") params.docType = docType;
      return api.practiceDirections.list(params);
    },
  });

  const uniqueCategories =
    categories?.map((c: any) => ({
      value: c.category,
      label: mode === "bm" ? c.categoryBm : c.category,
      count: c.count,
    })) || [];

  if (selected) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelected(null)}
          className="mb-4 text-muted-foreground"
        >
          <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 19l-7-7 7-7" />
          </svg>
          {t("Back to list", "Kembali ke senarai")}
        </Button>
        <DirectionDetail d={selected} />
      </div>
    );
  }

  const docTypes = [
    { value: "all", label: t("All", "Semua") },
    { value: "practice_direction", label: t("Practice Directions", "Arahan Amalan") },
    { value: "circular", label: t("Circulars", "Pekeliling") },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">
          {t("Practice Directions & Circulars", "Arahan Amalan & Pekeliling")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "Practice directions, circulars, and directives issued by the Syariah Judiciary (JKSM) and State Syariah Courts.",
            "Arahan amalan, pekeliling, dan arahan yang dikeluarkan oleh Jabatan Kehakiman Syariah Malaysia (JKSM) dan Mahkamah Syariah Negeri.",
          )}
        </p>
      </div>

      <Input
        placeholder={mode === "bm" ? "Cari arahan amalan / pekeliling..." : "Search practice directions / circulars..."}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {/* Doc type */}
      <div className="flex flex-wrap gap-2">
        {docTypes.map((dt) => (
          <Badge
            key={dt.value}
            variant={docType === dt.value ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setDocType(dt.value)}
          >
            {dt.label}
          </Badge>
        ))}
      </div>

      {/* State */}
      {states && states.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">{t("State", "Negeri")}:</span>
          <Badge
            variant={state === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setState("all")}
          >
            {t("All", "Semua")}
          </Badge>
          {states.map((s: string) => (
            <Badge
              key={s}
              variant={state === s ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setState(s)}
            >
              {s}
            </Badge>
          ))}
        </div>
      )}

      {/* Category */}
      {uniqueCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={category === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setCategory("all")}
          >
            {t("All categories", "Semua kategori")}
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
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : !directions || directions.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="p-8 text-center space-y-2">
            <svg className="w-8 h-8 mx-auto text-muted-foreground/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium text-foreground">
              {t("No matching directions or circulars yet", "Tiada arahan atau pekeliling yang sepadan lagi")}
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              {t(
                "More practice directions and circulars from JKSM and the State Syariah Courts are being added here, filterable by state and court.",
                "Lebih banyak arahan amalan dan pekeliling daripada JKSM dan Mahkamah Syariah Negeri sedang ditambah di sini, boleh ditapis mengikut negeri dan mahkamah.",
              )}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {directions.map((d: any) => (
            <Card
              key={d.id}
              className="border-border/50 cursor-pointer hover:border-secondary/30 transition-colors"
              onClick={() => setSelected(d)}
            >
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    {d.docType === "circular" ? t("Circular", "Pekeliling") : t("Practice Direction", "Arahan Amalan")}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {mode === "bm" ? d.categoryBm : d.category}
                  </Badge>
                  {d.year && <Badge variant="secondary" className="text-xs">{d.year}</Badge>}
                  <Badge
                    className={`text-xs ${
                      d.status === "In Force"
                        ? "bg-green-900/30 text-green-400 border-green-800"
                        : "bg-yellow-900/30 text-yellow-400 border-yellow-800"
                    }`}
                  >
                    {d.status === "In Force" ? t("In Force", "Berkuat Kuasa") : d.status}
                  </Badge>
                  {d.state && <span className="text-xs text-muted-foreground">{d.state}</span>}
                </div>
                <h3 className="font-serif font-semibold text-foreground text-sm">
                  {mode === "bm" ? d.titleBm : mode === "en" ? d.titleEn : `${d.titleEn} / ${d.titleBm}`}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {mode === "bm" ? d.issuingBodyBm : d.issuingBody}
                  {d.refNo ? ` — ${d.refNo}` : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {mode === "bm" ? d.summaryBm : d.summaryEn}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ titleEn, titleBm, en, bm }: { titleEn: string; titleBm: string; en?: string; bm?: string }) {
  const { t, mode } = useLanguage();
  if (!en && !bm) return null;
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <h3 className="font-serif font-semibold text-sm">{t(titleEn, titleBm)}</h3>
      </CardHeader>
      <CardContent>
        {mode === "bm" ? (
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{bm}</p>
        ) : mode === "en" ? (
          <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{en}</p>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{en}</p>
            <hr className="my-3 border-border/50" />
            <p className="text-sm leading-relaxed text-muted-foreground italic whitespace-pre-line">{bm}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DirectionDetail({ d }: { d: any }) {
  const { t, mode } = useLanguage();

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="outline">
            {d.docType === "circular" ? t("Circular", "Pekeliling") : t("Practice Direction", "Arahan Amalan")}
          </Badge>
          <Badge variant="outline">{mode === "bm" ? d.categoryBm : d.category}</Badge>
          {d.year && <Badge variant="secondary">{d.year}</Badge>}
          <Badge
            className={`text-xs ${
              d.status === "In Force"
                ? "bg-green-900/30 text-green-400 border-green-800"
                : "bg-yellow-900/30 text-yellow-400 border-yellow-800"
            }`}
          >
            {d.status === "In Force" ? t("In Force", "Berkuat Kuasa") : d.status}
          </Badge>
        </div>
        <h2 className="text-xl font-serif font-bold text-foreground">
          {mode === "bm" ? d.titleBm : mode === "en" ? d.titleEn : `${d.titleEn} / ${d.titleBm}`}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "bm" ? d.issuingBodyBm : d.issuingBody}
          {d.state ? ` • ${d.state}` : ""}
        </p>
        {d.refNo && (
          <p className="text-xs text-secondary mt-1">
            {t("Reference", "Rujukan")}: {d.refNo}
          </p>
        )}
      </div>

      <Section titleEn="Summary" titleBm="Ringkasan" en={d.summaryEn} bm={d.summaryBm} />
      <Section titleEn="What it covers" titleBm="Apa yang diliputi" en={d.detailsEn} bm={d.detailsBm} />
      <Section
        titleEn="Practical points for practitioners"
        titleBm="Perkara praktikal untuk pengamal"
        en={d.practicalNotesEn}
        bm={d.practicalNotesBm}
      />

      {d.relatedLegislation && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <h3 className="font-serif font-semibold text-sm">{t("Related Legislation", "Perundangan Berkaitan")}</h3>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-sm text-muted-foreground">{d.relatedLegislation}</p>
          </CardContent>
        </Card>
      )}

      {d.sourceUrl && (
        <Card className="border-secondary/30 bg-secondary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-secondary shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-foreground">
                {t("Official source document", "Dokumen sumber rasmi")}
              </p>
              <a
                href={d.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-secondary underline break-all hover:text-secondary/80"
              >
                {t("Open the official PDF", "Buka PDF rasmi")} →
              </a>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t(
                  "Always verify against the official document before relying on it in court.",
                  "Sentiasa sahkan dengan dokumen rasmi sebelum bergantung kepadanya di mahkamah.",
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
