import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const caseLawsTable = pgTable("sya_case_laws", {
  id: serial("id").primaryKey(),
  caseName: text("case_name").notNull(),
  caseNameBm: text("case_name_bm"),
  citation: text("citation").notNull(),
  year: text("year").notNull(),
  court: text("court").notNull(),
  courtBm: text("court_bm"),
  judge: text("judge"),
  factsEn: text("facts_en").notNull(),
  factsBm: text("facts_bm").notNull(),
  issuesEn: text("issues_en").notNull(),
  issuesBm: text("issues_bm").notNull(),
  heldEn: text("held_en").notNull(),
  heldBm: text("held_bm").notNull(),
  significanceEn: text("significance_en").notNull(),
  significanceBm: text("significance_bm").notNull(),
  category: text("category").notNull(),
  categoryBm: text("category_bm").notNull(),
  tags: text("tags"),
  legislation: text("legislation"),
  gates: text("gates").notNull().default("civil,criminal,advisory"),
  jurisdiction: text("jurisdiction").default("malaysia"),
  practitionerNotesEn: text("practitioner_notes_en"),
  practitionerNotesBm: text("practitioner_notes_bm"),
});

export const insertCaseLawSchema = createInsertSchema(caseLawsTable).omit({ id: true });
export type InsertCaseLaw = z.infer<typeof insertCaseLawSchema>;
export type CaseLaw = typeof caseLawsTable.$inferSelect;
