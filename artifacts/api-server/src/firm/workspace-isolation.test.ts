/**
 * Live-database integration coverage for the MyLawFirmAI tenant boundary.
 *
 * Every fixture is tagged with RUN_ID. Subscriber workspaces are the ids of
 * their global firm_access_codes rows; workspace 0 remains owner-private.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { and, eq, inArray, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

vi.mock("../lib/virtualParalegal", () => ({
  attachVirtualParalegal: vi.fn(),
}));

vi.mock("./lib/aiService", () => ({
  AiProviderError: class AiProviderError extends Error {},
  generateTriage: vi.fn().mockRejectedValue(new Error("AI is disabled in workspace tests")),
}));

vi.mock("./lib/googleDrive", () => ({
  syncObjectToDrive: vi.fn(),
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  speechToText: vi.fn().mockRejectedValue(new Error("Provider calls are disabled in workspace tests")),
  ensureCompatibleFormat: vi.fn(),
}));

vi.mock("./lib/objectStorage", () => {
  class ObjectNotFoundError extends Error {}
  class ObjectStorageService {
    async getObjectEntityUploadURL(workspaceId: number) {
      return `https://storage.test/firm/${workspaceId}/uploads/00000000-0000-4000-8000-000000000001.fixture`;
    }
    normalizeObjectEntityPath(url: string) {
      return `/objects/${new URL(url).pathname.replace(/^\//, "")}`;
    }
    async getObjectEntityFile(path: string) {
      return {
        name: path,
        getMetadata: async () => [{ size: "12" }],
        delete: async () => undefined,
      };
    }
    async deleteObjectEntity() {}
    async downloadObject() {
      return new Response("fixture", { status: 200 });
    }
    async searchPublicObject() {
      return null;
    }
  }
  return { ObjectNotFoundError, ObjectStorageService };
});

import firmRouter from "./index";
import {
  db,
  firmAccessCodesTable,
  firmWorkspaceCredentialsTable,
  taskActivityTable,
  taskCollaboratorsTable,
  taskEvidenceTable,
  taskNotesTable,
  tasksTable,
  usersTable,
} from "./db";

const RUN_ID = `firm-ws-${process.pid}-${Date.now()}`;
const CODE_A = `${RUN_ID}-A`;
const CODE_B = `${RUN_ID}-B`;

type SeedUser = typeof usersTable.$inferSelect;
type SeedTask = typeof tasksTable.$inferSelect;

let workspaceA: number;
let workspaceB: number;
let ownerUser: SeedUser;
let userA: SeedUser;
let userB: SeedUser;
let managerA: SeedUser;
let managerB: SeedUser;
let ownerTask: SeedTask;
let taskA: SeedTask;
let taskB: SeedTask;
let cookieA = "";
let cookieB = "";
let managerCookieA = "";
let managerCookieB = "";
let app: express.Express;

const testLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function cookieFrom(res: request.Response): string {
  const setCookie = res.headers["set-cookie"];
  // Sign-in intentionally clears the prior manager cookie before issuing the
  // new staff cookie. A deletion cookie is not the authenticated session.
  const first = (Array.isArray(setCookie) ? setCookie : [setCookie])
    .find((cookie) => cookie && /^[^=]+=[^;]/.test(cookie));
  if (!first) throw new Error("Expected the firm login route to set a cookie");
  return first.split(";")[0];
}

async function cleanupOwnedFixtures(): Promise<void> {
  if (workspaceA && workspaceB) {
    const workspaceIds = [workspaceA, workspaceB];
    // Delete only rows belonging to the two access-code ids created by this run.
    // Child tables precede their task/user parents.
    await db.execute(sql`DELETE FROM firm_task_activity WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_task_assessments WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_task_attempts WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_task_collaborators WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_task_evidence WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_task_notes WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_kpis WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_goals WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_meetings WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_hr_payslips WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_hr_payroll_runs WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_hr_attendance WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_hr_leave_requests WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_hr_leave_entitlements WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_hr_profiles WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_accounts_client_entries WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_accounts_client_ledgers WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_accounts_office_entries WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.execute(sql`DELETE FROM firm_accounts_budgets WHERE workspace_id IN (${workspaceA}, ${workspaceB})`);
    await db.delete(tasksTable).where(inArray(tasksTable.workspaceId, workspaceIds));
    await db.delete(usersTable).where(inArray(usersTable.workspaceId, workspaceIds));
    await db.delete(firmWorkspaceCredentialsTable).where(
      inArray(firmWorkspaceCredentialsTable.workspaceId, workspaceIds),
    );
  }

  // Workspace 0 may contain real owner data, so remove only exact ids seeded by
  // this suite, never all owner rows and never a broad marker delete.
  if (ownerTask?.id) {
    await db.delete(taskActivityTable).where(
      and(eq(taskActivityTable.workspaceId, 0), eq(taskActivityTable.taskId, ownerTask.id)),
    );
    await db.delete(taskCollaboratorsTable).where(
      and(eq(taskCollaboratorsTable.workspaceId, 0), eq(taskCollaboratorsTable.taskId, ownerTask.id)),
    );
    await db.delete(taskNotesTable).where(
      and(eq(taskNotesTable.workspaceId, 0), eq(taskNotesTable.taskId, ownerTask.id)),
    );
    await db.delete(tasksTable).where(
      and(eq(tasksTable.workspaceId, 0), eq(tasksTable.id, ownerTask.id)),
    );
  }
  if (ownerUser?.id) {
    await db.delete(usersTable).where(
      and(eq(usersTable.workspaceId, 0), eq(usersTable.id, ownerUser.id)),
    );
  }
  if (workspaceA && workspaceB) {
    await db.delete(firmAccessCodesTable).where(
      inArray(firmAccessCodesTable.id, [workspaceA, workspaceB]),
    );
  }
}

beforeAll(async () => {
  const managerPassword = `${RUN_ID}-manager-password`;
  const [codeA, codeB] = await db
    .insert(firmAccessCodesTable)
    .values([
      { code: CODE_A, label: `${RUN_ID} Firm A`, isActive: true },
      { code: CODE_B, label: `${RUN_ID} Firm B`, isActive: true },
    ])
    .returning();
  workspaceA = codeA.id;
  workspaceB = codeB.id;

  [ownerUser, userA, userB, managerA, managerB] = await db
    .insert(usersTable)
    .values([
      {
        workspaceId: 0,
        name: `${RUN_ID} owner user`,
        email: `${RUN_ID}-owner@example.invalid`,
        role: "manager",
      },
      {
        workspaceId: workspaceA,
        name: `${RUN_ID} firm A user`,
        email: `${RUN_ID}-a@example.invalid`,
        role: "staff",
      },
      {
        workspaceId: workspaceB,
        name: `${RUN_ID} firm B user`,
        email: `${RUN_ID}-b@example.invalid`,
        role: "staff",
      },
      {
        workspaceId: workspaceA,
        name: `${RUN_ID} firm A manager`,
        email: `${RUN_ID}-manager-a@example.invalid`,
        role: "manager",
      },
      {
        workspaceId: workspaceB,
        name: `${RUN_ID} firm B manager`,
        email: `${RUN_ID}-manager-b@example.invalid`,
        role: "manager",
      },
    ])
    .returning();

  const passwordHash = await bcrypt.hash(managerPassword, 4);
  await db.insert(firmWorkspaceCredentialsTable).values([
    { workspaceId: workspaceA, passwordHash, credentialVersion: 1 },
    { workspaceId: workspaceB, passwordHash, credentialVersion: 1 },
  ]);

  [ownerTask, taskA, taskB] = await db
    .insert(tasksTable)
    .values([
      {
        workspaceId: 0,
        title: `${RUN_ID} owner task`,
        category: "backlog",
        reason: "internal",
        ownerId: ownerUser.id,
      },
      {
        workspaceId: workspaceA,
        title: `${RUN_ID} firm A task`,
        category: "backlog",
        reason: "internal",
        ownerId: userA.id,
      },
      {
        workspaceId: workspaceB,
        title: `${RUN_ID} firm B task`,
        category: "backlog",
        reason: "internal",
        ownerId: userB.id,
      },
    ])
    .returning();

  app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as typeof req & { log: typeof testLog }).log = testLog;
    next();
  });
  app.use("/api/firm", firmRouter);

  const [loginA, loginB] = await Promise.all([
    request(app).post("/api/firm/auth/staff").send({ passcode: CODE_A }),
    request(app).post("/api/firm/auth/staff").send({ passcode: CODE_B }),
  ]);
  expect(loginA.status).toBe(200);
  expect(loginB.status).toBe(200);
  cookieA = cookieFrom(loginA);
  cookieB = cookieFrom(loginB);

  const [managerLoginA, managerLoginB] = await Promise.all([
    request(app)
      .post("/api/firm/auth/manager")
      .set("Cookie", cookieA)
      .send({ passcode: managerPassword }),
    request(app)
      .post("/api/firm/auth/manager")
      .set("Cookie", cookieB)
      .send({ passcode: managerPassword }),
  ]);
  expect(managerLoginA.status).toBe(200);
  expect(managerLoginB.status).toBe(200);
  managerCookieA = `${cookieA}; ${cookieFrom(managerLoginA)}`;
  managerCookieB = `${cookieB}; ${cookieFrom(managerLoginB)}`;
});

afterAll(async () => {
  await cleanupOwnedFixtures();
});

describe("firm workspace isolation through the full router", () => {
  it("keeps user and task lists inside the access-code workspace", async () => {
    const [usersA, tasksA, usersB, tasksB] = await Promise.all([
      request(app).get("/api/firm/users").set("Cookie", cookieA),
      request(app).get("/api/firm/tasks").set("Cookie", cookieA),
      request(app).get("/api/firm/users").set("Cookie", cookieB),
      request(app).get("/api/firm/tasks").set("Cookie", cookieB),
    ]);

    for (const response of [usersA, tasksA, usersB, tasksB]) {
      expect(response.status).toBe(200);
    }
    expect(usersA.body.map((row: SeedUser) => row.id)).toContain(userA.id);
    expect(usersA.body.map((row: SeedUser) => row.id)).not.toContain(userB.id);
    expect(usersA.body.map((row: SeedUser) => row.id)).not.toContain(ownerUser.id);
    expect(tasksA.body.map((row: SeedTask) => row.id)).toContain(taskA.id);
    expect(tasksA.body.map((row: SeedTask) => row.id)).not.toContain(taskB.id);
    expect(tasksA.body.map((row: SeedTask) => row.id)).not.toContain(ownerTask.id);
    expect(usersB.body.map((row: SeedUser) => row.id)).toEqual(
      expect.arrayContaining([userB.id, managerB.id]),
    );
    expect(tasksB.body.map((row: SeedTask) => row.id)).toContain(taskB.id);
    expect(tasksB.body.map((row: SeedTask) => row.id)).not.toContain(taskA.id);
    expect(tasksB.body.map((row: SeedTask) => row.id)).not.toContain(ownerTask.id);
  });

  it("returns not-found/forbidden for direct cross-workspace task and user mutations", async () => {
    const originalTitle = taskB.title;
    const [getTask, patchTask, deleteTask, patchUser] = await Promise.all([
      request(app).get(`/api/firm/tasks/${taskB.id}`).set("Cookie", cookieA),
      request(app)
        .patch(`/api/firm/tasks/${taskB.id}`)
        .set("Cookie", cookieA)
        .send({ title: `${RUN_ID} illicit edit`, actingUserId: userA.id }),
      request(app)
        .delete(`/api/firm/tasks/${taskB.id}`)
        .set("Cookie", cookieA)
        .send({ actingUserId: userA.id }),
      request(app)
        .patch(`/api/firm/users/${userB.id}`)
        .set("Cookie", cookieA)
        .send({ role: "manager", actingUserId: userA.id }),
    ]);

    expect(getTask.status).toBe(404);
    expect(patchTask.status).toBe(404);
    expect(deleteTask.status).toBe(404);
    expect([403, 404]).toContain(patchUser.status);

    const [unchangedTask] = await db
      .select()
      .from(tasksTable)
      .where(eq(tasksTable.id, taskB.id));
    const [unchangedUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userB.id));
    expect(unchangedTask.title).toBe(originalTitle);
    expect(unchangedTask.archived).toBe(false);
    expect(unchangedUser.role).toBe("staff");
  });

  it("rejects foreign assignee and foreign nested-task references without side effects", async () => {
    const beforeA = await db
      .select({ id: tasksTable.id })
      .from(tasksTable)
      .where(eq(tasksTable.workspaceId, workspaceA));

    const [foreignOwner, foreignCreator, foreignCollaborator, foreignTaskNote] =
      await Promise.all([
        request(app).post("/api/firm/tasks").set("Cookie", cookieA).send({
          title: `${RUN_ID} foreign owner attack`,
          category: "backlog",
          reason: "other",
          ownerId: userB.id,
        }),
        request(app).post("/api/firm/tasks").set("Cookie", cookieA).send({
          title: `${RUN_ID} foreign creator attack`,
          category: "backlog",
          reason: "other",
          createdById: userB.id,
        }),
        request(app).post("/api/firm/tasks").set("Cookie", cookieA).send({
          title: `${RUN_ID} foreign collaborator attack`,
          category: "backlog",
          reason: "other",
          ownerId: userA.id,
          collaboratorIds: [userB.id],
        }),
        request(app)
          .post(`/api/firm/tasks/${taskB.id}/notes`)
          .set("Cookie", cookieA)
          .send({ body: `${RUN_ID} foreign task note`, authorId: userA.id }),
      ]);

    for (const response of [foreignOwner, foreignCreator, foreignCollaborator]) {
      expect(response.status).toBe(400);
    }
    expect(foreignTaskNote.status).toBe(404);

    const [afterA, illicitNotes, illicitCollaborators] = await Promise.all([
      db.select({ id: tasksTable.id }).from(tasksTable).where(eq(tasksTable.workspaceId, workspaceA)),
      db
        .select({ id: taskNotesTable.id })
        .from(taskNotesTable)
        .where(and(eq(taskNotesTable.workspaceId, workspaceA), eq(taskNotesTable.taskId, taskB.id))),
      db
        .select({ taskId: taskCollaboratorsTable.taskId })
        .from(taskCollaboratorsTable)
        .where(
          and(
            eq(taskCollaboratorsTable.workspaceId, workspaceA),
            eq(taskCollaboratorsTable.userId, userB.id),
          ),
        ),
    ]);
    expect(afterA).toHaveLength(beforeA.length);
    expect(illicitNotes).toHaveLength(0);
    expect(illicitCollaborators).toHaveLength(0);
  });

  it("preserves normal create, read, update, and archive behavior in the caller's workspace", async () => {
    const create = await request(app).post("/api/firm/tasks").set("Cookie", cookieA).send({
      title: `${RUN_ID} own CRUD`,
      category: "urgent",
      reason: "client",
      ownerId: userA.id,
      createdById: userA.id,
    });
    expect(create.status).toBe(201);
    const id = create.body.id as number;

    const read = await request(app).get(`/api/firm/tasks/${id}`).set("Cookie", cookieA);
    expect(read.status).toBe(200);
    expect(read.body.ownerId).toBe(userA.id);

    const update = await request(app)
      .patch(`/api/firm/tasks/${id}`)
      .set("Cookie", cookieA)
      .send({ title: `${RUN_ID} own CRUD updated`, actingUserId: userA.id });
    expect(update.status).toBe(200);
    expect(update.body.title).toBe(`${RUN_ID} own CRUD updated`);

    const archive = await request(app)
      .delete(`/api/firm/tasks/${id}`)
      .set("Cookie", cookieA)
      .send({ actingUserId: userA.id });
    expect(archive.status).toBe(200);
    expect(archive.body.archived).toBe(true);

    const [stored] = await db
      .select()
      .from(tasksTable)
      .where(and(eq(tasksTable.id, id), eq(tasksTable.workspaceId, workspaceA)));
    expect(stored.title).toBe(`${RUN_ID} own CRUD updated`);
    expect(stored.archived).toBe(true);
  });

  it("scopes manager-only accounts and HR APIs, including direct foreign references", async () => {
    const [accountA, accountB] = await Promise.all([
      request(app)
        .post("/api/firm/accounts/office/entries")
        .set("Cookie", managerCookieA)
        .send({
          type: "income",
          category: "professional_fees",
          description: `${RUN_ID} firm A income`,
          amount: 101,
          entryDate: "2026-09-01",
        }),
      request(app)
        .post("/api/firm/accounts/office/entries")
        .set("Cookie", managerCookieB)
        .send({
          type: "income",
          category: "professional_fees",
          description: `${RUN_ID} firm B income`,
          amount: 202,
          entryDate: "2026-09-01",
        }),
    ]);
    expect(accountA.status).toBe(201);
    expect(accountB.status).toBe(201);

    const [accountsA, employeesA, ownProfile, foreignProfile] = await Promise.all([
      request(app)
        .get("/api/firm/accounts/office/entries?month=9&year=2026")
        .set("Cookie", managerCookieA),
      request(app).get("/api/firm/hr/employees").set("Cookie", managerCookieA),
      request(app)
        .post(`/api/firm/hr/employees/${userA.id}`)
        .set("Cookie", managerCookieA)
        .send({ department: `${RUN_ID} A`, employmentType: "full_time", salary: 1200 }),
      request(app)
        .post(`/api/firm/hr/employees/${userB.id}`)
        .set("Cookie", managerCookieA)
        .send({ department: `${RUN_ID} illicit`, employmentType: "full_time", salary: 9999 }),
    ]);
    expect(accountsA.status).toBe(200);
    expect(accountsA.body.entries.map((row: { id: number }) => row.id)).toContain(accountA.body.id);
    expect(accountsA.body.entries.map((row: { id: number }) => row.id)).not.toContain(accountB.body.id);
    expect(employeesA.status).toBe(200);
    const employeeIds = employeesA.body.employees.map(
      (row: { user: SeedUser }) => row.user.id,
    );
    expect(employeeIds).toEqual(expect.arrayContaining([userA.id, managerA.id]));
    expect(employeeIds).not.toContain(userB.id);
    expect(employeeIds).not.toContain(ownerUser.id);
    expect(ownProfile.status).toBe(201);
    expect(foreignProfile.status).toBe(404);

    const foreignHrResult = await db.execute(sql`
      SELECT user_id FROM firm_hr_profiles
      WHERE workspace_id = ${workspaceA} AND user_id = ${userB.id}
    `);
    expect(
      (foreignHrResult as unknown as { rows: Array<{ user_id: number }> }).rows,
    ).toHaveLength(0);
  });

  it("binds upload names and private file reads to the authenticated workspace", async () => {
    const [uploadA, uploadB] = await Promise.all([
      request(app)
        .post("/api/firm/storage/uploads/request-url")
        .set("Cookie", cookieA)
        .send({
          actingUserId: userA.id,
          name: `${RUN_ID}-a.txt`,
          size: 12,
          contentType: "text/plain",
        }),
      request(app)
        .post("/api/firm/storage/uploads/request-url")
        .set("Cookie", cookieB)
        .send({
          actingUserId: userB.id,
          name: `${RUN_ID}-b.txt`,
          size: 12,
          contentType: "text/plain",
        }),
    ]);
    expect(uploadA.status).toBe(200);
    expect(uploadB.status).toBe(200);
    expect(uploadA.body.objectPath).toContain(`/firm/${workspaceA}/`);
    expect(uploadB.body.objectPath).toContain(`/firm/${workspaceB}/`);
    expect(uploadA.body.objectPath).not.toBe(uploadB.body.objectPath);

    const crossAttach = await request(app)
      .post(`/api/firm/tasks/${taskA.id}/evidence`)
      .set("Cookie", cookieA)
      .send({
        authorId: userA.id,
        objectPath: uploadB.body.objectPath,
        fileName: `${RUN_ID}-cross-attach.txt`,
        contentType: "text/plain",
        fileSize: 12,
      });
    expect(crossAttach.status).toBe(400);
    const illicitEvidence = await db
      .select({ id: taskEvidenceTable.id })
      .from(taskEvidenceTable)
      .where(
        and(
          eq(taskEvidenceTable.workspaceId, workspaceA),
          eq(taskEvidenceTable.objectPath, uploadB.body.objectPath),
        ),
      );
    expect(illicitEvidence).toHaveLength(0);

    const foreignObjectPath = `/objects/firm/${workspaceB}/uploads/${RUN_ID}-foreign.txt`;
    await db.insert(taskEvidenceTable).values({
      workspaceId: workspaceB,
      taskId: taskB.id,
      authorId: userB.id,
      objectPath: foreignObjectPath,
      fileName: `${RUN_ID}-foreign.txt`,
      contentType: "text/plain",
      fileSize: 12,
    });
    const storageRoute = foreignObjectPath.replace(/^\/objects\//, "/api/firm/storage/objects/");
    const [crossRead, ownRead] = await Promise.all([
      request(app).get(storageRoute).set("Cookie", cookieA),
      request(app).get(storageRoute).set("Cookie", cookieB),
    ]);
    expect(crossRead.status).toBe(404);
    expect(ownRead.status).toBe(200);
    expect(ownRead.text).toBe("fixture");
  });
});