import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taskAttemptsTable = pgTable("firm_task_attempts", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  authorId: integer("author_id"),
  body: text("body").notNull(),
  source: text("source").notNull().default("text"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTaskAttemptSchema = createInsertSchema(taskAttemptsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskAttempt = z.infer<typeof insertTaskAttemptSchema>;
export type TaskAttempt = typeof taskAttemptsTable.$inferSelect;
