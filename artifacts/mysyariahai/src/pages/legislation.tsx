import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLanguage } from "@/lib/language-context";
import { useGate } from "@/lib/gate-context";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ALL = "all";
const FEDERAL = "federal";

export default function LegislationPage() {
  const { t, mode } = useLanguage();
  const { gate } = useGate();
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string>(ALL);
  const [selected, setSelected] = useState<any>(null);

  const { data: legislation, isLoading } = useQuery({
    queryKey: ["legislation", gate, search],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      return api.legislation.list(params);
    },
  });

  const list: any[] = Array.isArray(legislation) ? legislation : [];

  const states = useMemo(() => {
    const set = new Set<string>();
    list.forEach((l) => {
      if (l.state && l.state !== "Federal") set.add(l.state);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [list]);

  const filtered = useMemo(
    () =>
      list.filter((l) => {
        if (stateFilter === ALL) return true;
        if (stateFilter === FEDERAL) return !l.state || l.state === "Federal";
        return l.state === stateFilter;
      }),
    [list, stateFilter],
  );

  if (selected) {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="mb-4 text-muted-foreground">
          <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 19l-7-7 7-7"/></svg>
          {t("Back to Legislation", "Kembali ke Perundangan")}
        </Button>
        <LegislationDetail leg={selected} />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">
          {t("Legislation Reference", "Rujukan Perundangan")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "Federal Acts and state Islamic enactments across Malaysia",
            "Akta Persekutuan dan enakmen Islam negeri di seluruh Malaysia",
          )}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <Input
          placeholder={mode === "bm" ? "Cari perundangan..." : "Search legislation..."}
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
          <option value={FEDERAL}>{t("Federal (Malaysia-wide)", "Persekutuan (Seluruh Malaysia)")}</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {filtered.length} {t("results", "keputusan")}
          </p>
          <div className="grid gap-3">
            {filtered.map((leg: any) => (
              <Card key={leg.id} className="border-border/50 cursor-pointer hover:border-secondary/30 transition-colors" onClick={() => setSelected(leg)}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">{leg.actNumber}</Badge>
                    <Badge variant="outline" className="text-xs">{leg.year}</Badge>
                    <Badge
                      variant="outline"
                      className="text-xs border-secondary/40 text-secondary"
                    >
                      {leg.state && leg.state !== "Federal" ? leg.state : t("Federal", "Persekutuan")}
                    </Badge>
                    {leg.category && <Badge variant="outline" className="text-xs">{leg.category}</Badge>}
                  </div>
                  <h3 className="font-serif font-semibold text-foreground text-sm">
                    {mode === "bm" ? leg.titleBm : mode === "en" ? leg.titleEn : `${leg.titleEn}`}
                  </h3>
                  {mode !== "en" && <p className="text-xs text-muted-foreground mt-1 italic">{leg.titleBm}</p>}
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {mode === "bm" ? leg.descriptionBm : leg.descriptionEn}
                  </p>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <p className="text-center py-12 text-muted-foreground text-sm">
                {t("No legislation matches your filters.", "Tiada perundangan sepadan dengan tapisan anda.")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function LegislationDetail({ leg }: { leg: any }) {
  const { t, mode } = useLanguage();

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="secondary">{leg.actNumber}</Badge>
          <Badge variant="outline">{leg.year}</Badge>
          <Badge variant="outline" className="border-secondary/40 text-secondary">
            {leg.state && leg.state !== "Federal" ? leg.state : t("Federal", "Persekutuan")}
          </Badge>
        </div>
        <h2 className="text-xl font-serif font-bold text-foreground">
          {mode === "bm" ? leg.titleBm : leg.titleEn}
        </h2>
        {mode === "both" && <p className="text-sm text-muted-foreground italic mt-1">{leg.titleBm}</p>}
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <h3 className="font-serif font-semibold text-sm">{t("Description", "Penerangan")}</h3>
        </CardHeader>
        <CardContent>
          {mode === "bm" ? (
            <p className="text-sm text-foreground/90">{leg.descriptionBm}</p>
          ) : mode === "en" ? (
            <p className="text-sm text-foreground/90">{leg.descriptionEn}</p>
          ) : (
            <>
              <p className="text-sm text-foreground/90">{leg.descriptionEn}</p>
              <hr className="my-3 border-border/50" />
              <p className="text-sm text-muted-foreground italic">{leg.descriptionBm}</p>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <h3 className="font-serif font-semibold text-sm">{t("Key Provisions", "Peruntukan Utama")}</h3>
        </CardHeader>
        <CardContent>
          {mode === "bm" ? (
            <p className="text-sm text-foreground/90 whitespace-pre-line">{leg.keyProvisionsBm}</p>
          ) : mode === "en" ? (
            <p className="text-sm text-foreground/90 whitespace-pre-line">{leg.keyProvisionsEn}</p>
          ) : (
            <>
              <p className="text-sm text-foreground/90 whitespace-pre-line">{leg.keyProvisionsEn}</p>
              <hr className="my-3 border-border/50" />
              <p className="text-sm text-muted-foreground italic whitespace-pre-line">{leg.keyProvisionsBm}</p>
            </>
          )}
        </CardContent>
      </Card>

      {leg.practitionerNotesEn && (
        <Card className="border-secondary/30 bg-secondary/5">
          <CardHeader className="pb-2">
            <h3 className="font-serif font-semibold text-sm">{t("Practitioner Notes", "Nota Pengamal")}</h3>
          </CardHeader>
          <CardContent>
            {mode === "bm" ? (
              <p className="text-sm text-foreground/90 whitespace-pre-line">{leg.practitionerNotesBm}</p>
            ) : mode === "en" ? (
              <p className="text-sm text-foreground/90 whitespace-pre-line">{leg.practitionerNotesEn}</p>
            ) : (
              <>
                <p className="text-sm text-foreground/90 whitespace-pre-line">{leg.practitionerNotesEn}</p>
                <hr className="my-3 border-border/50" />
                <p className="text-sm text-muted-foreground italic whitespace-pre-line">{leg.practitionerNotesBm}</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {leg.sourceUrl && (
        <Card className="border-secondary/30 bg-secondary/5">
          <CardHeader className="pb-2">
            <h3 className="font-serif font-semibold text-sm">{t("Official source document", "Dokumen sumber rasmi")}</h3>
          </CardHeader>
          <CardContent>
            <a
              href={leg.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-secondary hover:underline break-all"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3h7v7M10 14L21 3M21 14v7H3V3h7"/></svg>
              {t("Open the official PDF", "Buka PDF rasmi")}
            </a>
            <p className="text-xs text-muted-foreground mt-2">
              {t(
                "Always verify the current text against the official document — Acts are amended over time.",
                "Sentiasa sahkan teks semasa terhadap dokumen rasmi — Akta dipinda dari masa ke masa.",
              )}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
