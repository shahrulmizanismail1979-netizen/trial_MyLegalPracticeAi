import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, meetingsTable, tasksTable, type MeetingMinutes, usersTable } from "../db";
import {
  CreateMeetingBody,
  TranscribeMeetingBody,
  GetMeetingParams,
  DeleteMeetingParams,
  DeleteMeetingBody,
  CreateMeetingTasksParams,
  CreateMeetingTasksBody,
  ExportMeetingDocxParams,
  ExportMeetingGoogleDocParams,
} from "../apiZod";
import { AiProviderError } from "../lib/aiService";
import { generateMinutes } from "../lib/meetingAi";
import {
  listMeetings,
  loadMeeting,
  serializeMeeting,
} from "../lib/meetingService";
import { serializeOne } from "../lib/taskService";
import { requireManagerSession } from "../lib/managerSession";
import { buildMinutesDocx } from "../lib/meetingDocx";
import { syncToDrive } from "../lib/googleDrive";
import { transcribeWithDiarization } from "../lib/transcription";
import { exportMinutesToGoogleDoc } from "../lib/googleDocs";
import { firmAiRateLimit as aiRateLimit } from "../lib/firmAiRateLimit";
import { firmScope, firmValues } from "../lib/workspace";

const router: IRouter = Router();

function aiError(err: unknown, req: { log: { error: Function } }, res: any): boolean {
  if (err instanceof AiProviderError) {
    req.log.error({ err }, "Meeting AI/provider error");
    res.status(502).json({ error: err.message });
    return true;
  }
  return false;
}

// List meetings
router.get("/meetings", async (_req, res): Promise<void> => {
  res.json(await listMeetings());
});

// Transcribe audio with speaker diarization (ElevenLabs)
router.post(
  "/meetings/transcribe",
  aiRateLimit,
  async (req, res): Promise<void> => {
    const parsed = TranscribeMeetingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const audio = Buffer.from(parsed.data.audioBase64, "base64");
      syncToDrive(
        audio,
        `meeting-audio-${new Date().toISOString().replace(/[:.]/g, "-")}.${(parsed.data.mimeType || "audio/webm").split("/")[1]?.split(";")[0] || "webm"}`,
        parsed.data.mimeType || "audio/webm",
        { source: "meeting" },
      );
      const result = await transcribeWithDiarization(audio, parsed.data.mimeType);
      res.json(result);
    } catch (err) {
      if (aiError(err, req, res)) return;
      throw err;
    }
  },
);

// Create a meeting: generate minutes from a transcript and persist
router.post(
  "/meetings",
  aiRateLimit,
  async (req, res): Promise<void> => {
    const parsed = CreateMeetingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { title, lang, segments, rawTranscript, actingUserId } = parsed.data;
    if (actingUserId != null) {
      const [creator] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(firmScope(usersTable), eq(usersTable.id, actingUserId)));
      if (!creator) {
        res.status(400).json({
          error: "Meeting creator does not belong to this workspace.",
        });
        return;
      }
    }
    try {
      const minutes = await generateMinutes(segments, rawTranscript, lang);
      const [meeting] = await db
        .insert(meetingsTable)
        .values({
          ...firmValues(),
          title: title?.trim() || minutes.title,
          lang,
          segments,
          rawTranscript,
          minutes,
          createdById: actingUserId ?? null,
        })
        .returning();
      res.status(201).json(await serializeMeeting(meeting));
    } catch (err) {
      if (aiError(err, req, res)) return;
      throw err;
    }
  },
);

// Get one meeting
router.get("/meetings/:id", async (req, res): Promise<void> => {
  const params = GetMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const meeting = await loadMeeting(params.data.id);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  res.json(await serializeMeeting(meeting));
});

// Delete a meeting (manager only)
router.delete("/meetings/:id", async (req, res): Promise<void> => {
  const params = DeleteMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = DeleteMeetingBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if ((await requireManagerSession(req)) == null) {
    res.status(403).json({ error: "Only managers can delete meetings." });
    return;
  }
  const meeting = await loadMeeting(params.data.id);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  await db.delete(meetingsTable).where(and(firmScope(meetingsTable), eq(meetingsTable.id, params.data.id)));
  res.status(204).end();
});

// Create TaskRadar tasks from selected action items
router.post("/meetings/:id/create-tasks", async (req, res): Promise<void> => {
  const params = CreateMeetingTasksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = CreateMeetingTasksBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const creatorId = await requireManagerSession(req);
  if (creatorId == null) {
    res.status(403).json({ error: "Only managers can create tasks." });
    return;
  }
  const meeting = await loadMeeting(params.data.id);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  if (!meeting.minutes) {
    res.status(400).json({ error: "This meeting has no minutes yet." });
    return;
  }

  const minutes: MeetingMinutes = {
    ...meeting.minutes,
    actionItems: meeting.minutes.actionItems.map((a) => ({ ...a })),
  };
  const now = new Date();
  const created = [];

  for (const item of parsed.data.items) {
    const action = minutes.actionItems[item.actionItemIndex];
    const fallbackTitle = action?.text ?? "Follow-up";
    if (item.ownerId != null) {
      const [owner] = await db.select({ id: usersTable.id }).from(usersTable)
        .where(and(firmScope(usersTable), eq(usersTable.id, item.ownerId)));
      if (!owner) {
        res.status(400).json({ error: "Task owner does not belong to this workspace." });
        return;
      }
    }
    const [task] = await db
      .insert(tasksTable)
      .values({
        ...firmValues(),
        title: item.title?.trim() || fallbackTitle,
        description: `From meeting: ${meeting.title}`,
        category: item.category,
        reason: item.reason,
        status: "todo",
        ownerId: item.ownerId ?? null,
        createdById: creatorId,
        dueAt: item.dueAt ? new Date(item.dueAt) : null,
      })
      .returning();
    if (action) action.taskId = task.id;
    created.push(await serializeOne(task, now));
  }

  const [updated] = await db
    .update(meetingsTable)
    .set({ minutes })
    .where(and(firmScope(meetingsTable), eq(meetingsTable.id, meeting.id)))
    .returning();

  res.json({ created, meeting: await serializeMeeting(updated) });
});

// Export minutes as a Word document
router.post("/meetings/:id/export-docx", async (req, res): Promise<void> => {
  const params = ExportMeetingDocxParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const meeting = await loadMeeting(params.data.id);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  if (!meeting.minutes) {
    res.status(400).json({ error: "This meeting has no minutes yet." });
    return;
  }
  const lang = meeting.lang === "ms" ? "ms" : "en";
  const buffer = await buildMinutesDocx(meeting.minutes, lang);
  const safeName = meeting.title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  res.json({
    filename: `${safeName || "minutes"}.docx`,
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    base64: buffer.toString("base64"),
  });
});

// Export minutes to a Google Doc
router.post("/meetings/:id/export-gdoc", async (req, res): Promise<void> => {
  const params = ExportMeetingGoogleDocParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const meeting = await loadMeeting(params.data.id);
  if (!meeting) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  if (!meeting.minutes) {
    res.status(400).json({ error: "This meeting has no minutes yet." });
    return;
  }
  const lang = meeting.lang === "ms" ? "ms" : "en";
  try {
    const result = await exportMinutesToGoogleDoc(
      meeting.title,
      meeting.minutes,
      lang,
    );
    res.json(result);
  } catch (err) {
    if (aiError(err, req, res)) return;
    throw err;
  }
});

export default router;
