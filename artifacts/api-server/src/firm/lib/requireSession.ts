import type { Request, Response, NextFunction } from "express";

/**
 * Middleware that requires a valid signed session cookie (`taskradar_sid`).
 *
 * The cookie is issued by POST /api/session only after the server verifies
 * that `actingUserId` maps to a real DB user.  It is signed with SERVER_TOKEN
 * (via cookie-parser), HttpOnly, and SameSite=Strict, so it cannot be forged
 * client-side or sent from cross-site browser contexts.
 *
 * The cookie value is the verified userId.  If the request body also contains
 * `actingUserId`, it must match the session's userId — preventing a session
 * holder from acting as a different user on these expensive AI routes.
 *
 * Apply to all AI-backed endpoints to gate unauthenticated external callers.
 */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const sid = req.signedCookies?.taskradar_sid;
  if (!sid) {
    res.status(401).json({
      error: "Session required. Please select a user profile and try again.",
    });
    return;
  }

  const sessionUserId = parseInt(sid, 10);
  if (isNaN(sessionUserId) || sessionUserId <= 0) {
    res.status(401).json({ error: "Invalid session. Please reload the application." });
    return;
  }

  // If the request declares an actingUserId, it must match the authenticated
  // session — a session for user A cannot act as user B on AI routes.
  const bodyUserId = req.body?.actingUserId;
  if (bodyUserId != null) {
    const claimed = typeof bodyUserId === "number" ? bodyUserId : parseInt(bodyUserId, 10);
    if (claimed !== sessionUserId) {
      res.status(403).json({
        error: "User identity does not match the current session.",
      });
      return;
    }
  }

  next();
}
