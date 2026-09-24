import { Router, type IRouter, type Response } from "express";
import { loginRateLimit } from "../lib/loginRateLimit";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { accessCodesTable, accessCodeUsageTable } from "@workspace/db/schema";
import {
  AccidentVerifyCodeBody,
  AccidentVerifyCodeResponse,
  AccidentCheckSessionResponse,
  AccidentLogoutResponse,
} from "@workspace/api-zod";
import crypto from "crypto";
import { logger } from "../lib/logger";
import { allocateAccidentSession, touchAccidentUsage } from "../accident/seats";
import {
  verifyMsTicket,
  getLinkedCode,
  saveLink,
  ssoBindingError,
  codeLoginBindingError,
  maskEmail,
} from "../microsoft";
import {
  getMasterAccessFingerprint,
  isMasterAccessCode,
} from "../lib/masterAccess";

const router: IRouter = Router();

// Fail closed in production: a predictable HMAC secret would let anyone forge
// master session tokens.
const MASTER_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_SECRET = (() => {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return "dev-secret-change-me";
})();

const MASTER_LABEL = "Master Access";

function signMasterNonce(
  nonce: string,
  issuedAt: number,
  masterFingerprint: string,
): string {
  return crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(`master:${nonce}:${issuedAt}:${masterFingerprint}`)
    .digest("hex");
}

export function createMasterToken(): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const issuedAt = Date.now();
  const masterFingerprint = getMasterAccessFingerprint() ?? "";
  return `master.${nonce}.${issuedAt}.${masterFingerprint}.${signMasterNonce(nonce, issuedAt, masterFingerprint)}`;
}

export function isMasterToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "master") return false;
  const issuedAt = Number(parts[2]);
  const currentFingerprint = getMasterAccessFingerprint();
  if (
    !Number.isSafeInteger(issuedAt) ||
    issuedAt > Date.now() ||
    Date.now() - issuedAt > MASTER_TOKEN_TTL_MS ||
    !currentFingerprint ||
    parts[3] !== currentFingerprint
  ) {
    return false;
  }
  const expected = signMasterNonce(parts[1]!, issuedAt, parts[3]!);
  const provided = Buffer.from(parts[4]!);
  const valid = Buffer.from(expected);
  return provided.length === valid.length && crypto.timingSafeEqual(provided, valid);
}

function setSessionCookies(res: Response, sessionId: string, label: string): void {
  res.cookie("session_id", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  res.cookie("code_label", label, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

// Shared by the normal access-code login and the Microsoft SSO exchange.
async function verifyCodeAndStartSession(res: Response, rawCode: string): Promise<boolean> {
  const submittedCode = rawCode.trim();
  const code = submittedCode.toUpperCase();

  if (isMasterAccessCode(submittedCode)) {
    const masterToken = createMasterToken();
    setSessionCookies(res, masterToken, MASTER_LABEL);
    res.json(
      AccidentVerifyCodeResponse.parse({
        valid: true,
        message: "Master access granted",
        sessionId: masterToken,
      }),
    );
    return true;
  }

  const [accessCode] = await db
    .select()
    .from(accessCodesTable)
    .where(and(eq(accessCodesTable.code, code), eq(accessCodesTable.isActive, true)));

  if (!accessCode) {
    res.status(401).json({ error: "Invalid access code" });
    return false;
  }

  if (accessCode.expiresAt && new Date(accessCode.expiresAt) < new Date()) {
    res.status(401).json({ error: "This access code has expired" });
    return false;
  }

  // Atomic seat allocation (stale cleanup → capacity check → insert under a
  // per-code advisory lock), so concurrent logins can never exceed maxUsers.
  const seat = await allocateAccidentSession({
    accessCodeId: accessCode.id,
    maxUsers: accessCode.maxUsers,
  });
  if (!seat.ok) {
    res.status(401).json({ error: "This access code has reached its maximum number of users" });
    return false;
  }
  const sessionId = seat.sessionId;

  setSessionCookies(res, sessionId, accessCode.label);

  res.json(
    AccidentVerifyCodeResponse.parse({
      valid: true,
      message: "Access granted",
      sessionId,
    }),
  );
  return true;
}

router.post("/auth/verify-code", loginRateLimit, async (req, res): Promise<void> => {
  const parsed = AccidentVerifyCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const bindErr = await codeLoginBindingError(parsed.data.code);
  if (bindErr) {
    res.status(403).json({ error: bindErr });
    return;
  }
  await verifyCodeAndStartSession(res, parsed.data.code);
});

// Microsoft SSO exchange: log in with the access code linked to the Microsoft
// email in the ticket, or link a newly provided code.
router.post("/auth/sso", loginRateLimit, async (req, res): Promise<void> => {
  const { ticket, code } = (req.body ?? {}) as { ticket?: string; code?: string };
  if (!ticket || typeof ticket !== "string") {
    res.status(400).json({ error: "Ticket is required" });
    return;
  }
  const email = verifyMsTicket(ticket, "accident");
  if (!email) {
    res.status(401).json({ error: "Your Microsoft sign-in expired. Please try again." });
    return;
  }
  const providedCode = typeof code === "string" ? code.trim() : "";
  const codeToUse = providedCode || (await getLinkedCode(email, "accident"));
  if (!codeToUse) {
    res.status(404).json({ needsLink: true });
    return;
  }
  res.locals.portalSignInCode = codeToUse;
  const bindErr = await ssoBindingError(email, codeToUse);
  if (bindErr) {
    res.status(403).json({ error: bindErr });
    return;
  }
  if (providedCode && !isMasterAccessCode(providedCode)) {
    const claim = await saveLink(email, "accident", providedCode.toUpperCase());
    if (!claim.ok) {
      res.status(403).json({
        error: `This access code is linked to a different Microsoft account (${maskEmail(claim.ownerEmail)}).`,
      });
      return;
    }
  }
  await verifyCodeAndStartSession(res, codeToUse);
});

router.get("/auth/check-session", async (req, res): Promise<void> => {
  const sessionId = req.cookies?.session_id;

  if (!sessionId) {
    res.json(AccidentCheckSessionResponse.parse({ authenticated: false, codeLabel: null }));
    return;
  }

  if (isMasterToken(sessionId)) {
    res.json(AccidentCheckSessionResponse.parse({ authenticated: true, codeLabel: MASTER_LABEL }));
    return;
  }

  const [usage] = await db
    .select()
    .from(accessCodeUsageTable)
    .where(eq(accessCodeUsageTable.sessionId, sessionId));

  if (!usage) {
    res.json(AccidentCheckSessionResponse.parse({ authenticated: false, codeLabel: null }));
    return;
  }

  // Keep actively used sessions inside the inactivity TTL.
  void touchAccidentUsage(sessionId);

  const [code] = await db
    .select()
    .from(accessCodesTable)
    .where(eq(accessCodesTable.id, usage.accessCodeId));

  res.json(
    AccidentCheckSessionResponse.parse({
      authenticated: true,
      codeLabel: code?.label || null,
    }),
  );
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const sessionId = req.cookies?.session_id;
  if (sessionId && !isMasterToken(sessionId)) {
    const [usage] = await db
      .select()
      .from(accessCodeUsageTable)
      .where(eq(accessCodeUsageTable.sessionId, sessionId));
    if (usage) {
      await db.delete(accessCodeUsageTable).where(eq(accessCodeUsageTable.sessionId, sessionId));
      await db
        .update(accessCodesTable)
        .set({ currentUsers: sql`GREATEST(${accessCodesTable.currentUsers} - 1, 0)` })
        .where(eq(accessCodesTable.id, usage.accessCodeId));
    }
  }
  res.clearCookie("session_id", { path: "/" });
  res.clearCookie("code_label", { path: "/" });
  res.json(AccidentLogoutResponse.parse({ message: "Logged out successfully" }));
});

export default router;
