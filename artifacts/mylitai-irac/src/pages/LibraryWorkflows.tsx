import { useState, useMemo } from "react";
import { Link, useParams } from "wouter";
import {
  GitBranch,
  Clock,
  FileCheck,
  CheckCircle2,
  FileText,
  ChevronRight,
} from "lucide-react";
import {
  LibraryHeader,
  LibrarySearch,
  BackLink,
  Chip,
  LibraryLoading,
  LibraryEmpty,
  LibraryError,
} from "@/components/LibraryShared";
import { useWorkflows, useWorkflow } from "@/hooks/use-academic";
import { useLanguage } from "@/contexts/LanguageContext";
import type { WorkflowStep } from "@/lib/irac-api";

export default function LibraryWorkflows() {
  const { t } = useLanguage();
  const { data: workflows, isLoading, isError } = useWorkflows();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!workflows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return workflows;
    return workflows.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q),
    );
  }, [workflows, search]);

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto p-6 md:p-10">
      <BackLink href="/library" label={t("lib.nav.library")} />
      <LibraryHeader
        eyebrow={t("lib.eyebrow")}
        title={t("lib.workflows.title")}
        icon={GitBranch}
        description={t("lib.workflows.description")}
      />

      <LibrarySearch
        value={search}
        onChange={setSearch}
        placeholder={t("lib.workflows.searchPlaceholder")}
      />

      {isLoading ? (
        <LibraryLoading label={t("lib.workflows.loading")} />
      ) : isError ? (
        <LibraryError />
      ) : filtered.length === 0 ? (
        <LibraryEmpty message={t("lib.workflows.empty")} icon={GitBranch} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filtered.map((wf) => (
            <Link key={wf.id} href={`/library/workflows/${wf.id}`}>
              <div className="card-elegant group h-full rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <Chip variant="gold">{wf.category}</Chip>
                  {wf.estimatedDuration && (
                    <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                      <Clock className="w-3 h-3" /> {wf.estimatedDuration}
                    </span>
                  )}
                </div>
                <h3 className="font-serif text-xl font-semibold text-foreground leading-snug mb-2 group-hover:text-[hsl(var(--gold-bright))] transition-colors">
                  {wf.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1 mb-4">
                  {wf.description}
                </p>
                <div className="flex items-center justify-between text-xs font-medium text-foreground/80">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <GitBranch className="w-4 h-4 text-[hsl(var(--gold))]" />{" "}
                      {wf.steps.length} {t("lib.workflows.steps")}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileCheck className="w-4 h-4 text-[hsl(var(--gold))]" />{" "}
                      {wf.sampleDocuments.length} {t("lib.workflows.documents")}
                    </span>
                  </div>
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

function WorkflowTimeline({ steps }: { steps: WorkflowStep[] }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <div key={step.stepNumber} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold border-2 shrink-0 z-10 ${
                  isLast
                    ? "bg-[hsl(var(--gold))] text-[hsl(var(--ink-deep))] border-[hsl(var(--gold))]"
                    : "bg-card text-[hsl(var(--gold-bright))] border-[hsl(var(--gold))]/60"
                }`}
              >
                {isLast ? <CheckCircle2 className="w-4 h-4" /> : step.stepNumber}
              </span>
              {!isLast && (
                <span className="w-0.5 flex-1 min-h-[1.5rem] bg-gradient-to-b from-[hsl(var(--gold))]/50 to-[hsl(var(--gold))]/10 mt-1" />
              )}
            </div>
            <div className={`flex-1 ${isLast ? "pb-1" : "pb-5"}`}>
              <div className="card-elegant rounded-xl p-4">
                <h4 className="font-semibold text-base text-foreground leading-tight mb-2">
                  {t("lib.workflows.step")} {step.stepNumber}: {step.title}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  {step.description}
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {step.timeframe && (
                    <Chip variant="gold">
                      <Clock className="w-3 h-3" /> {step.timeframe}
                    </Chip>
                  )}
                  {step.documents.map((d, i) => (
                    <Chip key={i}>
                      <FileText className="w-3 h-3" /> {d}
                    </Chip>
                  ))}
                </div>
                {step.legalBasis && (
                  <p className="mt-3 text-xs font-mono text-[hsl(var(--gold))]/80">
                    {step.legalBasis}
                  </p>
                )}
                {step.notes && (
                  <p className="mt-2 text-xs italic text-muted-foreground border-l-2 border-[hsl(var(--gold))]/40 pl-2">
                    {step.notes}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LibraryWorkflowDetail() {
  const { t } = useLanguage();
  const params = useParams();
  const id = params.id ?? null;
  const { data: wf, isLoading, isError } = useWorkflow(id);

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto p-6 md:p-10">
      <BackLink href="/library/workflows" label={t("lib.workflows.title")} />

      {isLoading ? (
        <LibraryLoading label={t("lib.workflows.loadingWorkflow")} />
      ) : isError || !wf ? (
        <LibraryError message={t("lib.workflows.notFound")} />
      ) : (
        <article>
          <div className="text-center mb-8">
            <Chip variant="gold" className="mb-4">
              {wf.category}
            </Chip>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-[hsl(40_42%_96%)] mb-4 leading-tight">
              {wf.title}
            </h1>
            <div className="rule-gold w-32 mx-auto mb-5" />
            <p className="text-base text-muted-foreground leading-relaxed">
              {wf.description}
            </p>
          </div>

          <div className="card-elegant rounded-2xl p-5 mb-8 text-sm space-y-2">
            <p>
              <strong className="text-foreground">{t("lib.workflows.appliesTo")}</strong>{" "}
              <span className="text-muted-foreground">{wf.applicableTo}</span>
            </p>
            <p>
              <strong className="text-foreground">{t("lib.workflows.legalBasis")}</strong>{" "}
              <span className="font-mono text-[hsl(var(--gold))]/80 text-xs">
                {wf.legalBasis}
              </span>
            </p>
            {wf.estimatedDuration && (
              <p>
                <strong className="text-foreground">{t("lib.workflows.estimatedDuration")}</strong>{" "}
                <span className="text-muted-foreground">{wf.estimatedDuration}</span>
              </p>
            )}
          </div>

          <section className="mb-10">
            <h2 className="font-serif text-xl font-semibold text-foreground mb-6 flex items-center gap-2 border-b border-card-border pb-3">
              <GitBranch className="w-5 h-5 text-[hsl(var(--gold))]" /> {t("lib.workflows.stepByStep")}
            </h2>
            <WorkflowTimeline steps={wf.steps} />
          </section>

          {wf.sampleDocuments.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--gold))] mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4" /> {t("lib.workflows.sampleDocuments")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {wf.sampleDocuments.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 card-elegant rounded-xl p-3"
                  >
                    <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[hsl(var(--gold))]/10 shrink-0">
                      <FileText className="w-5 h-5 text-[hsl(var(--gold))]" />
                    </span>
                    <span className="text-sm font-medium text-foreground/90">
                      {doc}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </article>
      )}
    </div>
  );
}
