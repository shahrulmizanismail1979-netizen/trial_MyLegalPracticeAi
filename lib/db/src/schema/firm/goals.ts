import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const goalsTable = pgTable("firm_goals", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().default(0),
  title: text("title").notNull(),
  description: text("description"),
  ownerId: integer("owner_id"),
  timeframe: text("timeframe"),
  status: text("status").notNull().default("active"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const kpisTable = pgTable("firm_kpis", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().default(0),
  goalId: integer("goal_id").notNull(),
  name: text("name").notNull(),
  unit: text("unit"),
  targetValue: doublePrecision("target_value").notNull(),
  currentValue: doublePrecision("current_value").notNull().default(0),
  direction: text("direction").notNull().default("up"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertGoalSchema = createInsertSchema(goalsTable).omit({
  id: true,
  createdAt: true,
  lastUpdatedAt: true,
});
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goalsTable.$inferSelect;

export const insertKpiSchema = createInsertSchema(kpisTable).omit({
  id: true,
  createdAt: true,
  lastUpdatedAt: true,
});
export type InsertKpi = z.infer<typeof insertKpiSchema>;
export type Kpi = typeof kpisTable.$inferSelect;
