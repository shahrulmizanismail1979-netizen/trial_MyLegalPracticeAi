import { useMemo, useState } from "react";
import { ScrollText, Landmark, ExternalLink, CalendarClock } from "lucide-react";
import {
  LibraryHeader,
  LibrarySearch,
  BackLink,
  Chip,
  LibraryLoading,
  LibraryEmpty,
  LibraryError,
} from "@/components/LibraryShared";
import { usePracticeDirections } from "@/hooks/use-academic";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryPracticeDirections() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [court, setCourt] = useState("");
  const { data: items, isLoading, isError } = usePracticeDirections(search.trim() || undefined);

  const courts = useMemo(() => {
    const set = new Set<string>();
    (items ?? []).forEach((i) => set.add(i.court));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(
    () => (court ? (items ?? []).filter((i) => i.court === court) : items ?? []),
    [items, court],
  );

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10">
      <BackLink href="/library" label={t("lib.nav.library")} />
      <LibraryHeader
        eyebrow={t("lib.eyebrow")}
        title={t("lib.practiceDirections.title")}
        icon={ScrollText}
        description={t("lib.practiceDirections.description")}
      />

      <LibrarySearch
        value={search}
        onChange={(v) => {
          setSearch(v);
          if (v) setCourt("");
        }}
        placeholder={t("lib.practiceDirections.searchPlaceholder")}
      />

      {courts.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button
            onClick={() => setCourt("")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
              court === ""
                ? "bg-[hsl(var(--gold))] text-[hsl(var(--ink-deep))] border-[hsl(var(--gold))]"
                : "bg-card text-muted-foreground border-card-border hover:border-[hsl(var(--gold))]/40 hover:text-foreground"
            }`}
          >
            {t("common.all")}
          </button>
          {courts.map((c) => (
            <button
              key={c}
              onClick={() => setCourt(c)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                court === c
                  ? "bg-[hsl(var(--gold))] text-[hsl(var(--ink-deep))] border-[hsl(var(--gold))]"
                  : "bg-card text-muted-foreground border-card-border hover:border-[hsl(var(--gold))]/40 hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <LibraryLoading label={t("lib.practiceDirections.loading")} />
      ) : isError ? (
        <LibraryError />
      ) : filtered.length === 0 ? (
        <LibraryEmpty message={t("lib.practiceDirections.empty")} icon={ScrollText} />
      ) : (
        <div className="space-y-4">
          {filtered.map((pd) => (
            <div key={pd.id} className="card-elegant rounded-2xl p-6 md:p-7">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Chip variant="gold">{pd.court}</Chip>
                <Chip>{pd.category}</Chip>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    pd.status.toLowerCase().includes("force")
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {pd.status}
                </span>
              </div>

              <h3 className="font-serif text-xl font-bold text-[hsl(var(--gold-bright))] mb-1">
                {pd.title}
              </h3>
              <p className="text-sm font-mono text-[hsl(var(--gold))]/80 mb-4 flex items-center gap-2 flex-wrap">
                <Landmark className="w-3.5 h-3.5" /> {pd.refNo}
                {pd.effectiveDate && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <CalendarClock className="w-3.5 h-3.5" /> {pd.effectiveDate}
                  </span>
                )}
              </p>

              <p className="text-foreground/90 leading-relaxed rounded-xl border border-card-border bg-white/[0.02] p-4 mb-4">
                {pd.summary}
              </p>

              <div className="space-y-1 mb-4">
                <h4 className="text-xs font-bold uppercase text-muted-foreground">{t("lib.inPractice")}</h4>
                <p className="text-sm text-foreground/80 leading-relaxed">{pd.practicalEffect}</p>
              </div>

              <a
                href={pd.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--gold))] hover:underline"
              >
                {t("common.source")} <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
