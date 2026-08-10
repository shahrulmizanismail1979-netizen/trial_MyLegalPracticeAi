import rateLimit from "express-rate-limit";

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
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in a few minutes." },
});
