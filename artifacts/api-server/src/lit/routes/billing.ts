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

const GRANDFATHER_CUTOFF = new Date("2026-06-08T00:00:00+08:00");

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
  if (row.createdAt && new Date(row.createdAt) < GRANDFATHER_CUTOFF) {
    return { active: true, comped: true, status: "grandfathered", hasCustomer: !!row.stripeCustomerId };
  }
  if (!row.stripeCustomerId) {
    return { active: false, comped: false, status: null, hasCustomer: false };
  }
  try {
    const result = await db.execute(
      sql`SELECT s.status
          FROM stripe.subscriptions s
          JOIN stripe.subscription_items si ON si.subscription = s.id
          JOIN stripe.prices pr ON pr.id = si.price
          JOIN stripe.products p ON p.id = pr.product
          WHERE s.customer = ${row.stripeCustomerId}
            AND s.status IN ('active', 'trialing')
            AND p.metadata->>'mylitai_premium' = 'true'
          ORDER BY s.created DESC
          LIMIT 1`,
    );
    const sub = (result as unknown as { rows: Array<{ status: string }> }).rows?.[0];
    return { active: !!sub, comped: false, status: sub?.status ?? null, hasCustomer: true };
  } catch {
    return { active: false, comped: false, status: null, hasCustomer: true };
  }
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
