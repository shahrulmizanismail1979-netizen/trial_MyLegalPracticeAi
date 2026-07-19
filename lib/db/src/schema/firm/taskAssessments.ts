import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taskAssessmentsTable = pgTable("firm_task_assessments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().unique(),
  raterId: integer("rater_id"),
  qualityScore: integer("quality_score").notNull(),
  creativityScore: integer("creativity_score").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertTaskAssessmentSchema = createInsertSchema(
  taskAssessmentsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTaskAssessment = z.infer<typeof insertTaskAssessmentSchema>;
export type TaskAssessment = typeof taskAssessmentsTable.$inferSelect;
