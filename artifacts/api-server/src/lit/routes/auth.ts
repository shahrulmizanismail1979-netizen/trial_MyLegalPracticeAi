import { loginRateLimit } from "../../lib/loginRateLimit";
import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db } from "@workspace/db";
import { litAccessCodes } from "@workspace/db";
import { eq } from "drizzle-orm";
import { claimSeat, releaseSeat, seatLimitMessage } from "../../lib/seatLimits";
import {
  verifyMsTicket,
  getLinkedCode,
  saveLink,
  ssoBindingError,
  codeLoginBindingError,
  maskEmail,
} from "../../microsoft";

const router: IRouter = Router();

// Fail-closed: if MASTER_ACCESS_CODE env var is not set, master login is disabled.
const MASTER_ACCESS_CODE = (process.env.MASTER_ACCESS_CODE ?? "").trim();

type LoginResult = { ok: boolean; status: number; body: Record<string, unknown> };

// Core access-code validation + session creation, shared by the normal login
// route and the Microsoft SSO exchange route.
async function loginWithCode(req: Request, rawCode: string): Promise<LoginResult> {
  const code = rawCode.trim().toUpperCase();

  if (MASTER_ACCESS_CODE && code === MASTER_ACCESS_CODE) {
    let [master] = await db
      .select()
      .from(litAccessCodes)
      .where(eq(litAccessCodes.code, MASTER_ACCESS_CODE))
      .limit(1);

    if (!master) {
      [master] = await db
        .insert(litAccessCodes)
        .values({
          code: MASTER_ACCESS_CODE,
          recipientName: "Master Override",
          recipientEmail: "master@mylitai.local",
          status: "active",
          compedAccess: true,
          notes: "Master overriding access — full access without payment.",
        })
        .returning();
    } else if (master.status !== "active" || !master.compedAccess) {
      [master] = await db
        .update(litAccessCodes)
        .set({ status: "active", compedAccess: true, expiresAt: null })
        .where(eq(litAccessCodes.id, master.id))
        .returning();
    }

    await db
      .update(litAccessCodes)
      .set({
        lastUsedAt: new Date(),
        usageCount: master.usageCount + 1,
      })
      .where(eq(litAccessCodes.id, master.id));

    const sess = req.session as unknown as Record<string, unknown>;
    sess.authenticated = true;
    sess.accessCodeId = master.id;

    return { ok: true, status: 200, body: { success: true, message: "Login successful" } };
  }

  const [record] = await db
    .select()
    .from(litAccessCodes)
    .where(eq(litAccessCodes.code, code))
    .limit(1);

  if (!record || record.status !== "active") {
    return { ok: false, status: 401, body: { error: "Invalid or expired access code" } };
  }

  if (record.expiresAt && record.expiresAt < new Date()) {
    await db
      .update(litAccessCodes)
      .set({ status: "expired" })
      .where(eq(litAccessCodes.id, record.id));
    return { ok: false, status: 401, body: { error: "Invalid or expired access code" } };
  }

  // Team-bundle seat limit: distinct concurrent sessions per code.
  if (record.maxSeats != null) {
    const claim = await claimSeat({
      portal: "lit",
      code: record.code,
      maxSeats: record.maxSeats,
      seatKey: req.sessionID,
    });
    if (!claim.ok) {
      return { ok: false, status: 409, body: { error: seatLimitMessage(claim.maxSeats) } };
    }
  }

  await db
    .update(litAccessCodes)
    .set({
      lastUsedAt: new Date(),
      usageCount: record.usageCount + 1,
    })
    .where(eq(litAccessCodes.id, record.id));

  const sess = req.session as unknown as Record<string, unknown>;
  sess.authenticated = true;
  sess.accessCodeId = record.id;

  return { ok: true, status: 200, body: { success: true, message: "Login successful" } };
}

router.post("/login", loginRateLimit, async (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Access code is required" });
  }

  try {
    const bindErr = await codeLoginBindingError(password);
    if (bindErr) {
      return res.status(403).json({ error: bindErr });
    }
    const result = await loginWithCode(req, password);
    return res.status(result.status).json(result.body);
  } catch (err) {
    req.log.error({ err }, "Login error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Microsoft SSO exchange: the portal posts the ticket from /auth/callback here.
// If the Microsoft email is already linked to an access code, log straight in.
// Otherwise the portal collects the access code once and posts it with the
// ticket to create the link.
router.post("/sso", loginRateLimit, async (req, res) => {
  const { ticket, code } = (req.body ?? {}) as { ticket?: string; code?: string };
  if (!ticket || typeof ticket !== "string") {
    return res.status(400).json({ error: "Ticket is required" });
  }

  // Both MyLitAI ("lit") and MyLitAI IRAC ("lit-irac") share this session, so
  // accept tickets issued for either app and keep links scoped per app.
  let app = "lit";
  let email = verifyMsTicket(ticket, "lit");
  if (!email) {
    app = "lit-irac";
    email = verifyMsTicket(ticket, "lit-irac");
  }
  if (!email) {
    return res.status(401).json({ error: "Your Microsoft sign-in expired. Please try again." });
  }

  try {
    const providedCode = typeof code === "string" ? code.trim() : "";
    const codeToUse = providedCode || (await getLinkedCode(email, app));
    if (!codeToUse) {
      return res.status(404).json({ needsLink: true });
    }

    const bindErr = await ssoBindingError(email, codeToUse);
    if (bindErr) {
      return res.status(403).json({ error: bindErr });
    }

    if (providedCode) {
      const claim = await saveLink(email, app, providedCode.toUpperCase());
      if (!claim.ok) {
        return res.status(403).json({
          error: `This access code is linked to a different Microsoft account (${maskEmail(claim.ownerEmail)}).`,
        });
      }
    }
    const result = await loginWithCode(req, codeToUse);
    return res.status(result.status).json(result.body);
  } catch (err) {
    req.log.error({ err }, "SSO exchange error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/verify", async (req, res) => {
  const sess = req.session as unknown as Record<string, unknown>;
  const authenticated = sess?.authenticated === true;
  const accessCodeId = sess?.accessCodeId as number | undefined;

  if (!authenticated || !accessCodeId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const [record] = await db
      .select()
      .from(litAccessCodes)
      .where(eq(litAccessCodes.id, accessCodeId))
      .limit(1);

    if (!record || record.status !== "active") {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Access code revoked or expired" });
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      await db
        .update(litAccessCodes)
        .set({ status: "expired" })
        .where(eq(litAccessCodes.id, record.id));
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Access code expired" });
    }

    // Refresh (or fail-closed re-check) this session's seat on every
    // authenticated request so active devices never age out of the 24h
    // inactivity TTL, and a session whose seat was lost stops working.
    if (record.maxSeats != null) {
      const claim = await claimSeat({
        portal: "lit",
        code: record.code,
        maxSeats: record.maxSeats,
        seatKey: req.sessionID,
      });
      if (!claim.ok) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: seatLimitMessage(claim.maxSeats) });
      }
    }

    return res.json({ authenticated: true });
  } catch (err) {
    req.log.error({ err }, "Verify error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (req, res) => {
  void releaseSeat("lit", req.sessionID);
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

/**
 * Express middleware that enforces Lit session authentication and binds the
 * caller's access code ID to res.locals.litAccessCodeId for downstream use
 * (Task #21 — subscriber chat isolation).
 *
 * Re-checks the DB on every request (portal-expiry-enforcement: sessions and
 * JWTs may outlive access codes, so expiry must be verified per-request).
 */
export async function requireLitAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sess = req.session as unknown as Record<string, unknown>;
  const authenticated = sess?.authenticated === true;
  const accessCodeId = sess?.accessCodeId as number | undefined;

  if (!authenticated || !accessCodeId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (await validateLitSession(req, res, accessCodeId)) next();
}

/**
 * Router-level gate for ALL lit routes: any request carrying an
 * authenticated code session gets the same per-request revocation/expiry/
 * seat checks as requireLitAuth, no matter which route it hits. Requests
 * without an authenticated session pass through untouched (public routes
 * and per-route auth keep working).
 */
export async function litSessionGate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sess = req.session as unknown as Record<string, unknown>;
  const authenticated = sess?.authenticated === true;
  const accessCodeId = sess?.accessCodeId as number | undefined;
  if (!authenticated || !accessCodeId) {
    next();
    return;
  }
  if (await validateLitSession(req, res, accessCodeId)) next();
}

/**
 * Shared per-request session validation: code must exist, be active and
 * unexpired, and (for capped team-bundle codes) this session must hold a
 * seat — the claim doubles as an activity refresh so active sessions never
 * age out of the inactivity TTL. Sends the error response and returns false
 * on failure.
 */
async function validateLitSession(
  req: Request,
  res: Response,
  accessCodeId: number,
): Promise<boolean> {
  try {
    const [record] = await db
      .select()
      .from(litAccessCodes)
      .where(eq(litAccessCodes.id, accessCodeId))
      .limit(1);

    if (!record || record.status !== "active") {
      req.session.destroy(() => {});
      res.status(401).json({ error: "Access code revoked or expired" });
      return false;
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      await db
        .update(litAccessCodes)
        .set({ status: "expired" })
        .where(eq(litAccessCodes.id, record.id));
      req.session.destroy(() => {});
      res.status(401).json({ error: "Access code expired" });
      return false;
    }

    // Refresh (or fail-closed re-check) this session's seat on every
    // authenticated request so active devices never age out of the 24h
    // inactivity TTL, and a session whose seat was lost stops working.
    if (record.maxSeats != null) {
      const claim = await claimSeat({
        portal: "lit",
        code: record.code,
        maxSeats: record.maxSeats,
        seatKey: req.sessionID,
      });
      if (!claim.ok) {
        req.session.destroy(() => {});
        res.status(401).json({ error: seatLimitMessage(claim.maxSeats) });
        return false;
      }
    }

    res.locals["litAccessCodeId"] = accessCodeId;
    return true;
  } catch (err) {
    req.log?.error({ err }, "lit session validation failed");
    res.status(500).json({ error: "Internal server error" });
  }
  return false;
}

export default router;
