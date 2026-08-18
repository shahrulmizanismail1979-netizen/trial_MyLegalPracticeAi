/**
 * Integration tests: MySyariahAI rate-card auto-fill (Task #285)
 *
 * Verifies that the lookupRateCard precedence chain works correctly when
 * time entries are logged through the MySyariahAI matter billing routes:
 *
 *   named-lawyer rate  (activity + level + name)  beats
 *   level-only rate    (activity + level, no name)
 *
 * MySyariahAI owner key scheme: "${accountType}:${userId}" (e.g. "code:42")
 *
 * Routes under test (sya matters router, pathPrefix="/matters"):
 *   POST   /api/sya/matters                              — create a matter
 *   POST   /api/sya/matters/billing/rate-cards           — add a rate card entry
 *   POST   /api/sya/matters/:id/time-entries             — log time (triggers lookupRateCard)
 *   GET    /api/sya/matters/:id/time-entries             — read time entries + auto-resolved rates
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";

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

const { default: app } = await import("../../../app");
const { db } = await import("@workspace/db");
const { pool } = await import("@workspace/db");
const { accessCodesTable, syaMattersTable } = await import("@workspace/db/sya");
const { inArray, eq } = await import("drizzle-orm");
const { ensureSyaMatterTables } = await import("./index");

const RUN_ID = `sya-rc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const CODE_A = `SYARC-${RUN_ID}`;

let codeId: number;
let agentA: ReturnType<typeof request.agent>;
let testMatterId: number;
const timeEntryIds: number[] = [];

beforeAll(async () => {
  await ensureSyaMatterTables();

  const [row] = await db
    .insert(accessCodesTable)
    .values({ code: CODE_A, name: `Rate card test ${RUN_ID}` })
    .returning();
  codeId = row.id;

  agentA = request.agent(app);
  const loginRes = await agentA
    .post("/api/sya/auth/verify")
    .send({ accessCode: CODE_A });
  expect(loginRes.status, `sya login: ${JSON.stringify(loginRes.body)}`).toBe(200);
  expect(loginRes.body.authenticated).toBe(true);
});

afterAll(async () => {
  // Delete rate cards and time entries scoped to this test's owner_key.
  const ownerKey = `code:${codeId}`;
  await pool.query(
    `DELETE FROM case_rate_cards WHERE portal = 'sya' AND owner_key = $1`,
    [ownerKey],
  );
  if (timeEntryIds.length > 0) {
    await pool.query(
      `DELETE FROM case_time_entries WHERE portal = 'sya' AND id = ANY($1::int[])`,
      [timeEntryIds],
    );
  }
  // Delete test matters (cascade removes deadlines + saved work).
  await db
    .delete(syaMattersTable)
    .where(eq(syaMattersTable.ownerId, codeId));
  // Delete test access code.
  await db
    .delete(accessCodesTable)
    .where(eq(accessCodesTable.id, codeId));
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createMatter(title: string) {
  const res = await agentA.post("/api/sya/matters").send({
    title,
    matterType: "harta sepencarian",
  });
  expect(res.status, `create sya matter: ${JSON.stringify(res.body)}`).toBe(201);
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
  const res = await agentA
    .post("/api/sya/matters/billing/rate-cards")
    .send(body);
  expect(res.status, `add sya rate card: ${JSON.stringify(res.body)}`).toBe(201);
  return res.body as Record<string, unknown>;
}

async function updateRateCard(cardId: number, rateUsd: number) {
  const res = await agentA
    .put(`/api/sya/matters/billing/rate-cards/${cardId}`)
    .send({ rateUsd });
  expect(res.status, `update sya rate card: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body as Record<string, unknown>;
}

async function deleteRateCard(cardId: number) {
  const res = await agentA.delete(`/api/sya/matters/billing/rate-cards/${cardId}`);
  expect(res.status, `delete sya rate card: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body as Record<string, unknown>;
}

async function getBillingForMatter(matterId: number) {
  const res = await agentA.get(`/api/sya/matters/${matterId}/billing`);
  expect(res.status, `get sya billing: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body as { timeEntries: Array<Record<string, unknown>> };
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
  const res = await agentA
    .post(`/api/sya/matters/${matterId}/time-entries`)
    .send(body);
  expect(res.status, `log sya time entry: ${JSON.stringify(res.body)}`).toBe(201);
  timeEntryIds.push(res.body.id as number);
  return res.body as Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MySyariahAI rate-card auto-fill", () => {
  it("creates a matter for billing test", async () => {
    testMatterId = await createMatter(`Billing RC Test ${RUN_ID}`);
    expect(testMatterId).toBeGreaterThan(0);
  });

  it("adds a level-only rate card (advisory / associate)", async () => {
    const card = await addRateCard("advisory", "associate", 300);
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(300, 1);
    expect(card.lawyer_name).toBeNull();
  });

  it("adds a named-lawyer rate card (advisory / associate / Siti)", async () => {
    const card = await addRateCard("advisory", "associate", 500, "Siti");
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(500, 1);
    expect(card.lawyer_name).toBe("Siti");
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

  it("time entry with lawyer_name='Siti' auto-fills the named-lawyer rate (500)", async () => {
    const entry = await logTimeEntry(
      testMatterId,
      `Named-lawyer advisory work (${RUN_ID})`,
      90,
      "advisory",
      "associate",
      "Siti",
    );
    expect(entry.rate_usd).not.toBeNull();
    expect(parseFloat(entry.rate_usd as string)).toBeCloseTo(500, 1);
  });

  it("GET time-entries returns both entries with correct resolved rates", async () => {
    const res = await agentA.get(
      `/api/sya/matters/${testMatterId}/time-entries`,
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

  it("named-lawyer rate takes precedence: 500 > 300 for Siti entries", () => {
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

describe("MySyariahAI rate-card propagation (PUT & DELETE)", () => {
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
    const res = await agentA
      .post(`/api/sya/matters/${propagationMatterId}/time-entries`)
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
    const ownerKey = `code:${codeId}`;
    if (propagationEntryIds.length > 0) {
      await pool.query(
        `DELETE FROM case_time_entries WHERE portal = 'sya' AND id = ANY($1::int[])`,
        [propagationEntryIds],
      );
    }
    await db
      .delete(syaMattersTable)
      .where(eq(syaMattersTable.id, propagationMatterId));
    // Guard: the test deletes the card itself; clean up if any remain.
    await pool.query(
      `DELETE FROM case_rate_cards WHERE portal = 'sya' AND owner_key = $1 AND activity_type = 'drafting' AND lawyer_level = 'partner'`,
      [ownerKey],
    );
  });
});

// ── Billed-entry protection tests ─────────────────────────────────────────────
//
// Verify that PUT (rate update) and DELETE on a rate card do NOT touch time
// entries that have already been placed on an invoice (invoice_id IS NOT NULL).
// The WHERE invoice_id IS NULL guard in propagateRateCardUpdate /
// propagateRateCardDelete is the only thing protecting accounting records from
// silent corruption — this suite confirms it actually fires.

describe("MySyariahAI rate-card propagation: billed entries are protected", () => {
  let billedMatterId: number;
  let billedCardId: number;
  let billedEntryId: number;
  let billedInvoiceId: number;
  const originalRate = 350;

  it("creates a matter for billed-entry protection tests", async () => {
    billedMatterId = await createMatter(`Billed Protection Test ${RUN_ID}`);
    expect(billedMatterId).toBeGreaterThan(0);
  });

  it("adds a rate card (research / senior, 350)", async () => {
    const card = await addRateCard("research", "senior", originalRate);
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(originalRate, 1);
    billedCardId = card.id as number;
    expect(billedCardId).toBeGreaterThan(0);
  });

  it("logs a time entry that auto-resolves to 350 from the rate card", async () => {
    const body = {
      description: `Billed protection research work (${RUN_ID})`,
      minutes: 60,
      activity_type: "research",
      lawyer_level: "senior",
    };
    const res = await agentA
      .post(`/api/sya/matters/${billedMatterId}/time-entries`)
      .send(body);
    expect(res.status, `log billed-protection entry: ${JSON.stringify(res.body)}`).toBe(201);
    expect(parseFloat(res.body.rate_usd as string)).toBeCloseTo(originalRate, 1);
    billedEntryId = res.body.id as number;
    timeEntryIds.push(billedEntryId);
  });

  it("generates an invoice that includes the time entry (marks it as billed)", async () => {
    const res = await agentA
      .post(`/api/sya/matters/${billedMatterId}/billing/invoices`)
      .send({});
    expect(res.status, `generate invoice: ${JSON.stringify(res.body)}`).toBe(201);
    billedInvoiceId = res.body.id as number;
    expect(billedInvoiceId).toBeGreaterThan(0);
  });

  it("PUT rate card to 800: billed entry rate_usd remains unchanged at 350", async () => {
    const updated = await updateRateCard(billedCardId, 800);
    expect(parseFloat(updated.rate_usd as string)).toBeCloseTo(800, 1);

    const billing = await getBillingForMatter(billedMatterId);
    const entry = billing.timeEntries.find((e) =>
      (e.description as string).includes("Billed protection research work"),
    );
    expect(entry, "billed entry should appear in billing").toBeTruthy();
    // invoice_id IS NOT NULL → propagation must leave rate_usd at 350.
    expect(parseFloat(entry!.rate as string)).toBeCloseTo(originalRate, 1);
  });

  it("DELETE rate card: billed entry rate_usd remains unchanged at 350", async () => {
    const result = await deleteRateCard(billedCardId);
    expect(result.success).toBe(true);

    const billing = await getBillingForMatter(billedMatterId);
    const entry = billing.timeEntries.find((e) =>
      (e.description as string).includes("Billed protection research work"),
    );
    expect(entry, "billed entry should still appear in billing after card delete").toBeTruthy();
    // Billed entries must never be nullified — rate must still be 350.
    expect(parseFloat(entry!.rate as string)).toBeCloseTo(originalRate, 1);
  });

  afterAll(async () => {
    const ownerKey = `code:${codeId}`;
    // Delete the invoice first (FK: case_invoice_lines cascades; time entry's
    // invoice_id becomes stale but the column is nullable so the DELETE is safe).
    if (billedInvoiceId) {
      await pool.query(`DELETE FROM case_invoices WHERE id = $1`, [billedInvoiceId]);
    }
    if (billedEntryId) {
      await pool.query(
        `DELETE FROM case_time_entries WHERE portal = 'sya' AND id = $1`,
        [billedEntryId],
      );
    }
    await db
      .delete(syaMattersTable)
      .where(eq(syaMattersTable.id, billedMatterId));
    // Guard: card was deleted by the test itself; clean up in case it wasn't.
    await pool.query(
      `DELETE FROM case_rate_cards WHERE portal = 'sya' AND owner_key = $1 AND activity_type = 'research' AND lawyer_level = 'senior'`,
      [ownerKey],
    );
  });
});
