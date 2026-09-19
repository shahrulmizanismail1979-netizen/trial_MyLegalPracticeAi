import { Router, type IRouter } from "express";
import { firmAiRateLimit } from "../lib/firmAiRateLimit";
import { and, eq, asc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db, goalsTable, kpisTable, tasksTable } from "../db";
import {
  ListGoalsResponse,
  CreateGoalBody,
  GetGoalParams,
  GetGoalResponse,
  UpdateGoalParams,
  UpdateGoalBody,
  ArchiveGoalParams,
  ArchiveGoalBody,
  AddKpiParams,
  AddKpiBody,
  UpdateKpiParams,
  UpdateKpiBody,
  DeleteKpiParams,
  DeleteKpiBody,
  AiBuildGoalBody,
} from "../apiZod";
import {
  serializeGoals,
  serializeOneGoal,
  loadGoal,
  loadKpi,
  isKnownUser,
} from "../lib/goalService";
import { requireManagerSession } from "../lib/managerSession";
import { generateGoalDraft, AiProviderError } from "../lib/aiService";
import { firmScope, firmValues } from "../lib/workspace";

const router: IRouter = Router();

// List goals with KPIs and rolled-up deliverables.
router.get("/goals", async (req, res): Promise<void> => {
  const conditions: SQL[] = [];
  const includeArchived = req.query.includeArchived === "true";
  if (!includeArchived) {
    conditions.push(eq(goalsTable.archived, false));
  }
  conditions.unshift(firmScope(goalsTable));
  const where = and(...conditions);

  const goals = await db
    .select()
    .from(goalsTable)
    .where(where)
    .orderBy(asc(goalsTable.id));

  const serialized = await serializeGoals(goals, new Date());
  res.json(ListGoalsResponse.parse(serialized));
});

// Create a goal (manager only).
router.post("/goals", async (req, res): Promise<void> => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if ((await requireManagerSession(req)) == null) {
    res.status(403).json({ error: "Only managers can create goals." });
    return;
  }
  if (parsed.data.ownerId != null && !(await isKnownUser(parsed.data.ownerId))) {
    res.status(400).json({ error: "Goal owner does not belong to this workspace." });
    return;
  }

  const [goal] = await db
    .insert(goalsTable)
    .values({
      ...firmValues(),
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      ownerId: parsed.data.ownerId ?? null,
      timeframe: parsed.data.timeframe ?? null,
      status: parsed.data.status ?? "active",
    })
    .returning();

  res.status(201).json(await serializeOneGoal(goal, new Date()));
});

// Draft a goal and KPIs from a free-text prompt (manager only).
router.post("/goals/ai-build", firmAiRateLimit, async (req, res): Promise<void> => {
  const parsed = AiBuildGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if ((await requireManagerSession(req)) == null) {
    res.status(403).json({ error: "Only managers can use the AI goal builder." });
    return;
  }
  try {
    const draft = await generateGoalDraft({
      prompt: parsed.data.prompt,
      lang: parsed.data.lang,
    });
    res.json(draft);
  } catch (err) {
    if (err instanceof AiProviderError) {
      req.log.error({ err }, "AI goal build failed");
      res.status(502).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// Get one goal.
router.get("/goals/:id", async (req, res): Promise<void> => {
  const params = GetGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const goal = await loadGoal(params.data.id);
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  res.json(GetGoalResponse.parse(await serializeOneGoal(goal, new Date())));
});

// Update a goal (manager only).
router.patch("/goals/:id", async (req, res): Promise<void> => {
  const params = UpdateGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if ((await requireManagerSession(req)) == null) {
    res.status(403).json({ error: "Only managers can edit goals." });
    return;
  }

  const existing = await loadGoal(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.title !== undefined) updates.title = d.title;
  if (d.description !== undefined) updates.description = d.description;
  if (d.ownerId !== undefined) updates.ownerId = d.ownerId;
  if (d.timeframe !== undefined) updates.timeframe = d.timeframe;
  if (d.status !== undefined) updates.status = d.status;

  if (Object.keys(updates).length === 0) {
    res.json(await serializeOneGoal(existing, new Date()));
    return;
  }
  if (d.ownerId != null && !(await isKnownUser(d.ownerId))) {
    res.status(400).json({ error: "Goal owner does not belong to this workspace." });
    return;
  }

  const [goal] = await db
    .update(goalsTable)
    .set(updates)
    .where(and(firmScope(goalsTable), eq(goalsTable.id, params.data.id)))
    .returning();

  res.json(await serializeOneGoal(goal, new Date()));
});

// Archive a goal (manager only).
router.delete("/goals/:id", async (req, res): Promise<void> => {
  const params = ArchiveGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = ArchiveGoalBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if ((await requireManagerSession(req)) == null) {
    res.status(403).json({ error: "Only managers can archive goals." });
    return;
  }

  const existing = await loadGoal(params.data.id);
  if (!existing) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  const [goal] = await db
    .update(goalsTable)
    .set({ archived: true })
    .where(and(firmScope(goalsTable), eq(goalsTable.id, params.data.id)))
    .returning();

  // Detach deliverables so they don't keep pointing at a goal that has
  // left the cascade (consistent with the default-hidden archive view).
  await db
    .update(tasksTable)
    .set({ goalId: null })
    .where(and(firmScope(tasksTable), eq(tasksTable.goalId, params.data.id)));

  res.json(await serializeOneGoal(goal, new Date()));
});

// Add a KPI to a goal (manager only).
router.post("/goals/:id/kpis", async (req, res): Promise<void> => {
  const params = AddKpiParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AddKpiBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if ((await requireManagerSession(req)) == null) {
    res.status(403).json({ error: "Only managers can add KPIs." });
    return;
  }

  const goal = await loadGoal(params.data.id);
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  await db.insert(kpisTable).values({
    ...firmValues(),
    goalId: goal.id,
    name: parsed.data.name,
    unit: parsed.data.unit ?? null,
    targetValue: parsed.data.targetValue,
    currentValue: parsed.data.currentValue ?? 0,
    direction: parsed.data.direction ?? "up",
  });

  res.json(await serializeOneGoal(goal, new Date()));
});

// Update a KPI, including its current value (manager only).
router.patch("/goals/:id/kpis/:kpiId", async (req, res): Promise<void> => {
  const params = UpdateKpiParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateKpiBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if ((await requireManagerSession(req)) == null) {
    res.status(403).json({ error: "Only managers can edit KPIs." });
    return;
  }

  const goal = await loadGoal(params.data.id);
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  const kpi = await loadKpi(params.data.kpiId);
  if (!kpi || kpi.goalId !== goal.id) {
    res.status(404).json({ error: "KPI not found" });
    return;
  }

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if (d.unit !== undefined) updates.unit = d.unit;
  if (d.targetValue !== undefined) updates.targetValue = d.targetValue;
  if (d.currentValue !== undefined) updates.currentValue = d.currentValue;
  if (d.direction !== undefined) updates.direction = d.direction;

  if (Object.keys(updates).length > 0) {
    await db
      .update(kpisTable)
      .set(updates)
      .where(and(firmScope(kpisTable), eq(kpisTable.id, params.data.kpiId)));
  }

  res.json(await serializeOneGoal(goal, new Date()));
});

// Delete a KPI (manager only).
router.delete("/goals/:id/kpis/:kpiId", async (req, res): Promise<void> => {
  const params = DeleteKpiParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = DeleteKpiBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if ((await requireManagerSession(req)) == null) {
    res.status(403).json({ error: "Only managers can delete KPIs." });
    return;
  }

  const goal = await loadGoal(params.data.id);
  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  const kpi = await loadKpi(params.data.kpiId);
  if (!kpi || kpi.goalId !== goal.id) {
    res.status(404).json({ error: "KPI not found" });
    return;
  }

  await db.delete(kpisTable).where(and(firmScope(kpisTable), eq(kpisTable.id, params.data.kpiId)));

  res.json(await serializeOneGoal(goal, new Date()));
});

export default router;
