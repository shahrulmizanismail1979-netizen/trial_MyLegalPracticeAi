import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const glossaryTable = pgTable("sya_glossary_terms", {
  id: serial("id").primaryKey(),
  termArabic: text("term_arabic"),
  termBm: text("term_bm").notNull(),
  termEn: text("term_en").notNull(),
  definitionEn: text("definition_en").notNull(),
  definitionBm: text("definition_bm").notNull(),
  category: text("category").notNull(),
  categoryBm: text("category_bm").notNull(),
  source: text("source"),
  practicalExample: text("practical_example"),
});

export const insertGlossarySchema = createInsertSchema(glossaryTable).omit({ id: true });
export type InsertGlossary = z.infer<typeof insertGlossarySchema>;
export type GlossaryTerm = typeof glossaryTable.$inferSelect;
