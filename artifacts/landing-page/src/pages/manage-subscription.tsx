import { useState, type FormEvent } from "react";
import { ArrowLeft, CreditCard, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PortalAction = "manage" | "cancel";

const FALLBACK_ERROR =
  "We couldn't verify those subscription details. Check your access code and billing email, or contact support if your plan was arranged manually.";

export default function ManageSubscriptionPage() {
  const [accessCode, setAccessCode] = useState("");
  const [email, setEmail] = useState("");
  const [pendingAction, setPendingAction] = useState<PortalAction | null>(null);
  const [error, setError] = useState("");

  const openPortal = async (action: PortalAction) => {
    setPendingAction(action);
    setError("");

    try {
      const response = await fetch("/api/stripe/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode, email, action }),
      });
      const data = (await response.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || FALLBACK_ERROR);
      }

      const portalUrl = new URL(data.url);
      if (portalUrl.protocol !== "https:") {
        throw new Error("The secure billing portal could not be opened.");
      }
      window.location.assign(portalUrl.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : FALLBACK_ERROR);
      setPendingAction(null);
    }
  };

  const submitManage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void openPortal("manage");
  };

  const isPending = pendingAction !== null;

  return (
    <main className="min-h-[100dvh] bg-background px-5 py-10 text-foreground sm:px-8">
      <div className="mx-auto max-w-xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to LAWyes
        </Link>

        <section className="rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-9">
          <img
            src={`${import.meta.env.BASE_URL}lawyes-logo.png`}
            alt="LAWyes"
            className="mb-6 h-16 w-auto"
          />

          <div className="mb-7">
            <h1 className="font-serif text-3xl font-bold sm:text-4xl">
              Cancel or manage your subscription
            </h1>
            <p className="mt-3 text-muted-foreground">
              Enter the access code and billing email from your LAWyes subscription. You will
              continue securely in Stripe to manage payment details, view invoices, cancel a free
              trial, or unsubscribe.
            </p>
          </div>

          <form onSubmit={submitManage} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="access-code">Subscriber access code</Label>
              <Input
                id="access-code"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value.toUpperCase())}
                placeholder="MLPA-XXXXX-XXXXX"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={64}
                required
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing-email">Billing email</Label>
              <Input
                id="billing-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                maxLength={320}
                required
                disabled={isPending}
              />
            </div>

            {error && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-3 pt-2">
              <Button type="submit" size="lg" disabled={isPending} className="w-full gap-2">
                {pendingAction === "manage" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                Manage billing and invoices
                <ExternalLink className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                size="lg"
                variant="outline"
                disabled={isPending}
                onClick={() => void openPortal("cancel")}
                className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                {pendingAction === "cancel" && <Loader2 className="h-4 w-4 animate-spin" />}
                Cancel free trial / unsubscribe
              </Button>
            </div>
          </form>

          <div className="mt-6 flex items-start gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              LAWyes does not collect your card details here. Billing changes and cancellation
              are completed on Stripe's secure customer portal.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}