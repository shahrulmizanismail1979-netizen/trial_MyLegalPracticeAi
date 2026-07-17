import type { Request, Response, NextFunction } from "express";
import { db, corpAccessCodes, corpSessions } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { effectiveTierForCode } from "./access";

export async function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const [row] = await db
      .select({ session: corpSessions, code: corpAccessCodes })
      .from(corpSessions)
      .innerJoin(corpAccessCodes, eq(corpSessions.accessCodeId, corpAccessCodes.id))
      .where(and(eq(corpSessions.sessionToken, token), eq(corpSessions.isActive, true)));

    if (!row) {
      res.status(401).json({ error: "Session expired or invalid" });
      return;
    }
    // Cut off existing sessions once the access code itself has expired.
    if (row.code.expiresAt && new Date(row.code.expiresAt) < new Date()) {
      res.status(401).json({ error: "Access code expired" });
      return;
    }
    res.locals.accessTier = effectiveTierForCode(row.code);
    res.locals.accessCodeId = row.code.id;
    next();
  } catch {
    res.status(500).json({ error: "Auth check failed" });
  }
}
