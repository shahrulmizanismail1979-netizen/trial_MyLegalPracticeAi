import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Persists each Stripe alert delivery attempt so ops can audit past failures
 * even after a server restart.  The table holds one row per attempt; the
 * /admin/alert-status endpoint queries it for the last attempt per channel.
 */
export const alertDeliveryAttemptsTable = pgTable("alert_delivery_attempts", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull(),
  outcome: text("outcome").notNull(),
  detail: text("detail").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAlertDeliveryAttemptSchema = createInsertSchema(alertDeliveryAttemptsTable).omit({
  id: true,
  attemptedAt: true,
});
export type InsertAlertDeliveryAttempt = z.infer<typeof insertAlertDeliveryAttemptSchema>;
export type AlertDeliveryAttempt = typeof alertDeliveryAttemptsTable.$inferSelect;
