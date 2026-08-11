import { Router, type IRouter, type Response } from "express";
import { loginRateLimit } from "../../lib/loginRateLimit";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, ccbAccessCodes } from "@workspace/db";
import { claimSeat, deviceSeatKey, seatLimitMessage } from "../../lib/seatLimits";
import {
  verifyMsTicket,
  getLinkedCode,
  saveLink,
  ssoBindingError,
  codeLoginBindingError,
  maskEmail,
} from "../../microsoft";

const router: IRouter = Router();

// Fail closed in production: a predictable JWT signing secret would let
// anyone forge tokens. The dev fallback only exists for local development.
const SECRET = (() => {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return "dev-secret-change-me";
})();

const MASTER_CODE = process.env.MASTER_ACCESS_CODE ?? "";
const ENV_CODES = process.env.CCB_ACCESS_CODES
  ? process.env.CCB_ACCESS_CODES.split(",")
  : ["CCBLIT2024", "MYCCBLIT", "UKM2024", "PRACTITIONER"];

const STATIC_CODES = [MASTER_CODE, ...ENV_CODES]
  .map((c) => c.trim().toUpperCase())
  .filter((c) => c.length > 0);

const VerifyAccessCodeBody = z.object({ code: z.string().min(1) });

/**
 * Per-request guard for practitioner routes: verifies the Bearer JWT, then
 * re-checks the access code against the DB so a deactivated or expired code
 * is cut off immediately — even if the 7-day token is still valid.
 * Static/env codes have no DB row and are always allowed.
 */
export async function requirePractitioner(
  req: import("express").Request,
  res: Response,
  next: import("express").NextFunction,
): Promise<void> {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  let payload: { role?: string; code?: string };
  try {
    payload = jwt.verify(token, SECRET) as { role?: string; code?: string };
  } catch {
    res.status(401).json({ error: "Session expired or invalid" });
    return;
  }
  if (payload.role !== "practitioner" && payload.role !== "admin") {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const code = (payload.code ?? "").trim().toUpperCase();
  // Task #21: resolve access code to a DB row ID so the gemini routes can
  // isolate conversations per subscriber. Static/admin codes resolve to null
  // (no per-subscriber restriction).
  let resolvedAccessCodeId: number | null = null;
  if (code && !STATIC_CODES.includes(code)) {
    let row: typeof ccbAccessCodes.$inferSelect | undefined;
    let lookupFailed = false;
    try {
      const rows = await db.select().from(ccbAccessCodes).where(eq(ccbAccessCodes.code, code));
      row = rows[0];
    } catch {
      // Best-effort on the plain code lookup only — a transient DB error
      // here doesn't block the request (pre-existing behavior).
      lookupFailed = true;
    }
    if (!lookupFailed) {
      if (!row || !row.active) {
        res.status(401).json({ error: "Access code no longer active" });
        return;
      }
      if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
        res.status(401).json({ error: "Access code expired" });
        return;
      }
      resolvedAccessCodeId = row.id;
      // Refresh this device's seat on every request (keeps active devices
      // inside the 24h TTL). Fails CLOSED for capped codes: both a lost seat
      // and a seat-registry error deny the request, so the licensed cap can
      // never be bypassed during an outage.
      if (row.maxSeats != null) {
        let claim: Awaited<ReturnType<typeof claimSeat>>;
        try {
          claim = await claimSeat({
            portal: "ccb",
            code,
            maxSeats: row.maxSeats,
            seatKey: deviceSeatKey(req),
          });
        } catch (err) {
          req.log?.error({ err }, "ccb seat refresh failed — denying request");
          res.status(401).json({ error: "Could not verify seat availability. Please try again." });
          return;
        }
        if (!claim.ok) {
          res.status(401).json({ error: seatLimitMessage(claim.maxSeats) });
          return;
        }
      }
    }
  }
  res.locals["ccbAccessCodeId"] = resolvedAccessCodeId;
  next();
}

// Shared by the normal access-code login and the Microsoft SSO exchange.
async function verifyCodeAndIssueToken(
  req: import("express").Request,
  res: Response,
  rawCode: string,
): Promise<boolean> {
  const code = rawCode.trim().toUpperCase();

  let valid = STATIC_CODES.includes(code);
  let dbCodeId: number | null = null;

  if (!valid) {
    const rows = await db.select().from(ccbAccessCodes).where(eq(ccbAccessCodes.code, code));
    const row = rows[0];
    if (row && row.active) {
      // Expired codes (e.g. manually-added subscribers past their plan) can't log in.
      if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
        res.status(401).json({ error: "Access code expired" });
        return false;
      }
      // Team-bundle seat limit: distinct concurrent devices per code. The
      // JWT has no server-side session, so the seat is keyed by a device
      // fingerprint and expires after inactivity.
      if (row.maxSeats != null) {
        const claim = await claimSeat({
          portal: "ccb",
          code: row.code,
          maxSeats: row.maxSeats,
          seatKey: deviceSeatKey(req),
        });
        if (!claim.ok) {
          res.status(409).json({ error: seatLimitMessage(claim.maxSeats) });
          return false;
        }
      }
      valid = true;
      dbCodeId = row.id;
    }
  }

  if (!valid) {
    res.status(401).json({ error: "Invalid access code" });
    return false;
  }

  if (dbCodeId !== null) {
    await db
      .update(ccbAccessCodes)
      .set({ lastUsedAt: new Date() })
      .where(eq(ccbAccessCodes.id, dbCodeId));
  }

  const token = jwt.sign({ role: "practitioner", code }, SECRET, { expiresIn: "7d" });
  res.json({ success: true, token });
  return true;
}

router.post("/auth/verify", loginRateLimit, async (req, res): Promise<void> => {
  const parsed = VerifyAccessCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const bindErr = await codeLoginBindingError(parsed.data.code);
  if (bindErr) {
    res.status(403).json({ error: bindErr });
    return;
  }
  await verifyCodeAndIssueToken(req, res, parsed.data.code);
});

// Microsoft SSO exchange: log in with the access code linked to the Microsoft
// email in the ticket, or link a newly provided code.
router.post("/auth/sso", loginRateLimit, async (req, res): Promise<void> => {
  const { ticket, code } = (req.body ?? {}) as { ticket?: string; code?: string };
  if (!ticket || typeof ticket !== "string") {
    res.status(400).json({ error: "Ticket is required" });
    return;
  }
  const email = verifyMsTicket(ticket, "ccb");
  if (!email) {
    res.status(401).json({ error: "Your Microsoft sign-in expired. Please try again." });
    return;
  }
  const providedCode = typeof code === "string" ? code.trim() : "";
  const codeToUse = providedCode || (await getLinkedCode(email, "ccb"));
  if (!codeToUse) {
    res.status(404).json({ needsLink: true });
    return;
  }
  const bindErr = await ssoBindingError(email, codeToUse);
  if (bindErr) {
    res.status(403).json({ error: bindErr });
    return;
  }
  if (providedCode) {
    const claim = await saveLink(email, "ccb", providedCode.toUpperCase());
    if (!claim.ok) {
      res.status(403).json({
        error: `This access code is linked to a different Microsoft account (${maskEmail(claim.ownerEmail)}).`,
      });
      return;
    }
  }
  await verifyCodeAndIssueToken(req, res, codeToUse);
});

export default router;
