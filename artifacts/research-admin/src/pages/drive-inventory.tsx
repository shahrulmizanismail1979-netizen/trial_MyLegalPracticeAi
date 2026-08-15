import { useCallback, useEffect, useState } from "react";
import {
  assetsApi,
  inventoryApi,
  type DriveAsset,
  type DriveAssetsPage,
  type InventoryRun,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  Play,
  FolderOpen,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SOURCE_LABELS: Record<string, { label: string; cls: string }> = {
  OFFICIAL_JUDGMENT: { label: "Official", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  COURT_AUTHORISED_COPY: { label: "Court Auth.", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  EXPRESSLY_LICENSED_SOURCE: { label: "Licensed", cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" },
  COMMERCIAL_PUBLISHER_REPORT: { label: "Publisher", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  UNKNOWN_SOURCE: { label: "Unknown", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
};

const RIGHTS_LABELS: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: "Approved", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  RIGHTS_REVIEW_REQUIRED: { label: "Review Needed", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  NEEDS_OFFICIAL_SOURCE: { label: "Needs Official", cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300" },
  RESTRICTED_REFERENCE_ONLY: { label: "Restricted", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
};

function Badge({ map, value }: { map: Record<string, { label: string; cls: string }>; value: string }) {
  const entry = map[value] ?? { label: value, cls: "bg-slate-100 text-slate-700" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${entry.cls}`}>
      {entry.label}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  const k = 1024;
  const s = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), s.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
}

export default function DriveInventoryPage() {
  const { toast } = useToast();
  const [page, setPage] = useState<DriveAssetsPage | null>(null);
  const [run, setRun] = useState<InventoryRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [rightsFilter, setRightsFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const loadAssets = useCallback(() => {
    setLoading(true);
    assetsApi
      .list({
        limit: LIMIT,
        offset,
        search: search || undefined,
        rightsStatus: rightsFilter || undefined,
        sourceClassification: classFilter || undefined,
      })
      .then(setPage)
      .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [offset, search, rightsFilter, classFilter]);

  const loadRun = () => {
    inventoryApi.status().then(setRun).catch(() => null);
  };

  useEffect(() => {
    loadAssets();
    loadRun();
  }, [loadAssets]);

  // Poll while running
  useEffect(() => {
    if (run?.status !== "RUNNING") return;
    const id = setInterval(() => {
      loadRun();
      loadAssets();
    }, 5000);
    return () => clearInterval(id);
  }, [run?.status, loadAssets]);

  const startInventory = async () => {
    setStarting(true);
    try {
      const r = await inventoryApi.start();
      toast({ title: "Inventory started", description: `Run #${r.runId} is now crawling Google Drive.` });
      loadRun();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Could not start inventory", description: msg, variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setRightsFilter("");
    setClassFilter("");
    setOffset(0);
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Drive Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Google Drive assets discovered in the root contribution folder
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { loadAssets(); loadRun(); }} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={startInventory}
            disabled={starting || run?.status === "RUNNING"}
          >
            <Play size={14} />
            {run?.status === "RUNNING" ? "Running…" : "Start Inventory"}
          </Button>
        </div>
      </div>

      {/* Current run status */}
      {run && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex flex-wrap gap-x-6 gap-y-1 ${
          run.status === "RUNNING"
            ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
            : run.status === "COMPLETED"
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300"
              : "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20 text-red-800 dark:text-red-300"
        }`}>
          <span className="font-semibold">
            {run.status === "RUNNING" && "⟳ "}
            Run #{run.id}: {run.status}
          </span>
          <span>{run.totalItems.toLocaleString()} files</span>
          <span>{run.totalFolders.toLocaleString()} folders</span>
          <span>{formatBytes(run.totalBytes)}</span>
          {run.errorMessage && <span className="text-red-600 dark:text-red-400">Error: {run.errorMessage}</span>}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="Search by name or path…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={rightsFilter}
          onChange={(e) => { setRightsFilter(e.target.value); setOffset(0); }}
        >
          <option value="">All Rights Statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="RIGHTS_REVIEW_REQUIRED">Review Needed</option>
          <option value="NEEDS_OFFICIAL_SOURCE">Needs Official Source</option>
          <option value="RESTRICTED_REFERENCE_ONLY">Restricted</option>
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={classFilter}
          onChange={(e) => { setClassFilter(e.target.value); setOffset(0); }}
        >
          <option value="">All Source Types</option>
          <option value="OFFICIAL_JUDGMENT">Official Judgment</option>
          <option value="COURT_AUTHORISED_COPY">Court Authorised</option>
          <option value="EXPRESSLY_LICENSED_SOURCE">Licensed</option>
          <option value="COMMERCIAL_PUBLISHER_REPORT">Publisher Report</option>
          <option value="UNKNOWN_SOURCE">Unknown</option>
        </select>
        {(search || rightsFilter || classFilter) && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground text-left">
                <th className="px-4 py-3 font-medium">File Name</th>
                <th className="px-4 py-3 font-medium">Folder Path</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Rights Status</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Modified</th>
              </tr>
            </thead>
            <tbody>
              {loading && !page && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <RefreshCw size={18} className="animate-spin inline mr-2" />
                    Loading…
                  </td>
                </tr>
              )}
              {page?.assets.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <FolderOpen size={32} className="mx-auto mb-2 opacity-30" />
                    No assets found. Start an inventory to discover Drive files.
                  </td>
                </tr>
              )}
              {page?.assets.map((asset) => (
                <tr key={asset.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium truncate max-w-[240px]" title={asset.name}>
                    {asset.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]" title={asset.folderPath ?? ""}>
                    {asset.folderPath || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge map={SOURCE_LABELS} value={asset.sourceClassification} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge map={RIGHTS_LABELS} value={asset.rightsStatus} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {formatBytes(asset.size ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {asset.modifiedTime ? new Date(asset.modifiedTime).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {page && page.total > LIMIT && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {offset + 1}–{Math.min(offset + LIMIT, page.total)} of{" "}
            {page.total.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            >
              <ChevronLeft size={14} />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + LIMIT >= page.total}
              onClick={() => setOffset(offset + LIMIT)}
            >
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
