import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, accessCodeUsageTable } from "@workspace/db";
import { SEAT_TTL_MS } from "../lib/seatLimits";
import { isMasterToken } from "../routes/accident";
import { touchAccidentUsage } from "./seats";

/**
 * Per-request session guard for MyAccidentAI product routes (AI chat etc.).
 * The session must exist in access_code_usage and be inside the inactivity
 * TTL — a session that was displaced (row deleted by stale cleanup) or has
 * been idle past the TTL stops working immediately. Valid requests refresh
 * the session's activity so active users never age out.
 */
export async function requireAccidentSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sessionId: string | undefined = req.cookies?.session_id;
  if (!sessionId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (isMasterToken(sessionId)) {
    next();
    return;
  }
  const check = await validateAccidentSession(sessionId, req);
  if (!check.ok) {
    res.status(401).json({ error: check.error });
    return;
  }
  // Expose the resolved access-code id so the AI rate-limit key generator
  // can key per-subscriber rather than falling back to __noauth__.
  // Master sessions have no DB row; leave the field absent so the limiter
  // uses its __noauth__ bucket (master sessions are admin-only, not subscriber).
  if (check.accessCodeId != null) {
    res.locals["accidentAccessCodeId"] = check.accessCodeId;
  }
  next();
}

/**
 * Shared session validation: the usage row must exist and be inside the
 * inactivity TTL (idle rows are deleted so the seat is freed). Valid
 * sessions are refreshed. Fails CLOSED on DB errors so a registry outage
 * can never bypass the licensed cap.
 */
export async function validateAccidentSession(
  sessionId: string,
  req?: Request,
): Promise<{ ok: true; accessCodeId: number } | { ok: false; error: string }> {
  try {
    const [usage] = await db
      .select()
      .from(accessCodeUsageTable)
      .where(eq(accessCodeUsageTable.sessionId, sessionId));
    if (!usage) {
      return { ok: false, error: "Session expired. Please log in again." };
    }
    if (usage.usedAt.getTime() < Date.now() - SEAT_TTL_MS) {
      // Idle past the TTL: free the seat and force a fresh login.
      await db.delete(accessCodeUsageTable).where(eq(accessCodeUsageTable.id, usage.id));
      return { ok: false, error: "Session expired. Please log in again." };
    }
    void touchAccidentUsage(sessionId);
    return { ok: true, accessCodeId: usage.accessCodeId };
  } catch (err) {
    req?.log?.error({ err }, "accident session check failed — denying request");
    return { ok: false, error: "Could not verify session. Please try again." };
  }
}
