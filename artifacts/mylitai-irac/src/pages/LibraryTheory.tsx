import { useState, useMemo } from "react";
import { Link, useParams } from "wouter";
import { BookOpen, Scale, FileText, ChevronRight, AlertTriangle } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import {
  LibraryHeader,
  LibrarySearch,
  BackLink,
  Chip,
  LibraryLoading,
  LibraryEmpty,
  LibraryError,
} from "@/components/LibraryShared";
import { useTheoryTopics, useTheoryTopic } from "@/hooks/use-academic";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryTheory() {
  const { t } = useLanguage();
  const { data: topics, isLoading, isError } = useTheoryTopics();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!topics) return [];
    const q = search.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.overview.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }, [topics, search]);

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto p-6 md:p-10">
      <BackLink href="/library" label={t("lib.nav.library")} />
      <LibraryHeader
        eyebrow={t("lib.eyebrow")}
        title={t("lib.theory.title")}
        icon={BookOpen}
        description={t("lib.theory.description")}
      />

      <LibrarySearch
        value={search}
        onChange={setSearch}
        placeholder={t("lib.theory.searchPlaceholder")}
      />

      {isLoading ? (
        <LibraryLoading label={t("lib.theory.loading")} />
      ) : isError ? (
        <LibraryError />
      ) : filtered.length === 0 ? (
        <LibraryEmpty message={t("lib.theory.empty")} icon={BookOpen} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((topic) => (
            <Link key={topic.id} href={`/library/theory/${topic.id}`}>
              <div className="card-elegant group h-full rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <Chip variant="gold">{topic.category}</Chip>
                  <BookOpen className="w-5 h-5 text-[hsl(var(--gold))] opacity-40" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground mb-2 leading-snug group-hover:text-[hsl(var(--gold-bright))] transition-colors">
                  {topic.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1 mb-4">
                  {topic.overview}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Scale className="w-3 h-3 text-[hsl(var(--gold))]" />
                    {topic.keyPrinciples.length} {t("lib.theory.principles")}
                  </span>
                  <span>·</span>
                  <span>{topic.legislation.length} {t("lib.theory.statutes")}</span>
                  <ChevronRight className="w-4 h-4 ml-auto text-[hsl(var(--gold))]" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function LibraryTheoryDetail() {
  const { t } = useLanguage();
  const params = useParams();
  const id = params.id ?? null;
  const { data: topic, isLoading, isError } = useTheoryTopic(id);

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto p-6 md:p-10">
      <BackLink href="/library/theory" label={t("lib.theory.title")} />

      {isLoading ? (
        <LibraryLoading label={t("lib.theory.loadingModule")} />
      ) : isError || !topic ? (
        <LibraryError message={t("lib.theory.notFound")} />
      ) : (
        <article>
          <div className="text-center mb-8">
            <Chip variant="gold" className="mb-4">
              {topic.category}
            </Chip>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-[hsl(40_42%_96%)] mb-4 leading-tight">
              {topic.title}
            </h1>
            <div className="rule-gold w-32 mx-auto" />
          </div>

          <div className="card-elegant rounded-2xl p-6 mb-8">
            <p className="text-base text-foreground/90 leading-relaxed font-sans">
              {topic.overview}
            </p>
          </div>

          {topic.keyPrinciples.length > 0 && (
            <section className="mb-10">
              <h2 className="font-serif text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <Scale className="w-5 h-5 text-[hsl(var(--gold))]" /> {t("common.principles")}
              </h2>
              <div className="grid gap-3">
                {topic.keyPrinciples.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 card-elegant rounded-xl p-4"
                  >
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[hsl(var(--gold))]/10 ring-1 ring-[hsl(var(--gold))]/30 text-[hsl(var(--gold-bright))] font-bold text-sm shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground/90 leading-relaxed pt-0.5">
                      {p}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {topic.legislation.length > 0 && (
            <section className="mb-10">
              <h2 className="font-serif text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[hsl(var(--gold))]" /> {t("lib.theory.relevantLegislation")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {topic.legislation.map((leg, i) => (
                  <Chip key={i} variant="mono">
                    {leg}
                  </Chip>
                ))}
              </div>
            </section>
          )}

          {topic.content && (
            <section className="mb-10">
              <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
                {t("lib.theory.fullModule")}
              </h2>
              <div className="card-elegant rounded-2xl p-6">
                <MarkdownRenderer content={topic.content} />
              </div>
            </section>
          )}

          {topic.relatedCases.length > 0 && (
            <section className="card-elegant rounded-2xl p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="font-serif text-lg font-semibold text-[hsl(var(--gold-bright))]">
                  {t("lib.theory.keyAuthorities")}
                </h2>
                <Chip className="text-[hsl(var(--gold-bright))] border-[hsl(var(--gold))]/30">
                  <AlertTriangle className="w-3 h-3" /> {t("lib.theory.verifyIndependently")}
                </Chip>
              </div>
              <ul className="space-y-2">
                {topic.relatedCases.map((rc, i) => (
                  <li
                    key={i}
                    className="text-sm font-medium text-foreground/90 border-l-2 border-[hsl(var(--gold))]/50 pl-3"
                  >
                    {rc}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground border-t border-card-border pt-3 mt-4">
                {t("lib.theory.verifyCitations")}
              </p>
            </section>
          )}
        </article>
      )}
    </div>
  );
}
