import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vouchersTable = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountType: text("discount_type").notNull(),
  discountValue: text("discount_value").notNull(),
  maxUses: integer("max_uses").notNull(),
  usedCount: integer("used_count").notNull().default(0),
  appFilter: text("app_filter"),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertVoucherSchema = createInsertSchema(vouchersTable).omit({ id: true, createdAt: true, updatedAt: true, usedCount: true });
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type Voucher = typeof vouchersTable.$inferSelect;
