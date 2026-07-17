import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { accessCodesTable } from "@workspace/db/sya";
import { tierHasFeature, type FeatureKey } from "./tiers";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) return false;
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(password, salt, 64)) as Buffer;
  if (hashedBuf.length !== suppliedBuf.length) return false;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

/**
 * For access-code sessions, re-check the code's expiry on every request so
 * an existing session stops working once the code expires. Destroys the
 * session and responds 401 when expired; returns false in that case.
 * Best-effort: DB errors don't block the request.
 */
export async function ensureCodeNotExpired(req: Request, res: Response): Promise<boolean> {
  if (req.session.accountType !== "code" || !req.session.accessCode) return true;
  try {
    const [row] = await db
      .select({ expiresAt: accessCodesTable.expiresAt })
      .from(accessCodesTable)
      .where(eq(accessCodesTable.code, req.session.accessCode))
      .limit(1);
    if (row?.expiresAt && new Date(row.expiresAt) < new Date()) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "Access code expired" });
      return false;
    }
  } catch {
    // Best-effort — don't block requests on a transient DB error.
  }
  return true;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!(await ensureCodeNotExpired(req, res))) return;
  next();
}

export function requireFeature(feature: FeatureKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.session.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!(await ensureCodeNotExpired(req, res))) return;
    const tier = req.session.userTier ?? "starter";
    if (!tierHasFeature(tier, feature)) {
      res.status(402).json({
        error: "upgrade_required",
        feature,
        currentTier: tier,
        message: "This feature is not included in your current plan.",
      });
      return;
    }
    next();
  };
}
