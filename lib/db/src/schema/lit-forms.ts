import { pgTable, serial, text, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const litLegalForms = pgTable("lit_legal_forms", {
  id: serial("id").primaryKey(),
  formNumber: text("form_number").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  authorizedBy: text("authorized_by").notNull(),
  purpose: text("purpose").notNull(),
  instructions: text("instructions").notNull(),
  fields: jsonb("fields").notNull().$type<string[]>(),
  filingFee: text("filing_fee").notNull(),
  timeLimit: text("time_limit"),
  notes: text("notes"),
});

export const insertLitLegalFormSchema = createInsertSchema(litLegalForms).omit({ id: true });
export type InsertLitLegalForm = z.infer<typeof insertLitLegalFormSchema>;
export type LitLegalForm = typeof litLegalForms.$inferSelect;
