import { claimSeat, releaseSeat, seatLimitMessage } from "../../../lib/seatLimits";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscribersTable } from "@workspace/db";
import { accessCodesTable, usersTable } from "@workspace/db/sya";
import { syncSyaAccessCode, licensedSeatCap } from "../../../lib/provisioning";
import { VerifyAccessCodeBody } from "../../lib/schemas";
import { hashPassword, verifyPassword } from "../../lib/auth";
import { effectiveTier, isWithinGrandfatherWindow } from "../../lib/grandfather";
import { logger } from "../../../lib/logger";
import {
  verifyMsTicket,
  getLinkedCode,
  saveLink,
  ssoBindingError,
  codeLoginBindingError,
  maskEmail,
} from "../../../microsoft";
import { isMasterAccessCode } from "../../../lib/masterAccess";

const MASTER_SESSION_USER_ID = -1;

// Lightweight in-memory brute-force guard for the access-code endpoint. A single
// global master credential makes this a higher-value target, so failed attempts
// are throttled per client IP.
const MAX_VERIFY_ATTEMPTS = 10;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;
const verifyAttempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const rec = verifyAttempts.get(ip);
  if (!rec || Date.now() > rec.resetAt) return false;
  return rec.count >= MAX_VERIFY_ATTEMPTS;
}

function recordVerifyFailure(ip: string): void {
  const now = Date.now();
  const rec = verifyAttempts.get(ip);
  if (!rec || now > rec.resetAt) {
    verifyAttempts.set(ip, { count: 1, resetAt: now + VERIFY_WINDOW_MS });
  } else {
    rec.count += 1;
  }
}

function clearVerifyAttempts(ip: string): void {
  verifyAttempts.delete(ip);
}

/**
 * Self-healing fallback: if a submitted code isn't (or is no longer) valid in
 * sya_access_codes but belongs to a confirmed, unexpired landing-page
 * subscriber whose plan covers MySyalitAI (or whose apps list is empty —
 * legacy subscribers created before per-app tracking), sync it into
 * sya_access_codes on the spot and return the fresh row. Fixes users who
 * paid but whose code was never propagated to this portal.
 */
export async function recoverCodeFromSubscribers(
  code: string,
): Promise<typeof accessCodesTable.$inferSelect | null> {
  try {
    const [sub] = await db
      .select()
      .from(subscribersTable)
      .where(eq(subscribersTable.accessCode, code))
      .limit(1);
    if (!sub) return null;
    if (sub.paymentStatus !== "confirmed") return null;
    if (sub.subscriptionExpiry && new Date(sub.subscriptionExpiry) < new Date())
      return null;
    const apps = sub.apps ?? [];
    if (apps.length > 0 && !apps.includes("MySyalitAI")) return null;

    await syncSyaAccessCode({
      accessCode: code,
      name: sub.name,
      expiresAt: sub.subscriptionExpiry ?? null,
      // Team bundles must keep their licensed seat cap even when the portal
      // row is re-created at login (recovery must never mint an uncapped row).
      maxSeats: licensedSeatCap(sub),
    });
    logger.info(
      { accessCode: code },
      "Recovered MySyalitAI access code from subscribers table at login",
    );
    const [row] = await db
      .select()
      .from(accessCodesTable)
      .where(eq(accessCodesTable.code, code))
      .limit(1);
    return row ?? null;
  } catch (err) {
    logger.error({ err }, "MySyalitAI access-code recovery failed");
    return null;
  }
}

// For Microsoft SSO self-healing: when the linked code is dead (a legacy code
// from the donor app that no longer exists anywhere), fall back to the
// subscriber record in the admin dashboard matched by email. Returns the
// subscriber's current access code when they have active MySyalitAI access.
async function findSubscriberCodeByEmail(
  email: string,
): Promise<string | null> {
  try {
    const rows = await db
      .select()
      .from(subscribersTable)
      .where(eq(subscribersTable.email, email.toLowerCase()));
    for (const sub of rows) {
      if (!sub.accessCode) continue;
      if (sub.paymentStatus !== "confirmed") continue;
      if (
        sub.subscriptionExpiry &&
        new Date(sub.subscriptionExpiry) < new Date()
      )
        continue;
      const apps = sub.apps ?? [];
      if (apps.length > 0 && !apps.includes("MySyalitAI")) continue;
      return sub.accessCode;
    }
    return null;
  } catch (err) {
    logger.error({ err }, "MySyalitAI subscriber-by-email lookup failed");
    return null;
  }
}

// True when the code either has a usable sya_access_codes row already or can
// be recovered from the subscribers table (recovery inserts the row).
async function isCodeUsableOrRecoverable(code: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(accessCodesTable)
    .where(eq(accessCodesTable.code, code))
    .limit(1);
  if (isUsableCodeRow(row)) return true;
  return (await recoverCodeFromSubscribers(code)) !== null;
}

function isUsableCodeRow(
  row: typeof accessCodesTable.$inferSelect | null | undefined,
): row is typeof accessCodesTable.$inferSelect {
  if (!row || !row.isActive) return false;
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return false;
  return true;
}

declare module "express-session" {
  interface SessionData {
    userId?: number;
    userName?: string;
    userRole?: string;
    accessCode?: string;
    userTier?: string;
    userEmail?: string;
    accountType?: "code" | "email";
  }
}

const router: IRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sessionUserPayload(req: {
  session: import("express-session").SessionData;
}) {
  return {
    id: req.session.userId,
    name: req.session.userName,
    role: req.session.userRole,
    tier: req.session.userTier ?? "starter",
    email: req.session.userEmail,
    accountType: req.session.accountType ?? "code",
    accessCode: req.session.accessCode,
  };
}

router.post("/auth/verify", async (req, res): Promise<void> => {
  const ip = req.ip ?? "unknown";
  if (isRateLimited(ip)) {
    res
      .status(429)
      .json({ error: "Too many attempts. Please try again later." });
    return;
  }

  const parsed = VerifyAccessCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const submittedCode = parsed.data.accessCode.trim();
  if (isMasterAccessCode(submittedCode)) {
    clearVerifyAttempts(ip);
    req.session.userId = MASTER_SESSION_USER_ID;
    req.session.userName = "Owner";
    req.session.userRole = "admin";
    req.session.accessCode = "master";
    req.session.userTier = "firm";
    req.session.accountType = "code";
    req.session.userEmail = undefined;
    res.json({ authenticated: true, user: sessionUserPayload(req) });
    return;
  }

  // "master" is reserved for the internal owner session marker below; it is
  // never a subscriber access code, even if a legacy row was seeded with it.
  if (submittedCode.toLowerCase() === "master") {
    recordVerifyFailure(ip);
    res.status(401).json({ error: "Invalid access code" });
    return;
  }

  // Subscriber codes are case-insensitive; normalize only after the
  // case-sensitive owner credential check above.
  const subscriberCode = submittedCode.toUpperCase();
  const bindErr = await codeLoginBindingError(subscriberCode);
  if (bindErr) {
    res.status(403).json({ error: bindErr });
    return;
  }

  let [user] = await db
    .select()
    .from(accessCodesTable)
    .where(eq(accessCodesTable.code, subscriberCode))
    .limit(1);

  // Self-heal codes that were paid for on the landing page but never synced
  // (or whose expiry was extended by a renewal) before rejecting.
  if (!isUsableCodeRow(user)) {
    const recovered = await recoverCodeFromSubscribers(subscriberCode);
    if (recovered) user = recovered;
  }

  if (!user || !user.isActive) {
    recordVerifyFailure(ip);
    res.status(401).json({ error: "Invalid access code" });
    return;
  }

  // Expired codes (e.g. manually-added subscribers past their plan) can't log in.
  if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
    recordVerifyFailure(ip);
    res.status(401).json({ error: "Access code expired" });
    return;
  }

  // Team-bundle seat limit: distinct concurrent sessions per code.
  if (user.maxSeats != null) {
    const claim = await claimSeat({
      portal: "sya",
      code: user.code,
      maxSeats: user.maxSeats,
      seatKey: req.sessionID,
    });
    if (!claim.ok) {
      res.status(409).json({ error: seatLimitMessage(claim.maxSeats) });
      return;
    }
  }

  clearVerifyAttempts(ip);

  await db
    .update(accessCodesTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(accessCodesTable.id, user.id));

  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userRole = user.role;
  req.session.accessCode = user.code;
  // Access-code holders are trusted internal users with full access.
  req.session.userTier = "firm";
  req.session.accountType = "code";
  req.session.userEmail = undefined;

  res.json({ authenticated: true, user: sessionUserPayload(req) });
});

// Grant a firm-tier session for a valid access code. Returns true on success;
// otherwise writes the error response and returns false.
async function loginWithAccessCode(
  req: import("express").Request,
  res: import("express").Response,
  accessCode: string,
): Promise<boolean> {
  const submittedCode = accessCode.trim();
  if (isMasterAccessCode(submittedCode)) {
    req.session.userId = MASTER_SESSION_USER_ID;
    req.session.userName = "Owner";
    req.session.userRole = "admin";
    req.session.accessCode = "master";
    req.session.userTier = "firm";
    req.session.accountType = "code";
    req.session.userEmail = undefined;
    res.json({ authenticated: true, user: sessionUserPayload(req) });
    return true;
  }

  const subscriberCode = submittedCode.toUpperCase();
  let [user] = await db
    .select()
    .from(accessCodesTable)
    .where(eq(accessCodesTable.code, subscriberCode))
    .limit(1);

  if (!isUsableCodeRow(user)) {
    const recovered = await recoverCodeFromSubscribers(subscriberCode);
    if (recovered) user = recovered;
  }

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid access code" });
    return false;
  }

  // Expired codes (e.g. manually-added subscribers past their plan) can't log in.
  if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
    res.status(401).json({ error: "Access code expired" });
    return false;
  }

  // Team-bundle seat limit: distinct concurrent sessions per code.
  if (user.maxSeats != null) {
    const claim = await claimSeat({
      portal: "sya",
      code: user.code,
      maxSeats: user.maxSeats,
      seatKey: req.sessionID,
    });
    if (!claim.ok) {
      res.status(409).json({ error: seatLimitMessage(claim.maxSeats) });
      return false;
    }
  }

  await db
    .update(accessCodesTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(accessCodesTable.id, user.id));

  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userRole = user.role;
  req.session.accessCode = user.code;
  // Access-code holders are trusted internal users with full access.
  req.session.userTier = "firm";
  req.session.accountType = "code";
  req.session.userEmail = undefined;

  res.json({ authenticated: true, user: sessionUserPayload(req) });
  return true;
}

// Microsoft SSO exchange: log in with the access code linked to the Microsoft
// email in the ticket, or link a newly provided code.
router.post("/auth/sso", async (req, res): Promise<void> => {
  const { ticket, code } = (req.body ?? {}) as {
    ticket?: string;
    code?: string;
  };
  if (!ticket || typeof ticket !== "string") {
    res.status(400).json({ error: "Ticket is required." });
    return;
  }
  const email = verifyMsTicket(ticket, "sya");
  if (!email) {
    res.status(401).json({
      error: "Your Microsoft sign-in expired. Please try again.",
    });
    return;
  }
  const providedCode = typeof code === "string" ? code.trim() : "";
  let codeToUse = providedCode || (await getLinkedCode(email, "sya"));
  const masterCode = isMasterAccessCode(codeToUse);
  if (!masterCode && codeToUse) {
    // Normalize subscriber codes server-side, but preserve the submitted
    // spelling until after the case-sensitive master check above.
    codeToUse = codeToUse.trim().toUpperCase();
  }

  // Self-heal a stale link: if the linked code is dead (e.g. a legacy code
  // from before the admin dashboard existed), fall back to the subscriber
  // record matched by email and re-link to their current access code.
  if (
    !providedCode &&
    !masterCode &&
    codeToUse &&
    !(await isCodeUsableOrRecoverable(codeToUse))
  ) {
    const replacement = await findSubscriberCodeByEmail(email);
    if (replacement && replacement !== codeToUse) {
      const claim = await saveLink(email, "sya", replacement);
      if (claim.ok) {
        logger.info(
          { email: maskEmail(email) },
          "Re-linked Microsoft account to current subscriber access code",
        );
        codeToUse = replacement;
      }
    }
  }

  if (!codeToUse) {
    res.status(404).json({ authenticated: false, needsLink: true });
    return;
  }
  res.locals.portalSignInCode = codeToUse;
  const bindErr = await ssoBindingError(email, codeToUse);
  if (bindErr) {
    res.status(403).json({ error: bindErr });
    return;
  }
  if (providedCode) {
    if (!isMasterAccessCode(providedCode)) {
      const claim = await saveLink(email, "sya", codeToUse);
      if (!claim.ok) {
        res.status(403).json({
          error: `This access code is linked to a different Microsoft account (${maskEmail(claim.ownerEmail)}).`,
        });
        return;
      }
    }
  }
  await loginWithAccessCode(req, res, codeToUse);
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, name } = (req.body ?? {}) as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  if (!name || name.trim().length < 1) {
    res.status(400).json({ error: "Your name is required." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  const passwordHash = await hashPassword(password);

  // Early adopters who sign up on or before the launch cutoff get full access
  // for life; the subscription paywall only applies to later sign-ups.
  const grandfathered = isWithinGrandfatherWindow();

  const [user] = await db
    .insert(usersTable)
    .values({
      email: normalizedEmail,
      passwordHash,
      name: name.trim(),
      role: "practitioner",
      tier: "starter",
      grandfathered,
      lastLoginAt: new Date(),
    })
    .returning();

  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userRole = user.role;
  req.session.userTier = effectiveTier(user);
  req.session.userEmail = user.email;
  req.session.accountType = "email";
  req.session.accessCode = undefined;

  res.json({ authenticated: true, user: sessionUserPayload(req) });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = (req.body ?? {}) as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  await db
    .update(usersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(usersTable.id, user.id));

  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userRole = user.role;
  req.session.userTier = effectiveTier(user);
  req.session.userEmail = user.email;
  req.session.accountType = "email";
  req.session.accessCode = undefined;

  res.json({ authenticated: true, user: sessionUserPayload(req) });
});

router.get("/auth/session", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ authenticated: false });
    return;
  }

  // Refresh tier from DB for email accounts so subscription changes apply live.
  // Grandfathered early adopters always resolve to full access.
  if (req.session.accountType === "email") {
    const [user] = await db
      .select({
        tier: usersTable.tier,
        grandfathered: usersTable.grandfathered,
      })
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId))
      .limit(1);
    if (user) {
      req.session.userTier = effectiveTier(user);
    }
  }

  res.json({ authenticated: true, user: sessionUserPayload(req) });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  void releaseSeat("sya", req.sessionID);
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

export default router;
