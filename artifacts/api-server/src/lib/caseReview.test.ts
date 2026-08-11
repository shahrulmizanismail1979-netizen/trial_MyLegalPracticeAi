import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import { inArray } from "drizzle-orm";

// The app pulls in Clerk middleware for the main admin dashboard; mock it so
// these tests run without Clerk credentials (mirrors accident/matters.test.ts).
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
const { buildCaseReviewRouter } = await import("./caseReview");
const { db, pool } = await import("@workspace/db");
const { accessCodesTable, accessCodeUsageTable, accMatters, accSavedWork } =
  await import("@workspace/db/schema");

// Build a minimal app that reuses the real accident auth + matters routers (so
// we can log in and create real matters), and mounts the case-review router the
// way the orchestrator will — under /api/accident with the same owner-key
// derivation and owner-scoped per-portal fetchers.
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/accident", accidentAuthRouter);
app.use("/api/accident", accidentMattersRouter);
app.use(
  "/api/accident",
  requireMatterTenant as express.RequestHandler,
  buildCaseReviewRouter(
    "acc",
    (req) => {
      try {
        return String(ownerOf(req));
      } catch {
        return null;
      }
    },
    {
      fetchDeadlines: async (matterId, ownerKey) => {
        const ownerId = parseInt(ownerKey, 10);
        const { rows } = await pool.query(
          `SELECT title, due_date, status FROM acc_matter_deadlines
           WHERE matter_id = $1 AND owner_id = $2 ORDER BY due_date`,
          [matterId, ownerId],
        );
        return rows.map((r: { title: string; due_date: Date; status: string }) => ({
          title: r.title,
          due_date: new Date(r.due_date).toISOString().slice(0, 10),
          status: r.status,
        }));
      },
      fetchSavedWork: async (matterId, ownerKey) => {
        const ownerId = parseInt(ownerKey, 10);
        const { rows } = await pool.query(
          `SELECT title, kind, created_at, content FROM acc_saved_work
           WHERE matter_id = $1 AND owner_id = $2 ORDER BY created_at DESC`,
          [matterId, ownerId],
        );
        return rows.map(
          (r: { title: string; kind: string; created_at: Date; content: string }) => ({
            title: r.title,
            kind: r.kind,
            created_at: new Date(r.created_at).toISOString(),
            content: r.content ?? "",
          }),
        );
      },
    },
  ),
);

const RUN_ID = `casereview-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
// verify-code uppercases the submitted code before lookup.
const CODE_A = `TEST-${RUN_ID}-A`.toUpperCase();
const CODE_B = `TEST-${RUN_ID}-B`.toUpperCase();

const codeIds: number[] = [];

async function loginAgent(code: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/accident/auth/verify-code").send({ code });
  expect(res.status).toBe(200);
  expect(res.body.valid).toBe(true);
  return agent;
}

beforeAll(async () => {
  await ensureAccMatterTables();
  const rows = await db
    .insert(accessCodesTable)
    .values([
      { code: CODE_A, label: `Review lawyer A ${RUN_ID}`, maxUsers: 5 },
      { code: CODE_B, label: `Review lawyer B ${RUN_ID}`, maxUsers: 5 },
    ])
    .returning();
  for (const r of rows) codeIds.push(r.id);
});

afterAll(async () => {
  if (codeIds.length > 0) {
    await pool.query(`DELETE FROM case_checklists WHERE owner_key = ANY($1::text[])`, [
      codeIds.map(String),
    ]);
    await pool.query(`DELETE FROM case_time_entries WHERE owner_key = ANY($1::text[])`, [
      codeIds.map(String),
    ]);
    await db.delete(accSavedWork).where(inArray(accSavedWork.ownerId, codeIds));
    await db.delete(accMatters).where(inArray(accMatters.ownerId, codeIds));
    await db
      .delete(accessCodeUsageTable)
      .where(inArray(accessCodeUsageTable.accessCodeId, codeIds));
    await db.delete(accessCodesTable).where(inArray(accessCodesTable.id, codeIds));
  }
});

describe("case review router — auth", () => {
  it("rejects unauthenticated access to context and review", async () => {
    expect((await request(app).get("/api/accident/matters/1/context")).status).toBe(401);
    expect((await request(app).post("/api/accident/matters/1/review")).status).toBe(401);
  });
});

describe("case review router — context assembly + ownership", () => {
  it("assembles full matter context and blocks cross-tenant reads", async () => {
    const agentA = await loginAgent(CODE_A);
    const agentB = await loginAgent(CODE_B);

    // 1. Create a matter and populate shared + per-portal data.
    const createRes = await agentA.post("/api/accident/matters").send({
      title: `Review — Lim v Tan ${RUN_ID}`,
      clientName: "Lim Ah Kow",
      actingFor: "Plaintiff",
      plaintiff: "Lim Ah Kow",
      defendant: "Tan Ah Meng",
      matterType: "running-down",
      court: "Sessions Court Kuala Lumpur",
      caseNo: `BA-A53KJ-9999-${RUN_ID}`,
      notes: `File: MAA/2026/9999 (${RUN_ID})`,
    });
    expect(createRes.status).toBe(201);
    const matterId = createRes.body.id as number;

    // Checklist item (shared table).
    expect(
      (
        await agentA
          .post(`/api/accident/matters/${matterId}/checklist`)
          .send({ item_text: `Serve writ (${RUN_ID})` })
      ).status,
    ).toBe(201);

    // Time entry (shared table).
    expect(
      (
        await agentA
          .post(`/api/accident/matters/${matterId}/time-entries`)
          .send({ description: `Drafting SOC (${RUN_ID})`, minutes: 120 })
      ).status,
    ).toBe(201);

    // Deadline (per-portal table, surfaced via fetchDeadlines callback).
    expect(
      (
        await agentA
          .post(`/api/accident/matters/${matterId}/deadlines`)
          .send({ title: `Case management (${RUN_ID})`, dueDate: "2026-06-15T01:00:00.000Z" })
      ).status,
    ).toBe(201);

    // Saved work (per-portal table, surfaced via fetchSavedWork callback).
    expect(
      (
        await agentA
          .post(`/api/accident/matters/${matterId}/work`)
          .send({
            kind: "demand-letter",
            title: "Letter of Demand",
            content: `LETTER OF DEMAND ... (${RUN_ID}) `.repeat(60),
          })
      ).status,
    ).toBe(201);

    // 2. GET context returns everything, correctly shaped.
    const ctx = await agentA.get(`/api/accident/matters/${matterId}/context`);
    expect(ctx.status).toBe(200);
    expect(ctx.body.matter.id).toBe(matterId);
    expect(ctx.body.matter.title).toContain(RUN_ID);
    expect(ctx.body.currentStage).toBeDefined();
    expect(ctx.body.checklist.some((c: { item_text: string }) => c.item_text.includes(RUN_ID))).toBe(
      true,
    );
    expect(ctx.body.timeSummary.totalMinutes).toBe(120);
    expect(ctx.body.timeSummary.entryCount).toBe(1);
    expect(ctx.body.deadlines.some((d: { title: string }) => d.title.includes(RUN_ID))).toBe(
      true,
    );
    expect(ctx.body.savedWork.length).toBe(1);
    expect(ctx.body.savedWork[0].kind).toBe("demand-letter");
    // Content preview is capped at ~500 chars.
    expect(ctx.body.savedWork[0].content.length).toBeLessThanOrEqual(500);

    // 3. Ownership: B cannot read A's context (404, no leak).
    const bCtx = await agentB.get(`/api/accident/matters/${matterId}/context`);
    expect(bCtx.status).toBe(404);
    const bReview = await agentB.post(`/api/accident/matters/${matterId}/review`);
    expect(bReview.status).toBe(404);

    // 4. Invalid / unknown matter ids.
    expect((await agentA.get("/api/accident/matters/abc/context")).status).toBe(400);
    expect((await agentA.get("/api/accident/matters/99999999/context")).status).toBe(404);

    // Clean up the matter (cascades deadlines; shared rows cleaned in afterAll).
    expect((await agentA.delete(`/api/accident/matters/${matterId}`)).status).toBe(200);
  });
});
