import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const kohortsTable = pgTable("kohorts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  maxSlots: integer("max_slots").notNull(),
  filledSlots: integer("filled_slots").notNull().default(0),
  pricePerApp: text("price_per_app").notNull(),
  bundlePrice: text("bundle_price").notNull(),
  subscriptionYears: integer("subscription_years").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertKohortSchema = createInsertSchema(kohortsTable).omit({ id: true, createdAt: true, updatedAt: true, filledSlots: true });
export type InsertKohort = z.infer<typeof insertKohortSchema>;
export type Kohort = typeof kohortsTable.$inferSelect;
