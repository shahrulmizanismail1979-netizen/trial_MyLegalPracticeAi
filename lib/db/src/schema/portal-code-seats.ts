import { pgTable, text, serial, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Concurrent-seat tracking for portal access codes (team-bundle seat limits).
 * One row = one active "seat" (device/session) on a code within a portal.
 * Seats expire after a period of inactivity (see api-server seatLimits lib),
 * so an abandoned device eventually frees its seat.
 */
export const portalCodeSeatsTable = pgTable(
  "portal_code_seats",
  {
    id: serial("id").primaryKey(),
    /** Portal key: crim | lit | sya | ccb | firm | convey (accident + corp have their own tables). */
    portal: text("portal").notNull(),
    /** Normalized (uppercase) access code. */
    code: text("code").notNull(),
    /** Session ID or device fingerprint identifying the seat holder. */
    seatKey: text("seat_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    seatUniq: uniqueIndex("portal_code_seats_portal_code_seat_key_uniq").on(
      t.portal,
      t.code,
      t.seatKey,
    ),
  }),
);

export type PortalCodeSeat = typeof portalCodeSeatsTable.$inferSelect;
