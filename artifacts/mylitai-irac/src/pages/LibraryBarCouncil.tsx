import { useMemo, useState } from "react";
import { Scale, ShieldAlert, ExternalLink, BookA } from "lucide-react";
import {
  LibraryHeader,
  LibrarySearch,
  BackLink,
  Chip,
  LibraryLoading,
  LibraryEmpty,
  LibraryError,
} from "@/components/LibraryShared";
import { useBarCouncilRulings } from "@/hooks/use-academic";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryBarCouncil() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [chapter, setChapter] = useState("");
  const { data: items, isLoading, isError } = useBarCouncilRulings(search.trim() || undefined);

  const chapters = useMemo(() => {
    const set = new Set<string>();
    (items ?? []).forEach((i) => set.add(i.chapter));
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(
    () => (chapter ? (items ?? []).filter((i) => i.chapter === chapter) : items ?? []),
    [items, chapter],
  );

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10">
      <BackLink href="/library" label={t("lib.nav.library")} />
      <LibraryHeader
        eyebrow={t("lib.eyebrow")}
        title={t("lib.barCouncil.title")}
        icon={Scale}
        description={t("lib.barCouncil.description")}
      />

      <LibrarySearch
        value={search}
        onChange={(v) => {
          setSearch(v);
          if (v) setChapter("");
        }}
        placeholder={t("lib.barCouncil.searchPlaceholder")}
      />

      {chapters.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          <button
            onClick={() => setChapter("")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
              chapter === ""
                ? "bg-[hsl(var(--gold))] text-[hsl(var(--ink-deep))] border-[hsl(var(--gold))]"
                : "bg-card text-muted-foreground border-card-border hover:border-[hsl(var(--gold))]/40 hover:text-foreground"
            }`}
          >
            All Topics
          </button>
          {chapters.map((c) => (
            <button
              key={c}
              onClick={() => setChapter(c)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                chapter === c
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
        <LibraryLoading label="Loading rules & rulings…" />
      ) : isError ? (
        <LibraryError />
      ) : filtered.length === 0 ? (
        <LibraryEmpty message="No rulings found matching your search." icon={Scale} />
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <div key={r.id} className="card-elegant rounded-2xl p-6 md:p-7">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Chip variant="gold">{r.chapter}</Chip>
                {r.lastUpdated && (
                  <span className="text-xs text-muted-foreground">Updated {r.lastUpdated}</span>
                )}
              </div>

              <h3 className="font-serif text-xl font-bold text-[hsl(var(--gold-bright))] mb-3">
                {r.title}
              </h3>

              <p className="text-foreground/90 leading-relaxed rounded-xl border border-card-border bg-white/[0.02] p-4 mb-4">
                {r.ruling}
              </p>

              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground">In practice</h4>
                  <p className="text-sm text-foreground/80 leading-relaxed">{r.practicalEffect}</p>
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                    <BookA className="w-3 h-3" /> Basis
                  </h4>
                  <p className="text-sm font-mono text-[hsl(var(--gold))]/80">{r.basis}</p>
                </div>
              </div>

              {r.consequence && (
                <p className="text-sm text-amber-300/90 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 mb-4">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{r.consequence}</span>
                </p>
              )}

              <a
                href={r.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--gold))] hover:underline"
              >
                Source <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
