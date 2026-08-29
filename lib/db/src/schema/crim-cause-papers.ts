import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const causePapersTable = pgTable("cause_papers", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  court: text("court").notNull(),
  description: text("description").notNull(),
  templateContent: text("template_content").notNull(),
  category: text("category").notNull(),
  language: text("language").notNull().default("ms"),
  sourceId: integer("source_id"),
  stableKey: text("stable_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("cause_papers_stable_key_unique").on(table.stableKey),
]);

export const insertCausePaperSchema = createInsertSchema(causePapersTable).omit({ id: true, createdAt: true });
export type InsertCausePaper = z.infer<typeof insertCausePaperSchema>;
export type CausePaper = typeof causePapersTable.$inferSelect;
