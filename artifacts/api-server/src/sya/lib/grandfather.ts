import type { AppUser } from "@workspace/db/sya";

/**
 * Launch cutoff for the subscription paywall.
 *
 * Every account whose credentials were issued on or before this moment gets
 * full ("firm") access for life. The four subscription tiers only gate new
 * email sign-ups created AFTER this cutoff. Access-code logins are always full
 * access (handled separately in the auth route).
 *
 * End of this week — Sunday 7 June 2026, 23:59:59 Malaysia time (UTC+8),
 * i.e. the start of Monday 8 June 2026 MYT.
 */
export const GRANDFATHER_CUTOFF = new Date("2026-06-08T00:00:00+08:00");

/** True if an account created now should be grandfathered into full access. */
export function isWithinGrandfatherWindow(at: Date = new Date()): boolean {
  return at.getTime() < GRANDFATHER_CUTOFF.getTime();
}

/**
 * The tier an email account effectively has. Grandfathered early adopters are
 * treated as "firm" regardless of their stored tier; everyone else uses their
 * real (subscription-driven) tier.
 */
export function effectiveTier(
  user: Pick<AppUser, "tier" | "grandfathered">,
): string {
  return user.grandfathered ? "firm" : user.tier;
}
