import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taskEvidenceTable = pgTable("firm_task_evidence", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().default(0),
  taskId: integer("task_id").notNull(),
  authorId: integer("author_id"),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type"),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertTaskEvidenceSchema = createInsertSchema(taskEvidenceTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskEvidence = z.infer<typeof insertTaskEvidenceSchema>;
export type TaskEvidence = typeof taskEvidenceTable.$inferSelect;
