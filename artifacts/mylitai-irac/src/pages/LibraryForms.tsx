import { useState, useMemo } from "react";
import { Link, useParams } from "wouter";
import { FileSignature, FileText, ChevronRight, AlertTriangle } from "lucide-react";
import {
  LibraryHeader,
  LibrarySearch,
  BackLink,
  Chip,
  LibraryLoading,
  LibraryEmpty,
  LibraryError,
} from "@/components/LibraryShared";
import { useForms, useForm } from "@/hooks/use-academic";
import { useLanguage } from "@/contexts/LanguageContext";

export default function LibraryForms() {
  const { t } = useLanguage();
  const { data: forms, isLoading, isError } = useForms();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!forms) return [];
    const q = search.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.formNumber.toLowerCase().includes(q) ||
        f.purpose.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q),
    );
  }, [forms, search]);

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto p-6 md:p-10">
      <BackLink href="/library" label={t("lib.nav.library")} />
      <LibraryHeader
        eyebrow={t("lib.eyebrow")}
        title={t("lib.forms.title")}
        icon={FileSignature}
        description={t("lib.forms.description")}
      />

      <LibrarySearch
        value={search}
        onChange={setSearch}
        placeholder={t("lib.forms.searchPlaceholder")}
      />

      {isLoading ? (
        <LibraryLoading label={t("lib.forms.loading")} />
      ) : isError ? (
        <LibraryError />
      ) : filtered.length === 0 ? (
        <LibraryEmpty message={t("lib.forms.empty")} icon={FileSignature} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((form) => (
            <Link key={form.id} href={`/library/forms/${form.id}`}>
              <div className="card-elegant group h-full rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <Chip variant="mono">{form.formNumber}</Chip>
                  <Chip variant="gold">{form.category}</Chip>
                </div>
                <h3 className="font-serif text-lg font-semibold text-foreground leading-snug mb-2 group-hover:text-[hsl(var(--gold-bright))] transition-colors">
                  {form.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1 mb-4">
                  {form.purpose}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("lib.forms.filingFee")} {form.filingFee}</span>
                  <ChevronRight className="w-4 h-4 text-[hsl(var(--gold))]" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function LibraryFormDetail() {
  const { t } = useLanguage();
  const params = useParams();
  const id = params.id ?? null;
  const { data: form, isLoading, isError } = useForm(id);

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto p-6 md:p-10">
      <BackLink href="/library/forms" label={t("lib.forms.title")} />

      {isLoading ? (
        <LibraryLoading label={t("lib.forms.loadingForm")} />
      ) : isError || !form ? (
        <LibraryError message={t("lib.forms.notFound")} />
      ) : (
        <article>
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Chip variant="mono">{form.formNumber}</Chip>
              <Chip variant="gold">{form.category}</Chip>
            </div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-[hsl(40_42%_96%)] mb-4 leading-tight">
              {form.title}
            </h1>
            <div className="rule-gold w-32 mx-auto" />
          </div>

          <section className="card-elegant rounded-2xl p-6 mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--gold))] mb-3">
              {t("lib.forms.purpose")}
            </h2>
            <p className="text-base text-foreground/90 leading-relaxed">
              {form.purpose}
            </p>
          </section>

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="card-elegant rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{t("lib.forms.filingFeeLabel")}</p>
              <p className="text-sm font-medium text-foreground">{form.filingFee}</p>
            </div>
            <div className="card-elegant rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">{t("lib.forms.authority")}</p>
              <p className="text-sm font-mono text-[hsl(var(--gold))]/80">
                {form.authorizedBy}
              </p>
            </div>
            {form.timeLimit && (
              <div className="card-elegant rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">{t("lib.forms.timeLimit")}</p>
                <p className="text-sm font-medium text-foreground">{form.timeLimit}</p>
              </div>
            )}
          </div>

          <section className="card-elegant rounded-2xl p-6 mb-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--gold))] mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" /> {t("lib.forms.filingInstructions")}
            </h2>
            <p className="text-sm text-foreground/90 leading-relaxed">
              {form.instructions}
            </p>
          </section>

          {form.fields.length > 0 && (
            <section className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--gold))] mb-3">
                {t("lib.forms.requiredFields")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {form.fields.map((field, i) => (
                  <Chip key={i}>{field}</Chip>
                ))}
              </div>
            </section>
          )}

          {form.notes && (
            <div className="flex items-start gap-2 card-elegant rounded-xl p-4 text-sm text-muted-foreground">
              <AlertTriangle className="w-4 h-4 text-[hsl(var(--gold))] shrink-0 mt-0.5" />
              <p>{form.notes}</p>
            </div>
          )}
        </article>
      )}
    </div>
  );
}
