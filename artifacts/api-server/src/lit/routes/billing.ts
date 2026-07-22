import {
  Router,
  type IRouter,
  type Request,
} from "express";
import { db } from "@workspace/db";
import { litAccessCodes } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

function sessionAccessCodeId(req: Request): number | undefined {
  const sess = req.session as unknown as Record<string, unknown> | undefined;
  if (!sess || sess.authenticated !== true) return undefined;
  return sess.accessCodeId as number | undefined;
}

export interface SubscriptionState {
  active: boolean;
  comped: boolean;
  status: string | null;
  hasCustomer: boolean;
}

// Subscriptions are sold on the landing page; a valid access code IS the
// subscription. Any active, unexpired access code grants full access — there
// is no separate in-portal Stripe paywall. Status and expiry are re-checked
// on every request because sessions can outlive a revoked/expired code.
export async function getSubscriptionState(
  accessCodeId: number,
): Promise<SubscriptionState> {
  const [row] = await db
    .select()
    .from(litAccessCodes)
    .where(eq(litAccessCodes.id, accessCodeId))
    .limit(1);

  if (!row) {
    return { active: false, comped: false, status: null, hasCustomer: false };
  }
  if (row.compedAccess) {
    return { active: true, comped: true, status: "comped", hasCustomer: !!row.stripeCustomerId };
  }
  if (row.status !== "active") {
    return { active: false, comped: false, status: row.status ?? null, hasCustomer: !!row.stripeCustomerId };
  }
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
    return { active: false, comped: false, status: "expired", hasCustomer: !!row.stripeCustomerId };
  }
  return { active: true, comped: false, status: "active", hasCustomer: !!row.stripeCustomerId };
}

// Returns subscription/access status for the currently logged-in user.
router.get("/status", async (req, res) => {
  const accessCodeId = sessionAccessCodeId(req);
  if (!accessCodeId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const state = await getSubscriptionState(accessCodeId);
    res.json(state);
  } catch {
    res.status(500).json({ error: "Could not check subscription status" });
  }
});

// Redirects to landing page for subscription management.
router.post("/provision", (_req, res) => {
  res.redirect(302, "/#pricing");
});

router.post("/portal", (_req, res) => {
  res.redirect(302, "/#pricing");
});

export default router;

// Middleware: require an active (or comped) subscription. Sets req.accessCodeId.
export async function requireSubscription(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): Promise<void> {
  const accessCodeId = sessionAccessCodeId(req);
  if (!accessCodeId) {
    res.status(401).json({ error: "Login required" });
    return;
  }
  try {
    const state = await getSubscriptionState(accessCodeId);
    if (!state.active) {
      res.status(402).json({
        error: "An active subscription is required to use this feature.",
        code: "subscription_required",
      });
      return;
    }
    (req as import("express").Request & { accessCodeId: number }).accessCodeId = accessCodeId;
    next();
  } catch {
    res.status(500).json({ error: "Subscription check failed" });
  }
}
