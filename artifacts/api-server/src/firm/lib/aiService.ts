import { eq } from "drizzle-orm";
import { db, tasksTable, usersTable } from "../db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  GenerateAiBriefingResponse,
  AiTriageTaskResponse,
  AiBuildGoalResponse,
} from "../apiZod";
import { serializeTasks } from "./taskService";
import type { SerializedTask } from "./taskLogic";

export type Lang = "en" | "ms";

const TASK_REASONS = [
  "partner",
  "compliance",
  "manager",
  "client",
  "internal",
  "finance",
  "other",
] as const;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Thrown when the AI provider returns nothing usable. Routes map this to 502. */
export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}

export function langName(lang: Lang): string {
  return lang === "ms"
    ? "formal Bahasa Melayu Rasmi (Dewan Bahasa dan Pustaka register)"
    : "English";
}

/** Extract the first JSON object from a model response, tolerating code fences. */
export function parseJsonObject(raw: string | null | undefined): unknown {
  if (!raw || raw.trim() === "") {
    throw new AiProviderError("The AI returned an empty response.");
  }
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new AiProviderError("The AI response was not valid JSON.");
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AiProviderError("The AI response could not be parsed as JSON.");
  }
}

export async function callModel(
  system: string,
  user: string,
): Promise<unknown> {
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
  } catch (err) {
    throw new AiProviderError(
      `The AI provider request failed: ${(err as Error).message}`,
    );
  }
  return parseJsonObject(completion.choices[0]?.message?.content);
}

/** Like callModel but accepts an image (data URL) for vision tasks. */
export async function callVisionModel(
  system: string,
  userText: string,
  imageDataUrl: string,
): Promise<unknown> {
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    });
  } catch (err) {
    throw new AiProviderError(
      `The AI provider request failed: ${(err as Error).message}`,
    );
  }
  return parseJsonObject(completion.choices[0]?.message?.content);
}

// ---------------------------------------------------------------------------
// AI Manager Briefing
// ---------------------------------------------------------------------------

type OwnerLoad = {
  ownerId: number | null;
  ownerName: string;
  role: string;
  openTasks: number;
  urgent: number;
  overdue: number;
  blocked: number;
  unacknowledged: number;
};

function buildOwnerLoads(
  open: SerializedTask[],
  users: { id: number; name: string; role: string }[],
  now: Date,
): OwnerLoad[] {
  const byId = new Map<number, OwnerLoad>();
  for (const u of users) {
    byId.set(u.id, {
      ownerId: u.id,
      ownerName: u.name,
      role: u.role,
      openTasks: 0,
      urgent: 0,
      overdue: 0,
      blocked: 0,
      unacknowledged: 0,
    });
  }
  const unassigned: OwnerLoad = {
    ownerId: null,
    ownerName: "Unassigned",
    role: "—",
    openTasks: 0,
    urgent: 0,
    overdue: 0,
    blocked: 0,
    unacknowledged: 0,
  };
  for (const t of open) {
    const entry = t.ownerId != null ? byId.get(t.ownerId) : undefined;
    const target = entry ?? unassigned;
    target.openTasks += 1;
    if (t.category === "urgent") target.urgent += 1;
    if (t.dueAt && new Date(t.dueAt).getTime() < now.getTime())
      target.overdue += 1;
    if (t.status === "blocked") target.blocked += 1;
    if (t.category === "urgent" && !t.acknowledgedAt)
      target.unacknowledged += 1;
  }
  const result = Array.from(byId.values());
  if (unassigned.openTasks > 0) result.push(unassigned);
  return result;
}

function compactTask(t: SerializedTask, now: Date) {
  return {
    id: t.id,
    title: t.title,
    category: t.category,
    reason: t.reason,
    status: t.status,
    owner: t.ownerName ?? "Unassigned",
    priorityScore: t.priorityScore,
    critical: t.criticalFlag,
    stale: t.staleFlag,
    unacknowledged: t.category === "urgent" && !t.acknowledgedAt,
    overdue: t.dueAt ? new Date(t.dueAt).getTime() < now.getTime() : false,
    daysSinceUpdate: Math.floor(
      (now.getTime() - new Date(t.lastUpdatedAt).getTime()) / MS_PER_DAY,
    ),
    notes: t.noteCount,
  };
}

export async function generateBriefing(lang: Lang) {
  const now = new Date();
  const rawTasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.archived, false));
  const users = await db.select().from(usersTable);
  const serialized = await serializeTasks(rawTasks, now);
  const open = serialized.filter((t) => t.status !== "done");

  const ownerLoads = buildOwnerLoads(open, users, now);
  const focusTasks = [...open]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 50)
    .map((t) => compactTask(t, now));

  const context = {
    today: now.toISOString().slice(0, 10),
    totals: {
      openTasks: open.length,
      urgent: open.filter((t) => t.category === "urgent").length,
      unacknowledgedUrgent: open.filter(
        (t) => t.category === "urgent" && !t.acknowledgedAt,
      ).length,
      stale: open.filter((t) => t.staleFlag).length,
      blocked: open.filter((t) => t.status === "blocked").length,
      unassigned: open.filter((t) => t.ownerId == null).length,
      overdue: open.filter(
        (t) => t.dueAt && new Date(t.dueAt).getTime() < now.getTime(),
      ).length,
    },
    team: ownerLoads,
    tasks: focusTasks,
  };

  const system = [
    "You are a sharp operations chief of staff for a Malaysian professional-services firm using TaskRadar, a team task manager.",
    "Analyse the team's full task state and produce a concise, decision-ready management briefing that helps the manager keep everyone's work on track.",
    "Focus on: unacknowledged urgent work, overdue/critical items, people who are overloaded or idle, stale backlog, and blocked tasks without notes.",
    "Recommendations must be specific and actionable (e.g. reassign a named task from one person to another, nudge an owner, unblock, or split work). When a recommendation refers to a task, include its taskId and taskTitle, and the suggested ownerName when relevant.",
    `Write every human-readable string (headline, summary, titles, details, actions, rationales) in ${langName(lang)}. Keep names and proper nouns as-is.`,
    'Respond ONLY with a JSON object of this exact shape: {"headline": string, "summary": string, "risks": [{"severity": "high"|"medium"|"low", "title": string, "detail": string}], "recommendations": [{"action": string, "rationale": string, "taskId": number|null, "taskTitle": string|null, "ownerName": string|null}]}.',
    "Provide 2-5 risks (most severe first) and 3-6 recommendations. Do not invent tasks or people that are not in the data.",
  ].join("\n");

  const user = `Team task state (JSON):\n${JSON.stringify(context)}`;

  const data = (await callModel(system, user)) as Record<string, unknown>;

  // Validate the model output strictly; fail explicitly if it does not match.
  let briefing;
  try {
    briefing = GenerateAiBriefingResponse.parse({
      ...data,
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    throw new AiProviderError(
      `The AI briefing response did not match the expected format: ${(err as Error).message}`,
    );
  }

  // Safe correction: drop references to tasks that no longer exist / were invented.
  const validTaskIds = new Set(open.map((t) => t.id));
  return {
    ...briefing,
    recommendations: briefing.recommendations.map((rec) => ({
      ...rec,
      taskId:
        rec.taskId != null && validTaskIds.has(rec.taskId) ? rec.taskId : null,
    })),
  };
}

// ---------------------------------------------------------------------------
// AI Smart Triage
// ---------------------------------------------------------------------------

export async function generateTriage(input: {
  title: string;
  description?: string | null;
  lang: Lang;
}) {
  const now = new Date();
  const rawTasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.archived, false));
  const users = await db.select().from(usersTable);
  const serialized = await serializeTasks(rawTasks, now);
  const open = serialized.filter((t) => t.status !== "done");

  const ownerLoads = buildOwnerLoads(open, users, now).filter(
    (o) => o.ownerId != null,
  );

  const context = {
    newTask: {
      title: input.title,
      description: input.description ?? "",
    },
    categories: ["urgent", "backlog"],
    reasons: TASK_REASONS,
    team: ownerLoads.map((o) => ({
      ownerId: o.ownerId,
      ownerName: o.ownerName,
      role: o.role,
      openTasks: o.openTasks,
      urgent: o.urgent,
      overdue: o.overdue,
    })),
  };

  const system = [
    "You are an intake triage assistant for TaskRadar, a Malaysian professional-services team task manager.",
    "Given a new task and the current team workload, decide the best routing.",
    "Pick category: 'urgent' only if it is time-critical or high-impact; otherwise 'backlog'.",
    `Pick exactly one reason from this list: ${TASK_REASONS.join(", ")}.`,
    "Suggest the best owner by balancing workload (prefer people with fewer open/urgent/overdue tasks) while respecting obvious role fit. Use a real ownerId from the team data, or null if genuinely unclear.",
    `Write the rationale in ${langName(input.lang)}. Keep names as-is.`,
    'Respond ONLY with a JSON object of this exact shape: {"category": "urgent"|"backlog", "reason": one of the allowed reasons, "suggestedOwnerId": number|null, "suggestedOwnerName": string|null, "rationale": string, "confidence": "high"|"medium"|"low"}.',
  ].join("\n");

  const user = `Triage context (JSON):\n${JSON.stringify(context)}`;

  const data = await callModel(system, user);

  // Validate the model output strictly; fail explicitly if it does not match.
  let triage;
  try {
    triage = AiTriageTaskResponse.parse(data);
  } catch (err) {
    throw new AiProviderError(
      `The AI triage response did not match the expected format: ${(err as Error).message}`,
    );
  }

  // Safe correction: only accept an owner id that actually exists on the team.
  const ownerById = new Map(ownerLoads.map((o) => [o.ownerId, o.ownerName]));
  const suggestedOwnerId =
    triage.suggestedOwnerId != null && ownerById.has(triage.suggestedOwnerId)
      ? triage.suggestedOwnerId
      : null;
  return {
    ...triage,
    suggestedOwnerId,
    suggestedOwnerName:
      suggestedOwnerId != null ? (ownerById.get(suggestedOwnerId) ?? null) : null,
  };
}

// ---------------------------------------------------------------------------
// AI Goal Builder
// ---------------------------------------------------------------------------

export async function generateGoalDraft(input: {
  prompt: string;
  lang: Lang;
}) {
  const system = [
    "You are a strategy assistant for TaskRadar, a Malaysian professional-services team task manager.",
    "Turn the manager's free-text description into one clear, well-scoped strategic goal with measurable KPIs.",
    "The goal title should be concise and outcome-oriented. The description should explain the intent in 1-2 sentences.",
    "Suggest 2-4 KPIs that are concrete and measurable. Each KPI needs a name, a numeric targetValue, an optional unit (e.g. '%', 'days', 'RM', or null), a sensible currentValue baseline (use 0 if unknown), and a direction: 'up' if a higher value is better, 'down' if a lower value is better.",
    "Suggest a realistic timeframe string if the prompt implies one (e.g. 'Q3 2026', '6 months'), otherwise null.",
    `Write every human-readable string (title, description, timeframe, KPI names and units) in ${langName(input.lang)}. Keep proper nouns as-is.`,
    'Respond ONLY with a JSON object of this exact shape: {"title": string, "description": string|null, "timeframe": string|null, "kpis": [{"name": string, "unit": string|null, "targetValue": number, "currentValue": number, "direction": "up"|"down"}]}.',
  ].join("\n");

  const user = `Goal description from the manager:\n${input.prompt}`;

  const data = await callModel(system, user);

  let draft;
  try {
    draft = AiBuildGoalResponse.parse(data);
  } catch (err) {
    throw new AiProviderError(
      `The AI goal response did not match the expected format: ${(err as Error).message}`,
    );
  }
  return draft;
}
