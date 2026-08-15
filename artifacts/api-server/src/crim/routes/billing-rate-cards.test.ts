/**
 * Integration tests: MyCrimAI rate-card auto-fill (Task #285)
 *
 * Verifies that the lookupRateCard precedence chain works correctly when
 * time entries are logged through the MyCrimAI matter billing routes:
 *
 *   named-lawyer rate  (activity + level + name)  beats
 *   level-only rate    (activity + level, no name)
 *
 * Routes under test (crim matters router, pathPrefix=""):
 *   POST   /api/crim/matters                             — create a matter
 *   POST   /api/crim/matters/billing/rate-cards          — add a rate card entry
 *   POST   /api/crim/matters/:id/time-entries            — log time (triggers lookupRateCard)
 *   GET    /api/crim/matters/:id/time-entries            — read time entries + auto-resolved rates
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
const { db, crimAccessCodesTable } = await import("@workspace/db");
const { pool } = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");

const RUN_ID = crypto.randomUUID();

function makeCode() {
  return `RCTEST${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

async function createLoggedInAgent() {
  const code = makeCode();
  const [row] = await db
    .insert(crimAccessCodesTable)
    .values({
      code,
      label: `rate-card-test ${RUN_ID}`,
      isActive: true,
      tier: "full",
    })
    .returning();
  const agent = request.agent(app);
  const res = await agent.post("/api/crim/auth/verify").send({ accessCode: code });
  expect(res.status).toBe(200);
  expect(res.body.authenticated).toBe(true);
  return { agent, codeId: row.id, code };
}

let sess: Awaited<ReturnType<typeof createLoggedInAgent>>;
const codeIds: number[] = [];
// Track resource ids for cleanup
let testMatterId: number;
const timeEntryIds: number[] = [];

beforeAll(async () => {
  sess = await createLoggedInAgent();
  codeIds.push(sess.codeId);
});

afterAll(async () => {
  // Delete rate cards and time entries keyed to the test owner_key
  const ownerKey = String(sess.codeId);
  await pool.query(
    `DELETE FROM case_rate_cards WHERE portal = 'crim' AND owner_key = $1`,
    [ownerKey],
  );
  if (timeEntryIds.length > 0) {
    await pool.query(
      `DELETE FROM case_time_entries WHERE portal = 'crim' AND id = ANY($1::int[])`,
      [timeEntryIds],
    );
  }
  // Cascade removes deadlines etc.; saved_work and checklist rows are cleaned
  // by the access-code delete (they share the same owner via codeId).
  if (codeIds.length > 0) {
    await db
      .delete(crimAccessCodesTable)
      .where(inArray(crimAccessCodesTable.id, codeIds));
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createMatter(title: string) {
  const res = await sess.agent.post("/api/crim/matters").send({
    title,
    stage: "trial",
    charge: "s.39B(1)(a) DDA 1952",
  });
  expect(res.status, `create matter: ${JSON.stringify(res.body)}`).toBe(201);
  return res.body.id as number;
}

async function addRateCard(
  activityType: string,
  lawyerLevel: string,
  rateUsd: number,
  lawyerName?: string,
) {
  const body: Record<string, unknown> = {
    activityType,
    lawyerLevel,
    rateUsd,
  };
  if (lawyerName) body.lawyerName = lawyerName;
  const res = await sess.agent
    .post("/api/crim/matters/billing/rate-cards")
    .send(body);
  expect(res.status, `add rate card: ${JSON.stringify(res.body)}`).toBe(201);
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
    .post(`/api/crim/matters/${matterId}/time-entries`)
    .send(body);
  expect(res.status, `log time entry: ${JSON.stringify(res.body)}`).toBe(201);
  timeEntryIds.push(res.body.id as number);
  return res.body as Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MyCrimAI rate-card auto-fill", () => {
  it("creates a matter for billing test", async () => {
    testMatterId = await createMatter(`Billing RC Test ${RUN_ID}`);
    expect(testMatterId).toBeGreaterThan(0);
  });

  it("adds a level-only rate card (advisory / associate)", async () => {
    const card = await addRateCard("advisory", "associate", 300);
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(300, 1);
    expect(card.lawyer_name).toBeNull();
  });

  it("adds a named-lawyer rate card (advisory / associate / Ahmad)", async () => {
    const card = await addRateCard("advisory", "associate", 500, "Ahmad");
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(500, 1);
    expect(card.lawyer_name).toBe("Ahmad");
  });

  it("time entry without lawyer_name auto-fills the level-only rate (300)", async () => {
    const entry = await logTimeEntry(
      testMatterId,
      `Level-only advisory work (${RUN_ID})`,
      60,
      "advisory",
      "associate",
    );
    // rate_usd should be resolved to 300 by the level-only fallback
    expect(entry.rate_usd).not.toBeNull();
    expect(parseFloat(entry.rate_usd as string)).toBeCloseTo(300, 1);
  });

  it("time entry with lawyer_name='Ahmad' auto-fills the named-lawyer rate (500)", async () => {
    const entry = await logTimeEntry(
      testMatterId,
      `Named-lawyer advisory work (${RUN_ID})`,
      90,
      "advisory",
      "associate",
      "Ahmad",
    );
    // rate_usd should be resolved to 500 by the named-lawyer precedence
    expect(entry.rate_usd).not.toBeNull();
    expect(parseFloat(entry.rate_usd as string)).toBeCloseTo(500, 1);
  });

  it("GET time-entries returns both entries with correct resolved rates", async () => {
    const res = await sess.agent.get(
      `/api/crim/matters/${testMatterId}/time-entries`,
    );
    expect(res.status).toBe(200);
    const entries: Array<Record<string, unknown>> = res.body.entries ?? res.body;
    expect(Array.isArray(entries)).toBe(true);

    // Identify by description since the GET projection omits lawyer_name.
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

  it("named-lawyer rate takes precedence: 500 > 300 for Ahmad entries", () => {
    // This is a documentation assertion — the two previous tests already
    // confirmed named > level-only. This snapshot makes the precedence
    // contract explicit in the test output.
    const levelOnlyRate = 300;
    const namedLawyerRate = 500;
    expect(namedLawyerRate).toBeGreaterThan(levelOnlyRate);
  });
});
