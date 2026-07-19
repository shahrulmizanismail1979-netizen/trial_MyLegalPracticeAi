import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Crown,
  Loader2,
  Sparkles,
  Wallet,
  CreditCard,
  Globe,
  Smartphone,
  Gift,
} from "lucide-react";
import {
  AuroraBackground,
  CinematicShell,
  FlickerBadge,
  GoldButton,
  GhostButton,
  MetallicDivider,
  PageHeader,
  SpotlightCard,
} from "@/components/cinematic";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { LicenseReveal } from "@/components/license-reveal";

type Plan = {
  productId: string;
  name: string;
  description: string | null;
  tier: string | null;
  features: string[];
  priceId: string;
  baseCurrency: string;
  baseUnitAmount: number;
  prices: Record<string, number>;
  interval: string;
  trialDays?: number;
};

type CurrencyInfo = { code: string; label: string; symbol: string };

type BillingMe = {
  tier: string;
  status: string | null;
  subscription: {
    id?: string;
    status?: string;
    current_period_end?: number;
    cancel_at_period_end?: boolean;
  } | null;
};

const baseUrl = "/api/acad";

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function formatPrice(amountSmallestUnit: number, symbol: string) {
  return `${symbol}${(amountSmallestUnit / 100).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

const FREE_FEATURES = [
  "Both pathways: Virtual Exam Hall + Assessment Studio",
  "Up to 25 attempts per month",
  "AI proctoring + AI marking",
  "Single examiner / educator seat",
  "Community support",
];

const PAYMENT_METHODS: Array<{
  icon: typeof Wallet;
  label: string;
  hint: string;
}> = [
  { icon: CreditCard, label: "Cards", hint: "Visa, Mastercard, Amex worldwide" },
  { icon: Smartphone, label: "FPX & GrabPay", hint: "Local Malaysian payments" },
  { icon: Globe, label: "6 currencies", hint: "MYR · USD · SGD · EUR · GBP · AUD" },
  { icon: Wallet, label: "Promotion codes", hint: "Got a code? Apply it at checkout" },
];

const CURRENCY_STORAGE_KEY = "assesshub.billing.currency";
const INTERVAL_STORAGE_KEY = "assesshub.billing.interval";

const TIER_ORDER: Record<string, number> = {
  free: 0,
  pro: 1,
  premium: 2,
  school: 3,
};

export default function Billing() {
  const [location, setLocation] = useLocation();
  const { user, loading, refresh: refreshAuth } = useAuth();
  const { toast } = useToast();

  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyInfo[]>([]);
  const [billing, setBilling] = useState<BillingMe | null>(null);
  const [pendingPriceId, setPendingPriceId] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>(() => {
    try {
      return localStorage.getItem(CURRENCY_STORAGE_KEY) || "myr";
    } catch {
      return "myr";
    }
  });
  const [interval, setInterval] = useState<"month" | "year">(() => {
    try {
      const stored = localStorage.getItem(INTERVAL_STORAGE_KEY);
      return stored === "year" ? "year" : "month";
    } catch {
      return "month";
    }
  });

  const [licensePassword, setLicensePassword] = useState<string | null>(null);

  const { status, sessionId } = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return { status: q.get("status"), sessionId: q.get("session_id") };
  }, [location]);

  useEffect(() => {
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, selectedCurrency);
    } catch {
      /* ignore */
    }
  }, [selectedCurrency]);

  useEffect(() => {
    try {
      localStorage.setItem(INTERVAL_STORAGE_KEY, interval);
    } catch {
      /* ignore */
    }
  }, [interval]);

  useEffect(() => {
    jsonFetch<{ plans: Plan[]; currencies: CurrencyInfo[] }>("/billing/plans")
      .then((d) => {
        setPlans(d.plans);
        setCurrencies(d.currencies ?? []);
      })
      .catch((err) => {
        toast({
          title: "Couldn't load plans",
          description: err.message,
          variant: "destructive",
        });
        setPlans([]);
      });
  }, [toast]);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      if (status === "success") {
        try {
          await jsonFetch("/billing/refresh", { method: "POST" });
        } catch {
          /* webhooks may not have arrived yet */
        }
      }
      try {
        const me = await jsonFetch<BillingMe>("/billing/me");
        setBilling(me);
        if (status === "success" && me.tier !== "free") {
          toast({
            title: "Subscription active",
            description: `You're on the ${me.tier} plan. Welcome aboard.`,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast({
          title: "Couldn't load your subscription",
          description: msg,
          variant: "destructive",
        });
      }
    };
    init();
  }, [user, status, toast]);

  useEffect(() => {
    if (status !== "success" || !sessionId || !user) return;
    let cancelled = false;
    const claim = async () => {
      try {
        const res = await jsonFetch<{ password: string; email: string }>(
          "/billing/claim-license",
          { method: "POST", body: JSON.stringify({ sessionId }) },
        );
        if (cancelled) return;
        setLicensePassword(res.password);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("already claimed")) {
          toast({
            title: "Couldn't issue your license",
            description: msg,
            variant: "destructive",
          });
        }
      }
    };
    claim();
    return () => {
      cancelled = true;
    };
  }, [status, sessionId, user, toast]);

  const startCheckout = async (priceId: string) => {
    if (!user) {
      setLocation(`/examiner?redirect=${encodeURIComponent("/billing")}`);
      return;
    }
    setPendingPriceId(priceId);
    try {
      const { url } = await jsonFetch<{ url: string }>(
        "/billing/checkout",
        {
          method: "POST",
          body: JSON.stringify({
            priceId,
            currency: selectedCurrency,
            successPath: "/billing?status=success",
            cancelPath: "/billing?status=cancelled",
          }),
        },
      );
      window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Checkout failed", description: msg, variant: "destructive" });
      setPendingPriceId(null);
    }
  };

  const openPortal = async () => {
    setOpeningPortal(true);
    try {
      const { url } = await jsonFetch<{ url: string }>("/billing/portal", {
        method: "POST",
        body: JSON.stringify({ returnPath: "/billing" }),
      });
      window.location.href = url;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Couldn't open billing portal",
        description: msg,
        variant: "destructive",
      });
      setOpeningPortal(false);
    }
  };

  const currentTier = billing?.tier ?? "free";
  const currentCurrencyInfo =
    currencies.find((c) => c.code === selectedCurrency) ?? {
      code: "myr",
      label: "Malaysian Ringgit",
      symbol: "RM",
    };

  // Group plans by tier so we can pick the monthly or yearly variant.
  const plansByTier = useMemo(() => {
    const map: Record<string, { month?: Plan; year?: Plan }> = {};
    (plans ?? []).forEach((p) => {
      const t = p.tier ?? "pro";
      map[t] ??= {};
      if (p.interval === "year") map[t]!.year = p;
      else map[t]!.month = p;
    });
    return map;
  }, [plans]);

  type Card = {
    key: string;
    tier: string;
    name: string;
    priceLabel: string;
    priceSubLabel: string | null;
    savingsLabel: string | null;
    trialLabel: string | null;
    blurb: string;
    features: string[];
    cta: {
      label: string;
      action: () => void;
      disabled?: boolean;
      loading?: boolean;
    } | null;
    highlight?: boolean;
    accent?: "amber" | "violet";
  };

  const symbol = currentCurrencyInfo.symbol;

  const buildPaidCard = (
    tier: "pro" | "premium" | "school",
    name: string,
  ): Card | null => {
    const bucket = plansByTier[tier];
    if (!bucket) return null;
    const selected = interval === "year" ? bucket.year ?? bucket.month : bucket.month;
    if (!selected) return null;
    const monthly = bucket.month;
    const yearly = bucket.year;

    const amount =
      selected.prices[selectedCurrency] ??
      selected.prices[selected.baseCurrency] ??
      selected.baseUnitAmount;

    // Effective monthly equivalent (annual / 12) for headline.
    const monthlyEquivalent =
      selected.interval === "year" ? Math.round(amount / 12) : amount;

    const priceLabel = `${formatPrice(monthlyEquivalent, symbol)}`;
    const priceSubLabel =
      selected.interval === "year"
        ? `per month, billed annually (${formatPrice(amount, symbol)}/yr)`
        : `per month`;

    let savingsLabel: string | null = null;
    if (interval === "year" && monthly && yearly) {
      const yearOfMonthly =
        (monthly.prices[selectedCurrency] ?? monthly.baseUnitAmount) * 12;
      const yearAnnual =
        yearly.prices[selectedCurrency] ?? yearly.baseUnitAmount;
      const saved = yearOfMonthly - yearAnnual;
      if (saved > 0) {
        savingsLabel = `Save ${formatPrice(saved, symbol)}/yr vs monthly`;
      }
    }

    const trialLabel =
      selected.trialDays && selected.trialDays > 0 && interval === "month"
        ? `${selected.trialDays}-day free trial`
        : null;

    const ctaPriceFragment =
      selected.interval === "year"
        ? `${formatPrice(amount, symbol)}/yr`
        : `${formatPrice(amount, symbol)}/mo`;

    return {
      key: selected.priceId,
      tier,
      name,
      priceLabel,
      priceSubLabel,
      savingsLabel,
      trialLabel,
      blurb: selected.description ?? "",
      features: selected.features,
      highlight: tier === "pro",
      accent: tier === "school" ? "violet" : "amber",
      cta:
        currentTier === tier
          ? {
              label: "Manage subscription",
              action: openPortal,
              loading: openingPortal,
            }
          : {
              label:
                pendingPriceId === selected.priceId
                  ? "Redirecting…"
                  : trialLabel
                    ? `Start ${selected.trialDays}-day free trial`
                    : `Subscribe — ${ctaPriceFragment}`,
              action: () => startCheckout(selected.priceId),
              loading: pendingPriceId === selected.priceId,
            },
    };
  };

  const cards: Card[] = [
    {
      key: "free",
      tier: "free",
      name: "Free",
      priceLabel: `${symbol}0`,
      priceSubLabel: "forever",
      savingsLabel: null,
      trialLabel: null,
      blurb: "Try the full theatre. Both pathways, generous monthly cap.",
      features: FREE_FEATURES,
      accent: "amber",
      cta:
        currentTier === "free"
          ? { label: "You're on Free", action: () => {}, disabled: true }
          : null,
    },
    buildPaidCard("pro", "Pro"),
    buildPaidCard("premium", "Premium"),
    buildPaidCard("school", "School"),
  ].filter(Boolean) as Card[];

  // Stable display order by tier.
  cards.sort(
    (a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99),
  );

  return (
    <CinematicShell>
      <section className="relative overflow-hidden">
        <AuroraBackground />
        <div className="container mx-auto px-6 py-16 relative z-10">
          <Link href="/">
            <a className="inline-flex items-center gap-2 text-white/60 hover:text-amber-300 text-sm mb-8">
              <ArrowLeft className="w-4 h-4" /> Back to landing
            </a>
          </Link>

          <div className="mb-4">
            <FlickerBadge>Subscriptions</FlickerBadge>
          </div>
          <PageHeader
            title="One subscription. Both pathways unlocked."
            description="Virtual Exam Hall and Assessment Studio share a single MyLawAcad plan. Switch between monthly and annual at any time — cancel from the customer portal."
            right={
              currencies.length > 0 ? (
                <div className="flex items-center gap-2 bg-black/40 border border-white/15 rounded-xl px-3 py-2">
                  <Globe className="w-4 h-4 text-amber-300" />
                  <label
                    htmlFor="currency-picker"
                    className="text-[0.65rem] uppercase tracking-widest text-white/60"
                  >
                    Currency
                  </label>
                  <select
                    id="currency-picker"
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    data-testid="currency-picker"
                    className="bg-transparent text-white text-sm font-bold focus:outline-none cursor-pointer"
                  >
                    {currencies.map((c) => (
                      <option
                        key={c.code}
                        value={c.code}
                        className="bg-black text-white"
                      >
                        {c.code.toUpperCase()} — {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null
            }
          />

          {/* Monthly / Annual toggle */}
          <div className="flex items-center justify-center mt-8 mb-12">
            <div className="inline-flex items-center gap-1 p-1 rounded-full border border-white/15 bg-black/40">
              <button
                onClick={() => setInterval("month")}
                data-testid="interval-month"
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  interval === "month"
                    ? "bg-amber-400 text-black shadow-lg"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setInterval("year")}
                data-testid="interval-year"
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  interval === "year"
                    ? "bg-amber-400 text-black shadow-lg"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Annual
                <span
                  className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    interval === "year"
                      ? "bg-black/20 text-black"
                      : "bg-emerald-400/15 text-emerald-300 border border-emerald-400/30"
                  }`}
                >
                  Save 17%
                </span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-amber-400/70" />
            </div>
          ) : (
            <>
              {billing && currentTier !== "free" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-10 inline-flex items-center gap-3 px-5 py-3 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-200"
                >
                  <Crown className="w-4 h-4" />
                  <span className="text-sm uppercase tracking-wider">
                    Active plan: {currentTier} · status {billing.status ?? "—"}
                  </span>
                </motion.div>
              )}

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
                {cards.map((card) => {
                  const isViolet = card.accent === "violet";
                  return (
                    <SpotlightCard
                      key={card.key}
                      className={`relative ${
                        card.highlight
                          ? "border-amber-400/60 shadow-[0_0_60px_-15px_rgba(251,191,36,0.55)]"
                          : isViolet
                            ? "border-violet-400/40 shadow-[0_0_60px_-20px_rgba(167,139,250,0.5)]"
                            : ""
                      }`}
                    >
                      {card.highlight && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                          <span className="text-[10px] uppercase tracking-[0.2em] text-black bg-amber-400 rounded-full px-3 py-1 font-bold shadow-lg">
                            Most popular
                          </span>
                        </div>
                      )}
                      {isViolet && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                          <span className="text-[10px] uppercase tracking-[0.2em] text-white bg-violet-500 rounded-full px-3 py-1 font-bold shadow-lg">
                            For institutions
                          </span>
                        </div>
                      )}
                      <div className="p-6 flex flex-col h-full">
                        <h3 className="font-display text-2xl tracking-tight mb-1">
                          {card.name}
                        </h3>

                        <div className="mb-1 flex items-baseline gap-2">
                          <div
                            className={`text-4xl font-display ${
                              isViolet ? "text-violet-200" : "text-amber-200"
                            }`}
                            data-testid={`price-${card.tier}`}
                          >
                            {card.priceLabel}
                          </div>
                        </div>
                        {card.priceSubLabel && (
                          <div className="text-xs text-white/50 mb-2">
                            {card.priceSubLabel}
                          </div>
                        )}
                        {card.savingsLabel && (
                          <div className="text-xs text-emerald-300 mb-2 font-medium">
                            {card.savingsLabel}
                          </div>
                        )}
                        {card.trialLabel && (
                          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 rounded-full px-2.5 py-1 mb-3 w-fit">
                            <Gift className="w-3 h-3" />
                            {card.trialLabel}
                          </div>
                        )}

                        <p className="text-sm text-white/60 mb-5 min-h-[40px]">
                          {card.blurb}
                        </p>
                        <ul className="space-y-2 mb-6 flex-1">
                          {card.features.map((f) => (
                            <li
                              key={f}
                              className="flex items-start gap-2 text-sm text-white/80"
                            >
                              <Check
                                className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                                  isViolet ? "text-violet-300" : "text-amber-300"
                                }`}
                              />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>

                        {card.cta ? (
                          card.highlight || isViolet ? (
                            <GoldButton
                              onClick={card.cta.action}
                              disabled={card.cta.disabled || card.cta.loading}
                              data-testid={`cta-${card.tier}`}
                            >
                              {card.cta.loading && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              )}
                              {card.cta.label}
                            </GoldButton>
                          ) : (
                            <GhostButton
                              onClick={card.cta.action}
                              disabled={card.cta.disabled || card.cta.loading}
                              data-testid={`cta-${card.tier}`}
                            >
                              {card.cta.loading && (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              )}
                              {card.cta.label}
                            </GhostButton>
                          )
                        ) : (
                          !user && (
                            <Link href="/examiner">
                              <a>
                                <GhostButton>Sign in to subscribe</GhostButton>
                              </a>
                            </Link>
                          )
                        )}
                      </div>
                    </SpotlightCard>
                  );
                })}
              </div>

              <MetallicDivider />

              <div className="grid md:grid-cols-2 gap-8 mt-12">
                <div>
                  <h4 className="font-display text-xl mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    Pay your way
                  </h4>
                  <p className="text-white/60 text-sm mb-6">
                    Pick your home currency from the top-right. Stripe handles
                    conversion and local payment methods automatically.
                  </p>
                  <ul className="space-y-3">
                    {PAYMENT_METHODS.map((m) => (
                      <li
                        key={m.label}
                        className="flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-white/[0.03]"
                      >
                        <m.icon className="w-5 h-5 text-amber-300 mt-0.5" />
                        <div>
                          <div className="text-white/90 text-sm font-medium">
                            {m.label}
                          </div>
                          <div className="text-white/50 text-xs">{m.hint}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-4 text-sm text-white/60">
                  <h4 className="font-display text-xl text-white mb-2">FAQ</h4>
                  <div>
                    <div className="text-white/90 font-medium">
                      Does one subscription unlock both pathways?
                    </div>
                    <p>
                      Yes. Virtual Exam Hall and Assessment Studio are included
                      in every paid tier.
                    </p>
                  </div>
                  <div>
                    <div className="text-white/90 font-medium">
                      How does the 7-day free trial work?
                    </div>
                    <p>
                      Start Pro and you won't be billed for the first 7 days.
                      Cancel anytime inside the trial and you pay nothing.
                      Trials are available on the monthly Pro plan.
                    </p>
                  </div>
                  <div>
                    <div className="text-white/90 font-medium">
                      Why is annual cheaper?
                    </div>
                    <p>
                      Pay yearly and you get 2 months free — roughly a 17%
                      discount versus paying monthly.
                    </p>
                  </div>
                  <div>
                    <div className="text-white/90 font-medium">
                      What's included in School?
                    </div>
                    <p>
                      Much higher monthly volume, an institutional admin
                      console, school-wide leaderboards, custom onboarding,
                      and a dedicated success manager. Invoice / purchase
                      order billing is available on request — contact us
                      after subscribing.
                    </p>
                  </div>
                  <div>
                    <div className="text-white/90 font-medium">
                      Which currencies can I pay in?
                    </div>
                    <p>
                      MYR, USD, SGD, EUR, GBP and AUD. Pick yours from the
                      currency switcher at the top of this page.
                    </p>
                  </div>
                  <div>
                    <div className="text-white/90 font-medium">
                      What happens right after I pay?
                    </div>
                    <p>
                      We issue you a brand-new password and show it once in a
                      big, copyable card. Copy it, download as PDF, Word, or
                      text, open in Google Docs, or email it to yourself.
                    </p>
                  </div>
                  <div>
                    <div className="text-white/90 font-medium">
                      Can I cancel anytime?
                    </div>
                    <p>
                      Yes — open the billing portal from this page and cancel
                      in a click. Your plan stays active until the end of the
                      paid period.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {licensePassword && user && (
        <LicenseReveal
          password={licensePassword}
          email={user.email}
          onClose={() => {
            setLicensePassword(null);
            refreshAuth?.();
          }}
        />
      )}
    </CinematicShell>
  );
}
