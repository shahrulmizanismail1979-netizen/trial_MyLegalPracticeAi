import crypto from "crypto";
import type Stripe from "stripe";
import { db, corpAccessCodes, type CorpAccessCode } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  getEffectiveTier,
  planByLookupKey,
  type AccessTier,
  type PurchasableTier,
} from "@workspace/tiers";

/** Generate a XXXX-XXXX-XXXX access code (no ambiguous chars). */
export function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += "-";
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

/**
 * Effective tier for a stored access code, applying the grandfather rule:
 * any code created on/before the cutoff is permanently full access.
 */
export function effectiveTierForCode(code: Pick<CorpAccessCode, "tier" | "createdAt">): AccessTier {
  return getEffectiveTier(code.tier, code.createdAt);
}

/**
 * Master override password. Entering this in the access gate grants permanent
 * full (legacy_full) access to everything, with no payment and no expiry.
 * Read from the MASTER_ACCESS_CODE secret — when unset, master override is
 * disabled (fail closed).
 */
export const MASTER_PASSWORD = (process.env.MASTER_ACCESS_CODE ?? "").trim();

/** Sentinel access-code row that backs master-override corpSessions. */
export const MASTER_CODE = "MASTER-OVERRIDE";

/**
 * Find-or-create the master-override access code row (always tier=legacy_full,
 * active). Sessions for the master password are attached to this row so all the
 * existing session/validate/auth machinery works unchanged.
 */
export async function ensureMasterCode(): Promise<CorpAccessCode> {
  // Atomic upsert keyed on the unique `code` column so concurrent first logins
  // can't collide on the unique constraint (which would 500). Always heals the
  // row back to active + legacy_full.
  const [row] = await db
    .insert(corpAccessCodes)
    .values({
      code: MASTER_CODE,
      label: "Master override (full access)",
      tier: "legacy_full",
      isActive: true,
    })
    .onConflictDoUpdate({
      target: corpAccessCodes.code,
      set: { isActive: true, tier: "legacy_full" },
    })
    .returning();
  return row;
}

/** Resolve the purchasable tier for a Stripe price via its lookup_key. */
export function tierFromPrice(price: Stripe.Price | null | undefined): PurchasableTier | null {
  const lookupKey = price?.lookup_key ?? undefined;
  if (!lookupKey) return null;
  return planByLookupKey(lookupKey)?.tier ?? null;
}

/**
 * Idempotently fulfill a completed Stripe checkout session by ensuring an
 * access code exists for its subscription. Returns the access code string, or
 * null if the session is not yet paid / not resolvable.
 *
 * Safe to call from both the success page (on-demand) and the webhook.
 */
export async function fulfillCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<CorpAccessCode | null> {
  if (session.payment_status !== "paid") return null;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  if (!subscriptionId) return null;

  // Already fulfilled? Return the existing code (idempotent).
  const [existing] = await db
    .select()
    .from(corpAccessCodes)
    .where(eq(corpAccessCodes.stripeSubscriptionId, subscriptionId));
  if (existing) return existing;

  // Tier comes from checkout metadata (set at session creation).
  const tier = (session.metadata?.tier ?? null) as PurchasableTier | null;
  if (!tier) return null;

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);

  const label = session.customer_details?.email
    ? `Purchase — ${session.customer_details.email}`
    : "Stripe purchase";

  const [created] = await db
    .insert(corpAccessCodes)
    .values({
      code: generateCode(),
      label,
      tier,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: "active",
      isActive: true,
    })
    .returning();

  return created ?? null;
}

/**
 * Read a subscription's status from the synced `stripe.subscriptions` table
 * (kept up to date by stripe-replit-sync's managed webhook). Returns null if
 * the schema isn't ready yet or the subscription hasn't been synced — callers
 * should treat null as "benefit of the doubt" so new buyers aren't blocked by
 * sync lag.
 */
export async function getSyncedSubscriptionStatus(
  subscriptionId: string,
): Promise<string | null> {
  try {
    const result = await db.execute<{ status: string }>(
      sql`SELECT status FROM stripe.subscriptions WHERE id = ${subscriptionId} LIMIT 1`,
    );
    return result.rows[0]?.status ?? null;
  } catch {
    return null;
  }
}

/**
 * Sync an access code's status from a Stripe subscription lifecycle event.
 * Deactivates the code when the subscription is no longer active.
 */
export async function syncSubscriptionStatus(
  subscriptionId: string,
  status: string,
): Promise<void> {
  const activeStates = new Set(["active", "trialing", "past_due"]);
  await db
    .update(corpAccessCodes)
    .set({
      subscriptionStatus: status,
      isActive: activeStates.has(status),
    })
    .where(eq(corpAccessCodes.stripeSubscriptionId, subscriptionId));
}
