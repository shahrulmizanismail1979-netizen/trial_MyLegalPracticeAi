import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { litAccessCodes } from "./lit-access-codes";
import { litMatters } from "./lit-matters";

/** Additive LAWYes identities. The access-code row remains the tenant. */
export const litLawyesMembers = pgTable("lit_lawyes_members", {
  id: serial("id").primaryKey(),
  accessCodeId: integer("access_code_id").notNull()
    .references(() => litAccessCodes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("viewer"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("lit_lawyes_members_tenant_idx").on(table.accessCodeId),
]);

/** One-way credentials are deliberately separate from member profile data. */
export const litLawyesCredentials = pgTable("lit_lawyes_credentials", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull()
    .references(() => litLawyesMembers.id, { onDelete: "cascade" }),
  codeLookupHash: text("code_lookup_hash").notNull(),
  codeHash: text("code_hash").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("lit_lawyes_credentials_lookup_uidx").on(table.codeLookupHash),
  uniqueIndex("lit_lawyes_credentials_member_uidx").on(table.memberId),
]);

export const litLawyesInvitations = pgTable("lit_lawyes_invitations", {
  id: serial("id").primaryKey(),
  accessCodeId: integer("access_code_id").notNull()
    .references(() => litAccessCodes.id, { onDelete: "cascade" }),
  memberId: integer("member_id").notNull()
    .references(() => litLawyesMembers.id, { onDelete: "cascade" }),
  invitedByMemberId: integer("invited_by_member_id")
    .references(() => litLawyesMembers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
}, (table) => [
  index("lit_lawyes_invitations_tenant_idx").on(table.accessCodeId),
]);

export const litLawyesMatterGrants = pgTable("lit_lawyes_matter_grants", {
  id: serial("id").primaryKey(),
  accessCodeId: integer("access_code_id").notNull()
    .references(() => litAccessCodes.id, { onDelete: "cascade" }),
  matterId: integer("matter_id").notNull()
    .references(() => litMatters.id, { onDelete: "cascade" }),
  memberId: integer("member_id").notNull()
    .references(() => litLawyesMembers.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("lit_lawyes_matter_grants_matter_member_uidx").on(table.matterId, table.memberId),
  index("lit_lawyes_matter_grants_member_idx").on(table.accessCodeId, table.memberId),
]);

export const litLawyesAuditEvents = pgTable("lit_lawyes_audit_events", {
  id: serial("id").primaryKey(),
  accessCodeId: integer("access_code_id").notNull()
    .references(() => litAccessCodes.id, { onDelete: "cascade" }),
  actorMemberId: integer("actor_member_id")
    .references(() => litLawyesMembers.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  details: jsonb("details").$type<Record<string, string | null>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("lit_lawyes_audit_tenant_created_idx").on(table.accessCodeId, table.createdAt),
]);

export const insertLitLawyesMemberSchema = createInsertSchema(litLawyesMembers);
export type LitLawyesMember = typeof litLawyesMembers.$inferSelect;
export type LitLawyesRole = "owner" | "editor" | "viewer";
export type InsertLitLawyesMember = z.infer<typeof insertLitLawyesMemberSchema>;