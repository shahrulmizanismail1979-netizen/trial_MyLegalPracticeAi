import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { deviceSeatKey } from "./seatLimits";
import { isMasterToken } from "../routes/accident";

const MAX = parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE ?? "60", 10);

export const AI_SEAT_COOKIE = "ai_seat";
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
export function subscriberKey(req: Request, res: Response): string {
  const locals = res.locals as Record<string, unknown>;
  const session = req.session as unknown as Record<string, unknown> | undefined;

  // Per-lawyer sub-key for session-based portals — each login gets a distinct
  // Express session ID, so lawyers on the same team bundle don't share a bucket.
  const sessionId = req.sessionID ?? null;

  // CCB: keyed by access code; add device fingerprint so each team member
  // gets their own quota rather than sharing the per-code bucket.
  if (typeof locals.ccbAccessCodeId === "number") {
    return `ccb:${locals.ccbAccessCodeId}:${seatOrDevice(req, res)}`;
  }

  // Accident: same pattern as CCB.
  if (typeof locals.accidentAccessCodeId === "number") {
    return `accident:${locals.accidentAccessCodeId}:${seatOrDevice(req, res)}`;
  }

  // Corp: same pattern — access code shared by the firm.
  if (typeof locals.accessCodeId === "number") {
    return `corp:${locals.accessCodeId}:${seatOrDevice(req, res)}`;
  }

  // Crim: res.locals.accessCode is the full access-code row; master sessions
  // have { tier: "full", createdAt: null } with no numeric id.
  // Append session ID so each lawyer on a team bundle has their own bucket.
  const crimCode = locals.accessCode as Record<string, unknown> | undefined;
  if (crimCode && typeof crimCode.id === "number") {
    const seat = sessionId ?? seatOrDevice(req, res);
    return `crim:${crimCode.id}:${seat}`;
  }

  // Crim master-override sessions carry no DB code row (requireAuth sets a
  // synthetic accessCode without a numeric id, and req.session.isMaster).
  // Give each master login its own bucket instead of the shared fallback.
  if (session?.isMaster === true) {
    const seat = sessionId ?? seatOrDevice(req, res);
    return `crim:master:${seat}`;
  }

  // Accident master-override sessions authenticate via a signed "master.*"
  // token in the session_id cookie (no DB row, so accidentAccessCodeId is
  // absent). Key each master token to its own bucket.
  const accidentToken = rawCookie(req, "session_id");
  if (typeof accidentToken === "string" && isMasterToken(accidentToken)) {
    return `accident:master:${accidentToken.slice(0, 24)}`;
  }

  // Acad: res.locals.user.id is already a per-individual user ID — no change needed.
  const acadUser = locals.user as Record<string, unknown> | undefined;
  if (acadUser && acadUser.id != null) {
    return `acad:${acadUser.id}`;
  }

  // Sya: req.session.userId identifies the subscriber row, which may be shared
  // by a team bundle. Append session ID for per-lawyer isolation.
  if (session?.userId != null) {
    const seat = sessionId ?? seatOrDevice(req, res);
    return `sya:${session.userId}:${seat}`;
  }

  // Lit: req.session.accessCodeId is the shared team code. Append session ID.
  if (session?.accessCodeId != null) {
    const seat = sessionId ?? seatOrDevice(req, res);
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
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: MAX,
  keyGenerator: subscriberKey,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please try again shortly." },
});
export const aiRateLimit: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Issue/verify the per-seat cookie BEFORE keying the limiter, so two
  // lawyers behind the same NAT with identical browsers still get their
  // own buckets.
  ensureAiSeat(req, res, (err?: unknown) => {
    if (err) return next(err);
    aiLimiter(req, res, next);
  });
};

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

/**
 * Per-lawyer seat key for portals without a server-side session ID:
 * prefer the server-issued seat cookie (survives shared NAT + identical
 * browsers), fall back to the IP+UA device fingerprint for cookie-less
 * clients.
 */
function seatOrDevice(req: Request, res: Response): string {
  const seat = (res.locals as Record<string, unknown>).aiSeatId;
  if (typeof seat === "string" && seat.length > 0) return `seat:${seat}`;
  return `dev:${deviceSeatKey(req)}`;
}

const SEAT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Returns the verified seat id from the request's seat cookie, or null. */
export function readAiSeat(req: Request): string | null {
  const raw = rawCookie(req, AI_SEAT_COOKIE);
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = signSeat(id);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return id;
}

function seatSigningKey(): string {
  const explicit = process.env.SESSION_SECRET;
  if (explicit && explicit.length > 0) return explicit;
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && dbUrl.length > 0) {
    return crypto.createHmac("sha256", "ai-seat-cookie").update(dbUrl).digest("hex");
  }
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Ensure the request carries a server-issued seat id: reuse a valid seat
 * cookie, or mint one and set it on the response. Stores the id in
 * res.locals.aiSeatId for the key generator.
 */
export const ensureAiSeat: RequestHandler = (req, res, next) => {
  const seat = readAiSeat(req);
  if (seat) {
    // Only a seat the CLIENT presented counts for rate-limit keying. A seat
    // minted on this very request must not be used as the key — otherwise a
    // cookie-less script would get a brand-new bucket on every request and
    // never hit the limit. Those clients fall back to the device fingerprint.
    res.locals.aiSeatId = seat;
  } else {
    const fresh = crypto.randomBytes(12).toString("hex");
    res.cookie(AI_SEAT_COOKIE, `${fresh}.${signSeat(fresh)}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SEAT_TTL_MS,
    });
  }
  next();
};

function signSeat(id: string): string {
  return crypto.createHmac("sha256", SEAT_KEY).update(id).digest("hex").slice(0, 32);
}

/** Parse the raw Cookie header directly (works with or without cookie-parser). */
function rawCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

const SEAT_KEY = seatSigningKey();
