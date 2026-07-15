import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const TIERS = ["starter", "professional", "premium", "firm"] as const;
export type Tier = (typeof TIERS)[number];

export const usersTable = pgTable("sya_app_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("practitioner"),
  tier: text("tier").notNull().default("starter"),
  // Early-adopter flag: accounts created on or before the launch cutoff get full
  // access for life, regardless of their stored tier. The subscription paywall
  // only applies to new sign-ups after the cutoff.
  grandfathered: boolean("grandfathered").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type AppUser = typeof usersTable.$inferSelect;
