import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Plus, Sparkles, Users, Trophy, ShieldAlert, LogOut, Crown, Wand2, Brain, KeyRound, BarChart3, Wallet } from "lucide-react";
import { Tutorial } from "@/components/tutorial";
import {
  useListExamTemplates,
  useGetLeaderboard,
  getListExamTemplatesQueryKey,
  getGetLeaderboardQueryKey,
} from "@/lib/api-client";
import {
  CinematicShell,
  PageHeader,
  SpotlightCard,
  StatPill,
  VioletButton,
  GhostButton,
  FlickerBadge,
} from "@/components/cinematic";
import { useAuth } from "@/lib/auth-context";
import { AcadParalegal } from "@/components/paralegal";

export default function ExaminerDashboard() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();

  const { data: templates, isLoading } = useListExamTemplates(
    { examiner: "" },
    { query: { queryKey: getListExamTemplatesQueryKey({ examiner: "" }) } },
  );
  const { data: leaderboard } = useGetLeaderboard({
    query: { queryKey: getGetLeaderboardQueryKey() },
  });

  const totalAttempts = templates?.reduce((s, t) => s + t.attemptCount, 0) ?? 0;
  const open = templates?.filter((t) => t.status === "open").length ?? 0;
  const isAdmin = user?.role === "admin";

  return (
    <CinematicShell>
      <PageHeader
        eyebrow={`Welcome back, ${user?.name ?? ""}`}
        title="The Architect's Studio"
        description="Compose and conduct cinematic AI-proctored exams. Track every cohort. Read the room."
        right={
          <div className="flex flex-wrap gap-3 items-center">
            {isAdmin ? (
              <Link href="/admin">
                <GhostButton data-testid="button-admin-dashboard">
                  <Crown className="h-4 w-4" /> Admin
                </GhostButton>
              </Link>
            ) : null}
            <Link href="/billing">
              <GhostButton data-testid="button-billing">
                <Sparkles className="h-4 w-4" /> Billing
              </GhostButton>
            </Link>
            <Link href="/examiner/new">
              <VioletButton data-testid="button-new-exam">
                <Plus className="h-4 w-4" /> New exam
              </VioletButton>
            </Link>
            <GhostButton
              onClick={async () => {
                await logout();
                navigate("/");
              }}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </GhostButton>
          </div>
        }
      />

      <section className="container mx-auto px-6 pb-12">
        <div className="grid md:grid-cols-4 gap-4">
          <StatPill label="Exams authored" value={templates?.length ?? 0} />
          <StatPill label="Open" value={open} accent="good" />
          <StatPill label="Attempts logged" value={totalAttempts} />
          <StatPill
            label="Leaderboard size"
            value={leaderboard?.length ?? 0}
            accent="warn"
          />
        </div>
      </section>

      <section className="container mx-auto px-6 pb-20 grid lg:grid-cols-[2fr_1fr] gap-8">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Your exams</h2>
            <FlickerBadge tone="info">Live</FlickerBadge>
          </div>
          {isLoading ? (
            <div className="text-muted-foreground text-sm">Loading…</div>
          ) : templates && templates.length === 0 ? (
            <SpotlightCard className="text-center py-16">
              <Sparkles className="h-8 w-8 text-fuchsia-300 mx-auto mb-4" />
              <h3 className="font-display text-2xl mb-2">No exams yet</h3>
              <p className="text-muted-foreground mb-6">
                Spin up your first cinematic exam. The AI will draft a full
                blueprint from a single sentence.
              </p>
              <Link href="/examiner/new">
                <VioletButton data-testid="button-new-exam-empty">
                  <Plus className="h-4 w-4" /> Create exam
                </VioletButton>
              </Link>
            </SpotlightCard>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {templates?.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={`/examiner/templates/${t.id}`}
                    data-testid={`link-template-${t.id}`}
                  >
                    <SpotlightCard className="cursor-pointer h-full">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-display text-xl font-bold leading-tight">
                            {t.title}
                          </h3>
                          <div className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground mt-1">
                            {t.appSlugs.length} apps · {t.totalQuestions}{" "}
                            questions · {t.timeLimitMinutes} min
                          </div>
                        </div>
                        <span
                          className={`text-[0.6rem] uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${
                            t.status === "open"
                              ? "border-emerald-400/40 text-emerald-200 bg-emerald-500/10"
                              : "border-white/10 text-muted-foreground"
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <div className="font-mono text-2xl tracking-[0.3em] text-amber-300 select-all">
                        {t.code}
                      </div>
                      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" /> {t.attemptCount}{" "}
                          attempts
                        </span>
                        <span className="capitalize">{t.difficulty}</span>
                      </div>
                    </SpotlightCard>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-300" /> Hall of Fame
          </h2>
          <SpotlightCard className="!p-5 space-y-3">
            {leaderboard && leaderboard.length > 0 ? (
              leaderboard.slice(0, 8).map((e, i) => (
                <div
                  key={`${e.candidateName}-${e.completedAt}`}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-display text-lg w-6 ${
                        i === 0
                          ? "text-amber-300"
                          : i === 1
                            ? "text-slate-300"
                            : i === 2
                              ? "text-orange-400"
                              : "text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="font-medium">{e.candidateName}</span>
                  </div>
                  <span className="text-sm tabular-nums text-fuchsia-200">
                    {(e.accuracy * 100).toFixed(0)}%
                  </span>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground text-sm py-6 text-center">
                No completed exams yet.
              </div>
            )}
          </SpotlightCard>

          <SpotlightCard className="!p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="h-4 w-4 text-fuchsia-300" />
              <h3 className="font-display text-lg font-bold">
                Proctoring is armed
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Every candidate session is wrapped in fullscreen lock, copy /
              paste blocking, devtools heuristics, idle &amp; tab-switch
              tracking, and a live trust score that you can read post-exam.
            </p>
          </SpotlightCard>
        </div>
      </section>

      <Tutorial
        storageKey="examhall.tutorial.examiner.v2"
        title="Examiner Tour"
        buttonLabel="How it works"
        steps={[
          {
            title: "Welcome, Architect",
            icon: <Sparkles className="w-6 h-6" />,
            body: (
              <>
                <p>This is your studio. Every exam template you author lives here, with attempts, leaderboard, and trust scores.</p>
                <p className="text-muted-foreground">Tip: tap <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-xs">→</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-xs">←</kbd> to navigate. Click anywhere outside to skip.</p>
              </>
            ),
          },
          {
            title: "Compose a new Exam",
            icon: <Plus className="w-6 h-6" />,
            accentClass: "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300",
            body: (
              <p>Click <strong className="text-fuchsia-300">New exam</strong>. Pick one of the eight <span className="text-white">.life</span> apps, set duration, attempts, and proctoring strictness.</p>
            ),
          },
          {
            title: "Summon the AI Blueprint Designer",
            icon: <Wand2 className="w-6 h-6" />,
            accentClass: "bg-purple-500/10 border-purple-500/30 text-purple-300",
            body: (
              <>
                <p>Describe the exam in plain language and let AI draft sections, questions, and rubric weights for you.</p>
                <p>Edit anything — the blueprint is a starting point you remain in control of.</p>
              </>
            ),
          },
          {
            title: "Open the exam, share the code",
            icon: <KeyRound className="w-6 h-6" />,
            accentClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
            body: (
              <>
                <p>From the template detail screen, set status to <strong>Open</strong>. Each template has a 6-character code.</p>
                <p>Send candidates to <code className="px-1.5 py-0.5 rounded bg-white/10 text-fuchsia-300">/candidate</code> with that code — no account needed.</p>
              </>
            ),
          },
          {
            title: "Multi-vector AI Proctoring",
            icon: <ShieldAlert className="w-6 h-6" />,
            accentClass: "bg-rose-500/10 border-rose-500/30 text-rose-300",
            body: (
              <p>Every session is wrapped in fullscreen lock, copy/paste blocking, devtools heuristics, idle &amp; tab-switch tracking, and a live trust score you can read post-exam.</p>
            ),
          },
          {
            title: "Read the room afterwards",
            icon: <BarChart3 className="w-6 h-6" />,
            accentClass: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
            body: (
              <>
                <p>Click any template card to see attempts, AI-graded scores, trust scores, and per-question heatmaps.</p>
                <p>The global <strong>Leaderboard</strong> ranks top performers across every exam you've authored.</p>
              </>
            ),
          },
          {
            title: "Admin powers (if applicable)",
            icon: <Crown className="w-6 h-6" />,
            accentClass: "bg-amber-500/10 border-amber-500/30 text-amber-300",
            body: (
              <p>If you're an admin, the <strong>Admin</strong> button appears in the header. From there you can manage teachers, reset passwords, suspend accounts, and force-delete templates.</p>
            ),
          },
          {
            title: "Subscribe in your currency",
            icon: <Wallet className="w-6 h-6" />,
            accentClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
            body: (
              <>
                <p>The <strong className="text-emerald-300">Billing</strong> button in the header opens our pricing page. Pick your home currency — <strong>MYR, USD, SGD, EUR, GBP or AUD</strong> — and Stripe handles the rest.</p>
                <p className="text-muted-foreground">One subscription unlocks both Virtual Exam Hall and Assessment Studio.</p>
              </>
            ),
          },
          {
            title: "Your license key arrives instantly",
            icon: <ShieldAlert className="w-6 h-6" />,
            accentClass: "bg-amber-500/10 border-amber-500/30 text-amber-300",
            body: (
              <>
                <p>The moment your subscription is active we issue a <strong className="text-amber-300">brand-new password</strong> and show it once in a huge, copyable card.</p>
                <p>Save it with one click: <strong>copy</strong>, <strong>PDF</strong>, <strong>Word</strong>, <strong>plain text</strong>, <strong>Google Docs</strong>, or <strong>email it to yourself</strong>. If you do nothing, we auto-download a PDF after 30 seconds — you'll never be locked out.</p>
              </>
            ),
          },
        ]}
      />
      <AcadParalegal />
    </CinematicShell>
  );
}
