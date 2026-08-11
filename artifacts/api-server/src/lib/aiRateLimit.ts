import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

const MAX = parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE ?? "60", 10);

/**
 * Extracts a stable per-subscriber key from the request/response pair,
 * trying every portal's auth convention in turn, falling back to IP.
 *
 * Convention summary (set by each portal's auth middleware):
 *   CCB    → res.locals.ccbAccessCodeId (number | null)
 *   Corp   → res.locals.accessCodeId (number)
 *   Crim   → res.locals.accessCode.id (number)
 *   Acad   → res.locals.user.id (string)
 *   Sya    → req.session.userId
 *   Lit    → req.session.accessCodeId
 *   Convey → req.userId (number, set by attachUser global middleware)
 */
function subscriberKey(req: Request, res: Response): string {
  const locals = res.locals as Record<string, unknown>;

  // CCB: ccbAccessCodeId is a number for real subscribers, null for master/admin.
  if (typeof locals.ccbAccessCodeId === "number") {
    return `ccb:${locals.ccbAccessCodeId}`;
  }

  // Accident: accidentAccessCodeId set by requireAccidentSession after DB validation.
  if (typeof locals.accidentAccessCodeId === "number") {
    return `accident:${locals.accidentAccessCodeId}`;
  }

  // Corp: accessCodeId (number).
  if (typeof locals.accessCodeId === "number") {
    return `corp:${locals.accessCodeId}`;
  }

  // Crim: res.locals.accessCode is the full access-code row; master sessions
  // have { tier: "full", createdAt: null } with no numeric id.
  const crimCode = locals.accessCode as Record<string, unknown> | undefined;
  if (crimCode && typeof crimCode.id === "number") {
    return `crim:${crimCode.id}`;
  }

  // Acad: res.locals.user.id (string uid).
  const acadUser = locals.user as Record<string, unknown> | undefined;
  if (acadUser && acadUser.id != null) {
    return `acad:${acadUser.id}`;
  }

  // Sya: req.session.userId (set by syaSessionGate / requireAuth).
  const session = req.session as unknown as Record<string, unknown> | undefined;
  if (session?.userId != null) return `sya:${session.userId}`;

  // Lit: req.session.accessCodeId.
  if (session?.accessCodeId != null) return `lit:${session.accessCodeId}`;

  // Convey: req.userId set by the global attachUser middleware.
  const conveyUserId = (req as unknown as Record<string, unknown>).userId;
  if (typeof conveyUserId === "number") return `convey:${conveyUserId}`;

  // Fallback: group any unidentified request (master sessions, unknown portals)
  // into a single shared bucket. In practice every AI route sits behind auth
  // middleware so this bucket is almost never hit.
  return "__noauth__";
}

/**
 * Per-subscriber rate limit for AI-generation endpoints (Gemini / OpenAI).
 *
 * Default: 60 requests per minute per subscriber.
 * Override via AI_RATE_LIMIT_PER_MINUTE environment variable.
 *
 * Callers receive HTTP 429 with { error: "Too many AI requests. Please try again shortly." }
 * when the limit is exceeded.
 */
export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: MAX,
  keyGenerator: subscriberKey,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please try again shortly." },
});

/**
 * IP-based rate limiter for truly unauthenticated AI endpoints where no
 * subscriber session exists (e.g. public study-guide/flashcard generation).
 * Uses the request IP so each client gets its own quota rather than a shared
 * bucket collapsing all users of the same resource together.
 *
 * Custom keyGenerator avoids the express-rate-limit default IPv6 validation
 * so there is no ERR_ERL_KEY_GEN_IPV6 warning.
 */
export const ipAiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: MAX,
  keyGenerator: (req) => req.ip ?? req.socket?.remoteAddress ?? "__noip__",
  // Disable the keyGeneratorIpFallback validation check — we intentionally key
  // by IP here for truly unauthenticated endpoints and are aware of IPv6 risks.
  validate: { keyGeneratorIpFallback: false },
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please try again shortly." },
});

/**
 * Per-attempt rate limit for unauthenticated student/candidate Studio routes
 * (answers, transcription, handwriting OCR, finish, proctor snapshots).
 * Keys by the attempt ID in the URL so each candidate's attempt has its own
 * bucket rather than sharing a single __noauth__ fallback.
 */
export const attemptAiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: MAX,
  keyGenerator: (req) => {
    const id = (req.params as Record<string, string | undefined>).id;
    return id ? `attempt:${id}` : "__attempt_unknown__";
  },
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please try again shortly." },
});
