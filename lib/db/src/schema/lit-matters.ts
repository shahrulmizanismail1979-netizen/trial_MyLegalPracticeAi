import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { litAccessCodes } from "./lit-access-codes";

export type LitPreparationBenchmark = {
  id: number;
  caseName: string;
  citation: string;
  proposition: string;
  pinpoint: string;
  sourceUrl: string;
};

export type LitMatterPreparationState = {
  issues: string;
  evidence: string;
  relief: string;
  filingReadiness: Record<string, boolean>;
  benchmarks: LitPreparationBenchmark[];
  practiceChecklists: Record<string, Record<string, boolean>>;
  causePaperPacks: Record<string, Record<string, boolean>>;
};

export const litMatters = pgTable("lit_matters", {
  id: serial("id").primaryKey(),
  accessCodeId: integer("access_code_id")
    .notNull()
    .references(() => litAccessCodes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  clientName: text("client_name"),
  clientId: integer("client_id"),
  actingFor: text("acting_for"),
  plaintiff: text("plaintiff"),
  defendant: text("defendant"),
  matterType: text("matter_type"),
  court: text("court"),
  suitNo: text("suit_no"),
  claimAmount: numeric("claim_amount", { precision: 14, scale: 2 }),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  // Additive working state for the preparation and practice-workflow surfaces.
  // Keeping it on the owned matter makes it available across sessions without
  // changing any of the original matter fields or exports.
  preparationState: jsonb("preparation_state").$type<LitMatterPreparationState>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const litMatterDeadlines = pgTable("lit_matter_deadlines", {
  id: serial("id").primaryKey(),
  matterId: integer("matter_id")
    .notNull()
    .references(() => litMatters.id, { onDelete: "cascade" }),
  accessCodeId: integer("access_code_id")
    .notNull()
    .references(() => litAccessCodes.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  category: text("category").notNull().default("custom"),
  status: text("status").notNull().default("pending"),
  basis: text("basis"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLitMatterSchema = createInsertSchema(litMatters).omit({
  id: true, accessCodeId: true, createdAt: true, updatedAt: true,
});

export const insertLitMatterDeadlineSchema = createInsertSchema(litMatterDeadlines).omit({
  id: true, matterId: true, accessCodeId: true, createdAt: true, updatedAt: true,
});

export type LitMatter = typeof litMatters.$inferSelect;
export type InsertLitMatter = z.infer<typeof insertLitMatterSchema>;
export type LitMatterDeadline = typeof litMatterDeadlines.$inferSelect;
export type InsertLitMatterDeadline = z.infer<typeof insertLitMatterDeadlineSchema>;
