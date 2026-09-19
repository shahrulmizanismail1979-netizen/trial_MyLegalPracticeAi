import crypto from "node:crypto";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, firmWorkspaceCredentialsTable } from "../db";
import { isManagerUser } from "./goalService";

/**
 * Server-verified manager session.
 *
 * The app intentionally has no per-user authentication: staff act anonymously
 * and identify themselves only by a client-supplied `actingUserId`, which is
 * NOT trustworthy. Privileged (manager-only) actions therefore cannot rely on
 * that field. Instead, the existing manager passcode gate is upgraded into a
 * real server-side session: a signed, httpOnly cookie that the browser cannot
 * read or forge. Privileged routes call `requireManagerSession(req)` which
 * verifies the cookie signature/expiry AND re-checks that the embedded user is
 * still a manager in the database.
 */

export const MANAGER_COOKIE = "fm_mgr";

/**
 * Staff session cookie. Staff log in with a single shared passcode (the app has
 * no per-user staff accounts), so this cookie carries no user id — it only
 * proves the holder knows the staff passcode. A valid staff OR manager session
 * is the primary authentication gate for every /api route.
 */
export const STAFF_COOKIE = "fm_staff";

// Sentinel uid encoded in the (user-less) shared staff session token.
const STAFF_SENTINEL = 0;

// 12-hour session lifetime.
const TTL_MS = 12 * 60 * 60 * 1000;

/**
 * Signing key for the session cookie. This must be a server-only secret and
 * must NOT be the API-gate secret (`TASKRADAR_API_SECRET`), which ships to the
 * client bundle by design. Preference order:
 *   1. `MANAGER_SESSION_SECRET` (explicit, recommended for production)
 *   2. HMAC-derived from `DATABASE_URL` (server-only, stable across restarts)
 *   3. A random per-process fallback (sessions reset on restart, dev only)
 */
function resolveSigningKey(): string {
  const explicit = process.env.MANAGER_SESSION_SECRET;
  if (explicit && explicit.length > 0) {
    return explicit;
  }
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && dbUrl.length > 0) {
    return crypto
      .createHmac("sha256", "mylawfirm-manager-session")
      .update(dbUrl)
      .digest("hex");
  }
  return crypto.randomBytes(32).toString("hex");
}

const SIGNING_KEY = resolveSigningKey();

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payload: string): string {
  return base64url(
    crypto.createHmac("sha256", SIGNING_KEY).update(payload).digest(),
  );
}

interface SessionPayload {
  uid: number;
  wid?: number;
  ver?: number;
  exp: number;
}

/** Produce a signed cookie value encoding the manager user id and expiry. */
export function signSession(uid: number, workspaceId = 0, credentialVersion?: number): string {
  const payload: SessionPayload = {
    uid,
    wid: workspaceId,
    ...(credentialVersion === undefined ? {} : { ver: credentialVersion }),
    exp: Date.now() + TTL_MS,
  };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/** Produce the pre-workspace token shape retained solely for owner compatibility. */
export function signLegacySession(uid: number): string {
  const payload: SessionPayload = { uid, exp: Date.now() + TTL_MS };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/**
 * Verify a raw cookie value. Returns the user id if the signature is valid and
 * the session has not expired, otherwise null. Uses a constant-time comparison
 * to avoid signature-timing leaks.
 */
export function verifySession(raw: string | undefined): number | null {
  return verifySessionIdentity(raw)?.userId ?? null;
}

export interface VerifiedFirmSession {
  userId: number;
  workspaceId: number;
  credentialVersion?: number;
}

/**
 * Verify a cookie and return its complete tenant-bound identity. Cookies issued
 * before workspace isolation did not contain `wid`; those owner-only sessions
 * are intentionally mapped to the legacy workspace 0.
 */
export function verifySessionIdentity(
  raw: string | undefined,
): VerifiedFirmSession | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = sign(body);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const json = Buffer.from(
      body.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const parsed = JSON.parse(json) as SessionPayload;
    if (
      typeof parsed.uid !== "number" ||
      typeof parsed.exp !== "number" ||
      (parsed.wid !== undefined && typeof parsed.wid !== "number") ||
      (parsed.ver !== undefined && typeof parsed.ver !== "number")
    ) {
      return null;
    }
    if (parsed.exp <= Date.now()) return null;
    return {
      userId: parsed.uid,
      workspaceId: parsed.wid ?? 0,
      credentialVersion: parsed.ver,
    };
  } catch {
    return null;
  }
}

const isProduction = process.env.NODE_ENV === "production";

export function setManagerCookie(
  res: Response,
  uid: number,
  workspaceId = 0,
  credentialVersion?: number,
): void {
  res.cookie(MANAGER_COOKIE, signSession(uid, workspaceId, credentialVersion), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/api/firm",
    maxAge: TTL_MS,
  });
}

export function clearManagerCookie(res: Response): void {
  res.clearCookie(MANAGER_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/api/firm",
  });
}

/**
 * Mint a staff session cookie. `codeId` is the firm_access_codes row id used
 * to log in, or 0 (STAFF_SENTINEL) for master-code / manager-granted sessions.
 * Encoding the code id lets the session gate re-check active/expiry status per
 * request, so a session cannot outlive a deactivated or expired code.
 */
export function setStaffCookie(
  res: Response,
  codeId: number = STAFF_SENTINEL,
  workspaceId: number = codeId,
): void {
  res.cookie(STAFF_COOKIE, signSession(codeId, workspaceId), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/api/firm",
    maxAge: TTL_MS,
  });
}

export function clearStaffCookie(res: Response): void {
  res.clearCookie(STAFF_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/api/firm",
  });
}

function readCookie(req: Request, name: string): string | undefined {
  const cookies = (req as Request & { cookies?: Record<string, string> })
    .cookies;
  const signedCookies = (
    req as Request & { signedCookies?: Record<string, string | false> }
  ).signedCookies;
  const signed = signedCookies?.[name];
  return typeof signed === "string" ? signed : cookies?.[name];
}

/**
 * True if the caller holds ANY valid session — a staff session OR a manager
 * session (managers are also staff). This is the global authentication gate
 * applied to every /api route; it replaces the client-embedded shared secret
 * (which ships in the browser bundle and is therefore not a real secret) as the
 * primary trust boundary.
 */
export function hasValidSession(req: Request): boolean {
  if (verifySession(readCookie(req, STAFF_COOKIE)) != null) return true;
  if (verifySession(readCookie(req, MANAGER_COOKIE)) != null) return true;
  return false;
}

/**
 * Resolve the verified manager id for a request, or null if the caller does
 * not hold a valid manager session. This is the single authorization primitive
 * used by every manager-only route: it verifies the signed cookie AND confirms
 * the user is still a manager in the database (so a demoted user's outstanding
 * cookie stops granting access).
 */
/**
 * Read the staff cookie's payload: the firm_access_codes row id it was minted
 * with (0 = master/manager sentinel), or null if absent/invalid/expired.
 * Used by the session gate to re-check code validity per request.
 */
export function staffSessionCodeId(req: Request): number | null {
  return verifySession(readCookie(req, STAFF_COOKIE));
}

export function staffSessionIdentity(req: Request): VerifiedFirmSession | null {
  return verifySessionIdentity(readCookie(req, STAFF_COOKIE));
}

export function managerSessionIdentity(req: Request): VerifiedFirmSession | null {
  return verifySessionIdentity(readCookie(req, MANAGER_COOKIE));
}

/**
 * Resolve the sole cookie-derived workspace. A request carrying valid cookies
 * for two different firms is rejected rather than selecting either tenant.
 */
export function requestFirmWorkspaceId(req: Request): number | null {
  const staff = staffSessionIdentity(req);
  const manager = managerSessionIdentity(req);
  if (staff && manager && staff.workspaceId !== manager.workspaceId) return null;
  return manager?.workspaceId ?? staff?.workspaceId ?? null;
}

export function hasMixedTenantCookies(req: Request): boolean {
  const staff = staffSessionIdentity(req);
  const manager = managerSessionIdentity(req);
  return Boolean(staff && manager && staff.workspaceId !== manager.workspaceId);
}

/** True if the caller holds a valid (signature+expiry) manager cookie. */
export function hasManagerCookie(req: Request): boolean {
  return managerSessionIdentity(req) != null;
}

export async function requireManagerSession(
  req: Request,
): Promise<number | null> {
  const raw = readCookie(req, MANAGER_COOKIE);
  const identity = verifySessionIdentity(raw);
  if (!identity || hasMixedTenantCookies(req)) return null;
  if (identity.workspaceId > 0) {
    if (identity.credentialVersion === undefined) return null;
    const [credential] = await db
      .select({ version: firmWorkspaceCredentialsTable.credentialVersion })
      .from(firmWorkspaceCredentialsTable)
      .where(eq(firmWorkspaceCredentialsTable.workspaceId, identity.workspaceId))
      .limit(1);
    if (!credential || credential.version !== identity.credentialVersion) return null;
  }
  const ok = await isManagerUser(identity.userId);
  return ok ? identity.userId : null;
}
