import { boolean, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

// NOTE: tier logic (ranks, plans, tool access) lives in `@workspace/tiers`, which is the
// source of truth. This local copy exists only to type the DB column without pulling a
// non-db dependency into drizzle-kit. Keep these literals in sync with ACCESS_TIERS there.
export const CORP_ACCESS_TIERS = ["legacy_full", "student", "practitioner", "firm"] as const;
export type CorpAccessTier = (typeof CORP_ACCESS_TIERS)[number];

export const corpAccessCodes = pgTable("corp_access_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  label: text("label"),
  isActive: boolean("is_active").default(true).notNull(),
  // Subscription tier. Existing rows default to `legacy_full` (grandfathered → full access).
  tier: varchar("tier", { length: 20 }).$type<CorpAccessTier>().default("legacy_full").notNull(),
  // Stripe linkage for codes created via paid purchase (null for admin/legacy codes).
  stripeCustomerId: varchar("stripe_customer_id", { length: 64 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 64 }),
  subscriptionStatus: varchar("subscription_status", { length: 32 }),
  // When the subscription/access expires (null = no expiry, e.g. legacy/admin codes).
  // Licensed concurrent seats for this code (null = legacy/unlimited behavior).
  maxSeats: integer("max_seats"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CorpAccessCode = typeof corpAccessCodes.$inferSelect;
