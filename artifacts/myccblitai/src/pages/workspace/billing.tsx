import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Calculator } from "lucide-react";
import WorkspaceLayout from "./layout";
import { BillingPage as SharedBillingPage, type BillingRequest } from "@workspace/billing-ui";
import { isAuthenticated, authHeaders } from "@/lib/auth";

const billingRequest: BillingRequest = (path, init) =>
  fetch(`/api/ccb/matters${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...authHeaders() },
  });

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function BillingPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/access");
    }
  }, [setLocation]);

  return (
    <WorkspaceLayout>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-serif font-bold tracking-tight text-foreground">Time &amp; Billing</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Invoices, receivables and firm billing settings. Log time and generate invoices from each{" "}
            <Link href="/workspace/matters" className="text-primary underline">matter&apos;s Billing tab</Link>.
          </p>
        </div>
        <SharedBillingPage
          request={billingRequest}
          accent="#d99e1f"
          currency="RM"
          matterLink={(id) => `${base}/workspace/matters/${id}`}
        />
      </div>
    </WorkspaceLayout>
  );
}
