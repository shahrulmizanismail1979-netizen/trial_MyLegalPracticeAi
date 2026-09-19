import { db, usersTable } from "../db";
import { firmScope } from "./workspace";
import type { MeetingSegment, MeetingMinutes } from "../db";
import { z } from "zod/v4";
import {
  AiProviderError,
  callModel,
  callVisionModel,
  langName,
  type Lang,
} from "./aiService";

const TASK_REASONS = [
  "partner",
  "compliance",
  "manager",
  "client",
  "internal",
  "finance",
  "other",
] as const;

const TASK_CATEGORIES = ["urgent", "backlog"] as const;

// ---------------------------------------------------------------------------
// Shared team context + owner scrubbing
// ---------------------------------------------------------------------------

export type TeamMember = { id: number; name: string; role: string };

export async function loadTeam(): Promise<TeamMember[]> {
  const users = await db.select().from(usersTable).where(firmScope(usersTable));
  return users.map((u) => ({ id: u.id, name: u.name, role: u.role }));
}

function teamContext(team: TeamMember[]): string {
  return JSON.stringify(
    team.map((m) => ({ ownerId: m.id, ownerName: m.name, role: m.role })),
  );
}

/** Accept a suggested owner id only if it exists on the team. */
function scrubOwner(
  team: TeamMember[],
  ownerId: number | null | undefined,
): { suggestedOwnerId: number | null; suggestedOwnerName: string | null } {
  if (ownerId == null) return { suggestedOwnerId: null, suggestedOwnerName: null };
  const match = team.find((m) => m.id === ownerId);
  return match
    ? { suggestedOwnerId: match.id, suggestedOwnerName: match.name }
    : { suggestedOwnerId: null, suggestedOwnerName: null };
}

// ---------------------------------------------------------------------------
// Task draft shape (shared by voice + ingest)
// ---------------------------------------------------------------------------

const draftSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullish(),
  suggestedOwnerId: z.number().nullish(),
  suggestedOwnerName: z.string().nullish(),
  category: z.enum(TASK_CATEGORIES),
  reason: z.enum(TASK_REASONS),
  dueAt: z.string().nullish(),
  sourceQuote: z.string().nullish(),
});

export type TaskDraft = {
  title: string;
  description: string | null;
  suggestedOwnerId: number | null;
  suggestedOwnerName: string | null;
  category: (typeof TASK_CATEGORIES)[number];
  reason: (typeof TASK_REASONS)[number];
  dueAt: string | null;
  sourceQuote: string | null;
};

function normalizeDraft(
  team: TeamMember[],
  raw: z.infer<typeof draftSchema>,
): TaskDraft {
  const owner = scrubOwner(team, raw.suggestedOwnerId ?? null);
  return {
    title: raw.title,
    description: raw.description ?? null,
    ...owner,
    category: raw.category,
    reason: raw.reason,
    dueAt: raw.dueAt ?? null,
    sourceQuote: raw.sourceQuote ?? null,
  };
}

const draftRules = [
  `Pick category from: ${TASK_CATEGORIES.join(", ")} ('urgent' only if time-critical or high-impact).`,
  `Pick exactly one reason from: ${TASK_REASONS.join(", ")}.`,
  "Suggest an owner only using a real ownerId from the team data, or null if unclear.",
  "dueAt must be an ISO 8601 date-time string or null. Never invent a deadline that was not stated.",
];

// ---------------------------------------------------------------------------
// Meeting minutes
// ---------------------------------------------------------------------------

const minutesSchema = z.object({
  title: z.string().min(1),
  summary: z.string(),
  attendees: z.array(z.string()),
  agenda: z.array(
    z.object({
      topic: z.string(),
      discussion: z.string(),
      decisions: z.array(z.string()),
    }),
  ),
  decisions: z.array(z.string()),
  actionItems: z.array(
    z.object({
      text: z.string().min(1),
      owner: z.string().nullish(),
    }),
  ),
});

export async function generateMinutes(
  segments: MeetingSegment[],
  rawTranscript: string,
  lang: Lang,
): Promise<MeetingMinutes> {
  const transcript =
    segments.length > 0
      ? segments.map((s) => `${s.speaker}: ${s.text}`).join("\n")
      : rawTranscript;

  if (transcript.trim() === "") {
    throw new AiProviderError("The transcript is empty; nothing to summarise.");
  }

  const system = [
    "You are a precise corporate secretary for a Malaysian professional-services firm, producing formal meeting minutes from a transcript.",
    "Read the diarized transcript and produce accurate, well-structured minutes. Do not invent facts, attendees, decisions, or action items that are not supported by the transcript.",
    "Identify attendees from speaker labels and context. Group the discussion into agenda topics. Capture concrete decisions and clearly assigned follow-up action items.",
    "For each action item, set 'owner' to the name of the person responsible if it is clear from the transcript, otherwise null.",
    `Write every human-readable string in ${langName(lang)}. Keep names and proper nouns as-is.`,
    'Respond ONLY with a JSON object of this exact shape: {"title": string, "summary": string, "attendees": string[], "agenda": [{"topic": string, "discussion": string, "decisions": string[]}], "decisions": string[], "actionItems": [{"text": string, "owner": string|null}]}.',
  ].join("\n");

  const user = `Meeting transcript:\n${transcript}`;
  const data = await callModel(system, user);

  let parsed;
  try {
    parsed = minutesSchema.parse(data);
  } catch (err) {
    throw new AiProviderError(
      `The AI minutes response did not match the expected format: ${(err as Error).message}`,
    );
  }

  return {
    title: parsed.title,
    summary: parsed.summary,
    attendees: parsed.attendees,
    agenda: parsed.agenda,
    decisions: parsed.decisions,
    actionItems: parsed.actionItems.map((a) => ({
      text: a.text,
      owner: a.owner ?? null,
      taskId: null,
    })),
  };
}

// ---------------------------------------------------------------------------
// Voice instruction → task draft + assistant reply
// ---------------------------------------------------------------------------

const voiceSchema = z.object({
  draft: draftSchema,
  assistantReply: z.string().min(1),
  missing: z.array(z.string()),
});

export async function parseVoiceInstruction(
  transcript: string,
  lang: Lang,
): Promise<{ draft: TaskDraft; assistantReply: string; missing: string[] }> {
  if (transcript.trim() === "") {
    throw new AiProviderError("The voice instruction was empty.");
  }
  const team = await loadTeam();

  const system = [
    "You are a task-capture assistant for TaskRadar, a Malaysian professional-services team task manager.",
    "A manager or staff member has spoken an instruction to create a task. Turn it into a single clear task draft.",
    ...draftRules,
    "Also write a short, friendly assistantReply that confirms what you captured and reminds the user of any important details still missing (owner, due date, priority/category, or context). The reply must be conversational, not a list of field names.",
    "Set 'missing' to an array of the still-missing detail keys among: 'owner', 'dueAt', 'category', 'context'. Use an empty array if nothing important is missing.",
    `Write 'assistantReply' and the draft's title/description in ${langName(lang)}. Keep names as-is.`,
    'Respond ONLY with a JSON object of this exact shape: {"draft": {"title": string, "description": string|null, "suggestedOwnerId": number|null, "suggestedOwnerName": string|null, "category": "urgent"|"backlog", "reason": one of the allowed reasons, "dueAt": string|null}, "assistantReply": string, "missing": string[]}.',
  ].join("\n");

  const user = `Team (JSON):\n${teamContext(team)}\n\nSpoken instruction (transcribed):\n${transcript}`;
  const data = await callModel(system, user);

  let parsed;
  try {
    parsed = voiceSchema.parse(data);
  } catch (err) {
    throw new AiProviderError(
      `The AI voice response did not match the expected format: ${(err as Error).message}`,
    );
  }

  return {
    draft: normalizeDraft(team, parsed.draft),
    assistantReply: parsed.assistantReply,
    missing: parsed.missing,
  };
}

// ---------------------------------------------------------------------------
// Screenshot (WhatsApp chat) → task drafts
// ---------------------------------------------------------------------------

const draftsSchema = z.object({
  drafts: z.array(draftSchema),
  note: z.string().nullish(),
});

export async function parseScreenshot(
  imageDataUrl: string,
  lang: Lang,
): Promise<{ drafts: TaskDraft[]; note: string | null }> {
  const team = await loadTeam();

  const system = [
    "You are an intake assistant for TaskRadar. You are shown a screenshot of a chat conversation (often WhatsApp).",
    "Read the messages and extract every actionable task or request that someone should follow up on. Ignore greetings, chit-chat, and acknowledgements.",
    ...draftRules,
    "For each task, set 'sourceQuote' to the exact chat message text it came from.",
    "If the image contains no actionable tasks, return an empty drafts array and explain why in 'note'.",
    `Write each draft's title/description and any note in ${langName(lang)}. Keep names and quotes as-is.`,
    'Respond ONLY with a JSON object of this exact shape: {"drafts": [{"title": string, "description": string|null, "suggestedOwnerId": number|null, "suggestedOwnerName": string|null, "category": "urgent"|"backlog", "reason": one of the allowed reasons, "dueAt": string|null, "sourceQuote": string|null}], "note": string|null}.',
  ].join("\n");

  const data = await callVisionModel(
    system,
    `Team (JSON):\n${teamContext(team)}\n\nExtract the actionable tasks from this chat screenshot.`,
    imageDataUrl,
  );

  let parsed;
  try {
    parsed = draftsSchema.parse(data);
  } catch (err) {
    throw new AiProviderError(
      `The AI screenshot response did not match the expected format: ${(err as Error).message}`,
    );
  }

  return {
    drafts: parsed.drafts.map((d) => normalizeDraft(team, d)),
    note: parsed.note ?? null,
  };
}

// ---------------------------------------------------------------------------
// Documents (PDF / Word / text) → task drafts
// ---------------------------------------------------------------------------

export async function parseDocumentToDrafts(
  text: string,
  filename: string,
  lang: Lang,
): Promise<{ drafts: TaskDraft[]; note: string | null }> {
  const trimmed = (text ?? "").trim();
  if (!trimmed) {
    return { drafts: [], note: null };
  }
  const team = await loadTeam();

  const system = [
    "You are an intake assistant for TaskRadar, a Malaysian professional-services team task manager.",
    "You are given the text contents of an uploaded document (e.g. a meeting note, memo, official letter, or report). Extract every actionable task the team should follow up on. Ignore letterheads, signatures, boilerplate, and pure background information.",
    ...draftRules,
    "For each task, set 'sourceQuote' to the sentence or phrase in the document it came from.",
    "If the document contains no actionable tasks, return an empty drafts array and explain why in 'note'.",
    `Write each draft's title/description and any note in ${langName(lang)}. Keep names and quotes as-is.`,
    'Respond ONLY with a JSON object of this exact shape: {"drafts": [{"title": string, "description": string|null, "suggestedOwnerId": number|null, "suggestedOwnerName": string|null, "category": "urgent"|"backlog", "reason": one of the allowed reasons, "dueAt": string|null, "sourceQuote": string|null}], "note": string|null}.',
  ].join("\n");

  const user = `Team (JSON):\n${teamContext(team)}\n\nDocument filename: ${filename}\n\nDocument text:\n${trimmed}`;
  const data = await callModel(system, user);

  let parsed;
  try {
    parsed = draftsSchema.parse(data);
  } catch (err) {
    throw new AiProviderError(
      `The AI document response did not match the expected format: ${(err as Error).message}`,
    );
  }

  return {
    drafts: parsed.drafts.map((d) => normalizeDraft(team, d)),
    note: parsed.note ?? null,
  };
}

// ---------------------------------------------------------------------------
// Emails → task drafts
// ---------------------------------------------------------------------------

export type EmailInput = {
  from: string;
  subject: string;
  body: string;
  date: string | null;
};

export async function parseEmailsToDrafts(
  emails: EmailInput[],
  lang: Lang,
): Promise<{ drafts: TaskDraft[]; note: string | null }> {
  if (emails.length === 0) {
    return { drafts: [], note: null };
  }
  const team = await loadTeam();

  const system = [
    "You are an intake assistant for TaskRadar, a Malaysian professional-services team task manager.",
    "You are given recent emails. Extract actionable tasks the team should follow up on. Ignore newsletters, receipts, and pure FYI messages.",
    ...draftRules,
    "For each task, set 'sourceQuote' to the email subject (and sender) it came from.",
    "If no emails are actionable, return an empty drafts array.",
    `Write each draft's title/description in ${langName(lang)}. Keep names and quotes as-is.`,
    'Respond ONLY with a JSON object of this exact shape: {"drafts": [{"title": string, "description": string|null, "suggestedOwnerId": number|null, "suggestedOwnerName": string|null, "category": "urgent"|"backlog", "reason": one of the allowed reasons, "dueAt": string|null, "sourceQuote": string|null}], "note": string|null}.',
  ].join("\n");

  const user = `Team (JSON):\n${teamContext(team)}\n\nRecent emails (JSON):\n${JSON.stringify(emails)}`;
  const data = await callModel(system, user);

  let parsed;
  try {
    parsed = draftsSchema.parse(data);
  } catch (err) {
    throw new AiProviderError(
      `The AI email response did not match the expected format: ${(err as Error).message}`,
    );
  }

  return {
    drafts: parsed.drafts.map((d) => normalizeDraft(team, d)),
    note: parsed.note ?? null,
  };
}
