import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  // Primary credential for new accounts. NULLABLE on purpose: legacy accounts
  // (migrated from the username+password era) may not have one, and adding a
  // NOT NULL column to a populated production table is what wiped data before.
  // Codes are backfilled at startup; uniqueness still holds (NULLs are allowed).
  accessCode: text("access_code").unique(),
  // Email is captured at signup for billing/receipts (optional, not used to log in).
  email: text("email"),
  // username & passwordHash are retained for legacy/admin records but are no longer
  // used to authenticate. New accounts log in with accessCode.
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("user"),
  isActive: boolean("is_active").notNull().default(true),
  // Subscription / access control
  // grandfathered = true means the account was created on/before the cutoff and
  // is entitled to full (Firm-level) access for free, forever.
  grandfathered: boolean("grandfathered").notNull().default(false),
  // tier: 'free' | 'student' | 'practitioner' | 'firm'
  subscriptionTier: text("subscription_tier").notNull().default("free"),
  // status mirrors the Stripe subscription status: null | 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'
  subscriptionStatus: text("subscription_status"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, lastLoginAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
