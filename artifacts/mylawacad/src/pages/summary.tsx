import { useEffect } from "react";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import {
  useGetExam,
  useGetExamSummary,
  useListProctorEvents,
  getGetExamQueryKey,
  getGetExamSummaryQueryKey,
  getListProctorEventsQueryKey,
  setAttemptTokenGetter,
} from "@/lib/api-client";
import {
  CinematicShell,
  PageHeader,
  SpotlightCard,
  StatPill,
  GoldButton,
  GhostButton,
} from "@/components/cinematic";
import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";

export default function Summary() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";

  // Restore the candidate's attempt token (issued at join) so summary
  // requests carry X-Attempt-Token.
  const storedToken = id
    ? sessionStorage.getItem(`exam.session.${id}.token`)
    : null;
  if (storedToken) setAttemptTokenGetter(() => storedToken);
  useEffect(() => {
    return () => setAttemptTokenGetter(null);
  }, [id]);

  const session = useGetExam(id, {
    query: { enabled: !!id, queryKey: getGetExamQueryKey(id) },
  });
  const summary = useGetExamSummary(id, {
    query: { enabled: !!id, queryKey: getGetExamSummaryQueryKey(id) },
  });
  const events = useListProctorEvents(id, {
    query: { enabled: !!id, queryKey: getListProctorEventsQueryKey(id) },
  });

  if (session.isError || summary.isError) {
    return (
      <CinematicShell>
        <div className="container mx-auto px-6 py-20 flex flex-col items-center gap-4 text-center">
          <p className="text-muted-foreground">Your results could not be loaded. The session may have expired.</p>
          <a href="/" className="text-sm text-fuchsia-400 underline hover:text-fuchsia-300">Return to home</a>
        </div>
      </CinematicShell>
    );
  }

  if (summary.isLoading || session.isLoading || !session.data) {
    return (
      <CinematicShell>
        <div className="container mx-auto px-6 py-20 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Compiling your verdict…
        </div>
      </CinematicShell>
    );
  }

  const s = session.data;
  const sm = summary.data;
  const accuracy = s.maxScore && s.maxScore > 0 ? (s.score ?? 0) / s.maxScore : 0;
  const reportContent = [
    `# Exam Result: ${sm?.passed ? "Passed" : "Not passed"}`,
    sm?.verdict ?? "",
    `Score: ${s.score ?? 0} / ${s.maxScore ?? 0}`,
    `Trust score: ${s.trustScore}/100`,
    sm?.strengths.length ? `## Strengths\n${sm.strengths.map((item) => `- ${item}`).join("\n")}` : "",
    sm?.weaknesses.length ? `## Weaknesses\n${sm.weaknesses.map((item) => `- ${item}`).join("\n")}` : "",
    sm?.recommendations ? `## Recommendations\n${sm.recommendations}` : "",
  ].filter(Boolean).join("\n\n");

  return (
    <CinematicShell>
      <div className="container mx-auto px-6 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
      </div>

      <PageHeader
        eyebrow="Verdict"
        title={sm?.passed ? "You passed." : "You did not pass."}
        description={sm?.verdict ?? ""}
        right={
          <div className="flex items-center gap-3">
            {sm?.passed ? (
              <Trophy className="h-12 w-12 text-amber-300 drop-shadow-[0_0_20px_rgba(251,191,36,0.7)]" />
            ) : (
              <Award className="h-12 w-12 text-fuchsia-300/60" />
            )}
          </div>
        }
      />

      <section className="container mx-auto px-6 pb-12 space-y-8">
        <div className="space-y-3">
          <DraftExportButtons title="Exam Result" content={reportContent} hideMarkdown />
          <DraftDocument content={reportContent} />
        </div>
        <div
          data-testid="ai-disclaimer"
          className="rounded-lg border border-amber-400/30 bg-amber-500/[0.06] px-4 py-3 text-xs md:text-sm text-amber-100/85 flex items-start gap-3"
        >
          <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-300" />
          <span>
            This verdict, feedback, and proctor log are AI-generated. They may
            contain errors. They are not a formal certification or assessment
            outcome — please cross-check important findings with your examiner
            before relying on them for any decision.
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatPill
            label="Accuracy"
            value={`${(accuracy * 100).toFixed(0)}%`}
            accent={accuracy >= 0.7 ? "good" : "warn"}
          />
          <StatPill
            label="Score"
            value={`${s.score ?? 0} / ${s.maxScore ?? 0}`}
          />
          <StatPill
            label="Trust score"
            value={`${s.trustScore}/100`}
            accent={s.trustScore > 75 ? "good" : s.trustScore > 45 ? "warn" : "bad"}
          />
          <StatPill
            label="Status"
            value={s.flagged ? "Flagged" : "Clean"}
            accent={s.flagged ? "bad" : "good"}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <SpotlightCard className="!p-7">
            <h2 className="font-display text-2xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-fuchsia-300" /> Strengths
            </h2>
            {sm?.strengths.length ? (
              <ul className="space-y-2">
                {sm.strengths.map((x, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-2 text-sm"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-300 mt-0.5 shrink-0" />
                    <span>{x}</span>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">None recorded.</p>
            )}
          </SpotlightCard>

          <SpotlightCard className="!p-7">
            <h2 className="font-display text-2xl font-bold mb-4 flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-300" /> Weaknesses
            </h2>
            {sm?.weaknesses.length ? (
              <ul className="space-y-2">
                {sm.weaknesses.map((x, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-2 text-sm"
                  >
                    <XCircle className="h-4 w-4 text-rose-300 mt-0.5 shrink-0" />
                    <span>{x}</span>
                  </motion.li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">None recorded.</p>
            )}
          </SpotlightCard>
        </div>

        {sm?.recommendations ? (
          <SpotlightCard className="!p-7">
            <h2 className="font-display text-2xl font-bold mb-3">
              Recommendations
            </h2>
            <p className="text-foreground/85 leading-relaxed">
              {sm.recommendations}
            </p>
          </SpotlightCard>
        ) : null}

        <SpotlightCard className="!p-7">
          <h2 className="font-display text-2xl font-bold mb-4">
            App-by-app breakdown
          </h2>
          <div className="divide-y divide-white/5">
            {sm?.breakdownByApp.map((b) => (
              <div
                key={b.appSlug}
                className="py-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold">{b.appName}</div>
                  <div className="text-xs text-muted-foreground">
                    {b.correct}/{b.total} correct
                  </div>
                </div>
                <div
                  className={`font-mono tabular-nums ${
                    b.accuracy >= 0.7 ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {(b.accuracy * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </SpotlightCard>

        <SpotlightCard className="!p-7">
          <h2 className="font-display text-2xl font-bold mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-300" /> Proctor log
          </h2>
          {events.data && events.data.length > 0 ? (
            <div className="max-h-96 overflow-auto divide-y divide-white/5 text-sm">
              {events.data.map((e) => (
                <div
                  key={e.id}
                  className="py-2 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[0.6rem] uppercase tracking-[0.25em] text-muted-foreground w-32">
                      {new Date(e.createdAt).toLocaleTimeString()}
                    </span>
                    <span className="font-semibold capitalize">
                      {e.kind.replace(/_/g, " ")}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {e.details}
                    </span>
                  </div>
                  <span
                    className={`text-xs tabular-nums ${
                      e.severity >= 15
                        ? "text-rose-300"
                        : e.severity >= 8
                          ? "text-amber-300"
                          : "text-muted-foreground"
                    }`}
                  >
                    -{e.severity}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No proctor events recorded. Clean run.
            </p>
          )}
        </SpotlightCard>

        <div className="flex flex-wrap gap-3">
          <Link href="/candidate">
            <GoldButton type="button">
              <Sparkles className="h-4 w-4" /> Take another exam
            </GoldButton>
          </Link>
          <Link href="/">
            <GhostButton type="button">Back to home</GhostButton>
          </Link>
        </div>
      </section>
    </CinematicShell>
  );
}
