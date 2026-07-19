import { useGenerateAiBriefing } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useT, useLanguage, useFormatDate } from "@/lib/i18n";

const severityStyles: Record<string, string> = {
  high: "border-destructive/40 bg-destructive/10 text-destructive",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "border-primary/30 bg-primary/10 text-primary",
};

export function AiBriefingCard() {
  const t = useT();
  const { lang } = useLanguage();
  const { currentUser } = useAuth();
  const formatDate = useFormatDate();
  const briefing = useGenerateAiBriefing();
  const data = briefing.data;

  const handleGenerate = () => {
    if (!currentUser) return;
    briefing.mutate({ data: { actingUserId: currentUser.id, lang } });
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-card to-transparent shadow-sm overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-xl font-serif tracking-tight">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("ai.briefing.title")}
          </CardTitle>
          <CardDescription>{t("ai.briefing.subtitle")}</CardDescription>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={briefing.isPending}
          className="gap-2 shrink-0 font-semibold tracking-wide"
        >
          {briefing.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {data ? t("ai.briefing.regenerate") : t("ai.briefing.generate")}
        </Button>
      </CardHeader>
      <CardContent>
        {briefing.isPending ? (
          <p className="text-sm text-muted-foreground animate-pulse py-8 text-center">
            {t("ai.briefing.loading")}
          </p>
        ) : briefing.isError ? (
          <p className="text-sm text-destructive py-8 text-center">
            {t("ai.briefing.error")}
          </p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground py-8 text-center max-w-xl mx-auto">
            {t("ai.briefing.empty")}
          </p>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-serif font-bold text-foreground leading-snug">
                {data.headline}
              </h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                {data.summary}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mt-2">
                {t("ai.briefing.generatedAt", {
                  time: formatDate(data.generatedAt, "d MMM yyyy, h:mm a"),
                })}
              </p>
            </div>

            {data.risks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("ai.briefing.risks")}
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.risks.map((r, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 ${severityStyles[r.severity] ?? severityStyles.medium}`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {t(`ai.severity.${r.severity}`)}
                      </div>
                      <p className="text-sm font-semibold mt-1 text-foreground">
                        {r.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {r.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("ai.briefing.recommendations")}
                </h4>
                <ul className="space-y-2">
                  {data.recommendations.map((rec, i) => (
                    <li
                      key={i}
                      className="flex gap-3 rounded-lg border border-border bg-card/60 p-3"
                    >
                      <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {rec.action}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {rec.rationale}
                        </p>
                        {(rec.taskTitle || rec.ownerName) && (
                          <p className="text-[11px] text-muted-foreground/80 mt-1">
                            {rec.taskTitle ? `\u201C${rec.taskTitle}\u201D` : ""}
                            {rec.taskTitle && rec.ownerName ? " \u00B7 " : ""}
                            {rec.ownerName ?? ""}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
