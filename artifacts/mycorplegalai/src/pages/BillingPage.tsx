import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Calculator } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BillingPage as SharedBillingPage } from "@workspace/billing-ui";
import { billingRequest } from "@/pages/MatterDetailPage";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function BillingPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) setLocation("/login");
  }, [setLocation]);

  return (
    <AppLayout>
      <div className="flex items-center gap-3 mb-1">
        <Calculator className="h-6 w-6 text-primary" />
        <h1 className="font-serif text-2xl font-bold text-foreground">Billing</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Invoices, receivables and firm billing settings. Log time and generate invoices from each{" "}
        <Link href="/matters" className="text-primary underline">matter's Billing tab</Link>.
      </p>
      <SharedBillingPage
        request={billingRequest}
        accent="#d4a017"
        currency="RM"
        matterLink={(mid) => `${BASE}/matters/${mid}`}
      />
    </AppLayout>
  );
}
