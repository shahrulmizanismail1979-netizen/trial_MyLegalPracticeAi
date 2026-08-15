import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Check,
  Sparkles,
} from "lucide-react";

export type TutorialStep = {
  title: string;
  body: ReactNode;
  icon?: ReactNode;
  accentClass?: string;
};

type Props = {
  storageKey: string;
  title: string;
  steps: TutorialStep[];
  buttonLabel?: string;
};

/**
 * Floating help button + multi-step tutorial overlay (aurora theme).
 *
 * Auto-opens once per user per `storageKey`.
 */
export function Tutorial({ storageKey, title, steps, buttonLabel = "Tour" }: Props) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        const t = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      // ignore
    }
    return undefined;
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? dialog)?.focus();
    return () => {
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAndMark();
        return;
      }
      if (e.key === "ArrowRight" && stepIndex < steps.length - 1) setStepIndex(stepIndex + 1);
      if (e.key === "ArrowLeft" && stepIndex > 0) setStepIndex(stepIndex - 1);
      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusables = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute("disabled"));
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex]);

  const closeAndMark = () => {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
    setOpen(false);
    setStepIndex(0);
  };

  const reopen = () => {
    setStepIndex(0);
    setOpen(true);
  };

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const overlay =
    open && step ? (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="tutorial-overlay"
      >
        <div
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          onClick={closeAndMark}
        />
        <div
          ref={dialogRef}
          tabIndex={-1}
          className="relative w-full max-w-xl rounded-3xl border border-fuchsia-500/30 bg-gradient-to-br from-black/95 via-black/90 to-fuchsia-950/40 shadow-[0_30px_80px_-20px_rgba(217,70,239,0.4)] overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60"
        >
          <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay">
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-400/10 via-transparent to-amber-500/10" />
          </div>

          <button
            type="button"
            onClick={closeAndMark}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            aria-label="Close tutorial"
            data-testid="tutorial-close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/40 text-fuchsia-200 text-[0.6rem] uppercase tracking-[0.3em] font-bold">
                <Sparkles className="w-3 h-3" />
                {title}
              </div>
              <div className="text-[0.65rem] uppercase tracking-widest text-muted-foreground font-bold ml-auto mr-8">
                Step {stepIndex + 1} of {steps.length}
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div
                className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center border ${
                  step.accentClass ?? "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300"
                }`}
              >
                {step.icon ?? <Sparkles className="w-6 h-6" />}
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <h3
                  id={titleId}
                  className="font-display text-2xl font-bold text-aurora leading-tight"
                >
                  {step.title}
                </h3>
                <div className="text-sm text-foreground/85 leading-relaxed space-y-2">
                  {step.body}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 pt-2">
              {steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStepIndex(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === stepIndex
                      ? "bg-gradient-to-r from-fuchsia-400 to-pink-500 w-10"
                      : i < stepIndex
                        ? "bg-fuchsia-500/40 w-4"
                        : "bg-white/10 w-4 hover:bg-white/20"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
                disabled={stepIndex === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border border-white/10 text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                data-testid="tutorial-prev"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button
                type="button"
                onClick={closeAndMark}
                className="text-[0.65rem] uppercase tracking-widest text-white/40 hover:text-white/70"
              >
                Skip
              </button>
              {isLast ? (
                <button
                  type="button"
                  onClick={closeAndMark}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-white bg-gradient-to-br from-fuchsia-500 via-purple-600 to-violet-700 shadow-[0_4px_20px_-5px_rgba(217,70,239,0.5)] hover:shadow-[0_8px_25px_-5px_rgba(217,70,239,0.7)] transition-all"
                  data-testid="tutorial-finish"
                >
                  <Check className="w-4 h-4" />
                  Got it
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStepIndex(stepIndex + 1)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-white bg-gradient-to-br from-fuchsia-500 via-purple-600 to-violet-700 shadow-[0_4px_20px_-5px_rgba(217,70,239,0.5)] hover:shadow-[0_8px_25px_-5px_rgba(217,70,239,0.7)] transition-all"
                  data-testid="tutorial-next"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={reopen}
        className="fixed right-6 z-[150] inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-br from-fuchsia-500 via-purple-600 to-violet-700 text-white font-bold text-xs uppercase tracking-widest shadow-[0_10px_30px_-5px_rgba(217,70,239,0.5)] hover:shadow-[0_15px_40px_-5px_rgba(217,70,239,0.7)] hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        style={{ bottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}
        aria-label={`Open ${title} tutorial`}
        data-testid="tutorial-trigger"
      >
        <HelpCircle className="w-4 h-4" />
        {buttonLabel}
      </button>
      {overlay && typeof document !== "undefined"
        ? createPortal(overlay, document.body)
        : null}
    </>
  );
}
