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
import { litAccessCodes } from "./lit-access-codes";
import { litMatters } from "./lit-matters";

export const litIntakeRecords = pgTable("lit_intake_records", {
  id: serial("id").primaryKey(),
  accessCodeId: integer("access_code_id")
    .notNull()
    .references(() => litAccessCodes.id, { onDelete: "cascade" }),
  matterId: integer("matter_id").references(() => litMatters.id, { onDelete: "set null" }),
  clientName: text("client_name").notNull(),
  clientType: text("client_type").notNull().default("individual"),
  idNumber: text("id_number"),
  contact: text("contact"),
  actingFor: text("acting_for"),
  matterDescription: text("matter_description"),
  adverseParties: text("adverse_parties"),
  sourceOfFunds: text("source_of_funds"),
  pep: text("pep").notNull().default("no"),
  riskRating: text("risk_rating").notNull().default("low"),
  conflictStatus: text("conflict_status").notNull().default("not-run"),
  conflictMatches: jsonb("conflict_matches"),
  amlaNotes: text("amla_notes"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLitIntakeRecordSchema = createInsertSchema(litIntakeRecords).omit({
  id: true, accessCodeId: true, createdAt: true, updatedAt: true,
});

export type LitIntakeRecord = typeof litIntakeRecords.$inferSelect;
export type InsertLitIntakeRecord = z.infer<typeof insertLitIntakeRecordSchema>;
