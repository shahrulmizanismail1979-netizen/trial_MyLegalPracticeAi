/**
 * Integration tests: MyAccidentAI rate-card auto-fill (Task #289)
 *
 * Verifies that the lookupRateCard precedence chain works correctly when
 * time entries are logged through the MyAccidentAI matter billing routes:
 *
 *   named-lawyer rate  (activity + level + name)  beats
 *   level-only rate    (activity + level, no name)
 *
 * MyAccidentAI authenticates via a session_id cookie (set at verify-code).
 * The owner key is the numeric access_codes.id stringified.
 *
 * Routes under test (accident matters router, pathPrefix="/matters"):
 *   POST   /api/accident/auth/verify-code              — log in (cookie session)
 *   POST   /api/accident/matters                       — create a matter
 *   POST   /api/accident/matters/billing/rate-cards    — add a rate card entry
 *   POST   /api/accident/matters/:id/time-entries      — log time (triggers lookupRateCard)
 *   GET    /api/accident/matters/:id/time-entries      — read time entries + resolved rates
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
const { accessCodesTable, accessCodeUsageTable } = await import(
  "@workspace/db/schema"
);
const { inArray } = await import("drizzle-orm");
const { ensureAccMatterTables } = await import("./matters");

const RUN_ID = `acc-rc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const CODE = `ACCRC${crypto.randomBytes(5).toString("hex").toUpperCase()}`;

let codeId: number;
let agent: ReturnType<typeof request.agent>;
let testMatterId: number;
const timeEntryIds: number[] = [];

beforeAll(async () => {
  await ensureAccMatterTables();

  const [row] = await db
    .insert(accessCodesTable)
    .values({ code: CODE, label: `Rate card test ${RUN_ID}`, maxUsers: 5 })
    .returning();
  codeId = row.id;

  agent = request.agent(app);
  const loginRes = await agent
    .post("/api/accident/auth/verify-code")
    .send({ code: CODE });
  expect(loginRes.status, `accident login: ${JSON.stringify(loginRes.body)}`).toBe(200);
  expect(loginRes.body.valid).toBe(true);
});

afterAll(async () => {
  const ownerKey = String(codeId);
  await pool.query(
    `DELETE FROM case_rate_cards WHERE portal = 'acc' AND owner_key = $1`,
    [ownerKey],
  );
  if (timeEntryIds.length > 0) {
    await pool.query(
      `DELETE FROM case_time_entries WHERE portal = 'acc' AND id = ANY($1::int[])`,
      [timeEntryIds],
    );
  }
  // Delete test matters (cascade removes deadlines / saved work).
  await pool.query(`DELETE FROM acc_matters WHERE owner_id = $1`, [codeId]);
  // Free the session seat.
  await db
    .delete(accessCodeUsageTable)
    .where(inArray(accessCodeUsageTable.accessCodeId, [codeId]));
  // Delete the test access code.
  await db
    .delete(accessCodesTable)
    .where(inArray(accessCodesTable.id, [codeId]));
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createMatter(title: string) {
  const res = await agent.post("/api/accident/matters").send({ title });
  expect(res.status, `create acc matter: ${JSON.stringify(res.body)}`).toBe(201);
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
  const res = await agent
    .post("/api/accident/matters/billing/rate-cards")
    .send(body);
  expect(res.status, `add acc rate card: ${JSON.stringify(res.body)}`).toBe(201);
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
  const res = await agent
    .post(`/api/accident/matters/${matterId}/time-entries`)
    .send(body);
  expect(res.status, `log acc time entry: ${JSON.stringify(res.body)}`).toBe(201);
  timeEntryIds.push(res.body.id as number);
  return res.body as Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MyAccidentAI rate-card auto-fill", () => {
  it("creates a matter for billing test", async () => {
    testMatterId = await createMatter(`Billing RC Test ${RUN_ID}`);
    expect(testMatterId).toBeGreaterThan(0);
  });

  it("adds a level-only rate card (advisory / associate)", async () => {
    const card = await addRateCard("advisory", "associate", 300);
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(300, 1);
    expect(card.lawyer_name).toBeNull();
  });

  it("adds a named-lawyer rate card (advisory / associate / Amir)", async () => {
    const card = await addRateCard("advisory", "associate", 500, "Amir");
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(500, 1);
    expect(card.lawyer_name).toBe("Amir");
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

  it("time entry with lawyer_name='Amir' auto-fills the named-lawyer rate (500)", async () => {
    const entry = await logTimeEntry(
      testMatterId,
      `Named-lawyer advisory work (${RUN_ID})`,
      90,
      "advisory",
      "associate",
      "Amir",
    );
    expect(entry.rate_usd).not.toBeNull();
    expect(parseFloat(entry.rate_usd as string)).toBeCloseTo(500, 1);
  });

  it("GET time-entries returns both entries with correct resolved rates", async () => {
    const res = await agent.get(
      `/api/accident/matters/${testMatterId}/time-entries`,
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

  it("named-lawyer rate takes precedence: 500 > 300 for Amir entries", () => {
    const levelOnlyRate = 300;
    const namedLawyerRate = 500;
    expect(namedLawyerRate).toBeGreaterThan(levelOnlyRate);
  });
});

// ── Propagation tests ─────────────────────────────────────────────────────────
//
// Verify that PUT (rate update) and DELETE on a rate card cascade to the
// matching unbilled time entries (those linked via rate_card_id).
// Verification uses GET /:matterId/billing which returns timeEntries[].rate.

async function updateRateCard(cardId: number, rateUsd: number) {
  const res = await agent
    .put(`/api/accident/matters/billing/rate-cards/${cardId}`)
    .send({ rateUsd });
  expect(res.status, `update acc rate card: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body as Record<string, unknown>;
}

async function deleteRateCard(cardId: number) {
  const res = await agent.delete(`/api/accident/matters/billing/rate-cards/${cardId}`);
  expect(res.status, `delete acc rate card: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body as Record<string, unknown>;
}

async function getBillingForMatter(matterId: number) {
  const res = await agent.get(`/api/accident/matters/${matterId}/billing`);
  expect(res.status, `get acc billing: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body as { timeEntries: Array<Record<string, unknown>> };
}

describe("MyAccidentAI rate-card propagation (PUT & DELETE)", () => {
  let propagationMatterId: number;
  let propagationCardId: number;
  const propagationEntryIds: number[] = [];

  it("creates a matter for propagation tests", async () => {
    propagationMatterId = await createMatter(`Propagation Test ${RUN_ID}`);
    expect(propagationMatterId).toBeGreaterThan(0);
  });

  it("adds a propagation rate card (drafting / partner, 400)", async () => {
    const card = await addRateCard("drafting", "partner", 400);
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(400, 1);
    propagationCardId = card.id as number;
    expect(propagationCardId).toBeGreaterThan(0);
  });

  it("logs a time entry that resolves from the propagation rate card", async () => {
    const body = {
      description: `Propagation drafting work (${RUN_ID})`,
      minutes: 60,
      activity_type: "drafting",
      lawyer_level: "partner",
    };
    const res = await agent
      .post(`/api/accident/matters/${propagationMatterId}/time-entries`)
      .send(body);
    expect(res.status, `log propagation entry: ${JSON.stringify(res.body)}`).toBe(201);
    expect(parseFloat(res.body.rate_usd as string)).toBeCloseTo(400, 1);
    propagationEntryIds.push(res.body.id as number);
    timeEntryIds.push(res.body.id as number);
  });

  it("PUT rate card: updates rate to 650 and propagates to unbilled time entry", async () => {
    const updated = await updateRateCard(propagationCardId, 650);
    expect(parseFloat(updated.rate_usd as string)).toBeCloseTo(650, 1);

    const billing = await getBillingForMatter(propagationMatterId);
    const entry = billing.timeEntries.find((e) =>
      (e.description as string).includes("Propagation drafting work"),
    );
    expect(entry, "propagation entry should appear in billing").toBeTruthy();
    // The billing endpoint aliases rate_usd as `rate`.
    expect(parseFloat(entry!.rate as string)).toBeCloseTo(650, 1);
  });

  it("DELETE rate card: nullifies rate on linked unbilled time entry", async () => {
    const result = await deleteRateCard(propagationCardId);
    expect(result.success).toBe(true);

    const billing = await getBillingForMatter(propagationMatterId);
    const entry = billing.timeEntries.find((e) =>
      (e.description as string).includes("Propagation drafting work"),
    );
    expect(entry, "propagation entry should still appear in billing after card delete").toBeTruthy();
    // rate_usd is nullified when its resolving card is deleted.
    expect(entry!.rate).toBeNull();
  });

  afterAll(async () => {
    const ownerKey = String(codeId);
    if (propagationEntryIds.length > 0) {
      await pool.query(
        `DELETE FROM case_time_entries WHERE portal = 'acc' AND id = ANY($1::int[])`,
        [propagationEntryIds],
      );
    }
    await pool.query(`DELETE FROM acc_matters WHERE id = $1`, [propagationMatterId]);
    // Guard: the test deletes the card itself; clean up if any remain.
    await pool.query(
      `DELETE FROM case_rate_cards WHERE portal = 'acc' AND owner_key = $1 AND activity_type = 'drafting' AND lawyer_level = 'partner'`,
      [ownerKey],
    );
  });
});
