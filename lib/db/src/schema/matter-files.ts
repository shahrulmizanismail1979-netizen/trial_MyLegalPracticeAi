import {
  pgTable,
  serial,
  text,
  integer,
  jsonb,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { corpAccessCodes } from "./corp-access-codes";
import { ccbAccessCodes } from "./ccb-access-codes";
import { usersTable } from "./users";

/**
 * Matter-file tables for the three corporate portals (Task #110), mirroring
 * the MyLitAI pattern (lit-matters.ts + lit-saved-work.ts):
 *  - <prefix>_matters:          the matter file itself, owned per access code / user
 *  - <prefix>_matter_deadlines: deadlines tracked against a matter
 *  - <prefix>_saved_work:       filed documents (AI drafts, checklists, schedules)
 *
 * All three portals share the same shape so the api-server can serve them from
 * one route factory. Tables are created via direct SQL (see
 * artifacts/api-server/src/lib/matterFiles.ts ensure function) — NOT drizzle
 * push, which has previously proposed renaming unrelated tables.
 */
function makeMatterFileTables(
  prefix: string,
  ownerColumn: string,
  ownerRef: () => AnyPgColumn,
) {
  const matters = pgTable(`${prefix}_matters`, {
    id: serial("id").primaryKey(),
    ownerId: integer(ownerColumn)
      .notNull()
      .references(ownerRef, { onDelete: "cascade" }),
    title: text("title").notNull(),
    clientName: text("client_name"),
    counterparty: text("counterparty"),
    matterType: text("matter_type"),
    reference: text("reference"),
    status: text("status").notNull().default("open"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });

  const deadlines = pgTable(`${prefix}_matter_deadlines`, {
    id: serial("id").primaryKey(),
    matterId: integer("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    ownerId: integer(ownerColumn)
      .notNull()
      .references(ownerRef, { onDelete: "cascade" }),
    title: text("title").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    category: text("category").notNull().default("custom"),
    status: text("status").notNull().default("pending"),
    basis: text("basis"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });

  const savedWork = pgTable(`${prefix}_saved_work`, {
    id: serial("id").primaryKey(),
    ownerId: integer(ownerColumn)
      .notNull()
      .references(ownerRef, { onDelete: "cascade" }),
    matterId: integer("matter_id"),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    matter: text("matter"),
    inputJson: jsonb("input_json"),
    content: text("content").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  });

  return { matters, deadlines, savedWork };
}

// MyCorpLegalAI — owned per corp access code.
export const corpMatterFiles = makeMatterFileTables(
  "corp",
  "access_code_id",
  () => corpAccessCodes.id,
);
export const corpMatters = corpMatterFiles.matters;
export const corpMatterDeadlines = corpMatterFiles.deadlines;
export const corpSavedWork = corpMatterFiles.savedWork;

// MyCCBLitAI — owned per ccb access code.
export const ccbMatterFiles = makeMatterFileTables(
  "ccb",
  "access_code_id",
  () => ccbAccessCodes.id,
);
export const ccbMatters = ccbMatterFiles.matters;
export const ccbMatterDeadlines = ccbMatterFiles.deadlines;
export const ccbSavedWork = ccbMatterFiles.savedWork;

// MyConveyLitAI — owned per convey user (users table); matters map to
// conveyancing transactions (SPA, tenancy, POA, completion).
export const conveyMatterFiles = makeMatterFileTables(
  "convey",
  "user_id",
  () => usersTable.id,
);
export const conveyMatters = conveyMatterFiles.matters;
export const conveyMatterDeadlines = conveyMatterFiles.deadlines;
export const conveySavedWork = conveyMatterFiles.savedWork;

export type MatterFileTables = ReturnType<typeof makeMatterFileTables>;
export type PortalMatter = typeof corpMatters.$inferSelect;
export type PortalMatterDeadline = typeof corpMatterDeadlines.$inferSelect;
export type PortalSavedWork = typeof corpSavedWork.$inferSelect;
