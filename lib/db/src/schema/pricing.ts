import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pricingTable = pgTable("pricing", {
  id: serial("id").primaryKey(),
  appName: text("app_name").notNull(),
  appSlug: text("app_slug").notNull(),
  standardPrice: text("standard_price").notNull(),
  standardDurationYears: integer("standard_duration_years").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPricingSchema = createInsertSchema(pricingTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPricing = z.infer<typeof insertPricingSchema>;
export type Pricing = typeof pricingTable.$inferSelect;
