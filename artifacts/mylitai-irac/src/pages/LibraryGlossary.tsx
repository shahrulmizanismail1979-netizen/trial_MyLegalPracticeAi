import { useState } from "react";
import { BookMarked, Quote, BookA } from "lucide-react";
import {
  LibraryHeader,
  LibrarySearch,
  BackLink,
  Chip,
  LibraryLoading,
  LibraryEmpty,
  LibraryError,
} from "@/components/LibraryShared";
import { useTerms } from "@/hooks/use-academic";
import { useLanguage } from "@/contexts/LanguageContext";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function LibraryGlossary() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [letter, setLetter] = useState("");
  const { data: terms, isLoading, isError } = useTerms(
    search.trim() || undefined,
    letter || undefined,
  );

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto p-6 md:p-10">
      <BackLink href="/library" label={t("lib.nav.library")} />
      <LibraryHeader
        eyebrow={t("lib.eyebrow")}
        title={t("lib.glossary.title")}
        icon={BookMarked}
        description={t("lib.glossary.description")}
      />

      <LibrarySearch
        value={search}
        onChange={(v) => {
          setSearch(v);
          if (v) setLetter("");
        }}
        placeholder={t("lib.glossary.searchPlaceholder")}
      />

      <div className="flex flex-wrap justify-center gap-1.5 mb-10">
        <button
          onClick={() => {
            setLetter("");
            setSearch("");
          }}
          className={`w-9 h-9 rounded-md flex items-center justify-center text-sm font-semibold transition-colors border ${
            letter === ""
              ? "bg-[hsl(var(--gold))] text-[hsl(var(--ink-deep))] border-[hsl(var(--gold))]"
              : "bg-card text-muted-foreground border-card-border hover:border-[hsl(var(--gold))]/40 hover:text-foreground"
          }`}
        >
          {t("common.all")}
        </button>
        {ALPHABET.map((l) => (
          <button
            key={l}
            onClick={() => {
              setLetter(l);
              setSearch("");
            }}
            className={`w-9 h-9 rounded-md flex items-center justify-center text-sm font-semibold transition-colors border ${
              letter === l
                ? "bg-[hsl(var(--gold))] text-[hsl(var(--ink-deep))] border-[hsl(var(--gold))]"
                : "bg-card text-muted-foreground border-card-border hover:border-[hsl(var(--gold))]/40 hover:text-foreground"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LibraryLoading label="Loading glossary…" />
      ) : isError ? (
        <LibraryError />
      ) : !terms || terms.length === 0 ? (
        <LibraryEmpty message="No terms found matching your search." icon={BookMarked} />
      ) : (
        <div className="space-y-4">
          {terms.map((term) => (
            <div key={term.id} className="card-elegant rounded-2xl p-6 md:p-7">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-1/3">
                  <h3 className="font-serif text-2xl font-bold text-[hsl(var(--gold-bright))] mb-2">
                    {term.term}
                  </h3>
                  {term.latinOrigin && (
                    <p className="text-sm italic text-muted-foreground mb-3 font-serif">
                      {t("lib.glossary.latin")} {term.latinOrigin}
                    </p>
                  )}
                  <Chip variant="gold">{term.category}</Chip>
                </div>

                <div className="md:w-2/3 space-y-4">
                  <p className="text-foreground/90 leading-relaxed rounded-xl border border-card-border bg-white/[0.02] p-4">
                    {term.definition}
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {term.example && (
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                          <Quote className="w-3 h-3" /> {t("lib.glossary.contextExample")}
                        </h4>
                        <p className="text-sm text-foreground/80 italic">
                          {term.example}
                        </p>
                      </div>
                    )}
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
                        <BookA className="w-3 h-3" /> {t("lib.glossary.authority")}
                      </h4>
                      <p className="text-sm font-mono text-[hsl(var(--gold))]/80">
                        {term.source}
                      </p>
                    </div>
                  </div>

                  {term.relatedTerms.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-2 items-center text-sm">
                      <span className="text-muted-foreground">{t("lib.glossary.seeAlso")}</span>
                      {term.relatedTerms.map((rt) => (
                        <Chip key={rt}>{rt}</Chip>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
