import { useMemo, useEffect } from "react";
import { setAttemptTokenGetter } from "@/lib/api-client";
import { Link, useRoute } from "wouter";
import {
  useGetStudioAttempt,
  useGetStudioAttemptSummary,
  useGetStudioAssessmentLeaderboard,
  getGetStudioAttemptQueryKey,
  getGetStudioAttemptSummaryQueryKey,
  getGetStudioAssessmentLeaderboardQueryKey,
} from "@/lib/api-client";
import type {
  StudioAnswer,
  StudioQuestion,
  StudioAttemptSummaryCriterionTotalsItem,
} from "@/lib/api-client";
import {
  CinematicShell,
  SpotlightCard,
  GoldButton,
  GhostButton,
  SectionTitle,
} from "@/components/cinematic-studio";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Award,
  ShieldAlert,
  Printer,
  ArrowLeft,
  Type,
  Mic,
  PenTool,
  Calendar,
  Clock,
  UserCircle,
  ScrollText,
  ListChecks,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Trophy,
  Sparkles,
  Medal,
} from "lucide-react";

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ScoreRing({
  score,
  max,
  passed,
}: {
  score: number;
  max: number;
  passed: boolean;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, score / max)) : 0;
  const size = 200;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const gradId = passed ? "ring-grad-gold" : "ring-grad-crimson";
  return (
    <div className="relative" data-testid="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block -rotate-90">
        <defs>
          <linearGradient id="ring-grad-gold" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="ring-grad-crimson" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-display text-4xl font-bold text-gold">
          {Math.round(pct * 100)}%
        </div>
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground mt-1">
          {score.toFixed(1)} / {max.toFixed(1)}
        </div>
      </div>
    </div>
  );
}

function ModeIcon({ mode }: { mode: string }) {
  if (mode === "voice") return <Mic className="h-3.5 w-3.5" />;
  if (mode === "handwriting") return <PenTool className="h-3.5 w-3.5" />;
  return <Type className="h-3.5 w-3.5" />;
}

function modeLabel(mode: string): string {
  if (mode === "voice") return "Voice";
  if (mode === "handwriting") return "Handwriting";
  return "Text";
}

function AnswerCard({
  answer,
  index,
  question,
  criterionLabels,
}: {
  answer: StudioAnswer;
  index: number;
  question: StudioQuestion | undefined;
  criterionLabels: Map<string, string>;
}) {
  const score = answer.score ?? 0;
  const max = answer.maxScore ?? 0;
  const pct = max > 0 ? score / max : 0;
  const correct = pct >= 0.7;

  const selectedOptionLabels = useMemo(() => {
    if (!question || !answer.selectedOptionIds?.length) return [];
    return answer.selectedOptionIds
      .map((id) => question.options.find((o) => o.id === id))
      .filter(Boolean)
      .map((o) => o!.text);
  }, [question, answer.selectedOptionIds]);

  return (
    <SpotlightCard className="space-y-5 p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-3 text-[0.65rem] uppercase tracking-[0.3em] text-amber-500/80 font-semibold">
            <span>Question {index + 1}</span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground normal-case tracking-normal text-[0.7rem]">
              <ModeIcon mode={answer.mode} />
              {modeLabel(answer.mode)}
            </span>
            {answer.manualOverride ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 normal-case tracking-normal text-[0.7rem]">
                <GraduationCap className="h-3 w-3" />
                Reviewed by educator
              </span>
            ) : null}
          </div>
          <p className="font-display text-lg text-foreground leading-snug">
            {question?.prompt ?? "Question prompt unavailable"}
          </p>
          {question?.context ? (
            <p className="text-sm text-muted-foreground italic">
              {question.context}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="font-display text-2xl font-bold text-gold tabular-nums">
            {score.toFixed(1)}
            <span className="text-sm text-muted-foreground font-sans ml-1">
              / {max.toFixed(1)}
            </span>
          </div>
          {correct ? (
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Strong
            </Badge>
          ) : (
            <Badge className="bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/20">
              <XCircle className="h-3 w-3 mr-1" /> Needs work
            </Badge>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2">
        <div className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
          Student response
        </div>
        {selectedOptionLabels.length > 0 ? (
          <ul className="space-y-1.5">
            {selectedOptionLabels.map((label, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-foreground"
              >
                <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        ) : answer.responseText ? (
          <p className="whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
            {answer.responseText}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No response submitted.
          </p>
        )}
      </div>

      {answer.aiFeedback ? (
        <blockquote className="border-l-2 border-amber-500/50 pl-4 italic text-sm text-foreground/80 leading-relaxed">
          {answer.aiFeedback}
        </blockquote>
      ) : null}

      {answer.aiConfidence != null ? (
        <div
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-muted-foreground w-fit"
          title="AI grader's self-reported confidence in this score"
        >
          AI confidence{" "}
          <span className="font-mono text-foreground">
            {Math.round(Number(answer.aiConfidence) * 100)}%
          </span>
        </div>
      ) : null}

      {answer.criterionScores && answer.criterionScores.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {answer.criterionScores.map((cs) => (
            <div
              key={cs.criterionId}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs"
              title={cs.comment}
            >
              <span className="text-muted-foreground">
                {criterionLabels.get(cs.criterionId) ?? cs.criterionId}
              </span>
              <span className="font-mono font-semibold text-amber-300 tabular-nums">
                {Number(cs.score).toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </SpotlightCard>
  );
}

export default function AttemptSummary() {
  const [, params] = useRoute("/studio/attempt/:id/summary");
  const id = params?.id ?? "";

  useEffect(() => {
    if (!id) return;
    const stored = sessionStorage.getItem(`studio.attempt.${id}.token`);
    if (stored) setAttemptTokenGetter(() => stored);
    return () => setAttemptTokenGetter(null);
  }, [id]);

  const summaryQ = useGetStudioAttemptSummary(id, {
    query: {
      enabled: !!id,
      queryKey: getGetStudioAttemptSummaryQueryKey(id),
    },
  });
  const detailQ = useGetStudioAttempt(id, {
    query: {
      enabled: !!id,
      queryKey: getGetStudioAttemptQueryKey(id),
    },
  });

  const summary = summaryQ.data;
  const detail = detailQ.data;
  const assessmentId = detail?.assessment?.id ?? "";
  const leaderboardQ = useGetStudioAssessmentLeaderboard(assessmentId, {
    query: {
      enabled: !!assessmentId,
      queryKey: getGetStudioAssessmentLeaderboardQueryKey(assessmentId),
    },
  });

  const questionMap = useMemo(() => {
    const m = new Map<string, StudioQuestion>();
    if (detail?.questions) {
      for (const q of detail.questions) m.set(q.id, q);
    }
    return m;
  }, [detail]);

  const criterionLabels = useMemo(() => {
    const m = new Map<string, string>();
    if (summary?.criterionTotals) {
      for (const c of summary.criterionTotals) {
        m.set(c.criterionId, c.criterionLabel);
      }
    }
    return m;
  }, [summary]);

  const sortedCriteria = useMemo<StudioAttemptSummaryCriterionTotalsItem[]>(
    () =>
      summary
        ? [...summary.criterionTotals].sort(
            (a, b) =>
              (b.maxScore > 0 ? b.score / b.maxScore : 0) -
              (a.maxScore > 0 ? a.score / a.maxScore : 0),
          )
        : [],
    [summary],
  );

  const sortedAnswers = useMemo<StudioAnswer[]>(() => {
    if (!summary) return [];
    return [...summary.answers].sort((a, b) => {
      const qa = questionMap.get(a.questionId)?.orderIndex ?? 0;
      const qb = questionMap.get(b.questionId)?.orderIndex ?? 0;
      return qa - qb;
    });
  }, [summary, questionMap]);

  return (
    <CinematicShell showHeader={false} showFooter={false}>
      <style>{`
        @media print {
          html, body, #root { background: #ffffff !important; color: #000 !important; }
          body::before { display: none !important; }
          .no-print { display: none !important; }
          .glass, .glass-strong {
            background: #ffffff !important;
            border: 1px solid #d4d4d4 !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
          }
          .text-gold { -webkit-text-fill-color: #000 !important; color: #000 !important; background: none !important; }
          .text-glow-gold { text-shadow: none !important; }
          .text-foreground, .text-muted-foreground, .text-amber-300, .text-amber-500\\/80 { color: #000 !important; }
          .border-white\\/10, .border-white\\/5 { border-color: #d4d4d4 !important; }
          .bg-black\\/30, .bg-white\\/5, .bg-amber-500\\/10, .bg-emerald-500\\/15, .bg-red-500\\/15 { background: #f5f5f5 !important; }
          a, button { color: #000 !important; }
          .print-page { padding: 0 !important; }
        }
      `}</style>

      <div className="print-page container mx-auto px-6 py-12 max-w-5xl space-y-10">
        {!id || summaryQ.isError ? (
          <SpotlightCard className="p-12 text-center">
            <ShieldAlert className="h-10 w-10 text-red-400 mx-auto mb-3" />
            <h2 className="font-display text-2xl text-gold mb-2">
              Summary unavailable
            </h2>
            <p className="text-muted-foreground">
              We could not retrieve this attempt. The link may be invalid or the
              evaluation is still in progress.
            </p>
            <div className="mt-6">
              <Link href="/studio/join">
                <GhostButton>
                  <ArrowLeft className="h-4 w-4" />
                  Back to Join
                </GhostButton>
              </Link>
            </div>
          </SpotlightCard>
        ) : summaryQ.isLoading || !summary ? (
          <SpotlightCard className="p-12 text-center">
            <div className="font-display text-2xl text-gold mb-2">
              Compiling your evaluation…
            </div>
            <p className="text-muted-foreground">
              The examiner is finalising your rubric scores.
            </p>
          </SpotlightCard>
        ) : (
          <>
            <div
              data-testid="ai-disclaimer"
              className="rounded-lg border border-amber-400/30 bg-amber-500/[0.06] px-4 py-3 text-xs md:text-sm text-amber-100/85 flex items-start gap-3"
            >
              <ScrollText className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-300" />
              <span>
                Scores, rubric comments, and narrative below were generated by
                AI from your submission. They may contain errors and are not a
                formal grade. Your educator may regrade or override any item —
                please review with them before treating this as final.
              </span>
            </div>
            <SpotlightCard className="no-print border-sky-500/20 bg-sky-950/10 p-6">
              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <div className="text-[0.6rem] font-bold uppercase tracking-[0.25em] text-sky-300">Interpret</div>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    Read the overall score with the criterion breakdown. A percentage summarises this
                    submission; it does not by itself explain which reasoning or skill needs work.
                  </p>
                </div>
                <div>
                  <div className="text-[0.6rem] font-bold uppercase tracking-[0.25em] text-sky-300">Review</div>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    Re-open the prompt, your response and the rubric comment together. Note any
                    transcription issue, ambiguous prompt or feedback you do not understand for your educator.
                  </p>
                </div>
                <div>
                  <div className="text-[0.6rem] font-bold uppercase tracking-[0.25em] text-sky-300">Act</div>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    Choose one criterion to practise, rewrite a short answer against that criterion,
                    and compare it with the released rubric. Keep the printed report only where it can
                    be stored privately.
                  </p>
                </div>
              </div>
              <details className="mt-5 border-t border-white/10 pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-sky-200">Results FAQ and privacy</summary>
                <div className="mt-4 space-y-3 text-sm leading-relaxed text-white/65">
                  <p><strong className="text-white">Is this my final grade?</strong> Not necessarily. The notice above explains that an educator may regrade or override an item.</p>
                  <p><strong className="text-white">Why can a strong answer still lose marks?</strong> Review each criterion: an answer may satisfy one dimension while missing another.</p>
                  <p><strong className="text-white">What should I share?</strong> This report can contain your name, responses, scores and feedback. Share it only with people authorised by you or your institution.</p>
                </div>
              </details>
            </SpotlightCard>
            {/* Hero panel */}
            <SpotlightCard data-testid="hero-panel" className="p-10 border-gold rounded-2xl">
              <div className="flex flex-col lg:flex-row gap-10 items-center lg:items-start">
                <div className="flex-shrink-0">
                  <ScoreRing
                    score={summary.overallScore}
                    max={summary.overallMaxScore}
                    passed={summary.passed}
                  />
                </div>
                <div className="flex-1 space-y-5 text-center lg:text-left">
                  <div className="flex items-center gap-3 justify-center lg:justify-start text-[0.65rem] uppercase tracking-[0.4em] text-amber-500/80 font-semibold">
                    <ScrollText className="h-3.5 w-3.5" />
                    <span>Evaluation Complete</span>
                  </div>
                  <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight text-gold text-glow-gold">
                    {detail?.assessment?.title ?? "Assessment Summary"}
                  </h1>
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <UserCircle className="h-4 w-4 text-amber-400" />
                      {summary.attempt.studentName}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-amber-400" />
                      {formatDate(summary.attempt.finishedAt)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-400" />
                      {formatDuration(summary.attempt.durationSeconds)}
                    </span>
                  </div>
                  {(summary.attempt.xpEarned > 0 || summary.attempt.badgesEarned.length > 0) && (
                    <div className="flex flex-wrap gap-2 pt-2 justify-center lg:justify-start" data-testid="attempt-rewards">
                      {summary.attempt.xpEarned > 0 && (
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-200 font-semibold text-sm">
                          <Sparkles className="w-4 h-4" />
                          +{summary.attempt.xpEarned} XP
                        </span>
                      )}
                      {summary.attempt.badgesEarned.map((b) => (
                        <span
                          key={b}
                          data-testid={`student-badge-${b}`}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/15 border border-purple-500/40 text-purple-200 font-semibold text-sm capitalize"
                        >
                          <Medal className="w-4 h-4" />
                          {b.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="pt-2 flex justify-center lg:justify-start">
                    {summary.passed ? (
                      <div data-testid="pass-fail-badge" className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-600 text-black shadow-[0_8px_30px_-8px_rgba(251,191,36,0.6)]">
                        <Award className="h-6 w-6" strokeWidth={2.5} />
                        <span className="font-display font-bold uppercase tracking-[0.2em] text-sm">
                          Passed with distinction
                        </span>
                      </div>
                    ) : (
                      <div data-testid="pass-fail-badge" className="inline-flex items-center gap-3 px-6 py-3 rounded-xl border border-red-900/60 bg-red-950/40 text-red-200">
                        <ShieldAlert className="h-6 w-6" strokeWidth={2.2} />
                        <span className="font-display font-bold uppercase tracking-[0.2em] text-sm">
                          Did not meet threshold
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SpotlightCard>

            {/* Examiner's narrative */}
            {summary.overallNarrative ? (
              <section className="space-y-5">
                <SectionTitle
                  eyebrow="The Examiner Speaks"
                  title="Examiner's narrative"
                  description="A holistic appraisal woven from your rubric performance."
                />
                <SpotlightCard className="p-8">
                  <div className="prose prose-invert max-w-none space-y-4">
                    {summary.overallNarrative
                      .split(/\n\n+/)
                      .map((para, i) => (
                        <p
                          key={i}
                          className="text-foreground/90 leading-relaxed text-base"
                        >
                          {para}
                        </p>
                      ))}
                  </div>
                </SpotlightCard>
              </section>
            ) : null}

            {/* Criterion totals */}
            {sortedCriteria.length > 0 ? (
              <section className="space-y-5">
                <SectionTitle
                  eyebrow="Rubric Breakdown"
                  title="By rubric criterion"
                  description="Where you shone, and where the work continues."
                />
                <SpotlightCard className="p-8 space-y-5">
                  {sortedCriteria.map((c) => {
                    const pct = c.maxScore > 0 ? c.score / c.maxScore : 0;
                    return (
                      <div key={c.criterionId} className="space-y-2">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-display text-base text-foreground truncate">
                              {c.criterionLabel}
                            </span>
                            <Badge
                              variant="outline"
                              className="border-amber-500/30 text-amber-300 bg-amber-500/5 text-[0.65rem] uppercase tracking-widest"
                            >
                              Target L{c.targetLevel}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <span className="font-mono tabular-nums text-foreground/80">
                              {c.score.toFixed(1)} / {c.maxScore.toFixed(1)}
                            </span>
                            <span className="font-display text-lg text-gold tabular-nums w-14 text-right">
                              {Math.round(pct * 100)}%
                            </span>
                          </div>
                        </div>
                        <Progress
                          value={Math.round(pct * 100)}
                          className="h-2 bg-white/5"
                        />
                      </div>
                    );
                  })}
                </SpotlightCard>
              </section>
            ) : null}

            {/* Answer-by-answer */}
            <section className="space-y-5">
              <SectionTitle
                eyebrow="Question by question"
                title="Answer-by-answer review"
                description="Every response, scored and annotated."
              />
              <div className="space-y-5">
                {sortedAnswers.length === 0 ? (
                  <SpotlightCard className="p-8 text-center text-muted-foreground">
                    <ListChecks className="h-8 w-8 mx-auto mb-3 text-amber-400" />
                    No answers were recorded for this attempt.
                  </SpotlightCard>
                ) : (
                  sortedAnswers.map((ans, i) => (
                    <AnswerCard
                      key={ans.id}
                      answer={ans}
                      index={i}
                      question={questionMap.get(ans.questionId)}
                      criterionLabels={criterionLabels}
                    />
                  ))
                )}
              </div>
            </section>

            {/* Leaderboard */}
            {leaderboardQ.data && leaderboardQ.data.entries.length > 0 && (
              <section className="space-y-5" data-testid="leaderboard-section">
                <SectionTitle
                  eyebrow="Hall of Fame"
                  title="Leaderboard"
                  description="The top scorers for this assessment, ranked by score then speed."
                />
                <SpotlightCard className="p-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[0.6rem] uppercase tracking-widest text-muted-foreground border-b border-white/5">
                          <th className="px-4 py-3 text-left">Rank</th>
                          <th className="px-4 py-3 text-left">Student</th>
                          <th className="px-4 py-3 text-right">Score</th>
                          <th className="px-4 py-3 text-right">Time</th>
                          <th className="px-4 py-3 text-right">XP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboardQ.data.entries.slice(0, 10).map((e) => {
                          const me = e.studentName === summary.attempt.studentName &&
                            Math.round(e.score) === Math.round(summary.attempt.score ?? 0);
                          return (
                            <tr
                              key={`${e.rank}-${e.studentName}`}
                              data-testid={`leaderboard-row-${e.rank}`}
                              className={
                                me
                                  ? "bg-amber-500/10 border-l-2 border-amber-400"
                                  : "border-b border-white/5 last:border-0"
                              }
                            >
                              <td className="px-4 py-3 font-display font-bold">
                                {e.rank === 1 ? (
                                  <span className="inline-flex items-center gap-1.5 text-amber-300">
                                    <Trophy className="w-4 h-4" /> 1
                                  </span>
                                ) : e.rank === 2 ? (
                                  <span className="inline-flex items-center gap-1.5 text-zinc-300">
                                    <Medal className="w-4 h-4" /> 2
                                  </span>
                                ) : e.rank === 3 ? (
                                  <span className="inline-flex items-center gap-1.5 text-orange-300">
                                    <Medal className="w-4 h-4" /> 3
                                  </span>
                                ) : (
                                  `#${e.rank}`
                                )}
                              </td>
                              <td className="px-4 py-3">
                                {e.studentName}
                                {me && (
                                  <span className="ml-2 text-[0.6rem] uppercase tracking-widest text-amber-300">You</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums">
                                {Math.round(e.scorePct * 100)}%
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                                {formatDuration(e.durationSeconds)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono tabular-nums text-amber-300">
                                {e.xpEarned}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </SpotlightCard>
              </section>
            )}

            {/* Footer CTAs */}
            <div className="no-print flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
              <Link href="/studio/join">
                <GhostButton>
                  <ArrowLeft className="h-4 w-4" />
                  Return to Join
                </GhostButton>
              </Link>
              <GoldButton onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Print this report
              </GoldButton>
            </div>
          </>
        )}
      </div>
    </CinematicShell>
  );
}
