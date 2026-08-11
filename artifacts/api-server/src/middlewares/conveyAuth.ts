import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable, subscribersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyToken } from "../lib/auth";
import { logger } from "../lib/logger";
import { hasTier, effectiveTier, type Tier } from "../lib/access";
import { claimSeat, deviceSeatKey } from "../lib/seatLimits";

/**
 * Convey users have no expiry column of their own — their access lifetime is
 * governed by the landing-page subscription that issued the access code. This
 * checks the subscribers table for the code's latest expiry. Codes without a
 * matching subscriber row (legacy imports, admin-created, master) never expire
 * here.
 */
export async function isConveyCodeExpired(accessCode: string | null): Promise<boolean> {
  if (!accessCode) return false;
  try {
    const [sub] = await db
      .select({ expiry: subscribersTable.subscriptionExpiry })
      .from(subscribersTable)
      .where(eq(subscribersTable.accessCode, accessCode))
      .orderBy(desc(subscribersTable.subscriptionExpiry))
      .limit(1);
    if (!sub || !sub.expiry) return false;
    return new Date(sub.expiry).getTime() < Date.now();
  } catch (e) {
    // Fail closed: if we cannot verify the subscription is still valid,
    // deny access rather than silently granting expired users entry.
    logger.error({ err: e, accessCode }, "convey expiry lookup failed — denying access");
    return true;
  }
}

/** Parses the Bearer token (if any) and attaches the live user record. */
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  req.userId = null;
  req.currentUser = null;
  const header = req.headers["authorization"];
  const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    const uid = verifyToken(token);
    if (uid != null) {
      try {
        const rows = await db.select().from(usersTable).where(eq(usersTable.id, uid));
        const user = rows[0];
        if (user && user.isActive && !(await isConveyCodeExpired(user.accessCode))) {
          // Refresh this device's seat on every request; a device whose seat
          // is gone (and cannot re-claim within the licensed count) is
          // treated as unauthenticated (fail closed).
          let seatOk = true;
          if (user.accessCode && user.maxSeats != null) {
            const claim = await claimSeat({
              portal: "convey",
              code: user.accessCode,
              maxSeats: user.maxSeats,
              seatKey: deviceSeatKey(req),
            });
            seatOk = claim.ok;
          }
          if (seatOk) {
            req.userId = user.id;
            req.currentUser = user;
          }
        }
      } catch (e) {
        req.log?.error({ err: e }, "attachUser lookup failed");
      }
    }
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.currentUser) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireTier(min: Tier) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.currentUser) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!hasTier(req.currentUser, min)) {
      res.status(402).json({
        error: "upgrade_required",
        requiredTier: min,
        currentTier: effectiveTier(req.currentUser),
      });
      return;
    }
    next();
  };
}
