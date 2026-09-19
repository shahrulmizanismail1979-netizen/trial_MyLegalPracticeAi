import { eq, desc, and } from "drizzle-orm";
import {
  db,
  meetingsTable,
  tasksTable,
  usersTable,
  type Meeting,
  type MeetingMinutes,
} from "../db";
import { serializeOne } from "./taskService";
import type { SerializedTask } from "./taskLogic";
import type { TaskDraft } from "./meetingAi";
import { firmScope, firmValues } from "./workspace";
import { isKnownUser } from "./goalService";

export type SerializedMeeting = {
  id: number;
  title: string;
  lang: "en" | "ms";
  segments: Meeting["segments"];
  rawTranscript: string;
  minutes: MeetingMinutes | null;
  createdById: number | null;
  createdByName: string | null;
  createdAt: string;
};

async function nameMap(): Promise<Map<number, string>> {
  const users = await db.select().from(usersTable).where(firmScope(usersTable));
  return new Map(users.map((u) => [u.id, u.name]));
}

function serialize(
  meeting: Meeting,
  names: Map<number, string>,
): SerializedMeeting {
  return {
    id: meeting.id,
    title: meeting.title,
    lang: meeting.lang === "ms" ? "ms" : "en",
    segments: meeting.segments,
    rawTranscript: meeting.rawTranscript,
    minutes: meeting.minutes ?? null,
    createdById: meeting.createdById ?? null,
    createdByName:
      meeting.createdById != null
        ? (names.get(meeting.createdById) ?? null)
        : null,
    createdAt: meeting.createdAt.toISOString(),
  };
}

export async function serializeMeeting(
  meeting: Meeting,
): Promise<SerializedMeeting> {
  return serialize(meeting, await nameMap());
}

export async function listMeetings(): Promise<SerializedMeeting[]> {
  const rows = await db
    .select()
    .from(meetingsTable)
    .where(firmScope(meetingsTable))
    .orderBy(desc(meetingsTable.createdAt));
  const names = await nameMap();
  return rows.map((m) => serialize(m, names));
}

export async function loadMeeting(id: number): Promise<Meeting | undefined> {
  const [meeting] = await db
    .select()
    .from(meetingsTable)
    .where(and(firmScope(meetingsTable), eq(meetingsTable.id, id)));
  return meeting;
}

/** Create a TaskRadar task from a draft (voice / ingest). */
export async function createTaskFromDraft(
  draft: TaskDraft,
  actingUserId: number | null,
): Promise<SerializedTask> {
  if (actingUserId != null && !(await isKnownUser(actingUserId))) {
    throw new Error("Task creator does not belong to this workspace.");
  }
  if (draft.suggestedOwnerId != null && !(await isKnownUser(draft.suggestedOwnerId))) {
    throw new Error("Task owner does not belong to this workspace.");
  }
  const [task] = await db
    .insert(tasksTable)
    .values({
      ...firmValues(),
      title: draft.title,
      description: draft.description ?? null,
      category: draft.category,
      reason: draft.reason,
      status: "todo",
      ownerId: draft.suggestedOwnerId ?? null,
      createdById: actingUserId,
      dueAt: draft.dueAt ? new Date(draft.dueAt) : null,
    })
    .returning();
  return serializeOne(task, new Date());
}
