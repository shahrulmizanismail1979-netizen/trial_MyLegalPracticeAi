import { Link } from "wouter";
import {
  CinematicShell,
  PageHeader,
  SpotlightCard,
} from "@/components/cinematic-studio";
import {
  useGetStudioAnalytics,
  getGetStudioAnalyticsQueryKey,
} from "@/lib/api-client";
import {
  Loader2,
  Flame,
  TrendingDown,
  Target,
  ArrowUpRight,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

export default function StudioAnalytics() {
  const { data, isLoading, isError, error } = useGetStudioAnalytics({
    query: { queryKey: getGetStudioAnalyticsQueryKey() },
  });

  return (
    <CinematicShell>
      <PageHeader
        eyebrow="Studio · Analytics"
        title="Where your students stumble"
        description="Cross-assessment pass rates, average scores, and the questions costing your class the most marks."
        right={
          <Link
            href="/studio/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-black/30 hover:bg-white/5 text-sm font-semibold uppercase tracking-widest text-white/70 transition-colors"
          >
            ← Dashboard
          </Link>
        }
      />

      <div className="container mx-auto px-6 py-8 space-y-8">
        {isLoading ? (
          <div className="py-20 flex items-center justify-center text-amber-300/80">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : isError ? (
          <SpotlightCard className="p-8 text-center text-rose-300">
            {error instanceof Error ? error.message : "Could not load analytics."}
          </SpotlightCard>
        ) : data ? (
          <>
            <div
              className="grid grid-cols-2 md:grid-cols-5 gap-4"
              data-testid="analytics-totals"
            >
              <StatTile
                label="Assessments"
                value={data.totals.assessments}
                tone="text-amber-300 bg-amber-500/10 border-amber-500/30"
              />
              <StatTile
                label="Attempts"
                value={data.totals.attempts}
                tone="text-sky-300 bg-sky-500/10 border-sky-500/30"
              />
              <StatTile
                label="Finished"
                value={data.totals.finished}
                tone="text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
              />
              <StatTile
                label="Pass Rate"
                value={
                  data.totals.passRate != null
                    ? `${data.totals.passRate}%`
                    : "—"
                }
                tone="text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/30"
              />
              <StatTile
                label="Pending Review"
                value={data.totals.pendingReview}
                tone="text-orange-300 bg-orange-500/10 border-orange-500/30"
              />
            </div>

            <SpotlightCard className="overflow-hidden p-0">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-[0.65rem] uppercase tracking-[0.3em] text-amber-400/80 font-bold">
                    Performance by Assessment
                  </div>
                  <div className="text-lg font-display text-white/90">
                    {data.byAssessment.length} total
                  </div>
                </div>
              </div>
              {data.byAssessment.length === 0 ? (
                <EmptyState message="You don't have any assessments yet. Create one to start seeing analytics." />
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-[0.6rem] uppercase tracking-widest text-white/40 bg-black/30">
                    <tr>
                      <th className="text-left px-6 py-3 font-bold">Title</th>
                      <th className="text-right px-3 py-3 font-bold">Attempts</th>
                      <th className="text-right px-3 py-3 font-bold">Finished</th>
                      <th className="text-right px-3 py-3 font-bold">Avg</th>
                      <th className="text-right px-3 py-3 font-bold">Pass %</th>
                      <th className="text-right px-3 py-3 font-bold">Flagged</th>
                      <th className="text-right px-6 py-3 font-bold">Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.byAssessment.map((r) => (
                      <tr
                        key={r.assessmentId}
                        data-testid={`analytics-row-${r.assessmentId}`}
                        className="hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="px-6 py-3">
                          <Link
                            href={`/studio/assessments/${r.assessmentId}?tab=insights`}
                            className="inline-flex items-center gap-2 text-white/90 hover:text-amber-200"
                          >
                            <span className="text-[0.55rem] uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/5 text-white/50 border border-white/10">
                              {r.format}
                            </span>
                            <span className="font-medium">{r.assessmentTitle}</span>
                            <ArrowUpRight className="w-3 h-3 opacity-50" />
                          </Link>
                          <div className="text-[0.6rem] uppercase tracking-widest text-white/30 mt-0.5">
                            {r.assessmentCode}
                          </div>
                        </td>
                        <td className="text-right px-3 text-white/80">
                          {r.totalAttempts}
                        </td>
                        <td className="text-right px-3 text-white/60">
                          {r.finishedAttempts}
                        </td>
                        <td className="text-right px-3 font-mono">
                          {r.averageScorePercent != null
                            ? `${r.averageScorePercent}%`
                            : "—"}
                        </td>
                        <td className="text-right px-3 font-mono">
                          {r.passRate != null ? (
                            <span
                              className={
                                r.passRate >= 70
                                  ? "text-emerald-300"
                                  : r.passRate >= 50
                                    ? "text-amber-300"
                                    : "text-rose-300"
                              }
                            >
                              {r.passRate}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-right px-3">
                          {r.flagCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-rose-300">
                              <AlertTriangle className="w-3 h-3" /> {r.flagCount}
                            </span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                        <td className="text-right px-6">
                          {r.pendingReview > 0 ? (
                            <span className="inline-flex items-center gap-1 text-orange-300">
                              <Flame className="w-3 h-3" /> {r.pendingReview}
                            </span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </SpotlightCard>

            <SpotlightCard className="overflow-hidden p-0">
              <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                <TrendingDown className="w-4 h-4 text-rose-300" />
                <div>
                  <div className="text-[0.65rem] uppercase tracking-[0.3em] text-rose-400/80 font-bold">
                    Weakest Questions
                  </div>
                  <div className="text-lg font-display text-white/90">
                    The {data.weakestQuestions.length} hardest items across your catalogue
                  </div>
                </div>
              </div>
              {data.weakestQuestions.length === 0 ? (
                <EmptyState message="Need at least 3 graded answers per question before a weakness shows up here." />
              ) : (
                <ul className="divide-y divide-white/5">
                  {data.weakestQuestions.map((q) => (
                    <li
                      key={q.questionId}
                      data-testid={`weak-${q.questionId}`}
                      className="px-6 py-4 flex items-start gap-4 hover:bg-white/[0.03]"
                    >
                      <Target className="w-4 h-4 text-rose-300 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white/85 line-clamp-2">
                          {q.prompt}
                        </div>
                        <Link
                          href={`/studio/assessments/${q.assessmentId}?tab=questions`}
                          className="text-[0.6rem] uppercase tracking-widest text-amber-300/70 hover:text-amber-200 mt-1 inline-flex items-center gap-1"
                        >
                          {q.assessmentTitle}{" "}
                          <ArrowUpRight className="w-2.5 h-2.5" />
                        </Link>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display text-xl font-bold text-rose-300">
                          {q.passRate}%
                        </div>
                        <div className="text-[0.6rem] uppercase tracking-widest text-white/40">
                          {q.attempts} ans · avg {q.averageScorePercent}%
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SpotlightCard>
          </>
        ) : null}
      </div>
    </CinematicShell>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className={`flex flex-col gap-1 p-4 rounded-2xl border ${tone}`}>
      <div className="text-[0.6rem] uppercase tracking-[0.25em] font-bold opacity-80">
        {label}
      </div>
      <div className="font-display text-3xl font-bold leading-none">{value}</div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-white/50 px-6">
      <Sparkles className="w-8 h-8 mx-auto mb-3 text-amber-400/40" />
      {message}
    </div>
  );
}
