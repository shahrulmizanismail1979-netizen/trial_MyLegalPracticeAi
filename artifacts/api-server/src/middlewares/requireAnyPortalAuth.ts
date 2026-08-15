/**
 * requireAnyPortalAuth — shared middleware that accepts any authenticated
 * portal session: Lit, Crim, Sya, Acad (express-session cookies), CCB/Convey
 * (Bearer JWT), Corp (Bearer opaque token), Accident (session_id cookie), or
 * the master access code.
 *
 * On success it sets req.portalAuth with the identity type and a stable key
 * for rate-limiting. On failure it returns 401.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { isConveyCodeExpired } from "./conveyAuth";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "";
const MASTER_ACCESS_CODE = process.env.MASTER_ACCESS_CODE ?? "";

export interface PortalAuthIdentity {
  /** Which portal (or master) authenticated the request. */
  type:
    | "master"
    | "lit"
    | "crim"
    | "sya"
    | "acad"
    | "ccb"
    | "corp"
    | "convey"
    | "accident";
  /** Stable string used as the rate-limit key. */
  identityKey: string;
}

declare global {
  namespace Express {
    interface Request {
      portalAuth?: PortalAuthIdentity;
    }
  }
}

// ── Cookie helpers ────────────────────────────────────────────────────────────

/**
 * Verify and strip an express-session signed cookie.
 * Format: s:{sessionId}.{base64-hmac-sha256}
 * Returns the raw sessionId, or null if invalid/absent.
 */
function unsignExpressSession(
  cookieValue: string | undefined,
  secret: string,
): string | null {
  if (!cookieValue || !cookieValue.startsWith("s:")) return null;
  if (!secret) return null;

  const signed = cookieValue.slice(2); // strip 's:'
  const dotIdx = signed.lastIndexOf(".");
  if (dotIdx === -1) return null;

  const sid = signed.slice(0, dotIdx);
  const mac = signed.slice(dotIdx + 1);
  const expected = createHmac("sha256", secret)
    .update(sid)
    .digest("base64")
    .replace(/=+$/, "");

  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(mac);
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? sid : null;
  } catch {
    return null;
  }
}

/**
 * Resolve a signed session cookie name to its raw session ID.
 *
 * cookie-parser (mounted with SESSION_SECRET) automatically verifies signed
 * cookies and moves them from req.cookies into req.signedCookies — deleting
 * the entry from req.cookies.  We therefore check req.signedCookies first
 * (the fast, already-verified path) and fall back to manual verification of
 * whatever remains in req.cookies (covers misconfigured or alternative setups).
 */
function getSessionCookieSid(
  req: Request,
  cookieName: string,
  secret: string,
): string | null {
  const signedCookies = req.signedCookies as Record<string, string | false> | undefined;
  const already = signedCookies?.[cookieName];
  if (already && typeof already === "string") return already;

  const rawCookies = (req.cookies ?? {}) as Record<string, string | undefined>;
  return unsignExpressSession(rawCookies[cookieName], secret);
}

/**
 * Query a Postgres-backed express-session store for a given sid.
 * Returns the parsed session object if found and not expired, else null.
 */
async function loadExpressSession(
  table: string,
  sid: string,
): Promise<Record<string, unknown> | null> {
  try {
    const result = await db.execute(sql`
      SELECT sess FROM ${sql.raw(table)}
      WHERE sid = ${sid} AND expire > NOW()
      LIMIT 1
    `);
    const row = result.rows[0] as { sess?: unknown } | undefined;
    if (!row?.sess || typeof row.sess !== "object") return null;
    return row.sess as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function requireAnyPortalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;

  // ── 1. Master access code (x-master-code header) ─────────────────────────
  const xMaster = req.headers["x-master-code"];
  if (
    xMaster &&
    MASTER_ACCESS_CODE &&
    typeof xMaster === "string" &&
    xMaster === MASTER_ACCESS_CODE
  ) {
    req.portalAuth = { type: "master", identityKey: "master" };
    next();
    return;
  }

  // ── 2. Authorization: Bearer <token> ─────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();

    // Master code as Bearer
    if (MASTER_ACCESS_CODE && token === MASTER_ACCESS_CODE) {
      req.portalAuth = { type: "master", identityKey: "master" };
      next();
      return;
    }

    // JWT — covers CCB (payload: {code, role}) and Convey (payload: {uid})
    if (SESSION_SECRET) {
      try {
        const payload = jwt.verify(token, SESSION_SECRET) as Record<
          string,
          unknown
        >;
        const isConvey = Boolean(payload.uid);
        const identityKey = String(
          payload.uid ?? payload.code ?? payload.sub ?? token.slice(0, 32),
        );

        if (isConvey) {
          // Re-check the live subscription expiry on every request so that a
          // JWT issued before the plan expired is rejected once the plan ends.
          // We look up the user's access_code then delegate to isConveyCodeExpired
          // which queries the subscribers table (fail-closed on DB error).
          const uid = Number(payload.uid);
          let accessCode: string | null = null;
          if (uid) {
            try {
              const userRows = await db.execute(sql`
                SELECT access_code FROM users WHERE id = ${uid} LIMIT 1
              `);
              accessCode =
                (userRows.rows[0] as { access_code?: string } | undefined)
                  ?.access_code ?? null;
            } catch {
              // Fail closed: cannot read the user row — deny access.
              res.status(401).json({
                error:
                  "Unable to verify subscription status. Please try again.",
              });
              return;
            }
          }
          if (await isConveyCodeExpired(accessCode)) {
            res.status(401).json({
              error:
                "Subscription has expired. Please renew your plan to access case law.",
            });
            return;
          }
        }

        req.portalAuth = {
          type: isConvey ? "convey" : "ccb",
          identityKey: `${isConvey ? "convey" : "ccb"}:${identityKey}`,
        };
        next();
        return;
      } catch {
        // Not a valid JWT — fall through to corp opaque check
      }
    }

    // Corp opaque Bearer token — query corp_sessions
    try {
      const corpResult = await db.execute(sql`
        SELECT cs.id, ca.code
        FROM corp_sessions cs
        JOIN corp_access_codes ca ON ca.id = cs.access_code_id
        WHERE cs.session_token = ${token}
          AND ca.is_active = true
          AND (ca.expires_at IS NULL OR ca.expires_at > NOW())
          AND cs.last_seen_at > NOW() - INTERVAL '12 hours'
        LIMIT 1
      `);
      if (corpResult.rows.length > 0) {
        const row = corpResult.rows[0] as { code: string };
        req.portalAuth = { type: "corp", identityKey: `corp:${row.code}` };
        next();
        return;
      }
    } catch {
      // Table may not exist in certain environments — skip
    }
  }

  // ── 3. Session cookies ────────────────────────────────────────────────────

  // Lit: cookie 'lit.sid', table 'lit_sessions', sess.authenticated = true + accessCodeId present.
  // Both conditions are required: authenticated confirms the session is logged-in,
  // accessCodeId confirms the session is bound to a valid subscription identity.
  const litSid = getSessionCookieSid(req, "lit.sid", SESSION_SECRET);
  if (litSid) {
    const sess = await loadExpressSession("lit_sessions", litSid);
    if (sess?.authenticated === true && sess?.accessCodeId) {
      req.portalAuth = {
        type: "lit",
        identityKey: `lit:${sess.accessCodeId}`,
      };
      next();
      return;
    }
  }

  // Crim: cookie 'crim.sid', table 'user_sessions'
  const crimSid = getSessionCookieSid(req, "crim.sid", SESSION_SECRET);
  if (crimSid) {
    const sess = await loadExpressSession("user_sessions", crimSid);
    if (sess && (sess.authenticated === true || sess.accessCodeId || sess.accessCode)) {
      const key = sess.accessCodeId ?? sess.accessCode ?? crimSid;
      req.portalAuth = { type: "crim", identityKey: `crim:${key}` };
      next();
      return;
    }
  }

  // Sya: cookie 'sya.sid', table 'user_sessions'
  const syaSid = getSessionCookieSid(req, "sya.sid", SESSION_SECRET);
  if (syaSid) {
    const sess = await loadExpressSession("user_sessions", syaSid);
    if (sess && (sess.accessCode || sess.accountType || sess.authenticated)) {
      const key = sess.accessCode ?? sess.userId ?? syaSid;
      req.portalAuth = { type: "sya", identityKey: `sya:${key}` };
      next();
      return;
    }
  }

  // Acad: cookie 'acad.sid', table 'acad_user_sessions'
  const acadSid = getSessionCookieSid(req, "acad.sid", SESSION_SECRET);
  if (acadSid) {
    const sess = await loadExpressSession("acad_user_sessions", acadSid);
    if (sess?.acadUserId) {
      req.portalAuth = {
        type: "acad",
        identityKey: `acad:${sess.acadUserId}`,
      };
      next();
      return;
    }
  }

  // Accident: plain 'session_id' cookie, validated against access_code_usage
  const accidentSid = cookies["session_id"];
  if (accidentSid) {
    try {
      const result = await db.execute(sql`
        SELECT acu.access_code_id
        FROM access_code_usage acu
        WHERE acu.session_id = ${accidentSid}
          AND acu.used_at > NOW() - INTERVAL '7 days'
        LIMIT 1
      `);
      if (result.rows.length > 0) {
        const row = result.rows[0] as { access_code_id: number };
        req.portalAuth = {
          type: "accident",
          identityKey: `accident:${row.access_code_id}`,
        };
        next();
        return;
      }
    } catch {
      // Table may not exist — skip
    }
  }

  res
    .status(401)
    .json({
      error:
        "Authentication required. Please sign in to one of our portals to access case law.",
    });
}
