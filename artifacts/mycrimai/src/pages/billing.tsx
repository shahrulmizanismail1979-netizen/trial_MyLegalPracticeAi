import { Link } from "wouter";
import { Calculator } from "lucide-react";
import { BillingPage as SharedBillingPage, type BillingRequest } from "@workspace/billing-ui";

const request: BillingRequest = (path, init) =>
  fetch(`/api/crim/matters${path}`, { credentials: "include", ...init });

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export function BillingPage() {
  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
          <Calculator className="h-8 w-8 text-primary" />
          Billing
        </h1>
        <p className="text-muted-foreground">
          Invoices, receivables and firm billing settings. Log time and generate invoices from each{" "}
          <Link href="/workspace/matters" className="text-primary underline">
            matter's Billing tab
          </Link>
          .
        </p>
      </div>
      <SharedBillingPage
        request={request}
        accent="#d4a017"
        currency="RM"
        matterLink={(id) => `${base}/workspace/matters/${id}`}
      />
    </div>
  );
}
