import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import {
  getMasterAccessFingerprint,
  isMasterAccessCode,
  isMasterAccessCodeConfigured,
} from "../lib/masterAccess";
import { loginRateLimit } from "../lib/loginRateLimit";
import { requireAuth, requireStaff } from "../middlewares/requireAdmin";

const router: IRouter = Router();

const COOKIE_NAME = "landing_admin_master";
const COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

function hasCookieSigningSecret(): boolean {
  return process.env.NODE_ENV !== "production" || Boolean(process.env.SESSION_SECRET?.trim());
}

export function isLandingMasterSession(req: Request): boolean {
  if (!hasCookieSigningSecret()) return false;
  const fingerprint = getMasterAccessFingerprint();
  return Boolean(fingerprint && req.signedCookies?.[COOKIE_NAME] === fingerprint);
}

/**
 * Authenticate the landing command center with either:
 *   - the existing Clerk + staff allowlist path, or
 *   - the scoped signed master-admin cookie.
 *
 * This middleware is intentionally owned by the landing admin mount. It must
 * not be reused for editorial review or any practitioner portal.
 */
export function requireLandingAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isLandingMasterSession(req)) {
    next();
    return;
  }

  requireAuth(req, res, () => {
    void requireStaff(req, res, next);
  });
}

router.post("/login", loginRateLimit, (req: Request, res: Response): void => {
  if (!isMasterAccessCodeConfigured() || !hasCookieSigningSecret()) {
    res.status(503).json({ error: "Master admin access is not configured" });
    return;
  }

  const password = (req.body ?? {}) as { password?: unknown };
  if (!isMasterAccessCode(password.password)) {
    res.status(401).json({ error: "Invalid master admin credential" });
    return;
  }

  const fingerprint = getMasterAccessFingerprint();
  if (!fingerprint) {
    res.status(503).json({ error: "Master admin access is not configured" });
    return;
  }

  res.cookie(COOKIE_NAME, fingerprint, {
    signed: true,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
  res.json({ ok: true });
});

router.post("/logout", (_req: Request, res: Response): void => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

router.get("/session", (req: Request, res: Response): void => {
  res.json({ authenticated: isLandingMasterSession(req) });
});

export default router;