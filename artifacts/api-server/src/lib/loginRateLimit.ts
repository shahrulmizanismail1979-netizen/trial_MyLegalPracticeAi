import { timingSafeEqual } from "node:crypto";
import rateLimit, { MemoryStore } from "express-rate-limit";

const loginRateLimitStore = new MemoryStore();

export function resetLoginRateLimitForE2e(candidate: string | undefined): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const expected = process.env.SESSION_SECRET;
  if (!candidate || !expected) return false;
  const actualBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return false;
  }
  loginRateLimitStore.resetAll();
  return true;
}

/**
 * Shared brute-force protection for portal login / access-code verification
 * endpoints. 20 attempts per 15 minutes per IP — generous for real users
 * (a legitimate login takes 1–3 attempts), but prevents unbounded
 * access-code / password guessing.
 *
 * `app.set("trust proxy", 1)` is configured in app.ts, so req.ip reflects
 * the real client IP behind the Replit proxy.
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  store: loginRateLimitStore,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in a few minutes." },
});
