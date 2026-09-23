import { useMemo, useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  CinematicShell,
  PageHeader,
  SpotlightCard,
} from "@/components/cinematic-studio";
import {
  useGetStudioMarkingQueue,
  useSignOffStudioAttempt,
} from "@/lib/api-client";
import type {
  StudioMarkingQueueItem,
  GetStudioMarkingQueueParams,
} from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  ClipboardCheck,
  Flame,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  Camera,
  Flag,
  Sparkles,
  Trophy,
  Zap,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

const BULK_CONCURRENCY = 3;
async function bulkRegrade(
  attemptIds: string[],
  onProgress: (done: number, total: number) => void,
): Promise<{ ok: number; failed: number }> {
  const baseUrl = "/api/acad";
  const queue = [...attemptIds];
  let done = 0;
  let ok = 0;
  let failed = 0;
  async function worker() {
    while (queue.length > 0) {
      const id = queue.shift();
      if (!id) break;
      try {
        const res = await fetch(`${baseUrl}/studio/attempts/${id}/regrade`, {
          method: "POST",
          credentials: "same-origin",
        });
        if (res.ok) ok += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
      done += 1;
      onProgress(done, attemptIds.length);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(BULK_CONCURRENCY, attemptIds.length) }, () =>
      worker(),
    ),
  );
  return { ok, failed };
}

type FilterValue = NonNullable<GetStudioMarkingQueueParams["filter"]>;

const FILTERS: {
  value: FilterValue;
  label: string;
  description: string;
}[] = [
  { value: "pending", label: "Awaiting Review", description: "Finished attempts that still need a human pass." },
  { value: "flagged", label: "Flagged", description: "Attempts with proctoring flags raised by the AI." },
  { value: "manual", label: "Manually Marked", description: "You've already overridden at least one answer." },
  { value: "finished", label: "All Finished", description: "Every completed attempt across your assessments." },
  { value: "all", label: "Everything", description: "Includes active and abandoned attempts too." },
];

const FORMAT_PALETTE: Record<
  string,
  { label: string; ring: string; chip: string; icon: string }
> = {
  exam: { label: "Exam", ring: "ring-rose-500/30", chip: "bg-rose-500/15 text-rose-300 border-rose-500/40", icon: "🎓" },
  quiz: { label: "Quiz", ring: "ring-amber-500/30", chip: "bg-amber-500/15 text-amber-300 border-amber-500/40", icon: "⚡" },
  assignment: { label: "Assignment", ring: "ring-blue-500/30", chip: "bg-blue-500/15 text-blue-300 border-blue-500/40", icon: "📝" },
  project: { label: "Project", ring: "ring-purple-500/30", chip: "bg-purple-500/15 text-purple-300 border-purple-500/40", icon: "🛠" },
  presentation: { label: "Presentation", ring: "ring-pink-500/30", chip: "bg-pink-500/15 text-pink-300 border-pink-500/40", icon: "🎤" },
  homework: { label: "Homework", ring: "ring-emerald-500/30", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", icon: "📚" },
  practice: { label: "Practice", ring: "ring-cyan-500/30", chip: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40", icon: "🌱" },
};

export default function MarkingCentre() {
  const [filter, setFilter] = useState<FilterValue>("pending");
  const { data, isLoading, refetch, isFetching } = useGetStudioMarkingQueue({
    filter,
  });
  const { toast } = useToast();
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  // Smart prioritisation: most-flagged first, then needs-review, then oldest.
  const items = useMemo(() => {
    const raw = (data ?? []) as StudioMarkingQueueItem[];
    return [...raw].sort((a, b) => {
      if (a.flagCount !== b.flagCount) return b.flagCount - a.flagCount;
      if (a.needsReview !== b.needsReview) return a.needsReview ? -1 : 1;
      return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
    });
  }, [data]);

  const counts = {
    pending: items.filter((i) => i.needsReview).length,
    flagged: items.filter((i) => i.flagCount > 0).length,
    manual: items.filter((i) => i.manualOverrideCount > 0).length,
  };

  const reviewable = items.filter((i) => i.needsReview).map((i) => i.attemptId);

  async function handleBulkRegrade() {
    if (reviewable.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkProgress({ done: 0, total: reviewable.length });
    const { ok, failed } = await bulkRegrade(reviewable, (done, total) =>
      setBulkProgress({ done, total }),
    );
    setBulkBusy(false);
    toast({
      title: failed === 0 ? "Bulk regrade complete" : "Bulk regrade finished with errors",
      description:
        failed === 0
          ? `Re-marked ${ok} attempt${ok === 1 ? "" : "s"}.`
          : `${ok} succeeded, ${failed} failed. Check the queue and retry.`,
      variant: failed === 0 ? "default" : "destructive",
    });
    refetch();
  }

  return (
    <CinematicShell>
      <PageHeader
        eyebrow="Marking Centre"
        title="Mark every paper, in one place"
        description="Cross-assessment AI-graded queue. Re-grade, override, or sign off — your students see updated scores instantly."
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="marking-stats">
          <StatTile
            icon={Flame}
            label="Awaiting Review"
            value={counts.pending}
            tone="text-orange-300 bg-orange-500/10 border-orange-500/30"
          />
          <StatTile
            icon={AlertTriangle}
            label="Flagged by Proctor"
            value={counts.flagged}
            tone="text-rose-300 bg-rose-500/10 border-rose-500/30"
          />
          <StatTile
            icon={CheckCircle2}
            label="Manually Marked"
            value={counts.manual}
            tone="text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
          />
        </div>

        <SpotlightCard className="border-sky-500/20 bg-sky-950/10">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-sky-300">
                Human review runbook
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold text-white">Review the evidence, not only the total</h2>
              <ol className="mt-4 space-y-3 text-sm leading-relaxed text-white/70">
                <li><strong className="text-white">1. Triage:</strong> open flagged, low-confidence or unusual attempts first. A flag is a review prompt, not a finding of misconduct.</li>
                <li><strong className="text-white">2. Compare:</strong> read the prompt, response, rubric and criterion comments together; check transcription or handwriting capture where relevant.</li>
                <li><strong className="text-white">3. Decide:</strong> retain or override each score using the same standard across the cohort. Record concise reasons for material changes.</li>
                <li><strong className="text-white">4. Close:</strong> verify the recomputed total, feedback and pass threshold, then sign off only when the record is ready for release.</li>
              </ol>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 p-5">
              <h3 className="font-display text-lg font-bold text-white">Before bulk regrade</h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/65">
                <li>• Confirm the intended rubric and question versions are active.</li>
                <li>• Export or note prior manual decisions that may need comparison.</li>
                <li>• Sample several strong, borderline and weak responses after the run.</li>
                <li>• Do not infer misconduct from snapshots, audio events or browser flags alone.</li>
                <li>• Limit access to student responses and proctoring material to authorised reviewers.</li>
              </ul>
            </div>
          </div>
          <details className="mt-5 border-t border-white/10 pt-4">
            <summary className="cursor-pointer text-sm font-semibold text-sky-200">Marking centre FAQ</summary>
            <div className="mt-4 grid gap-4 text-sm leading-relaxed text-white/65 md:grid-cols-2">
              <p><strong className="text-white">What does AI confidence mean?</strong><br />It is the grader's own signal, not proof that a score is correct. Review the underlying response.</p>
              <p><strong className="text-white">When should I override?</strong><br />When your academic judgment, applied consistently to the rubric, supports a different score or feedback.</p>
              <p><strong className="text-white">What belongs in the record?</strong><br />The released score, feedback, material overrides, reviewer identity and any moderation outcome.</p>
              <p><strong className="text-white">Can students see changes?</strong><br />The page indicates updated scores are shown to students, so complete your release and notification process before sign-off.</p>
            </div>
          </details>
        </SpotlightCard>

        <div className="flex flex-wrap gap-2" data-testid="marking-filters">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              data-testid={`marking-filter-${f.value}`}
              className={`px-4 py-2 rounded-xl text-xs uppercase tracking-widest font-semibold border transition-all ${
                filter === f.value
                  ? "border-amber-500/60 bg-amber-500/15 text-amber-200 shadow-[0_0_20px_-5px_rgba(251,191,36,0.4)]"
                  : "border-white/10 bg-black/40 text-white/60 hover:border-white/20 hover:text-white/80"
              }`}
              title={f.description}
            >
              {f.label}
            </button>
          ))}
          {isFetching && !isLoading ? (
            <span className="inline-flex items-center gap-2 px-3 text-xs text-amber-300/80">
              <Loader2 className="w-3 h-3 animate-spin" /> Refreshing
            </span>
          ) : null}
        </div>

        <SpotlightCard className="overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <div>
              <div className="text-[0.65rem] uppercase tracking-[0.3em] text-amber-400/80 font-bold">
                Queue
              </div>
              <div className="text-lg font-display text-white/90">
                {FILTERS.find((f) => f.value === filter)?.label} ·{" "}
                <span className="text-white/50">{items.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {reviewable.length > 0 ? (
                <button
                  onClick={handleBulkRegrade}
                  disabled={bulkBusy}
                  data-testid="marking-bulk-regrade"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-bold border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                  title={`Re-grade all ${reviewable.length} attempts needing review`}
                >
                  {bulkBusy ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {bulkProgress.done}/{bulkProgress.total}
                    </>
                  ) : (
                    <>
                      <Zap className="w-3 h-3" />
                      Regrade all ({reviewable.length})
                    </>
                  )}
                </button>
              ) : null}
              <button
                onClick={() => refetch()}
                className="text-xs uppercase tracking-widest text-white/60 hover:text-white/90"
                data-testid="marking-refresh"
              >
                Refresh
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-400" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <ul className="divide-y divide-white/5">
              {items.map((item) => (
                <MarkingRow
                  key={item.attemptId}
                  item={item}
                  onChanged={() => refetch()}
                />
              ))}
            </ul>
          )}
        </SpotlightCard>

        <SpotlightCard className="bg-gradient-to-br from-amber-950/20 via-black/40 to-black/20 border-amber-500/20">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div className="flex-1">
              <div className="text-[0.65rem] uppercase tracking-[0.3em] text-amber-400/80 font-bold mb-1">
                How marking works
              </div>
              <p className="text-sm text-white/70 leading-relaxed">
                Every answer is auto-graded by the AI against your rubric. Click any row to open the
                attempt's full transcript. Inside, you can <strong className="text-amber-200">Re-Grade</strong>{" "}
                the whole attempt or <strong className="text-amber-200">Override</strong> any single
                answer with your own score and feedback — totals recompute instantly.
              </p>
            </div>
          </div>
        </SpotlightCard>
      </div>
    </CinematicShell>
  );
}

function MarkingRow({
  item,
  onChanged,
}: {
  item: StudioMarkingQueueItem;
  onChanged: () => void;
}) {
  const palette = FORMAT_PALETTE[item.format] ?? FORMAT_PALETTE["exam"]!;
  const pct =
    item.score != null && item.maxScore && item.maxScore > 0
      ? Math.round((item.score / item.maxScore) * 100)
      : null;
  const { toast } = useToast();
  const signOff = useSignOffStudioAttempt();
  const isReviewed = item.reviewedAt != null;

  async function handleSignOff(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (signOff.isPending) return;
    try {
      await signOff.mutateAsync({
        id: item.attemptId,
        data: isReviewed ? { undo: true } : {},
      });
      toast({
        title: isReviewed ? "Sign-off cleared" : "Signed off",
        description: isReviewed
          ? `${item.studentName} is back in the review queue.`
          : `${item.studentName}'s attempt is approved and out of the queue.`,
      });
      onChanged();
    } catch (err) {
      toast({
        title: "Sign-off failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <li>
      <Link
        href={`/studio/assessments/${item.assessmentId}?tab=attempts&attempt=${item.attemptId}`}
      >
        <div
          className={`flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-white/[0.03] transition-colors ${
            item.needsReview ? "border-l-2 border-l-amber-500/70" : ""
          }`}
          data-testid={`marking-row-${item.attemptId}`}
        >
          <div
            className={`w-12 h-12 rounded-xl bg-black/40 border border-white/10 ring-2 ${palette.ring} flex items-center justify-center text-2xl shrink-0`}
            title={palette.label}
          >
            {palette.icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[0.6rem] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${palette.chip}`}>
                {palette.label}
              </span>
              <span className="font-display text-lg text-white/95 truncate">
                {item.assessmentTitle}
              </span>
              <span className="text-[0.6rem] uppercase tracking-widest text-white/40 font-mono">
                {item.assessmentCode}
              </span>
            </div>
            <div className="text-sm text-white/60 truncate">
              <strong className="text-white/85">{item.studentName}</strong>
              {item.studentEmail ? (
                <span className="text-white/40"> · {item.studentEmail}</span>
              ) : null}
              <span className="text-white/30"> · </span>
              <span className="text-white/50">
                {format(new Date(item.startedAt), "MMM d, HH:mm")}
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-4 text-xs text-white/60">
            <Badge tone="text-white/60" icon={null}>
              {item.answerCount} ans
            </Badge>
            {item.flagCount > 0 ? (
              <Badge tone="text-rose-300" icon={Flag}>
                {item.flagCount}
              </Badge>
            ) : null}
            {item.snapshotCount > 0 ? (
              <Badge tone="text-blue-300" icon={Camera}>
                {item.snapshotCount}
              </Badge>
            ) : null}
            {item.manualOverrideCount > 0 ? (
              <Badge tone="text-emerald-300" icon={CheckCircle2}>
                {item.manualOverrideCount} mark{item.manualOverrideCount === 1 ? "" : "s"}
              </Badge>
            ) : null}
          </div>

          <div className="text-right shrink-0 w-28">
            {pct != null ? (
              <>
                <div className={`font-display text-2xl font-bold leading-none ${
                  item.passed === true
                    ? "text-emerald-300"
                    : item.passed === false
                      ? "text-rose-300"
                      : "text-white/80"
                }`}>
                  {pct}%
                </div>
                <div className="text-[0.6rem] uppercase tracking-widest text-white/40 mt-1">
                  {item.score?.toFixed(1)} / {item.maxScore?.toFixed(1)}
                </div>
              </>
            ) : (
              <div className="text-xs uppercase tracking-widest text-white/40">
                {item.status === "active" ? "In progress" : "—"}
              </div>
            )}
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {isReviewed ? (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.65rem] uppercase tracking-widest font-bold bg-sky-500/15 text-sky-200 border border-sky-500/40"
                data-testid="reviewed-badge"
                title={`Signed off ${format(new Date(item.reviewedAt!), "MMM d, HH:mm")}`}
              >
                <ShieldCheck className="w-3 h-3" /> Reviewed
              </span>
            ) : item.needsReview ? (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.65rem] uppercase tracking-widest font-bold bg-amber-500/15 text-amber-200 border border-amber-500/40"
                data-testid="needs-review-badge"
              >
                <Flame className="w-3 h-3" /> Review
              </span>
            ) : item.status === "finished" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.65rem] uppercase tracking-widest font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3" /> Done
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.65rem] uppercase tracking-widest font-bold bg-white/5 text-white/50 border border-white/10">
                {item.status}
              </span>
            )}
            {item.status === "finished" ? (
              <button
                type="button"
                onClick={handleSignOff}
                disabled={signOff.isPending}
                data-testid={`marking-signoff-${item.attemptId}`}
                title={isReviewed ? "Undo sign-off" : "Sign off this attempt"}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[0.6rem] uppercase tracking-widest font-bold border transition-colors disabled:opacity-50 ${
                  isReviewed
                    ? "border-white/10 bg-black/30 text-white/50 hover:text-white/80 hover:border-white/20"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                }`}
              >
                {signOff.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : isReviewed ? (
                  <>
                    <RotateCcw className="w-3 h-3" /> Undo
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3 h-3" /> Sign off
                  </>
                )}
              </button>
            ) : null}
          </div>

          <ArrowUpRight className="w-4 h-4 text-white/30 shrink-0" />
        </div>
      </Link>
    </li>
  );
}

function Badge({
  tone,
  icon: Icon,
  children,
}: {
  tone: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <span className={`inline-flex items-center gap-1 ${tone}`}>
      {Icon ? <Icon className="w-3 h-3" /> : null}
      {children}
    </span>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className={`flex items-center gap-4 p-5 rounded-2xl border ${tone}`}>
      <div className="w-12 h-12 rounded-xl bg-black/30 border border-white/10 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-[0.6rem] uppercase tracking-[0.25em] font-bold opacity-80">
          {label}
        </div>
        <div className="font-display text-3xl font-bold leading-none">{value}</div>
      </div>
    </div>
  );
}

function EmptyState({ filter }: { filter: FilterValue }) {
  const map: Record<FilterValue, { title: string; body: string }> = {
    pending: {
      title: "All caught up.",
      body: "No attempts are waiting on a human pass right now. Open one of your assessments and share the access code to invite students.",
    },
    flagged: {
      title: "No flagged attempts.",
      body: "Proctoring hasn't surfaced anything suspicious. Calm waters.",
    },
    manual: {
      title: "No manual overrides yet.",
      body: "When you override an AI score, it'll appear here so you can audit your changes.",
    },
    finished: {
      title: "No finished attempts yet.",
      body: "Your students haven't submitted anything yet. Once they do, they'll appear here.",
    },
    all: {
      title: "Nothing here yet.",
      body: "When students start joining your assessments, every attempt will land in this queue.",
    },
  };
  const m = map[filter];
  return (
    <div className="py-20 text-center px-6" data-testid="marking-empty">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 mb-5">
        <Trophy className="w-7 h-7 text-amber-300" />
      </div>
      <div className="font-display text-2xl font-bold text-white/90 mb-2">{m.title}</div>
      <p className="text-sm text-white/60 max-w-md mx-auto">{m.body}</p>
    </div>
  );
}
