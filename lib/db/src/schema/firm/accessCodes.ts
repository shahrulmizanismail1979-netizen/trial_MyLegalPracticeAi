import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const firmAccessCodesTable = pgTable("firm_access_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  customerEmail: text("customer_email"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFirmAccessCodeSchema = createInsertSchema(firmAccessCodesTable).omit({
  id: true,
  createdAt: true,
});

export function isFirmAccessCodeExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}
export type InsertFirmAccessCode = z.infer<typeof insertFirmAccessCodeSchema>;
export type FirmAccessCode = typeof firmAccessCodesTable.$inferSelect;
