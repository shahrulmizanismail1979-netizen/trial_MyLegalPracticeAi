import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appStatsTable = pgTable("app_stats", {
  appName: text("app_name").primaryKey(),
  subscriberCount: integer("subscriber_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAppStatSchema = createInsertSchema(appStatsTable).omit({ updatedAt: true });
export type InsertAppStat = z.infer<typeof insertAppStatSchema>;
export type AppStat = typeof appStatsTable.$inferSelect;
