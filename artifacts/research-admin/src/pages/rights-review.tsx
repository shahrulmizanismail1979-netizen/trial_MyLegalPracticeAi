import { useCallback, useEffect, useState } from "react";
import { assetsApi, type DriveAsset, type DriveAssetsPage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RefreshCw, ShieldCheck, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RIGHTS_OPTIONS: Array<{
  value: DriveAsset["rightsStatus"];
  label: string;
  cls: string;
}> = [
  { value: "APPROVED", label: "Approve", cls: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  { value: "RESTRICTED_REFERENCE_ONLY", label: "Restrict", cls: "bg-red-600 hover:bg-red-700 text-white" },
  { value: "NEEDS_OFFICIAL_SOURCE", label: "Needs Official", cls: "bg-orange-600 hover:bg-orange-700 text-white" },
  { value: "RIGHTS_REVIEW_REQUIRED", label: "Keep for Review", cls: "bg-slate-600 hover:bg-slate-700 text-white" },
];

const SOURCE_LABELS: Record<string, string> = {
  OFFICIAL_JUDGMENT: "Official Judgment",
  COURT_AUTHORISED_COPY: "Court Authorised Copy",
  EXPRESSLY_LICENSED_SOURCE: "Expressly Licensed",
  COMMERCIAL_PUBLISHER_REPORT: "Commercial Publisher Report",
  UNKNOWN_SOURCE: "Unknown Source",
};

type BulkTarget = {
  classification?: string;
  classificationLabel?: string;
  count: number;
};

export default function RightsReviewPage() {
  const { toast } = useToast();
  const [page, setPage] = useState<DriveAssetsPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  // Bulk approval state
  const [bulkTarget, setBulkTarget] = useState<BulkTarget | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Summary counts by source classification (loaded once)
  const [summary, setSummary] = useState<Record<string, number>>({});

  const load = useCallback(() => {
    setLoading(true);
    assetsApi
      .list({ limit: LIMIT, offset, rightsStatus: "RIGHTS_REVIEW_REQUIRED" })
      .then(setPage)
      .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [offset]);

  useEffect(() => { load(); }, [load]);

  // Load per-classification counts whenever page total changes
  useEffect(() => {
    const classifications = [
      "UNKNOWN_SOURCE",
      "EXPRESSLY_LICENSED_SOURCE",
      "COMMERCIAL_PUBLISHER_REPORT",
      "COURT_AUTHORISED_COPY",
      "OFFICIAL_JUDGMENT",
    ];
    Promise.all(
      classifications.map((c) =>
        assetsApi
          .list({ limit: 1, offset: 0, rightsStatus: "RIGHTS_REVIEW_REQUIRED", sourceClassification: c })
          .then((p) => [c, p.total] as const)
          .catch(() => [c, 0] as const),
      ),
    ).then((entries) => {
      setSummary(Object.fromEntries(entries.filter(([, n]) => n > 0)));
    });
  }, [page?.total]);

  const decide = async (id: number, rights: DriveAsset["rightsStatus"]) => {
    setUpdating(id);
    try {
      await assetsApi.updateRights(id, rights);
      toast({ title: "Rights decision saved" });
      load();
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const openBulkDialog = (classification?: string) => {
    const count = classification ? (summary[classification] ?? 0) : (page?.total ?? 0);
    setBulkTarget({
      classification,
      classificationLabel: classification ? SOURCE_LABELS[classification] ?? classification : undefined,
      count,
    });
  };

  const confirmBulkApprove = async () => {
    if (!bulkTarget) return;
    setBulkBusy(true);
    try {
      const result = await assetsApi.bulkUpdateRights("APPROVED", bulkTarget.classification);
      // ingestionQueued comes from the server — assets are already being
      // enqueued server-side, so no separate pipeline start is needed here.
      toast({
        title: "Bulk approval complete",
        description: result.ingestionQueued > 0
          ? `${result.updated.toLocaleString()} asset${result.updated !== 1 ? "s" : ""} approved and ${result.ingestionQueued.toLocaleString()} queued for ingestion.`
          : `${result.updated.toLocaleString()} asset${result.updated !== 1 ? "s" : ""} approved.`,
      });
      load();
    } catch (e: unknown) {
      toast({
        title: "Bulk approval failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBulkBusy(false);
      setBulkTarget(null);
    }
  };

  const totalPending = page?.total ?? 0;

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rights Review</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Assets requiring a rights decision before processing can begin
          </p>
        </div>
        <div className="flex gap-2">
          {totalPending > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => openBulkDialog()}
              disabled={bulkBusy || loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Zap size={14} />
              Approve All ({totalPending.toLocaleString()})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Per-classification breakdown with bulk approve buttons */}
      {Object.keys(summary).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Pending by Source Classification
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(summary).map(([cls, n]) => (
              <div
                key={cls}
                className="flex items-center justify-between gap-3 bg-muted/40 rounded-lg px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{SOURCE_LABELS[cls] ?? cls}</p>
                  <p className="text-xs text-muted-foreground">{n.toLocaleString()} pending</p>
                </div>
                <button
                  onClick={() => openBulkDialog(cls)}
                  disabled={bulkBusy}
                  className="rounded-md px-2.5 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50 shrink-0"
                >
                  Approve All
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {page?.total === 0 && !loading && (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <ShieldCheck size={36} className="mx-auto mb-3 text-emerald-500" />
          <p className="text-foreground font-medium">All clear!</p>
          <p className="text-sm text-muted-foreground mt-1">
            No assets are pending rights review.
          </p>
        </div>
      )}

      {(page?.assets ?? []).length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {page!.total.toLocaleString()} items pending review — showing {offset + 1}–{Math.min(offset + LIMIT, page!.total)}
          </p>

          <div className="space-y-3">
            {page!.assets.map((asset) => (
              <div
                key={asset.id}
                className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-foreground truncate" title={asset.name}>
                    {asset.name}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {asset.folderPath || "Root folder"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Source: {SOURCE_LABELS[asset.sourceClassification] ?? asset.sourceClassification}
                    {asset.size ? ` · ${(asset.size / 1024 / 1024).toFixed(2)} MB` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  {RIGHTS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      disabled={updating === asset.id}
                      onClick={() => decide(asset.id, opt.value)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${opt.cls}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {page!.total > LIMIT && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {offset + 1}–{Math.min(offset + LIMIT, page!.total)} of {page!.total.toLocaleString()}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
                  <ChevronLeft size={14} /> Previous
                </Button>
                <Button variant="outline" size="sm" disabled={offset + LIMIT >= page!.total} onClick={() => setOffset(offset + LIMIT)}>
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {loading && !page && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw size={18} className="animate-spin mr-2" /> Loading…
        </div>
      )}

      {/* Bulk Approve Confirmation Dialog */}
      <AlertDialog open={!!bulkTarget} onOpenChange={(open) => { if (!open && !bulkBusy) setBulkTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Approve {bulkTarget?.count.toLocaleString()} asset{(bulkTarget?.count ?? 0) !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  {bulkTarget?.classificationLabel
                    ? <>All <strong>{bulkTarget.count.toLocaleString()}</strong> <em>{bulkTarget.classificationLabel}</em> assets currently pending rights review will be set to <strong>APPROVED</strong>.</>
                    : <>All <strong>{bulkTarget?.count.toLocaleString()}</strong> assets currently pending rights review will be set to <strong>APPROVED</strong>.</>
                  }
                </p>
                <p className="text-muted-foreground">
                  Approved assets will immediately enter the processing pipeline (extract → segment → validate → headnotes → search index). This cannot be undone in bulk.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkApprove}
              disabled={bulkBusy}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {bulkBusy ? (
                <><RefreshCw size={14} className="animate-spin mr-1" /> Approving…</>
              ) : (
                "Yes, approve all"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
