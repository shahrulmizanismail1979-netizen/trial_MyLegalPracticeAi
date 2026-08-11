import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { deviceSeatKey } from "./seatLimits";

const MAX = parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE ?? "60", 10);

/**
 * Extracts a stable per-seat key from the request/response pair.
 *
 * For portals where multiple lawyers share one access code (team bundles),
 * the key is scoped down to the individual lawyer's session or device so
 * that a single heavy user cannot exhaust the whole firm's quota.
 *
 * - Session-based portals (crim/lit/sya): key includes the Express session ID,
 *   which is unique per login, giving each lawyer their own bucket.
 * - Token/cookie portals (ccb/corp/accident): key includes a device fingerprint
 *   (IP + user-agent hash via deviceSeatKey) for the same effect.
 * - Per-user portals (acad/convey): already keyed per individual; no change.
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
  const session = req.session as unknown as Record<string, unknown> | undefined;

  // Per-lawyer sub-key for session-based portals — each login gets a distinct
  // Express session ID, so lawyers on the same team bundle don't share a bucket.
  const sessionId = req.sessionID ?? null;

  // CCB: keyed by access code; add device fingerprint so each team member
  // gets their own quota rather than sharing the per-code bucket.
  if (typeof locals.ccbAccessCodeId === "number") {
    return `ccb:${locals.ccbAccessCodeId}:${deviceSeatKey(req)}`;
  }

  // Accident: same pattern as CCB.
  if (typeof locals.accidentAccessCodeId === "number") {
    return `accident:${locals.accidentAccessCodeId}:${deviceSeatKey(req)}`;
  }

  // Corp: same pattern — access code shared by the firm.
  if (typeof locals.accessCodeId === "number") {
    return `corp:${locals.accessCodeId}:${deviceSeatKey(req)}`;
  }

  // Crim: res.locals.accessCode is the full access-code row; master sessions
  // have { tier: "full", createdAt: null } with no numeric id.
  // Append session ID so each lawyer on a team bundle has their own bucket.
  const crimCode = locals.accessCode as Record<string, unknown> | undefined;
  if (crimCode && typeof crimCode.id === "number") {
    const seat = sessionId ?? deviceSeatKey(req);
    return `crim:${crimCode.id}:${seat}`;
  }

  // Acad: res.locals.user.id is already a per-individual user ID — no change needed.
  const acadUser = locals.user as Record<string, unknown> | undefined;
  if (acadUser && acadUser.id != null) {
    return `acad:${acadUser.id}`;
  }

  // Sya: req.session.userId identifies the subscriber row, which may be shared
  // by a team bundle. Append session ID for per-lawyer isolation.
  if (session?.userId != null) {
    const seat = sessionId ?? deviceSeatKey(req);
    return `sya:${session.userId}:${seat}`;
  }

  // Lit: req.session.accessCodeId is the shared team code. Append session ID.
  if (session?.accessCodeId != null) {
    const seat = sessionId ?? deviceSeatKey(req);
    return `lit:${session.accessCodeId}:${seat}`;
  }

  // Convey: req.userId is a per-individual user ID — no change needed.
  const conveyUserId = (req as unknown as Record<string, unknown>).userId;
  if (typeof conveyUserId === "number") return `convey:${conveyUserId}`;

  // Fallback: group any unidentified request (master sessions, unknown portals)
  // into a single shared bucket. In practice every AI route sits behind auth
  // middleware so this bucket is almost never hit.
  return "__noauth__";
}

/**
 * Per-seat rate limit for AI-generation endpoints (Gemini / OpenAI).
 *
 * Default: 60 requests per minute per lawyer/device.
 * Override via AI_RATE_LIMIT_PER_MINUTE environment variable.
 *
 * For team-bundle access codes the limit applies per seat (session or device),
 * not per access code, so individual heavy users cannot exhaust the quota for
 * the whole firm.
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
