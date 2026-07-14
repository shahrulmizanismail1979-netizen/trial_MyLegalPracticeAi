import { pgTable, serial, text, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const litWorkflows = pgTable("lit_workflows", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  legalBasis: text("legal_basis").notNull(),
  applicableTo: text("applicable_to").notNull(),
  estimatedDuration: text("estimated_duration"),
  steps: jsonb("steps").notNull().$type<Array<{
    stepNumber: number;
    title: string;
    description: string;
    legalBasis: string;
    documents: string[];
    timeframe?: string;
    notes?: string;
  }>>(),
  sampleDocuments: jsonb("sample_documents").notNull().$type<string[]>(),
});

export const insertLitWorkflowSchema = createInsertSchema(litWorkflows).omit({ id: true });
export type InsertLitWorkflow = z.infer<typeof insertLitWorkflowSchema>;
export type LitWorkflow = typeof litWorkflows.$inferSelect;
