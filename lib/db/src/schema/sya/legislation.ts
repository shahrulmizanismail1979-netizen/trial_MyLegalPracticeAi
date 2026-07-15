import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const legislationTable = pgTable("sya_legislation", {
  id: serial("id").primaryKey(),
  titleEn: text("title_en").notNull(),
  titleBm: text("title_bm").notNull(),
  actNumber: text("act_number"),
  year: text("year"),
  descriptionEn: text("description_en").notNull(),
  descriptionBm: text("description_bm").notNull(),
  keyProvisionsEn: text("key_provisions_en"),
  keyProvisionsBm: text("key_provisions_bm"),
  category: text("category"),
  gates: text("gates").notNull().default("civil,criminal,advisory"),
  jurisdiction: text("jurisdiction").default("malaysia"),
  state: text("state"),
  sourceUrl: text("source_url"),
  practitionerNotesEn: text("practitioner_notes_en"),
  practitionerNotesBm: text("practitioner_notes_bm"),
  order: integer("display_order").notNull().default(0),
});

export const insertLegislationSchema = createInsertSchema(legislationTable).omit({ id: true });
export type InsertLegislation = z.infer<typeof insertLegislationSchema>;
export type LegislationType = typeof legislationTable.$inferSelect;
