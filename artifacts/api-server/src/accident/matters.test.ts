import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";

// The app pulls in Clerk middleware for the main admin dashboard; mock it so
// these tests run without Clerk credentials.
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
const {
  accessCodesTable,
  accessCodeUsageTable,
  accMatters,
  accMatterDeadlines,
  accSavedWork,
} = await import("@workspace/db/schema");
const { ensureAccMatterTables } = await import("./matters");

const RUN_ID = `accmatters-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
// verify-code uppercases the submitted code before lookup, so stored codes
// must be uppercase to match.
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
      { code: CODE_A, label: `Test lawyer A ${RUN_ID}`, maxUsers: 5 },
      { code: CODE_B, label: `Test lawyer B ${RUN_ID}`, maxUsers: 5 },
    ])
    .returning();
  for (const r of rows) codeIds.push(r.id);
});

afterAll(async () => {
  if (codeIds.length > 0) {
    await db.delete(accSavedWork).where(inArray(accSavedWork.ownerId, codeIds));
    await db
      .delete(accMatterDeadlines)
      .where(inArray(accMatterDeadlines.ownerId, codeIds));
    await db.delete(accMatters).where(inArray(accMatters.ownerId, codeIds));
    await db
      .delete(accessCodeUsageTable)
      .where(inArray(accessCodeUsageTable.accessCodeId, codeIds));
    await db.delete(accessCodesTable).where(inArray(accessCodesTable.id, codeIds));
  }
});

describe("acc matters authorization", () => {
  it("rejects unauthenticated access to every matters endpoint", async () => {
    const endpoints: Array<[string, string]> = [
      ["get", "/api/accident/matters"],
      ["post", "/api/accident/matters"],
      ["get", "/api/accident/matters/1"],
      ["patch", "/api/accident/matters/1"],
      ["delete", "/api/accident/matters/1"],
      ["get", "/api/accident/matters/1/work"],
      ["post", "/api/accident/matters/1/work"],
      ["get", "/api/accident/matters/1/deadlines"],
      ["post", "/api/accident/matters/1/deadlines"],
      ["post", "/api/accident/matters/1/deadlines/bulk"],
      ["post", "/api/accident/matters/1/deadlines/compute"],
      ["get", "/api/accident/matters/deadline-triggers"],
      ["get", "/api/accident/matters/deadlines/upcoming"],
      ["get", "/api/accident/saved-work"],
      ["post", "/api/accident/saved-work"],
    ];
    for (const [method, path] of endpoints) {
      const res = await (
        request(app) as unknown as Record<string, (p: string) => request.Test>
      )[method](path);
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
    }
  });
});

describe("acc matters end-to-end flow", () => {
  it("creates a matter, files a draft, builds a deadline diary, and enforces ownership", async () => {
    const agentA = await loginAgent(CODE_A);
    const agentB = await loginAgent(CODE_B);

    // 1. Create a matter
    const createRes = await agentA.post("/api/accident/matters").send({
      title: `Lim v Tan — Running Down ${RUN_ID}`,
      clientName: "Lim Ah Kow",
      actingFor: "Plaintiff",
      plaintiff: "Lim Ah Kow",
      defendant: "Tan Ah Meng",
      matterType: "running-down",
      court: "Sessions Court Kuala Lumpur",
      caseNo: "BA-A53KJ-1234-2026",
      claimAmount: "150000",
      notes: `File: MAA/2026/1234 (${RUN_ID})`,
    });
    expect(createRes.status).toBe(201);
    const matterId = createRes.body.id as number;
    expect(createRes.body.matterType).toBe("running-down");

    // 2. File a generated draft into the matter
    const workRes = await agentA.post(`/api/accident/matters/${matterId}/work`).send({
      kind: "demand-letter",
      title: "Letter of Demand",
      content: `LETTER OF DEMAND ... (draft ${RUN_ID})`,
    });
    expect(workRes.status).toBe(201);
    expect(workRes.body.matterId).toBe(matterId);

    const workList = await agentA.get(`/api/accident/matters/${matterId}/work`);
    expect(workList.status).toBe(200);
    expect(workList.body).toHaveLength(1);
    expect(workList.body[0].title).toBe("Letter of Demand");

    // 3. Deadline triggers + compute + bulk add
    const triggers = await agentA.get("/api/accident/matters/deadline-triggers");
    expect(triggers.status).toBe(200);
    const accident = triggers.body.find(
      (t: { trigger: string }) => t.trigger === "accident",
    );
    expect(accident).toBeTruthy();

    const computed = await agentA
      .post(`/api/accident/matters/${matterId}/deadlines/compute`)
      .send({ trigger: "accident", triggerDate: "2026-01-05" });
    expect(computed.status).toBe(200);
    expect(computed.body.length).toBeGreaterThanOrEqual(2);
    expect(computed.body[0].dueDate).toBeTruthy();

    const bulk = await agentA
      .post(`/api/accident/matters/${matterId}/deadlines/bulk`)
      .send({ deadlines: computed.body });
    expect(bulk.status).toBe(201);
    expect(bulk.body.length).toBe(computed.body.length);

    // Manual deadline too
    const manual = await agentA
      .post(`/api/accident/matters/${matterId}/deadlines`)
      .send({ title: "Case management", dueDate: "2026-06-15T01:00:00.000Z" });
    expect(manual.status).toBe(201);

    // 4. Matter detail includes deadlines
    const detail = await agentA.get(`/api/accident/matters/${matterId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.deadlines.length).toBe(computed.body.length + 1);

    // Upcoming deadlines endpoint sees pending ones
    const upcoming = await agentA.get(
      "/api/accident/matters/deadlines/upcoming?days=365",
    );
    expect(upcoming.status).toBe(200);

    // 5. Mark a deadline done
    const dlId = detail.body.deadlines[0].id as number;
    const done = await agentA
      .patch(`/api/accident/matters/${matterId}/deadlines/${dlId}`)
      .send({ status: "done" });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("done");

    // 6. Ownership: user B must not see or touch A's matter
    const bList = await agentB.get("/api/accident/matters");
    expect(bList.status).toBe(200);
    expect(bList.body.some((m: { id: number }) => m.id === matterId)).toBe(false);
    expect((await agentB.get(`/api/accident/matters/${matterId}`)).status).toBe(404);
    expect(
      (
        await agentB
          .patch(`/api/accident/matters/${matterId}`)
          .send({ title: "hijack" })
      ).status,
    ).toBe(404);
    expect(
      (
        await agentB
          .post(`/api/accident/matters/${matterId}/work`)
          .send({ title: "x", content: "y" })
      ).status,
    ).toBe(404);
    expect((await agentB.delete(`/api/accident/matters/${matterId}`)).status).toBe(
      404,
    );
    // B cannot attach standalone saved work to A's matter
    const bAttach = await agentB.post("/api/accident/saved-work").send({
      kind: "note",
      title: "cross-tenant",
      content: "x",
      matterId,
    });
    expect(bAttach.status).toBe(404);

    // 7. Update and delete own matter (cascade cleans children)
    const patched = await agentA
      .patch(`/api/accident/matters/${matterId}`)
      .send({ status: "closed" });
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe("closed");

    const del = await agentA.delete(`/api/accident/matters/${matterId}`);
    expect(del.status).toBe(200);
    const [orphan] = await db
      .select()
      .from(accSavedWork)
      .where(eq(accSavedWork.matterId, matterId));
    // saved_work.matter_id is a soft link (no cascade), so the row survives but
    // its matter is gone; deadlines cascade-delete.
    const [deadlineOrphan] = await db
      .select()
      .from(accMatterDeadlines)
      .where(eq(accMatterDeadlines.matterId, matterId));
    expect(deadlineOrphan).toBeUndefined();
    // Clean up the orphaned saved-work row explicitly (afterAll also covers it).
    if (orphan) {
      await db.delete(accSavedWork).where(eq(accSavedWork.id, orphan.id));
    }
  });

  it("validates input", async () => {
    const agentA = await loginAgent(CODE_A);
    expect((await agentA.post("/api/accident/matters").send({})).status).toBe(400);
    const m = await agentA
      .post("/api/accident/matters")
      .send({ title: `validation ${RUN_ID}` });
    expect(m.status).toBe(201);
    const id = m.body.id as number;
    expect(
      (await agentA.post(`/api/accident/matters/${id}/work`).send({ title: "no content" }))
        .status,
    ).toBe(400);
    expect(
      (
        await agentA
          .post(`/api/accident/matters/${id}/deadlines`)
          .send({ title: "bad date", dueDate: "not-a-date" })
      ).status,
    ).toBe(400);
    expect((await agentA.get("/api/accident/matters/abc")).status).toBe(400);
    expect((await agentA.delete(`/api/accident/matters/${id}`)).status).toBe(200);
  });
});

describe("acc matters case-intelligence routes", () => {
  it("adds checklist items and time entries on an owned matter and blocks cross-tenant access", async () => {
    const agentA = await loginAgent(CODE_A);
    const agentB = await loginAgent(CODE_B);

    const created = await agentA.post("/api/accident/matters").send({
      title: `Intelligence matter ${RUN_ID}`,
      actingFor: "Plaintiff",
    });
    expect(created.status).toBe(201);
    const matterId = created.body.id as number;

    // ── Checklist: create a custom item on the owned matter ──────────────────
    const checklistRes = await agentA
      .post(`/api/accident/matters/${matterId}/checklist`)
      .send({ item_text: `File police report copy (${RUN_ID})` });
    expect(checklistRes.status).toBe(201);
    expect(checklistRes.body.item_text).toBe(`File police report copy (${RUN_ID})`);

    const checklistList = await agentA.get(
      `/api/accident/matters/${matterId}/checklist`,
    );
    expect(checklistList.status).toBe(200);
    expect(
      checklistList.body.some(
        (c: { id: number }) => c.id === checklistRes.body.id,
      ),
    ).toBe(true);

    // ── Time entry: log time on the owned matter ─────────────────────────────
    const timeRes = await agentA
      .post(`/api/accident/matters/${matterId}/time-entries`)
      .send({ description: `Drafting statement of claim (${RUN_ID})`, minutes: 90 });
    expect(timeRes.status).toBe(201);
    expect(timeRes.body.minutes).toBe(90);

    const timeList = await agentA.get(
      `/api/accident/matters/${matterId}/time-entries`,
    );
    expect(timeList.status).toBe(200);
    expect(
      timeList.body.entries.some((e: { id: number }) => e.id === timeRes.body.id),
    ).toBe(true);

    // ── Cross-tenant: owner B must not write A's intelligence data (404), and
    // reads are scoped by owner_key so B never sees A's rows. ────────────────
    expect(
      (
        await agentB
          .post(`/api/accident/matters/${matterId}/checklist`)
          .send({ item_text: "cross-tenant checklist" })
      ).status,
    ).toBe(404);
    expect(
      (
        await agentB
          .post(`/api/accident/matters/${matterId}/time-entries`)
          .send({ description: "cross-tenant time", minutes: 30 })
      ).status,
    ).toBe(404);
    // GET routes are owner-scoped in SQL: B gets a 200 with no leaked rows.
    const bChecklist = await agentB.get(
      `/api/accident/matters/${matterId}/checklist`,
    );
    expect(bChecklist.status).toBe(200);
    expect(
      bChecklist.body.some((c: { id: number }) => c.id === checklistRes.body.id),
    ).toBe(false);
    const bTime = await agentB.get(
      `/api/accident/matters/${matterId}/time-entries`,
    );
    expect(bTime.status).toBe(200);
    expect(
      bTime.body.entries.some((e: { id: number }) => e.id === timeRes.body.id),
    ).toBe(false);

    // Clean up
    expect((await agentA.delete(`/api/accident/matters/${matterId}`)).status).toBe(
      200,
    );
  });
});
