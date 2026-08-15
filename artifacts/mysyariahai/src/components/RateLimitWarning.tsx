import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { onRateLimit } from "@/lib/rate-limit-bus";

const WARN_THRESHOLD = 10;

export function RateLimitWarning() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    return onRateLimit((r) => {
      setRemaining(r);
      if (r <= WARN_THRESHOLD) setDismissed(false);
    });
  }, []);

  if (remaining === null || remaining > WARN_THRESHOLD || dismissed) return null;

  const isExhausted = remaining === 0;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={[
        "fixed bottom-24 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium",
        "max-w-sm w-[calc(100%-2rem)] sm:max-w-md",
        isExhausted
          ? "bg-destructive text-destructive-foreground border-destructive/60"
          : "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/90 dark:text-amber-100 dark:border-amber-700",
      ].join(" ")}
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1">
        {isExhausted
          ? "AI request limit reached. Please wait a moment before trying again."
          : `You're approaching your AI request limit — ${remaining} request${remaining === 1 ? "" : "s"} left this minute.`}
      </span>
      {!isExhausted && (
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
