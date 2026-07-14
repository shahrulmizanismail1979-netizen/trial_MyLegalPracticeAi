import { pgTable, serial, text, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const litCostSchedules = pgTable("lit_cost_schedules", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  items: jsonb("items").notNull().$type<Array<{ description: string; amount: string; notes?: string }>>(),
  legislativeBasis: text("legislative_basis").notNull(),
  lastUpdated: text("last_updated"),
});

export const insertLitCostScheduleSchema = createInsertSchema(litCostSchedules).omit({ id: true });
export type InsertLitCostSchedule = z.infer<typeof insertLitCostScheduleSchema>;
export type LitCostSchedule = typeof litCostSchedules.$inferSelect;
