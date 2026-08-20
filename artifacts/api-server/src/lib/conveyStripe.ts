// Mirrors Stripe subscription state onto the MyConveyLitAI users table.
// Called from the single verified /api/stripe/webhook handler in app.ts —
// the payload signature has already been checked by StripeSync.processWebhook,
// so this module only parses the event and reconciles user records.
import type Stripe from "stripe";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Tier } from "./access";

function tierFromMetadata(meta: Stripe.Metadata | null | undefined): Tier | null {
  const t = meta?.tier;
  if (t === "student" || t === "practitioner" || t === "firm") return t;
  return null;
}

/** Mirror a subscription's state onto the users table for fast authorization. */
async function reconcileSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const tier = tierFromMetadata(sub.metadata);
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;

  const update: Partial<typeof usersTable.$inferInsert> = {
    subscriptionStatus: sub.status,
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId,
  };
  if (tier) update.subscriptionTier = tier;
  if (typeof periodEnd === "number") update.currentPeriodEnd = new Date(periodEnd * 1000);

  const metaUserId = sub.metadata?.userId ? Number(sub.metadata.userId) : null;
  if (metaUserId && Number.isFinite(metaUserId)) {
    await db.update(usersTable).set(update).where(eq(usersTable.id, metaUserId));
  } else {
    await db.update(usersTable).set(update).where(eq(usersTable.stripeCustomerId, customerId));
  }
}

/**
 * Handle a verified Stripe webhook payload for MyConveyLitAI side effects.
 * Landing-page subscriptions carry different metadata (tier single/bundle) and
 * different customers, so their events simply match no convey user — harmless.
 */
export async function handleConveyStripeEvent(payload: Buffer): Promise<void> {
  let event: Stripe.Event;
  try {
    event = JSON.parse(payload.toString("utf8")) as Stripe.Event;
  } catch {
    return;
  }
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      // Let failures reach the webhook route so Stripe retries lifecycle events.
      await reconcileSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    default:
      break;
  }
}
