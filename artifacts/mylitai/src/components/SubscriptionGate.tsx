import React from 'react';
import { Lock, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/use-subscription';

/**
 * Wraps premium feature content. Any valid, unexpired access code grants full
 * access; this gate only appears when the code has been revoked or expired,
 * and directs the practitioner to the landing page to renew.
 */
export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useSubscription();

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (data?.active) return <>{children}</>;

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <div className="rounded-2xl border border-primary/25 bg-card p-8 md:p-10 shadow-lg text-center">
        <div className="mx-auto mb-5 h-14 w-14 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-foreground">
          Your access code is no longer active
        </h2>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Your access code has expired or been deactivated. Renew your
          subscription on the AI Web Books page to restore full access to the
          AI Chambers practitioner tools and the Oral Advocacy practice suite.
        </p>

        <ul className="mt-6 space-y-2 text-left max-w-sm mx-auto">
          {[
            'Full AI Chambers drafting & analysis suite',
            'Interactive Oral Advocacy practice with voiced judge, witness & opposing counsel',
            'Save unlimited work to My Work',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2 text-sm text-foreground/90">
              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <a href="/#pricing">
          <Button className="mt-8 gap-2" size="lg">
            <Sparkles className="h-4 w-4" />
            Renew subscription
          </Button>
        </a>
      </div>
    </div>
  );
}
