import { useCallback, useEffect, useState } from "react";
import { queueApi, type JobsPage, type QueueStats } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  QUEUED: { label: "Queued", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  RUNNING: { label: "Running", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  FAILED_RETRYABLE: { label: "Failed (retrying)", cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  REVIEW_REQUIRED: { label: "Review Required", cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  BLOCKED_BY_RIGHTS: { label: "Blocked", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  SUCCEEDED: { label: "Succeeded", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  FAILED_PERMANENT: { label: "Failed (permanent)", cls: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200" },
  CANCELLED: { label: "Cancelled", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: "bg-slate-100 text-slate-700" };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export default function ProcessingQueuePage() {
  const { toast } = useToast();
  const [page, setPage] = useState<JobsPage | null>(null);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      queueApi.list({ limit: LIMIT, offset, status: statusFilter || undefined }),
      queueApi.stats(),
    ])
      .then(([p, s]) => { setPage(p); setStats(s); })
      .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [offset, statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Processing Queue</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Research pipeline jobs (ingest → extract → segment → validate → publish)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {/* Stats pills */}
      {stats && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
            const n = stats[status] ?? 0;
            if (!n) return null;
            return (
              <button
                key={status}
                onClick={() => { setStatusFilter(statusFilter === status ? "" : status); setOffset(0); }}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                  statusFilter === status
                    ? "ring-2 ring-primary " + cfg.cls
                    : cfg.cls + " border-transparent"
                }`}
              >
                {cfg.label}
                <span className="font-bold">{n.toLocaleString()}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
        {statusFilter && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(""); setOffset(0); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground text-left">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Attempts</th>
                <th className="px-4 py-3 font-medium">Error</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && !page && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <RefreshCw size={18} className="animate-spin inline mr-2" /> Loading…
                  </td>
                </tr>
              )}
              {page?.jobs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    No jobs found.
                  </td>
                </tr>
              )}
              {page?.jobs.map((job) => (
                <tr key={job.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">#{job.id}</td>
                  <td className="px-4 py-3 font-mono text-xs">{job.kind}</td>
                  <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{job.attempts}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[200px]" title={job.error ?? ""}>
                    {job.error ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(job.createdAt).toLocaleString('en-GB')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {page && page.total > LIMIT && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{offset + 1}–{Math.min(offset + LIMIT, page.total)} of {page.total.toLocaleString()}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
              <ChevronLeft size={14} /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={offset + LIMIT >= page.total} onClick={() => setOffset(offset + LIMIT)}>
              Next <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
