import { Link, useLocation, useRoute } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ClipboardCopy,
  Sparkles,
  ShieldAlert,
  Users,
  Brain,
  Loader2,
} from "lucide-react";
import {
  useGetExamTemplate,
  useListTemplateAttempts,
  useGetTemplateInsights,
  useUpdateExamTemplate,
  getGetExamTemplateQueryKey,
  getListTemplateAttemptsQueryKey,
  getGetTemplateInsightsQueryKey,
} from "@/lib/api-client";
import {
  CinematicShell,
  PageHeader,
  SpotlightCard,
  StatPill,
  GhostButton,
  VioletButton,
  GoldButton,
} from "@/components/cinematic";
export default function TemplateDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute<{ id: string }>("/examiner/templates/:id");

  const id = params?.id ?? "";
  const tpl = useGetExamTemplate(id, {
    query: { enabled: !!id, queryKey: getGetExamTemplateQueryKey(id) },
  });
  const attempts = useListTemplateAttempts(id, {
    query: { enabled: !!id, queryKey: getListTemplateAttemptsQueryKey(id) },
  });
  const insights = useGetTemplateInsights(id, {
    query: {
      enabled: !!id,
      refetchOnMount: true,
      queryKey: getGetTemplateInsightsQueryKey(id),
    },
  });
  const update = useUpdateExamTemplate();

  if (tpl.isLoading || !tpl.data) {
    return (
      <CinematicShell>
        <div className="container mx-auto px-6 py-20 text-muted-foreground">
          Loading template…
        </div>
      </CinematicShell>
    );
  }
  const template = tpl.data;
  const completed = attempts.data?.filter((a) => a.status === "completed") ?? [];
  const passed = completed.filter(
    (a) =>
      a.maxScore && a.maxScore > 0 && (a.score ?? 0) / a.maxScore >= template.passThreshold,
  ).length;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(template.code);
    } catch {
      // ignore
    }
  };

  const toggleStatus = async () => {
    await update.mutateAsync({
      id: template.id,
      data: { status: template.status === "open" ? "closed" : "open" },
    });
    tpl.refetch();
  };

  return (
    <CinematicShell>
      <div className="container mx-auto px-6 pt-6">
        <Link
          href="/examiner/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition"
          data-testid="link-back"
        >
          <ArrowLeft className="h-4 w-4" /> Back to studio
        </Link>
      </div>

      <PageHeader
        eyebrow="Exam blueprint"
        title={template.title}
        description={template.description ?? ""}
        right={
          <div className="flex flex-wrap gap-3">
            <GhostButton
              onClick={toggleStatus}
              data-testid="button-toggle-status"
            >
              {template.status === "open" ? "Close exam" : "Reopen exam"}
            </GhostButton>
          </div>
        }
      />

      <section className="container mx-auto px-6 pb-12 grid lg:grid-cols-[1.4fr_1fr] gap-8">
        <div className="space-y-6">
          <SpotlightCard className="!p-7">
            <div className="text-[0.65rem] uppercase tracking-[0.4em] text-amber-300/80">
              Share this code with candidates
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div
                className="font-display text-5xl tracking-[0.3em] text-aurora text-glow select-all"
                data-testid="text-code"
              >
                {template.code}
              </div>
              <GhostButton onClick={copyCode} data-testid="button-copy-code">
                <ClipboardCopy className="h-4 w-4" /> Copy
              </GhostButton>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Candidates go to{" "}
              <span className="text-white font-semibold">/candidate</span> and
              type this code.
            </div>
          </SpotlightCard>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatPill label="Attempts" value={attempts.data?.length ?? 0} />
            <StatPill label="Completed" value={completed.length} accent="good" />
            <StatPill label="Passed" value={passed} accent="good" />
            <StatPill
              label="Flagged"
              value={completed.filter((c) => c.flagged).length}
              accent="bad"
            />
          </div>

          <SpotlightCard className="!p-7">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="h-5 w-5 text-fuchsia-300" />
              <h2 className="font-display text-2xl font-bold">
                AI Cohort Insights
              </h2>
            </div>
            {insights.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analysing
                attempts…
              </div>
            ) : insights.data ? (
              <div className="space-y-4">
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {insights.data.narrative}
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Insight title="Average accuracy">
                    {(insights.data.averageAccuracy * 100).toFixed(0)}%
                  </Insight>
                  <Insight title="Pass rate">
                    {(insights.data.passRate * 100).toFixed(0)}%
                  </Insight>
                  <Insight title="Hardest apps">
                    {insights.data.hardestApps.join(", ") || "—"}
                  </Insight>
                  <Insight title="Easiest apps">
                    {insights.data.easiestApps.join(", ") || "—"}
                  </Insight>
                </div>
                {insights.data.commonMistakes.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
                      Common mistakes
                    </div>
                    <ul className="space-y-1.5 list-disc list-inside text-sm">
                      {insights.data.commonMistakes.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No insights yet.
              </div>
            )}
          </SpotlightCard>

          <SpotlightCard className="!p-7">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-amber-300" />
              <h2 className="font-display text-2xl font-bold">Attempts</h2>
            </div>
            {attempts.data && attempts.data.length > 0 ? (
              <div className="divide-y divide-white/5">
                {attempts.data.map((a, i) => {
                  const acc =
                    a.maxScore && a.maxScore > 0
                      ? (a.score ?? 0) / a.maxScore
                      : 0;
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="py-3 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-0.5">
                        <div className="font-medium flex items-center gap-2">
                          {a.candidateName}
                          {a.flagged ? (
                            <span className="inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-[0.2em] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-full px-2 py-0.5">
                              <ShieldAlert className="h-3 w-3" /> Flagged
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(a.startedAt).toLocaleString('en-GB')} ·{" "}
                          {a.status.replace("_", " ")} · trust {a.trustScore}/100
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {a.status === "completed" ? (
                          <span
                            className={`tabular-nums font-semibold ${
                              acc >= template.passThreshold
                                ? "text-emerald-300"
                                : "text-rose-300"
                            }`}
                          >
                            {(acc * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-xs uppercase tracking-[0.2em] text-amber-300">
                            In progress
                          </span>
                        )}
                        <Link
                          href={`/exam/${a.id}/summary`}
                          data-testid={`link-attempt-${a.id}`}
                        >
                          <GhostButton type="button">View</GhostButton>
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No attempts yet. Share the code to begin.
              </div>
            )}
          </SpotlightCard>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 self-start">
          <SpotlightCard className="!p-7 space-y-4">
            <h2 className="font-display text-xl font-bold">Specification</h2>
            <Spec label="Apps">{template.appSlugs.length}</Spec>
            <Spec label="Total questions">{template.totalQuestions}</Spec>
            <Spec label="Question types">
              {template.questionTypes.length}
            </Spec>
            <Spec label="Difficulty">{template.difficulty}</Spec>
            <Spec label="Time limit">{template.timeLimitMinutes} min</Spec>
            <Spec label="Pass at">
              {(template.passThreshold * 100).toFixed(0)}%
            </Spec>
          </SpotlightCard>

          <SpotlightCard className="!p-7 space-y-3">
            <h2 className="font-display text-xl font-bold">
              Rules shown to candidate
            </h2>
            <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed bg-black/40 border border-white/10 rounded-xl p-4 text-foreground/85">
              {template.rules}
            </pre>
          </SpotlightCard>

          <SpotlightCard className="!p-7 space-y-3">
            <h2 className="font-display text-xl font-bold">Anti-cheat</h2>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>Fullscreen lock: {template.antiCheat.lockFullscreen ? "yes" : "no"}</li>
              <li>Block copy/paste: {template.antiCheat.blockCopyPaste ? "yes" : "no"}</li>
              <li>Block right-click: {template.antiCheat.blockRightClick ? "yes" : "no"}</li>
              <li>Block shortcuts: {template.antiCheat.blockShortcuts ? "yes" : "no"}</li>
              <li>Devtools heuristic: {template.antiCheat.detectDevtools ? "on" : "off"}</li>
              <li>Idle threshold: {template.antiCheat.idleTimeoutSeconds}s</li>
              <li>Max tab switches: {template.antiCheat.maxTabSwitches}</li>
              <li>Auto-flag at trust: ≤ {template.antiCheat.autoFlagThreshold}</li>
            </ul>
          </SpotlightCard>

          <Link href="/candidate" data-testid="link-preview">
            <VioletButton type="button" className="w-full justify-center">
              <Sparkles className="h-4 w-4" /> Try as a candidate
            </VioletButton>
          </Link>
          <Link href="/examiner/new">
            <GoldButton
              type="button"
              className="w-full justify-center bg-transparent !text-white border border-white/15 from-transparent to-transparent shadow-none"
            >
              Compose another
            </GoldButton>
          </Link>
        </div>
      </section>
    </CinematicShell>
  );
}

function Spec({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold capitalize">{children}</span>
    </div>
  );
}

function Insight({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2">
      <div className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
        {title}
      </div>
      <div className="text-base font-semibold">{children}</div>
    </div>
  );
}
