import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const provisionsTable = pgTable("sya_provisions", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  categoryBm: text("category_bm").notNull(),
  titleEn: text("title_en").notNull(),
  titleBm: text("title_bm").notNull(),
  overviewEn: text("overview_en").notNull(),
  overviewBm: text("overview_bm").notNull(),
  principlesEn: text("principles_en").notNull(),
  principlesBm: text("principles_bm").notNull(),
  legislationEn: text("legislation_en").notNull(),
  legislationBm: text("legislation_bm").notNull(),
  practicalNotesEn: text("practical_notes_en").notNull(),
  practicalNotesBm: text("practical_notes_bm").notNull(),
  relatedCases: text("related_cases"),
  gates: text("gates").notNull().default("civil,criminal,advisory"),
  state: text("state"),
  titleAr: text("title_ar"),
  order: integer("display_order").notNull().default(0),
});

export const insertProvisionSchema = createInsertSchema(provisionsTable).omit({ id: true });
export type InsertProvision = z.infer<typeof insertProvisionSchema>;
export type Provision = typeof provisionsTable.$inferSelect;
