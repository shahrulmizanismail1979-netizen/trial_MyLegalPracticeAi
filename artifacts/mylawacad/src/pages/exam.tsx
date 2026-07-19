import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetExam,
  useListExamQuestions,
  useGenerateNextQuestion,
  useSubmitAnswer,
  useFinishExam,
  useGetExamTemplate,
  getGetExamQueryKey,
  getGetExamTemplateQueryKey,
  getListExamQuestionsQueryKey,
  setAttemptTokenGetter,
} from "@/lib/api-client";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock,
  Flag,
  Loader2,
  Maximize2,
  ScrollText,
  ShieldCheck,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CinematicShell, FlickerBadge } from "@/components/cinematic";
import { useProctoring, type AntiCheatConfig } from "@/hooks/use-proctoring";

function formatClock(secondsLeft: number): string {
  if (secondsLeft < 0) return "00:00";
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const FALLBACK_AC: AntiCheatConfig = {
  lockFullscreen: true,
  blockCopyPaste: true,
  blockRightClick: true,
  blockShortcuts: true,
  detectDevtools: true,
  idleTimeoutSeconds: 120,
  maxTabSwitches: 3,
  autoFlagThreshold: 50,
};

type AnswerResult = {
  isCorrect: boolean;
  score: number;
  maxScore: number;
  modelAnswer: string;
  feedback: string;
  encouragement: string;
  criterionScores: {
    label: string;
    weight: number;
    score: number;
    comment: string;
  }[];
  confidence: number | null;
};

export default function Exam() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  // Restore the candidate's attempt token (issued at join) so all exam
  // requests carry X-Attempt-Token.
  const storedToken = id
    ? sessionStorage.getItem(`exam.session.${id}.token`)
    : null;
  if (storedToken) setAttemptTokenGetter(() => storedToken);
  useEffect(() => {
    return () => setAttemptTokenGetter(null);
  }, [id]);

  const { data: session, isLoading: sessionLoading } = useGetExam(id, {
    query: { enabled: !!id, queryKey: getGetExamQueryKey(id) },
  });
  const { data: questions } = useListExamQuestions(id, {
    query: { enabled: !!id, queryKey: getListExamQuestionsQueryKey(id) },
  });
  const templateId = session?.examTemplateId ?? "";
  const { data: template } = useGetExamTemplate(templateId, {
    query: {
      enabled: !!templateId,
      queryKey: getGetExamTemplateQueryKey(templateId),
    },
  });

  const generateNext = useGenerateNextQuestion();
  const submitAnswer = useSubmitAnswer();
  const finish = useFinishExam();

  const [phase, setPhase] = useState<"rules" | "exam">("rules");
  const [draftAnswer, setDraftAnswer] = useState<string>("");
  const [matchingMap, setMatchingMap] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [proctorToast, setProctorToast] = useState<string | null>(null);
  const [examStartedAt, setExamStartedAt] = useState<number | null>(null);
  const [firstQuestionError, setFirstQuestionError] = useState<string | null>(
    null,
  );
  const requestedFirst = useRef(false);

  const antiCheat: AntiCheatConfig = template?.antiCheat ?? FALLBACK_AC;

  const proctor = useProctoring({
    sessionId: id,
    config: antiCheat,
    enabled: phase === "exam" && session?.status === "in_progress",
    onEvent: (e) => {
      if (e.severity >= 8) {
        setProctorToast(`${e.kind.replace("_", " ")} · ${e.details}`);
        window.setTimeout(() => setProctorToast(null), 3500);
      }
    },
  });

  const currentQuestion = useMemo(() => {
    if (!questions || questions.length === 0) return null;
    return questions[questions.length - 1];
  }, [questions]);

  const allQuestionsLoaded =
    !!session && !!questions && questions.length >= session.totalQuestions;
  const allQuestionsAnswered =
    allQuestionsLoaded &&
    !!questions &&
    questions.every((q) => q.userAnswer !== null && q.userAnswer !== undefined);

  // Generate first question when entering exam phase
  useEffect(() => {
    if (phase !== "exam" || !session || !questions) return;
    if (
      questions.length === 0 &&
      !requestedFirst.current &&
      session.status === "in_progress"
    ) {
      requestedFirst.current = true;
      setFirstQuestionError(null);
      generateNext.mutate(
        { id: session.id },
        {
          onSuccess: () =>
            void qc.invalidateQueries({
              queryKey: getListExamQuestionsQueryKey(session.id),
            }),
          onError: (err) => {
            requestedFirst.current = false;
            setFirstQuestionError(
              err instanceof Error
                ? err.message
                : "The AI couldn't compose the first question. Try again.",
            );
          },
        },
      );
    }
  }, [phase, session, questions, generateNext, qc]);

  const retryFirstQuestion = () => {
    if (!session) return;
    requestedFirst.current = false;
    setFirstQuestionError(null);
    generateNext.mutate(
      { id: session.id },
      {
        onSuccess: () =>
          void qc.invalidateQueries({
            queryKey: getListExamQuestionsQueryKey(session.id),
          }),
        onError: (err) => {
          setFirstQuestionError(
            err instanceof Error
              ? err.message
              : "The AI couldn't compose the first question. Try again.",
          );
        },
      },
    );
  };

  // Reset per-question UI when current question changes
  useEffect(() => {
    setDraftAnswer("");
    setMatchingMap({});
    if (currentQuestion?.userAnswer) {
      setResult({
        isCorrect: !!currentQuestion.isCorrect,
        score: currentQuestion.score ?? 0,
        maxScore: currentQuestion.points,
        modelAnswer: "",
        feedback: currentQuestion.feedback ?? "",
        encouragement: "",
        criterionScores: currentQuestion.criterionScores ?? [],
        confidence: currentQuestion.aiConfidence ?? null,
      });
    } else {
      setResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id]);

  // Timer — counted from when the candidate clicks "Begin exam", not session
  // creation. This way time spent reading the rules popup doesn't eat into
  // the candidate's exam time.
  useEffect(() => {
    if (phase !== "exam" || !examStartedAt) return;
    if (!session?.timeLimitMinutes || session.timeLimitMinutes <= 0) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - examStartedAt) / 1000);
      const left = session.timeLimitMinutes * 60 - elapsed;
      setSecondsLeft(left);
      if (left <= 0 && session.status === "in_progress") {
        proctor.mute();
        finish.mutate(
          { id: session.id },
          { onSuccess: () => navigate(`/exam/${session.id}/summary`) },
        );
      }
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [
    phase,
    examStartedAt,
    session?.id,
    session?.timeLimitMinutes,
    session?.status,
    finish,
    navigate,
    proctor,
  ]);

  // Re-prompt fullscreen if lockFullscreen and user exits.
  // Only depends on stable values, not the entire proctor object, to avoid
  // listener churn on every state update.
  const requestFs = proctor.requestFullscreen;
  useEffect(() => {
    if (phase !== "exam" || !antiCheat.lockFullscreen) return;
    if (proctor.inFullscreen) return;
    const handler = () => {
      void requestFs();
      document.removeEventListener("click", handler);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [phase, antiCheat.lockFullscreen, proctor.inFullscreen, requestFs]);

  const beginExam = async () => {
    if (antiCheat.lockFullscreen) {
      await proctor.requestFullscreen();
    }
    setExamStartedAt(Date.now());
    setPhase("exam");
  };

  const handleSubmit = () => {
    if (!currentQuestion || !session) return;
    const answer =
      currentQuestion.type === "matching"
        ? JSON.stringify(matchingMap)
        : draftAnswer;
    if (!answer || answer === "{}") return;
    submitAnswer.mutate(
      { id: session.id, questionId: currentQuestion.id, data: { answer } },
      {
        onSuccess: (res) => {
          setResult({
            isCorrect: res.isCorrect,
            score: res.score,
            maxScore: res.maxScore,
            modelAnswer: res.modelAnswer,
            feedback: res.feedback,
            encouragement: res.encouragement,
            criterionScores: res.criterionScores ?? [],
            confidence: res.confidence ?? null,
          });
          void qc.invalidateQueries({
            queryKey: getListExamQuestionsQueryKey(session.id),
          });
          void qc.invalidateQueries({
            queryKey: getGetExamQueryKey(session.id),
          });
        },
      },
    );
  };

  const handleNext = () => {
    if (!session) return;
    generateNext.mutate(
      { id: session.id },
      {
        onSuccess: () =>
          void qc.invalidateQueries({
            queryKey: getListExamQuestionsQueryKey(session.id),
          }),
      },
    );
  };

  const handleFinish = () => {
    if (!session) return;
    // Silence the proctor *before* leaving fullscreen so the intentional
    // exit isn't logged as a violation (severity 20 = auto-flag).
    proctor.mute();
    void proctor.exitFullscreen();
    finish.mutate(
      { id: session.id },
      { onSuccess: () => navigate(`/exam/${session.id}/summary`) },
    );
  };

  if (sessionLoading || !session) {
    return (
      <CinematicShell showHeader={false} showFooter={false}>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" />
        </div>
      </CinematicShell>
    );
  }

  // Rules popup before exam begins
  if (phase === "rules") {
    return (
      <CinematicShell showHeader={false} showFooter={false}>
        <section className="relative flex-1 flex items-center justify-center px-6 py-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="glass-strong rounded-3xl max-w-3xl w-full p-10 space-y-7"
          >
            <div className="flex items-center gap-3 text-amber-300/80">
              <ScrollText className="h-5 w-5" />
              <span className="text-[0.65rem] uppercase tracking-[0.4em]">
                Pre-exam briefing
              </span>
            </div>
            <div>
              <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight">
                <span className="text-aurora">Rules</span> of the hall
              </h1>
              <p className="text-muted-foreground mt-2">
                {template ? template.title : "Your exam"} ·{" "}
                {session.totalQuestions} questions · {session.timeLimitMinutes}{" "}
                minutes
              </p>
            </div>

            {template?.rules ? (
              <pre className="font-mono text-sm whitespace-pre-wrap leading-relaxed bg-black/40 border border-white/10 rounded-xl p-5">
                {template.rules}
              </pre>
            ) : (
              <ul className="text-sm space-y-2 list-disc list-inside text-foreground/85">
                <li>Stay in fullscreen for the entire exam.</li>
                <li>Do not switch tabs or windows.</li>
                <li>Do not use external resources or AI assistants.</li>
                <li>The AI proctor logs every action.</li>
              </ul>
            )}

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <ProctorTile
                on={antiCheat.lockFullscreen}
                label="Fullscreen lock"
              />
              <ProctorTile
                on={antiCheat.blockCopyPaste}
                label="Copy / paste blocking"
              />
              <ProctorTile
                on={antiCheat.blockRightClick}
                label="Right-click blocked"
              />
              <ProctorTile
                on={antiCheat.blockShortcuts}
                label="Dev shortcuts blocked"
              />
              <ProctorTile
                on={antiCheat.detectDevtools}
                label="Devtools detection"
              />
              <ProctorTile on label={`Idle alert at ${antiCheat.idleTimeoutSeconds}s`} />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="text-xs text-muted-foreground">
                By continuing you accept that your trust score may drop and you
                may be flagged.
              </div>
              <button
                type="button"
                data-testid="button-begin-exam"
                onClick={beginExam}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold uppercase tracking-[0.18em] text-sm text-black bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400 shadow-[0_10px_40px_-10px_rgba(251,191,36,0.7)] transition-all hover:-translate-y-0.5"
              >
                <Maximize2 className="h-4 w-4" /> Enter fullscreen &amp; begin
              </button>
            </div>
          </motion.div>
        </section>
      </CinematicShell>
    );
  }

  // Exam — minimal chrome, intense focus
  const totalQuestions = session.totalQuestions;
  const answeredCount =
    questions?.filter((q) => q.userAnswer != null).length ?? 0;
  const progress =
    totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  const showFinishCta =
    allQuestionsLoaded && allQuestionsAnswered && session.status === "in_progress";

  return (
    <CinematicShell showHeader={false} showFooter={false}>
      <ExamTopBar
        candidate={session.candidateName}
        answeredCount={answeredCount}
        totalQuestions={totalQuestions}
        secondsLeft={secondsLeft}
        trustScore={proctor.trustScore}
        flagged={proctor.flagged}
        progress={progress}
        onFinish={handleFinish}
      />

      <AnimatePresence>
        {proctorToast ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs uppercase tracking-[0.2em] backdrop-blur"
          >
            <AlertTriangle className="h-3.5 w-3.5 inline mr-2" />
            {proctorToast}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="container mx-auto px-6 py-10 max-w-4xl">
        {!currentQuestion ? (
          <div className="glass rounded-2xl py-20 flex flex-col items-center text-center gap-4">
            {firstQuestionError ? (
              <>
                <AlertTriangle className="h-8 w-8 text-rose-400" />
                <p className="text-rose-300 max-w-md">{firstQuestionError}</p>
                <button
                  type="button"
                  data-testid="retry-first-question"
                  onClick={retryFirstQuestion}
                  className="px-5 py-2 rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/40 text-fuchsia-200 text-sm uppercase tracking-[0.18em] hover:bg-fuchsia-500/30"
                >
                  Try again
                </button>
              </>
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" />
                <p className="text-muted-foreground">
                  The AI is composing your first question…
                </p>
              </>
            )}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="glass-strong rounded-2xl p-8 space-y-6"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[0.65rem] uppercase tracking-[0.4em] text-fuchsia-300/80">
                    {currentQuestion.appName} ·{" "}
                    {currentQuestion.type.replace("_", " ")} ·{" "}
                    {currentQuestion.difficulty}
                  </div>
                  <h2 className="mt-3 font-display text-2xl md:text-3xl leading-tight">
                    {currentQuestion.prompt}
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border border-amber-400/40 text-amber-200 text-xs uppercase tracking-[0.2em]">
                  {currentQuestion.points} pts
                </span>
              </div>

              {currentQuestion.scenario ? (
                <div className="p-4 rounded-xl border-l-4 border-fuchsia-400/60 bg-white/[0.03] text-sm leading-relaxed">
                  <div className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground mb-1">
                    Scenario
                  </div>
                  {currentQuestion.scenario}
                </div>
              ) : null}

              <AnswerInput
                q={currentQuestion}
                draft={draftAnswer}
                onDraft={setDraftAnswer}
                matching={matchingMap}
                onMatching={setMatchingMap}
                disabled={!!result}
              />

              {result ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  data-testid="answer-result"
                  className={`rounded-xl p-5 border ${
                    result.isCorrect
                      ? "bg-emerald-500/10 border-emerald-500/40"
                      : "bg-rose-500/10 border-rose-500/40"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    {result.isCorrect ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-xs uppercase tracking-[0.2em]">
                        <Check className="h-3 w-3" /> Correct
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500/20 text-rose-200 text-xs uppercase tracking-[0.2em]">
                        <X className="h-3 w-3" /> Incorrect
                      </span>
                    )}
                    <span className="text-sm font-mono tabular-nums">
                      {result.score} / {result.maxScore} pts
                    </span>
                    {result.confidence != null ? (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
                        title="AI grader's self-reported confidence in this score"
                        data-testid="ai-confidence"
                      >
                        AI confidence{" "}
                        <span className="font-mono text-foreground">
                          {Math.round(result.confidence * 100)}%
                        </span>
                      </span>
                    ) : null}
                  </div>
                  {result.criterionScores.length > 0 ? (
                    <div
                      className="space-y-1.5 mb-3"
                      data-testid="criterion-breakdown"
                    >
                      {result.criterionScores.map((c) => {
                        const pct = Math.round(c.score * 100);
                        const bar =
                          c.score >= 0.75
                            ? "bg-emerald-400/80"
                            : c.score >= 0.5
                              ? "bg-amber-400/80"
                              : "bg-rose-400/80";
                        return (
                          <div key={c.label} className="text-xs">
                            <div className="flex items-baseline justify-between gap-3 mb-0.5">
                              <span className="text-foreground/90 font-medium">
                                {c.label}
                                <span className="text-muted-foreground font-normal ml-1">
                                  · {Math.round(c.weight * 100)}%
                                </span>
                              </span>
                              <span className="font-mono tabular-nums text-foreground/80">
                                {pct}%
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div
                                className={`h-full ${bar} transition-all`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            {c.comment ? (
                              <p className="text-[11px] text-muted-foreground mt-0.5 italic">
                                {c.comment}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {result.feedback ? (
                    <p className="text-sm mb-2">{result.feedback}</p>
                  ) : null}
                  {result.modelAnswer ? (
                    <p className="text-sm">
                      <span className="font-semibold">Model answer: </span>
                      {result.modelAnswer}
                    </p>
                  ) : null}
                  {result.encouragement ? (
                    <p className="text-sm italic mt-2 text-muted-foreground">
                      {result.encouragement}
                    </p>
                  ) : null}
                </motion.div>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-2">
                {!result ? (
                  <button
                    type="button"
                    data-testid="submit-answer"
                    onClick={handleSubmit}
                    disabled={submitAnswer.isPending}
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold uppercase tracking-[0.18em] text-sm text-white bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-600 shadow-[0_10px_40px_-10px_rgba(192,132,252,0.7)] disabled:opacity-50"
                  >
                    {submitAnswer.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Submit answer
                  </button>
                ) : showFinishCta ? (
                  <button
                    type="button"
                    data-testid="finish-exam"
                    onClick={handleFinish}
                    disabled={finish.isPending}
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold uppercase tracking-[0.18em] text-sm text-black bg-gradient-to-br from-amber-300 via-amber-400 to-orange-400 shadow-[0_10px_40px_-10px_rgba(251,191,36,0.7)] disabled:opacity-50"
                  >
                    {finish.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Flag className="h-4 w-4" />
                    )}
                    Finish exam
                  </button>
                ) : (
                  <button
                    type="button"
                    data-testid="next-question"
                    onClick={handleNext}
                    disabled={generateNext.isPending}
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-semibold uppercase tracking-[0.18em] text-sm text-white bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-600 shadow-[0_10px_40px_-10px_rgba(192,132,252,0.7)] disabled:opacity-50"
                  >
                    {generateNext.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Next question
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </CinematicShell>
  );
}

function ExamTopBar({
  candidate,
  answeredCount,
  totalQuestions,
  secondsLeft,
  trustScore,
  flagged,
  progress,
  onFinish,
}: {
  candidate: string;
  answeredCount: number;
  totalQuestions: number;
  secondsLeft: number | null;
  trustScore: number;
  flagged: boolean;
  progress: number;
  onFinish: () => void;
}) {
  const trustTone =
    trustScore > 75
      ? "text-emerald-300"
      : trustScore > 45
        ? "text-amber-300"
        : "text-rose-300";
  return (
    <div className="sticky top-0 z-40 border-b border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="container mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <FlickerBadge tone={flagged ? "warning" : "live"}>
            {flagged ? "Flagged" : "On record"}
          </FlickerBadge>
          <span className="font-mono text-white/85">{candidate}</span>
          <span className="text-muted-foreground">
            · Q{Math.min(answeredCount + 1, totalQuestions)} / {totalQuestions}
          </span>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <div className={`flex items-center gap-2 ${trustTone}`}>
            <ShieldCheck className="h-4 w-4" />
            <span className="tabular-nums">Trust {trustScore}/100</span>
          </div>
          {secondsLeft !== null ? (
            <div
              data-testid="exam-timer"
              className={`flex items-center gap-2 font-mono tabular-nums ${
                secondsLeft < 60 ? "text-rose-300" : "text-white/85"
              }`}
            >
              <Clock className="h-4 w-4" />
              {formatClock(secondsLeft)}
            </div>
          ) : null}
          <button
            type="button"
            data-testid="end-exam"
            onClick={onFinish}
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-white/70 hover:text-rose-300 transition"
          >
            <Flag className="h-3.5 w-3.5" /> End
          </button>
        </div>
      </div>
      <div className="h-0.5 bg-white/5">
        <motion.div
          className="h-full bg-gradient-to-r from-fuchsia-500 via-amber-300 to-fuchsia-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  );
}

function ProctorTile({ on, label }: { on: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
        on
          ? "border-emerald-400/30 bg-emerald-500/5 text-emerald-200"
          : "border-white/10 bg-white/[0.02] text-muted-foreground"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${on ? "bg-emerald-400" : "bg-white/30"}`} />
      {label}
    </div>
  );
}

function AnswerInput({
  q,
  draft,
  onDraft,
  matching,
  onMatching,
  disabled,
}: {
  q: NonNullable<ReturnType<typeof useDummy>>;
  draft: string;
  onDraft: (v: string) => void;
  matching: Record<string, string>;
  onMatching: (m: Record<string, string>) => void;
  disabled: boolean;
}) {
  if (disabled) return null;
  if (q.type === "multiple_choice" && q.options) {
    return (
      <div className="grid gap-2">
        {q.options.map((opt) => (
          <button
            type="button"
            key={opt}
            data-testid={`mcq-option-${opt.slice(0, 24)}`}
            onClick={() => onDraft(opt)}
            className={`text-left px-4 py-3 rounded-xl border transition-all ${
              draft === opt
                ? "border-fuchsia-400/60 bg-fuchsia-500/15 ring-2 ring-fuchsia-400/30"
                : "border-white/10 hover:border-white/25 bg-white/[0.02]"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === "true_false") {
    return (
      <div className="grid grid-cols-2 gap-3">
        {["True", "False"].map((opt) => (
          <button
            type="button"
            key={opt}
            data-testid={`tf-${opt.toLowerCase()}`}
            onClick={() => onDraft(opt)}
            className={`py-6 rounded-xl border text-lg font-display font-bold transition-all ${
              draft === opt
                ? "border-fuchsia-400/60 bg-fuchsia-500/15"
                : "border-white/10 hover:border-white/25 bg-white/[0.02]"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }
  if (q.type === "fill_blank") {
    return (
      <input
        data-testid="fill-blank-input"
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        placeholder="Your answer"
        className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/60"
      />
    );
  }
  if (q.type === "matching" && q.matchingPairs) {
    const lefts = q.matchingPairs.map((p) => p.left);
    const rights = q.matchingPairs.map((p) => p.right);
    return (
      <div className="space-y-3">
        {lefts.map((left) => (
          <div key={left} className="flex items-center gap-3">
            <div className="flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] font-medium">
              {left}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <select
              data-testid={`matching-${left.slice(0, 24)}`}
              value={matching[left] ?? ""}
              onChange={(e) =>
                onMatching({ ...matching, [left]: e.target.value })
              }
              className="flex-1 px-3 py-2 rounded-lg border border-white/15 bg-black/40 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/60"
            >
              <option value="">Pick a match</option>
              {rights.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }
  // short_answer + scenario
  return (
    <textarea
      data-testid="answer-textarea"
      value={draft}
      onChange={(e) => onDraft(e.target.value)}
      placeholder="Type your answer here…"
      rows={6}
      className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/60 leading-relaxed"
    />
  );
}

// Type-only helper to surface ExamQuestion type
function useDummy() {
  const r = useListExamQuestions("", {
    query: { enabled: false, queryKey: getListExamQuestionsQueryKey("") },
  });
  return r.data?.[0];
}
