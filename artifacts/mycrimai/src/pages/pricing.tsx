import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Check, Scale, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import {
  PURCHASABLE_TIERS,
  TIER_DEFINITIONS,
  CURRENCIES,
  DEFAULT_CURRENCY,
  formatPrice,
  type BillingInterval,
  type CurrencyCode,
  type PurchasableTier,
} from "@workspace/entitlements";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [currency, setCurrency] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [pendingTier, setPendingTier] = useState<PurchasableTier | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleCheckout = async (tier: PurchasableTier) => {
    setPendingTier(tier);
    try {
      // Purchases are handled centrally on the AI Web Books landing page.
      window.location.href = "/#pricing";
      return;
    } catch {
      toast({
        title: "Checkout failed",
        description: "Something went wrong starting checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPendingTier(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            <span className="font-serif text-xl font-bold">
              Mycrim<span className="text-primary">Ai</span>
            </span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-10 text-center">
          <h1 className="font-serif text-4xl font-bold tracking-tight">
            Choose your plan
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            AI-powered Malaysian criminal law practice — from core research to
            realistic voice oral-practice with the judge, witness and opposing
            counsel.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <div className="inline-flex rounded-lg border border-border bg-card/50 p-1">
              <button
                type="button"
                onClick={() => setInterval("month")}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  interval === "month"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="button-interval-month"
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setInterval("year")}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  interval === "year"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid="button-interval-year"
              >
                Annual <span className="text-xs opacity-80">(2 months free)</span>
              </button>
            </div>

            <Select
              value={currency}
              onValueChange={(v) => setCurrency(v as CurrencyCode)}
            >
              <SelectTrigger className="w-[130px]" data-testid="select-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.symbol} {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {PURCHASABLE_TIERS.map((tierId) => {
            const def = TIER_DEFINITIONS[tierId];
            const price = formatPrice(tierId, interval, currency);
            return (
              <Card
                key={tierId}
                className={`relative flex flex-col ${
                  def.popular ? "border-primary shadow-lg shadow-primary/10" : "border-border/50"
                }`}
                data-testid={`card-tier-${tierId}`}
              >
                {def.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Sparkles className="mr-1 h-3 w-3" /> Most popular
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="font-serif text-xl">{def.name}</CardTitle>
                  <CardDescription>{def.tagline}</CardDescription>
                  <div className="pt-2">
                    <span className="text-3xl font-bold">{price}</span>
                    <span className="text-sm text-muted-foreground">
                      /{interval === "year" ? "year" : "month"}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <ul className="mb-6 flex-1 space-y-2 text-sm">
                    {def.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="text-muted-foreground">{h}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={def.popular ? "default" : "outline"}
                    onClick={() => handleCheckout(tierId)}
                    disabled={pendingTier !== null}
                    data-testid={`button-subscribe-${tierId}`}
                  >
                    {pendingTier === tierId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      `Get ${def.name}`
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Button asChild variant="ghost" size="sm" onClick={() => setLocation("/")}>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
