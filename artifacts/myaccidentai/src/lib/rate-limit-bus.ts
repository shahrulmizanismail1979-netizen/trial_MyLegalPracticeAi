/**
 * Lightweight module-level event bus for AI rate-limit header propagation.
 */
type Listener = (remaining: number) => void;
const listeners = new Set<Listener>();

export function emitRateLimit(remaining: number): void {
  listeners.forEach((l) => l(remaining));
}

export function onRateLimit(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Read the remaining-request count from a fetch Response's rate-limit headers.
 *
 * express-rate-limit is configured with standardHeaders: "draft-8", which
 * emits `RateLimit: "<policy>"; r=<remaining>; t=<reset-seconds>` -- NOT a
 * separate RateLimit-Remaining header (that's draft-6/7). Parse the draft-8
 * form first and keep the legacy header as a fallback for robustness.
 */
export function readRateLimitRemaining(res: Response): number | null {
  const draft8 = res.headers.get("RateLimit");
  if (draft8 !== null) {
    const m = draft8.match(/\br\s*=\s*(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  const raw = res.headers.get("RateLimit-Remaining");
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}
