/**
 * Thin fetch wrapper for MySyariahAI AI endpoints.
 * Reads the RateLimit-Remaining draft-8 header from each response and emits
 * the value to the rate-limit event bus so the RateLimitWarning component
 * can surface a countdown to the user.
 */
import { emitRateLimit, readRateLimitRemaining } from "./rate-limit-bus";

/**
 * Drop-in replacement for `fetch()` used on AI streaming endpoints.
 * On a 429 it emits 0 remaining before re-throwing, so the banner appears
 * even when the server body is consumed as an error.
 */
export async function aiStreamFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, init);

  // Only track AI quota for generation requests (POST/PUT).
  // Metadata GETs (list, categories, types) share some URL prefixes but do
  // not consume a meaningful AI quota slot, so we skip them to avoid showing
  // a misleading countdown after a simple page-load fetch.
  const method = (init?.method ?? "GET").toUpperCase();
  if (method === "GET") return res;

  if (res.status === 429) {
    emitRateLimit(0);
    return res;
  }

  const rl = readRateLimitRemaining(res);
  if (rl !== null) emitRateLimit(rl);

  return res;
}
