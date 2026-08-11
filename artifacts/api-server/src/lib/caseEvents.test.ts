import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { inArray } from "drizzle-orm";

const { db, pool } = await import("@workspace/db");
const { accessCodesTable, accMatters } = await import("@workspace/db/schema");
const { buildCaseEventsRouter, recordCaseEvent, ensureCaseEventsTable } = await import(
  "./caseEvents"
);

const RUN_ID = `caseevents-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

const codeIds: number[] = [];
const matterIds: number[] = [];
// owner_key for the acc portal is String(access_code_id) (see caseOwnership.ts)
let ownerA = "";
let ownerB = "";
let matterA = 0;
let matterB = 0;

// Two tiny apps: one authenticated as owner A, one as owner B. Each mounts the
// shared events router the same way the orchestrator will, with mergeParams so
// :matterId flows through from the parent route.
function makeApp(getOwner: () => string | null) {
  const app = express();
  app.use(express.json());
  const parent = express.Router();
  parent.use("/matters/:matterId/events", buildCaseEventsRouter("acc", () => getOwner()));
  app.use("/api/accident", parent);
  return app;
}

// Unauthenticated app: getOwnerKey returns null → routes must 401.
function makeAnonApp() {
  return makeApp(() => null);
}

beforeAll(async () => {
  await ensureCaseEventsTable();
  const codes = await db
    .insert(accessCodesTable)
    .values([
      { code: `TEST-${RUN_ID}-A`.toUpperCase(), label: `A ${RUN_ID}`, maxUsers: 5 },
      { code: `TEST-${RUN_ID}-B`.toUpperCase(), label: `B ${RUN_ID}`, maxUsers: 5 },
    ])
    .returning();
  for (const c of codes) codeIds.push(c.id);
  ownerA = String(codes[0].id);
  ownerB = String(codes[1].id);

  const matters = await db
    .insert(accMatters)
    .values([
      { ownerId: codes[0].id, title: `Events matter A ${RUN_ID}`, actingFor: "Plaintiff" },
      { ownerId: codes[1].id, title: `Events matter B ${RUN_ID}`, actingFor: "Plaintiff" },
    ])
    .returning();
  for (const m of matters) matterIds.push(m.id);
  matterA = matters[0].id;
  matterB = matters[1].id;
});

afterAll(async () => {
  if (matterIds.length > 0) {
    await pool.query(`DELETE FROM case_events WHERE matter_id = ANY($1)`, [matterIds]);
    await db.delete(accMatters).where(inArray(accMatters.id, matterIds));
  }
  if (codeIds.length > 0) {
    await db.delete(accessCodesTable).where(inArray(accessCodesTable.id, codeIds));
  }
});

describe("case events authorization", () => {
  it("rejects unauthenticated access to every events endpoint", async () => {
    const app = makeAnonApp();
    const base = `/api/accident/matters/${matterA}/events`;
    const endpoints: Array<[string, string]> = [
      ["get", base],
      ["post", base],
      ["patch", `${base}/1`],
      ["delete", `${base}/1`],
    ];
    for (const [method, path] of endpoints) {
      const res = await (
        request(app) as unknown as Record<string, (p: string) => request.Test>
      )[method](path);
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
    }
  });
});

describe("case events end-to-end flow", () => {
  it("creates, lists (sorted), patches, and deletes events on an owned matter", async () => {
    const appA = makeApp(() => ownerA);
    const base = `/api/accident/matters/${matterA}/events`;

    // Create two events out of chronological order to prove sorting
    const later = await request(appA)
      .post(base)
      .send({ event_date: "2026-03-01", title: `Trial ${RUN_ID}`, kind: "hearing" });
    expect(later.status).toBe(201);
    expect(later.body.kind).toBe("hearing");

    const earlier = await request(appA).post(base).send({
      event_date: "2026-01-15",
      title: `Writ filed ${RUN_ID}`,
      kind: "filing",
      source: "AI Case Analyzer",
      description: "Statement of claim filed",
    });
    expect(earlier.status).toBe(201);
    expect(earlier.body.source).toBe("AI Case Analyzer");

    // List: sorted by event_date asc then created_at
    const list = await request(appA).get(base);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    expect(list.body[0].id).toBe(earlier.body.id);
    expect(list.body[1].id).toBe(later.body.id);

    // Patch
    const patched = await request(appA)
      .patch(`${base}/${earlier.body.id}`)
      .send({ title: `Writ & SOC filed ${RUN_ID}`, kind: "correspondence" });
    expect(patched.status).toBe(200);
    expect(patched.body.title).toBe(`Writ & SOC filed ${RUN_ID}`);
    expect(patched.body.kind).toBe("correspondence");

    // Delete
    const del = await request(appA).delete(`${base}/${later.body.id}`);
    expect(del.status).toBe(200);
    const afterDel = await request(appA).get(base);
    expect(afterDel.body).toHaveLength(1);
  });

  it("validates input", async () => {
    const appA = makeApp(() => ownerA);
    const base = `/api/accident/matters/${matterA}/events`;

    expect((await request(appA).post(base).send({})).status).toBe(400);
    expect(
      (await request(appA).post(base).send({ title: "no date/kind" })).status,
    ).toBe(400);
    expect(
      (
        await request(appA)
          .post(base)
          .send({ title: "bad date", event_date: "01/2026", kind: "note" })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(appA)
          .post(base)
          .send({ title: "bad kind", event_date: "2026-01-01", kind: "banana" })
      ).status,
    ).toBe(400);
    // valid kind list is enforced
    const ok = await request(appA)
      .post(base)
      .send({ title: `payment ${RUN_ID}`, event_date: "2026-02-02", kind: "payment" });
    expect(ok.status).toBe(201);
    await request(appA).delete(`${base}/${ok.body.id}`);

    expect(
      (await request(appA).get(`/api/accident/matters/abc/events`)).status,
    ).toBe(400);
  });

  it("rejects writes to a matter the caller does not own", async () => {
    const appA = makeApp(() => ownerA);
    // owner A tries to write to owner B's matter → 404
    const res = await request(appA)
      .post(`/api/accident/matters/${matterB}/events`)
      .send({ title: "cross-tenant", event_date: "2026-01-01", kind: "note" });
    expect(res.status).toBe(404);
  });

  it("scopes reads by owner_key so tenants never see each other's events", async () => {
    const appA = makeApp(() => ownerA);
    const appB = makeApp(() => ownerB);
    const baseA = `/api/accident/matters/${matterA}/events`;

    const created = await request(appA)
      .post(baseA)
      .send({ title: `scoped ${RUN_ID}`, event_date: "2026-04-04", kind: "note" });
    expect(created.status).toBe(201);

    // B reads A's matter path but is scoped by its own owner_key → no leak
    const bRead = await request(appB).get(baseA);
    expect(bRead.status).toBe(200);
    expect(bRead.body.some((e: { id: number }) => e.id === created.body.id)).toBe(false);

    // B cannot patch or delete A's event either
    expect(
      (await request(appB).patch(`${baseA}/${created.body.id}`).send({ title: "x" }))
        .status,
    ).toBe(404);
    const bDel = await request(appB).delete(`${baseA}/${created.body.id}`);
    expect(bDel.status).toBe(200); // idempotent delete, but scoped → nothing removed
    const stillThere = await request(appA).get(baseA);
    expect(stillThere.body.some((e: { id: number }) => e.id === created.body.id)).toBe(true);
  });
});

describe("recordCaseEvent helper", () => {
  it("logs an event programmatically on an owned matter", async () => {
    const row = await recordCaseEvent("acc", matterA, ownerA, {
      event_date: "2026-05-05",
      title: `programmatic ${RUN_ID}`,
      kind: "saved-work",
      source: "AI Case Analyzer",
    });
    expect(row).toBeTruthy();
    expect(row?.kind).toBe("saved-work");

    const appA = makeApp(() => ownerA);
    const list = await request(appA).get(`/api/accident/matters/${matterA}/events`);
    expect(
      list.body.some((e: { title: string }) => e.title === `programmatic ${RUN_ID}`),
    ).toBe(true);
  });

  it("returns null for cross-tenant matter and invalid input", async () => {
    // owner A writing to owner B's matter → null
    expect(
      await recordCaseEvent("acc", matterB, ownerA, {
        event_date: "2026-05-05",
        title: "cross",
        kind: "note",
      }),
    ).toBeNull();
    // invalid kind
    expect(
      await recordCaseEvent("acc", matterA, ownerA, {
        event_date: "2026-05-05",
        title: "bad kind",
        kind: "banana",
      }),
    ).toBeNull();
    // invalid date
    expect(
      await recordCaseEvent("acc", matterA, ownerA, {
        event_date: "nope",
        title: "bad date",
        kind: "note",
      }),
    ).toBeNull();
  });
});
