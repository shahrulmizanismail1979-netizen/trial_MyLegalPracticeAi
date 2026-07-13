import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sampleDocumentsTable = pgTable("sample_documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  documentType: text("document_type").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSampleDocumentSchema = createInsertSchema(sampleDocumentsTable).omit({ id: true, createdAt: true });
export type InsertSampleDocument = z.infer<typeof insertSampleDocumentSchema>;
export type SampleDocument = typeof sampleDocumentsTable.$inferSelect;
