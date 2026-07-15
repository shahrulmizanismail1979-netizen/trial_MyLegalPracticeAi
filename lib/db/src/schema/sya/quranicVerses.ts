import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const quranicVersesTable = pgTable("sya_quranic_verses", {
  id: serial("id").primaryKey(),
  surahName: text("surah_name").notNull(),
  surahNameBm: text("surah_name_bm").notNull(),
  surahNumber: integer("surah_number").notNull(),
  ayahRange: text("ayah_range").notNull(),
  textArabic: text("text_arabic").notNull(),
  translationEn: text("translation_en").notNull(),
  translationBm: text("translation_bm").notNull(),
  category: text("category").notNull(),
  categoryBm: text("category_bm").notNull(),
  relevanceEn: text("relevance_en").notNull(),
  relevanceBm: text("relevance_bm").notNull(),
  relatedLegislation: text("related_legislation"),
  gates: text("gates").notNull().default("civil,criminal,advisory"),
  tafsirEn: text("tafsir_en"),
  tafsirBm: text("tafsir_bm"),
  practitionerNotesEn: text("practitioner_notes_en"),
  practitionerNotesBm: text("practitioner_notes_bm"),
  order: integer("display_order").notNull().default(0),
});

export const insertQuranicVerseSchema = createInsertSchema(quranicVersesTable).omit({ id: true });
export type InsertQuranicVerse = z.infer<typeof insertQuranicVerseSchema>;
export type QuranicVerse = typeof quranicVersesTable.$inferSelect;
