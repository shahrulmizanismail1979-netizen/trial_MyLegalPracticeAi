import { Request, Response, NextFunction } from "express";
import { db, crimAccessCodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { touchCode } from "../lib/accessCodes";
import { isSubscriptionActive } from "../lib/subscriptionStatus";
import { isGrandfathered } from "@workspace/entitlements";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = req.session as any;
  if (!session?.authenticated) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // Master override session: unrestricted full access, no DB row required.
  if (session.isMaster) {
    res.locals.accessCode = { tier: "full", createdAt: null };
    next();
    return;
  }
  const codeId = session.accessCodeId;
  if (!codeId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(crimAccessCodesTable)
      .where(eq(crimAccessCodesTable.id, codeId));
    if (!row || !row.isActive || row.currentSessionId !== req.sessionID) {
      res.status(401).json({
        error: "Session ended. Your access code may have been used elsewhere or revoked.",
      });
      return;
    }
    // Revoke access mid-session if the backing Stripe subscription has lapsed.
    // Fails open (legacy/admin codes, unsynced rows) — only an explicitly
    // lapsed/canceled subscription blocks here. Grandfathered codes (issued
    // before the cutoff) are unrestricted for life and never lapse.
    if (
      !isGrandfathered(row.createdAt) &&
      !(await isSubscriptionActive(row.stripeSubscriptionId))
    ) {
      res.status(402).json({
        error: "subscription_inactive",
        message:
          "Your subscription is no longer active. Please renew to continue using MyCrimAi.",
      });
      return;
    }
    // Expose the authenticated access code to downstream middleware (entitlements)
    res.locals.accessCode = row;
    // Async, don't await
    touchCode(codeId).catch(() => {});
    next();
  } catch (err) {
    res.status(500).json({ error: "Auth check failed" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const session = req.session as any;
  if (!session?.isAdmin) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}
