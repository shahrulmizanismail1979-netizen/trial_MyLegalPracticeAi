import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Server-issued upload grants for the public contribution flow. A row is
// created when POST /storage/uploads/request-url issues a presigned upload
// URL, and consumed atomically (DELETE ... RETURNING) when the uploader
// submits POST /contributions. Arbitrary client-supplied objectPath values
// that were never issued by the server — or were already consumed — are
// rejected, so nobody can point a contribution at somebody else's stored
// object. DB-backed (not in-memory) so the check holds across instances
// and restarts.
export const contributionPendingUploadsTable = pgTable(
  "contribution_pending_uploads",
  {
    id: serial("id").primaryKey(),
    objectPath: text("object_path").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
);

export type ContributionPendingUpload =
  typeof contributionPendingUploadsTable.$inferSelect;
