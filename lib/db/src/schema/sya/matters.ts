import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Matter files for MySyariahAI, mirroring the MyLitAI lit_matters pattern.
 *
 * Ownership: sya sessions identify the caller by (accountType, userId) where
 * accountType is "code" (sya_access_codes.id, or -1 for the master code) or
 * "email" (sya_app_users.id). The two id spaces overlap, so rows are scoped by
 * BOTH owner_type and owner_id. No FK — the owner may live in either table.
 */
export const syaMattersTable = pgTable("sya_matters", {
  id: serial("id").primaryKey(),
  ownerType: text("owner_type").notNull(), // "code" | "email"
  ownerId: integer("owner_id").notNull(),
  title: text("title").notNull(),
  clientName: text("client_name"),
  actingFor: text("acting_for"),
  plaintiff: text("plaintiff"),
  defendant: text("defendant"),
  matterType: text("matter_type"), // Syariah category: mal, faraid, hadhanah, nafkah, cerai_fasakh, ...
  court: text("court"),
  caseNo: text("case_no"),
  claimAmount: numeric("claim_amount", { precision: 14, scale: 2 }),
  workflowId: integer("workflow_id"), // link to sya_procedural_workflows
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const syaMatterDeadlinesTable = pgTable("sya_matter_deadlines", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id")
    .notNull()
    .references(() => syaMattersTable.id, { onDelete: "cascade" }),
  ownerType: text("owner_type").notNull(),
  ownerId: integer("owner_id").notNull(),
  title: text("title").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  category: text("category").notNull().default("custom"),
  status: text("status").notNull().default("pending"),
  basis: text("basis"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const syaSavedWorkTable = pgTable("sya_saved_work", {
  id: serial("id").primaryKey(),
  ownerType: text("owner_type").notNull(),
  ownerId: integer("owner_id").notNull(),
  matterId: integer("matter_id").references(() => syaMattersTable.id, {
    onDelete: "cascade",
  }),
  kind: text("kind").notNull(), // "draft" | "document" | ...
  title: text("title").notNull(),
  matter: text("matter"),
  inputJson: jsonb("input_json"),
  content: text("content").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSyaMatterSchema = createInsertSchema(syaMattersTable).omit({
  id: true,
  ownerType: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSyaMatterDeadlineSchema = createInsertSchema(
  syaMatterDeadlinesTable,
).omit({
  id: true,
  matterId: true,
  ownerType: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSyaSavedWorkSchema = createInsertSchema(syaSavedWorkTable).omit({
  id: true,
  ownerType: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
});

export type SyaMatter = typeof syaMattersTable.$inferSelect;
export type InsertSyaMatter = z.infer<typeof insertSyaMatterSchema>;
export type SyaMatterDeadline = typeof syaMatterDeadlinesTable.$inferSelect;
export type InsertSyaMatterDeadline = z.infer<typeof insertSyaMatterDeadlineSchema>;
export type SyaSavedWork = typeof syaSavedWorkTable.$inferSelect;
export type InsertSyaSavedWork = z.infer<typeof insertSyaSavedWorkSchema>;
