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
const { ensureBillingTables } = await import("../../lib/caseBilling");

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
  // Ensure billing schema (including rate_card_id on case_time_entries) exists
  // before any route touches those columns.  Tests import app.ts directly so
  // the index.ts startup path (which normally runs this) does not execute.
  await ensureBillingTables();
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

// ── Propagation tests ─────────────────────────────────────────────────────────

describe("Rate-card propagation to unbilled time entries", () => {
  let matterId2: number;
  /**
   * Two level cards for the same activity+level but different practice areas:
   *   generalCardId  — no practice_area (broadest fallback, step 4)
   *   areaCardId     — practice_area = "corporate" (step 3)
   * A named card (Siti) sits alongside both.
   */
  let generalCardId: number;
  let areaCardId: number;
  let namedCardId: number;

  it("creates a second matter for propagation tests", async () => {
    const res = await sess.agent
      .post("/api/crim/matters")
      .send({ title: `Propagation Test ${RUN_ID}`, stage: "trial", charge: "s.302 PC" });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    matterId2 = res.body.id as number;
    expect(matterId2).toBeGreaterThan(0);
  });

  it("creates general level card (drafting / partner / 400)", async () => {
    const res = await sess.agent
      .post("/api/crim/matters/billing/rate-cards")
      .send({ activityType: "drafting", lawyerLevel: "partner", rateUsd: 400 });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    generalCardId = res.body.id as number;
    expect(parseFloat(res.body.rate_usd as string)).toBeCloseTo(400, 1);
  });

  it("creates area-specific level card (drafting / partner / corporate / 550)", async () => {
    const res = await sess.agent
      .post("/api/crim/matters/billing/rate-cards")
      .send({ activityType: "drafting", lawyerLevel: "partner", practiceArea: "corporate", rateUsd: 550 });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    areaCardId = res.body.id as number;
    expect(parseFloat(res.body.rate_usd as string)).toBeCloseTo(550, 1);
  });

  it("creates named card (drafting / partner / Siti / 700)", async () => {
    const res = await sess.agent
      .post("/api/crim/matters/billing/rate-cards")
      .send({ activityType: "drafting", lawyerLevel: "partner", lawyerName: "Siti", rateUsd: 700 });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    namedCardId = res.body.id as number;
    expect(parseFloat(res.body.rate_usd as string)).toBeCloseTo(700, 1);
  });

  // ── Seed: log one entry per card tier ──────────────────────────────────

  it("entry without name/area resolves to general level card (400)", async () => {
    const entry = await logTimeEntry(matterId2, `General level entry ${RUN_ID}`, 45, "drafting", "partner");
    expect(parseFloat(entry.rate_usd as string)).toBeCloseTo(400, 1);
    expect(entry.rate_source).toBe("level");
    expect(entry.rate_card_id).toBe(generalCardId);
  });

  it("entry with practice_area='corporate' resolves to area card (550), not general", async () => {
    const body: Record<string, unknown> = {
      description: `Area level entry ${RUN_ID}`,
      minutes: 30,
      activity_type: "drafting",
      lawyer_level: "partner",
      practice_area: "corporate",
    };
    const res = await sess.agent
      .post(`/api/crim/matters/${matterId2}/time-entries`)
      .send(body);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    timeEntryIds.push(res.body.id as number);
    expect(parseFloat(res.body.rate_usd as string)).toBeCloseTo(550, 1);
    expect(res.body.rate_source).toBe("level");
    // Must be keyed to the area card, not the general one
    expect(res.body.rate_card_id).toBe(areaCardId);
  });

  it("entry for Siti resolves to named card (700)", async () => {
    const entry = await logTimeEntry(matterId2, `Named entry Siti ${RUN_ID}`, 60, "drafting", "partner", "Siti");
    expect(parseFloat(entry.rate_usd as string)).toBeCloseTo(700, 1);
    expect(entry.rate_source).toBe("named");
    expect(entry.rate_card_id).toBe(namedCardId);
  });

  it("entry for unknown lawyer falls back to general level card (400) — named precedes level only for known names", async () => {
    const entry = await logTimeEntry(matterId2, `Fallback level entry ${RUN_ID}`, 20, "drafting", "partner", "UnknownLawyer");
    // No named card for UnknownLawyer → falls through to general level (step 4)
    expect(parseFloat(entry.rate_usd as string)).toBeCloseTo(400, 1);
    expect(entry.rate_source).toBe("level");
    expect(entry.rate_card_id).toBe(generalCardId);
  });

  it("manual-rate entry has no rate_card_id", async () => {
    const body: Record<string, unknown> = {
      description: `Manual rate entry ${RUN_ID}`,
      minutes: 20,
      activity_type: "drafting",
      lawyer_level: "partner",
      rate_usd: 999,
    };
    const res = await sess.agent
      .post(`/api/crim/matters/${matterId2}/time-entries`)
      .send(body);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    timeEntryIds.push(res.body.id as number);
    expect(parseFloat(res.body.rate_usd as string)).toBeCloseTo(999, 1);
    expect(res.body.rate_source).toBe("manual");
    expect(res.body.rate_card_id).toBeNull();
  });

  // ── PUT: general level card update propagates only to its own entries ──

  it("PUT general card to 450 → general-level entries update; area and named entries unchanged", async () => {
    const put = await sess.agent
      .put(`/api/crim/matters/billing/rate-cards/${generalCardId}`)
      .send({ rateUsd: 450 });
    expect(put.status, JSON.stringify(put.body)).toBe(200);

    const get = await sess.agent.get(`/api/crim/matters/${matterId2}/time-entries`);
    expect(get.status).toBe(200);
    const entries: Array<Record<string, unknown>> = get.body.entries ?? get.body;

    // Both entries keyed to generalCardId should update
    const generalEntry = entries.find((e) => (e.description as string).includes("General level entry"));
    expect(generalEntry).toBeTruthy();
    expect(parseFloat(generalEntry!.rate_usd as string)).toBeCloseTo(450, 1);

    const fallbackEntry = entries.find((e) => (e.description as string).includes("Fallback level entry"));
    expect(fallbackEntry).toBeTruthy();
    expect(parseFloat(fallbackEntry!.rate_usd as string)).toBeCloseTo(450, 1);

    // Area-card entry must NOT change
    const areaEntry = entries.find((e) => (e.description as string).includes("Area level entry"));
    expect(areaEntry).toBeTruthy();
    expect(parseFloat(areaEntry!.rate_usd as string)).toBeCloseTo(550, 1);

    // Named entry must NOT change
    const namedEntry = entries.find((e) => (e.description as string).includes("Named entry Siti"));
    expect(namedEntry).toBeTruthy();
    expect(parseFloat(namedEntry!.rate_usd as string)).toBeCloseTo(700, 1);

    // Manual entry must NOT change
    const manualEntry = entries.find((e) => (e.description as string).includes("Manual rate entry"));
    expect(manualEntry).toBeTruthy();
    expect(parseFloat(manualEntry!.rate_usd as string)).toBeCloseTo(999, 1);
  });

  // ── PUT: named card update propagates only to its own entries ──────────

  it("PUT named card (Siti) to 800 → named entry updates; general and area entries unchanged", async () => {
    const put = await sess.agent
      .put(`/api/crim/matters/billing/rate-cards/${namedCardId}`)
      .send({ rateUsd: 800 });
    expect(put.status, JSON.stringify(put.body)).toBe(200);

    const get = await sess.agent.get(`/api/crim/matters/${matterId2}/time-entries`);
    const entries: Array<Record<string, unknown>> = get.body.entries ?? get.body;

    const namedEntry = entries.find((e) => (e.description as string).includes("Named entry Siti"));
    expect(namedEntry).toBeTruthy();
    expect(parseFloat(namedEntry!.rate_usd as string)).toBeCloseTo(800, 1);

    // General-level entries still at 450 (from previous test)
    const generalEntry = entries.find((e) => (e.description as string).includes("General level entry"));
    expect(parseFloat(generalEntry!.rate_usd as string)).toBeCloseTo(450, 1);

    const fallbackEntry = entries.find((e) => (e.description as string).includes("Fallback level entry"));
    expect(parseFloat(fallbackEntry!.rate_usd as string)).toBeCloseTo(450, 1);

    // Area entry still at 550
    const areaEntry = entries.find((e) => (e.description as string).includes("Area level entry"));
    expect(parseFloat(areaEntry!.rate_usd as string)).toBeCloseTo(550, 1);
  });

  // ── DELETE propagation ───────────────────────────────────────────────────

  it("DELETE named card → named entry nullified; other entries untouched", async () => {
    const del = await sess.agent.delete(`/api/crim/matters/billing/rate-cards/${namedCardId}`);
    expect(del.status, JSON.stringify(del.body)).toBe(200);
    expect(del.body.success).toBe(true);

    const get = await sess.agent.get(`/api/crim/matters/${matterId2}/time-entries`);
    const entries: Array<Record<string, unknown>> = get.body.entries ?? get.body;

    const namedEntry = entries.find((e) => (e.description as string).includes("Named entry Siti"));
    expect(namedEntry).toBeTruthy();
    expect(namedEntry!.rate_usd).toBeNull();
    expect(namedEntry!.rate_source).toBe("default");
    expect(namedEntry!.rate_card_id).toBeNull();

    // General-level entries unchanged (keyed to generalCardId, not namedCardId)
    const generalEntry = entries.find((e) => (e.description as string).includes("General level entry"));
    expect(parseFloat(generalEntry!.rate_usd as string)).toBeCloseTo(450, 1);
    expect(generalEntry!.rate_card_id).toBe(generalCardId);

    // Area entry unchanged
    const areaEntry = entries.find((e) => (e.description as string).includes("Area level entry"));
    expect(parseFloat(areaEntry!.rate_usd as string)).toBeCloseTo(550, 1);
    expect(areaEntry!.rate_card_id).toBe(areaCardId);

    // Manual entry unchanged
    const manualEntry = entries.find((e) => (e.description as string).includes("Manual rate entry"));
    expect(parseFloat(manualEntry!.rate_usd as string)).toBeCloseTo(999, 1);
  });

  it("DELETE area card → area entry nullified; general entries untouched", async () => {
    const del = await sess.agent.delete(`/api/crim/matters/billing/rate-cards/${areaCardId}`);
    expect(del.status, JSON.stringify(del.body)).toBe(200);

    const get = await sess.agent.get(`/api/crim/matters/${matterId2}/time-entries`);
    const entries: Array<Record<string, unknown>> = get.body.entries ?? get.body;

    const areaEntry = entries.find((e) => (e.description as string).includes("Area level entry"));
    expect(areaEntry).toBeTruthy();
    expect(areaEntry!.rate_usd).toBeNull();
    expect(areaEntry!.rate_source).toBe("default");

    // General-level entries still intact (keyed to generalCardId)
    const generalEntry = entries.find((e) => (e.description as string).includes("General level entry"));
    expect(parseFloat(generalEntry!.rate_usd as string)).toBeCloseTo(450, 1);
    expect(generalEntry!.rate_card_id).toBe(generalCardId);

    const fallbackEntry = entries.find((e) => (e.description as string).includes("Fallback level entry"));
    expect(parseFloat(fallbackEntry!.rate_usd as string)).toBeCloseTo(450, 1);
    expect(fallbackEntry!.rate_card_id).toBe(generalCardId);
  });

  it("DELETE general card → general entries nullified; manual entry untouched", async () => {
    const del = await sess.agent.delete(`/api/crim/matters/billing/rate-cards/${generalCardId}`);
    expect(del.status, JSON.stringify(del.body)).toBe(200);

    const get = await sess.agent.get(`/api/crim/matters/${matterId2}/time-entries`);
    const entries: Array<Record<string, unknown>> = get.body.entries ?? get.body;

    const generalEntry = entries.find((e) => (e.description as string).includes("General level entry"));
    expect(generalEntry!.rate_usd).toBeNull();
    expect(generalEntry!.rate_source).toBe("default");

    const fallbackEntry = entries.find((e) => (e.description as string).includes("Fallback level entry"));
    expect(fallbackEntry!.rate_usd).toBeNull();
    expect(fallbackEntry!.rate_source).toBe("default");

    // Manual entry always untouched
    const manualEntry = entries.find((e) => (e.description as string).includes("Manual rate entry"));
    expect(parseFloat(manualEntry!.rate_usd as string)).toBeCloseTo(999, 1);
    expect(manualEntry!.rate_source).toBe("manual");
    expect(manualEntry!.rate_card_id).toBeNull();
  });
});
