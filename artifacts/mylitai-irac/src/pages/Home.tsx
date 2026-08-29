import React from "react";
import { useLocation, Link } from "wouter";
import { usePathways } from "@/hooks/use-irac-api";
import { useMatter } from "@/contexts/MatterContext";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Scale,
  BookOpen,
  ChevronRight,
  Library,
  Gavel,
  FileSignature,
  GitBranch,
  Coins,
  BookMarked,
  ArrowRight,
  ScanSearch,
  Mic,
  FolderLock,
  ScrollText,
} from "lucide-react";
import { motion } from "framer-motion";
import { JOURNEY_STEPS } from "@/lib/journey";
import { PersonaBadge, PersonaSwitcher } from "@/components/PersonaControls";

const STAT_PILLS: { href: string; labelKey: TranslationKey; icon: typeof BookOpen }[] = [
  { href: "/library/theory", labelKey: "home.pills.theory", icon: BookOpen },
  { href: "/library/cases", labelKey: "home.pills.cases", icon: Gavel },
  { href: "/library/forms", labelKey: "home.pills.forms", icon: FileSignature },
  { href: "/library/workflows", labelKey: "home.pills.workflows", icon: GitBranch },
  { href: "/library/costs", labelKey: "home.pills.costs", icon: Coins },
  { href: "/library/glossary", labelKey: "home.pills.glossary", icon: BookMarked },
  { href: "/library/practice-directions", labelKey: "home.pills.practiceDirections", icon: ScrollText },
  { href: "/library/bar-council", labelKey: "home.pills.barCouncil", icon: Scale },
];

// The "How it works" cards render from the single shared journey definition
// (src/lib/journey.ts) so the home page and the in-app stepper never drift.
const HOW_STEPS = JOURNEY_STEPS;

// Companion tools that plug into the guided journey above — each caption says
// where it fits, so the Transcribe / Vault / Enforcement features are never
// "orphaned" from the overall flow.
const COMPANION_TOOLS: {
  icon: typeof ScanSearch;
  labelKey: TranslationKey;
  captionKey: TranslationKey;
  href: string;
}[] = [
  { icon: Mic, labelKey: "home.tool.transcribe.label", captionKey: "home.tool.transcribe.caption", href: "/transcription" },
  { icon: ScanSearch, labelKey: "home.tool.analyzer.label", captionKey: "home.tool.analyzer.caption", href: "/analyzer" },
  { icon: FolderLock, labelKey: "home.tool.vault.label", captionKey: "home.tool.vault.caption", href: "/vault" },
  { icon: Scale, labelKey: "home.tool.enforcement.label", captionKey: "home.tool.enforcement.caption", href: "/enforcement" },
];

export default function Home() {
  const { data: pathways, isLoading } = usePathways();
  const [, setLocation] = useLocation();
  const { setMatter, clearMatter } = useMatter();
  const { t } = useLanguage();

  const handleSelectPathway = (pathwayId: string) => {
    clearMatter(); // Start fresh
    setMatter("", pathwayId); // Empty caseId, but pathway is selected
    setLocation("/matter");
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto p-6 md:p-10">
      {/* Hero */}
      <div className="surface-ink relative overflow-hidden rounded-2xl shadow-2xl mt-4 mb-14 ring-1 ring-white/5">
        <div className="relative z-10 px-6 py-16 md:px-16 md:py-24 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center justify-center w-16 h-16 mb-8 rounded-2xl bg-gradient-to-br from-[hsl(var(--gold-bright))] to-[hsl(var(--gold))] gold-glow">
            <Scale className="w-8 h-8 text-[hsl(var(--ink-deep))]" />
          </span>
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-[hsl(40_42%_96%)] mb-6 leading-[1.05]">
            MyLitigation<span className="text-gradient-gold">Practice</span>AI
          </h1>
          <div className="rule-gold w-40 mx-auto mb-6" />
          <p className="mt-7 text-base md:text-lg text-[hsl(40_24%_78%)] leading-relaxed font-sans max-w-2xl mx-auto">
            {t("home.hero.intro")}
          </p>

          {/* Academic library stat pills */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5">
            {STAT_PILLS.map((pill) => {
              const Icon = pill.icon;
              return (
                <Link
                  key={pill.href}
                  href={pill.href}
                  className="chip-glass inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium text-[hsl(40_28%_85%)] transition-colors"
                >
                  <Icon className="w-4 h-4 text-[hsl(var(--gold-bright))]" />
                  {t(pill.labelKey)}
                </Link>
              );
            })}
          </div>

          <Link
            href="/library"
            className="mt-9 inline-flex items-center gap-2 px-7 py-3 rounded-full font-sans font-semibold text-[hsl(var(--ink-deep))] bg-gradient-to-br from-[hsl(var(--gold-bright))] to-[hsl(var(--gold))] gold-glow hover:brightness-105 transition"
          >
            {t("home.hero.explore")}
            <ChevronRight className="w-4 h-4" />
          </Link>
          <PersonaBadge />
          <p className="mt-7 text-[11px] tracking-[0.25em] uppercase text-[hsl(220_12%_45%)] font-sans">
            {t("home.hero.platformTag")}
          </p>
        </div>
      </div>

      {/* How it works — visual manual */}
      <section className="mb-16">
        <div className="text-center mb-10">
          <p className="text-[11px] tracking-[0.3em] uppercase text-[hsl(var(--gold))] font-sans mb-3">
            {t("home.how.eyebrow")}
          </p>
          <h2 className="text-3xl md:text-4xl font-serif font-semibold text-foreground">
            {t("home.how.title")}
          </h2>
          <p className="mt-4 text-sm text-muted-foreground max-w-xl mx-auto font-sans">
            {t("home.how.subtitle")}
          </p>
          <div className="rule-gold w-40 mx-auto mt-5" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {HOW_STEPS.map((step, i) => {
            const Icon = step.icon;
            const handleStep = () => {
              if (step.route === "/") {
                document.getElementById("pathways")?.scrollIntoView({ behavior: "smooth" });
              } else {
                setLocation(step.route);
              }
            };
            return (
              <motion.div
                key={step.n}
                className="relative"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.45 }}
              >
                <button
                  type="button"
                  onClick={handleStep}
                  className="card-elegant h-full w-full rounded-2xl p-6 pt-8 text-center transition-all hover:-translate-y-1 hover:border-[hsl(var(--gold))]/60 hover:shadow-xl cursor-pointer group"
                >
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-bold text-[hsl(var(--ink-deep))] bg-gradient-to-br from-[hsl(var(--gold-bright))] to-[hsl(var(--gold))] gold-glow font-sans">
                    {step.n}
                  </span>
                  <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--gold-bright))]/15 to-[hsl(var(--gold))]/5 ring-1 ring-[hsl(var(--gold))]/30">
                    <Icon className="h-7 w-7 text-[hsl(var(--gold-bright))]" />
                  </span>
                  <h3 className="font-serif text-lg text-foreground mb-1.5 group-hover:text-primary transition-colors">{t(step.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground leading-snug">{t(step.captionKey)}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-sans font-medium text-[hsl(var(--gold))] opacity-0 group-hover:opacity-100 transition-opacity">
                    {t("home.step.open")}
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </button>
                {i < HOW_STEPS.length - 1 && (
                  <ArrowRight className="hidden lg:block absolute top-[64px] -right-[16px] z-10 h-5 w-5 text-[hsl(var(--gold))]/55" />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Companion tools — how Transcribe / Analyzer / Vault / Enforcement
            fit around the five-step journey above. */}
        <div className="mt-16 text-center mb-8">
          <p className="text-[11px] tracking-[0.3em] uppercase text-[hsl(var(--gold))] font-sans mb-3">
            {t("home.tools.eyebrow")}
          </p>
          <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground">
            {t("home.tools.title")}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto font-sans">
            {t("home.tools.subtitle")}
          </p>
          <div className="rule-gold w-32 mx-auto mt-5" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {COMPANION_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="card-elegant rounded-2xl p-6 text-left transition-all hover:-translate-y-1 hover:border-[hsl(var(--gold))]/60 hover:shadow-xl group"
              >
                <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--gold-bright))]/15 to-[hsl(var(--gold))]/5 ring-1 ring-[hsl(var(--gold))]/30">
                  <Icon className="h-5 w-5 text-[hsl(var(--gold-bright))]" />
                </span>
                <h3 className="font-serif text-lg text-foreground mb-1.5 group-hover:text-primary transition-colors">
                  {t(tool.labelKey)}
                </h3>
                <p className="text-sm text-muted-foreground leading-snug">
                  {t(tool.captionKey)}
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <div id="pathways" className="mb-8 flex items-center gap-3 border-b-2 border-[hsl(var(--gold))]/40 pb-3 scroll-mt-24">
        <Library className="w-6 h-6 text-[hsl(var(--gold))]" />
        <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground">
          {t("home.pathways.title")}
        </h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-48 animate-pulse bg-card/50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pathways?.map((pathway, i) => (
            <motion.div
              key={pathway.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4 }}
            >
              <Card 
                className="relative h-full overflow-hidden border-card-border bg-card hover:-translate-y-1 hover:border-[hsl(var(--gold))]/60 hover:shadow-xl hover:shadow-[hsl(var(--oxford))]/15 transition-all duration-300 flex flex-col cursor-pointer group"
                onClick={() => handleSelectPathway(pathway.id)}
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[hsl(var(--burgundy))] via-[hsl(var(--gold))] to-[hsl(var(--burgundy))] opacity-70 group-hover:opacity-100 transition-opacity" />
                <CardHeader>
                  <CardTitle className="font-serif text-xl text-foreground group-hover:text-primary transition-colors">
                    {pathway.label}
                  </CardTitle>
                  <CardDescription className="text-sm font-semibold text-[hsl(var(--gold))]">
                    {pathway.court}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between">
                  <p className="text-sm text-muted-foreground mb-4">
                    {pathway.blurb}
                  </p>
                  <div className="mt-auto">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 opacity-70">
                      <BookOpen className="w-3 h-3" />
                      <span className="truncate">{pathway.keyLegislation.join(", ")}</span>
                    </div>
                    <Button variant="outline" className="w-full justify-between border-border text-foreground hover:bg-primary hover:text-primary-foreground group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                      {t("home.pathways.startMatter")}
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-14 max-w-md">
        <PersonaSwitcher />
      </div>
    </div>
  );
}
