import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const glossaryTermsTable = pgTable("glossary_terms", {
  id: serial("id").primaryKey(),
  term: text("term").notNull(),
  definition: text("definition").notNull(),
  malayTranslation: text("malay_translation").notNull(),
  relatedTerms: text("related_terms").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGlossaryTermSchema = createInsertSchema(glossaryTermsTable).omit({ id: true, createdAt: true });
export type InsertGlossaryTerm = z.infer<typeof insertGlossaryTermSchema>;
export type GlossaryTerm = typeof glossaryTermsTable.$inferSelect;
