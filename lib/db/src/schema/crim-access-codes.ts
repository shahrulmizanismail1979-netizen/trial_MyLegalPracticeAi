import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const crimAccessCodesTable = pgTable("crim_access_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  // Subscription tier: starter | practitioner | advocate | chambers | full.
  // "full" is the default for legacy / admin-issued codes (unrestricted).
  tier: text("tier").notNull().default("full"),
  // Stripe linkage (null for legacy / admin-issued codes)
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  customerEmail: text("customer_email"),
  subscriptionStatus: text("subscription_status"),
  // True only for the owner seat of a subscription (the buyer). Owner seats may
  // open the Stripe billing portal; additional seats cannot manage billing.
  isOwner: boolean("is_owner").notNull().default(false),
  currentSessionId: text("current_session_id"),
  sessionStartedAt: timestamp("session_started_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCrimAccessCodeSchema = createInsertSchema(crimAccessCodesTable).omit({
  id: true,
  createdAt: true,
  currentSessionId: true,
  sessionStartedAt: true,
  lastSeenAt: true,
});

export function isCrimAccessCodeExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}
export type InsertCrimAccessCode = z.infer<typeof insertCrimAccessCodeSchema>;
export type CrimAccessCode = typeof crimAccessCodesTable.$inferSelect;
