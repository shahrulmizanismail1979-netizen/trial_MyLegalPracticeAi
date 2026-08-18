import { useCallback, useEffect, useState } from "react";
import {
  assetsApi,
  inventoryApi,
  pipelineApi,
  containerApprovalApi,
  type DriveAsset,
  type DriveAssetsPage,
  type DriveProcessingStatus,
  type InventoryRun,
  type PipelineRunStatus,
  type BulkContainerApprovalStatus,
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
  Zap,
  RotateCcw,
  ShieldCheck,
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

const PIPELINE_LABELS: Record<DriveProcessingStatus, { label: string; cls: string }> = {
  PENDING:              { label: "Pending",         cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  RIGHTS_PENDING:       { label: "Rights ⏳",       cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  RIGHTS_APPROVED:      { label: "Rights ✓",        cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  RIGHTS_REJECTED:      { label: "Rights ✗",        cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  INGESTION_QUEUED:     { label: "Queued",           cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  INGESTION_RUNNING:    { label: "Ingesting…",       cls: "bg-blue-200 text-blue-800 dark:bg-blue-800/40 dark:text-blue-200" },
  INGESTION_COMPLETE:   { label: "Ingested",         cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  EXTRACTION_QUEUED:    { label: "Extract Queued",   cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  EXTRACTION_RUNNING:   { label: "Extracting…",      cls: "bg-violet-200 text-violet-800 dark:bg-violet-800/40 dark:text-violet-200" },
  EXTRACTION_COMPLETE:  { label: "Extracted",        cls: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300" },
  SEGMENTATION_QUEUED:  { label: "Segment Queued",   cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  SEGMENTATION_RUNNING: { label: "Segmenting…",      cls: "bg-indigo-200 text-indigo-800 dark:bg-indigo-800/40 dark:text-indigo-200" },
  SEGMENTATION_COMPLETE:{ label: "Segmented",        cls: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300" },
  REVIEW_QUEUED:        { label: "Review Queued",    cls: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300" },
  REVIEW_IN_PROGRESS:   { label: "In Review",        cls: "bg-cyan-200 text-cyan-800 dark:bg-cyan-800/40 dark:text-cyan-200" },
  REVIEW_COMPLETE:      { label: "Reviewed",         cls: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300" },
  PUBLICATION_QUEUED:   { label: "Publishing…",      cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" },
  PUBLISHED:            { label: "Published ✓",      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  FAILED:               { label: "Failed ✗",         cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  CANCELLED:            { label: "Cancelled",        cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

function Badge({ map, value }: { map: Record<string, { label: string; cls: string }>; value: string }) {
  const entry = map[value] ?? { label: value, cls: "bg-slate-100 text-slate-700" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${entry.cls}`}>
      {entry.label}
    </span>
  );
}

function PipelineBadge({ status }: { status: DriveProcessingStatus }) {
  const entry = PIPELINE_LABELS[status] ?? { label: status, cls: "bg-slate-100 text-slate-700" };
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

function isPipelineActive(status: DriveProcessingStatus): boolean {
  return [
    "INGESTION_QUEUED", "INGESTION_RUNNING", "INGESTION_COMPLETE",
    "EXTRACTION_QUEUED", "EXTRACTION_RUNNING", "EXTRACTION_COMPLETE",
    "SEGMENTATION_QUEUED", "SEGMENTATION_RUNNING", "SEGMENTATION_COMPLETE",
    "REVIEW_QUEUED", "REVIEW_IN_PROGRESS", "REVIEW_COMPLETE",
    "PUBLICATION_QUEUED",
  ].includes(status);
}

export default function DriveInventoryPage() {
  const { toast } = useToast();
  const [page, setPage] = useState<DriveAssetsPage | null>(null);
  const [inventoryRun, setInventoryRun] = useState<InventoryRun | null>(null);
  const [pipelineRun, setPipelineRun] = useState<PipelineRunStatus>(null);
  const [containerApproval, setContainerApproval] = useState<BulkContainerApprovalStatus>(null);
  const [loading, setLoading] = useState(false);
  const [startingInventory, setStartingInventory] = useState(false);
  const [startingPipeline, setStartingPipeline] = useState(false);
  const [approvingContainers, setApprovingContainers] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [ingestingId, setIngestingId] = useState<number | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [rightsFilter, setRightsFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [pipelineFilter, setPipelineFilter] = useState("");
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
        processingStatus: pipelineFilter || undefined,
      })
      .then(setPage)
      .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [offset, search, rightsFilter, classFilter, pipelineFilter]);

  const loadInventoryRun = () => {
    inventoryApi.status().then(setInventoryRun).catch(() => null);
  };

  const loadPipelineRun = () => {
    pipelineApi.status().then(setPipelineRun).catch(() => null);
  };

  const loadContainerApproval = () => {
    containerApprovalApi.status().then(setContainerApproval).catch(() => null);
  };

  useEffect(() => {
    loadAssets();
    loadInventoryRun();
    loadPipelineRun();
    loadContainerApproval();
  }, [loadAssets]);

  // Poll while any run is active
  useEffect(() => {
    const anyActive =
      inventoryRun?.status === "RUNNING" ||
      pipelineRun?.running ||
      containerApproval?.running;
    if (!anyActive) return;
    const id = setInterval(() => {
      loadInventoryRun();
      loadPipelineRun();
      loadContainerApproval();
      loadAssets();
    }, 4000);
    return () => clearInterval(id);
  }, [inventoryRun?.status, pipelineRun?.running, containerApproval?.running, loadAssets]);

  const startInventory = async () => {
    setStartingInventory(true);
    try {
      const r = await inventoryApi.start();
      toast({ title: "Inventory started", description: `Run #${r.runId} is crawling Google Drive.` });
      loadInventoryRun();
    } catch (e: unknown) {
      toast({ title: "Could not start inventory", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setStartingInventory(false);
    }
  };

  const startPipeline = async () => {
    setStartingPipeline(true);
    try {
      const r = await pipelineApi.start();
      if (!r.started) {
        toast({ title: "Pipeline not started", description: "No APPROVED + PENDING assets found, or a run is already active." });
      } else {
        toast({ title: "Pipeline started", description: "Downloading and ingesting approved Drive assets into the research pipeline." });
        loadPipelineRun();
      }
    } catch (e: unknown) {
      toast({ title: "Pipeline error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setStartingPipeline(false);
    }
  };

  const syncStatuses = async () => {
    setSyncing(true);
    try {
      const r = await pipelineApi.sync();
      toast({ title: "Status synced", description: `Updated ${r.updated} asset${r.updated !== 1 ? "s" : ""}.` });
      loadAssets();
    } catch (e: unknown) {
      toast({ title: "Sync failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const approveContainerRights = async () => {
    setApprovingContainers(true);
    try {
      const r = await containerApprovalApi.start();
      if (!r.started) {
        toast({ title: "Nothing to approve", description: r.reason ?? "No containers need rights approval." });
      } else {
        toast({
          title: "Container approval started",
          description: `Approving rights for ${r.total?.toLocaleString() ?? "all"} pipeline containers and starting inventory jobs.`,
        });
        loadContainerApproval();
      }
    } catch (e: unknown) {
      toast({ title: "Approval error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setApprovingContainers(false);
    }
  };

  const ingestSingle = async (asset: DriveAsset) => {
    setIngestingId(asset.id);
    try {
      const r = await pipelineApi.ingestAsset(asset.id);
      if (r.queued) {
        toast({ title: "Queued", description: `"${asset.name}" sent to the pipeline.` });
      } else {
        toast({ title: "Skipped", description: r.reason ?? r.errorMessage ?? "Already processed.", variant: "destructive" });
      }
      loadAssets();
    } catch (e: unknown) {
      toast({ title: "Ingest failed", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setIngestingId(null);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setRightsFilter("");
    setClassFilter("");
    setPipelineFilter("");
    setOffset(0);
  };

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Drive Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Google Drive assets · inventory → pipeline → research database
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { loadAssets(); loadInventoryRun(); loadPipelineRun(); }} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={syncStatuses} disabled={syncing}>
            <RotateCcw size={14} className={syncing ? "animate-spin" : ""} />
            Sync Status
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={startInventory}
            disabled={startingInventory || inventoryRun?.status === "RUNNING"}
          >
            <Play size={14} />
            {inventoryRun?.status === "RUNNING" ? "Scanning…" : "Scan Drive"}
          </Button>
          <Button
            size="sm"
            onClick={startPipeline}
            disabled={startingPipeline || pipelineRun?.running}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Zap size={14} />
            {pipelineRun?.running ? `Processing ${pipelineRun.completed}/${pipelineRun.total}…` : "Run Pipeline"}
          </Button>
          <Button
            size="sm"
            onClick={approveContainerRights}
            disabled={approvingContainers || !!containerApproval?.running}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ShieldCheck size={14} />
            {containerApproval?.running
              ? `Approving ${containerApproval.completed}/${containerApproval.total}…`
              : "Approve Container Rights"}
          </Button>
        </div>
      </div>

      {/* Inventory run status */}
      {inventoryRun && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex flex-wrap gap-x-6 gap-y-1 ${
          inventoryRun.status === "RUNNING"
            ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
            : inventoryRun.status === "COMPLETED"
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300"
              : "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20 text-red-800 dark:text-red-300"
        }`}>
          <span className="font-semibold">
            {inventoryRun.status === "RUNNING" && "⟳ "}
            Inventory Run #{inventoryRun.id}: {inventoryRun.status}
          </span>
          <span>{inventoryRun.totalItems.toLocaleString()} files</span>
          <span>{inventoryRun.totalFolders.toLocaleString()} folders</span>
          <span>{formatBytes(inventoryRun.totalBytes)}</span>
          {inventoryRun.errorMessage && <span className="text-red-600 dark:text-red-400">Error: {inventoryRun.errorMessage}</span>}
        </div>
      )}

      {/* Pipeline run status */}
      {pipelineRun && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          pipelineRun.running
            ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300"
            : pipelineRun.failed > 0
              ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
              : "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300"
        }`}>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span className="font-semibold">
              {pipelineRun.running && "⟳ "}
              Pipeline: {pipelineRun.running ? "Running" : "Finished"}
            </span>
            <span>{pipelineRun.queued.toLocaleString()} queued</span>
            <span>{pipelineRun.skipped.toLocaleString()} skipped</span>
            <span>{pipelineRun.failed.toLocaleString()} failed</span>
            <span>{pipelineRun.completed}/{pipelineRun.total} processed</span>
          </div>
          {pipelineRun.errors.length > 0 && (
            <div className="mt-2 text-xs text-red-700 dark:text-red-400 space-y-0.5">
              {pipelineRun.errors.slice(0, 3).map((e) => (
                <div key={e.assetId}>Asset #{e.assetId}: {e.message.slice(0, 120)}</div>
              ))}
              {pipelineRun.errors.length > 3 && <div>…and {pipelineRun.errors.length - 3} more errors</div>}
            </div>
          )}
        </div>
      )}

      {/* Container approval status */}
      {containerApproval && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${
          containerApproval.running
            ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300"
            : containerApproval.failed > 0
              ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
              : "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300"
        }`}>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span className="font-semibold">
              {containerApproval.running && "⟳ "}
              Container Rights Approval: {containerApproval.running ? "Running" : "Finished"}
            </span>
            <span>{containerApproval.approved.toLocaleString()} approved</span>
            <span>{containerApproval.skipped.toLocaleString()} skipped</span>
            {containerApproval.failed > 0 && <span>{containerApproval.failed.toLocaleString()} failed</span>}
            <span>{containerApproval.completed}/{containerApproval.total} processed</span>
          </div>
          <p className="text-xs mt-1 opacity-75">
            Containers approved here proceed to inventory → extraction → segmentation → editorial → publication.
          </p>
          {containerApproval.errors.length > 0 && (
            <div className="mt-2 text-xs text-red-700 dark:text-red-400 space-y-0.5">
              {containerApproval.errors.slice(0, 3).map((e) => (
                <div key={e.containerId}>Container #{e.containerId}: {e.message.slice(0, 120)}</div>
              ))}
              {containerApproval.errors.length > 3 && (
                <div>…and {containerApproval.errors.length - 3} more errors</div>
              )}
            </div>
          )}
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
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={pipelineFilter}
          onChange={(e) => { setPipelineFilter(e.target.value); setOffset(0); }}
        >
          <option value="">All Pipeline States</option>
          <option value="PENDING">Pending</option>
          <option value="INGESTION_QUEUED">Queued</option>
          <option value="INGESTION_RUNNING">Ingesting</option>
          <option value="INGESTION_COMPLETE">Ingested</option>
          <option value="EXTRACTION_QUEUED">Extract Queued</option>
          <option value="EXTRACTION_COMPLETE">Extracted</option>
          <option value="SEGMENTATION_QUEUED">Segment Queued</option>
          <option value="SEGMENTATION_COMPLETE">Segmented</option>
          <option value="REVIEW_QUEUED">Review Queued</option>
          <option value="REVIEW_IN_PROGRESS">In Review</option>
          <option value="REVIEW_COMPLETE">Reviewed</option>
          <option value="PUBLISHED">Published</option>
          <option value="FAILED">Failed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        {(search || rightsFilter || classFilter || pipelineFilter) && (
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
                <th className="px-4 py-3 font-medium">Rights</th>
                <th className="px-4 py-3 font-medium">Pipeline</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Modified</th>
                <th className="px-4 py-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading && !page && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <RefreshCw size={18} className="animate-spin inline mr-2" />
                    Loading…
                  </td>
                </tr>
              )}
              {page?.assets.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <FolderOpen size={32} className="mx-auto mb-2 opacity-30" />
                    No assets found. Start a Drive scan to discover files.
                  </td>
                </tr>
              )}
              {page?.assets.map((asset) => (
                <tr key={asset.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium truncate max-w-[220px]" title={asset.name}>
                    {asset.name}
                    {asset.pipelineError && (
                      <div className="text-xs text-red-500 mt-0.5 truncate" title={asset.pipelineError}>
                        {asset.pipelineError.slice(0, 60)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]" title={asset.folderPath ?? ""}>
                    {asset.folderPath || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge map={SOURCE_LABELS} value={asset.sourceClassification} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge map={RIGHTS_LABELS} value={asset.rightsStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <PipelineBadge status={asset.processingStatus} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">
                    {formatBytes(asset.size ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {asset.modifiedTime ? new Date(asset.modifiedTime).toLocaleDateString('en-GB') : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {/* Re-ingest button for PENDING or FAILED approved assets */}
                    {asset.rightsStatus === "APPROVED" && (asset.processingStatus === "PENDING" || asset.processingStatus === "FAILED") && (
                      <button
                        title={asset.processingStatus === "FAILED" ? "Retry ingestion" : "Send to pipeline"}
                        disabled={ingestingId === asset.id}
                        onClick={() => ingestSingle(asset)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                      >
                        {ingestingId === asset.id
                          ? <RefreshCw size={13} className="animate-spin" />
                          : asset.processingStatus === "FAILED"
                            ? <RotateCcw size={13} />
                            : <Zap size={13} />
                        }
                      </button>
                    )}
                    {/* In-flight spinner */}
                    {isPipelineActive(asset.processingStatus) && (
                      <RefreshCw size={13} className="animate-spin text-blue-500" />
                    )}
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
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
              <ChevronLeft size={14} />
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={offset + LIMIT >= page.total} onClick={() => setOffset(offset + LIMIT)}>
              Next
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
