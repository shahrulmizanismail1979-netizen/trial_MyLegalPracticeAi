import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const litPracticeDirections = pgTable("lit_practice_directions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  refNo: text("ref_no").notNull(),
  court: text("court").notNull(),
  category: text("category").notNull(),
  summary: text("summary").notNull(),
  practicalEffect: text("practical_effect").notNull(),
  effectiveDate: text("effective_date"),
  status: text("status").notNull(),
  sourceUrl: text("source_url").notNull(),
});

export const insertLitPracticeDirectionSchema = createInsertSchema(litPracticeDirections).omit({ id: true });
export type InsertLitPracticeDirection = z.infer<typeof insertLitPracticeDirectionSchema>;
export type LitPracticeDirection = typeof litPracticeDirections.$inferSelect;

export const litBarCouncilRulings = pgTable("lit_bar_council_rulings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  chapter: text("chapter").notNull(),
  ruling: text("ruling").notNull(),
  basis: text("basis").notNull(),
  practicalEffect: text("practical_effect").notNull(),
  consequence: text("consequence"),
  sourceUrl: text("source_url").notNull(),
  lastUpdated: text("last_updated"),
});

export const insertLitBarCouncilRulingSchema = createInsertSchema(litBarCouncilRulings).omit({ id: true });
export type InsertLitBarCouncilRuling = z.infer<typeof insertLitBarCouncilRulingSchema>;
export type LitBarCouncilRuling = typeof litBarCouncilRulings.$inferSelect;
