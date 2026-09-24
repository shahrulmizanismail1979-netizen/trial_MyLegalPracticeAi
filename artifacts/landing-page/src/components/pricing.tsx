import { canonicalPortalRedirect } from "@workspace/entitlements";
import { useRef, useState } from "react";
import { Check, AlertCircle, Sparkles, Loader2, Clock, Zap, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/lib/currency";
import { CurrencySelector, BilledInUsdNote } from "@/components/currency-selector";
import { getCatalogUsdAmount, useStripeCatalogPrices } from "@/lib/stripe-catalog-prices";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trackEvent } from "@/lib/analytics";
import { createCheckoutIntentId } from "@/lib/checkout-intent";

type CheckoutTier = "bundle" | "single" | "standard";
type LoadingKey = CheckoutTier | "trial";

// Portals a Single App / Free Trial customer can pick. The URL is passed to
// checkout so the chosen portal is assigned automatically after payment.
const PORTAL_CHOICES: Array<{ name: string; url: string }> = [
  { name: "MyLitAI — Litigation", url: "https://mylitai.life" },
  { name: "MySyalitAI — Syariah Litigation", url: "https://mysyalitai.life" },
  { name: "MyCorpAI — Corporate Secretary", url: "https://mycorpai.life" },
  { name: "MyConveyAI — Conveyancing", url: "https://myconveyai.life" },
  { name: "MyCrimAI — Criminal Law", url: "/mycrimai/" },
  { name: "MyCCBLitAI — Construction Law", url: "https://myccblitai.life/" },
  { name: "MyAccidentAI — Accident Claims", url: "https://myaccidentai.life/" },
];

function PortalPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  return (
    <div className="mb-4">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full" aria-label="Choose your AI Portal">
          <SelectValue placeholder="Choose your AI Portal" />
        </SelectTrigger>
        <SelectContent>
          {PORTAL_CHOICES.map((p) => (
            <SelectItem key={p.url} value={p.url}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function Pricing() {
  const [loadingTier, setLoadingTier] = useState<LoadingKey | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [trialPortal, setTrialPortal] = useState<string>("");
  const [singlePortal, setSinglePortal] = useState<string>("");
  // Keep one intent per concrete selection. A network failure can therefore
  // be retried without creating a second Stripe Checkout Session, while
  // another tier, trial choice, or portal remains an intentional purchase.
  const checkoutIntents = useRef(new Map<string, string>());
  const { format } = useCurrency();
  const { prices, isLoading: isPricesLoading } = useStripeCatalogPrices();
  const singlePrice = getCatalogUsdAmount(prices, "single");
  const bundlePrice = getCatalogUsdAmount(prices, "bundle");
  const priceUnavailable = (amount: number | null) => (isPricesLoading ? "Loading price…" : amount == null ? "Price unavailable" : null);
  const singlePriceState = priceUnavailable(singlePrice);
  const bundlePriceState = priceUnavailable(bundlePrice);

  const startCheckout = async (tier: CheckoutTier, trial = false, appUrl?: string) => {
    setCheckoutError(null);
    setLoadingTier(trial ? "trial" : tier);
    const selectionKey = JSON.stringify([tier, trial, appUrl ?? null]);
    let checkoutIntentId = checkoutIntents.current.get(selectionKey);
    if (!checkoutIntentId) {
      checkoutIntentId = createCheckoutIntentId();
      checkoutIntents.current.set(selectionKey, checkoutIntentId);
    }
    let httpStatus = 0;
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          ...(trial ? { trial: true } : {}),
          ...(appUrl ? { appUrl: canonicalPortalRedirect(appUrl) } : {}),
          checkoutIntentId,
        }),
      });
      httpStatus = res.status;
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        code?: string;
      };
      if (!res.ok || !data.url) {
        if (data.code === "checkout_intent_expired") {
          checkoutIntents.current.delete(selectionKey);
        }
        throw new Error(data.error || "Could not start checkout. Please try again.");
      }
      trackEvent("checkout_started", {
        tier,
        is_trial: trial,
        portal_selected: Boolean(appUrl),
        surface: "pricing",
      });
      window.location.href = data.url;
    } catch (err) {
      trackEvent("checkout_start_failed", {
        tier,
        is_trial: trial,
        portal_selected: Boolean(appUrl),
        surface: "pricing",
        error_category: httpStatus > 0 ? "api" : "network",
        http_status: httpStatus,
      });
      setCheckoutError(
        err instanceof Error ? err.message : "Could not start checkout. Please try again.",
      );
      setLoadingTier(null);
    }
  };

  return (
    <section id="pricing" className="py-24 px-6 lg:px-8 relative">
      <div className="absolute inset-0 bg-secondary/30 -skew-y-2 origin-top-left -z-10" />

      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-serif font-bold mb-6">
            Transparent, <span className="text-primary">Value-Driven</span> Pricing
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Start free. Upgrade when you are ready. Every tier is designed to deliver real value
            for Malaysian legal professionals.
          </p>
          <div className="mt-6 flex justify-center">
            <CurrencySelector />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">

          {/* Free Trial */}
          <Card className="bg-card/50 border-border/50 flex flex-col justify-between">
            <div>
              <CardHeader className="pb-6 pt-8">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-5 w-5 text-emerald-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-400/30 bg-emerald-400/10">
                    7 days free
                  </span>
                </div>
                <CardTitle className="font-serif text-3xl mb-2">Free Trial</CardTitle>
                <CardDescription className="text-lg">Explore before you commit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-4xl font-bold text-foreground">{format(0)}</span>
                  <span className="text-lg text-muted-foreground">/ 7 days</span>
                </div>
                 <p className="text-muted-foreground mb-1">
                   {singlePriceState
                     ? singlePriceState
                     : <>Then {format(singlePrice!)}/month unless cancelled</>}
                 </p>
                <BilledInUsdNote />

                <ul className="space-y-3 mb-6 mt-5">
                  {[
                    "Instant access — code emailed the moment you sign up",
                    "7-day full access to 1 AI Portal",
                    "Card required — not charged during trial",
                     singlePriceState
                       ? `${singlePriceState} after 7 days unless you cancel`
                       : `Auto-bills ${format(singlePrice!)}/mo after 7 days unless you cancel`,
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-foreground/80 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </div>
            <CardFooter className="flex-col items-stretch">
              <PortalPicker value={trialPortal} onChange={setTrialPortal} />
              <Button
                variant="outline"
                className="w-full text-lg h-12 border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-400"
                onClick={() => startCheckout("single", true, trialPortal)}
                 disabled={loadingTier !== null || !trialPortal || singlePrice == null || isPricesLoading}
              >
                {loadingTier === "trial" ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Redirecting…</>
                ) : trialPortal ? (
                  "Start Free Trial"
                ) : (
                  "Choose a portal to start"
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Single App */}
          <Card className="bg-card/50 border-border/50 flex flex-col justify-between">
            <div>
              <CardHeader className="pb-6 pt-8">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-5 w-5 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10">
                    Most Popular
                  </span>
                </div>
                <CardTitle className="font-serif text-3xl mb-2">Single App</CardTitle>
                <CardDescription className="text-lg">1 AI Portal, unlimited use</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2 mb-1">
                   <span
                     className="text-4xl font-bold text-foreground"
                     data-testid="subscription-price-single"
                     data-tier="single"
                   >
                     {singlePriceState ?? format(singlePrice!)}
                   </span>
                   {singlePrice != null && <span className="text-lg text-muted-foreground">/month</span>}
                </div>
                <p className="text-muted-foreground mb-1">Billed monthly · cancel anytime</p>
                <BilledInUsdNote />
                <div className="mb-5" />

                <ul className="space-y-3 mb-6">
                  {[
                    "Unlimited access to 1 AI Portal",
                    "All features & updates",
                    "1 user license",
                    "Email support",
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-foreground/80 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </div>
            <CardFooter className="flex-col items-stretch">
              <PortalPicker value={singlePortal} onChange={setSinglePortal} />
              <Button
                variant="outline"
                className="w-full text-lg h-12"
                onClick={() => startCheckout("single", false, singlePortal)}
                 disabled={loadingTier !== null || !singlePortal || singlePrice == null || isPricesLoading}
              >
                {loadingTier === "single" ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Redirecting…</>
                ) : singlePortal ? (
                  "Subscribe — Single"
                ) : (
                  "Choose a portal to subscribe"
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Complete Bundle */}
          <Card className="relative overflow-hidden border-primary shadow-[0_0_30px_rgba(99,149,224,0.12)] bg-card">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-sm font-bold uppercase tracking-wider rounded-bl-lg">
              Best Value
            </div>
            <CardHeader className="pb-6 pt-10">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="h-5 w-5 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10">
                  Best Value
                </span>
              </div>
              <CardTitle className="font-serif text-3xl mb-2">Complete Bundle</CardTitle>
              <CardDescription className="text-lg">All 9 AI Portals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 mb-1">
                 <span
                   className="text-5xl font-bold text-foreground"
                   data-testid="subscription-price-bundle"
                   data-tier="bundle"
                 >
                   {bundlePriceState ?? format(bundlePrice!)}
                 </span>
                 {bundlePrice != null && <span className="text-lg text-muted-foreground">/month</span>}
              </div>
              <p className="text-muted-foreground mb-1">Billed monthly · cancel anytime</p>
              <BilledInUsdNote />
               {singlePrice != null && bundlePrice != null && (
                 <p className="text-sm text-muted-foreground mb-6 mt-2">
                   <span className="line-through opacity-60">{format(singlePrice * 7)}</span> if bought individually — you save{" "}
                   {format(singlePrice * 7 - bundlePrice)}
                 </p>
               )}

              <ul className="space-y-3 mb-6">
                {[
                  "Unlimited access to all 9 AI Portals",
                  "All features & updates",
                  "1 user license",
                  "Priority support",
                  "Early access to new portals",
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-foreground/80 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-lg h-12"
                onClick={() => startCheckout("bundle")}
                 disabled={loadingTier !== null || bundlePrice == null || isPricesLoading}
              >
                {loadingTier === "bundle" ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Redirecting…</>
                ) : (
                  "Subscribe — Bundle"
                )}
              </Button>
            </CardFooter>
          </Card>

        </div>

        {checkoutError && (
          <div role="alert" className="mt-8 max-w-2xl mx-auto flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{checkoutError}</span>
          </div>
        )}

        <div className="mt-12 text-center max-w-2xl mx-auto">
          <div className="p-5 rounded-lg bg-primary/5 border border-primary/20 text-left">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-primary mb-1">Fair & flexible pricing</h4>
                <p className="text-sm text-muted-foreground">
                  Every plan is a <span className="text-foreground font-medium">monthly subscription</span> — billed each month, cancel anytime. Need a different arrangement? 
                  <a href="mailto:support@mylitai.life" className="text-primary underline underline-offset-2">Contact us</a> for firm, corporate, or academic licensing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
