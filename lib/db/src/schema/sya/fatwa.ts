import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fatwaTable = pgTable("sya_gazetted_fatwas", {
  id: serial("id").primaryKey(),
  titleEn: text("title_en").notNull(),
  titleBm: text("title_bm").notNull(),
  issuingBody: text("issuing_body").notNull(),
  issuingBodyBm: text("issuing_body_bm").notNull(),
  gazetteRef: text("gazette_ref"),
  sourceUrl: text("source_url"),
  year: text("year").notNull(),
  state: text("state"),
  category: text("category").notNull(),
  categoryBm: text("category_bm").notNull(),
  summaryEn: text("summary_en").notNull(),
  summaryBm: text("summary_bm").notNull(),
  detailsEn: text("details_en").notNull(),
  detailsBm: text("details_bm").notNull(),
  status: text("status").notNull().default("Active"),
  relatedLegislation: text("related_legislation"),
  gates: text("gates").notNull().default("civil,criminal,advisory"),
  jurisdiction: text("jurisdiction").default("malaysia"),
  practitionerNotesEn: text("practitioner_notes_en"),
  practitionerNotesBm: text("practitioner_notes_bm"),
  order: integer("display_order").notNull().default(0),
});

export const insertFatwaSchema = createInsertSchema(fatwaTable).omit({ id: true });
export type InsertFatwa = z.infer<typeof insertFatwaSchema>;
export type Fatwa = typeof fatwaTable.$inferSelect;
