import { pgTable, serial, text, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const litGlossaryTerms = pgTable("lit_glossary_terms", {
  id: serial("id").primaryKey(),
  term: text("term").notNull(),
  definition: text("definition").notNull(),
  source: text("source").notNull(),
  example: text("example"),
  relatedTerms: jsonb("related_terms").notNull().$type<string[]>(),
  category: text("category").notNull(),
  latinOrigin: text("latin_origin"),
});

export const insertLitGlossaryTermSchema = createInsertSchema(litGlossaryTerms).omit({ id: true });
export type InsertLitGlossaryTerm = z.infer<typeof insertLitGlossaryTermSchema>;
export type LitGlossaryTerm = typeof litGlossaryTerms.$inferSelect;
