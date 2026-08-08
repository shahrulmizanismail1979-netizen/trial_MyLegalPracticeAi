import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { litAccessCodes } from "./lit-access-codes";

// Binds each issued direct-to-storage upload path to the access code that
// requested it, so only that subscriber can extract (and thereby delete) the
// stored object. Rows are one-time use: consumed atomically at extraction.
// DB-backed (not in-memory) so the check holds across instances/restarts.
export const litPendingUploads = pgTable("lit_pending_uploads", {
  id: serial("id").primaryKey(),
  objectPath: text("object_path").notNull().unique(),
  accessCodeId: integer("access_code_id")
    .notNull()
    .references(() => litAccessCodes.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type LitPendingUpload = typeof litPendingUploads.$inferSelect;
