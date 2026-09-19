import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Manager credentials and the current one-time password challenge for a firm
 * workspace. Challenges deliberately live in the database so attempt limits
 * and one-time consumption can be enforced atomically across server instances.
 */
export const firmWorkspaceCredentialsTable = pgTable(
  "firm_workspace_credentials",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull().default(0),
    passwordHash: text("password_hash"),
    credentialVersion: integer("credential_version").notNull().default(0),
    challengeHash: text("challenge_hash"),
    challengeNonce: text("challenge_nonce"),
    challengeExpiresAt: timestamp("challenge_expires_at", {
      withTimezone: true,
    }),
    challengeAttempts: integer("challenge_attempts").notNull().default(0),
    challengeConsumedAt: timestamp("challenge_consumed_at", {
      withTimezone: true,
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.workspaceId)],
);

export type FirmWorkspaceCredential =
  typeof firmWorkspaceCredentialsTable.$inferSelect;