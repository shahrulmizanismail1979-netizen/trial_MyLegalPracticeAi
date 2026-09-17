/**
 * A checkout intent identifies one pending browser attempt, rather than a
 * product or a customer.  It must be generated in the browser so that a
 * retry of a request whose response was lost can use the same Stripe
 * idempotency key, while a separately selected tier gets a different key.
 */
export function createCheckoutIntentId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  // Older browsers without randomUUID still have a cryptographically secure
  // random source.  Keep this fallback deliberately free of Math.random().
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}