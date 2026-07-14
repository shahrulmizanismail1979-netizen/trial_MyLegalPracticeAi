import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { litAccessCodes } from "./lit-access-codes";
import { litMatters } from "./lit-matters";

export const litBundles = pgTable("lit_bundles", {
  id: serial("id").primaryKey(),
  accessCodeId: integer("access_code_id")
    .notNull()
    .references(() => litAccessCodes.id, { onDelete: "cascade" }),
  matterId: integer("matter_id").references(() => litMatters.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  bundleType: text("bundle_type").notNull().default("other"),
  court: text("court"),
  suitNo: text("suit_no"),
  parties: text("parties"),
  startPage: integer("start_page").notNull().default(1),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const litBundleDocuments = pgTable("lit_bundle_documents", {
  id: serial("id").primaryKey(),
  bundleId: integer("bundle_id")
    .notNull()
    .references(() => litBundles.id, { onDelete: "cascade" }),
  accessCodeId: integer("access_code_id")
    .notNull()
    .references(() => litAccessCodes.id, { onDelete: "cascade" }),
  section: text("section"),
  title: text("title").notNull(),
  docType: text("doc_type").notNull().default("other"),
  docDate: text("doc_date"),
  pageCount: integer("page_count").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLitBundleSchema = createInsertSchema(litBundles).omit({
  id: true, accessCodeId: true, createdAt: true, updatedAt: true,
});

export const insertLitBundleDocumentSchema = createInsertSchema(litBundleDocuments).omit({
  id: true, bundleId: true, accessCodeId: true, createdAt: true, updatedAt: true,
});

export type LitBundle = typeof litBundles.$inferSelect;
export type InsertLitBundle = z.infer<typeof insertLitBundleSchema>;
export type LitBundleDocument = typeof litBundleDocuments.$inferSelect;
export type InsertLitBundleDocument = z.infer<typeof insertLitBundleDocumentSchema>;
