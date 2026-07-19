import { Link } from "wouter";
import {
  CinematicShell,
  PageHeader,
  SpotlightCard,
} from "@/components/cinematic";
import {
  useGetAdminHealth,
  getGetAdminHealthQueryKey,
} from "@/lib/api-client";
import {
  Loader2,
  Activity,
  Database,
  Cpu,
  Zap,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

export default function AdminHealth() {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useGetAdminHealth({
      query: { queryKey: getGetAdminHealthQueryKey() },
    });

  return (
    <CinematicShell>
      <PageHeader
        eyebrow="Admin · Platform Health"
        title="What the engine is doing right now"
        description="Live AI usage, cache hit-rate, question-bank coverage, and table counts. Resets on every server restart."
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              data-testid="health-refresh"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 text-xs font-bold uppercase tracking-widest hover:bg-fuchsia-500/20"
            >
              {isFetching ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Activity className="w-3 h-3" />
              )}{" "}
              Refresh
            </button>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 bg-black/30 hover:bg-white/5 text-sm font-semibold uppercase tracking-widest text-white/70 transition-colors"
            >
              ← Admin
            </Link>
          </div>
        }
      />

      <div className="container mx-auto px-6 py-8 space-y-8">
        {isLoading ? (
          <div className="py-20 flex items-center justify-center text-fuchsia-300/80">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : isError ? (
          <SpotlightCard className="p-8 text-center text-rose-300">
            {error instanceof Error ? error.message : "Could not load health."}
          </SpotlightCard>
        ) : data ? (
          <>
            <div
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
              data-testid="health-ai-totals"
            >
              <StatTile
                icon={Cpu}
                label="Calls (full)"
                value={data.ai.totals.callsFull}
                tone="text-rose-300 bg-rose-500/10 border-rose-500/30"
              />
              <StatTile
                icon={Zap}
                label="Calls (fast)"
                value={data.ai.totals.callsFast}
                tone="text-amber-300 bg-amber-500/10 border-amber-500/30"
                hint={
                  data.ai.totals.fastModelSharePercent != null
                    ? `${data.ai.totals.fastModelSharePercent}% of all calls`
                    : undefined
                }
              />
              <StatTile
                icon={CheckCircle2}
                label="Cache hits"
                value={data.ai.totals.cacheHits}
                tone="text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                hint={
                  data.ai.totals.cacheHitRatePercent != null
                    ? `${data.ai.totals.cacheHitRatePercent}% hit rate`
                    : undefined
                }
              />
              <StatTile
                icon={AlertTriangle}
                label="Failures"
                value={data.ai.totals.failures}
                tone={
                  data.ai.totals.failures > 0
                    ? "text-rose-300 bg-rose-500/10 border-rose-500/30"
                    : "text-white/60 bg-white/5 border-white/10"
                }
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <UsageCard title="Exam Hall AI" usage={data.ai.exam} />
              <UsageCard title="Studio AI" usage={data.ai.studio} />
            </div>

            <SpotlightCard className="overflow-hidden p-0">
              <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                <Database className="w-4 h-4 text-amber-300" />
                <div>
                  <div className="text-[0.65rem] uppercase tracking-[0.3em] text-amber-400/80 font-bold">
                    Question Bank Coverage
                  </div>
                  <div className="text-lg font-display text-white/90">
                    {data.questionBank.totalQuestions} questions across{" "}
                    {data.questionBank.perApp.length} apps
                  </div>
                </div>
              </div>
              <ul className="divide-y divide-white/5">
                {data.questionBank.perApp
                  .slice()
                  .sort((a, b) => a.count - b.count)
                  .map((p) => {
                    const tone =
                      p.count < 10
                        ? "text-rose-300"
                        : p.count < 20
                          ? "text-amber-300"
                          : "text-emerald-300";
                    return (
                      <li
                        key={p.appSlug}
                        data-testid={`bank-${p.appSlug}`}
                        className="px-6 py-3 flex items-center gap-4"
                      >
                        <span className="text-white/85 flex-1">{p.appName}</span>
                        <span className="text-[0.6rem] uppercase tracking-widest text-white/40 font-mono">
                          {p.appSlug}
                        </span>
                        <span className={`font-display text-xl font-bold ${tone}`}>
                          {p.count}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </SpotlightCard>

            <div className="grid md:grid-cols-3 gap-6">
              <BreakdownCard
                title="Users"
                rows={data.users.breakdown.map((b) => ({
                  label: `${b.role} · ${b.status}`,
                  value: b.count,
                }))}
              />
              <BreakdownCard
                title="Exam Hall"
                rows={[
                  { label: "Templates", value: data.examHall.templates },
                  ...data.examHall.sessions.map((s) => ({
                    label: `Sessions · ${s.status}`,
                    value: s.count,
                  })),
                ]}
              />
              <BreakdownCard
                title="Studio"
                rows={[
                  ...data.studio.assessments.map((s) => ({
                    label: `Assessments · ${s.status}`,
                    value: s.count,
                  })),
                  ...data.studio.attempts.map((s) => ({
                    label: `Attempts · ${s.status}`,
                    value: s.count,
                  })),
                ]}
              />
            </div>

            <div className="text-xs text-white/40 text-center">
              Snapshot generated at{" "}
              {new Date(data.generatedAt).toLocaleString()}
            </div>
          </>
        ) : null}
      </div>
    </CinematicShell>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: any;
  label: string;
  value: number | string;
  tone: string;
  hint?: string;
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
        {hint ? <div className="text-[0.6rem] mt-1 opacity-70">{hint}</div> : null}
      </div>
    </div>
  );
}

function UsageCard({
  title,
  usage,
}: {
  title: string;
  usage: {
    callsFast: number;
    callsFull: number;
    cacheHits: number;
    failures: number;
    cacheSize: number;
    startedAt: string;
  };
}) {
  return (
    <SpotlightCard className="p-6 space-y-3">
      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fuchsia-400/80 font-bold">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Row label="Calls (full)" value={usage.callsFull} />
        <Row label="Calls (fast)" value={usage.callsFast} />
        <Row label="Cache hits" value={usage.cacheHits} />
        <Row label="Cache size" value={`${usage.cacheSize}/500`} />
        <Row label="Failures" value={usage.failures} />
        <Row
          label="Since"
          value={new Date(usage.startedAt).toLocaleTimeString()}
        />
      </div>
    </SpotlightCard>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-white/5 pb-1">
      <span className="text-[0.6rem] uppercase tracking-widest text-white/50">
        {label}
      </span>
      <span className="font-mono text-white/90">{value}</span>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
  return (
    <SpotlightCard className="p-6 space-y-3">
      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-amber-400/80 font-bold">
        {title}
      </div>
      <ul className="space-y-2 text-sm">
        {rows.length === 0 ? (
          <li className="text-white/40 text-xs">No data yet.</li>
        ) : (
          rows.map((r) => (
            <li key={r.label} className="flex items-baseline justify-between">
              <span className="text-white/70 text-xs">{r.label}</span>
              <span className="font-mono text-white/95 font-bold">{r.value}</span>
            </li>
          ))
        )}
      </ul>
    </SpotlightCard>
  );
}
