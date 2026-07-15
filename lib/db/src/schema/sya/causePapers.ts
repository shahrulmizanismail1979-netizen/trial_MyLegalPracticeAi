import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const causePapersTable = pgTable("sya_cause_papers", {
  id: serial("id").primaryKey(),
  titleEn: text("title_en").notNull(),
  titleBm: text("title_bm").notNull(),
  category: text("category").notNull(),
  categoryBm: text("category_bm").notNull(),
  descriptionEn: text("description_en").notNull(),
  descriptionBm: text("description_bm").notNull(),
  templateEn: text("template_en").notNull(),
  templateBm: text("template_bm").notNull(),
  formNumber: text("form_number"),
  requiredFields: text("required_fields"),
  gates: text("gates").notNull().default("civil,criminal,advisory"),
  jurisdiction: text("jurisdiction").default("malaysia"),
  order: integer("display_order").notNull().default(0),
});

export const insertCausePaperSchema = createInsertSchema(causePapersTable).omit({ id: true });
export type InsertCausePaper = z.infer<typeof insertCausePaperSchema>;
export type CausePaper = typeof causePapersTable.$inferSelect;
