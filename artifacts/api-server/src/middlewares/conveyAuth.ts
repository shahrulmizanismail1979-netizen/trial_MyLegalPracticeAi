import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "../lib/auth";
import { hasTier, effectiveTier, type Tier } from "../lib/access";

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
        if (user && user.isActive) {
          req.userId = user.id;
          req.currentUser = user;
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
