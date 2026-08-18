/**
 * Lightweight module-level event bus for session-expiry propagation.
 * Any fetch handler that receives a 401 calls emitSessionExpired();
 * the SessionExpiredRedirect component subscribes via onSessionExpired().
 */
type Listener = () => void;
const listeners = new Set<Listener>();

export function emitSessionExpired(): void {
  listeners.forEach((l) => l());
}

export function onSessionExpired(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
