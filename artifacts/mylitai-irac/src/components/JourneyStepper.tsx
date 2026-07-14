import React from "react";
import { useLocation } from "wouter";
import { Check } from "lucide-react";
import { useMatter } from "@/contexts/MatterContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  JOURNEY_STEPS,
  computeProgress,
  stepStatus,
  type JourneyStepKey,
} from "@/lib/journey";

interface JourneyStepperProps {
  /** Which step this page represents — forces the "here" highlight regardless of progress. */
  activeKey?: JourneyStepKey;
}

export function JourneyStepper({ activeKey }: JourneyStepperProps) {
  const [location, setLocation] = useLocation();
  const { t } = useLanguage();
  const { pathwayId, caseId, analyzed, drafted, replied } = useMatter();

  const progress = computeProgress({ pathwayId, caseId, analyzed, drafted, replied });

  const go = (route: string) => {
    if (route === "/" && location === "/") {
      document.getElementById("pathways")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    setLocation(route);
  };

  return (
    <nav
      aria-label={t("journey.aria")}
      className="card-elegant rounded-2xl px-3 py-4 sm:px-5"
    >
      <p className="text-[10px] tracking-[0.3em] uppercase text-[hsl(var(--gold))] font-sans mb-3 text-center sm:text-left">
        {t("journey.label")}
      </p>
      <ol className="flex items-stretch gap-1 overflow-x-auto sm:overflow-visible">
        {JOURNEY_STEPS.map((step, i) => {
          const status = stepStatus(step.key, progress);
          const isHere = activeKey === step.key;
          const Icon = step.icon;
          const done = status === "done";
          const current = status === "current" || isHere;

          return (
            <li key={step.key} className="flex items-center gap-1 shrink-0 sm:flex-1">
              <button
                type="button"
                onClick={() => go(step.route)}
                aria-current={isHere ? "step" : undefined}
                className={`group flex flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors min-w-[150px] sm:min-w-0
                  ${current ? "bg-[hsl(var(--gold))]/10 ring-1 ring-[hsl(var(--gold))]/40" : "hover:bg-white/5"}
                `}
              >
                <span
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold font-sans transition-colors
                    ${
                      done
                        ? "bg-gradient-to-br from-[hsl(var(--gold-bright))] to-[hsl(var(--gold))] text-[hsl(var(--ink-deep))] gold-glow"
                        : current
                          ? "ring-2 ring-[hsl(var(--gold-bright))] text-[hsl(var(--gold-bright))]"
                          : "ring-1 ring-[hsl(40_20%_45%)]/40 text-[hsl(40_20%_55%)]"
                    }
                  `}
                >
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-[10px] font-sans tracking-wide ${
                      current ? "text-[hsl(var(--gold-bright))]" : "text-muted-foreground"
                    }`}
                  >
                    {t("journey.step")} {step.n}
                  </span>
                  <span
                    className={`block text-sm font-serif leading-tight truncate ${
                      current ? "text-foreground" : "text-[hsl(40_28%_78%)]"
                    }`}
                  >
                    {t(step.titleKey)}
                  </span>
                </span>
              </button>
              {i < JOURNEY_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={`hidden sm:block h-px w-4 lg:w-6 shrink-0 ${
                    progress[step.key] ? "bg-[hsl(var(--gold))]/50" : "bg-[hsl(40_20%_45%)]/25"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
