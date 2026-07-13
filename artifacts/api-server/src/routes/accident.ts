import { Router, type IRouter, type Response } from "express";
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

const router: IRouter = Router();

// Fail closed in production: without a MASTER_ACCESS_CODE secret the master
// override login is disabled entirely. The insecure default only exists for
// local development and tests.
const IS_PROD = process.env.NODE_ENV === "production";
const MASTER_ACCESS_CODE: string | null =
  process.env.MASTER_ACCESS_CODE || (IS_PROD ? null : "240680");

if (!MASTER_ACCESS_CODE) {
  logger.warn(
    "MASTER_ACCESS_CODE is not set — MyAccidentAI master override login is disabled",
  );
}

// Fail closed in production: a predictable HMAC secret would let anyone forge
// master session tokens.
const SESSION_SECRET = (() => {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return fromEnv;
  if (IS_PROD) {
    throw new Error("SESSION_SECRET is required in production");
  }
  return "dev-secret-change-me";
})();

const MASTER_LABEL = "Master Access";

function signMasterNonce(nonce: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(`master:${nonce}`).digest("hex");
}

function createMasterToken(): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  return `master.${nonce}.${signMasterNonce(nonce)}`;
}

export function isMasterToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "master") return false;
  const expected = signMasterNonce(parts[1]!);
  const provided = Buffer.from(parts[2]!);
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

router.post("/auth/verify-code", async (req, res): Promise<void> => {
  const parsed = AccidentVerifyCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const code = parsed.data.code.trim().toUpperCase();

  if (
    MASTER_ACCESS_CODE &&
    (parsed.data.code.trim() === MASTER_ACCESS_CODE ||
      code === MASTER_ACCESS_CODE.trim().toUpperCase())
  ) {
    const masterToken = createMasterToken();
    setSessionCookies(res, masterToken, MASTER_LABEL);
    res.json(
      AccidentVerifyCodeResponse.parse({
        valid: true,
        message: "Master access granted",
        sessionId: masterToken,
      }),
    );
    return;
  }

  const [accessCode] = await db
    .select()
    .from(accessCodesTable)
    .where(and(eq(accessCodesTable.code, code), eq(accessCodesTable.isActive, true)));

  if (!accessCode) {
    res.status(401).json({ error: "Invalid access code" });
    return;
  }

  if (accessCode.expiresAt && new Date(accessCode.expiresAt) < new Date()) {
    res.status(401).json({ error: "This access code has expired" });
    return;
  }

  if (accessCode.currentUsers >= accessCode.maxUsers) {
    res.status(401).json({ error: "This access code has reached its maximum number of users" });
    return;
  }

  const sessionId = crypto.randomUUID();

  await db.insert(accessCodeUsageTable).values({
    accessCodeId: accessCode.id,
    sessionId,
  });

  await db
    .update(accessCodesTable)
    .set({ currentUsers: sql`${accessCodesTable.currentUsers} + 1` })
    .where(eq(accessCodesTable.id, accessCode.id));

  setSessionCookies(res, sessionId, accessCode.label);

  res.json(
    AccidentVerifyCodeResponse.parse({
      valid: true,
      message: "Access granted",
      sessionId,
    }),
  );
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
