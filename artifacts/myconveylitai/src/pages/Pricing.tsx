import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Scale, Check, Loader2, ArrowLeft, Sparkles, Gift } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import {
  fetchPlans, createCheckout, type PlansResponse, type Interval, type Currency,
} from '@/lib/subscription';
import { TIER_LABELS, hasTier, type Tier } from '@/lib/tier';

const TIER_ORDER: Array<Exclude<Tier, 'free'>> = ['student', 'practitioner', 'firm'];

function appOrigin(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${window.location.origin}${base}${path}`;
}

function formatPrice(symbol: string, minor: number): string {
  const major = minor / 100;
  return `${symbol}${major.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function Pricing() {
  const { isAuthenticated, currentUser } = useApp();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [data, setData] = useState<PlansResponse | null>(null);
  const [interval, setInterval] = useState<Interval>('month');
  const [currency, setCurrency] = useState<Currency>('myr');
  const [busyTier, setBusyTier] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans()
      .then(setData)
      .catch((err) =>
        toast({ variant: 'destructive', title: 'Could not load plans', description: String(err) }),
      );
  }, [toast]);

  const currentTier = currentUser?.tier;
  const grandfathered = !!currentUser?.grandfathered;

  const handleSubscribe = async (_tier: Exclude<Tier, 'free'>) => {
    // Purchases are handled centrally on the AI Web Books landing page.
    window.location.href = '/#pricing';
  };

  return (
    <div className="min-h-screen bg-gold-950 relative overflow-hidden">
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[70%] h-[40%] rounded-full bg-amber-500/5 blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-10 md:py-16">
        <div className="flex items-center justify-between mb-10">
          <Link href={isAuthenticated ? '/dashboard' : '/'} className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-400 transition-colors text-sm font-medium" data-testid="link-back">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="inline-flex items-center gap-2 text-slate-300">
            <Scale className="w-5 h-5 text-amber-500" />
            <span className="font-serif font-semibold">MyConveyLitAI</span>
          </div>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-slate-50 mb-4 tracking-tight">
            Choose your plan
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Professional-grade Malaysian conveyancing tools, drafting AI and legal research — priced
            for students, practitioners and firms.
          </p>
        </div>

        {grandfathered && (
          <div className="max-w-2xl mx-auto mb-10 flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25">
            <Gift className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-sm text-amber-200/90">
              You're a <b className="text-amber-300">founding member</b> with full Firm-tier access,
              free forever. No subscription needed.
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
          <div className="inline-flex p-1 rounded-2xl bg-gold-900 border border-gold-800">
            {(['month', 'year'] as Interval[]).map((i) => (
              <button
                key={i}
                onClick={() => setInterval(i)}
                data-testid={`button-interval-${i}`}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  interval === i ? 'bg-amber-500 text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {i === 'month' ? 'Monthly' : 'Yearly'}
                {i === 'year' && <span className="ml-1.5 text-[10px] opacity-80">save ~2 months</span>}
              </button>
            ))}
          </div>

          {data && (
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              data-testid="select-currency"
              className="px-4 py-2.5 rounded-2xl bg-gold-900 border border-gold-800 text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            >
              {data.currencies.map((c) => (
                <option key={c} value={c}>{data.currencyLabels[c]}</option>
              ))}
            </select>
          )}
        </div>

        {!data ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {TIER_ORDER.map((tier, idx) => {
              const plan = data.plans[tier];
              const symbol = data.currencySymbols[currency];
              const amount = plan.prices[interval][currency];
              const featured = tier === 'practitioner';
              const isCurrent = currentTier === tier || (grandfathered && tier === 'firm');
              const owned = hasTier(currentTier, tier) || grandfathered;

              return (
                <motion.div
                  key={tier}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.08 }}
                  className={`relative flex flex-col rounded-[2rem] border p-7 ${
                    featured
                      ? 'bg-gold-900 border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.12)]'
                      : 'bg-gold-900/60 border-gold-800'
                  }`}
                  data-testid={`card-plan-${tier}`}
                >
                  {featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500 text-slate-900 text-[11px] font-bold uppercase tracking-wide">
                      <Sparkles className="w-3 h-3" /> Most popular
                    </div>
                  )}
                  <h3 className="text-xl font-serif font-bold text-slate-50">{plan.name}</h3>
                  <p className="text-sm text-slate-400 mt-1 min-h-[2.5rem]">{plan.tagline}</p>

                  <div className="mt-5 mb-6">
                    <span className="text-4xl font-bold text-slate-50">{formatPrice(symbol, amount)}</span>
                    <span className="text-slate-500 text-sm">/{interval === 'month' ? 'mo' : 'yr'}</span>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                        <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(tier)}
                    disabled={busyTier !== null || isCurrent || owned}
                    data-testid={`button-subscribe-${tier}`}
                    className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:active:scale-100 ${
                      featured
                        ? 'bg-amber-500 text-slate-900 hover:bg-amber-400 disabled:bg-gold-800 disabled:text-slate-500'
                        : 'bg-gold-800 text-slate-100 hover:bg-gold-700 disabled:opacity-50'
                    }`}
                  >
                    {busyTier === tier ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : isCurrent ? (
                      'Current plan'
                    ) : owned ? (
                      `Included in ${TIER_LABELS[currentTier ?? 'free']}`
                    ) : isAuthenticated ? (
                      `Subscribe to ${plan.name}`
                    ) : (
                      'Get started'
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        <p className="text-center text-slate-600 text-xs mt-10">
          Secure payments by Stripe. Cancel anytime from the billing portal. Prices shown exclude any
          applicable taxes.
        </p>
      </div>
    </div>
  );
}
