import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface PortalAccessReport {
  sampleLimit: number;
  sampled: number;
  unknownIntent: number;
  gaps: Array<{ subscriberId: number; portal: string }>;
}

export function PortalAccessResults({ report, loading, error }: {
  report: PortalAccessReport | null; loading: boolean; error: string | null;
}) {
  return <div aria-live="polite">
    {loading && <p role="status">Checking portal access…</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {report && <>
      <p>Checked {report.sampled} subscribers · {report.gaps.length} portal issues · {report.unknownIntent} with unknown portal intent.</p>
      {report.gaps.length > 0
        ? <ul className="list-disc pl-5">{report.gaps.map(gap =>
          <li key={`${gap.subscriberId}-${gap.portal}`}>Subscriber #{gap.subscriberId}: {gap.portal} — missing, inactive or expired access.</li>)}</ul>
        : <p>No missing portal access detected in this sample.</p>}
      {report.unknownIntent > 0 && <p>Unknown intent requires manual review; access was not guessed.</p>}
    </>}
  </div>;
}

export function PortalAccessCheck() {
  const [report, setReport] = useState<PortalAccessReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function check() {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const response = await fetch("/api/admin/subscribers/portal-access-check", { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Portal access check failed (HTTP ${response.status}). Please retry or contact support.`);
      setReport(await response.json());
    } catch (error) {
      setError(error instanceof Error ? error.message : "Portal access check failed. Please retry.");
    } finally {
      setLoading(false);
    }
  }
  return <section className="rounded-md border border-border bg-card p-4 space-y-3" aria-label="Portal access diagnostic">
    <h2 className="font-semibold">Portal access diagnostic</h2>
    <p className="text-sm text-muted-foreground">Read-only latest-25 sample of confirmed, unexpired subscribers (newest subscriber IDs first). Not a full audit; independent of list filters. Runs only when requested and makes no access changes.</p>
    <Button variant="outline" disabled={loading} onClick={check}>{loading ? "Checking…" : "Check portal access"}</Button>
    <PortalAccessResults report={report} loading={loading} error={error} />
  </section>;
}