import { useEffect, useState } from "react";
import {
  useGetTaskAssessment,
  useUpsertTaskAssessment,
  getGetTaskAssessmentQueryKey,
  getGetRecognitionLeaderboardQueryKey,
} from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useT, useFormatDate } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

function StarPicker({
  value,
  onChange,
  label,
  hint,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground/80">{label}</label>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-0.5"
            aria-label={`${label} ${n}`}
          >
            <Star
              className={
                "w-6 h-6 transition-colors " +
                (n <= value
                  ? "fill-primary text-primary"
                  : "text-muted-foreground/40")
              }
            />
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function AssessmentWidget({ taskId }: { taskId: number }) {
  const t = useT();
  const formatDate = useFormatDate();
  const { currentUser, isManager } = useAuth();
  const queryClient = useQueryClient();

  const { data: assessment, isLoading } = useGetTaskAssessment(taskId, {
    query: { enabled: !!taskId, queryKey: getGetTaskAssessmentQueryKey(taskId) },
  });
  const upsert = useUpsertTaskAssessment();

  const [quality, setQuality] = useState(3);
  const [creativity, setCreativity] = useState(3);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (assessment) {
      setQuality(assessment.qualityScore);
      setCreativity(assessment.creativityScore);
      setNote(assessment.note ?? "");
    }
  }, [assessment]);

  const handleSave = () => {
    if (!currentUser) return;
    upsert.mutate(
      {
        id: taskId,
        data: {
          actingUserId: currentUser.id,
          qualityScore: quality,
          creativityScore: creativity,
          note: note.trim() === "" ? null : note.trim(),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTaskAssessmentQueryKey(taskId) });
          queryClient.invalidateQueries({ queryKey: getGetRecognitionLeaderboardQueryKey() });
          toast.success(t("assessment.saved"));
        },
        onError: () => toast.error(t("assessment.error")),
      },
    );
  };

  // Non-managers only see the read-only result (if rated).
  if (!isManager) {
    if (isLoading) return <Skeleton className="h-24 w-full rounded-3xl" />;
    if (!assessment) return null;
    return (
      <div className="glass-card border border-border/40 rounded-3xl p-6 space-y-4 shadow-sm">
        <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Award className="w-4 h-4" /> {t("assessment.title")}
        </h3>
        <ReadOnlyRatings quality={assessment.qualityScore} creativity={assessment.creativityScore} />
        {assessment.note && <p className="text-sm text-muted-foreground italic">"{assessment.note}"</p>}
        {assessment.raterName && (
          <p className="text-xs text-muted-foreground">
            {t("assessment.ratedBy")} {assessment.raterName} · {formatDate(assessment.updatedAt, "MMM d, yyyy")}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="glass-card border border-border/40 rounded-3xl p-6 space-y-5 shadow-sm">
      <div>
        <h3 className="font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Award className="w-4 h-4" /> {t("assessment.title")}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">{t("assessment.subtitle")}</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <>
          <StarPicker
            value={quality}
            onChange={setQuality}
            label={t("assessment.quality")}
            hint={t("assessment.qualityHint")}
          />
          <StarPicker
            value={creativity}
            onChange={setCreativity}
            label={t("assessment.creativity")}
            hint={t("assessment.creativityHint")}
          />
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground/80">{t("assessment.note")}</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("assessment.notePlaceholder")}
              className="bg-background/50 rounded-xl min-h-24 font-medium"
            />
          </div>
          <Button
            className="w-full justify-center font-semibold rounded-xl h-11"
            onClick={handleSave}
            disabled={upsert.isPending}
          >
            {upsert.isPending ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Award className="w-5 h-5 mr-2" />
            )}
            {t("assessment.save")}
          </Button>
          {assessment?.raterName && (
            <p className="text-xs text-muted-foreground">
              {t("assessment.ratedBy")} {assessment.raterName} · {formatDate(assessment.updatedAt, "MMM d, yyyy")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ReadOnlyRatings({
  quality,
  creativity,
}: {
  quality: number;
  creativity: number;
}) {
  const t = useT();
  const Row = ({ label, score }: { label: string; score: number }) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={"w-4 h-4 " + (n <= score ? "fill-primary text-primary" : "text-muted-foreground/40")}
          />
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-2">
      <Row label={t("assessment.quality")} score={quality} />
      <Row label={t("assessment.creativity")} score={creativity} />
    </div>
  );
}
