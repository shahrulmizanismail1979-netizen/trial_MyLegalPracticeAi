import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Append-only audit trail of task-level mutations (edits, reassignment,
// archive, collaborator changes) under the open-team model. `actorId` is the
// acting user (attribution); `action` is a canonical key the frontend renders
// bilingually; `meta` snapshots the relevant before/after context.
export const taskActivityTable = pgTable(
  "firm_task_activity",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull().default(0),
    taskId: integer("task_id").notNull(),
    actorId: integer("actor_id"),
    action: text("action").notNull(),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // Composite descending index serving the newest-first activity pager
  // (ORDER BY created_at DESC, id DESC) so deep paging reads from the index
  // instead of a full sort/scan as the audit trail grows.
  (table) => [
    index("firm_task_activity_created_at_id_idx").on(
      table.workspaceId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export const insertTaskActivitySchema = createInsertSchema(
  taskActivityTable,
).omit({
  id: true,
  createdAt: true,
});
export type InsertTaskActivity = z.infer<typeof insertTaskActivitySchema>;
export type TaskActivity = typeof taskActivityTable.$inferSelect;
