/**
 * Integration tests: MyCCBLitAI master/demo code matter-file access (Task #438)
 *
 * Verifies that sessions authenticated with a master access code or a static
 * demo code (CCBLIT2024, MYCCBLIT, …) can create and view their own matter
 * files — rather than hitting "Matter files require a subscriber access code".
 *
 * The fix maps each static code to its own synthetic (inactive) access-code
 * row so the shared matter routes have a stable numeric tenant id to work with.
 *
 * Properties tested:
 *   1. MASTER_ACCESS_CODE session reaches GET /api/ccb/matters (no 403 barrier).
 *   2. MASTER_ACCESS_CODE session can create a matter via POST /api/ccb/matters.
 *   3. A demo/static session (CCBLIT2024) can also list and create matters.
 *   4. Matters created by one static code are invisible to a different static code.
 *   5. The synthetic DB row is inactive — it cannot be used to log in via /auth/verify.
 *
 * IMPORTANT: MASTER_ACCESS_CODE must be set before the app module is evaluated
 * because auth.ts reads it at import time (`const MASTER_CODE = process.env...`).
 * Vitest runs each file in its own worker, so setting it here before `await import`
 * guarantees the module sees the controlled test value.
 */

// Set the master access code BEFORE importing the app so auth.ts picks it up.
const TEST_MASTER_CODE = "TEST-MASTER-CCB-438";
process.env.MASTER_ACCESS_CODE = TEST_MASTER_CODE;

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

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

// App import happens AFTER process.env.MASTER_ACCESS_CODE is set above.
const { default: app } = await import("../../app");
const { pool } = await import("@workspace/db");
const { ensureMatterFileTables } = await import("../../lib/matterFiles");
const { ensureCaseEventsTable } = await import("../../lib/caseEvents");

// Two demo/static codes from the default ENV_CODES list (auth.ts).
const CODE_DEMO_A = "CCBLIT2024";
const CODE_DEMO_B = "MYCCBLIT";

// Synthetic row prefix from matterAuth.ts
const SYNTHETIC_PREFIX = "MASTER-OVERRIDE-CCB:";

const SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me";

function makeToken(code: string) {
  return jwt.sign({ role: "practitioner", code }, SECRET, { expiresIn: "1h" });
}

function api(method: "get" | "post" | "patch" | "delete", path: string, token: string) {
  const r = request(app);
  const req =
    method === "get" ? r.get(path)
    : method === "post" ? r.post(path)
    : method === "patch" ? r.patch(path)
    : r.delete(path);
  return req.set("Authorization", `Bearer ${token}`);
}

const createdMatterIds: number[] = [];

beforeAll(async () => {
  await ensureMatterFileTables();
  await ensureCaseEventsTable();
});

afterAll(async () => {
  // Remove any matters owned by synthetic rows created during this test run.
  const allCodes = [TEST_MASTER_CODE, CODE_DEMO_A, CODE_DEMO_B].map(
    (c) => `${SYNTHETIC_PREFIX}${c}`,
  );
  const { rows: synRows } = await pool.query<{ id: number }>(
    `SELECT id FROM ccb_access_codes WHERE code = ANY($1)`,
    [allCodes],
  );
  if (synRows.length > 0) {
    const ownerIds = synRows.map((r) => r.id);
    await pool.query(`DELETE FROM ccb_matters WHERE access_code_id = ANY($1::int[])`, [ownerIds]);
  }
  // Belt-and-suspenders: also delete by the explicit matter ids we captured.
  if (createdMatterIds.length > 0) {
    await pool.query(
      `DELETE FROM case_events WHERE portal = 'ccb' AND matter_id = ANY($1::int[])`,
      [createdMatterIds],
    );
    await pool.query(`DELETE FROM ccb_matters WHERE id = ANY($1::int[])`, [createdMatterIds]);
  }
});

describe("CCB master/demo code matter-file access", () => {
  // ── Master access code ────────────────────────────────────────────────────

  it("MASTER_ACCESS_CODE session can list matters without a 403 error", async () => {
    const token = makeToken(TEST_MASTER_CODE);
    const res = await api("get", "/api/ccb/matters", token);
    expect(res.status, `list matters body: ${JSON.stringify(res.body)}`).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("MASTER_ACCESS_CODE session can create a matter", async () => {
    const token = makeToken(TEST_MASTER_CODE);
    const res = await api("post", "/api/ccb/matters", token).send({
      title: "Master Code Test Matter",
      matterType: "Corporate Finance",
    });
    expect(res.status, `create matter body: ${JSON.stringify(res.body)}`).toBe(201);
    expect(typeof res.body.id).toBe("number");
    createdMatterIds.push(res.body.id as number);
  });

  it("MASTER_ACCESS_CODE session can retrieve the matter it created", async () => {
    const token = makeToken(TEST_MASTER_CODE);
    // Create a fresh matter.
    const createRes = await api("post", "/api/ccb/matters", token).send({
      title: "Master Read-Back Test",
    });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id as number;
    createdMatterIds.push(id);

    // Must be visible in list.
    const listRes = await api("get", "/api/ccb/matters", token);
    expect(listRes.status).toBe(200);
    const ids = (listRes.body as Array<{ id: number }>).map((m) => m.id);
    expect(ids).toContain(id);

    // Must be retrievable by id.
    const getRes = await api("get", `/api/ccb/matters/${id}`, token);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(id);
  });

  // ── Demo / static codes ───────────────────────────────────────────────────

  it("demo code session can list and create matters without a 403 error", async () => {
    const token = makeToken(CODE_DEMO_A);
    const listRes = await api("get", "/api/ccb/matters", token);
    expect(listRes.status, `list body: ${JSON.stringify(listRes.body)}`).toBe(200);

    const createRes = await api("post", "/api/ccb/matters", token).send({
      title: "Demo Code Test Matter",
    });
    expect(createRes.status, `create body: ${JSON.stringify(createRes.body)}`).toBe(201);
    createdMatterIds.push(createRes.body.id as number);
  });

  // ── Isolation ─────────────────────────────────────────────────────────────

  it("matters created by master code are invisible to a different demo code", async () => {
    const masterToken = makeToken(TEST_MASTER_CODE);
    const demoToken = makeToken(CODE_DEMO_B);

    // Create a matter under the master code.
    const createRes = await api("post", "/api/ccb/matters", masterToken).send({
      title: "Master-Only Isolation Matter",
    });
    expect(createRes.status).toBe(201);
    const masterId = createRes.body.id as number;
    createdMatterIds.push(masterId);

    // Demo B list must not include the master's matter.
    const listResB = await api("get", "/api/ccb/matters", demoToken);
    expect(listResB.status).toBe(200);
    const ids = (listResB.body as Array<{ id: number }>).map((m) => m.id);
    expect(ids, "Demo B must not see master's matter").not.toContain(masterId);

    // Demo B cannot fetch the master's matter directly either.
    const fetchRes = await api("get", `/api/ccb/matters/${masterId}`, demoToken);
    expect(fetchRes.status, "cross-code direct fetch must be 404").toBe(404);
  });

  it("matters created by one demo code are invisible to another demo code", async () => {
    const tokenA = makeToken(CODE_DEMO_A);
    const tokenB = makeToken(CODE_DEMO_B);

    const createRes = await api("post", "/api/ccb/matters", tokenA).send({
      title: "Code A Exclusive Matter",
    });
    expect(createRes.status).toBe(201);
    const matterIdA = createRes.body.id as number;
    createdMatterIds.push(matterIdA);

    const listResB = await api("get", "/api/ccb/matters", tokenB);
    expect(listResB.status).toBe(200);
    const ids = (listResB.body as Array<{ id: number }>).map((m) => m.id);
    expect(ids, "Code B must not see Code A's matter").not.toContain(matterIdA);

    const fetchRes = await api("get", `/api/ccb/matters/${matterIdA}`, tokenB);
    expect(fetchRes.status, "cross-code direct fetch must be 404").toBe(404);
  });

  // ── Synthetic-row security ────────────────────────────────────────────────

  it("synthetic row is inactive and cannot be used to log in via /auth/verify", async () => {
    // Ensure the synthetic row exists by making a request with the master token.
    const token = makeToken(TEST_MASTER_CODE);
    await api("get", "/api/ccb/matters", token);

    // Attempt to log in with the raw synthetic row code — must be rejected.
    const syntheticCode = `${SYNTHETIC_PREFIX}${TEST_MASTER_CODE}`;
    const loginRes = await request(app)
      .post("/api/ccb/auth/verify")
      .send({ code: syntheticCode });
    expect(
      [400, 401, 403],
      `synthetic-row login response: ${JSON.stringify(loginRes.body)}`,
    ).toContain(loginRes.status);
    expect(loginRes.body.token).toBeUndefined();
  });

  it("demo code synthetic row is also inactive and cannot be used to log in", async () => {
    const token = makeToken(CODE_DEMO_A);
    await api("get", "/api/ccb/matters", token);

    const syntheticCode = `${SYNTHETIC_PREFIX}${CODE_DEMO_A}`;
    const loginRes = await request(app)
      .post("/api/ccb/auth/verify")
      .send({ code: syntheticCode });
    expect(
      [400, 401, 403],
      `demo synthetic-row login response: ${JSON.stringify(loginRes.body)}`,
    ).toContain(loginRes.status);
    expect(loginRes.body.token).toBeUndefined();
  });

  // ── Chronology mirroring (Task #137) ──────────────────────────────────────
  //
  // Deadlines and matter-linked saved work must record best-effort case_events
  // with stable "deadline:<id>" / "saved-work:<id>" source markers, scoped to
  // the owning tenant (portal="ccb").

  async function eventsForMatter(matterId: number) {
    const { rows } = await pool.query<{ kind: string; source: string; title: string }>(
      `SELECT kind, source, title FROM case_events WHERE portal = 'ccb' AND matter_id = $1`,
      [matterId],
    );
    return rows;
  }

  // Chronology mirrors are best-effort (fire-and-forget void writes), so the
  // background write may not have flushed by the time the HTTP response
  // returns. Poll until the expected condition holds (or time out).
  async function waitForEvents(
    matterId: number,
    predicate: (rows: Array<{ kind: string; source: string; title: string }>) => boolean,
    attempts = 20,
  ) {
    let rows = await eventsForMatter(matterId);
    for (let i = 0; i < attempts && !predicate(rows); i++) {
      await new Promise((r) => setTimeout(r, 50));
      rows = await eventsForMatter(matterId);
    }
    return rows;
  }

  it("records, updates, and deletes a case_event mirror for a deadline", async () => {
    const token = makeToken(TEST_MASTER_CODE);
    const matterRes = await api("post", "/api/ccb/matters", token).send({
      title: "Deadline Mirror Matter",
    });
    expect(matterRes.status).toBe(201);
    const matterId = matterRes.body.id as number;
    createdMatterIds.push(matterId);

    // Create a deadline → expect a "deadline:<id>" event.
    const dlRes = await api("post", `/api/ccb/matters/${matterId}/deadlines`, token).send({
      title: "File statement of claim",
      dueDate: "2031-03-01",
    });
    expect(dlRes.status, `create deadline: ${JSON.stringify(dlRes.body)}`).toBe(201);
    const deadlineId = dlRes.body.id as number;

    let events = await waitForEvents(matterId, (rows) =>
      rows.some((e) => e.source === `deadline:${deadlineId}`),
    );
    const created = events.find((e) => e.source === `deadline:${deadlineId}`);
    expect(created, `events: ${JSON.stringify(events)}`).toBeDefined();
    expect(created!.kind).toBe("deadline");
    expect(created!.title).toContain("File statement of claim");

    // Update the deadline title → mirror event title updates.
    const patchRes = await api(
      "patch",
      `/api/ccb/matters/${matterId}/deadlines/${deadlineId}`,
      token,
    ).send({ title: "File amended statement of claim" });
    expect(patchRes.status).toBe(200);

    events = await waitForEvents(matterId, (rows) =>
      rows.some((e) => e.source === `deadline:${deadlineId}` && e.title.includes("amended")),
    );
    const updated = events.find((e) => e.source === `deadline:${deadlineId}`);
    expect(updated).toBeDefined();
    expect(updated!.title).toContain("amended");

    // Delete the deadline → mirror event removed.
    const delRes = await api(
      "delete",
      `/api/ccb/matters/${matterId}/deadlines/${deadlineId}`,
      token,
    );
    expect(delRes.status).toBe(200);

    events = await waitForEvents(
      matterId,
      (rows) => !rows.some((e) => e.source === `deadline:${deadlineId}`),
    );
    expect(events.find((e) => e.source === `deadline:${deadlineId}`)).toBeUndefined();
  });

  it("records case_event mirrors for bulk-created deadlines", async () => {
    const token = makeToken(TEST_MASTER_CODE);
    const matterRes = await api("post", "/api/ccb/matters", token).send({
      title: "Bulk Deadline Mirror Matter",
    });
    expect(matterRes.status).toBe(201);
    const matterId = matterRes.body.id as number;
    createdMatterIds.push(matterId);

    const bulkRes = await api("post", `/api/ccb/matters/${matterId}/deadlines/bulk`, token).send({
      deadlines: [
        { title: "First hearing", dueDate: "2031-04-01" },
        { title: "Second hearing", dueDate: "2031-05-01" },
      ],
    });
    expect(bulkRes.status, `bulk: ${JSON.stringify(bulkRes.body)}`).toBe(201);
    const ids = (bulkRes.body as Array<{ id: number }>).map((r) => r.id);
    expect(ids.length).toBe(2);

    const events = await waitForEvents(matterId, (rows) =>
      ids.every((id) => rows.some((e) => e.source === `deadline:${id}`)),
    );
    for (const id of ids) {
      const ev = events.find((e) => e.source === `deadline:${id}`);
      expect(ev, `missing event for deadline ${id}: ${JSON.stringify(events)}`).toBeDefined();
      expect(ev!.kind).toBe("deadline");
    }
  });

  it("records a case_event mirror for matter-linked saved work", async () => {
    const token = makeToken(TEST_MASTER_CODE);
    const matterRes = await api("post", "/api/ccb/matters", token).send({
      title: "Saved Work Mirror Matter",
    });
    expect(matterRes.status).toBe(201);
    const matterId = matterRes.body.id as number;
    createdMatterIds.push(matterId);

    const swRes = await api("post", "/api/ccb/saved-work", token).send({
      kind: "memo",
      title: "Board resolution draft",
      matterId,
      content: "Draft content",
    });
    expect(swRes.status, `saved work: ${JSON.stringify(swRes.body)}`).toBe(201);
    const swId = swRes.body.id as number;

    const events = await waitForEvents(matterId, (rows) =>
      rows.some((e) => e.source === `saved-work:${swId}`),
    );
    const ev = events.find((e) => e.source === `saved-work:${swId}`);
    expect(ev, `events: ${JSON.stringify(events)}`).toBeDefined();
    expect(ev!.kind).toBe("saved-work");
    expect(ev!.title).toContain("Board resolution draft");
  });
});
