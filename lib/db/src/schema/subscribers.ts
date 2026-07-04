import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const subscribersTable = pgTable("subscribers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  apps: text("apps").array().notNull(),
  kohortId: integer("kohort_id"),
  tier: text("tier"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  paymentAmount: text("payment_amount").notNull(),
  paymentDate: timestamp("payment_date", { withTimezone: true }),
  paymentProvider: text("payment_provider"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  toyyibpayBillCode: text("toyyibpay_bill_code"),
  insuranceEntitled: boolean("insurance_entitled").notNull().default(false),
  coursesPerYear: integer("courses_per_year").notNull().default(0),
  coursesUsed: integer("courses_used").notNull().default(0),
  voucherCode: text("voucher_code"),
  notes: text("notes"),
  subscriptionExpiry: timestamp("subscription_expiry", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSubscriberSchema = createInsertSchema(subscribersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSubscriber = z.infer<typeof insertSubscriberSchema>;
export type Subscriber = typeof subscribersTable.$inferSelect;
