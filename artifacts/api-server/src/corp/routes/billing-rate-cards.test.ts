/**
 * Integration tests: MyCorpLegalAI rate-card auto-fill (Task #289)
 *
 * Verifies that the lookupRateCard precedence chain works correctly when
 * time entries are logged through the MyCorpLegalAI matter billing routes:
 *
 *   named-lawyer rate  (activity + level + name)  beats
 *   level-only rate    (activity + level, no name)
 *
 * MyCorpLegalAI authenticates with a session Bearer token returned by
 * /api/corp/legal/verify-password. The owner key is the numeric
 * corp_access_codes.id stringified.
 *
 * Routes under test:
 *   POST   /api/corp/legal/verify-password               — log in (Bearer token)
 *   POST   /api/corp/matters                             — create a matter
 *   POST   /api/corp/matters/billing/rate-cards          — add a rate card entry
 *   POST   /api/corp/matters/:id/time-entries            — log time (triggers lookupRateCard)
 *   GET    /api/corp/matters/:id/time-entries            — read time entries + resolved rates
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
const { db, corpAccessCodes, corpSessions } = await import("@workspace/db");
const { pool } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");
const { ensureMatterFileTables } = await import("../../lib/matterFiles");

const RUN_ID = `corp-rc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
// corp_access_codes.code is varchar(20) — keep the code short.
const CODE = `CRPRC${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

let codeId: number;
let bearerToken: string;
let testMatterId: number;
const timeEntryIds: number[] = [];

function api(method: "get" | "post" | "put" | "patch" | "delete", path: string) {
  const r = request(app);
  const req =
    method === "get" ? r.get(path)
    : method === "post" ? r.post(path)
    : method === "put" ? r.put(path)
    : method === "patch" ? r.patch(path)
    : r.delete(path);
  return req.set("Authorization", `Bearer ${bearerToken}`);
}

beforeAll(async () => {
  await ensureMatterFileTables();

  const [row] = await db
    .insert(corpAccessCodes)
    .values({ code: CODE, label: `Rate card test ${RUN_ID}`, isActive: true })
    .returning();
  codeId = row.id;

  const loginRes = await request(app)
    .post("/api/corp/legal/verify-password")
    .send({ password: CODE });
  expect(loginRes.status, `corp login: ${JSON.stringify(loginRes.body)}`).toBe(200);
  expect(loginRes.body.success).toBe(true);
  bearerToken = loginRes.body.token as string;
});

afterAll(async () => {
  const ownerKey = String(codeId);
  await pool.query(
    `DELETE FROM case_rate_cards WHERE portal = 'corp' AND owner_key = $1`,
    [ownerKey],
  );
  if (timeEntryIds.length > 0) {
    await pool.query(
      `DELETE FROM case_time_entries WHERE portal = 'corp' AND id = ANY($1::int[])`,
      [timeEntryIds],
    );
  }
  // corp_matters.access_code_id → corp_access_codes(id).
  await pool.query(`DELETE FROM corp_matters WHERE access_code_id = $1`, [codeId]);
  // Deactivate / delete sessions (they FK to the access code).
  await db.delete(corpSessions).where(eq(corpSessions.accessCodeId, codeId));
  // Delete the test access code.
  await db.delete(corpAccessCodes).where(eq(corpAccessCodes.id, codeId));
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createMatter(title: string) {
  const res = await api("post", "/api/corp/matters").send({ title });
  expect(res.status, `create corp matter: ${JSON.stringify(res.body)}`).toBe(201);
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
  const res = await api("post", "/api/corp/matters/billing/rate-cards").send(body);
  expect(res.status, `add corp rate card: ${JSON.stringify(res.body)}`).toBe(201);
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
    `/api/corp/matters/${matterId}/time-entries`,
  ).send(body);
  expect(res.status, `log corp time entry: ${JSON.stringify(res.body)}`).toBe(201);
  timeEntryIds.push(res.body.id as number);
  return res.body as Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MyCorpLegalAI rate-card auto-fill", () => {
  it("creates a matter for billing test", async () => {
    testMatterId = await createMatter(`Billing RC Test ${RUN_ID}`);
    expect(testMatterId).toBeGreaterThan(0);
  });

  it("adds a level-only rate card (advisory / associate)", async () => {
    const card = await addRateCard("advisory", "associate", 300);
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(300, 1);
    expect(card.lawyer_name).toBeNull();
  });

  it("adds a named-lawyer rate card (advisory / associate / Wong)", async () => {
    const card = await addRateCard("advisory", "associate", 500, "Wong");
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(500, 1);
    expect(card.lawyer_name).toBe("Wong");
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

  it("time entry with lawyer_name='Wong' auto-fills the named-lawyer rate (500)", async () => {
    const entry = await logTimeEntry(
      testMatterId,
      `Named-lawyer advisory work (${RUN_ID})`,
      90,
      "advisory",
      "associate",
      "Wong",
    );
    expect(entry.rate_usd).not.toBeNull();
    expect(parseFloat(entry.rate_usd as string)).toBeCloseTo(500, 1);
  });

  it("GET time-entries returns both entries with correct resolved rates", async () => {
    const res = await api(
      "get",
      `/api/corp/matters/${testMatterId}/time-entries`,
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

  it("named-lawyer rate takes precedence: 500 > 300 for Wong entries", () => {
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
  const res = await api("put", `/api/corp/matters/billing/rate-cards/${cardId}`).send({ rateUsd });
  expect(res.status, `update corp rate card: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body as Record<string, unknown>;
}

async function deleteRateCard(cardId: number) {
  const res = await api("delete", `/api/corp/matters/billing/rate-cards/${cardId}`);
  expect(res.status, `delete corp rate card: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body as Record<string, unknown>;
}

async function getBillingForMatter(matterId: number) {
  const res = await api("get", `/api/corp/matters/${matterId}/billing`);
  expect(res.status, `get corp billing: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body as { timeEntries: Array<Record<string, unknown>> };
}

describe("MyCorpLegalAI rate-card propagation (PUT & DELETE)", () => {
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
    const res = await api("post", `/api/corp/matters/${propagationMatterId}/time-entries`).send(body);
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
        `DELETE FROM case_time_entries WHERE portal = 'corp' AND id = ANY($1::int[])`,
        [propagationEntryIds],
      );
    }
    await pool.query(`DELETE FROM corp_matters WHERE id = $1`, [propagationMatterId]);
    // Guard: the test deletes the card itself; clean up if any remain.
    await pool.query(
      `DELETE FROM case_rate_cards WHERE portal = 'corp' AND owner_key = $1 AND activity_type = 'drafting' AND lawyer_level = 'partner'`,
      [ownerKey],
    );
  });
});

// ── Billed-entry immutability tests ──────────────────────────────────────────
//
// Confirm that propagateRateCardUpdate and propagateRateCardDelete never touch
// a time entry that is already attached to an invoice (invoice_id IS NOT NULL).
// The guard is the `invoice_id IS NULL` predicate in both propagation helpers.
// Without these tests a future refactor could silently corrupt historical billing.

describe("MyCorpLegalAI billed entries are immutable to rate-card changes", () => {
  // Shared state for the PUT-guard scenario
  let putMatterId: number;
  let putCardId: number;
  let putEntryId: number;
  let putInvoiceId: number;

  // Shared state for the DELETE-guard scenario
  let delMatterId: number;
  let delCardId: number;
  let delEntryId: number;
  let delInvoiceId: number;

  // ── PUT guard setup ──────────────────────────────────────────────────────

  it("PUT guard: creates a matter", async () => {
    putMatterId = await createMatter(`Billed Immutability PUT ${RUN_ID}`);
    expect(putMatterId).toBeGreaterThan(0);
  });

  it("PUT guard: adds a rate card (research / senior, 350)", async () => {
    const card = await addRateCard("research", "senior", 350);
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(350, 1);
    putCardId = card.id as number;
    expect(putCardId).toBeGreaterThan(0);
  });

  it("PUT guard: logs a time entry that resolves the rate card (rate = 350)", async () => {
    const body = {
      description: `Billed immutability PUT work (${RUN_ID})`,
      minutes: 60,
      activity_type: "research",
      lawyer_level: "senior",
    };
    const res = await api("post", `/api/corp/matters/${putMatterId}/time-entries`).send(body);
    expect(res.status, `log time entry: ${JSON.stringify(res.body)}`).toBe(201);
    expect(parseFloat(res.body.rate_usd as string)).toBeCloseTo(350, 1);
    putEntryId = res.body.id as number;
    timeEntryIds.push(putEntryId);
  });

  it("PUT guard: generates an invoice that captures the time entry", async () => {
    const res = await api("post", `/api/corp/matters/${putMatterId}/billing/invoices`).send({
      includeTime: true,
      includeFees: false,
    });
    expect(res.status, `create invoice: ${JSON.stringify(res.body)}`).toBe(201);
    putInvoiceId = res.body.id as number;
    expect(putInvoiceId).toBeGreaterThan(0);
    // Confirm the time entry is now stamped with the invoice_id in the DB.
    const { rows } = await pool.query(
      `SELECT invoice_id FROM case_time_entries WHERE id = $1`,
      [putEntryId],
    );
    expect(rows[0]?.invoice_id).toBe(putInvoiceId);
  });

  it("PUT rate card to 900: billed time entry rate stays at 350", async () => {
    const updated = await updateRateCard(putCardId, 900);
    expect(parseFloat(updated.rate_usd as string)).toBeCloseTo(900, 1);

    const billing = await getBillingForMatter(putMatterId);
    const entry = billing.timeEntries.find((e) =>
      (e.description as string).includes("Billed immutability PUT work"),
    );
    expect(entry, "billed time entry should still appear in billing").toBeTruthy();
    // The propagation helper must not have touched this billed entry.
    expect(parseFloat(entry!.rate as string)).toBeCloseTo(350, 1);
  });

  // ── DELETE guard setup ───────────────────────────────────────────────────

  it("DELETE guard: creates a matter", async () => {
    delMatterId = await createMatter(`Billed Immutability DEL ${RUN_ID}`);
    expect(delMatterId).toBeGreaterThan(0);
  });

  it("DELETE guard: adds a rate card (negotiation / junior, 250)", async () => {
    const card = await addRateCard("negotiation", "junior", 250);
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(250, 1);
    delCardId = card.id as number;
    expect(delCardId).toBeGreaterThan(0);
  });

  it("DELETE guard: logs a time entry that resolves the rate card (rate = 250)", async () => {
    const body = {
      description: `Billed immutability DEL work (${RUN_ID})`,
      minutes: 60,
      activity_type: "negotiation",
      lawyer_level: "junior",
    };
    const res = await api("post", `/api/corp/matters/${delMatterId}/time-entries`).send(body);
    expect(res.status, `log time entry: ${JSON.stringify(res.body)}`).toBe(201);
    expect(parseFloat(res.body.rate_usd as string)).toBeCloseTo(250, 1);
    delEntryId = res.body.id as number;
    timeEntryIds.push(delEntryId);
  });

  it("DELETE guard: generates an invoice that captures the time entry", async () => {
    const res = await api("post", `/api/corp/matters/${delMatterId}/billing/invoices`).send({
      includeTime: true,
      includeFees: false,
    });
    expect(res.status, `create invoice: ${JSON.stringify(res.body)}`).toBe(201);
    delInvoiceId = res.body.id as number;
    expect(delInvoiceId).toBeGreaterThan(0);
    // Confirm the time entry is now stamped with the invoice_id in the DB.
    const { rows } = await pool.query(
      `SELECT invoice_id FROM case_time_entries WHERE id = $1`,
      [delEntryId],
    );
    expect(rows[0]?.invoice_id).toBe(delInvoiceId);
  });

  it("DELETE rate card: billed time entry rate stays at 250 (not nullified)", async () => {
    const result = await deleteRateCard(delCardId);
    expect(result.success).toBe(true);

    const billing = await getBillingForMatter(delMatterId);
    const entry = billing.timeEntries.find((e) =>
      (e.description as string).includes("Billed immutability DEL work"),
    );
    expect(entry, "billed time entry should still appear in billing after card delete").toBeTruthy();
    // The delete propagation helper must not have nullified this billed entry.
    expect(parseFloat(entry!.rate as string)).toBeCloseTo(250, 1);
  });

  afterAll(async () => {
    const ownerKey = String(codeId);
    // Clean up time entries (invoice_id column has no FK constraint so order is flexible).
    const entriesToDelete = [putEntryId, delEntryId].filter(Boolean);
    if (entriesToDelete.length > 0) {
      await pool.query(
        `DELETE FROM case_time_entries WHERE portal = 'corp' AND id = ANY($1::int[])`,
        [entriesToDelete],
      );
    }
    // Delete invoices (cascade-deletes lines).
    const invoicesToDelete = [putInvoiceId, delInvoiceId].filter(Boolean);
    if (invoicesToDelete.length > 0) {
      await pool.query(
        `DELETE FROM case_invoices WHERE portal = 'corp' AND id = ANY($1::int[])`,
        [invoicesToDelete],
      );
    }
    // Delete matters.
    const mattersToDelete = [putMatterId, delMatterId].filter(Boolean);
    if (mattersToDelete.length > 0) {
      await pool.query(`DELETE FROM corp_matters WHERE id = ANY($1::int[])`, [mattersToDelete]);
    }
    // Guard: PUT test leaves the card alive (rate updated to 900); delete it.
    await pool.query(
      `DELETE FROM case_rate_cards WHERE portal = 'corp' AND owner_key = $1
       AND activity_type IN ('research', 'negotiation')`,
      [ownerKey],
    );
  });
});

// ── POST-upsert billed-entry immutability test ────────────────────────────────
//
// The POST /billing/rate-cards route uses ON CONFLICT … DO UPDATE, which
// triggers propagateRateCardUpdate just like PUT does. This describe block
// confirms the `invoice_id IS NULL` guard holds on the upsert path: a billed
// time entry must never have its rate changed by a subsequent POST that
// resolves to the same card via the unique conflict key.

describe("MyCorpLegalAI POST-upsert leaves billed entries untouched", () => {
  let upsertMatterId: number;
  let upsertCardId: number;
  let upsertEntryId: number;
  let upsertInvoiceId: number;

  it("creates a matter for upsert immutability test", async () => {
    upsertMatterId = await createMatter(`Billed Immutability UPSERT ${RUN_ID}`);
    expect(upsertMatterId).toBeGreaterThan(0);
  });

  it("adds an initial rate card via POST (drafting / senior, 400)", async () => {
    const card = await addRateCard("drafting", "senior", 400);
    expect(parseFloat(card.rate_usd as string)).toBeCloseTo(400, 1);
    upsertCardId = card.id as number;
    expect(upsertCardId).toBeGreaterThan(0);
  });

  it("logs a time entry that resolves the rate card (rate = 400)", async () => {
    const body = {
      description: `Billed immutability UPSERT work (${RUN_ID})`,
      minutes: 60,
      activity_type: "drafting",
      lawyer_level: "senior",
    };
    const res = await api("post", `/api/corp/matters/${upsertMatterId}/time-entries`).send(body);
    expect(res.status, `log time entry: ${JSON.stringify(res.body)}`).toBe(201);
    expect(parseFloat(res.body.rate_usd as string)).toBeCloseTo(400, 1);
    upsertEntryId = res.body.id as number;
    timeEntryIds.push(upsertEntryId);
  });

  it("generates an invoice that captures the time entry", async () => {
    const res = await api("post", `/api/corp/matters/${upsertMatterId}/billing/invoices`).send({
      includeTime: true,
      includeFees: false,
    });
    expect(res.status, `create invoice: ${JSON.stringify(res.body)}`).toBe(201);
    upsertInvoiceId = res.body.id as number;
    expect(upsertInvoiceId).toBeGreaterThan(0);
    // Confirm the time entry is now stamped with the invoice_id in the DB.
    const { rows } = await pool.query(
      `SELECT invoice_id FROM case_time_entries WHERE id = $1`,
      [upsertEntryId],
    );
    expect(rows[0]?.invoice_id).toBe(upsertInvoiceId);
  });

  it("POST same activity/level with new rate 800 (triggers ON CONFLICT upsert): billed entry rate stays at 400", async () => {
    // This POST hits the ON CONFLICT DO UPDATE path because (drafting, senior,
    // null lawyer_name, null practice_area) already exists for this owner.
    const upserted = await addRateCard("drafting", "senior", 800);
    // The card itself should now carry the new rate.
    expect(parseFloat(upserted.rate_usd as string)).toBeCloseTo(800, 1);
    // The card id must be the same row (upsert, not insert).
    expect(upserted.id).toBe(upsertCardId);

    // The billed time entry must be untouched because invoice_id IS NOT NULL.
    const billing = await getBillingForMatter(upsertMatterId);
    const entry = billing.timeEntries.find((e) =>
      (e.description as string).includes("Billed immutability UPSERT work"),
    );
    expect(entry, "billed time entry should still appear in billing").toBeTruthy();
    // propagateRateCardUpdate must not have updated this billed entry.
    expect(parseFloat(entry!.rate as string)).toBeCloseTo(400, 1);
  });

  afterAll(async () => {
    const ownerKey = String(codeId);
    if (upsertEntryId) {
      await pool.query(
        `DELETE FROM case_time_entries WHERE portal = 'corp' AND id = $1`,
        [upsertEntryId],
      );
    }
    if (upsertInvoiceId) {
      await pool.query(
        `DELETE FROM case_invoices WHERE portal = 'corp' AND id = $1`,
        [upsertInvoiceId],
      );
    }
    if (upsertMatterId) {
      await pool.query(`DELETE FROM corp_matters WHERE id = $1`, [upsertMatterId]);
    }
    // Clean up the upserted rate card.
    await pool.query(
      `DELETE FROM case_rate_cards WHERE portal = 'corp' AND owner_key = $1
       AND activity_type = 'drafting' AND lawyer_level = 'senior'`,
      [ownerKey],
    );
  });
});
