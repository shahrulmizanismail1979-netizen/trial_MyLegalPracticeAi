/**
 * Integration tests for GET /:id/case-home
 *
 * Tests:
 *  - 401 if unauthenticated
 *  - 404 for foreign matter (tenant isolation)
 *  - Returns correct shape: matter, stages, tasks, timeline (newest-first)
 *  - Timeline ordering: verifies events ordered newest-first
 *  - nextAction derivation: overdue task takes precedence
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { inArray } from "drizzle-orm";

// Mock Clerk (needed because app.ts pulls it in for the admin dashboard)
vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => ({ userId: null }),
  clerkClient: {
    users: { getUser: async () => Promise.reject(new Error("not found")) },
  },
}));

// Mock object storage (caseDocuments.ts imports it)
vi.mock("../lib/objectStorage", () => {
  class FakeObjectNotFoundError extends Error {}
  class FakeObjectStorageService {
    async getObjectEntityUploadURL(): Promise<string> {
      return `https://storage.example.com/bucket/.private/uploads/fake-uuid?sig=x`;
    }
    normalizeObjectEntityPath(rawPath: string): string {
      return rawPath;
    }
    async getObjectEntityFile(): Promise<never> {
      throw new FakeObjectNotFoundError("Object not found");
    }
  }
  return {
    ObjectStorageService: FakeObjectStorageService,
    ObjectNotFoundError: FakeObjectNotFoundError,
  };
});

const { default: accidentAuthRouter } = await import("../routes/accident");
const { default: accidentMattersRouter, ensureAccMatterTables } = await import(
  "../accident/matters"
);
const { requireMatterTenant, ownerOf } = await import("../accident/matterAuth");
const { attachCaseHome } = await import("./caseHome");
const { makeCaseTasksRouter } = await import("./caseTasks");
const { ensureCaseIntelligenceTables } = await import("./ensureCaseIntelligenceTables");
const { ensureCaseEventsTable, recordCaseEvent } = await import("./caseEvents");
const { db, pool } = await import("@workspace/db");
const { accessCodesTable, accessCodeUsageTable, accMatters } = await import(
  "@workspace/db/schema"
);

const RUN_ID = `casehome-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const CODE_A = `TEST-${RUN_ID}-A`.toUpperCase();
const CODE_B = `TEST-${RUN_ID}-B`.toUpperCase();

const codeIds: number[] = [];

// Build a minimal app with the acc portal routes
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/accident", accidentAuthRouter);
app.use("/api/accident", accidentMattersRouter);

// Mount tasks router and case-home under the matter tenant auth
app.use("/api/accident", requireMatterTenant as express.RequestHandler, (() => {
  const r = express.Router();

  const getOwnerKey = (req: express.Request): string | null => {
    try {
      return String(ownerOf(req));
    } catch {
      return null;
    }
  };

  // Mount tasks sub-router
  r.use("/matters/:matterId/tasks", makeCaseTasksRouter("acc", getOwnerKey));

  // Mount case-home using the ownership-verifying getMatter from the accident portal
  attachCaseHome({
    router: r,
    portal: "acc",
    pathPrefix: "/matters",
    getOwnerKey,
    getMatter: async (req, res, id) => {
      const matterId = parseInt(id, 10);
      if (Number.isNaN(matterId)) {
        res.status(400).json({ error: "Invalid matter id" });
        return undefined;
      }
      const ownerIdStr = getOwnerKey(req);
      if (!ownerIdStr) {
        res.status(401).json({ error: "Not authenticated" });
        return undefined;
      }
      const ownerId = parseInt(ownerIdStr, 10);
      const { rows } = await pool.query(
        `SELECT * FROM acc_matters WHERE id = $1 AND owner_id = $2 LIMIT 1`,
        [matterId, ownerId],
      );
      if (!rows[0]) {
        res.status(404).json({ error: "Matter not found" });
        return undefined;
      }
      return rows[0] as Record<string, unknown>;
    },
  });

  return r;
})());

async function loginWith(code: string): Promise<string> {
  const res = await request(app)
    .post("/api/accident/auth/verify-code")
    .send({ code });
  expect(res.status, `login with ${code}`).toBe(200);
  const cookie = res.headers["set-cookie"]?.[0]?.split(";")[0];
  return cookie as string;
}

const createdCodeIds: number[] = [];
const createdMatterIds: number[] = [];

beforeAll(async () => {
  await ensureAccMatterTables();
  await ensureCaseIntelligenceTables();
  await ensureCaseEventsTable();

  const rows = await db
    .insert(accessCodesTable)
    .values([
      { code: CODE_A, label: `CaseHome A ${RUN_ID}`, maxUsers: 20 },
      { code: CODE_B, label: `CaseHome B ${RUN_ID}`, maxUsers: 5 },
    ])
    .returning();
  for (const r of rows) codeIds.push(r.id);
  createdCodeIds.push(...codeIds);
});

afterAll(async () => {
  if (createdMatterIds.length) {
    await pool.query(`DELETE FROM case_tasks WHERE matter_id = ANY($1)`, [createdMatterIds]);
    await pool.query(`DELETE FROM case_events WHERE matter_id = ANY($1)`, [createdMatterIds]);
    await pool.query(`DELETE FROM case_checklists WHERE matter_id = ANY($1)`, [createdMatterIds]);
    await db.delete(accMatters).where(inArray(accMatters.id, createdMatterIds));
  }
  if (createdCodeIds.length) {
    await db
      .delete(accessCodeUsageTable)
      .where(inArray(accessCodeUsageTable.accessCodeId, createdCodeIds));
    await db.delete(accessCodesTable).where(inArray(accessCodesTable.id, createdCodeIds));
  }
});

describe("case-home — authentication", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/accident/matters/1/case-home");
    expect(res.status).toBe(401);
  });
});

describe("case-home — ownership", () => {
  it("returns 404 for a matter owned by another tenant", async () => {
    const cookieA = await loginWith(CODE_A);
    const cookieB = await loginWith(CODE_B);

    // A creates a matter
    const created = await request(app)
      .post("/api/accident/matters")
      .set("Cookie", cookieA)
      .send({ title: `Isolation ${RUN_ID}` });
    expect(created.status).toBe(201);
    const mId = created.body.id as number;
    createdMatterIds.push(mId);

    // B tries to access A's case-home → 404
    const bRes = await request(app)
      .get(`/api/accident/matters/${mId}/case-home`)
      .set("Cookie", cookieB);
    expect(bRes.status).toBe(404);
  });

  it("opens only outputs and documents filed to the owned matter", async () => {
    const cookieA = await loginWith(CODE_A);
    const first = await request(app)
      .post("/api/accident/matters")
      .set("Cookie", cookieA)
      .send({ title: `Rail open A ${RUN_ID}` });
    const second = await request(app)
      .post("/api/accident/matters")
      .set("Cookie", cookieA)
      .send({ title: `Rail open B ${RUN_ID}` });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstMatterId = first.body.id as number;
    const secondMatterId = second.body.id as number;
    createdMatterIds.push(firstMatterId, secondMatterId);

    const saved = await pool.query(
      `INSERT INTO acc_saved_work (matter_id, owner_id, kind, title, content)
       VALUES ($1, $2, 'analysis', $3, $4) RETURNING id`,
      [firstMatterId, codeIds[0], `Rail output ${RUN_ID}`, `Private output ${RUN_ID}`],
    );
    const savedId = saved.rows[0].id as number;
    const opened = await request(app)
      .get(`/api/accident/matters/${firstMatterId}/case-home/saved-work/${savedId}/open`)
      .set("Cookie", cookieA);
    expect(opened.status).toBe(200);
    expect(opened.text).toBe(`Private output ${RUN_ID}`);
    expect(opened.headers["content-disposition"]).toMatch(/^inline;/);

    const wrongMatterOutput = await request(app)
      .get(`/api/accident/matters/${secondMatterId}/case-home/saved-work/${savedId}/open`)
      .set("Cookie", cookieA);
    expect(wrongMatterOutput.status).toBe(404);

    const document = await pool.query(
      `INSERT INTO case_documents
         (portal, owner_key, matter_id, object_path, file_name, content_type, size_bytes)
       VALUES ('acc', $1, $2, $3, $4, 'application/pdf', 10) RETURNING id`,
      [String(codeIds[0]), firstMatterId, `/private/${RUN_ID}.pdf`, `Source ${RUN_ID}.pdf`],
    );
    const documentId = document.rows[0].id as number;
    const wrongMatterDocument = await request(app)
      .get(`/api/accident/matters/${secondMatterId}/case-home/documents/${documentId}/open`)
      .set("Cookie", cookieA);
    expect(wrongMatterDocument.status).toBe(404);
    await pool.query(`DELETE FROM case_documents WHERE id = $1`, [documentId]);
  });
});

describe("case-home — shape and content", () => {
  it("returns a complete case home with all required fields", async () => {
    const cookieA = await loginWith(CODE_A);

    // Create a matter
    const created = await request(app)
      .post("/api/accident/matters")
      .set("Cookie", cookieA)
      .send({
        title: `Home test ${RUN_ID}`,
        clientName: "Lim Ah Kow",
        actingFor: "Plaintiff",
        matterType: "running-down",
      });
    expect(created.status).toBe(201);
    const mId = created.body.id as number;
    createdMatterIds.push(mId);

    // Add a deadline
    await request(app)
      .post(`/api/accident/matters/${mId}/deadlines`)
      .set("Cookie", cookieA)
      .send({ title: "File writ", dueDate: "2030-06-15" });

    // Add a task
    const taskRes = await request(app)
      .post(`/api/accident/matters/${mId}/tasks`)
      .set("Cookie", cookieA)
      .send({ title: `Draft SOC ${RUN_ID}`, priority: "high", due_date: "2030-05-01" });
    expect(taskRes.status).toBe(201);

    // Add a case event via recordCaseEvent
    const ownerKey = String(codeIds[0]);
    await recordCaseEvent("acc", mId, ownerKey, {
      event_date: "2025-01-10",
      title: `Hearing note ${RUN_ID}`,
      kind: "note",
    });

    // GET case-home
    const res = await request(app)
      .get(`/api/accident/matters/${mId}/case-home`)
      .set("Cookie", cookieA);
    expect(res.status).toBe(200);

    const body = res.body;

    // Required top-level fields
    expect(body.matter).toBeDefined();
    expect(body.matter.id).toBe(mId);
    expect(body.matter.title).toContain(RUN_ID);
    // Owner FK columns excluded from normalized matter
    expect(body.matter.owner_id).toBeUndefined();

    expect(Array.isArray(body.stages)).toBe(true);
    expect(body.stages.length).toBeGreaterThan(0);
    expect(body.stageCount).toBe(body.stages.length);
    expect(body.currentStage).toBeDefined();
    expect(typeof body.stageIndex).toBe("number");

    // nextDeadline populated
    expect(body.nextDeadline).toBeTruthy();
    expect(body.nextDeadline.title).toBe("File writ");

    // Deadline appears in the unified timeline with due date + status metadata
    const deadlineEntry = body.timeline.find(
      (e: { origin: string; title: string }) =>
        e.origin === "deadline" && e.title.includes("File writ"),
    );
    expect(deadlineEntry).toBeDefined();
    expect(deadlineEntry.kind).toBe("deadline");
    expect(deadlineEntry.meta.due_date).toBe("2030-06-15");
    expect(deadlineEntry.source).toMatch(/^deadline:/);
    // Timeline ts for deadline must equal the due date (not event created_at)
    expect(deadlineEntry.ts.slice(0, 10)).toBe("2030-06-15");

    // No duplicate sources in the timeline (each source appears at most once)
    const sources = (body.timeline as Array<{ source?: string | null }>)
      .map((e) => e.source)
      .filter(Boolean);
    const uniqueSources = new Set(sources);
    expect(uniqueSources.size).toBe(sources.length);

    // Tasks
    expect(Array.isArray(body.tasks)).toBe(true);
    const taskFound = body.tasks.find((t: { title: string }) => t.title.includes(RUN_ID));
    expect(taskFound).toBeDefined();
    expect(Array.isArray(body.outstandingTasks)).toBe(true);

    // Task timeline entry carries updated_at as ts and richer metadata
    const taskEntry = body.timeline.find(
      (e: { origin: string; title: string }) =>
        e.origin === "task" && e.title.includes(RUN_ID),
    );
    expect(taskEntry).toBeDefined();
    expect(taskEntry.meta.priority).toBe("high");
    expect(taskEntry.meta.due_date).toBe("2030-05-01");

    // Checklist
    expect(body.checklist).toBeDefined();
    expect(typeof body.checklist.total).toBe("number");
    expect(typeof body.checklist.done).toBe("number");

    // People
    expect(Array.isArray(body.people)).toBe(true);

    // Documents
    expect(Array.isArray(body.documents)).toBe(true);

    // Timeline
    expect(Array.isArray(body.timeline)).toBe(true);
    // Timeline entries have required fields
    if (body.timeline.length > 0) {
      const first = body.timeline[0];
      expect(typeof first.ts).toBe("string");
      expect(typeof first.kind).toBe("string");
      expect(typeof first.title).toBe("string");
      expect(typeof first.origin).toBe("string");
    }

    // nextAction
    expect(body.nextAction).toBeDefined();
    expect(typeof body.nextAction.source).toBe("string");
    expect(typeof body.nextAction.label).toBe("string");
  });

  it("timeline is ordered newest-first (deterministic)", async () => {
    const cookieA = await loginWith(CODE_A);
    const ownerKey = String(codeIds[0]);

    // Create a matter
    const created = await request(app)
      .post("/api/accident/matters")
      .set("Cookie", cookieA)
      .send({ title: `Timeline order ${RUN_ID}` });
    expect(created.status).toBe(201);
    const mId = created.body.id as number;
    createdMatterIds.push(mId);

    // Insert events with different dates
    await recordCaseEvent("acc", mId, ownerKey, {
      event_date: "2024-01-01",
      title: `Old event ${RUN_ID}`,
      kind: "note",
    });
    await recordCaseEvent("acc", mId, ownerKey, {
      event_date: "2025-06-15",
      title: `Newer event ${RUN_ID}`,
      kind: "filing",
    });
    await recordCaseEvent("acc", mId, ownerKey, {
      event_date: "2026-03-20",
      title: `Newest event ${RUN_ID}`,
      kind: "hearing",
    });

    const res = await request(app)
      .get(`/api/accident/matters/${mId}/case-home`)
      .set("Cookie", cookieA);
    expect(res.status).toBe(200);

    const timeline = res.body.timeline as Array<{ ts: string; title: string }>;
    // Find our test events
    const testEntries = timeline.filter((e) => e.title.includes(RUN_ID));
    expect(testEntries.length).toBeGreaterThanOrEqual(3);

    // Verify they are in descending timestamp order
    for (let i = 0; i < testEntries.length - 1; i++) {
      expect(testEntries[i].ts >= testEntries[i + 1].ts).toBe(true);
    }
  });

  it("generic event timeline ts is event_date, not insertion (created_at) order", async () => {
    // Regression: events inserted newest-event_date-first so their created_at
    // order is the REVERSE of their event_date order.  The timeline must still
    // sort by event_date DESC, not by created_at DESC.
    const cookieA = await loginWith(CODE_A);
    const ownerKey = String(codeIds[0]);

    const created = await request(app)
      .post("/api/accident/matters")
      .set("Cookie", cookieA)
      .send({ title: `Event-date order ${RUN_ID}` });
    expect(created.status).toBe(201);
    const mId = created.body.id as number;
    createdMatterIds.push(mId);

    // Insert in descending event_date order so created_at is the inverse of
    // event_date — the oldest event_date is inserted last (highest created_at).
    await recordCaseEvent("acc", mId, ownerKey, {
      event_date: "2028-09-01",
      title: `Ev-future ${RUN_ID}`,
      kind: "hearing",
    });
    await recordCaseEvent("acc", mId, ownerKey, {
      event_date: "2022-03-15",
      title: `Ev-middle ${RUN_ID}`,
      kind: "filing",
    });
    // Inserted last → highest created_at, but has the oldest event_date
    await recordCaseEvent("acc", mId, ownerKey, {
      event_date: "2019-07-04",
      title: `Ev-oldest ${RUN_ID}`,
      kind: "note",
    });

    const res = await request(app)
      .get(`/api/accident/matters/${mId}/case-home`)
      .set("Cookie", cookieA);
    expect(res.status).toBe(200);

    const timeline = res.body.timeline as Array<{ ts: string; title: string; origin: string }>;
    const testEntries = timeline.filter(
      (e) => e.origin === "event" && e.title.includes(RUN_ID),
    );
    expect(testEntries.length).toBe(3);

    // ts values must reflect event_date (date portion), not created_at
    expect(testEntries[0].ts.slice(0, 10)).toBe("2028-09-01"); // future
    expect(testEntries[1].ts.slice(0, 10)).toBe("2022-03-15"); // middle
    expect(testEntries[2].ts.slice(0, 10)).toBe("2019-07-04"); // oldest

    // Confirm the oldest-event_date entry (inserted last, highest created_at)
    // appears at the bottom, not the top — proving created_at is NOT the key.
    expect(testEntries[2].title).toContain("Ev-oldest");
    expect(testEntries[0].title).toContain("Ev-future");
  });

  it("nextAction picks overdue task over next deadline", async () => {
    const cookieA = await loginWith(CODE_A);
    const ownerKey = String(codeIds[0]);

    // Create a matter
    const created = await request(app)
      .post("/api/accident/matters")
      .set("Cookie", cookieA)
      .send({ title: `NextAction test ${RUN_ID}` });
    expect(created.status).toBe(201);
    const mId = created.body.id as number;
    createdMatterIds.push(mId);

    // Add a future deadline
    await request(app)
      .post(`/api/accident/matters/${mId}/deadlines`)
      .set("Cookie", cookieA)
      .send({ title: "Future deadline", dueDate: "2030-12-31" });

    // Add an OVERDUE task (due date in the past)
    const taskRes = await request(app)
      .post(`/api/accident/matters/${mId}/tasks`)
      .set("Cookie", cookieA)
      .send({
        title: `Overdue action ${RUN_ID}`,
        due_date: "2020-01-01",
        priority: "medium",
      });
    expect(taskRes.status).toBe(201);

    const res = await request(app)
      .get(`/api/accident/matters/${mId}/case-home`)
      .set("Cookie", cookieA);
    expect(res.status).toBe(200);

    // nextAction should be the overdue task, not the deadline
    expect(res.body.nextAction.source).toBe("task");
    expect(res.body.nextAction.reason).toBe("overdue");
    expect(res.body.nextAction.label).toContain(RUN_ID);
  });

  it("saved-work tool field is always non-null and task ts reflects updated_at", async () => {
    const cookieA = await loginWith(CODE_A);
    const ownerKey = String(codeIds[0]);

    const created = await request(app)
      .post("/api/accident/matters")
      .set("Cookie", cookieA)
      .send({ title: `Tool+TS test ${RUN_ID}` });
    expect(created.status).toBe(201);
    const mId = created.body.id as number;
    createdMatterIds.push(mId);

    // ── Saved work: tool from input_json.tool ──────────────────────────────
    // Insert directly so we can control input_json exactly
    const { pool: pg } = await import("@workspace/db");
    const swWithTool = await pg.query(
      `INSERT INTO acc_saved_work (matter_id, owner_id, kind, title, input_json, content)
       VALUES ($1, $2, 'contract-draft', $3, $4, '')
       RETURNING id`,
      [
        mId,
        codeIds[0],
        `Tool-keyed work ${RUN_ID}`,
        JSON.stringify({ tool: "ContractDraftAI", extra: "x" }),
      ],
    );
    const swWithToolId = swWithTool.rows[0].id as number;

    // Insert saved work with NO tool key (fallback to kind)
    const swNoTool = await pg.query(
      `INSERT INTO acc_saved_work (matter_id, owner_id, kind, title, input_json, content)
       VALUES ($1, $2, 'demand-letter', $3, NULL, '')
       RETURNING id`,
      [mId, codeIds[0], `No-tool work ${RUN_ID}`],
    );
    const swNoToolId = swNoTool.rows[0].id as number;

    // ── Task: create then update to get a different updated_at ─────────────
    const taskRes = await request(app)
      .post(`/api/accident/matters/${mId}/tasks`)
      .set("Cookie", cookieA)
      .send({ title: `TS task ${RUN_ID}`, priority: "low" });
    expect(taskRes.status).toBe(201);
    const taskId = taskRes.body.id as number;

    // Small delay then patch to guarantee updated_at > created_at
    await new Promise((r) => setTimeout(r, 50));
    const patchRes = await request(app)
      .patch(`/api/accident/matters/${mId}/tasks/${taskId}`)
      .set("Cookie", cookieA)
      .send({ priority: "high" });
    expect(patchRes.status).toBe(200);
    const updatedAt = patchRes.body.updated_at as string;

    const res = await request(app)
      .get(`/api/accident/matters/${mId}/case-home`)
      .set("Cookie", cookieA);
    expect(res.status).toBe(200);
    const timeline = res.body.timeline as Array<{
      origin: string;
      title: string;
      tool?: string | null;
      ts: string;
      source?: string;
    }>;

    // Saved-work entry with tool key → uses input_json.tool
    const toolEntry = timeline.find((e) => e.source === `saved-work:${swWithToolId}`);
    expect(toolEntry, "saved-work with tool key must appear in timeline").toBeDefined();
    expect(toolEntry!.tool).toBe("ContractDraftAI");

    // Saved-work entry without tool key → falls back to kind (non-null)
    const noToolEntry = timeline.find((e) => e.source === `saved-work:${swNoToolId}`);
    expect(noToolEntry, "saved-work without tool key must appear in timeline").toBeDefined();
    expect(noToolEntry!.tool).toBe("demand-letter"); // kind as fallback
    expect(noToolEntry!.tool).not.toBeNull();

    // Task ts must equal updated_at (not created_at) after a patch
    const taskEntry = timeline.find((e) => e.source === `task:${taskId}`);
    expect(taskEntry, "task must appear in timeline").toBeDefined();
    // Allow 1-second slop for sub-second DB precision differences
    const tsDiff = Math.abs(
      new Date(taskEntry!.ts).getTime() - new Date(updatedAt).getTime(),
    );
    expect(tsDiff).toBeLessThan(1000);

    // No duplicate sources
    const allSources = timeline.map((e) => e.source).filter(Boolean);
    expect(new Set(allSources).size).toBe(allSources.length);
  });
});
