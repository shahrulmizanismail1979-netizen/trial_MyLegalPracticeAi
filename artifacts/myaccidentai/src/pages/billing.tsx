import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Calculator, ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccidentCheckSession } from "@workspace/api-client-react";
import { BillingPage as SharedBillingPage, type BillingRequest } from "@workspace/billing-ui";

const request: BillingRequest = (path, init) =>
  fetch(`/api/accident/matters${path}`, { credentials: "include", ...init });

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function BillingPage() {
  const [, setLocation] = useLocation();
  const { data: session, isLoading } = useAccidentCheckSession();

  useEffect(() => {
    if (!isLoading && (!session || !session.authenticated)) {
      setLocation("/login");
    }
  }, [session, isLoading, setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/workspace/matters">
              <Button variant="ghost" size="icon" data-testid="link-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 min-w-0">
              <Calculator className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-lg font-serif font-bold truncate">Billing</h1>
                <p className="text-xs text-muted-foreground truncate">
                  Invoices, receivables and firm billing settings
                </p>
              </div>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2">
              <Home className="h-4 w-4" /> Home
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        <p className="text-sm text-muted-foreground mb-6">
          Aging summary, all invoices and firm billing settings. Log time and generate invoices from each{" "}
          <Link href="/workspace/matters" className="text-primary underline">
            matter's Billing tab
          </Link>
          .
        </p>
        <SharedBillingPage
          request={request}
          accent="#f59e0b"
          currency="RM"
          matterLink={(id) => `${base}/workspace/matters/${id}`}
        />
      </main>
    </div>
  );
}
