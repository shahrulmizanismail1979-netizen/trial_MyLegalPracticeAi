import { useCallback, useEffect, useState } from "react";
import { auditApi, type AuditPage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { RefreshCw, ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function AuditLogPage() {
  const { toast } = useToast();
  const [page, setPage] = useState<AuditPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const load = useCallback(() => {
    setLoading(true);
    auditApi
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
          <h1 className="text-2xl font-bold">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Complete record of all research platform actions
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {page?.total === 0 && !loading && (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <ScrollText size={36} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium text-foreground">No audit events yet</p>
          <p className="text-sm text-muted-foreground mt-1">Events will appear here as platform actions are performed.</p>
        </div>
      )}

      {(page?.events ?? []).length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {page!.total.toLocaleString()} events total
          </p>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-muted-foreground text-left">
                    <th className="px-4 py-3 font-medium">Timestamp</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                    <th className="px-4 py-3 font-medium">Entity</th>
                    <th className="px-4 py-3 font-medium">Actor</th>
                    <th className="px-4 py-3 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {page!.events.map((ev) => (
                    <tr key={ev.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                        {new Date(ev.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-medium">{ev.action}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {ev.entityType ? `${ev.entityType}${ev.entityId ? ` #${ev.entityId}` : ""}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[160px]">
                        {ev.actor || "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[220px]" title={JSON.stringify(ev.detail)}>
                        {ev.detail ? JSON.stringify(ev.detail).slice(0, 80) : "—"}
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
