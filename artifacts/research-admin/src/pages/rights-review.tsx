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
import { RefreshCw, ShieldCheck, ChevronLeft, ChevronRight, Zap, Ban, ShieldAlert, CheckCircle2 } from "lucide-react";
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

type RestrictedBulkDialog =
  | { action: "reject"; count: number }
  | { action: "approve"; count: number }
  | null;

export default function RightsReviewPage() {
  const { toast } = useToast();

  // ── RIGHTS_REVIEW_REQUIRED section ──────────────────────────────────────────
  const [page, setPage] = useState<DriveAssetsPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  // Bulk approval state (RIGHTS_REVIEW_REQUIRED)
  const [bulkTarget, setBulkTarget] = useState<BulkTarget | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Summary counts by source classification (loaded once)
  const [summary, setSummary] = useState<Record<string, number>>({});

  // ── RESTRICTED_REFERENCE_ONLY section ───────────────────────────────────────
  const [restrictedPage, setRestrictedPage] = useState<DriveAssetsPage | null>(null);
  const [restrictedLoading, setRestrictedLoading] = useState(false);
  const [restrictedOffset, setRestrictedOffset] = useState(0);
  const [restrictedUpdating, setRestrictedUpdating] = useState<number | null>(null);
  const [restrictedBulkDialog, setRestrictedBulkDialog] = useState<RestrictedBulkDialog>(null);
  const [restrictedBulkBusy, setRestrictedBulkBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    assetsApi
      .list({ limit: LIMIT, offset, rightsStatus: "RIGHTS_REVIEW_REQUIRED" })
      .then(setPage)
      .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [offset]);

  const loadRestricted = useCallback(() => {
    setRestrictedLoading(true);
    assetsApi
      .list({ limit: LIMIT, offset: restrictedOffset, rightsStatus: "RESTRICTED_REFERENCE_ONLY" })
      .then(setRestrictedPage)
      .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setRestrictedLoading(false));
  }, [restrictedOffset]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadRestricted(); }, [loadRestricted]);

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

  // ── Restricted asset handlers ────────────────────────────────────────────────

  const approveRestricted = async (id: number) => {
    setRestrictedUpdating(id);
    try {
      await assetsApi.updateRights(id, "APPROVED");
      toast({ title: "Asset approved", description: "Queued for ingestion." });
      loadRestricted();
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRestrictedUpdating(null);
    }
  };

  const rejectRestricted = async (id: number) => {
    setRestrictedUpdating(id);
    try {
      await assetsApi.rejectRestricted(id);
      toast({ title: "Asset rejected", description: "Marked as cancelled — will not be processed." });
      loadRestricted();
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRestrictedUpdating(null);
    }
  };

  const confirmRestrictedBulk = async () => {
    if (!restrictedBulkDialog) return;
    setRestrictedBulkBusy(true);
    try {
      const result = await assetsApi.bulkRestricted(restrictedBulkDialog.action);
      if (restrictedBulkDialog.action === "reject") {
        toast({
          title: "Bulk rejection complete",
          description: `${result.updated.toLocaleString()} asset${result.updated !== 1 ? "s" : ""} cancelled and queued for deletion.`,
        });
      } else {
        toast({
          title: "Bulk approval complete",
          description: result.ingestionQueued != null && result.ingestionQueued > 0
            ? `${result.updated.toLocaleString()} assets approved, ${result.ingestionQueued.toLocaleString()} queued for ingestion.`
            : `${result.updated.toLocaleString()} assets approved.`,
        });
      }
      loadRestricted();
    } catch (e: unknown) {
      toast({
        title: "Bulk action failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRestrictedBulkBusy(false);
      setRestrictedBulkDialog(null);
    }
  };

  const totalPending = page?.total ?? 0;
  const totalRestricted = restrictedPage?.total ?? 0;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* ── RIGHTS_REVIEW_REQUIRED section ─────────────────────────────────── */}
      <div className="space-y-5">
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
      </div>

      {/* ── RESTRICTED_REFERENCE_ONLY section ──────────────────────────────── */}
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert size={20} className="text-red-500 shrink-0" />
              <h2 className="text-xl font-bold">Commercial Publisher Assets</h2>
              {totalRestricted > 0 && (
                <span className="rounded-full bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5">
                  {totalRestricted.toLocaleString()} restricted
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 ml-7">
              Assets classified as commercial publisher reports (CLJ, LexisNexis, AMR, etc.)
              with <code className="text-xs bg-muted px-1 rounded">RESTRICTED_REFERENCE_ONLY</code> status.
              Approve only if a licence agreement is confirmed; otherwise reject to queue for deletion.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {totalRestricted > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRestrictedBulkDialog({ action: "approve", count: totalRestricted })}
                  disabled={restrictedBulkBusy || restrictedLoading}
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <CheckCircle2 size={14} />
                  Bulk Approve ({totalRestricted.toLocaleString()})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRestrictedBulkDialog({ action: "reject", count: totalRestricted })}
                  disabled={restrictedBulkBusy || restrictedLoading}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <Ban size={14} />
                  Bulk Reject ({totalRestricted.toLocaleString()})
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={loadRestricted} disabled={restrictedLoading}>
              <RefreshCw size={14} className={restrictedLoading ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
        </div>

        {totalRestricted === 0 && !restrictedLoading && (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <ShieldCheck size={32} className="mx-auto mb-3 text-emerald-500" />
            <p className="text-foreground font-medium">No restricted assets pending</p>
            <p className="text-sm text-muted-foreground mt-1">
              All commercial publisher assets have been resolved.
            </p>
          </div>
        )}

        {(restrictedPage?.assets ?? []).length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {restrictedPage!.total.toLocaleString()} restricted assets — showing{" "}
              {restrictedOffset + 1}–{Math.min(restrictedOffset + LIMIT, restrictedPage!.total)}
            </p>

            <div className="space-y-3">
              {restrictedPage!.assets.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-card border border-red-200 rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-foreground truncate" title={asset.name}>
                      {asset.name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {asset.folderPath || "Root folder"}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>
                        Source: {SOURCE_LABELS[asset.sourceClassification] ?? asset.sourceClassification}
                      </span>
                      {asset.size && (
                        <span>· {(asset.size / 1024 / 1024).toFixed(2)} MB</span>
                      )}
                      <span className="rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 font-medium">
                        Restricted
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      disabled={restrictedUpdating === asset.id}
                      onClick={() => approveRestricted(asset.id)}
                      className="rounded-md px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
                    >
                      {restrictedUpdating === asset.id ? (
                        <RefreshCw size={12} className="animate-spin inline mr-1" />
                      ) : (
                        <CheckCircle2 size={12} className="inline mr-1" />
                      )}
                      Approve (Licence Confirmed)
                    </button>
                    <button
                      disabled={restrictedUpdating === asset.id}
                      onClick={() => rejectRestricted(asset.id)}
                      className="rounded-md px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
                    >
                      {restrictedUpdating === asset.id ? (
                        <RefreshCw size={12} className="animate-spin inline mr-1" />
                      ) : (
                        <Ban size={12} className="inline mr-1" />
                      )}
                      Reject (Do Not Retain)
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {restrictedPage!.total > LIMIT && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {restrictedOffset + 1}–{Math.min(restrictedOffset + LIMIT, restrictedPage!.total)} of{" "}
                  {restrictedPage!.total.toLocaleString()}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={restrictedOffset === 0}
                    onClick={() => setRestrictedOffset(Math.max(0, restrictedOffset - LIMIT))}
                  >
                    <ChevronLeft size={14} /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={restrictedOffset + LIMIT >= restrictedPage!.total}
                    onClick={() => setRestrictedOffset(restrictedOffset + LIMIT)}
                  >
                    Next <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {restrictedLoading && !restrictedPage && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <RefreshCw size={18} className="animate-spin mr-2" /> Loading restricted assets…
          </div>
        )}
      </div>

      {/* ── Bulk Approve Dialog (RIGHTS_REVIEW_REQUIRED) ──────────────────── */}
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

      {/* ── Bulk Restricted Dialog (approve or reject) ─────────────────────── */}
      <AlertDialog
        open={!!restrictedBulkDialog}
        onOpenChange={(open) => { if (!open && !restrictedBulkBusy) setRestrictedBulkDialog(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {restrictedBulkDialog?.action === "reject"
                ? `Reject all ${restrictedBulkDialog.count.toLocaleString()} restricted assets?`
                : `Approve all ${restrictedBulkDialog?.count.toLocaleString()} restricted assets?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {restrictedBulkDialog?.action === "reject" ? (
                  <>
                    <p>
                      All <strong>{restrictedBulkDialog.count.toLocaleString()}</strong> commercial
                      publisher assets with <em>RESTRICTED_REFERENCE_ONLY</em> status will be{" "}
                      <strong>cancelled</strong> and queued for deletion. They will not enter the
                      processing pipeline.
                    </p>
                    <p className="text-muted-foreground">
                      This action cannot be undone in bulk. All non-terminal restricted assets
                      (including any currently in-flight) will be cancelled and their linked
                      batch items neutralised so no commercial content enters the pipeline.
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      All <strong>{restrictedBulkDialog?.count.toLocaleString()}</strong> commercial
                      publisher assets will be set to <strong>APPROVED</strong> and queued for
                      ingestion.
                    </p>
                    <p className="font-semibold text-amber-700">
                      ⚠ Only approve if a valid licence agreement exists for all of these assets.
                      Approving without a licence may create legal liability.
                    </p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restrictedBulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRestrictedBulk}
              disabled={restrictedBulkBusy}
              className={
                restrictedBulkDialog?.action === "reject"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }
            >
              {restrictedBulkBusy ? (
                <><RefreshCw size={14} className="animate-spin mr-1" /> Processing…</>
              ) : restrictedBulkDialog?.action === "reject" ? (
                "Yes, reject all"
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
