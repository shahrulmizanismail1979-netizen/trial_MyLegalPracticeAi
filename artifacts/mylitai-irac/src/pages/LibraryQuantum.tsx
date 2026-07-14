import { useMemo, useState } from "react";
import { HeartPulse, AlertTriangle, Scale } from "lucide-react";
import {
  LibraryHeader,
  BackLink,
  Chip,
  LibrarySearch,
  LibraryLoading,
  LibraryEmpty,
  LibraryError,
} from "@/components/LibraryShared";
import { useCompendium } from "@/hooks/use-academic";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CompendiumCategory, CompendiumItem } from "@/lib/irac-api";

function formatRange(item: Pick<CompendiumItem, "low" | "high">): string {
  const fmt = (n: number) => `RM${n.toLocaleString("en-MY")}`;
  return item.high == null ? `${fmt(item.low)} (fixed)` : `${fmt(item.low)}–${fmt(item.high)}`;
}

const GROUP_ORDER = [
  "Orthopaedic Injuries",
  "Internal Injuries",
  "External Injuries",
  "Miscellaneous Conditions",
];

function CategoryCard({
  category,
  query,
}: {
  category: CompendiumCategory;
  query: string;
}) {
  const { t } = useLanguage();
  return (
    <section className="card-elegant rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h2 className="font-serif text-2xl font-semibold text-foreground">
          {category.name}
        </h2>
        <Chip variant="gold">{category.items.length} {t("lib.quantum.items")}</Chip>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-5">
        {category.description}
      </p>

      <div className="overflow-x-auto rounded-xl border border-card-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.03] text-left">
              <th className="px-4 py-3 font-semibold text-[hsl(var(--gold))] uppercase text-xs tracking-wider">
                {t("lib.quantum.injury")}
              </th>
              <th className="px-4 py-3 font-semibold text-[hsl(var(--gold))] uppercase text-xs tracking-wider text-right whitespace-nowrap">
                {t("lib.quantum.generalDamages")}
              </th>
            </tr>
          </thead>
          <tbody>
            {category.items.map((item, i) => {
              const isMatch =
                query.length > 0 &&
                item.injury.toLowerCase().includes(query.toLowerCase());
              return (
                <tr
                  key={i}
                  className={`border-t border-card-border align-top ${
                    isMatch ? "bg-[hsl(var(--gold))]/[0.06]" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-foreground/90">
                    {item.injury}
                    {item.notes && (
                      <span className="ml-2 inline-block align-middle">
                        <Chip variant="mono" className="text-[10px] px-2 py-0.5">
                          {item.notes}
                        </Chip>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-foreground whitespace-nowrap">
                    {formatRange(item)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {category.note && (
        <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
          <span className="text-[hsl(var(--gold))]/80 font-medium">{t("lib.quantum.note")}</span>
          {category.note}
        </p>
      )}

      {category.factors && category.factors.length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-[hsl(var(--gold))]/80 font-medium mb-2">
            {t("lib.quantum.factors")}
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
            {category.factors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function LibraryQuantum() {
  const { t } = useLanguage();
  const { data, isLoading, isError } = useCompendium();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.categories;
    return data.categories
      .map((cat) => {
        const catMatches =
          cat.name.toLowerCase().includes(q) ||
          cat.description.toLowerCase().includes(q);
        if (catMatches) return cat;
        const items = cat.items.filter(
          (it) =>
            it.injury.toLowerCase().includes(q) ||
            (it.notes ?? "").toLowerCase().includes(q),
        );
        return items.length > 0 ? { ...cat, items } : null;
      })
      .filter((c): c is CompendiumCategory => c !== null);
  }, [data, query]);

  const byGroup = useMemo(() => {
    const map = new Map<string, CompendiumCategory[]>();
    for (const cat of filtered) {
      const arr = map.get(cat.group) ?? [];
      arr.push(cat);
      map.set(cat.group, arr);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      categories: map.get(g)!,
    }));
  }, [filtered]);

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10">
      <BackLink href="/library" label={t("lib.nav.library")} />
      <LibraryHeader
        eyebrow={t("lib.eyebrow")}
        title={t("lib.quantum.title")}
        icon={HeartPulse}
        description={t("lib.quantum.description")}
      />

      {data?.meta && (
        <div className="card-elegant rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-3 mb-3">
            <Scale className="w-5 h-5 text-[hsl(var(--gold-bright))] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-serif text-lg font-semibold text-foreground">
                {data.meta.title} ({data.meta.effectiveYear})
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {data.meta.source}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.meta.approvedBy}
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-sm text-muted-foreground leading-relaxed mt-4 pt-4 border-t border-card-border">
            <p>
              <span className="text-[hsl(var(--gold))]/90 font-medium">
                {t("lib.quantum.guidelineStatus")}
              </span>
              {data.meta.guideline}
            </p>
            <p>
              <span className="text-[hsl(var(--gold))]/90 font-medium">
                {t("lib.quantum.leadingAuthority")}
              </span>
              {data.meta.leadingCase}
            </p>
            <p>
              <span className="text-[hsl(var(--gold))]/90 font-medium">
                {t("lib.quantum.overlappingInjuries")}
              </span>
              {data.meta.overlapPrinciple}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 card-elegant rounded-xl p-4 mb-8 text-sm text-muted-foreground">
        <AlertTriangle className="w-4 h-4 text-[hsl(var(--gold))] shrink-0 mt-0.5" />
        <p>
          {t("lib.quantum.warning")}
        </p>
      </div>

      <LibrarySearch
        value={query}
        onChange={setQuery}
        placeholder={t("lib.quantum.searchPlaceholder")}
      />

      {isLoading ? (
        <LibraryLoading label={t("lib.quantum.loading")} />
      ) : isError ? (
        <LibraryError />
      ) : byGroup.length === 0 ? (
        <LibraryEmpty
          message={
            query
              ? `${t("lib.quantum.noMatchPre")}"${query}".`
              : t("lib.quantum.noData")
          }
          icon={HeartPulse}
        />
      ) : (
        <div className="space-y-12">
          {byGroup.map(({ group, categories }) => (
            <div key={group}>
              <div className="flex items-center gap-3 mb-6">
                <h2 className="font-serif text-xl font-bold text-gradient-gold">
                  {group}
                </h2>
                <span className="flex-1 rule-gold opacity-40" />
                <span className="text-xs text-muted-foreground">
                  {categories.length}{" "}
                  {categories.length === 1 ? t("lib.quantum.category") : t("lib.quantum.categories")}
                </span>
              </div>
              <div className="space-y-8">
                {categories.map((cat) => (
                  <CategoryCard key={cat.slug} category={cat} query={query} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
