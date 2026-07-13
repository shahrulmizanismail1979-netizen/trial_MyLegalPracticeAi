import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accessCodesTable = pgTable("access_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  maxUsers: integer("max_users").notNull().default(1),
  currentUsers: integer("current_users").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const insertAccessCodeSchema = createInsertSchema(accessCodesTable).omit({
  id: true,
  currentUsers: true,
  createdAt: true,
});
export type InsertAccessCode = z.infer<typeof insertAccessCodeSchema>;
export type AccessCode = typeof accessCodesTable.$inferSelect;

export const accessCodeUsageTable = pgTable("access_code_usage", {
  id: serial("id").primaryKey(),
  accessCodeId: integer("access_code_id").notNull(),
  sessionId: text("session_id").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AccessCodeUsage = typeof accessCodeUsageTable.$inferSelect;
