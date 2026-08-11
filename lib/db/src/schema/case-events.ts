import { pgTable, serial, text, integer, date, timestamp } from "drizzle-orm/pg-core";

// Shared per-matter chronology / activity stream used by all portals.
// Portal-scoped (portal + matter_id + owner_key) so a single table serves
// every portal (lit/crim/sya/corp/ccb/acc). Rows are the timeline events for
// a matter — filings, hearings, correspondence, saved work, notes, etc.
// Created at boot via direct SQL (see caseEvents.ts ensureCaseEventsTable) —
// NOT drizzle push (rename trap). This schema only mirrors the table shape.
export const caseEvents = pgTable("case_events", {
  id: serial("id").primaryKey(),
  portal: text("portal").notNull(),
  matterId: integer("matter_id").notNull(),
  ownerKey: text("owner_key").notNull(),
  eventDate: date("event_date").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  kind: text("kind").notNull(),
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CaseEvent = typeof caseEvents.$inferSelect;
export type InsertCaseEvent = typeof caseEvents.$inferInsert;
