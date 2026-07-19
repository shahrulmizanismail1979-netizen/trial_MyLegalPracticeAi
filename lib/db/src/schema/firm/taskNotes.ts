import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taskNotesTable = pgTable("firm_task_notes", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  authorId: integer("author_id"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTaskNoteSchema = createInsertSchema(taskNotesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskNote = z.infer<typeof insertTaskNoteSchema>;
export type TaskNote = typeof taskNotesTable.$inferSelect;
