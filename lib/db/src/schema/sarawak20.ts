import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sarawak20ReservationsTable = pgTable(
  "sarawak20_reservations",
  {
    id: text("id").primaryKey(),
    cohort: text("cohort").notNull(),
    plan: text("plan").notNull().default("legacy"),
    eligibilityId: text("eligibility_id"),
    requestId: text("request_id").notNull().unique(),
    checkoutSessionId: text("checkout_session_id").unique(),
    checkoutUrl: text("checkout_url"),
    subscriptionId: text("subscription_id").unique(),
    subscriberId: integer("subscriber_id"),
    status: text("status").notNull().default("creating"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
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

export const sarawak20EligibilityTable = pgTable(
  "sarawak20_eligibility",
  {
    id: text("id").primaryKey(),
    cohort: text("cohort").notNull(),
    fullName: text("full_name").notNull(),
    firmName: text("firm_name"),
    practiceLocation: text("practice_location"),
    advocateName: text("advocate_name"),
    pupilMasterName: text("pupil_master_name"),
    pupillageStartDate: date("pupillage_start_date", { mode: "string" }),
    noticeAcknowledgement: boolean("notice_acknowledgement"),
    cmsPetitionNumber: text("cms_petition_number"),
    professionalReference: text("professional_reference"),
    declarationAccepted: boolean("declaration_accepted").notNull(),
    status: text("status").notNull().default("verified"),
    source: text("source").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    checkoutSessionId: text("checkout_session_id"),
    subscriptionId: text("subscription_id"),
    subscriberId: integer("subscriber_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("sarawak20_eligibility_cohort_status_idx").on(
      table.cohort,
      table.status,
    ),
    index("sarawak20_eligibility_cache_idx").on(
      table.cohort,
      table.advocateName,
      table.firmName,
      table.practiceLocation,
      table.status,
    ),
  ],
);

export const insertSarawak20EligibilitySchema = createInsertSchema(
  sarawak20EligibilityTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSarawak20Eligibility = z.infer<
  typeof insertSarawak20EligibilitySchema
>;
export type Sarawak20Reservation =
  typeof sarawak20ReservationsTable.$inferSelect;
