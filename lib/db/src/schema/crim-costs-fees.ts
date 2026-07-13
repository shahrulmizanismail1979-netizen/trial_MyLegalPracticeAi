import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const costsFeesTable = pgTable("costs_fees", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  amount: text("amount").notNull(),
  category: text("category").notNull(),
  courtType: text("court_type").notNull(),
  legalBasis: text("legal_basis").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCostFeeSchema = createInsertSchema(costsFeesTable).omit({ id: true, createdAt: true });
export type InsertCostFee = z.infer<typeof insertCostFeeSchema>;
export type CostFee = typeof costsFeesTable.$inferSelect;
