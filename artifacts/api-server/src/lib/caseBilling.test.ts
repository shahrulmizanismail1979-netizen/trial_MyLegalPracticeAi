/**
 * Integration tests for the billing rate-card save/reload cycle on the lit portal.
 *
 * Verifies that:
 *  - POST /api/lit/matters/billing/rate-cards saves a new entry
 *  - GET  /api/lit/matters/billing/rate-cards reloads it after creation
 *  - GET  /api/lit/matters/billing/settings includes rateCards in its payload
 *  - A time entry with matching activity + level gets its rate auto-filled from
 *    the rate card (not left null)
 *  - Cross-tenant isolation: another user cannot read or overwrite entries
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";

// Mock Clerk so these tests run without live credentials.
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
const { db, pool } = await import("@workspace/db");
const { litAccessCodes, litMatters } = await import("@workspace/db/schema");
const { ensureBillingTables } = await import("./caseBilling");

const RUN_ID = `billing-rc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const CODE_A = `TEST-${RUN_ID}-A`.toUpperCase();
const CODE_B = `TEST-${RUN_ID}-B`.toUpperCase();

const codeIds: number[] = [];
const matterIds: number[] = [];
const invoiceIds: number[] = [];

async function loginAgent(code: string) {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/lit/auth/login")
    .send({ password: code });
  expect(res.status).toBe(200);
  return agent;
}

beforeAll(async () => {
  await ensureBillingTables();
  const rows = await db
    .insert(litAccessCodes)
    .values([
      {
        code: CODE_A,
        recipientName: `Billing Test A ${RUN_ID}`,
        recipientEmail: `billing-a-${RUN_ID}@test.local`,
        status: "active",
        compedAccess: true,
      },
      {
        code: CODE_B,
        recipientName: `Billing Test B ${RUN_ID}`,
        recipientEmail: `billing-b-${RUN_ID}@test.local`,
        status: "active",
        compedAccess: true,
      },
    ])
    .returning();
  for (const r of rows) codeIds.push(r.id);
});

afterAll(async () => {
  if (invoiceIds.length > 0) {
    // Deleting invoices cascades to case_invoice_lines and case_invoice_payments.
    // Time entries linked to these invoices are unlinked first so matter cleanup
    // doesn't leave orphaned invoice_id references.
    await pool.query(
      `UPDATE case_time_entries SET invoice_id = NULL WHERE invoice_id = ANY($1::int[])`,
      [invoiceIds],
    );
    await pool.query(`DELETE FROM case_invoices WHERE id = ANY($1::int[])`, [invoiceIds]);
  }
  if (matterIds.length > 0) {
    await pool.query(`DELETE FROM case_time_entries WHERE matter_id = ANY($1::int[])`, [matterIds]);
    await pool.query(`DELETE FROM lit_matters WHERE id = ANY($1::int[])`, [matterIds]);
  }
  if (codeIds.length > 0) {
    await pool.query(
      `DELETE FROM case_rate_cards WHERE portal = 'lit' AND owner_key = ANY($1::text[])`,
      [codeIds.map(String)],
    );
    await pool.query(
      `DELETE FROM case_billing_settings WHERE portal = 'lit' AND owner_key = ANY($1::text[])`,
      [codeIds.map(String)],
    );
    await db.delete(litMatters).where(inArray(litMatters.accessCodeId, codeIds));
    await db
      .delete(litAccessCodes)
      .where(inArray(litAccessCodes.id, codeIds));
  }
});

// ── Auth guard ────────────────────────────────────────────────────────────────

describe("rate-card routes — auth guard", () => {
  it("rejects unauthenticated GET /billing/rate-cards with 401", async () => {
    const res = await request(app).get("/api/lit/matters/billing/rate-cards");
    expect(res.status).toBe(401);
  });

  it("rejects unauthenticated POST /billing/rate-cards with 401", async () => {
    const res = await request(app)
      .post("/api/lit/matters/billing/rate-cards")
      .send({ activityType: "Hearing", lawyerLevel: "Senior", rateUsd: 800 });
    expect(res.status).toBe(401);
  });

  it("returns 404 for the old /api/lit/billing/rate-cards path (not mounted there)", async () => {
    // The subscription-billing router at /api/lit/billing only handles
    // /status, /provision and /portal — rate-card routes live on the
    // matters router at /api/lit/matters/billing/rate-cards.
    const res = await request(app).get("/api/lit/billing/rate-cards");
    expect(res.status).toBe(404);
  });
});

// ── Rate-card CRUD + reload cycle ─────────────────────────────────────────────

describe("rate-card save and reload cycle", () => {
  it("creates a rate card, reloads it, and surfaces it in /billing/settings", async () => {
    const agentA = await loginAgent(CODE_A);

    // 1. Initially empty.
    const empty = await agentA.get("/api/lit/matters/billing/rate-cards");
    expect(empty.status).toBe(200);
    expect(Array.isArray(empty.body)).toBe(true);
    const initialCount = (empty.body as unknown[]).length;

    // 2. POST a new rate card.
    const create = await agentA
      .post("/api/lit/matters/billing/rate-cards")
      .send({
        activityType: "Hearing",
        lawyerLevel: "Senior Associate",
        rateUsd: 850,
      });
    expect(create.status).toBe(201);
    expect(create.body.activity_type).toBe("Hearing");
    expect(create.body.lawyer_level).toBe("Senior Associate");
    expect(parseFloat(create.body.rate_usd as string)).toBeCloseTo(850, 1);
    const cardId: number = create.body.id as number;
    expect(typeof cardId).toBe("number");

    // 3. Reload — entry must persist.
    const list = await agentA.get("/api/lit/matters/billing/rate-cards");
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect((list.body as unknown[]).length).toBe(initialCount + 1);
    const found = (list.body as Array<Record<string, unknown>>).find(
      (rc) => rc.id === cardId,
    );
    expect(found).toBeDefined();
    expect(found!.activity_type).toBe("Hearing");
    expect(parseFloat(found!.rate_usd as string)).toBeCloseTo(850, 1);

    // 4. GET /billing/settings must include rateCards.
    const settings = await agentA.get("/api/lit/matters/billing/settings");
    expect(settings.status).toBe(200);
    expect(Array.isArray(settings.body.rateCards)).toBe(true);
    const inSettings = (
      settings.body.rateCards as Array<Record<string, unknown>>
    ).find((rc) => rc.id === cardId);
    expect(inSettings).toBeDefined();
    expect(inSettings!.activity_type).toBe("Hearing");
  });

  it("upserts on duplicate activity+level (no duplicate rows)", async () => {
    const agentA = await loginAgent(CODE_A);

    // First POST — create the row.
    await agentA.post("/api/lit/matters/billing/rate-cards").send({
      activityType: "Research",
      lawyerLevel: "Paralegal",
      rateUsd: 200,
    });

    // Second POST — same key, different rate → should upsert, not duplicate.
    const upsert = await agentA
      .post("/api/lit/matters/billing/rate-cards")
      .send({
        activityType: "Research",
        lawyerLevel: "Paralegal",
        rateUsd: 250,
      });
    expect(upsert.status).toBe(201);
    expect(parseFloat(upsert.body.rate_usd as string)).toBeCloseTo(250, 1);

    const list = await agentA.get("/api/lit/matters/billing/rate-cards");
    const matches = (list.body as Array<Record<string, unknown>>).filter(
      (rc) =>
        rc.activity_type === "Research" && rc.lawyer_level === "Paralegal",
    );
    // Exactly one row for this activity+level combo.
    expect(matches.length).toBe(1);
    expect(parseFloat(matches[0].rate_usd as string)).toBeCloseTo(250, 1);
  });

  it("validates required fields — rejects missing activityType or rateUsd <= 0", async () => {
    const agentA = await loginAgent(CODE_A);

    const noActivity = await agentA
      .post("/api/lit/matters/billing/rate-cards")
      .send({ lawyerLevel: "Junior", rateUsd: 300 });
    expect(noActivity.status).toBe(400);

    const noLevel = await agentA
      .post("/api/lit/matters/billing/rate-cards")
      .send({ activityType: "Drafting", rateUsd: 300 });
    expect(noLevel.status).toBe(400);

    const zeroRate = await agentA
      .post("/api/lit/matters/billing/rate-cards")
      .send({ activityType: "Drafting", lawyerLevel: "Junior", rateUsd: 0 });
    expect(zeroRate.status).toBe(400);
  });
});

// ── Rate auto-fill on time entries ────────────────────────────────────────────

describe("rate auto-fill from rate card on time entry logging", () => {
  it("auto-fills rate_usd on a time entry when activity+level match a rate card", async () => {
    const agentA = await loginAgent(CODE_A);

    // Seed a rate card for this combination.
    const rc = await agentA.post("/api/lit/matters/billing/rate-cards").send({
      activityType: "Court Attendance",
      lawyerLevel: "Partner",
      rateUsd: 1500,
    });
    expect(rc.status).toBe(201);

    // Create a matter so we can log time against it.
    const matterRes = await agentA
      .post("/api/lit/matters")
      .send({ title: `Autofill Rate Test ${RUN_ID}`, actingFor: "Plaintiff" });
    expect(matterRes.status).toBe(201);
    const matterId: number = matterRes.body.id as number;
    matterIds.push(matterId);

    // Log a time entry with matching activity + level but NO explicit rateUsd.
    // Fields are snake_case to match what the server reads (activity_type, lawyer_level).
    const entry = await agentA
      .post(`/api/lit/matters/${matterId}/time-entries`)
      .send({
        description: `Court hearing day 1 (${RUN_ID})`,
        minutes: 240,
        activity_type: "Court Attendance",
        lawyer_level: "Partner",
      });
    expect(entry.status).toBe(201);

    // The rate should have been auto-filled from the rate card.
    const rate = entry.body.rate_usd;
    expect(rate).not.toBeNull();
    expect(parseFloat(String(rate))).toBeCloseTo(1500, 1);
  });

  it("leaves rate_usd null when no matching rate card exists (falls back to firm default at billing time)", async () => {
    const agentA = await loginAgent(CODE_A);

    const matterRes = await agentA
      .post("/api/lit/matters")
      .send({ title: `No Rate Card Test ${RUN_ID}`, actingFor: "Defendant" });
    expect(matterRes.status).toBe(201);
    const matterId: number = matterRes.body.id as number;
    matterIds.push(matterId);

    // Log time for an activity/level combination with no rate card entry.
    const entry = await agentA
      .post(`/api/lit/matters/${matterId}/time-entries`)
      .send({
        description: `ADR session (${RUN_ID})`,
        minutes: 60,
        activityType: "Mediation_NoCard_" + RUN_ID,
        lawyerLevel: "Associate_NoCard_" + RUN_ID,
      });
    expect(entry.status).toBe(201);

    // No rate card → rate_usd should be null (default used at invoice time).
    expect(entry.body.rate_usd).toBeNull();
  });
});

// ── Propagation through the billing endpoint (BillingTab path) ───────────────
//
// These tests exercise exactly the path the browser follows:
//   1. Log a time entry — rate auto-filled from a rate card.
//   2. PUT the rate card to a new rate.
//   3. GET /{matterId}/billing (the endpoint BillingTab fetches) — the entry's
//      `rate` field AND the `unbilled.time` total must reflect the new rate
//      without any page-level reload.
//   4. DELETE the rate card — same endpoint must show null rate and
//      `rate_source = "default"`.
//
// The GET /time-entries tests in crim/billing-rate-cards.test.ts cover the DB
// propagation layer; these tests confirm the billing summary endpoint (used by
// BillingTab) also surfaces the propagated values.

describe("rate-card edit propagates to billing summary (BillingTab endpoint)", () => {
  let agentProp: ReturnType<typeof request.agent>;
  let propMatterId: number;
  let propCardId: number;
  let propEntryId: number;

  beforeAll(async () => {
    agentProp = await loginAgent(CODE_A);

    // Create a matter for propagation tests.
    const m = await agentProp
      .post("/api/lit/matters")
      .send({ title: `Propagation BillingTab Test ${RUN_ID}`, actingFor: "Plaintiff" });
    expect(m.status, JSON.stringify(m.body)).toBe(201);
    propMatterId = m.body.id as number;
    matterIds.push(propMatterId);
  });

  it("adds a rate card (drafting / associate / 400)", async () => {
    const rc = await agentProp
      .post("/api/lit/matters/billing/rate-cards")
      .send({ activityType: "PropDraft", lawyerLevel: "PropAssoc", rateUsd: 400 });
    expect(rc.status, JSON.stringify(rc.body)).toBe(201);
    propCardId = rc.body.id as number;
    expect(parseFloat(rc.body.rate_usd as string)).toBeCloseTo(400, 1);
  });

  it("logs a time entry — rate auto-filled from the rate card (60 min × 400 = 400 RM)", async () => {
    const entry = await agentProp
      .post(`/api/lit/matters/${propMatterId}/time-entries`)
      .send({
        description: `PropDraft session ${RUN_ID}`,
        minutes: 60,
        activity_type: "PropDraft",
        lawyer_level: "PropAssoc",
      });
    expect(entry.status, JSON.stringify(entry.body)).toBe(201);
    propEntryId = entry.body.id as number;
    expect(parseFloat(entry.body.rate_usd as string)).toBeCloseTo(400, 1);
    expect(entry.body.rate_card_id).toBe(propCardId);

    // Verify the billing summary reflects the initial 400/hr rate.
    const billing = await agentProp.get(`/api/lit/matters/${propMatterId}/billing`);
    expect(billing.status).toBe(200);
    const { timeEntries, unbilled } = billing.body as {
      timeEntries: Array<{ id: number; rate: string | null; rate_source: string }>;
      unbilled: { time: string };
    };
    const te = timeEntries.find((e) => e.id === propEntryId);
    expect(te, "entry should appear in billing summary").toBeTruthy();
    expect(parseFloat(te!.rate as string)).toBeCloseTo(400, 1);
    // 60 min / 60 × 400 = 400.00
    expect(parseFloat(unbilled.time)).toBeCloseTo(400, 1);
  });

  it("PUT rate card to 600 — billing summary immediately shows updated rate and total", async () => {
    // Update the rate card.
    const put = await agentProp
      .put(`/api/lit/matters/billing/rate-cards/${propCardId}`)
      .send({ rateUsd: 600 });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    expect(parseFloat(put.body.rate_usd as string)).toBeCloseTo(600, 1);

    // Fetch the billing summary — no page reload, just re-GET the endpoint.
    const billing = await agentProp.get(`/api/lit/matters/${propMatterId}/billing`);
    expect(billing.status).toBe(200);
    const { timeEntries, unbilled } = billing.body as {
      timeEntries: Array<{ id: number; rate: string | null; rate_source: string }>;
      unbilled: { time: string };
    };

    const te = timeEntries.find((e) => e.id === propEntryId);
    expect(te, "entry must still appear").toBeTruthy();
    // Rate must have updated from 400 to 600.
    expect(parseFloat(te!.rate as string)).toBeCloseTo(600, 1);
    // unbilled.time = 60 min / 60 × 600 = 600.00
    expect(parseFloat(unbilled.time)).toBeCloseTo(600, 1);
  });

  it("DELETE rate card — billing summary shows null rate and falls back to firm default total", async () => {
    // Delete the rate card.
    const del = await agentProp.delete(
      `/api/lit/matters/billing/rate-cards/${propCardId}`,
    );
    expect(del.status, JSON.stringify(del.body)).toBe(200);
    expect(del.body.success).toBe(true);

    // Fetch the billing summary again.
    const billing = await agentProp.get(`/api/lit/matters/${propMatterId}/billing`);
    expect(billing.status).toBe(200);
    const { timeEntries, unbilled } = billing.body as {
      timeEntries: Array<{
        id: number;
        rate: string | null;
        rate_source: string;
      }>;
      unbilled: { time: string };
      settings: { default_hourly_rate: string | null };
    };

    const te = timeEntries.find((e) => e.id === propEntryId);
    expect(te, "entry must still appear after card deletion").toBeTruthy();

    // Rate must be nullified — the entry should now carry rate_source = 'default'.
    // (rate_card_id is an internal field not projected by the billing endpoint.)
    expect(te!.rate).toBeNull();
    expect(te!.rate_source).toBe("default");

    // unbilled.time falls back to firm default (likely 0 since no default is set
    // for a freshly created test tenant).
    const defaultRate = parseFloat(billing.body.settings?.default_hourly_rate ?? "0") || 0;
    expect(parseFloat(unbilled.time)).toBeCloseTo((60 / 60) * defaultRate, 1);
  });

  it("manual-rate entries (no rate_card_id) are never touched by propagation", async () => {
    // Log a manual entry — explicit rate, not from a rate card.
    const manualEntry = await agentProp
      .post(`/api/lit/matters/${propMatterId}/time-entries`)
      .send({
        description: `Manual rate session ${RUN_ID}`,
        minutes: 30,
        rate_usd: 999,
        // rate_autofilled is absent → server treats rate as manual
      });
    expect(manualEntry.status, JSON.stringify(manualEntry.body)).toBe(201);
    const manualId = manualEntry.body.id as number;
    matterIds.push(propMatterId); // already pushed, harmless duplicate

    expect(parseFloat(manualEntry.body.rate_usd as string)).toBeCloseTo(999, 1);
    expect(manualEntry.body.rate_source).toBe("manual");
    expect(manualEntry.body.rate_card_id).toBeNull();

    // Add a fresh rate card and delete it immediately — manual entry must be untouched.
    const rc2 = await agentProp
      .post("/api/lit/matters/billing/rate-cards")
      .send({ activityType: "PropDraft2", lawyerLevel: "PropAssoc2", rateUsd: 800 });
    expect(rc2.status).toBe(201);
    const rc2Id = rc2.body.id as number;

    await agentProp.delete(`/api/lit/matters/billing/rate-cards/${rc2Id}`);

    // Billing summary must show the manual entry still at 999.
    const billing = await agentProp.get(`/api/lit/matters/${propMatterId}/billing`);
    const { timeEntries } = billing.body as {
      timeEntries: Array<{ id: number; rate: string | null; rate_source: string }>;
    };
    const me = timeEntries.find((e) => e.id === manualId);
    expect(me, "manual entry must still appear").toBeTruthy();
    expect(parseFloat(me!.rate as string)).toBeCloseTo(999, 1);
    expect(me!.rate_source).toBe("manual");
  });
});

// ── Cross-tenant isolation ────────────────────────────────────────────────────

describe("rate-card cross-tenant isolation", () => {
  it("user B cannot see user A's rate cards", async () => {
    const agentA = await loginAgent(CODE_A);
    const agentB = await loginAgent(CODE_B);

    // A creates a rate card with a uniquely identifiable activity type.
    const uniqueActivity = `CrossTenantTest_${RUN_ID}`;
    const rc = await agentA.post("/api/lit/matters/billing/rate-cards").send({
      activityType: uniqueActivity,
      lawyerLevel: "Senior Partner",
      rateUsd: 9999,
    });
    expect(rc.status).toBe(201);

    // B's rate-card list must not include A's entry.
    const bList = await agentB.get("/api/lit/matters/billing/rate-cards");
    expect(bList.status).toBe(200);
    const hasA = (bList.body as Array<Record<string, unknown>>).some(
      (r) => r.activity_type === uniqueActivity,
    );
    expect(hasA).toBe(false);
  });
});

// ── Billed-entry immutability ─────────────────────────────────────────────────
//
// propagateRateCardUpdate / propagateRateCardDelete both guard with
// WHERE invoice_id IS NULL, so time entries that have already been placed on
// an issued invoice must never be repriced or nullified.
//
// Test plan:
//   1. Log a time entry — rate auto-filled from a rate card.
//   2. Generate and issue an invoice (invoice_id IS NOT NULL on the entry).
//   3. Edit the rate card (PUT) → billed entry rate_usd must be unchanged.
//   4. Delete the rate card → billed entry rate_usd must still be unchanged.
//   5. The matter billing summary (GET /:matterId/billing) must reflect the
//      original billed rate throughout, confirming the endpoint reads the DB.

describe("billed entries are immutable when rate card is edited or deleted", () => {
  let agentBilled: ReturnType<typeof request.agent>;
  let billedMatterId: number;
  let billedCardId: number;
  let billedEntryId: number;
  let billedInvoiceId: number;
  const ORIGINAL_RATE = 700;

  beforeAll(async () => {
    agentBilled = await loginAgent(CODE_A);

    // 1. Create a dedicated matter for this suite.
    const m = await agentBilled
      .post("/api/lit/matters")
      .send({ title: `Billed Immutability Test ${RUN_ID}`, actingFor: "Plaintiff" });
    expect(m.status, JSON.stringify(m.body)).toBe(201);
    billedMatterId = m.body.id as number;
    matterIds.push(billedMatterId);

    // 2. Create a rate card at 700/hr.
    const rc = await agentBilled
      .post("/api/lit/matters/billing/rate-cards")
      .send({ activityType: "BilledHearing", lawyerLevel: "BilledSenior", rateUsd: ORIGINAL_RATE });
    expect(rc.status, JSON.stringify(rc.body)).toBe(201);
    billedCardId = rc.body.id as number;

    // 3. Log a 60-minute time entry — rate auto-filled from the card (700).
    const entry = await agentBilled
      .post(`/api/lit/matters/${billedMatterId}/time-entries`)
      .send({
        description: `Billed hearing ${RUN_ID}`,
        minutes: 60,
        activity_type: "BilledHearing",
        lawyer_level: "BilledSenior",
      });
    expect(entry.status, JSON.stringify(entry.body)).toBe(201);
    billedEntryId = entry.body.id as number;
    expect(parseFloat(entry.body.rate_usd as string)).toBeCloseTo(ORIGINAL_RATE, 1);
    expect(entry.body.rate_card_id).toBe(billedCardId);

    // 4. Generate a draft invoice covering this entry.
    const inv = await agentBilled
      .post(`/api/lit/matters/${billedMatterId}/billing/invoices`)
      .send({ includeTime: true, includeFees: false });
    expect(inv.status, JSON.stringify(inv.body)).toBe(201);
    billedInvoiceId = inv.body.id as number;
    invoiceIds.push(billedInvoiceId);

    // 5. Issue the invoice — this stamps invoice_id onto the time entry.
    const issued = await agentBilled
      .patch(`/api/lit/matters/billing/invoices/${billedInvoiceId}`)
      .send({ status: "issued" });
    expect(issued.status, JSON.stringify(issued.body)).toBe(200);
    expect(issued.body.status).toBe("issued");
  });

  it("time entry carries invoice_id after invoicing (precondition)", async () => {
    // Query the DB directly via the billing summary — billed entries still appear
    // in timeEntries but with invoice_id set.
    const billing = await agentBilled.get(
      `/api/lit/matters/${billedMatterId}/billing`,
    );
    expect(billing.status).toBe(200);
    const { timeEntries } = billing.body as {
      timeEntries: Array<{
        id: number;
        rate: string | null;
        invoice_id: number | null;
      }>;
    };
    const te = timeEntries.find((e) => e.id === billedEntryId);
    expect(te, "billed entry must appear in billing summary").toBeTruthy();
    expect(te!.invoice_id).toBe(billedInvoiceId);
    // Rate must still be the original 700.
    expect(parseFloat(te!.rate as string)).toBeCloseTo(ORIGINAL_RATE, 1);
  });

  it("editing the rate card (PUT) does NOT reprice the billed entry", async () => {
    const NEW_RATE = 1200;

    // Update the rate card to 1200.
    const put = await agentBilled
      .put(`/api/lit/matters/billing/rate-cards/${billedCardId}`)
      .send({ rateUsd: NEW_RATE });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    expect(parseFloat(put.body.rate_usd as string)).toBeCloseTo(NEW_RATE, 1);

    // The billed entry must still carry the original 700.
    const billing = await agentBilled.get(
      `/api/lit/matters/${billedMatterId}/billing`,
    );
    expect(billing.status).toBe(200);
    const { timeEntries } = billing.body as {
      timeEntries: Array<{
        id: number;
        rate: string | null;
        invoice_id: number | null;
      }>;
    };
    const te = timeEntries.find((e) => e.id === billedEntryId);
    expect(te, "billed entry must still appear").toBeTruthy();
    expect(te!.invoice_id).toBe(billedInvoiceId);
    expect(
      parseFloat(te!.rate as string),
      "billed entry rate must NOT change after rate-card edit",
    ).toBeCloseTo(ORIGINAL_RATE, 1);
  });

  it("deleting the rate card does NOT nullify the billed entry's rate", async () => {
    // Delete the rate card entirely.
    const del = await agentBilled.delete(
      `/api/lit/matters/billing/rate-cards/${billedCardId}`,
    );
    expect(del.status, JSON.stringify(del.body)).toBe(200);
    expect(del.body.success).toBe(true);

    // The billed entry must still carry the original 700 (not nullified).
    const billing = await agentBilled.get(
      `/api/lit/matters/${billedMatterId}/billing`,
    );
    expect(billing.status).toBe(200);
    const { timeEntries } = billing.body as {
      timeEntries: Array<{
        id: number;
        rate: string | null;
        rate_source: string;
        invoice_id: number | null;
      }>;
    };
    const te = timeEntries.find((e) => e.id === billedEntryId);
    expect(te, "billed entry must still appear after card deletion").toBeTruthy();
    expect(te!.invoice_id).toBe(billedInvoiceId);
    expect(
      te!.rate,
      "billed entry rate must NOT be nullified after rate-card deletion",
    ).not.toBeNull();
    expect(
      parseFloat(te!.rate as string),
      "billed entry rate must still equal the original 700",
    ).toBeCloseTo(ORIGINAL_RATE, 1);
  });
});
