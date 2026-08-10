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
import { accessCodesTable } from "./accident-access-codes";

// Matter files for MyAccidentAI: one file per accident / personal-injury
// brief, owned by the authenticated access code. Mirrors the crim_matters /
// sya_matters pattern but adapted to running-down practice (parties, court,
// claim quantum). MyAccidentAI has a single owner space (access-code logins
// only, with master sessions mapped onto a synthetic access-code row), so a
// single owner_id column referencing access_codes(id) is sufficient.
export const accMatters = pgTable("acc_matters", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => accessCodesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  fileRef: text("file_ref"),
  clientName: text("client_name"),
  actingFor: text("acting_for"), // Plaintiff | Defendant | ...
  plaintiff: text("plaintiff"),
  defendant: text("defendant"),
  matterType: text("matter_type"), // running-down | personal-injury | fatal | MIB
  court: text("court"),
  caseNo: text("case_no"),
  claimAmount: numeric("claim_amount", { precision: 14, scale: 2 }),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accMatterDeadlines = pgTable("acc_matter_deadlines", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id")
    .notNull()
    .references(() => accMatters.id, { onDelete: "cascade" }),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => accessCodesTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  category: text("category").notNull().default("custom"),
  status: text("status").notNull().default("pending"),
  basis: text("basis"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accSavedWork = pgTable("acc_saved_work", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => accessCodesTable.id, { onDelete: "cascade" }),
  matterId: integer("matter_id"),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  matter: text("matter"),
  inputJson: jsonb("input_json"),
  content: text("content").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAccMatterSchema = createInsertSchema(accMatters).omit({
  id: true, ownerId: true, createdAt: true, updatedAt: true,
});
export const insertAccMatterDeadlineSchema = createInsertSchema(accMatterDeadlines).omit({
  id: true, matterId: true, ownerId: true, createdAt: true, updatedAt: true,
});
export const insertAccSavedWorkSchema = createInsertSchema(accSavedWork).omit({
  id: true, ownerId: true, createdAt: true, updatedAt: true,
});

export type AccMatter = typeof accMatters.$inferSelect;
export type InsertAccMatter = z.infer<typeof insertAccMatterSchema>;
export type AccMatterDeadline = typeof accMatterDeadlines.$inferSelect;
export type InsertAccMatterDeadline = z.infer<typeof insertAccMatterDeadlineSchema>;
export type AccSavedWork = typeof accSavedWork.$inferSelect;
export type InsertAccSavedWork = z.infer<typeof insertAccSavedWorkSchema>;
