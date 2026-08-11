import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { inArray } from "drizzle-orm";

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

const { default: accidentAuthRouter } = await import("../routes/accident");
const { default: accidentMattersRouter, ensureAccMatterTables } = await import(
  "../accident/matters"
);
const { requireMatterTenant, ownerOf } = await import("../accident/matterAuth");
const { buildCaseBriefingRouter } = await import("./caseBriefing");
const { db, pool } = await import("@workspace/db");
const { accessCodesTable, accessCodeUsageTable, accMatters } = await import(
  "@workspace/db/schema"
);

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/accident", accidentAuthRouter);
app.use("/api/accident", accidentMattersRouter);
app.use(
  "/api/accident",
  requireMatterTenant as express.RequestHandler,
  buildCaseBriefingRouter("acc", (req) => {
    try {
      return String(ownerOf(req));
    } catch {
      return null;
    }
  }),
);

const RUN_ID = `brief-${Date.now()}`;
const CODE_A = `TEST-${RUN_ID}-A`.toUpperCase();
const CODE_B = `TEST-${RUN_ID}-B`.toUpperCase();
const createdCodeIds: number[] = [];
const createdMatterIds: number[] = [];

async function loginWith(code: string): Promise<string> {
  const [row] = await db
    .insert(accessCodesTable)
    .values({ code, label: `Briefing ${RUN_ID}`, maxUsers: 5 })
    .returning();
  createdCodeIds.push(row.id);
  const res = await request(app)
    .post("/api/accident/auth/verify-code")
    .send({ code });
  expect(res.status).toBe(200);
  const cookie = res.headers["set-cookie"]?.[0]?.split(";")[0];
  expect(cookie).toBeTruthy();
  return cookie as string;
}

describe("case briefing summary", () => {
  let cookieA = "";
  let cookieB = "";
  let matterA = 0;

  beforeAll(async () => {
    await ensureAccMatterTables();
    cookieA = await loginWith(CODE_A);
    cookieB = await loginWith(CODE_B);
    const created = await request(app)
      .post("/api/accident/matters")
      .set("Cookie", cookieA)
      .send({ title: `${RUN_ID} matter`, matterType: "personal_injury" });
    expect(created.status).toBe(201);
    matterA = created.body.id;
    createdMatterIds.push(matterA);
    const dl = await request(app)
      .post(`/api/accident/matters/${matterA}/deadlines`)
      .set("Cookie", cookieA)
      .send({ title: "File writ", dueDate: "2030-01-15" });
    expect(dl.status).toBe(201);
  });

  afterAll(async () => {
    if (createdMatterIds.length) {
      await pool.query(`DELETE FROM acc_matter_deadlines WHERE matter_id = ANY($1)`, [
        createdMatterIds,
      ]);
      await db.delete(accMatters).where(inArray(accMatters.id, createdMatterIds));
    }
    if (createdCodeIds.length) {
      await db
        .delete(accessCodeUsageTable)
        .where(inArray(accessCodeUsageTable.accessCodeId, createdCodeIds));
      await db.delete(accessCodesTable).where(inArray(accessCodesTable.id, createdCodeIds));
    }
  });

  it("returns the owner's matters with progress and a derived next step", async () => {
    const res = await request(app)
      .get("/api/accident/matters/briefing/summary")
      .set("Cookie", cookieA);
    expect(res.status).toBe(200);
    expect(res.body.stages.length).toBeGreaterThan(0);
    const m = res.body.matters.find((x: { id: number }) => x.id === matterA);
    expect(m).toBeTruthy();
    expect(m.next_deadline).toEqual({ title: "File writ", due_date: "2030-01-15" });
    expect(m.next_step).toEqual({
      source: "deadline",
      label: "File writ",
      due_date: "2030-01-15",
    });
    expect(m.stage_count).toBe(res.body.stages.length);
  });

  it("never shows another tenant's matters", async () => {
    const res = await request(app)
      .get("/api/accident/matters/briefing/summary")
      .set("Cookie", cookieB);
    expect(res.status).toBe(200);
    const ids = res.body.matters.map((x: { id: number }) => x.id);
    expect(ids).not.toContain(matterA);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/accident/matters/briefing/summary");
    expect(res.status).toBe(401);
  });
});
