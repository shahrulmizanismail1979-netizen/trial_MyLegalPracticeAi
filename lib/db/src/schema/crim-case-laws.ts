import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const caseLawsTable = pgTable("case_laws", {
  id: serial("id").primaryKey(),
  caseName: text("case_name").notNull(),
  citation: text("citation").notNull(),
  court: text("court").notNull(),
  year: integer("year").notNull(),
  summary: text("summary").notNull(),
  keyPrinciples: text("key_principles").notNull(),
  category: text("category").notNull(),
  fullText: text("full_text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCaseLawSchema = createInsertSchema(caseLawsTable).omit({ id: true, createdAt: true });
export type InsertCaseLaw = z.infer<typeof insertCaseLawSchema>;
export type CaseLaw = typeof caseLawsTable.$inferSelect;
