import { pgTable, serial, text, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const litLegalCases = pgTable("lit_legal_cases", {
  id: serial("id").primaryKey(),
  caseName: text("case_name").notNull(),
  citation: text("citation").notNull(),
  year: integer("year").notNull(),
  court: text("court").notNull(),
  judge: text("judge"),
  facts: text("facts").notNull(),
  issues: jsonb("issues").notNull().$type<string[]>(),
  held: text("held").notNull(),
  significance: text("significance").notNull(),
  tags: jsonb("tags").notNull().$type<string[]>(),
  legislation: jsonb("legislation").notNull().$type<string[]>(),
});

export const insertLitLegalCaseSchema = createInsertSchema(litLegalCases).omit({ id: true });
export type InsertLitLegalCase = z.infer<typeof insertLitLegalCaseSchema>;
export type LitLegalCase = typeof litLegalCases.$inferSelect;
