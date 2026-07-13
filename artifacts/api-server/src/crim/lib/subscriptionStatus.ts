import { pool } from "@workspace/db";

// Statuses that keep an access code usable. "past_due" is included as a short
// grace window; Stripe moves it to "unpaid"/"canceled" once dunning fails.
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * Returns true if the Stripe subscription backing an access code is still
 * active. Reads from the `stripe` schema kept in sync by stripe-replit-sync.
 *
 * Fails open (returns true) when there is no subscription id, the row has not
 * synced yet, or the synced schema is unavailable — so a fresh purchase or a
 * transient sync gap never locks out a paying user. Only an explicitly
 * lapsed/canceled status revokes access.
 */
export async function isSubscriptionActive(
  subscriptionId: string | null | undefined,
): Promise<boolean> {
  if (!subscriptionId) return true; // legacy / admin-issued codes
  try {
    const result = await pool.query<{ status: string }>(
      `SELECT status FROM stripe.subscriptions WHERE id = $1 LIMIT 1`,
      [subscriptionId],
    );
    const status = result.rows[0]?.status;
    if (!status) return true; // not synced yet — don't lock out
    return ACTIVE_STATUSES.has(status);
  } catch {
    return true; // synced schema not ready — fail open
  }
}
