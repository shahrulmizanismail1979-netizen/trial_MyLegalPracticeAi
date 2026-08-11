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

export function readRateLimitRemaining(res: Response): number | null {
  const raw = res.headers.get("RateLimit-Remaining");
  if (raw === null) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}
