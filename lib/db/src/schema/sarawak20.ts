import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const sarawak20ReservationsTable = pgTable(
  "sarawak20_reservations",
  {
    id: text("id").primaryKey(),
    cohort: text("cohort").notNull(),
    requestId: text("request_id").notNull().unique(),
    checkoutSessionId: text("checkout_session_id").unique(),
    checkoutUrl: text("checkout_url"),
    subscriptionId: text("subscription_id").unique(),
    subscriberId: integer("subscriber_id"),
    status: text("status").notNull().default("creating"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("sarawak20_reservations_capacity_idx").on(
      table.cohort,
      table.status,
      table.expiresAt,
    ),
  ],
);

export type Sarawak20Reservation = typeof sarawak20ReservationsTable.$inferSelect;