/**
 * Lightweight module-level event bus for AI rate-limit header propagation.
 * Any code that receives a RateLimit-Remaining header calls emitRateLimit();
 * the RateLimitWarning component subscribes via onRateLimit().
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

/** Read the RateLimit-Remaining draft-8 header from a fetch Response. */
export function readRateLimitRemaining(res: Response): number | null {
  const raw = res.headers.get("RateLimit-Remaining");
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}
