import {
  pgTable,
  serial,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taskCollaboratorsTable = pgTable(
  "firm_task_collaborators",
  {
    id: serial("id").primaryKey(),
    taskId: integer("task_id").notNull(),
    userId: integer("user_id").notNull(),
    addedById: integer("added_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.taskId, table.userId)],
);

export const insertTaskCollaboratorSchema = createInsertSchema(
  taskCollaboratorsTable,
).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskCollaborator = z.infer<
  typeof insertTaskCollaboratorSchema
>;
export type TaskCollaborator = typeof taskCollaboratorsTable.$inferSelect;
