import { useEffect, useState } from "react";
import { statsApi, type Stats } from "@/lib/api";
import {
  FolderOpen,
  ShieldCheck,
  ShieldX,
  BookOpen,
  AlertTriangle,
  Clock,
  CheckCircle,
  RefreshCw,
  ListOrdered,
} from "lucide-react";

function StatCard({
  label,
  value,
  icon,
  color = "default",
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color?: "default" | "green" | "amber" | "red" | "blue" | "slate";
  sub?: string;
}) {
  const colorMap = {
    default: "text-foreground bg-card",
    green: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
    blue: "text-blue-600 dark:text-blue-400",
    slate: "text-slate-500",
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <span className={`${colorMap[color]} opacity-80`}>{icon}</span>
      </div>
      <div>
        <p className="text-3xl font-bold text-foreground tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function InventoryRunBanner({ run }: { run: Stats["latestInventoryRun"] }) {
  if (!run) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground">
        No inventory run has been started yet. Go to{" "}
        <a href="./drive-inventory" className="underline text-primary">
          Drive Inventory
        </a>{" "}
        to begin.
      </div>
    );
  }

  const statusColor =
    run.status === "COMPLETED"
      ? "text-emerald-600 dark:text-emerald-400"
      : run.status === "FAILED"
        ? "text-red-500"
        : "text-amber-500";

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
      <div>
        <span className="text-muted-foreground">Latest inventory: </span>
        <span className={`font-medium ${statusColor}`}>{run.status}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Files: </span>
        <span className="font-medium">{run.totalItems.toLocaleString()}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Folders: </span>
        <span className="font-medium">{run.totalFolders.toLocaleString()}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Total size: </span>
        <span className="font-medium">{formatBytes(run.totalBytes)}</span>
      </div>
      {run.completedAt && (
        <div>
          <span className="text-muted-foreground">Completed: </span>
          <span className="font-medium">
            {new Date(run.completedAt).toLocaleString()}
          </span>
        </div>
      )}
      {run.status === "RUNNING" && (
        <div className="flex items-center gap-1.5 text-amber-500">
          <RefreshCw size={13} className="animate-spin" />
          Running…
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    statsApi
      .get()
      .then(setStats)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Poll every 15s if a run is in progress
    const id = setInterval(() => {
      if (stats?.latestInventoryRun?.status === "RUNNING") load();
    }, 15_000);
    return () => clearInterval(id);
  }, [stats?.latestInventoryRun?.status]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Malaysian Independent Case Law Intelligence Repository
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* Inventory run status */}
      <InventoryRunBanner run={stats?.latestInventoryRun ?? null} />

      {/* Stats grid */}
      {stats && (
        <>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Drive Assets
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              <StatCard
                label="Total Drive Files"
                value={stats.totalDriveAssets}
                icon={<FolderOpen size={20} />}
                color="blue"
              />
              <StatCard
                label="Rights Approved"
                value={stats.approved}
                icon={<ShieldCheck size={20} />}
                color="green"
              />
              <StatCard
                label="Rights Review Needed"
                value={stats.rightsReview}
                icon={<ShieldX size={20} />}
                color="amber"
              />
              <StatCard
                label="Restricted"
                value={stats.restricted}
                icon={<ShieldX size={20} />}
                color="red"
              />
              <StatCard
                label="Needs Official Source"
                value={stats.needsOfficialSource}
                icon={<BookOpen size={20} />}
                color="amber"
              />
              <StatCard
                label="Published"
                value={stats.published}
                icon={<CheckCircle size={20} />}
                color="green"
              />
              <StatCard
                label="Processing Pending"
                value={stats.pending}
                icon={<Clock size={20} />}
                color="slate"
              />
              <StatCard
                label="Failed"
                value={stats.failed}
                icon={<AlertTriangle size={20} />}
                color="red"
              />
            </div>
          </div>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Processing Queue (Research Jobs)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <StatCard
                label="Queued Jobs"
                value={stats.queuedJobs}
                icon={<ListOrdered size={20} />}
                color="blue"
              />
              <StatCard
                label="Failed Jobs"
                value={stats.failedJobs}
                icon={<AlertTriangle size={20} />}
                color="red"
              />
            </div>
          </div>
        </>
      )}

      {loading && !stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-5 h-28 animate-pulse"
            />
          ))}
        </div>
      )}
    </div>
  );
}
