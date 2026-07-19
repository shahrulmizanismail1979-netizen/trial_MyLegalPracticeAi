import { Link } from "wouter";
import { CinematicShell, PageHeader, SpotlightCard, SectionTitle } from "@/components/cinematic-studio";
import {
  useGetStudioDashboardStats,
  useListStudioAssessments,
  useGetStudioMyGamification,
  useGetStudioMarkingQueue,
} from "@/lib/api-client";
import {
  BookOpen,
  Users,
  BrainCircuit,
  Activity,
  Plus,
  Sparkles,
  Flame,
  Trophy,
  Star,
  Telescope,
  Layers,
  ListChecks,
  Shield,
  Lightbulb,
  BarChart3,
  ClipboardCheck,
} from "lucide-react";
import { format } from "date-fns";
import { Tutorial } from "@/components/tutorial-studio";

const FORMAT_BADGE: Record<string, { label: string; chip: string; icon: string }> = {
  exam: { label: "Exam", chip: "bg-rose-500/15 text-rose-300 border-rose-500/40", icon: "🎓" },
  quiz: { label: "Quiz", chip: "bg-amber-500/15 text-amber-300 border-amber-500/40", icon: "⚡" },
  assignment: { label: "Assignment", chip: "bg-blue-500/15 text-blue-300 border-blue-500/40", icon: "📝" },
  project: { label: "Project", chip: "bg-purple-500/15 text-purple-300 border-purple-500/40", icon: "🛠" },
  presentation: { label: "Presentation", chip: "bg-pink-500/15 text-pink-300 border-pink-500/40", icon: "🎤" },
  homework: { label: "Homework", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", icon: "📚" },
  practice: { label: "Practice", chip: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40", icon: "🌱" },
};

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetStudioDashboardStats();
  const { data: assessments, isLoading: listLoading } = useListStudioAssessments();
  const { data: gam } = useGetStudioMyGamification();
  const { data: queue } = useGetStudioMarkingQueue({ filter: "pending" });
  const pendingCount = queue?.length ?? 0;

  return (
    <CinematicShell>
      <PageHeader
        eyebrow="Educator Dashboard"
        title="Your Studio"
        description="Overview of your pedagogical assessments, cohort performance, and authoring metrics."
        right={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/studio/analytics"
              data-testid="dashboard-analytics-link"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold uppercase tracking-[0.15em] text-xs text-sky-200 bg-black/40 border border-sky-500/40 hover:bg-sky-500/10 hover:border-sky-500/60 transition-all"
            >
              <ClipboardCheck className="w-4 h-4" /> Analytics
            </Link>
            <Link
              href="/studio/marking"
              data-testid="dashboard-marking-link"
              className="relative inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold uppercase tracking-[0.15em] text-xs text-amber-200 bg-black/40 border border-amber-500/40 hover:bg-amber-500/10 hover:border-amber-500/60 transition-all"
            >
              <ClipboardCheck className="w-4 h-4" /> Marking Centre
              {pendingCount > 0 ? (
                <span
                  className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[0.65rem] font-mono font-black bg-amber-400 text-black"
                  data-testid="marking-pending-badge"
                >
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              ) : null}
            </Link>
            <Link
              href="/billing"
              data-testid="dashboard-billing-link"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold uppercase tracking-[0.15em] text-xs text-fuchsia-200 bg-black/40 border border-fuchsia-500/40 hover:bg-fuchsia-500/10 hover:border-fuchsia-500/60 transition-all"
            >
              <Sparkles className="w-4 h-4" /> Billing
            </Link>
            <Link href="/studio/assessments/new" className="group relative inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl font-bold uppercase tracking-[0.15em] text-xs text-black bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-600 shadow-[0_4px_20px_-5px_rgba(251,191,36,0.5)] transition-all hover:shadow-[0_10px_30px_-5px_rgba(251,191,36,0.7)] hover:-translate-y-0.5">
              <Plus className="w-4 h-4" /> New Assessment
            </Link>
          </div>
        }
      />

      <div className="container mx-auto px-6 py-8 space-y-12">
        {gam && (
          <SpotlightCard className="p-7 border-amber-500/30 bg-gradient-to-br from-amber-950/30 via-black/40 to-black/20" data-testid="educator-gamification">
            <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-200 via-amber-400 to-yellow-600 flex items-center justify-center shadow-[0_8px_30px_-8px_rgba(251,191,36,0.7)]">
                    <span className="font-display text-3xl font-bold text-black">{gam.level}</span>
                  </div>
                  <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="text-[0.65rem] uppercase tracking-[0.3em] text-amber-400/80 font-bold">Level {gam.level} Educator</div>
                  <div className="font-display text-2xl font-bold text-gold">{gam.xp.toLocaleString()} XP</div>
                  <div className="mt-1.5 w-48 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-yellow-500"
                      style={{ width: `${Math.min(100, (gam.xp / Math.max(1, gam.xpForNextLevel)) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[0.65rem] uppercase tracking-widest text-muted-foreground mt-1">{gam.xp} / {gam.xpForNextLevel} to next level</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <MiniStat icon={Flame} label="Streak" value={`${gam.currentStreakDays}d`} color="text-orange-400" bg="bg-orange-500/10" />
                <MiniStat icon={Trophy} label="Best Streak" value={`${gam.longestStreakDays}d`} color="text-purple-400" bg="bg-purple-500/10" />
                <MiniStat icon={Star} label="Badges" value={gam.badges.filter(b => b.earned).length} color="text-amber-400" bg="bg-amber-500/10" />
              </div>
            </div>
            {gam.badges.filter(b => b.earned).length > 0 && (
              <div className="mt-5 pt-5 border-t border-white/5 flex flex-wrap gap-2">
                {gam.badges.filter(b => b.earned).map(b => (
                  <span
                    key={b.id}
                    title={b.description}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-semibold"
                    data-testid={`educator-badge-${b.id}`}
                  >
                    <Trophy className="w-3 h-3" />
                    {b.label}
                  </span>
                ))}
              </div>
            )}
          </SpotlightCard>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Total Assessments" value={statsLoading ? "..." : stats?.assessmentsTotal ?? 0} icon={BookOpen} color="text-blue-400" bg="bg-blue-500/10" />
          <StatCard label="Open Assessments" value={statsLoading ? "..." : stats?.assessmentsOpen ?? 0} icon={Users} color="text-amber-400" bg="bg-amber-500/10" />
          <StatCard label="Attempts Completed" value={statsLoading ? "..." : `${stats?.attemptsCompleted ?? 0} / ${stats?.attemptsTotal ?? 0}`} icon={BrainCircuit} color="text-purple-400" bg="bg-purple-500/10" />
          <StatCard label="Avg Cohort Score" value={statsLoading ? "..." : `${Math.round((stats?.avgScorePct ?? 0) * 100)}%`} icon={Activity} color="text-emerald-400" bg="bg-emerald-500/10" />
        </div>

        <div className="space-y-6">
          <SectionTitle title="Recent Assessments" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listLoading ? (
              <div className="col-span-full py-12 text-center text-muted-foreground uppercase tracking-widest text-sm">Loading Library...</div>
            ) : assessments?.length === 0 ? (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                <p>No assessments authored yet.</p>
                <Link href="/studio/assessments/new" className="text-gold mt-4 inline-block hover:underline">Create your first assessment</Link>
              </div>
            ) : (
              assessments?.map(assessment => {
                const fmt = FORMAT_BADGE[assessment.format ?? "exam"] ?? FORMAT_BADGE["exam"]!;
                return (
                <Link key={assessment.id} href={`/studio/assessments/${assessment.id}`}>
                  <SpotlightCard className="cursor-pointer h-full flex flex-col hover:border-gold/50 transition-colors" data-testid={`assessment-card-${assessment.id}`}>
                    <div className="flex justify-between items-start mb-4 gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-[0.6rem] uppercase tracking-wider rounded border font-bold ${fmt.chip}`}>
                          <span>{fmt.icon}</span> {fmt.label}
                        </span>
                        <div className={`px-2 py-1 text-[0.6rem] uppercase tracking-wider rounded border ${assessment.status === 'open' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : assessment.status === 'draft' ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 'border-white/10 text-white/60 bg-white/5'}`}>
                          {assessment.status}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(assessment.createdAt), "MMM d, yyyy")}
                      </div>
                    </div>
                    <h3 className="font-display text-xl font-bold mb-2 text-foreground">{assessment.title}</h3>
                    {assessment.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{assessment.description}</p>
                    )}
                    <div className="mt-auto flex flex-wrap gap-2">
                      <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded">{assessment.questionCount} Questions</span>
                      <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded">{assessment.attemptCount} Attempts</span>
                      {assessment.dueAt ? (
                        <span className="text-xs text-amber-300/80 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded">
                          Due {format(new Date(assessment.dueAt), "MMM d")}
                        </span>
                      ) : null}
                    </div>
                  </SpotlightCard>
                </Link>
                );
              })
            )}
          </div>
        </div>
      </div>

      <Tutorial
        storageKey="studio.tutorial.educator.v1"
        title="Educator Tour"
        buttonLabel="How it works"
        steps={[
          {
            title: "Welcome to your Studio",
            icon: <Sparkles className="w-6 h-6" />,
            body: (
              <>
                <p>This is your home base. Every assessment you author lives here, alongside your XP, level, streak, and badges.</p>
                <p className="text-muted-foreground">Tip: tap <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-xs">→</kbd> to step through this tour.</p>
              </>
            ),
          },
          {
            title: "Author a new Assessment",
            icon: <Plus className="w-6 h-6" />,
            accentClass: "bg-amber-500/10 border-amber-500/30 text-amber-300",
            body: (
              <>
                <p>Click <strong className="text-amber-300">New Assessment</strong> to start. You'll get a 9-tab editor: Basics → Materials → Research → Rubric → Questions → Proctoring → Attempts → Insights → Proposals.</p>
                <p>Pick a taxonomy (Bloom, Miller, SOLO, or Webb's DOK) on the Basics tab to anchor your assessment in real pedagogy.</p>
              </>
            ),
          },
          {
            title: "Upload Materials & let AI Research",
            icon: <BookOpen className="w-6 h-6" />,
            accentClass: "bg-blue-500/10 border-blue-500/30 text-blue-300",
            body: (
              <>
                <p>On <strong>Materials</strong>, paste lecture notes, articles, or upload PDFs. The Studio reads them.</p>
                <p>On <strong>Research</strong> (<Telescope className="inline w-3.5 h-3.5" />), kick off AI research that surveys the material and proposes a learning landscape — saving you hours.</p>
              </>
            ),
          },
          {
            title: "Build a Rubric, then generate Questions",
            icon: <Layers className="w-6 h-6" />,
            accentClass: "bg-purple-500/10 border-purple-500/30 text-purple-300",
            body: (
              <>
                <p>Define rubric criteria with target taxonomy levels. Then on <strong>Questions</strong> (<ListChecks className="inline w-3.5 h-3.5" />), let AI generate questions tied to those criteria — or write your own.</p>
                <p>Each question gets a model answer and bound rubric criteria for AI-assisted marking.</p>
              </>
            ),
          },
          {
            title: "Configure Cinematic Proctoring",
            icon: <Shield className="w-6 h-6" />,
            accentClass: "bg-rose-500/10 border-rose-500/30 text-rose-300",
            body: (
              <>
                <p>On <strong>Proctoring</strong>, toggle webcam snapshots, audio detection, browser focus tracking, and tab-switch limits.</p>
                <p>The AI flags suspicious events in real time — you'll see them on the Attempts tab afterwards.</p>
              </>
            ),
          },
          {
            title: "Share the access code",
            icon: <Users className="w-6 h-6" />,
            accentClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
            body: (
              <>
                <p>Open (publish) the assessment from the editor header. Each gets a short access code.</p>
                <p>Send students to <code className="px-1.5 py-0.5 rounded bg-white/10 text-amber-300">/studio/join</code> with that code — no account needed.</p>
              </>
            ),
          },
          {
            title: "Review insights & proposals",
            icon: <BarChart3 className="w-6 h-6" />,
            accentClass: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
            body: (
              <>
                <p><strong>Attempts</strong> shows every cohort run. <strong>Insights</strong> shows per-criterion performance.</p>
                <p>The new <strong>Proposals</strong> (<Lightbulb className="inline w-3.5 h-3.5" />) tab shows student-suggested questions — accept to add them and earn XP.</p>
              </>
            ),
          },
          {
            title: "Earn XP, level up, collect badges",
            icon: <Trophy className="w-6 h-6" />,
            accentClass: "bg-amber-500/10 border-amber-500/30 text-amber-300",
            body: (
              <>
                <p>Every action awards XP: creating an assessment (+25), adding materials (+5), authoring a question (+10), accepting a proposal (+10).</p>
                <p>Visit daily to build a streak (<Flame className="inline w-3.5 h-3.5 text-orange-400" />). Badges unlock as you grow your library.</p>
              </>
            ),
          },
        ]}
      />
    </CinematicShell>
  );
}

function MiniStat({ icon: Icon, label, value, color, bg }: { icon: any, label: string, value: any, color: string, bg: string }) {
  return (
    <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl ${bg} border border-white/5`}>
      <Icon className={`w-4 h-4 ${color}`} />
      <div>
        <div className="text-[0.6rem] uppercase tracking-widest text-muted-foreground font-semibold leading-none">{label}</div>
        <div className={`font-display text-lg font-bold leading-tight ${color}`}>{value}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: { label: string, value: any, icon: any, color: string, bg: string }) {
  return (
    <SpotlightCard className="flex items-center gap-4">
      <div className={`p-4 rounded-xl ${bg} ${color}`}>
        <Icon className="w-8 h-8" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">{label}</div>
        <div className="text-3xl font-display font-bold text-foreground">{value}</div>
      </div>
    </SpotlightCard>
  );
}
