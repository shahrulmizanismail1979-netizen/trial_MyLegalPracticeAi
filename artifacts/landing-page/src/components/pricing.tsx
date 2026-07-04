import { useState } from "react";
import { Check, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CheckoutTier = "bundle" | "single" | "standard";

export function Pricing() {
  const [loadingTier, setLoadingTier] = useState<CheckoutTier | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const startCheckout = async (tier: CheckoutTier) => {
    setCheckoutError(null);
    setLoadingTier(tier);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout. Please try again.");
      }
      window.location.href = data.url;
    } catch (err) {
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
            Equip yourself with the power of AI reference tools. Choose individual apps or secure the complete bundle at an unprecedented value.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          
          {/* Bundle Column - Most Prominent */}
          <Card className="lg:col-span-2 relative overflow-hidden border-primary shadow-[0_0_30px_rgba(212,175,55,0.15)] bg-card lg:order-2">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-sm font-bold uppercase tracking-wider rounded-bl-lg">
              Best Value
            </div>
            <CardHeader className="pb-8 pt-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium mb-4 w-fit">
                <AlertCircle className="h-4 w-4" />
                2nd Kohort Special: Limited to First 100 People
              </div>
              <CardTitle className="font-serif text-4xl mb-2">The Complete Bundle</CardTitle>
              <CardDescription className="text-lg">All 7 AI Portals</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-5xl font-bold text-foreground">$53</span>
                  <span className="text-lg text-muted-foreground">/month</span>
                </div>
                <p className="text-muted-foreground mb-6">Billed monthly · cancel anytime</p>
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-lg h-12"
                  onClick={() => startCheckout("bundle")}
                  disabled={loadingTier !== null}
                >
                  {loadingTier === "bundle" ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> Redirecting…</>
                  ) : (
                    "Get the Bundle"
                  )}
                </Button>
              </div>
              <ul className="space-y-4">
                {[
                  "Access to all 7 AI Portals",
                  "Prudential Takaful life insurance included",
                  "3 free legal-skills courses / year at Commonwealth Law University (clui.life)",
                  "Monthly subscription — cancel anytime",
                  "1 user license",
                  "Free platform updates",
                  "Priority support"
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-foreground/80">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Single App Column */}
          <Card className="bg-card/50 border-border/50 lg:order-1 flex flex-col justify-between">
            <div>
              <CardHeader className="pb-8 pt-10">
                <CardTitle className="font-serif text-3xl mb-2">Single App</CardTitle>
                <CardDescription className="text-lg">Choose 1 AI Portal</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-4xl font-bold text-foreground">$17</span>
                  <span className="text-lg text-muted-foreground">/month</span>
                </div>
                <p className="text-muted-foreground mb-8">Billed monthly (2nd Kohort)</p>
                
                <ul className="space-y-4 mb-8">
                  {[
                    "Access to 1 AI Portal of choice",
                    "Prudential Takaful life insurance included",
                    "1 free legal-skills course / year at Commonwealth Law University (clui.life)",
                    "Monthly subscription — cancel anytime",
                    "1 user license"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </div>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full text-lg h-12"
                onClick={() => startCheckout("single")}
                disabled={loadingTier !== null}
              >
                {loadingTier === "single" ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Redirecting…</>
                ) : (
                  "Select an App"
                )}
              </Button>
            </CardFooter>
          </Card>

        </div>

        {checkoutError && (
          <div className="mt-8 max-w-2xl mx-auto flex items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{checkoutError}</span>
          </div>
        )}

        <div className="mt-12 text-center max-w-2xl mx-auto space-y-4">
          <div className="p-4 rounded-lg bg-secondary/50 border border-border">
            <h4 className="font-bold text-foreground mb-1">Standard Price (101st buyer onwards)</h4>
            <p className="text-muted-foreground">$23 per app / month (1 user) — includes Prudential Takaful life insurance + 1 free legal-skills course / year at Commonwealth Law University (clui.life)</p>
          </div>
          <div className="p-5 rounded-lg bg-primary/5 border border-primary/20 text-left">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-primary mb-1">More than software — a professional membership</h4>
                <p className="text-sm text-muted-foreground">
                  Every plan now includes a <span className="text-foreground font-medium">Prudential Takaful life insurance</span> benefit and{" "}
                  <span className="text-foreground font-medium">free lifelong-learning legal-skills courses</span> at{" "}
                  <a
                    href="https://clui.life"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-medium underline underline-offset-2 hover:text-primary/80"
                  >
                    Commonwealth Law University (clui.life)
                  </a>
                  , a lifelong-learning initiative organized by a start-up under Universiti Kebangsaan Malaysia.
                </p>
              </div>
            </div>
          </div>
          <div className="p-5 rounded-lg bg-primary/5 border border-primary/20 text-left">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-primary mb-1">All prices are for the Starter Package</h4>
                <p className="text-sm text-muted-foreground">
                  Every package above is a <span className="text-foreground font-medium">monthly starter subscription</span> covering
                  the current AI Portals and features — billed each month, cancel anytime. As we roll out more advanced
                  AI features over time, those will be offered on a <span className="text-foreground font-medium">pay-as-you-go basis</span> —
                  charged according to actual usage, so you only pay for what you use.
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground italic">
            Note: 1st Kohort prices of $14 and $21 are completely SOLD OUT. Secure the 2nd Kohort pricing before it's gone.
          </p>
        </div>
      </div>
    </section>
  );
}