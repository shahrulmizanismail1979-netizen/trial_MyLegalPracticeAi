import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { litAccessCodes } from "./lit-access-codes";

export const litClients = pgTable("lit_clients", {
  id: serial("id").primaryKey(),
  accessCodeId: integer("access_code_id")
    .notNull()
    .references(() => litAccessCodes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  reference: text("reference"),
  clientType: text("client_type"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const litClientDocuments = pgTable("lit_client_documents", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => litClients.id, { onDelete: "cascade" }),
  accessCodeId: integer("access_code_id")
    .notNull()
    .references(() => litAccessCodes.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  objectPath: text("object_path").notNull(),
  contentType: text("content_type"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLitClientSchema = createInsertSchema(litClients).omit({
  id: true, accessCodeId: true, createdAt: true, updatedAt: true,
});

export const insertLitClientDocumentSchema = createInsertSchema(litClientDocuments).omit({
  id: true, accessCodeId: true, createdAt: true,
});

export type LitClient = typeof litClients.$inferSelect;
export type InsertLitClient = z.infer<typeof insertLitClientSchema>;
export type LitClientDocument = typeof litClientDocuments.$inferSelect;
export type InsertLitClientDocument = z.infer<typeof insertLitClientDocumentSchema>;
