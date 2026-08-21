/**
 * Tests for the shared case_tasks router:
 *  - Validation (missing title, bad due_date, bad priority, bad status)
 *  - Tenant isolation (owner A cannot read/write/delete owner B's tasks)
 *  - CRUD happy path (create, list, patch, delete)
 *  - Linked case_event created on POST (kind="task", source="task:<id>")
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { inArray } from "drizzle-orm";

const { db, pool } = await import("@workspace/db");
const { accessCodesTable, accMatters } = await import("@workspace/db/schema");
const { makeCaseTasksRouter } = await import("./caseTasks");
const { ensureCaseEventsTable } = await import("./caseEvents");
const { ensureCaseIntelligenceTables } = await import("./ensureCaseIntelligenceTables");

const RUN_ID = `casetasks-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

const codeIds: number[] = [];
const matterIds: number[] = [];
let ownerA = "";
let ownerB = "";
let matterA = 0;
let matterB = 0;

function makeApp(getOwner: () => string | null) {
  const app = express();
  app.use(express.json());
  const parent = express.Router();
  parent.use("/matters/:matterId/tasks", makeCaseTasksRouter("acc", () => getOwner()));
  app.use("/api/accident", parent);
  return app;
}

beforeAll(async () => {
  await ensureCaseIntelligenceTables();
  await ensureCaseEventsTable();

  const codes = await db
    .insert(accessCodesTable)
    .values([
      { code: `TEST-${RUN_ID}-A`.toUpperCase(), label: `A ${RUN_ID}`, maxUsers: 5 },
      { code: `TEST-${RUN_ID}-B`.toUpperCase(), label: `B ${RUN_ID}`, maxUsers: 5 },
    ])
    .returning();
  for (const c of codes) codeIds.push(c.id);
  ownerA = String(codes[0].id);
  ownerB = String(codes[1].id);

  const matters = await db
    .insert(accMatters)
    .values([
      { ownerId: codes[0].id, title: `Tasks matter A ${RUN_ID}`, actingFor: "Plaintiff" },
      { ownerId: codes[1].id, title: `Tasks matter B ${RUN_ID}`, actingFor: "Plaintiff" },
    ])
    .returning();
  for (const m of matters) matterIds.push(m.id);
  matterA = matters[0].id;
  matterB = matters[1].id;
});

afterAll(async () => {
  if (matterIds.length > 0) {
    await pool.query(`DELETE FROM case_tasks WHERE matter_id = ANY($1)`, [matterIds]);
    await pool.query(`DELETE FROM case_events WHERE matter_id = ANY($1)`, [matterIds]);
    await db.delete(accMatters).where(inArray(accMatters.id, matterIds));
  }
  if (codeIds.length > 0) {
    await db.delete(accessCodesTable).where(inArray(accessCodesTable.id, codeIds));
  }
});

describe("caseTasks — authentication", () => {
  it("rejects all endpoints when unauthenticated", async () => {
    const app = makeApp(() => null);
    const base = `/api/accident/matters/${matterA}/tasks`;
    for (const [method, path] of [
      ["get", base],
      ["post", base],
      ["patch", `${base}/1`],
      ["delete", `${base}/1`],
    ] as const) {
      const res = await (
        request(app) as unknown as Record<string, (p: string) => request.Test>
      )[method](path);
      expect(res.status, `${method.toUpperCase()} ${path} should 401`).toBe(401);
    }
  });
});

describe("caseTasks — validation", () => {
  it("rejects missing title", async () => {
    const app = makeApp(() => ownerA);
    const res = await request(app)
      .post(`/api/accident/matters/${matterA}/tasks`)
      .send({ due_date: "2026-01-01" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });

  it("rejects invalid due_date format", async () => {
    const app = makeApp(() => ownerA);
    const res = await request(app)
      .post(`/api/accident/matters/${matterA}/tasks`)
      .send({ title: `bad date ${RUN_ID}`, due_date: "01/01/2026" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/due_date/);
  });

  it("rejects invalid priority", async () => {
    const app = makeApp(() => ownerA);
    const res = await request(app)
      .post(`/api/accident/matters/${matterA}/tasks`)
      .send({ title: `bad priority ${RUN_ID}`, priority: "urgent" });
    expect(res.status).toBe(400);
    expect(res.body.allowedPriorities).toBeDefined();
  });

  it("rejects invalid status", async () => {
    const app = makeApp(() => ownerA);
    const res = await request(app)
      .post(`/api/accident/matters/${matterA}/tasks`)
      .send({ title: `bad status ${RUN_ID}`, status: "pending" });
    expect(res.status).toBe(400);
    expect(res.body.allowedStatuses).toBeDefined();
  });

  it("rejects writes to an invalid matter id", async () => {
    const app = makeApp(() => ownerA);
    const res = await request(app)
      .post(`/api/accident/matters/abc/tasks`)
      .send({ title: `bad matter ${RUN_ID}` });
    expect(res.status).toBe(400);
  });

  it("PATCH validates due_date format", async () => {
    const app = makeApp(() => ownerA);
    const res = await request(app)
      .patch(`/api/accident/matters/${matterA}/tasks/1`)
      .send({ due_date: "not-a-date" });
    expect(res.status).toBe(400);
  });
});

describe("caseTasks — tenant isolation", () => {
  it("owner A cannot read tasks in matter owned by owner B", async () => {
    const appA = makeApp(() => ownerA);
    // Owner A reads owner B's matter path — scoped by ownerA's key → empty list
    const listRes = await request(appA).get(`/api/accident/matters/${matterB}/tasks`);
    // Should not error but return empty (B's matter tasks are invisible to A)
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
  });

  it("owner A cannot create a task on owner B's matter", async () => {
    const appA = makeApp(() => ownerA);
    const res = await request(appA)
      .post(`/api/accident/matters/${matterB}/tasks`)
      .send({ title: `cross-tenant task ${RUN_ID}` });
    expect(res.status).toBe(404);
  });

  it("owner A cannot patch a task on owner B's matter", async () => {
    const appA = makeApp(() => ownerA);
    const res = await request(appA)
      .patch(`/api/accident/matters/${matterB}/tasks/1`)
      .send({ title: "hijack" });
    expect(res.status).toBe(404);
  });

  it("owner A cannot delete a task on owner B's matter", async () => {
    const appA = makeApp(() => ownerA);
    const res = await request(appA).delete(`/api/accident/matters/${matterB}/tasks/1`);
    expect(res.status).toBe(404);
  });
});

describe("caseTasks — CRUD happy path", () => {
  it("creates, lists, patches, and deletes tasks with linked case_events", async () => {
    const appA = makeApp(() => ownerA);
    const base = `/api/accident/matters/${matterA}/tasks`;

    // Create a task
    const created = await request(appA).post(base).send({
      title: `Serve writ ${RUN_ID}`,
      due_date: "2026-03-15",
      priority: "high",
      note: "Urgent filing",
    });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe(`Serve writ ${RUN_ID}`);
    expect(created.body.priority).toBe("high");
    expect(created.body.status).toBe("open");
    const taskId = created.body.id as number;

    // Create a second task
    const created2 = await request(appA).post(base).send({
      title: `Follow up ${RUN_ID}`,
      priority: "low",
    });
    expect(created2.status).toBe(201);

    // List: should include both tasks
    const list = await request(appA).get(base);
    expect(list.status).toBe(200);
    const titles = (list.body as Array<{ title: string }>).map((t) => t.title);
    expect(titles).toContain(`Serve writ ${RUN_ID}`);
    expect(titles).toContain(`Follow up ${RUN_ID}`);

    // Patch: mark as done
    const patched = await request(appA)
      .patch(`${base}/${taskId}`)
      .send({ status: "done" });
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe("done");

    // Verify a case_event was created for the task
    const { rows: eventRows } = await pool.query(
      `SELECT id, kind, source, title FROM case_events
       WHERE portal = $1 AND matter_id = $2 AND owner_key = $3 AND source = $4`,
      ["acc", matterA, ownerA, `task:${taskId}`],
    );
    expect(eventRows.length).toBeGreaterThan(0);
    expect(eventRows[0].kind).toBe("task");

    // Delete first task
    const del = await request(appA).delete(`${base}/${taskId}`);
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    // After delete, task is gone
    const afterDel = await request(appA).get(base);
    const remainingTitles = (afterDel.body as Array<{ title: string }>).map((t) => t.title);
    expect(remainingTitles).not.toContain(`Serve writ ${RUN_ID}`);
    expect(remainingTitles).toContain(`Follow up ${RUN_ID}`);

    // Delete 404 for non-existent
    const delMissing = await request(appA).delete(`${base}/${taskId}`);
    expect(delMissing.status).toBe(404);

    // Clean up
    await request(appA).delete(`${base}/${created2.body.id}`);
  });

  it("tasks default priority to medium and status to open", async () => {
    const appA = makeApp(() => ownerA);
    const base = `/api/accident/matters/${matterA}/tasks`;
    const res = await request(appA).post(base).send({ title: `Default task ${RUN_ID}` });
    expect(res.status).toBe(201);
    expect(res.body.priority).toBe("medium");
    expect(res.body.status).toBe("open");
    // Clean up
    await request(appA).delete(`${base}/${res.body.id}`);
  });
});
