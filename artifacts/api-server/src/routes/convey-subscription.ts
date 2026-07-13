import { Router, type IRouter } from "express";
import type Stripe from "stripe";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/conveyAuth";
import { getUncachableStripeClient } from "../stripeClient";
import { CURRENCIES, type Currency, type Interval, type Tier } from "../lib/access";

const router: IRouter = Router();

function isPaidTier(t: unknown): t is Exclude<Tier, "free"> {
  return t === "student" || t === "practitioner" || t === "firm";
}
function isInterval(i: unknown): i is Interval {
  return i === "month" || i === "year";
}
function isCurrency(c: unknown): c is Currency {
  return typeof c === "string" && (CURRENCIES as readonly string[]).includes(c);
}

async function ensureCustomer(stripe: Stripe, userId: number): Promise<string> {
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const user = rows[0];
  if (user?.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create({
    name: user?.displayName,
    email: user?.email ?? undefined,
    metadata: { userId: String(userId), email: user?.email ?? "" },
  });
  await db.update(usersTable).set({ stripeCustomerId: customer.id }).where(eq(usersTable.id, userId));
  return customer.id;
}

// Resolve the real Stripe price ID for a tier+interval via its lookup_key
// (set by the seed-products script). Each price carries currency_options for
// all supported currencies, so one price ID serves every currency.
async function resolvePriceId(
  stripe: Stripe,
  tier: Exclude<Tier, "free">,
  interval: Interval,
): Promise<string | null> {
  const key = `${tier}_${interval}`;
  const list = await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 });
  return list.data[0]?.id ?? null;
}

// Create a Stripe Checkout session for a subscription.
router.post("/convey/checkout", requireAuth, async (req, res) => {
  const user = req.currentUser!;
  const { tier, interval, currency, successUrl, cancelUrl } = (req.body ?? {}) as {
    tier?: string;
    interval?: string;
    currency?: string;
    successUrl?: string;
    cancelUrl?: string;
  };

  if (!isPaidTier(tier) || !isInterval(interval) || !isCurrency(currency)) {
    res.status(400).json({ error: "Invalid tier, interval, or currency." });
    return;
  }
  if (!successUrl || !cancelUrl) {
    res.status(400).json({ error: "Missing success/cancel URL." });
    return;
  }

  try {
    const stripe = await getUncachableStripeClient();

    const priceId = await resolvePriceId(stripe, tier, interval);
    if (!priceId) {
      req.log.error({ tier, interval }, "No Stripe price found — run seed-products");
      res.status(503).json({ error: "Plans are not yet available. Please try again later." });
      return;
    }

    const customerId = await ensureCustomer(stripe, user.id);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: String(user.id),
      // The price carries currency_options for every supported currency; setting
      // the session currency selects the right one.
      currency,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { userId: String(user.id), tier },
      },
      metadata: { userId: String(user.id), tier },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });
  } catch (e) {
    req.log.error({ err: e }, "Checkout session creation failed");
    res.status(502).json({ error: "Could not start checkout. Please try again." });
  }
});

// Open the Stripe customer billing portal (manage / cancel subscription).
router.post("/convey/portal", requireAuth, async (req, res) => {
  const user = req.currentUser!;
  const { returnUrl } = (req.body ?? {}) as { returnUrl?: string };
  if (!user.stripeCustomerId) {
    res.status(400).json({ error: "No billing account yet." });
    return;
  }
  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl || undefined,
    });
    res.json({ url: session.url });
  } catch (e) {
    req.log.error({ err: e }, "Billing portal session failed");
    res.status(502).json({ error: "Could not open billing portal." });
  }
});

// Sync subscription state from a completed Checkout session (used on success
// redirect so access activates immediately, even before the webhook arrives).
router.post("/convey/billing-sync", requireAuth, async (req, res) => {
  const user = req.currentUser!;
  const { sessionId } = (req.body ?? {}) as { sessionId?: string };
  if (!sessionId) {
    res.status(400).json({ error: "Missing sessionId." });
    return;
  }
  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.client_reference_id !== String(user.id)) {
      res.status(403).json({ error: "Session does not belong to this account." });
      return;
    }
    if (!session.subscription) {
      res.status(400).json({ error: "No subscription on this session." });
      return;
    }
    const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    const sub = await stripe.subscriptions.retrieve(subId);
    const tier = sub.metadata?.tier;
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;

    const update: Partial<typeof usersTable.$inferInsert> = {
      subscriptionStatus: sub.status,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
    };
    if (tier === "student" || tier === "practitioner" || tier === "firm") update.subscriptionTier = tier;
    if (typeof periodEnd === "number") update.currentPeriodEnd = new Date(periodEnd * 1000);

    await db.update(usersTable).set(update).where(eq(usersTable.id, user.id));
    const refreshed = (await db.select().from(usersTable).where(eq(usersTable.id, user.id)))[0];
    res.json({
      success: true,
      subscriptionStatus: refreshed.subscriptionStatus,
      tier: refreshed.subscriptionTier,
      currentPeriodEnd: refreshed.currentPeriodEnd,
    });
  } catch (e) {
    req.log.error({ err: e }, "Billing sync failed");
    res.status(502).json({ error: "Could not sync subscription." });
  }
});

export default router;
