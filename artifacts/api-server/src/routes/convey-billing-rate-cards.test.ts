/**
 * Integration tests: MyConveyLitAI rate-card auto-fill (Task #289)
 *
 * Verifies that the lookupRateCard precedence chain works correctly when
 * time entries are logged through the MyConveyLitAI matter billing routes:
 *
 *   named-lawyer rate  (activity + level + name)  beats
 *   level-only rate    (activity + level, no name)
 *
 * MyConveyLitAI authenticates with a JWT Bearer token (returned at login).
 * The owner key is the numeric users.id stringified.
 *
 * Routes under test:
 *   POST   /api/convey/auth                              — log in (JWT)
 *   POST   /api/convey/matters                           — create a matter
 *   POST   /api/convey/matters/billing/rate-cards        — add a rate card entry
 *   POST   /api/convey/matters/:id/time-entries          — log time (triggers lookupRateCard)
 *   GET    /api/convey/matters/:id/time-entries          — read time entries + resolved rates
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

const { default: app } = await import("../app");
const { db } = await import("@workspace/db");
const { pool } = await import("@workspace/db");
const { usersTable } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");
const { ensureMatterFileTables } = await import("../lib/matterFiles");

const RUN_ID = `convey-rc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
// Code must be uppercase — convey auth uppercases before lookup.
const CODE = `CVYRC${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

let userId: number;
let bearerToken: string;
let testMatterId: number;
const timeEntryIds: number[] = [];

function api(method: "get" | "post" | "patch" | "delete", path: string) {
  const r = request(app);
  const req =
    method === "get" ? r.get(path)
    : method === "post" ? r.post(path)
    : method === "patch" ? r.patch(path)
    : r.delete(path);
  return req.set("Authorization", `Bearer ${bearerToken}`);
}

beforeAll(async () => {
  await ensureMatterFileTables();

  const [row] = await db
    .insert(usersTable)
    .values({
      accessCode: CODE,
      displayName: `Rate card test ${RUN_ID}`,
      isActive: true,
      // conveyGate requires practitioner+ for all non-AI POST /convey/* routes.
      // effectiveTier() only honours subscriptionTier when subscriptionStatus is
      // "active" or "trialing" — so both fields are required for tier to kick in.
      subscriptionTier: "practitioner",
      subscriptionStatus: "active",
    })
    .returning();
  userId = row.id;

  const loginRes = await request(app)
    .post("/api/convey/auth")
    .send({ accessCode: CODE });
  expect(loginRes.status, `convey login: ${JSON.stringify(loginRes.body)}`).toBe(200);
  expect(loginRes.body.success).toBe(true);
  bearerToken = loginRes.body.token as string;
});

afterAll(async () => {
  const ownerKey = String(userId);
  await pool.query(
    `DELETE FROM case_rate_cards WHERE portal = 'convey' AND owner_key = $1`,
    [ownerKey],
  );
  if (timeEntryIds.length > 0) {
    await pool.query(
      `DELETE FROM case_time_entries WHERE portal = 'convey' AND id = ANY($1::int[])`,
      [timeEntryIds],
    );
  }
  // convey_matters.user_id → users(id) ON DELETE CASCADE, but delete explicitly
  // to avoid FK issues if cascade isn't set on the test DB.
  await pool.query(`DELETE FROM convey_matters WHERE user_id = $1`, [userId]);
  // Delete the test user.
  await db.delete(usersTable).where(eq(usersTable.id, userId));
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createMatter(title: string) {
  const res = await api("post", "/api/convey/matters").send({ title });
  expect(res.status, `create convey matter: ${JSON.stringify(res.body)}`).toBe(201);
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
  const res = await api("post", "/api/convey/matters/billing/rate-cards").send(body);
  expect(res.status, `add convey rate card: ${JSON.stringify(res.body)}`).toBe(201);
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
  const res = await api(
    "post",
    `/api/convey/matters/${matterId}/time-entries`,
  ).send(body);
  expect(res.status, `log convey time entry: ${JSON.stringify(res.body)}`).toBe(201);
  timeEntryIds.push(res.body.id as number);
  return res.body as Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MyConveyLitAI rate-card auto-fill", () => {
  it("creates a matter for billing test", async () => {
    testMatterId = await createMatter(`Billing RC Test ${RUN_ID}`);
    expect(testMatterId).toBeGreaterThan(0);
  });

  it("adds a level-only rate card (advisory / associate)", async () => {
    const card = await addRateCard("advisory", "associate", 300);
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(300, 1);
    expect(card.lawyer_name).toBeNull();
  });

  it("adds a named-lawyer rate card (advisory / associate / Lim)", async () => {
    const card = await addRateCard("advisory", "associate", 500, "Lim");
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(500, 1);
    expect(card.lawyer_name).toBe("Lim");
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

  it("time entry with lawyer_name='Lim' auto-fills the named-lawyer rate (500)", async () => {
    const entry = await logTimeEntry(
      testMatterId,
      `Named-lawyer advisory work (${RUN_ID})`,
      90,
      "advisory",
      "associate",
      "Lim",
    );
    expect(entry.rate_usd).not.toBeNull();
    expect(parseFloat(entry.rate_usd as string)).toBeCloseTo(500, 1);
  });

  it("GET time-entries returns both entries with correct resolved rates", async () => {
    const res = await api(
      "get",
      `/api/convey/matters/${testMatterId}/time-entries`,
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

  it("named-lawyer rate takes precedence: 500 > 300 for Lim entries", () => {
    const levelOnlyRate = 300;
    const namedLawyerRate = 500;
    expect(namedLawyerRate).toBeGreaterThan(levelOnlyRate);
  });
});
