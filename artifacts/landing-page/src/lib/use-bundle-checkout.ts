import { useState } from "react";

/**
 * Starts a Stripe subscription checkout for a team bundle tier
 * (firm / corporate / education). Mirrors the individual-plan flow in
 * pricing.tsx: POST /api/stripe/checkout then redirect to the session URL.
 */
export function useBundleCheckout() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async (tier: string) => {
    setError(null);
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
      setError(err instanceof Error ? err.message : "Could not start checkout. Please try again.");
      setLoadingTier(null);
    }
  };

  return { startCheckout, loadingTier, error };
}
