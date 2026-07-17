import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Check, Loader2, ShieldCheck, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSubscription, useRefreshSubscription } from '@/hooks/use-subscription';

interface PlanRow {
  product_id: string;
  product_name: string;
  product_description: string | null;
  price_id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval?: string } | null;
}

function formatPrice(amount: number, currency: string) {
  const value = (amount / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${currency.toUpperCase()} ${value}`;
}

export default function Subscribe() {
  const { toast } = useToast();
  const { data: status } = useSubscription();
  const refreshStatus = useRefreshSubscription();
  const [busyPrice, setBusyPrice] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);

  const { data, isLoading } = useQuery<{ plans: PlanRow[] }>({
    queryKey: ['billing-plans'],
    queryFn: async () => {
      const res = await fetch('/api/lit/billing/plans', { credentials: 'include' });
      if (!res.ok) return { plans: [] };
      return res.json();
    },
  });

  // Returning from a successful Stripe Checkout — refresh status + notify.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') === 'success') {
      toast({
        title: 'Subscription active',
        description: 'Thank you — your MyLitAi subscription is now active.',
      });
      refreshStatus();
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const base = import.meta.env.BASE_URL;
  const subscribePageUrl = `${window.location.origin}${base}app/subscribe`;

  const handleSubscribe = async (_priceId: string) => {
    // Purchases are handled centrally on the AI Web Books landing page.
    window.location.href = '/#pricing';
  };

  const handleManage = async () => {
    setPortalBusy(true);
    try {
      const res = await fetch('/api/lit/billing/portal', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnUrl: subscribePageUrl }),
      });
      const json = await res.json();
      if (res.ok && json.url) {
        window.location.href = json.url;
        return;
      }
      toast({
        title: 'Could not open billing portal',
        description: json.error || 'Please try again.',
        variant: 'destructive',
      });
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setPortalBusy(false);
    }
  };

  const plans = data?.plans ?? [];
  const isActive = status?.active;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-foreground flex items-center gap-3">
          <Sparkles className="h-7 w-7 text-primary" />
          Subscription
        </h1>
        <p className="mt-2 text-muted-foreground">
          Unlock the full AI Chambers practitioner suite and the Oral Advocacy
          practice rooms.
        </p>
      </div>

      {isActive && (
        <div className="mb-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-emerald-400 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">
                {status?.comped
                  ? 'Complimentary access enabled'
                  : 'Your subscription is active'}
              </p>
              <p className="text-sm text-muted-foreground">
                You have full access to all premium tools.
              </p>
            </div>
          </div>
          {!status?.comped && status?.hasCustomer && (
            <Button
              variant="outline"
              onClick={handleManage}
              disabled={portalBusy}
              className="gap-2 shrink-0"
            >
              {portalBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Manage subscription
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          No plans are available yet. Please check back shortly.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.price_id}
              className="rounded-2xl border border-primary/20 bg-card p-6 flex flex-col"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-serif text-xl font-bold text-foreground">
                  {plan.product_name}
                </h3>
                <span className="text-xs uppercase tracking-widest text-primary font-semibold">
                  {plan.recurring?.interval === 'year' ? 'Yearly' : 'Monthly'}
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold text-foreground">
                {formatPrice(plan.unit_amount, plan.currency)}
                <span className="text-base font-normal text-muted-foreground">
                  {' '}
                  / {plan.recurring?.interval ?? 'month'}
                </span>
              </p>
              {plan.product_description && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {plan.product_description}
                </p>
              )}
              <div className="flex-1" />
              <Button
                className="mt-6 gap-2"
                disabled={!!busyPrice || isActive}
                onClick={() => handleSubscribe(plan.price_id)}
              >
                {busyPrice === plan.price_id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {isActive ? 'Subscribed' : 'Subscribe'}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
