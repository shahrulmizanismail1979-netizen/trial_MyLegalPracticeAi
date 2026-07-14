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

export const litSavedWork = pgTable("lit_saved_work", {
  id: serial("id").primaryKey(),
  accessCodeId: integer("access_code_id")
    .notNull()
    .references(() => litAccessCodes.id, { onDelete: "cascade" }),
  matterId: integer("matter_id"),
  clientId: integer("client_id"),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  matter: text("matter"),
  inputJson: jsonb("input_json"),
  content: text("content").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLitSavedWorkSchema = createInsertSchema(litSavedWork).omit({
  id: true, accessCodeId: true, createdAt: true, updatedAt: true,
});

export type LitSavedWork = typeof litSavedWork.$inferSelect;
export type InsertLitSavedWork = z.infer<typeof insertLitSavedWorkSchema>;
