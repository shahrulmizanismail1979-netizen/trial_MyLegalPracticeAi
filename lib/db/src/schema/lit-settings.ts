import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const litAppSettings = pgTable("lit_app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type LitAppSetting = typeof litAppSettings.$inferSelect;
