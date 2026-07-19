import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod/v4";
import { isKnownUser } from "../lib/goalService";
import { APP_KEY_REQUIRED, validateAppKey } from "../lib/appKey";

const router: IRouter = Router();

/**
 * Rate-limit session creation: 20 per 15 minutes per IP.
 * Normal use is 1 session per page load / identity switch.
 */
const sessionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many session requests. Please try again shortly." },
});

const SessionBody = z.object({
  actingUserId: z.number().int().positive(),
  appKey: z.string().optional(),
});

/**
 * Establish a signed session cookie that binds this browser session to a
 * verified DB user.
 *
 * Two-layer verification:
 *  1. App key   — if TASKRADAR_APP_KEY is configured, the caller must supply
 *                 a matching value.  This is a server-verified credential not
 *                 discoverable from any API endpoint.  Without it, 403 is
 *                 returned with { requiresAppKey: true } so the frontend can
 *                 prompt the user to enter the key.
 *  2. User ID   — actingUserId is looked up in the database; unknown IDs are
 *                 rejected with 403.
 *
 * The resulting cookie is:
 *   - Signed with SERVER_TOKEN (server-side secret, never sent to the client)
 *   - HttpOnly   — cannot be read by JS; safe from XSS
 *   - SameSite=Strict — not sent on cross-site browser requests; blocks CSRF
 *   - Path=/api  — scoped to the API only
 *
 * The cookie embeds the verified userId so requireSession can cross-check the
 * actingUserId field on subsequent AI requests.
 */
router.post("/session", sessionRateLimit, async (req, res): Promise<void> => {
  const parsed = SessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "actingUserId (integer) is required." });
    return;
  }
  const { actingUserId, appKey } = parsed.data;

  // Check the app key first (avoids leaking whether a userId is valid)
  if (!validateAppKey(appKey)) {
    res.status(403).json({
      error: APP_KEY_REQUIRED
        ? "Invalid or missing access code."
        : "Access denied.",
      requiresAppKey: APP_KEY_REQUIRED,
    });
    return;
  }

  if (!(await isKnownUser(actingUserId))) {
    res.status(403).json({ error: "Unknown user." });
    return;
  }

  res.cookie("taskradar_sid", String(actingUserId), {
    signed: true,
    httpOnly: true,
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
    path: "/api",
  });
  res.status(204).end();
});

/**
 * Lightweight capability check: tells the frontend whether an app key is
 * required so it can prompt the user before the first AI session attempt.
 */
router.get("/session-info", (_req, res) => {
  res.json({ requiresAppKey: APP_KEY_REQUIRED });
});

export default router;
