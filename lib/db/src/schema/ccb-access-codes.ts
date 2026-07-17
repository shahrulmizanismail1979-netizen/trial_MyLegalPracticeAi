import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ccbAccessCodes = pgTable("ccb_access_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  label: text("label"),
  active: boolean("active").default(true).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const insertCcbAccessCodeSchema = createInsertSchema(ccbAccessCodes).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export type CcbAccessCode = typeof ccbAccessCodes.$inferSelect;
export type InsertCcbAccessCode = z.infer<typeof insertCcbAccessCodeSchema>;
