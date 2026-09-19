import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("firm_tasks", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().default(0),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("backlog"),
  reason: text("reason").notNull().default("other"),
  status: text("status").notNull().default("todo"),
  ownerId: integer("owner_id"),
  createdById: integer("created_by_id"),
  goalId: integer("goal_id"),
  archived: boolean("archived").notNull().default(false),
  // Guided drafting rubric (nullable; set when a task is composed via the
  // structured rubric so the title/description follow a uniform house style).
  positionLevel: text("position_level"),
  actionVerb: text("action_verb"),
  qualityStandard: text("quality_standard"),
  natureOfWork: text("nature_of_work"),
  businessUnit: text("business_unit"),
  deliverable: text("deliverable"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  lastNudgedAt: timestamp("last_nudged_at", { withTimezone: true }),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
  lastUpdatedAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
