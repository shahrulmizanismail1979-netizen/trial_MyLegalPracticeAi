import { pgTable, text, jsonb } from "drizzle-orm/pg-core";

export const appsTable = pgTable("acad_apps", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  accentColor: text("accent_color").notNull(),
  category: text("category").notNull(),
  features: jsonb("features").$type<string[]>().notNull().default([]),
});

export type App = typeof appsTable.$inferSelect;
export type InsertApp = typeof appsTable.$inferInsert;
