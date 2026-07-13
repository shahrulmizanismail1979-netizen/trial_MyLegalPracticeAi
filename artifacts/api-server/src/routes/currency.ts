import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Display currencies offered on the landing page. USD is the billing currency.
const SUPPORTED = ["USD", "MYR", "SGD", "IDR", "BND", "GBP", "EUR", "AUD"] as const;

// Sensible fallback rates (approx, mid-2026) used only if the upstream
// rate service is unreachable and no cached rates exist yet.
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  MYR: 4.4,
  SGD: 1.32,
  IDR: 16100,
  BND: 1.32,
  GBP: 0.77,
  EUR: 0.9,
  AUD: 1.48,
};

const REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours
const FALLBACK_RETRY_MS = 10 * 60 * 1000; // retry sooner if serving fallback rates

interface RatesCache {
  rates: Record<string, number>;
  fetchedAt: string;
  cachedAtMs: number;
  isFallback?: boolean;
}

let cache: RatesCache | null = null;
let inflight: Promise<RatesCache> | null = null;

async function fetchRates(): Promise<RatesCache> {
  const response = await fetch("https://open.er-api.com/v6/latest/USD", {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Rate service responded ${response.status}`);
  const data = (await response.json()) as {
    result?: string;
    rates?: Record<string, number>;
    time_last_update_utc?: string;
  };
  if (data.result !== "success" || !data.rates) {
    throw new Error("Rate service returned an unexpected payload");
  }
  const rates: Record<string, number> = {};
  for (const code of SUPPORTED) {
    const rate = data.rates[code];
    rates[code] = typeof rate === "number" && rate > 0 ? rate : FALLBACK_RATES[code]!;
  }
  return {
    rates,
    fetchedAt: new Date().toISOString(),
    cachedAtMs: Date.now(),
  };
}

async function getRates(): Promise<RatesCache> {
  const maxAge = cache?.isFallback ? FALLBACK_RETRY_MS : REFRESH_INTERVAL_MS;
  if (cache && Date.now() - cache.cachedAtMs < maxAge) return cache;
  if (!inflight) {
    inflight = fetchRates()
      .then((fresh) => {
        cache = fresh;
        return fresh;
      })
      .finally(() => {
        inflight = null;
      });
  }
  try {
    return await inflight;
  } catch (err) {
    logger.warn({ err }, "Currency rate refresh failed; serving cached/fallback rates");
    if (cache) return cache;
    cache = {
      rates: { ...FALLBACK_RATES },
      fetchedAt: new Date().toISOString(),
      cachedAtMs: Date.now(),
      isFallback: true,
    };
    return cache;
  }
}

router.get("/rates", async (_req, res) => {
  const { rates, fetchedAt } = await getRates();
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.json({ base: "USD", rates, fetchedAt });
});

export default router;
