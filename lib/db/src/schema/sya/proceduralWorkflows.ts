import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const proceduralWorkflowsTable = pgTable("sya_procedural_workflows", {
  id: serial("id").primaryKey(),
  titleEn: text("title_en").notNull(),
  titleBm: text("title_bm").notNull(),
  category: text("category").notNull(),
  categoryBm: text("category_bm").notNull(),
  descriptionEn: text("description_en").notNull(),
  descriptionBm: text("description_bm").notNull(),
  stepsJson: text("steps_json").notNull(),
  estimatedTimeline: text("estimated_timeline"),
  requiredDocuments: text("required_documents"),
  courtFees: text("court_fees"),
  gates: text("gates").notNull().default("civil,criminal,advisory"),
  jurisdiction: text("jurisdiction").default("malaysia"),
  order: integer("display_order").notNull().default(0),
});

export const insertWorkflowSchema = createInsertSchema(proceduralWorkflowsTable).omit({ id: true });
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type ProceduralWorkflow = typeof proceduralWorkflowsTable.$inferSelect;
