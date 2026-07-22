import { Router, type IRouter } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { accessCodesTable, usersTable } from "@workspace/db/sya";
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

// Owner master override. When MASTER_ACCESS_CODE is set, submitting it on the
// Access Code tab grants a synthetic admin session with full ("firm") access,
// independent of the database. Compared in constant time. Matching is
// case-insensitive because the Access Code field uppercases input client-side.
const MASTER_ACCESS_CODE = process.env.MASTER_ACCESS_CODE ?? "";
const MASTER_SESSION_USER_ID = -1;
const MASTER_MIN_LENGTH = 6;

if (MASTER_ACCESS_CODE && MASTER_ACCESS_CODE.trim().length < MASTER_MIN_LENGTH) {
  logger.warn(
    `MASTER_ACCESS_CODE is set but shorter than ${MASTER_MIN_LENGTH} characters; master override is disabled until a longer value is provided.`,
  );
}

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

function matchesMasterCode(submitted: string): boolean {
  if (
    !MASTER_ACCESS_CODE ||
    MASTER_ACCESS_CODE.trim().length < MASTER_MIN_LENGTH
  )
    return false;
  const a = createHash("sha256").update(normalizeCode(submitted)).digest();
  const b = createHash("sha256")
    .update(normalizeCode(MASTER_ACCESS_CODE))
    .digest();
  return timingSafeEqual(a, b);
}

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

  if (matchesMasterCode(parsed.data.accessCode)) {
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

  const bindErr = await codeLoginBindingError(parsed.data.accessCode);
  if (bindErr) {
    res.status(403).json({ error: bindErr });
    return;
  }

  const [user] = await db
    .select()
    .from(accessCodesTable)
    .where(eq(accessCodesTable.code, parsed.data.accessCode))
    .limit(1);

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
  const [user] = await db
    .select()
    .from(accessCodesTable)
    .where(eq(accessCodesTable.code, accessCode))
    .limit(1);

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid access code" });
    return false;
  }

  // Expired codes (e.g. manually-added subscribers past their plan) can't log in.
  if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
    res.status(401).json({ error: "Access code expired" });
    return false;
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
  const codeToUse = providedCode || (await getLinkedCode(email, "sya"));
  if (!codeToUse) {
    res.status(404).json({ authenticated: false, needsLink: true });
    return;
  }
  const bindErr = await ssoBindingError(email, codeToUse);
  if (bindErr) {
    res.status(403).json({ error: bindErr });
    return;
  }
  if (providedCode) {
    const claim = await saveLink(email, "sya", providedCode);
    if (!claim.ok) {
      res.status(403).json({
        error: `This access code is linked to a different Microsoft account (${maskEmail(claim.ownerEmail)}).`,
      });
      return;
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
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

export default router;
