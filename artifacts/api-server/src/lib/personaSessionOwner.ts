/**
 * Resolve the CALLER'S authenticated portal identity for persona writes.
 *
 * The shared `/api/personas` router lives OUTSIDE every portal's router, so
 * none of the per-portal auth middlewares (express-session for lit/crim/sya/
 * acad, the accident cookie gate, the corp/ccb bearer guards) run before it.
 * A persona write that updates an EXISTING persona must nonetheless be bound
 * to the caller's real portal session server-side — we must not trust the raw
 * access code in the request body.
 *
 * `resolvePersonaSessionCode` tries each portal's session mechanism in turn
 * and returns the first authenticated identity's normalized (uppercased)
 * access code, or `null` when the caller presents no recognisable session.
 *
 * Design contract for every resolver:
 *   - MUST fail soft: return `null`, never throw, on any error/miss.
 *   - MUST NOT mutate persistent state (no seat claims, no session refresh,
 *     no row writes) — this is a read-only identity probe, and running it on
 *     every persona write must be side-effect free.
 *
 * Two portals share the `Authorization: Bearer` header (corp = opaque
 * corp_sessions token, ccb = signed JWT); we try both and take the first that
 * yields an identity.
 */
import type { Request } from "express";
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import { litSession } from "../lit/session";
import { crimSession } from "../crim/session";
import { syaSession } from "../sya/session";
import { acadSession } from "../acad/session";
import { SEAT_TTL_MS } from "./seatLimits";

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Bearer token from the Authorization header, or null. */
function bearerToken(req: Request): string | null {
  const header = req.headers["authorization"];
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Run one express-session middleware against an ISOLATED stand-in request so
 * the persona `req` is never mutated and sequential portal probes cannot leak
 * each other's session state. The stand-in shares only the incoming cookie
 * header (that is all express-session reads), plus a throwaway response whose
 * header/write methods are inert so the middleware's touch-on-read behaviour
 * writes nothing back to the real client.
 *
 * Returns the resolved `req.session` object (already loaded from the store) or
 * `null` on any failure. The middleware's own store read is the only I/O; we
 * never call `session.save()`/`touch()`, so `resave:false` + our inert res
 * mean no store writes happen.
 */
async function loadSession(
  middleware: RequestHandler,
  cookieHeader: string,
): Promise<Record<string, unknown> | null> {
  return await new Promise((resolve) => {
    let settled = false;
    const done = (value: Record<string, unknown> | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    // Minimal express-like req/res. express-session reads req.headers.cookie
    // and (with our PgStore) sets req.session / req.sessionID.
    const fakeReq = {
      headers: { cookie: cookieHeader },
      // cookie-parser's signed-cookie helpers are not needed; express-session
      // parses the session cookie itself.
      connection: {},
      socket: {},
      originalUrl: "/api/personas",
      url: "/api/personas",
      method: "GET",
    } as unknown as Request;
    // Inert response: swallow everything so no bytes/headers reach the client.
    const noop = (): void => {};
    const fakeRes = {
      getHeader: () => undefined,
      setHeader: noop,
      removeHeader: noop,
      writeHead: noop,
      write: () => true,
      end: () => {
        done((fakeReq as unknown as { session?: Record<string, unknown> }).session ?? null);
      },
      on: noop,
      once: noop,
      emit: () => false,
      headersSent: false,
    } as unknown as import("express").Response;
    try {
      middleware(fakeReq, fakeRes, (err?: unknown) => {
        if (err) {
          done(null);
          return;
        }
        done((fakeReq as unknown as { session?: Record<string, unknown> }).session ?? null);
      });
    } catch {
      done(null);
    }
  });
}

/** access_codes.code for a lit/main access-code id, or null. */
async function codeForAccessCodeId(table: string, id: number): Promise<string | null> {
  try {
    const { rows } = await pool.query<{ code: string }>(
      `SELECT code FROM ${table} WHERE id = $1 LIMIT 1`,
      [id],
    );
    const code = rows[0]?.code;
    return typeof code === "string" && code.length > 0 ? normalizeCode(code) : null;
  } catch {
    return null;
  }
}

/**
 * Accident: HttpOnly cookie `session_id` → access_code_usage.session_id →
 * accessCodeId → access_codes.code. Mirrors the portal gate's idle-session
 * cutoff, but remains read-only (no TTL delete / no touch).
 */
async function resolveAccident(req: Request): Promise<string | null> {
  const sessionId: unknown = req.cookies?.session_id;
  if (typeof sessionId !== "string" || sessionId.length === 0) return null;
  try {
    const { rows } = await pool.query<{ code: string }>(
       `SELECT ac.code AS code
         FROM access_code_usage u
         JOIN access_codes ac ON ac.id = u.access_code_id
        WHERE u.session_id = $1
           AND u.used_at >= $2
           AND ac.is_active
           AND (ac.expires_at IS NULL OR ac.expires_at > now())
        LIMIT 1`,
      [sessionId, new Date(Date.now() - SEAT_TTL_MS)],
    );
    const code = rows[0]?.code;
    return typeof code === "string" && code.length > 0 ? normalizeCode(code) : null;
  } catch (err) {
    logger.debug({ err }, "persona: accident session resolve failed");
    return null;
  }
}

/**
 * Lit: express-session cookie `lit.sid` → session.accessCodeId →
 * access_codes.code. We run the lit session middleware manually against an
 * isolated request (the personas router is outside the lit mount).
 */
async function resolveLit(req: Request): Promise<string | null> {
  const cookie = req.headers.cookie;
  if (typeof cookie !== "string" || !cookie.includes("lit.sid")) return null;
  try {
    const sess = await loadSession(litSession, cookie);
    const id = sess?.["accessCodeId"];
    if (typeof id !== "number") return null;
    return await codeForAccessCodeId("access_codes", id);
  } catch (err) {
    logger.debug({ err }, "persona: lit session resolve failed");
    return null;
  }
}

/**
 * Crim: express-session cookie `crim.sid` → session.accessCodeId →
 * crim_access_codes.code. (crim + sya share the `user_sessions` store table
 * but distinct cookie NAMES, so each middleware only reads its own cookie.)
 */
async function resolveCrim(req: Request): Promise<string | null> {
  const cookie = req.headers.cookie;
  if (typeof cookie !== "string" || !cookie.includes("crim.sid")) return null;
  try {
    const sess = await loadSession(crimSession, cookie);
    const id = sess?.["accessCodeId"];
    if (typeof id !== "number") return null;
    return await codeForAccessCodeId("crim_access_codes", id);
  } catch (err) {
    logger.debug({ err }, "persona: crim session resolve failed");
    return null;
  }
}

/**
 * Sya: express-session cookie `sya.sid` → session.accessCode (the raw code
 * string is stored directly for code logins). The literal "master" override
 * is not a subscriber identity, so it is rejected here.
 */
async function resolveSya(req: Request): Promise<string | null> {
  const cookie = req.headers.cookie;
  if (typeof cookie !== "string" || !cookie.includes("sya.sid")) return null;
  try {
    const sess = await loadSession(syaSession, cookie);
    const raw = sess?.["accessCode"];
    if (typeof raw !== "string" || raw.length === 0) return null;
    const code = normalizeCode(raw);
    if (code === "MASTER") return null;
    return code;
  } catch (err) {
    logger.debug({ err }, "persona: sya session resolve failed");
    return null;
  }
}

/**
 * Acad: express-session cookie `acad.sid` → session.acadUserId →
 * acad_users.access_code (only code-login users have a code; email/OAuth
 * users resolve to null and are simply skipped).
 */
async function resolveAcad(req: Request): Promise<string | null> {
  const cookie = req.headers.cookie;
  if (typeof cookie !== "string" || !cookie.includes("acad.sid")) return null;
  try {
    const sess = await loadSession(acadSession, cookie);
    const userId = sess?.["acadUserId"];
    if (typeof userId !== "string" || userId.length === 0) return null;
    const { rows } = await pool.query<{ access_code: string | null }>(
      `SELECT access_code FROM acad_users WHERE id = $1 LIMIT 1`,
      [userId],
    );
    const code = rows[0]?.access_code;
    return typeof code === "string" && code.length > 0 ? normalizeCode(code) : null;
  } catch (err) {
    logger.debug({ err }, "persona: acad session resolve failed");
    return null;
  }
}

/**
 * Corp: `Authorization: Bearer <token>` → corp_sessions.session_token (active)
 * → corp_access_codes.code. Read-only: we do NOT refresh lastSeenAt or enforce
 * the inactivity TTL here (that is the product routes' job).
 */
async function resolveCorp(token: string): Promise<string | null> {
  try {
    const { rows } = await pool.query<{ code: string }>(
      `SELECT c.code AS code
         FROM corp_sessions s
         JOIN corp_access_codes c ON c.id = s.access_code_id
        WHERE s.session_token = $1 AND s.is_active = true
        LIMIT 1`,
      [token],
    );
    const code = rows[0]?.code;
    return typeof code === "string" && code.length > 0 ? normalizeCode(code) : null;
  } catch (err) {
    logger.debug({ err }, "persona: corp session resolve failed");
    return null;
  }
}

/**
 * CCB: `Authorization: Bearer <JWT>` signed with SESSION_SECRET, payload
 * `{ role, code }`. The code is trusted only because the signature is verified
 * server-side. We accept practitioner/admin roles and require the code to
 * exist as an active, unexpired ccb_access_codes row (static/env codes have no
 * DB row and resolve to null → skipped, which is correct: they are not
 * subscriber identities keyed by a persona).
 */
function ccbSecret(): string {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return ""; // fail closed → verify fails
  return "dev-secret-change-me";
}

async function resolveCcb(token: string): Promise<string | null> {
  const secret = ccbSecret();
  if (!secret) return null;
  let payload: { role?: string; code?: string };
  try {
    payload = jwt.verify(token, secret) as { role?: string; code?: string };
  } catch {
    return null;
  }
  if (payload.role !== "practitioner" && payload.role !== "admin") return null;
  const code = normalizeCode(payload.code ?? "");
  if (!code) return null;
  try {
    const { rows } = await pool.query<{ found: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM ccb_access_codes
          WHERE upper(code) = $1 AND active AND (expires_at IS NULL OR expires_at > now())
       ) AS found`,
      [code],
    );
    return rows[0]?.found === true ? code : null;
  } catch (err) {
    logger.debug({ err }, "persona: ccb session resolve failed");
    return null;
  }
}

/**
 * Convey: bearer token parsed by the global `attachUser` middleware, which
 * runs before the router and attaches the live user record to
 * `req.currentUser`. We read `req.currentUser.accessCode` (raw string) without
 * re-parsing the token or re-claiming a seat.
 */
function resolveConvey(req: Request): string | null {
  const user = (req as unknown as { currentUser?: { accessCode?: string | null } }).currentUser;
  const raw = user?.accessCode;
  return typeof raw === "string" && raw.length > 0 ? normalizeCode(raw) : null;
}

/**
 * Resolve the caller's authenticated portal access code (normalized), or null.
 *
 * The cookie-based resolvers are cheap short-circuits (they bail immediately
 * when their cookie name is absent), so trying every portal on each write is
 * inexpensive. First portal that yields an identity wins.
 */
export async function resolvePersonaSessionCode(req: Request): Promise<string | null> {
  // 1) Cookie-session portals. Each bails instantly if its cookie is absent.
  const accident = await resolveAccident(req);
  if (accident) return accident;

  const lit = await resolveLit(req);
  if (lit) return lit;

  const crim = await resolveCrim(req);
  if (crim) return crim;

  const sya = await resolveSya(req);
  if (sya) return sya;

  const acad = await resolveAcad(req);
  if (acad) return acad;

  // 2) Convey: identity already attached by the global attachUser middleware.
  const convey = resolveConvey(req);
  if (convey) return convey;

  // 3) The two bearer schemes share the Authorization header — try both.
  const token = bearerToken(req);
  if (token) {
    const corp = await resolveCorp(token);
    if (corp) return corp;
    const ccb = await resolveCcb(token);
    if (ccb) return ccb;
  }

  return null;
}
