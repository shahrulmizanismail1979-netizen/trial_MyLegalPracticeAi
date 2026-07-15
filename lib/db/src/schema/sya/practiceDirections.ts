import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const practiceDirectionsTable = pgTable("sya_practice_directions", {
  id: serial("id").primaryKey(),
  refNo: text("ref_no"),
  titleEn: text("title_en").notNull(),
  titleBm: text("title_bm").notNull(),
  // practice_direction | circular
  docType: text("doc_type").notNull().default("practice_direction"),
  issuingBody: text("issuing_body").notNull(),
  issuingBodyBm: text("issuing_body_bm").notNull(),
  // null => national / JKSM federal
  state: text("state"),
  year: text("year"),
  dateIssued: text("date_issued"),
  category: text("category").notNull(),
  categoryBm: text("category_bm").notNull(),
  summaryEn: text("summary_en").notNull(),
  summaryBm: text("summary_bm").notNull(),
  detailsEn: text("details_en").notNull(),
  detailsBm: text("details_bm").notNull(),
  practicalNotesEn: text("practical_notes_en"),
  practicalNotesBm: text("practical_notes_bm"),
  status: text("status").notNull().default("In Force"),
  relatedLegislation: text("related_legislation"),
  sourceUrl: text("source_url"),
  gates: text("gates").notNull().default("civil,criminal,advisory"),
  jurisdiction: text("jurisdiction").default("malaysia"),
  order: integer("display_order").notNull().default(0),
});

export const insertPracticeDirectionSchema = createInsertSchema(
  practiceDirectionsTable,
).omit({ id: true });
export type InsertPracticeDirection = z.infer<
  typeof insertPracticeDirectionSchema
>;
export type PracticeDirection = typeof practiceDirectionsTable.$inferSelect;
