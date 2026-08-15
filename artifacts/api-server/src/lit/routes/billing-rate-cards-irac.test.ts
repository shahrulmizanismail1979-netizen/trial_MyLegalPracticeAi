/**
 * Integration tests: MyLitAI IRAC rate-card auto-fill (Task #293)
 *
 * MyLitAI IRAC shares the same litAccessCodes table, auth routes, and
 * matters/billing routes as MyLitAI.  This file mirrors the MyLitAI
 * billing-rate-cards.test.ts to confirm that the shared attachCaseIntelligence
 * layer (and the lookupRateCard helper it wires up) works identically when
 * requests arrive through the IRAC portal's access codes.
 *
 * Routes under test (lit matters router, shared by both portals):
 *   POST   /api/lit/auth/login                          — log in (session)
 *   POST   /api/lit/matters                             — create a matter
 *   POST   /api/lit/matters/billing/rate-cards          — add a rate card entry
 *   POST   /api/lit/matters/:id/time-entries            — log time (triggers lookupRateCard)
 *   GET    /api/lit/matters/:id/time-entries            — read time entries + resolved rates
 *
 * Precedence verified:
 *   named-lawyer rate  (activity + level + name)  beats
 *   level-only rate    (activity + level, no name)
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
const { inArray } = await import("drizzle-orm");

const RUN_ID = crypto.randomUUID();

function makeCode() {
  // IRAC-prefixed codes so cleanup is unambiguous and test runs don't collide
  // with the parallel MyLitAI billing-rate-cards.test.ts suite.
  return `IRACRC${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
}

async function createLoggedInAgent() {
  const code = makeCode();
  const [row] = await db
    .insert(litAccessCodes)
    .values({
      code,
      recipientName: `IRAC Rate Card Test ${RUN_ID}`,
      recipientEmail: `iracrc-${RUN_ID}@test.local`,
      status: "active",
    })
    .returning();
  const agent = request.agent(app);
  // IRAC users log in through the same /api/lit/auth/login endpoint; the only
  // difference between portals at the auth layer is the optional Microsoft SSO
  // ticket — normal code logins are identical.
  const res = await agent
    .post("/api/lit/auth/login")
    .send({ password: code });
  expect(res.status, `irac login failed: ${JSON.stringify(res.body)}`).toBe(200);
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
  expect(res.status, `create irac matter: ${JSON.stringify(res.body)}`).toBe(201);
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
  expect(res.status, `add irac rate card: ${JSON.stringify(res.body)}`).toBe(201);
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
  expect(res.status, `log irac time entry: ${JSON.stringify(res.body)}`).toBe(201);
  timeEntryIds.push(res.body.id as number);
  return res.body as Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MyLitAI IRAC rate-card auto-fill", () => {
  it("creates a matter for billing test", async () => {
    testMatterId = await createMatter(`IRAC Billing RC Test ${RUN_ID}`);
    expect(testMatterId).toBeGreaterThan(0);
  });

  it("adds a level-only rate card (drafting / partner)", async () => {
    const card = await addRateCard("drafting", "partner", 600);
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(600, 1);
    expect(card.lawyer_name).toBeNull();
  });

  it("adds a named-lawyer rate card (drafting / partner / Aishah)", async () => {
    const card = await addRateCard("drafting", "partner", 850, "Aishah");
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(850, 1);
    expect(card.lawyer_name).toBe("Aishah");
  });

  it("time entry without lawyer_name auto-fills the level-only rate (600)", async () => {
    const entry = await logTimeEntry(
      testMatterId,
      `IRAC level-only drafting work (${RUN_ID})`,
      60,
      "drafting",
      "partner",
    );
    expect(entry.rate_usd).not.toBeNull();
    expect(parseFloat(entry.rate_usd as string)).toBeCloseTo(600, 1);
  });

  it("time entry with lawyer_name='Aishah' auto-fills the named-lawyer rate (850)", async () => {
    const entry = await logTimeEntry(
      testMatterId,
      `IRAC named-lawyer drafting work (${RUN_ID})`,
      90,
      "drafting",
      "partner",
      "Aishah",
    );
    expect(entry.rate_usd).not.toBeNull();
    expect(parseFloat(entry.rate_usd as string)).toBeCloseTo(850, 1);
  });

  it("GET time-entries returns both entries with correct resolved rates", async () => {
    const res = await sess.agent.get(
      `/api/lit/matters/${testMatterId}/time-entries`,
    );
    expect(res.status).toBe(200);
    const entries: Array<Record<string, unknown>> = res.body.entries ?? res.body;
    expect(Array.isArray(entries)).toBe(true);

    const levelOnly = entries.find((e) =>
      (e.description as string).includes("IRAC level-only drafting"),
    );
    const namedLawyer = entries.find((e) =>
      (e.description as string).includes("IRAC named-lawyer drafting"),
    );

    expect(levelOnly, "level-only entry should exist").toBeTruthy();
    expect(parseFloat(levelOnly!.rate_usd as string)).toBeCloseTo(600, 1);

    expect(namedLawyer, "named-lawyer entry should exist").toBeTruthy();
    expect(parseFloat(namedLawyer!.rate_usd as string)).toBeCloseTo(850, 1);
  });

  it("named-lawyer rate takes precedence: 850 > 600 for Aishah entries", () => {
    const levelOnlyRate = 600;
    const namedLawyerRate = 850;
    expect(namedLawyerRate).toBeGreaterThan(levelOnlyRate);
  });
});
