import { Link, useLocation } from "wouter";
import { Scale, Check, X, ArrowLeft, Sparkles } from "lucide-react";
import { PLANS } from "@workspace/tiers";

export default function PricingPage() {
  const [location] = useLocation();
  const plans = PLANS;
  const error: string | null = null;

  const canceled = location.includes("canceled") || window.location.search.includes("canceled");

  // Purchases are handled centrally on the AI Web Books landing page.
  const handleSubscribe = (_tier: string) => {
    window.location.href = "/#pricing";
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[500px] purple-glow pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-[300px] purple-glow-bottom pointer-events-none" />

      <header className="relative z-10 border-b border-purple-500/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Scale className="w-6 h-6 text-primary" />
            <span className="font-serif text-lg font-bold text-primary">MYCorpLegalAI</span>
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Have a code? Sign in
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="font-serif text-4xl font-bold text-foreground mb-3">Choose your plan</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Subscribe to unlock the AI-powered Malaysian corporate legal suite. After payment you'll
            receive a unique access code to sign in. Cancel anytime.
          </p>
        </div>

        {canceled && (
          <div className="max-w-2xl mx-auto mb-8 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 text-sm text-yellow-300 text-center">
            Checkout was canceled. You can pick a plan whenever you're ready.
          </div>
        )}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.tier}
                className={`relative flex flex-col bg-card rounded-2xl p-6 ${
                  plan.highlighted
                    ? "border-2 border-primary shadow-[0_0_40px_-10px_rgba(120,80,200,0.4)]"
                    : "border border-purple-500/15"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[11px] font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Most Popular
                  </div>
                )}
                <h2 className="font-serif text-xl font-bold text-foreground">{plan.name}</h2>
                <p className="text-xs text-muted-foreground mt-1 min-h-[32px]">{plan.tagline}</p>
                <div className="mt-4 mb-5">
                  <span className="text-4xl font-bold text-foreground">{plan.priceDisplay}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>

                <button
                  onClick={() => handleSubscribe(plan.tier)}
                  className={`w-full py-3 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                    plan.highlighted
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : "bg-purple-500/10 border border-purple-500/30 text-primary hover:bg-purple-500/20"
                  }`}
                >
                  {`Subscribe to ${plan.name}`}
                </button>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      {f.included ? (
                        <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                      )}
                      <span className={f.included ? "text-foreground" : "text-muted-foreground/50"}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>

        <div className="text-center mt-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
