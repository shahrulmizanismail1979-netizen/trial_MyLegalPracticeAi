import { useRecorder, formatElapsed, type RecordingResult } from "@/hooks/useRecorder";
import { Button } from "@/components/ui/button";
import { Mic, Square, RotateCcw, CheckCircle2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useEffect, useRef } from "react";

type Props = {
  onResult: (result: RecordingResult | null) => void;
  hint?: string;
};

/**
 * Self-contained microphone recorder UI. Emits the recorded audio (base64 +
 * mime) to the parent via onResult, and null when cleared.
 */
export function AudioRecorder({ onResult, hint }: Props) {
  const t = useT();
  const { state, elapsedMs, error, result, supported, start, stop, reset } =
    useRecorder();
  const lastEmitted = useRef<RecordingResult | null>(null);

  useEffect(() => {
    if (result !== lastEmitted.current) {
      lastEmitted.current = result;
      onResult(result);
    }
  }, [result, onResult]);

  const handleReset = () => {
    reset();
    onResult(null);
  };

  return (
    <div className="space-y-3">
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}

      {state !== "ready" && (
        <div className="flex items-center gap-3">
          {state === "recording" ? (
            <Button
              type="button"
              variant="destructive"
              onClick={stop}
              className="gap-2"
            >
              <Square className="h-4 w-4" />
              {t("rec.stop")}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={start}
              disabled={!supported}
              className="gap-2"
            >
              <Mic className="h-4 w-4" />
              {t("rec.start")}
            </Button>
          )}
          {state === "recording" && (
            <span className="flex items-center gap-2 text-sm font-medium text-destructive">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
              {t("rec.recording", { time: formatElapsed(elapsedMs) })}
            </span>
          )}
        </div>
      )}

      {state === "ready" && result && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-primary">
            <CheckCircle2 className="h-4 w-4" />
            {t("rec.ready", { time: formatElapsed(elapsedMs) })}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t("rec.rerecord")}
          </Button>
        </div>
      )}

      {error === "denied" && (
        <p className="text-sm font-medium text-destructive">{t("rec.denied")}</p>
      )}
      {(error === "unsupported" || !supported) && (
        <p className="text-sm font-medium text-destructive">
          {t("rec.unsupported")}
        </p>
      )}
    </div>
  );
}
