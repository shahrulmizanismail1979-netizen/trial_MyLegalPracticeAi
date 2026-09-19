import { and, inArray, eq, desc } from "drizzle-orm";
import {
  db,
  tasksTable,
  usersTable,
  taskNotesTable,
  taskCollaboratorsTable,
  goalsTable,
  type Task,
  type User,
  type TaskNote,
} from "../db";
import { serializeTask, type SerializedTask } from "./taskLogic";
import { firmScope } from "./workspace";

type Collaborator = { userId: number; name: string | null };

async function buildContext(tasks: Task[]): Promise<{
  usersById: Map<number, User>;
  latestNoteByTask: Map<number, TaskNote>;
  noteCountByTask: Map<number, number>;
  goalTitleById: Map<number, string>;
  collaboratorsByTask: Map<number, Collaborator[]>;
}> {
  const usersById = new Map<number, User>();
  const latestNoteByTask = new Map<number, TaskNote>();
  const noteCountByTask = new Map<number, number>();
  const goalTitleById = new Map<number, string>();
  const collaboratorsByTask = new Map<number, Collaborator[]>();

  if (tasks.length === 0) {
    return {
      usersById,
      latestNoteByTask,
      noteCountByTask,
      goalTitleById,
      collaboratorsByTask,
    };
  }

  const allUsers = await db.select().from(usersTable).where(firmScope(usersTable));
  for (const u of allUsers) usersById.set(u.id, u);

  const allGoals = await db.select().from(goalsTable).where(firmScope(goalsTable));
  for (const g of allGoals) goalTitleById.set(g.id, g.title);

  const taskIds = tasks.map((t) => t.id);
  const notes = await db
    .select()
    .from(taskNotesTable)
    .where(and(inArray(taskNotesTable.taskId, taskIds), firmScope(taskNotesTable)))
    .orderBy(desc(taskNotesTable.createdAt));

  for (const note of notes) {
    noteCountByTask.set(
      note.taskId,
      (noteCountByTask.get(note.taskId) ?? 0) + 1,
    );
    if (!latestNoteByTask.has(note.taskId)) {
      latestNoteByTask.set(note.taskId, note);
    }
  }

  const collaborators = await db
    .select()
    .from(taskCollaboratorsTable)
    .where(and(inArray(taskCollaboratorsTable.taskId, taskIds), firmScope(taskCollaboratorsTable)))
    .orderBy(taskCollaboratorsTable.createdAt);

  for (const c of collaborators) {
    const list = collaboratorsByTask.get(c.taskId) ?? [];
    list.push({ userId: c.userId, name: usersById.get(c.userId)?.name ?? null });
    collaboratorsByTask.set(c.taskId, list);
  }

  return {
    usersById,
    latestNoteByTask,
    noteCountByTask,
    goalTitleById,
    collaboratorsByTask,
  };
}

export async function serializeTasks(
  tasks: Task[],
  now: Date,
): Promise<SerializedTask[]> {
  const {
    usersById,
    latestNoteByTask,
    noteCountByTask,
    goalTitleById,
    collaboratorsByTask,
  } = await buildContext(tasks);

  return tasks.map((task) =>
    serializeTask(task, {
      now,
      owner: task.ownerId != null ? usersById.get(task.ownerId) : null,
      creator:
        task.createdById != null ? usersById.get(task.createdById) : null,
      latestNote: latestNoteByTask.get(task.id) ?? null,
      noteCount: noteCountByTask.get(task.id) ?? 0,
      goalTitle:
        task.goalId != null ? goalTitleById.get(task.goalId) ?? null : null,
      collaborators: collaboratorsByTask.get(task.id) ?? [],
    }),
  );
}

export async function serializeOne(
  task: Task,
  now: Date,
): Promise<SerializedTask> {
  const [result] = await serializeTasks([task], now);
  return result;
}

export async function loadTask(id: number): Promise<Task | undefined> {
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.id, id), firmScope(tasksTable)));
  return task;
}

export async function loadUser(id: number | null): Promise<User | null> {
  if (id == null) return null;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, id), firmScope(usersTable)));
  return user ?? null;
}

export async function firstManager(): Promise<User | null> {
  const [manager] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.role, "manager"), firmScope(usersTable)));
  return manager ?? null;
}
