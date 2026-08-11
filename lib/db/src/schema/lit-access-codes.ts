import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const litAccessCodes = pgTable(
  "lit_access_codes",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    recipientName: text("recipient_name").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    notes: text("notes"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at"),
    lastUsedAt: timestamp("last_used_at"),
    usageCount: integer("usage_count").notNull().default(0),
    stripeCustomerId: text("stripe_customer_id"),
    compedAccess: boolean("comped_access").notNull().default(false),
    // Licensed concurrent seats for this code (null = legacy/unlimited behavior).
    maxSeats: integer("max_seats"),
  },
  (t) => ({
    stripeCustomerUniq: uniqueIndex("lit_access_codes_stripe_customer_id_uniq")
      .on(t.stripeCustomerId)
      .where(sql`${t.stripeCustomerId} IS NOT NULL`),
  }),
);

export const insertLitAccessCodeSchema = createInsertSchema(litAccessCodes).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
  usageCount: true,
});

export type InsertLitAccessCode = z.infer<typeof insertLitAccessCodeSchema>;
export type LitAccessCode = typeof litAccessCodes.$inferSelect;
