import {
  pgTable,
  serial,
  text,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { crimAccessCodesTable } from "./crim-access-codes";

// Matter files for MyCrimAI: one file per criminal brief, owned by the
// authenticated access code. Mirrors the lit_matters pattern but adapted to
// criminal procedure (stage instead of civil claim fields, optional link back
// to a practice workflow).
export const crimMatters = pgTable("crim_matters", {
  id: serial("id").primaryKey(),
  accessCodeId: integer("access_code_id")
    .notNull()
    .references(() => crimAccessCodesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  fileRef: text("file_ref"),
  clientName: text("client_name"),
  accusedName: text("accused_name"),
  charge: text("charge"),
  court: text("court"),
  caseNo: text("case_no"),
  stage: text("stage"), // remand | charge | bail | trial | appeal | closed-stage label
  workflowId: integer("workflow_id"),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const crimMatterDeadlines = pgTable("crim_matter_deadlines", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id")
    .notNull()
    .references(() => crimMatters.id, { onDelete: "cascade" }),
  accessCodeId: integer("access_code_id")
    .notNull()
    .references(() => crimAccessCodesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  category: text("category").notNull().default("custom"),
  status: text("status").notNull().default("pending"),
  basis: text("basis"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const crimSavedWork = pgTable("crim_saved_work", {
  id: serial("id").primaryKey(),
  accessCodeId: integer("access_code_id")
    .notNull()
    .references(() => crimAccessCodesTable.id, { onDelete: "cascade" }),
  matterId: integer("matter_id"),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  matter: text("matter"),
  inputJson: jsonb("input_json"),
  content: text("content").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCrimMatterSchema = createInsertSchema(crimMatters).omit({
  id: true, accessCodeId: true, createdAt: true, updatedAt: true,
});
export const insertCrimMatterDeadlineSchema = createInsertSchema(crimMatterDeadlines).omit({
  id: true, matterId: true, accessCodeId: true, createdAt: true, updatedAt: true,
});
export const insertCrimSavedWorkSchema = createInsertSchema(crimSavedWork).omit({
  id: true, accessCodeId: true, createdAt: true, updatedAt: true,
});

export type CrimMatter = typeof crimMatters.$inferSelect;
export type InsertCrimMatter = z.infer<typeof insertCrimMatterSchema>;
export type CrimMatterDeadline = typeof crimMatterDeadlines.$inferSelect;
export type InsertCrimMatterDeadline = z.infer<typeof insertCrimMatterDeadlineSchema>;
export type CrimSavedWork = typeof crimSavedWork.$inferSelect;
export type InsertCrimSavedWork = z.infer<typeof insertCrimSavedWorkSchema>;
