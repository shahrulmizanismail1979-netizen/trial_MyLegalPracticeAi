import { useState } from "react";
import { Link, useParams } from "wouter";
import { Gavel, MapPin, Scale, AlertTriangle, ExternalLink } from "lucide-react";
import {
  LibraryHeader,
  LibrarySearch,
  BackLink,
  Chip,
  LibraryLoading,
  LibraryEmpty,
  LibraryError,
} from "@/components/LibraryShared";
import { useLegalCases, useLegalCase } from "@/hooks/use-academic";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryCases() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const { data: cases, isLoading, isError } = useLegalCases(search.trim() || undefined);

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto p-6 md:p-10">
      <BackLink href="/library" label={t("lib.nav.library")} />
      <LibraryHeader
        eyebrow={t("lib.eyebrow")}
        title={t("lib.cases.title")}
        icon={Gavel}
        description={t("lib.cases.description")}
      />

      <LibrarySearch
        value={search}
        onChange={setSearch}
        placeholder={t("lib.cases.searchPlaceholder")}
      />

      {isLoading ? (
        <LibraryLoading label={t("lib.cases.loading")} />
      ) : isError ? (
        <LibraryError />
      ) : !cases || cases.length === 0 ? (
        <LibraryEmpty message={t("lib.cases.empty")} icon={Gavel} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {cases.map((c) => (
            <Link key={c.id} href={`/library/cases/${c.id}`}>
              <div className="card-elegant group h-full rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 flex flex-col">
                <div className="flex justify-between items-start mb-2 text-sm text-muted-foreground">
                  <span className="font-bold text-[hsl(var(--gold-bright))]">
                    {c.year}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {c.court}
                  </span>
                </div>
                <h3 className="font-serif text-xl font-semibold text-foreground leading-snug mb-1 group-hover:text-[hsl(var(--gold-bright))] transition-colors">
                  {c.caseName}
                </h3>
                <span className="text-xs font-mono text-muted-foreground mb-4">
                  {c.citation}
                </span>
                <div className="rounded-xl border border-card-border bg-white/[0.02] p-3 mb-4">
                  <p className="text-xs font-semibold mb-1 flex items-center gap-1.5 text-[hsl(var(--gold))]">
                    <Scale className="w-3.5 h-3.5" /> {t("lib.cases.held")}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {c.held}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-auto">
                  {c.tags.slice(0, 4).map((t) => (
                    <Chip key={t}>{t}</Chip>
                  ))}
                  {c.tags.length > 4 && <Chip>+{c.tags.length - 4}</Chip>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function LibraryCaseDetail() {
  const { t } = useLanguage();
  const params = useParams();
  const id = params.id ?? null;
  const { data: c, isLoading, isError } = useLegalCase(id);

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto p-6 md:p-10">
      <BackLink href="/library/cases" label={t("lib.cases.title")} />

      {isLoading ? (
        <LibraryLoading label={t("lib.cases.loadingCase")} />
      ) : isError || !c ? (
        <LibraryError message={t("lib.cases.notFound")} />
      ) : (
        <article>
          <div className="text-center mb-8 pb-8 border-b border-card-border">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-[hsl(40_42%_96%)] mb-3 leading-tight">
              {c.caseName}
            </h1>
            <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground font-mono flex-wrap">
              <span>{c.citation}</span>
              <span>•</span>
              <span>{c.court}</span>
              <span>•</span>
              <span>{c.year}</span>
            </div>
            {c.judge && (
              <p className="text-sm italic text-muted-foreground mt-2">
                Coram: {c.judge}
              </p>
            )}
            <div className="mt-4 inline-flex">
              <Chip className="text-[hsl(var(--gold-bright))] border-[hsl(var(--gold))]/30">
                <AlertTriangle className="w-3 h-3" /> {t("lib.cases.educationalRef")}
              </Chip>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--gold))] mb-3">
                {t("lib.cases.briefFacts")}
              </h2>
              <p className="text-sm text-foreground/90 leading-relaxed card-elegant rounded-xl p-4">
                {c.facts}
              </p>
            </section>
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--gold))] mb-3">
                {t("lib.cases.issues")}
              </h2>
              <ul className="text-sm text-foreground/90 card-elegant rounded-xl p-4 list-disc list-outside ml-4 space-y-2">
                {c.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </section>
          </div>

          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
              <Scale className="w-4 h-4" /> {t("lib.cases.ratioDecidendi")}
            </h2>
            <div className="card-elegant rounded-2xl p-6 text-lg font-serif text-foreground/90 leading-relaxed">
              {c.held}
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--gold))] mb-3">
              {t("lib.cases.significance")}
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {c.significance}
            </p>
          </section>

          <div className="flex flex-wrap gap-2 pt-6 border-t border-card-border mb-6">
            {c.tags.map((t) => (
              <Chip key={t} variant="gold">
                {t}
              </Chip>
            ))}
            {c.legislation.map((l) => (
              <Chip key={l} variant="mono">
                {l}
              </Chip>
            ))}
          </div>

          <div className="flex items-start gap-2 card-elegant rounded-xl p-4 text-xs text-muted-foreground">
            <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              {t("lib.cases.verifyFull")}
            </span>
          </div>
        </article>
      )}
    </div>
  );
}
