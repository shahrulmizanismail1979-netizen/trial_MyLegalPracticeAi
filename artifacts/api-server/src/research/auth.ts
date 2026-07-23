import type { Request, Response, NextFunction } from "express";
import { db, researchUsers, type ResearchRole } from "@workspace/db";
import { eq } from "drizzle-orm";

// Research-role resolution (Phase 02). Runs AFTER the existing staff gate
// (requireAuth + requireStaff), which already guarantees an authenticated
// Clerk session with an allowlisted staff email on req.authEmail. This
// middleware resolves the staff member's research role from research_users.
// Staff without a research_users row (or an inactive row) act as read-only
// `guest` — deny-by-default is preserved because guest can only view
// unrestricted material.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      researchRole?: ResearchRole;
      researchUserId?: number | null;
    }
  }
}

export async function resolveResearchRole(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const email = req.authEmail?.trim().toLowerCase();
  if (!email) {
    // requireStaff must have run; without an email we fail closed.
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const [user] = await db
      .select()
      .from(researchUsers)
      .where(eq(researchUsers.email, email));
    if (user && user.active) {
      req.researchRole = user.role;
      req.researchUserId = user.id;
    } else {
      req.researchRole = "guest";
      req.researchUserId = null;
    }
    next();
  } catch (error) {
    req.log.error({ err: error }, "Failed to resolve research role");
    res.status(500).json({ error: "Failed to resolve research role" });
  }
}

/** Require one of the given research roles (deny-by-default). */
export function requireResearchRole(...roles: ResearchRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.researchRole;
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: "Forbidden", role: role ?? null });
      return;
    }
    next();
  };
}
