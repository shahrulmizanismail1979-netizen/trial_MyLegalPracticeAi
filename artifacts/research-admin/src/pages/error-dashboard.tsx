import { useCallback, useEffect, useState } from "react";
import { errorsApi, type DriveAssetsPage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ErrorDashboardPage() {
  const { toast } = useToast();
  const [page, setPage] = useState<DriveAssetsPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const load = useCallback(() => {
    setLoading(true);
    errorsApi
      .list({ limit: LIMIT, offset })
      .then(setPage)
      .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [offset]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Error Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Drive assets that failed during processing
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {page?.total === 0 && !loading && (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <AlertTriangle size={36} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium text-foreground">No errors</p>
          <p className="text-sm text-muted-foreground mt-1">All assets have processed without failures.</p>
        </div>
      )}

      {(page?.assets ?? []).length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {page!.total.toLocaleString()} failed assets
          </p>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-muted-foreground text-left">
                    <th className="px-4 py-3 font-medium">File Name</th>
                    <th className="px-4 py-3 font-medium">Folder Path</th>
                    <th className="px-4 py-3 font-medium">Error</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {page!.assets.map((asset) => (
                    <tr key={asset.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium truncate max-w-[220px]" title={asset.name}>
                        {asset.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">
                        {asset.folderPath || "—"}
                      </td>
                      <td className="px-4 py-3 text-red-600 dark:text-red-400 text-xs truncate max-w-[280px]" title={asset.errorStatus ?? ""}>
                        {asset.errorStatus || "Unknown error"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(asset.updatedAt).toLocaleString('en-GB')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {page!.total > LIMIT && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{offset + 1}–{Math.min(offset + LIMIT, page!.total)} of {page!.total.toLocaleString()}</span>
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
  );
}
