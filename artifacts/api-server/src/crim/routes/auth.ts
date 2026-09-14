import { Router, type IRouter, type Request, type Response } from "express";
import { loginRateLimit } from "../../lib/loginRateLimit";
import { db, crimAccessCodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  findActiveCode,
  claimCode,
  releaseCode,
  isSessionStale,
} from "../lib/accessCodes";
import { entitlementsFor, effectiveTier, isGrandfathered } from "@workspace/entitlements";
import { isSubscriptionActive } from "../lib/subscriptionStatus";
import { claimSeat, releaseSeat, seatLimitMessage } from "../../lib/seatLimits";
import {
  verifyMsTicket,
  getLinkedCode,
  saveLink,
  ssoBindingError,
  codeLoginBindingError,
  maskEmail,
} from "../../microsoft";
import { isMasterAccessCode } from "../../lib/masterAccess";

// Legacy support is opt-in. Never ship a usable credential in production.
const LEGACY_ACCESS_CODE = process.env.ACCESS_CODE?.trim() || null;

const router: IRouter = Router();

router.post("/auth/verify", loginRateLimit, async (req, res): Promise<void> => {
  const accessCode = (req.body?.accessCode ?? "").toString().trim();
  if (!accessCode) {
    res.status(400).json({ authenticated: false, message: "Access code is required." });
    return;
  }
  const bindErr = await codeLoginBindingError(accessCode);
  if (bindErr) {
    res.status(403).json({ authenticated: false, message: bindErr });
    return;
  }
  await verifyCodeAndLogin(req, res, accessCode);
});

// Microsoft SSO exchange: log in with the access code linked to the Microsoft
// email in the ticket, or link a newly provided code.
router.post("/auth/sso", loginRateLimit, async (req, res): Promise<void> => {
  const { ticket, code } = (req.body ?? {}) as { ticket?: string; code?: string };
  if (!ticket || typeof ticket !== "string") {
    res.status(400).json({ authenticated: false, message: "Ticket is required." });
    return;
  }
  const email = verifyMsTicket(ticket, "crim");
  if (!email) {
    res.status(401).json({
      authenticated: false,
      message: "Your Microsoft sign-in expired. Please try again.",
    });
    return;
  }
  const providedCode = typeof code === "string" ? code.trim() : "";
  const codeToUse = providedCode || (await getLinkedCode(email, "crim"));
  if (!codeToUse) {
    res.status(404).json({ authenticated: false, needsLink: true });
    return;
  }
  const bindErr = await ssoBindingError(email, codeToUse);
  if (bindErr) {
    res.status(403).json({ authenticated: false, message: bindErr });
    return;
  }
  if (providedCode) {
    if (!isMasterAccessCode(providedCode)) {
      const claim = await saveLink(email, "crim", providedCode);
      if (!claim.ok) {
        res.status(403).json({
          authenticated: false,
          message: `This access code is linked to a different Microsoft account (${maskEmail(claim.ownerEmail)}).`,
        });
        return;
      }
    }
  }
  await verifyCodeAndLogin(req, res, codeToUse, async () => {});
});

async function verifyCodeAndLogin(
  req: Request,
  res: Response,
  accessCode: string,
  onSuccess?: () => Promise<void>,
): Promise<void> {
  const ensureSession = (): Promise<void> =>
    new Promise((resolve, reject) => {
      req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });

  // Master override: unrestricted full access on any device, no DB row, no
  // single-session lock, no expiry, no subscription checks.
  if (isMasterAccessCode(accessCode)) {
    try {
      await ensureSession();
    } catch (err) {
      req.log.error({ err }, "Failed to regenerate session");
      res.status(500).json({ authenticated: false, message: "Session error." });
      return;
    }
    (req.session as any).isMaster = true;
    (req.session as any).authenticated = true;
    if (onSuccess) await onSuccess();
    res.json({
      authenticated: true,
      message: "Access granted",
      tier: "full",
      entitlements: entitlementsFor("full"),
    });
    return;
  }

  // Look up code in DB
  let row = await findActiveCode(accessCode);

  // Legacy fallback: if matches env ACCESS_CODE and not yet in DB, create it
  if (!row && LEGACY_ACCESS_CODE && accessCode === LEGACY_ACCESS_CODE) {
    const [created] = await db
      .insert(crimAccessCodesTable)
      .values({ code: accessCode, label: "Legacy access code", isActive: true })
      .returning();
    row = created;
  }

  if (!row || !row.isActive) {
    res.status(401).json({ authenticated: false, message: "Invalid access code." });
    return;
  }

  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    res.status(401).json({ authenticated: false, message: "This access code has expired. Please contact your administrator." });
    return;
  }

  // Subscription lapse: a Stripe-backed code is only valid while its
  // subscription is active. Grandfathered codes (issued before the cutoff) are
  // unrestricted for life and are never blocked by a lapsed subscription.
  if (
    !isGrandfathered(row.createdAt) &&
    !(await isSubscriptionActive(row.stripeSubscriptionId))
  ) {
    res.status(401).json({
      authenticated: false,
      message:
        "Your subscription is no longer active. Please renew to regain access.",
    });
    return;
  }

  // Seat enforcement. Team-bundle codes (maxSeats > 1) allow up to the
  // licensed number of concurrent sessions via the shared seat registry;
  // other codes keep the original single-session lock.
  const multiSeat = row.maxSeats != null && row.maxSeats > 1;
  if (!multiSeat) {
    // Single-session enforcement
    if (
      row.currentSessionId &&
      row.currentSessionId !== req.sessionID &&
      !isSessionStale(row.lastSeenAt)
    ) {
      res.status(409).json({
        authenticated: false,
        message:
          "This access code is currently in use on another device. Please log out from the other device first, or contact your administrator.",
      });
      return;
    }
  }

  try {
    await ensureSession();
  } catch (err) {
    req.log.error({ err }, "Failed to regenerate session");
    res.status(500).json({ authenticated: false, message: "Session error." });
    return;
  }

  if (multiSeat) {
    const claim = await claimSeat({
      portal: "crim",
      code: row.code,
      maxSeats: row.maxSeats,
      seatKey: req.sessionID,
    });
    if (!claim.ok) {
      res.status(409).json({ authenticated: false, message: seatLimitMessage(claim.maxSeats) });
      return;
    }
  } else {
    await claimCode(row.id, req.sessionID);
  }
  (req.session as any).accessCodeId = row.id;
  (req.session as any).authenticated = true;

  if (onSuccess) await onSuccess();

  const tier = effectiveTier(row.tier, row.createdAt);
  res.json({
    authenticated: true,
    message: "Access granted",
    tier,
    entitlements: entitlementsFor(tier),
  });
}

router.get("/auth/session", async (req, res): Promise<void> => {
  const codeId = (req.session as any)?.accessCodeId;
  const isAdmin = !!(req.session as any)?.isAdmin;

  // Master override session: always full access.
  if ((req.session as any)?.isMaster) {
    res.json({
      authenticated: true,
      isAdmin,
      tier: "full",
      entitlements: entitlementsFor("full"),
    });
    return;
  }

  if (!codeId) {
    res.json({ authenticated: false, isAdmin });
    return;
  }

  const [row] = await db
    .select()
    .from(crimAccessCodesTable)
    .where(eq(crimAccessCodesTable.id, codeId));

  const valid =
    !!row &&
    row.isActive &&
    (row.maxSeats != null && row.maxSeats > 1
      ? true // multi-seat codes are validated via the seat registry in requireAuth
      : row.currentSessionId === req.sessionID);

  if (!valid) {
    res.json({ authenticated: false, isAdmin });
    return;
  }

  if (
    !isGrandfathered(row!.createdAt) &&
    !(await isSubscriptionActive(row!.stripeSubscriptionId))
  ) {
    res.json({ authenticated: false, isAdmin });
    return;
  }

  const tier = effectiveTier(row!.tier, row!.createdAt);
  res.json({
    authenticated: true,
    isAdmin,
    tier,
    entitlements: entitlementsFor(tier),
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const codeId = (req.session as any)?.accessCodeId;
  if (codeId) {
    try {
      const [row] = await db
        .select()
        .from(crimAccessCodesTable)
        .where(eq(crimAccessCodesTable.id, codeId));
      if (row && row.maxSeats != null && row.maxSeats > 1) {
        await releaseSeat("crim", req.sessionID);
      } else {
        await releaseCode(codeId);
      }
    } catch (err) {
      req.log.error({ err }, "Failed to release access code");
    }
  }
  req.session.destroy((err) => {
    if (err) req.log.error({ err }, "Session destroy failed");
    res.json({ message: "Logged out successfully" });
  });
});

export default router;
