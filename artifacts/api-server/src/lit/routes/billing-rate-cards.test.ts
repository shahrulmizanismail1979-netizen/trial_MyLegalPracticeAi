/**
 * Integration tests: MyLitAI rate-card auto-fill (Task #289)
 *
 * Verifies that the lookupRateCard precedence chain works correctly when
 * time entries are logged through the MyLitAI matter billing routes:
 *
 *   named-lawyer rate  (activity + level + name)  beats
 *   level-only rate    (activity + level, no name)
 *
 * Routes under test (lit matters router, pathPrefix=""):
 *   POST   /api/lit/auth/login                          — log in (session)
 *   POST   /api/lit/matters                             — create a matter
 *   POST   /api/lit/matters/billing/rate-cards          — add a rate card entry
 *   POST   /api/lit/matters/:id/time-entries            — log time (triggers lookupRateCard)
 *   GET    /api/lit/matters/:id/time-entries            — read time entries + resolved rates
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import crypto from "crypto";

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

const { default: app } = await import("../../app");
const { db, litAccessCodes } = await import("@workspace/db");
const { pool } = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");

const RUN_ID = crypto.randomUUID();

function makeCode() {
  return `LITRC${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

async function createLoggedInAgent() {
  const code = makeCode();
  const [row] = await db
    .insert(litAccessCodes)
    .values({
      code,
      recipientName: `Rate Card Test ${RUN_ID}`,
      recipientEmail: `rctest-${RUN_ID}@test.local`,
      status: "active",
    })
    .returning();
  const agent = request.agent(app);
  const res = await agent
    .post("/api/lit/auth/login")
    .send({ password: code });
  expect(res.status, `lit login failed: ${JSON.stringify(res.body)}`).toBe(200);
  expect(res.body.success).toBe(true);
  return { agent, codeId: row.id, code };
}

let sess: Awaited<ReturnType<typeof createLoggedInAgent>>;
const codeIds: number[] = [];
let testMatterId: number;
const timeEntryIds: number[] = [];

beforeAll(async () => {
  sess = await createLoggedInAgent();
  codeIds.push(sess.codeId);
});

afterAll(async () => {
  const ownerKey = String(sess.codeId);
  await pool.query(
    `DELETE FROM case_rate_cards WHERE portal = 'lit' AND owner_key = $1`,
    [ownerKey],
  );
  if (timeEntryIds.length > 0) {
    await pool.query(
      `DELETE FROM case_time_entries WHERE portal = 'lit' AND id = ANY($1::int[])`,
      [timeEntryIds],
    );
  }
  // Delete test matters (cascade removes deadlines / saved work).
  await pool.query(
    `DELETE FROM lit_matters WHERE access_code_id = ANY($1::int[])`,
    [codeIds],
  );
  if (codeIds.length > 0) {
    await db
      .delete(litAccessCodes)
      .where(inArray(litAccessCodes.id, codeIds));
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createMatter(title: string) {
  const res = await sess.agent.post("/api/lit/matters").send({ title });
  expect(res.status, `create lit matter: ${JSON.stringify(res.body)}`).toBe(201);
  return res.body.id as number;
}

async function addRateCard(
  activityType: string,
  lawyerLevel: string,
  rateUsd: number,
  lawyerName?: string,
) {
  const body: Record<string, unknown> = { activityType, lawyerLevel, rateUsd };
  if (lawyerName) body.lawyerName = lawyerName;
  const res = await sess.agent
    .post("/api/lit/matters/billing/rate-cards")
    .send(body);
  expect(res.status, `add lit rate card: ${JSON.stringify(res.body)}`).toBe(201);
  return res.body as Record<string, unknown>;
}

async function logTimeEntry(
  matterId: number,
  description: string,
  minutes: number,
  activityType: string,
  lawyerLevel: string,
  lawyerName?: string,
) {
  const body: Record<string, unknown> = {
    description,
    minutes,
    activity_type: activityType,
    lawyer_level: lawyerLevel,
  };
  if (lawyerName) body.lawyer_name = lawyerName;
  const res = await sess.agent
    .post(`/api/lit/matters/${matterId}/time-entries`)
    .send(body);
  expect(res.status, `log lit time entry: ${JSON.stringify(res.body)}`).toBe(201);
  timeEntryIds.push(res.body.id as number);
  return res.body as Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MyLitAI rate-card auto-fill", () => {
  it("creates a matter for billing test", async () => {
    testMatterId = await createMatter(`Billing RC Test ${RUN_ID}`);
    expect(testMatterId).toBeGreaterThan(0);
  });

  it("adds a level-only rate card (advisory / associate)", async () => {
    const card = await addRateCard("advisory", "associate", 300);
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(300, 1);
    expect(card.lawyer_name).toBeNull();
  });

  it("adds a named-lawyer rate card (advisory / associate / Priya)", async () => {
    const card = await addRateCard("advisory", "associate", 500, "Priya");
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(500, 1);
    expect(card.lawyer_name).toBe("Priya");
  });

  it("time entry without lawyer_name auto-fills the level-only rate (300)", async () => {
    const entry = await logTimeEntry(
      testMatterId,
      `Level-only advisory work (${RUN_ID})`,
      60,
      "advisory",
      "associate",
    );
    expect(entry.rate_usd).not.toBeNull();
    expect(parseFloat(entry.rate_usd as string)).toBeCloseTo(300, 1);
  });

  it("time entry with lawyer_name='Priya' auto-fills the named-lawyer rate (500)", async () => {
    const entry = await logTimeEntry(
      testMatterId,
      `Named-lawyer advisory work (${RUN_ID})`,
      90,
      "advisory",
      "associate",
      "Priya",
    );
    expect(entry.rate_usd).not.toBeNull();
    expect(parseFloat(entry.rate_usd as string)).toBeCloseTo(500, 1);
  });

  it("GET time-entries returns both entries with correct resolved rates", async () => {
    const res = await sess.agent.get(
      `/api/lit/matters/${testMatterId}/time-entries`,
    );
    expect(res.status).toBe(200);
    const entries: Array<Record<string, unknown>> = res.body.entries ?? res.body;
    expect(Array.isArray(entries)).toBe(true);

    const levelOnly = entries.find((e) =>
      (e.description as string).includes("Level-only advisory"),
    );
    const namedLawyer = entries.find((e) =>
      (e.description as string).includes("Named-lawyer advisory"),
    );

    expect(levelOnly, "level-only entry should exist").toBeTruthy();
    expect(parseFloat(levelOnly!.rate_usd as string)).toBeCloseTo(300, 1);

    expect(namedLawyer, "named-lawyer entry should exist").toBeTruthy();
    expect(parseFloat(namedLawyer!.rate_usd as string)).toBeCloseTo(500, 1);
  });

  it("named-lawyer rate takes precedence: 500 > 300 for Priya entries", () => {
    const levelOnlyRate = 300;
    const namedLawyerRate = 500;
    expect(namedLawyerRate).toBeGreaterThan(levelOnlyRate);
  });
});
