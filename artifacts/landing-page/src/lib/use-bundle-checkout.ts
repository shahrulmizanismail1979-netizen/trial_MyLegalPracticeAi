import { useState } from "react";
import { trackEvent } from "./analytics";

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
    let httpStatus = 0;
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      httpStatus = res.status;
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout. Please try again.");
      }
      trackEvent("checkout_started", {
        tier,
        is_trial: false,
        portal_selected: false,
        surface: "bundle",
      });
      window.location.href = data.url;
    } catch (err) {
      trackEvent("checkout_start_failed", {
        tier,
        is_trial: false,
        portal_selected: false,
        surface: "bundle",
        error_category: httpStatus > 0 ? "api" : "network",
        http_status: httpStatus,
      });
      setError(err instanceof Error ? err.message : "Could not start checkout. Please try again.");
      setLoadingTier(null);
    }
  };

  return { startCheckout, loadingTier, error };
}
