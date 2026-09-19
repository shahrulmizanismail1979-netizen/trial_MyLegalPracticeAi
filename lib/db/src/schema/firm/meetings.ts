import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** A single diarized utterance: who spoke and what they said. */
export type MeetingSegment = {
  speaker: string;
  text: string;
};

/** A follow-up action extracted from the minutes. */
export type MeetingActionItem = {
  text: string;
  owner: string | null;
  /** Set once a TaskRadar task has been created from this action item. */
  taskId: number | null;
};

/** Structured, formatted minutes derived from the transcript. */
export type MeetingMinutes = {
  title: string;
  summary: string;
  attendees: string[];
  agenda: { topic: string; discussion: string; decisions: string[] }[];
  decisions: string[];
  actionItems: MeetingActionItem[];
};

export const meetingsTable = pgTable("firm_meetings", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().default(0),
  title: text("title").notNull(),
  lang: text("lang").notNull().default("en"),
  segments: jsonb("segments").$type<MeetingSegment[]>().notNull().default([]),
  rawTranscript: text("raw_transcript").notNull().default(""),
  minutes: jsonb("minutes").$type<MeetingMinutes | null>(),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMeetingSchema = createInsertSchema(meetingsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type Meeting = typeof meetingsTable.$inferSelect;
