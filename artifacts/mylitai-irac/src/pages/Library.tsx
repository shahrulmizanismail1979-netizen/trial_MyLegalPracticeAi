import { Link } from "wouter";
import {
  BookOpen,
  Gavel,
  FileSignature,
  GitBranch,
  Coins,
  BookMarked,
  HeartPulse,
  ChevronRight,
  ScrollText,
  Scale,
  Library as LibraryIcon,
} from "lucide-react";
import { LibraryHeader } from "@/components/LibraryShared";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/i18n";
import {
  useTheoryTopics,
  useLegalCases,
  useForms,
  useWorkflows,
  useCostSchedules,
  useCompendium,
  useTerms,
  usePracticeDirections,
  useBarCouncilRulings,
} from "@/hooks/use-academic";

function useCount(n: number | undefined): string {
  return typeof n === "number" ? String(n) : "—";
}

export default function Library() {
  const { t } = useLanguage();
  const theory = useTheoryTopics();
  const cases = useLegalCases();
  const forms = useForms();
  const workflows = useWorkflows();
  const costs = useCostSchedules();
  const compendium = useCompendium();
  const terms = useTerms();
  const practiceDirections = usePracticeDirections();
  const barCouncil = useBarCouncilRulings();

  const cards: {
    href: string;
    labelKey: TranslationKey;
    blurbKey: TranslationKey;
    icon: typeof BookOpen;
    count: string;
    unitKey: TranslationKey;
  }[] = [
    {
      href: "/library/theory",
      labelKey: "lib.cards.theory.label",
      blurbKey: "lib.cards.theory.blurb",
      icon: BookOpen,
      count: useCount(theory.data?.length),
      unitKey: "lib.cards.theory.unit",
    },
    {
      href: "/library/cases",
      labelKey: "lib.cards.cases.label",
      blurbKey: "lib.cards.cases.blurb",
      icon: Gavel,
      count: useCount(cases.data?.length),
      unitKey: "lib.cards.cases.unit",
    },
    {
      href: "/library/forms",
      labelKey: "lib.cards.forms.label",
      blurbKey: "lib.cards.forms.blurb",
      icon: FileSignature,
      count: useCount(forms.data?.length),
      unitKey: "lib.cards.forms.unit",
    },
    {
      href: "/library/workflows",
      labelKey: "lib.cards.workflows.label",
      blurbKey: "lib.cards.workflows.blurb",
      icon: GitBranch,
      count: useCount(workflows.data?.length),
      unitKey: "lib.cards.workflows.unit",
    },
    {
      href: "/library/costs",
      labelKey: "lib.cards.costs.label",
      blurbKey: "lib.cards.costs.blurb",
      icon: Coins,
      count: useCount(costs.data?.length),
      unitKey: "lib.cards.costs.unit",
    },
    {
      href: "/library/quantum",
      labelKey: "lib.cards.quantum.label",
      blurbKey: "lib.cards.quantum.blurb",
      icon: HeartPulse,
      count: useCount(compendium.data?.categories.length),
      unitKey: "lib.cards.quantum.unit",
    },
    {
      href: "/library/glossary",
      labelKey: "lib.cards.glossary.label",
      blurbKey: "lib.cards.glossary.blurb",
      icon: BookMarked,
      count: useCount(terms.data?.length),
      unitKey: "lib.cards.glossary.unit",
    },
    {
      href: "/library/practice-directions",
      labelKey: "lib.cards.practiceDirections.label",
      blurbKey: "lib.cards.practiceDirections.blurb",
      icon: ScrollText,
      count: useCount(practiceDirections.data?.length),
      unitKey: "lib.cards.practiceDirections.unit",
    },
    {
      href: "/library/bar-council",
      labelKey: "lib.cards.barCouncil.label",
      blurbKey: "lib.cards.barCouncil.blurb",
      icon: Scale,
      count: useCount(barCouncil.data?.length),
      unitKey: "lib.cards.barCouncil.unit",
    },
  ];

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto p-6 md:p-10">
      <LibraryHeader
        eyebrow={t("lib.eyebrow")}
        title={t("lib.index.title")}
        icon={LibraryIcon}
        description={t("lib.index.description")}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <div className="card-elegant group relative h-full rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1">
                <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-[hsl(var(--burgundy))] via-[hsl(var(--gold))] to-[hsl(var(--burgundy))] opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-start justify-between mb-4">
                  <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-[hsl(var(--gold))]/10 ring-1 ring-[hsl(var(--gold))]/30">
                    <Icon className="w-6 h-6 text-[hsl(var(--gold-bright))]" />
                  </span>
                  <span className="text-right">
                    <span className="block font-serif text-2xl font-bold text-gradient-gold leading-none">
                      {card.count}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {t(card.unitKey)}
                    </span>
                  </span>
                </div>
                <h3 className="font-serif text-xl font-semibold text-foreground mb-2 group-hover:text-[hsl(var(--gold-bright))] transition-colors">
                  {t(card.labelKey)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  {t(card.blurbKey)}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[hsl(var(--gold))] group-hover:gap-2 transition-all">
                  {t("lib.index.browse")} <ChevronRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
