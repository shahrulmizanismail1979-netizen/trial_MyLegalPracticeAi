import { boolean, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { corpAccessCodes } from "./corp-access-codes";

export const corpSessions = pgTable("corp_sessions", {
  id: serial("id").primaryKey(),
  accessCodeId: integer("access_code_id")
    .notNull()
    .references(() => corpAccessCodes.id, { onDelete: "cascade" }),
  sessionToken: varchar("session_token", { length: 64 }).notNull().unique(),
  deviceInfo: text("device_info"),
  isActive: boolean("is_active").default(true).notNull(),
  loggedInAt: timestamp("logged_in_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
});

export type CorpSession = typeof corpSessions.$inferSelect;
