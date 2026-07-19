import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useGetRecognitionLeaderboard,
  useGetRecognitionRecommendations,
  getGetRecognitionRecommendationsQueryKey,
  RecognitionEntry,
  RecognitionRecommendation,
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth";
import { useT, useFormatDate } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import {
  computeBreakdown,
  qcAverage,
  THRESHOLDS,
  OVERALL_WEIGHTS,
  COMPONENT_ORDER,
  type ComponentKey,
} from "@/lib/recognitionRubric";
import {
  ScoreRadar,
  WeightDonut,
  type RadarDatum,
  type DonutDatum,
} from "@/components/recognition/RecognitionCharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trophy,
  Award,
  TrendingUp,
  AlertTriangle,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Zap,
  BarChart3,
  Star,
  Sparkles,
  Scale,
  Download,
  type LucideIcon,
} from "lucide-react";

// Wrap a single CSV cell: escape embedded quotes and always quote so commas,
// newlines and leading separators in names can't break the columns.
function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

type ComponentMeta = { key: ComponentKey; color: string; icon: LucideIcon; labelKey: string; descKey: string };

const COMPONENTS: ComponentMeta[] = [
  { key: "speed", color: "hsl(150 48% 34%)", icon: Zap, labelKey: "recognition.col.speed", descKey: "recognition.rubric.speed.desc" },
  { key: "throughput", color: "hsl(40 74% 46%)", icon: BarChart3, labelKey: "recognition.col.throughput", descKey: "recognition.rubric.throughput.desc" },
  { key: "quality", color: "hsl(175 42% 32%)", icon: Star, labelKey: "recognition.col.quality", descKey: "recognition.rubric.quality.desc" },
  { key: "creativity", color: "hsl(22 62% 47%)", icon: Sparkles, labelKey: "recognition.col.creativity", descKey: "recognition.rubric.creativity.desc" },
];

const META_BY_KEY: Record<ComponentKey, ComponentMeta> = COMPONENTS.reduce(
  (acc, m) => ({ ...acc, [m.key]: m }),
  {} as Record<ComponentKey, ComponentMeta>,
);

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
function pts(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

function ScoreCell({ value }: { value: number | null | undefined }) {
  const t = useT();
  if (value == null) {
    return <span className="text-muted-foreground italic text-sm">{t("recognition.unrated")}</span>;
  }
  return <span className="tabular-nums font-medium">{value}</span>;
}

function RatingCell({
  value,
  hasCompleted,
}: {
  value: number | null | undefined;
  hasCompleted: boolean;
}) {
  const t = useT();
  if (value != null) {
    return <span className="tabular-nums font-medium">{value}</span>;
  }
  if (!hasCompleted) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }
  return <span className="text-muted-foreground italic text-sm">{t("recognition.unrated")}</span>;
}

/** Static, visual explanation of the scoring rubric. */
function ScoringRubricCard() {
  const t = useT();
  const [open, setOpen] = useState(true);

  const donutData: DonutDatum[] = COMPONENTS.map((m) => ({
    key: m.key,
    label: t(m.labelKey),
    color: m.color,
    weight: OVERALL_WEIGHTS[m.key],
  }));

  return (
    <Card className="glass-card border-border/40">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <CardTitle className="font-serif flex items-center gap-2">
                <Scale className="w-5 h-5" /> {t("recognition.rubric.title")}
              </CardTitle>
              <CardDescription>{t("recognition.rubric.subtitle")}</CardDescription>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
                {open ? t("recognition.rubric.hide") : t("recognition.rubric.show")}
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-8">
            {/* The weighted blend, as a single bar */}
            <section className="space-y-3">
              <h3 className="font-serif text-sm uppercase tracking-wide text-muted-foreground">
                {t("recognition.rubric.blend")}
              </h3>
              <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,200px)_1fr]">
                <WeightDonut
                  data={donutData}
                  centerLabel={t("recognition.donut.center")}
                  ariaLabel={t("recognition.donut.center")}
                  size={180}
                />
                <div className="space-y-2">
                  <div className="flex h-8 w-full overflow-hidden rounded-lg border border-border/40">
                    {COMPONENTS.map((m) => (
                      <div
                        key={m.key}
                        className="flex items-center justify-center text-[11px] font-medium text-white/95"
                        style={{
                          width: pct(OVERALL_WEIGHTS[m.key]),
                          backgroundColor: m.color,
                        }}
                        title={`${t(m.labelKey)} ${pct(OVERALL_WEIGHTS[m.key])}`}
                      >
                        {pct(OVERALL_WEIGHTS[m.key])}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("recognition.donut.hint")}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {COMPONENTS.map((m) => {
                  const Icon = m.icon;
                  return (
                    <div key={m.key} className="flex gap-3 rounded-xl border border-border/40 p-3">
                      <div
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: m.color }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium">{t(m.labelKey)}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {t("recognition.rubric.weight")} {pct(OVERALL_WEIGHTS[m.key])}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-snug">{t(m.descKey)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground italic">{t("recognition.rubric.renorm")}</p>
            </section>

            {/* Reward thresholds */}
            <section className="space-y-3">
              <h3 className="font-serif text-sm uppercase tracking-wide text-muted-foreground">
                {t("recognition.rubric.thresholds")}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Award className="w-4 h-4" /> {t("recognition.rubric.bonusCriteria")}
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>{t("recognition.crit.overall")} ≥ {THRESHOLDS.bonus.overall}</li>
                    <li>{t("recognition.crit.completed")} ≥ {THRESHOLDS.bonus.completed}</li>
                    <li>{t("recognition.crit.qc")} ≥ {THRESHOLDS.bonus.qc}</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-border/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <TrendingUp className="w-4 h-4" /> {t("recognition.rubric.promoCriteria")}
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>{t("recognition.crit.bonusFirst")}</li>
                    <li>{t("recognition.crit.overall")} ≥ {THRESHOLDS.promo.overall}</li>
                    <li>{t("recognition.crit.completed")} ≥ {THRESHOLDS.promo.completed}</li>
                    <li>{t("recognition.crit.speed")} ≥ {THRESHOLDS.promo.speed}</li>
                    <li>{t("recognition.crit.qc")} ≥ {THRESHOLDS.promo.qc}</li>
                  </ul>
                </div>
              </div>
            </section>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function CriterionRow({
  label,
  detail,
  met,
}: {
  label: string;
  detail: string;
  met: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2">
        {met ? (
          <Check className="w-4 h-4 text-primary shrink-0" />
        ) : (
          <X className="w-4 h-4 text-destructive shrink-0" />
        )}
        <span className={met ? "" : "text-muted-foreground"}>{label}</span>
      </span>
      <span className="tabular-nums text-muted-foreground">{detail}</span>
    </li>
  );
}

/** Visual breakdown of one staff member's overall score. */
function ScoreBreakdownDialog({
  entry,
  onClose,
}: {
  entry: RecognitionEntry | null;
  onClose: () => void;
}) {
  const t = useT();
  if (!entry) return null;

  const breakdown = computeBreakdown(entry);
  const qc = qcAverage(entry);

  const radarData: RadarDatum[] = COMPONENTS.map((m) => ({
    key: m.key,
    label: t(m.labelKey),
    color: m.color,
    score:
      (m.key === "speed"
        ? entry.speedScore
        : m.key === "throughput"
          ? entry.throughputScore
          : m.key === "quality"
            ? entry.qualityScore
            : entry.creativityScore) ?? null,
  }));

  const bonusCriteria = [
    {
      label: t("recognition.crit.overall"),
      detail: `${entry.overallScore} / ${THRESHOLDS.bonus.overall}`,
      met: entry.overallScore >= THRESHOLDS.bonus.overall,
    },
    {
      label: t("recognition.crit.completed"),
      detail: `${entry.completedCount} / ${THRESHOLDS.bonus.completed}`,
      met: entry.completedCount >= THRESHOLDS.bonus.completed,
    },
    {
      label: t("recognition.crit.qc"),
      detail: `${qc == null ? "—" : pts(qc)} / ${THRESHOLDS.bonus.qc}`,
      met: qc != null && qc >= THRESHOLDS.bonus.qc,
    },
  ];

  const promoCriteria = [
    {
      label: t("recognition.crit.bonusFirst"),
      detail: entry.bonusEligible ? t("recognition.breakdown.met") : t("recognition.breakdown.notMet"),
      met: entry.bonusEligible,
    },
    {
      label: t("recognition.crit.overall"),
      detail: `${entry.overallScore} / ${THRESHOLDS.promo.overall}`,
      met: entry.overallScore >= THRESHOLDS.promo.overall,
    },
    {
      label: t("recognition.crit.completed"),
      detail: `${entry.completedCount} / ${THRESHOLDS.promo.completed}`,
      met: entry.completedCount >= THRESHOLDS.promo.completed,
    },
    {
      label: t("recognition.crit.speed"),
      detail: `${entry.speedScore} / ${THRESHOLDS.promo.speed}`,
      met: entry.speedScore >= THRESHOLDS.promo.speed,
    },
    {
      label: t("recognition.crit.qc"),
      detail: `${qc == null ? "—" : pts(qc)} / ${THRESHOLDS.promo.qc}`,
      met: qc != null && qc >= THRESHOLDS.promo.qc,
    },
  ];

  return (
    <Dialog open={entry != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            {t("recognition.breakdown.title")} — {entry.userName}
          </DialogTitle>
          <DialogDescription>{t("recognition.breakdown.compositionNote")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Performance shape */}
          <section className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t("recognition.radar.title")}
            </h3>
            <ScoreRadar
              data={radarData}
              notRatedLabel={t("recognition.radar.notRated")}
              ariaLabel={t("recognition.radar.title")}
            />
            <p className="text-center text-xs text-muted-foreground">{t("recognition.radar.hint")}</p>
          </section>

          {/* Overall composition */}
          <section className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("recognition.breakdown.composition")}
              </h3>
              <span className="font-serif text-2xl tabular-nums jewel-gradient-text">
                {entry.overallScore}
                <span className="text-xs text-muted-foreground">{t("recognition.scoreSuffix")}</span>
              </span>
            </div>
            <div className="flex h-6 w-full overflow-hidden rounded-lg border border-border/40 bg-muted/40">
              {breakdown.map((b) =>
                b.contribution > 0 ? (
                  <div
                    key={b.key}
                    style={{ width: `${b.contribution}%`, backgroundColor: META_BY_KEY[b.key].color }}
                    title={`${t(META_BY_KEY[b.key].labelKey)} +${pts(b.contribution)}`}
                  />
                ) : null,
              )}
            </div>
          </section>

          {/* Per-component rows */}
          <section className="space-y-3">
            {breakdown.map((b) => {
              const meta = META_BY_KEY[b.key];
              const Icon = meta.icon;
              return (
                <div key={b.key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <Icon className="w-4 h-4" style={{ color: meta.color }} />
                      {t(meta.labelKey)}
                    </span>
                    {b.rated ? (
                      <span className="flex items-center gap-3 tabular-nums text-muted-foreground">
                        <span>
                          {t("recognition.breakdown.effectiveWeight")} {pct(b.effectiveWeight)}
                        </span>
                        <span className="text-foreground font-medium">
                          +{pts(b.contribution)} {t("recognition.breakdown.points")}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs italic text-muted-foreground">
                        {t("recognition.breakdown.notRated")}
                      </span>
                    )}
                  </div>
                  {b.rated && (
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/50">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${b.score}%`, backgroundColor: meta.color }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                        {b.score}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {/* Eligibility check */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t("recognition.breakdown.eligibility")}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/40 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Award className="w-4 h-4" /> {t("recognition.bonus.title")}
                  {entry.bonusEligible ? (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {t("recognition.breakdown.met")}
                    </Badge>
                  ) : null}
                </div>
                <ul className="space-y-1.5">
                  {bonusCriteria.map((c) => (
                    <CriterionRow key={c.label} {...c} />
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border/40 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TrendingUp className="w-4 h-4" /> {t("recognition.promotion.title")}
                  {entry.promotionCandidate ? (
                    <Badge className="ml-auto text-xs">{t("recognition.breakdown.met")}</Badge>
                  ) : null}
                </div>
                <ul className="space-y-1.5">
                  {promoCriteria.map((c) => (
                    <CriterionRow key={c.label} {...c} />
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeaderboardTable() {
  const t = useT();
  const { data, isLoading, isError } = useGetRecognitionLeaderboard();
  const [selected, setSelected] = useState<RecognitionEntry | null>(null);

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }
  if (isError || !data) {
    return (
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="w-4 h-4" />
        <span>{t("recognition.error")}</span>
      </div>
    );
  }
  if (data.entries.length === 0) {
    return <p className="text-muted-foreground">{t("recognition.empty")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("recognition.fastThreshold")}: <span className="font-medium text-foreground tabular-nums">{data.fastThresholdDays}</span> {t("recognition.days")}
        </p>
        <p className="text-sm text-muted-foreground italic">{t("recognition.breakdown.hint")}</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border/40">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">{t("recognition.col.rank")}</TableHead>
              <TableHead>{t("recognition.col.staff")}</TableHead>
              <TableHead className="text-right">{t("recognition.col.completed")}</TableHead>
              <TableHead className="text-right">{t("recognition.col.onTime")}</TableHead>
              <TableHead className="text-right">{t("recognition.col.speed")}</TableHead>
              <TableHead className="text-right">{t("recognition.col.throughput")}</TableHead>
              <TableHead className="text-right">{t("recognition.col.quality")}</TableHead>
              <TableHead className="text-right">{t("recognition.col.creativity")}</TableHead>
              <TableHead className="text-right">{t("recognition.col.overall")}</TableHead>
              <TableHead className="w-10 sr-only">{t("recognition.breakdown.view")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.entries.map((e: RecognitionEntry, i: number) => (
              <TableRow
                key={e.userId}
                className="transition-colors hover:bg-accent/40 focus-within:bg-accent/40"
              >
                <TableCell className="font-serif text-lg tabular-nums">{i + 1}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{e.userName}</span>
                    <div className="flex flex-wrap gap-1">
                      {e.bonusEligible && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Award className="w-3 h-3" /> {t("recognition.badge.bonus")}
                        </Badge>
                      )}
                      {e.promotionCandidate && (
                        <Badge className="gap-1 text-xs">
                          <TrendingUp className="w-3 h-3" /> {t("recognition.badge.promotion")}
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{e.completedCount}</TableCell>
                <TableCell className="text-right tabular-nums">{e.onTimeCount ?? 0}</TableCell>
                <TableCell className="text-right"><ScoreCell value={e.speedScore} /></TableCell>
                <TableCell className="text-right"><ScoreCell value={e.throughputScore} /></TableCell>
                <TableCell className="text-right"><RatingCell value={e.qualityScore} hasCompleted={e.completedCount > 0} /></TableCell>
                <TableCell className="text-right"><RatingCell value={e.creativityScore} hasCompleted={e.completedCount > 0} /></TableCell>
                <TableCell className="text-right">
                  <span className="font-serif text-lg tabular-nums jewel-gradient-text">{e.overallScore}</span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setSelected(e)}
                    aria-label={`${t("recognition.breakdown.view")} — ${e.userName}`}
                  >
                    {t("recognition.breakdown.view")}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ScoreBreakdownDialog entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function RecommendationList({
  items,
  emptyKey,
}: {
  items: RecognitionRecommendation[];
  emptyKey: string;
}) {
  const t = useT();
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">{t(emptyKey)}</p>;
  }
  return (
    <div className="space-y-4">
      {items.map((r) => (
        <div key={r.userId} className="rounded-xl border border-border/40 p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{r.userName}</span>
            <span className="font-serif text-lg tabular-nums jewel-gradient-text">
              {r.overallScore}
              <span className="text-xs text-muted-foreground">{t("recognition.scoreSuffix")}</span>
            </span>
          </div>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            {r.reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ManagerRecommendations() {
  const t = useT();
  const { currentUser } = useAuth();
  const { data, isLoading, isError } = useGetRecognitionRecommendations(
    { actingUserId: currentUser?.id ?? 0 },
    {
      query: {
        enabled: currentUser != null,
        queryKey: getGetRecognitionRecommendationsQueryKey({
          actingUserId: currentUser?.id ?? 0,
        }),
      },
    },
  );

  return (
    <Card className="glass-card border-border/40">
      <CardHeader>
        <CardTitle className="font-serif flex items-center gap-2">
          <Award className="w-5 h-5" /> {t("recognition.recommendations.title")}
        </CardTitle>
        <CardDescription>{t("recognition.recommendations.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {isLoading && <Skeleton className="h-40 w-full rounded-2xl" />}
        {isError && (
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-4 h-4" />
            <span>{t("recognition.recommendations.managerOnly")}</span>
          </div>
        )}
        {data && (
          <>
            <section className="space-y-3">
              <h3 className="font-serif text-lg">{t("recognition.bonus.title")}</h3>
              <RecommendationList items={data.bonus} emptyKey="recognition.bonus.empty" />
            </section>
            <section className="space-y-3">
              <h3 className="font-serif text-lg">{t("recognition.promotion.title")}</h3>
              <RecommendationList items={data.promotion} emptyKey="recognition.promotion.empty" />
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function RecognitionPage() {
  const t = useT();
  const formatDate = useFormatDate();
  const { toast } = useToast();
  const { isManager } = useAuth();
  // Shares the react-query cache with LeaderboardTable's identical call, so this
  // exports exactly the leaderboard the manager currently sees.
  const { data: leaderboard } = useGetRecognitionLeaderboard();
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  const exportReady = !!leaderboard && leaderboard.entries.length > 0;

  const exportHeaders = () => [
    t("recognition.col.rank"),
    t("recognition.col.staff"),
    t("recognition.col.completed"),
    t("recognition.col.onTime"),
    t("recognition.col.speed"),
    t("recognition.col.throughput"),
    t("recognition.col.quality"),
    t("recognition.col.creativity"),
    t("recognition.col.overall"),
    t("recognition.export.bonus"),
    t("recognition.export.promotion"),
  ];

  const exportRow = (e: RecognitionEntry, i: number): (string | number)[] => [
    i + 1,
    e.userName,
    e.completedCount,
    e.onTimeCount ?? 0,
    e.speedScore,
    e.throughputScore,
    e.qualityScore ?? t("recognition.unrated"),
    e.creativityScore ?? t("recognition.unrated"),
    e.overallScore,
    e.bonusEligible ? t("export.yes") : t("export.no"),
    e.promotionCandidate ? t("export.yes") : t("export.no"),
  ];

  const triggerDownload = (blob: Blob, extension: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mylawfirmai-recognition-${formatDate(
      new Date().toISOString(),
      "yyyy-MM-dd",
    )}.${extension}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (exporting || !leaderboard || leaderboard.entries.length === 0) {
      if (!exportReady) toast({ description: t("export.empty") });
      return;
    }
    setExporting("csv");
    try {
      const lines = [exportHeaders().map(csvCell).join(",")];
      leaderboard.entries.forEach((e, i) => {
        lines.push(exportRow(e, i).map(csvCell).join(","));
      });
      // Prepend a UTF-8 BOM so Excel renders accented/Malay characters correctly.
      const csv = "\uFEFF" + lines.join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      triggerDownload(blob, "csv");
    } catch {
      toast({ variant: "destructive", description: t("export.failed") });
    } finally {
      setExporting(null);
    }
  };

  const handleExportExcel = async () => {
    if (exporting || !leaderboard || leaderboard.entries.length === 0) {
      if (!exportReady) toast({ description: t("export.empty") });
      return;
    }
    setExporting("xlsx");
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(t("recognition.leaderboard.title").slice(0, 31), {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      const headers = exportHeaders();
      sheet.columns = headers.map((h, i) => ({
        header: h,
        width: i === 1 ? 28 : 14,
      }));
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF002147" },
      };
      headerRow.alignment = { vertical: "middle" };
      leaderboard.entries.forEach((e, i) => {
        sheet.addRow(exportRow(e, i));
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      triggerDownload(blob, "xlsx");
    } catch {
      toast({ variant: "destructive", description: t("export.failed") });
    } finally {
      setExporting(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-serif font-bold tracking-tight text-foreground jewel-gradient-text flex items-center gap-3">
              <Trophy className="w-8 h-8" /> {t("recognition.title")}
            </h1>
            <p className="text-muted-foreground mt-2 text-base font-medium">{t("recognition.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              className="font-semibold rounded-xl"
              disabled={!!exporting || !exportReady}
              onClick={handleExportCsv}
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting === "csv" ? t("export.preparing") : t("export.downloadCsv")}
            </Button>
            <Button
              variant="outline"
              className="font-semibold rounded-xl"
              disabled={!!exporting || !exportReady}
              onClick={handleExportExcel}
            >
              <Download className="w-4 h-4 mr-2" />
              {exporting === "xlsx" ? t("export.preparing") : t("export.downloadExcel")}
            </Button>
          </div>
        </header>

        <ScoringRubricCard />

        <Card className="glass-card border-border/40">
          <CardHeader>
            <CardTitle className="font-serif">{t("recognition.leaderboard.title")}</CardTitle>
            <CardDescription>{t("recognition.leaderboard.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <LeaderboardTable />
          </CardContent>
        </Card>

        {isManager && <ManagerRecommendations />}
      </div>
    </AppLayout>
  );
}
