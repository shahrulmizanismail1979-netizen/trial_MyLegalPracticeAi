import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accessCodesTable = pgTable("sya_access_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("practitioner"),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAccessCodeSchema = createInsertSchema(accessCodesTable).omit({ id: true, createdAt: true });
export type InsertAccessCode = z.infer<typeof insertAccessCodeSchema>;
export type AccessCode = typeof accessCodesTable.$inferSelect;
