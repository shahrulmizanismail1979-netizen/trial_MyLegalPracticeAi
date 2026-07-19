import rateLimit from "express-rate-limit";

/**
 * Rate limiter for expensive AI-backed endpoints (transcription, vision,
 * document parsing, voice parse, minutes generation).
 *
 * 30 requests per 15-minute window per IP.  This is generous enough for
 * intensive human use (e.g., processing many screenshots in a session) while
 * preventing scripted bulk submissions that would exhaust third-party AI/
 * transcription quotas and drive costs.
 */
export const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error:
      "Too many AI requests from this IP. Please wait a few minutes before trying again.",
  },
});
