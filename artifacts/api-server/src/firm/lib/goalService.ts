import { inArray, eq, desc, asc } from "drizzle-orm";
import {
  db,
  goalsTable,
  kpisTable,
  tasksTable,
  usersTable,
  type Goal,
  type Kpi,
  type User,
} from "../db";
import { serializeTasks } from "./taskService";
import { serializeGoal, type SerializedGoal } from "./goalLogic";

export async function serializeGoals(
  goals: Goal[],
  now: Date,
): Promise<SerializedGoal[]> {
  if (goals.length === 0) return [];

  const goalIds = goals.map((g) => g.id);

  const usersById = new Map<number, User>();
  const allUsers = await db.select().from(usersTable);
  for (const u of allUsers) usersById.set(u.id, u);

  const kpis = await db
    .select()
    .from(kpisTable)
    .where(inArray(kpisTable.goalId, goalIds))
    .orderBy(asc(kpisTable.id));
  const kpisByGoal = new Map<number, Kpi[]>();
  for (const k of kpis) {
    const list = kpisByGoal.get(k.goalId) ?? [];
    list.push(k);
    kpisByGoal.set(k.goalId, list);
  }

  const deliverables = await db
    .select()
    .from(tasksTable)
    .where(inArray(tasksTable.goalId, goalIds))
    .orderBy(desc(tasksTable.createdAt));
  const activeDeliverables = deliverables.filter((t) => !t.archived);
  const serializedDeliverables = await serializeTasks(activeDeliverables, now);
  const deliverablesByGoal = new Map<
    number,
    (typeof serializedDeliverables)[number][]
  >();
  for (const t of serializedDeliverables) {
    if (t.goalId == null) continue;
    const list = deliverablesByGoal.get(t.goalId) ?? [];
    list.push(t);
    deliverablesByGoal.set(t.goalId, list);
  }

  return goals.map((goal) =>
    serializeGoal(goal, {
      now,
      owner: goal.ownerId != null ? usersById.get(goal.ownerId) : null,
      kpis: kpisByGoal.get(goal.id) ?? [],
      deliverables: deliverablesByGoal.get(goal.id) ?? [],
    }),
  );
}

export async function serializeOneGoal(
  goal: Goal,
  now: Date,
): Promise<SerializedGoal> {
  const [result] = await serializeGoals([goal], now);
  return result;
}

export async function loadGoal(id: number): Promise<Goal | undefined> {
  const [goal] = await db.select().from(goalsTable).where(eq(goalsTable.id, id));
  return goal;
}

export async function loadKpi(id: number): Promise<Kpi | undefined> {
  const [kpi] = await db.select().from(kpisTable).where(eq(kpisTable.id, id));
  return kpi;
}

export async function isManagerUser(id: number | null): Promise<boolean> {
  if (id == null) return false;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return user?.role === "manager";
}

export async function isKnownUser(id: number | null | undefined): Promise<boolean> {
  if (id == null) return false;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  return user != null;
}
