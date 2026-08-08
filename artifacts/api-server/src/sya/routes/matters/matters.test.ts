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

const { default: app } = await import("../../../app");
const { db } = await import("@workspace/db");
const { accessCodesTable, syaMattersTable, syaMatterDeadlinesTable, syaSavedWorkTable } =
  await import("@workspace/db/sya");
const { ensureSyaMatterTables } = await import("./index");

const RUN_ID = `syamatters-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const CODE_A = `TEST-${RUN_ID}-A`;
const CODE_B = `TEST-${RUN_ID}-B`;

const codeIds: number[] = [];

async function loginAgent(code: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/sya/auth/verify").send({ accessCode: code });
  expect(res.status).toBe(200);
  expect(res.body.authenticated).toBe(true);
  return agent;
}

beforeAll(async () => {
  await ensureSyaMatterTables();
  const rows = await db
    .insert(accessCodesTable)
    .values([
      { code: CODE_A, name: `Test lawyer A ${RUN_ID}` },
      { code: CODE_B, name: `Test lawyer B ${RUN_ID}` },
    ])
    .returning();
  for (const r of rows) codeIds.push(r.id);
});

afterAll(async () => {
  if (codeIds.length > 0) {
    await db
      .delete(syaSavedWorkTable)
      .where(inArray(syaSavedWorkTable.ownerId, codeIds));
    await db
      .delete(syaMatterDeadlinesTable)
      .where(inArray(syaMatterDeadlinesTable.ownerId, codeIds));
    await db
      .delete(syaMattersTable)
      .where(inArray(syaMattersTable.ownerId, codeIds));
    await db.delete(accessCodesTable).where(inArray(accessCodesTable.id, codeIds));
  }
});

describe("sya matters authorization", () => {
  it("rejects unauthenticated access to every matters endpoint", async () => {
    const endpoints: Array<[string, string]> = [
      ["get", "/api/sya/matters"],
      ["post", "/api/sya/matters"],
      ["get", "/api/sya/matters/1"],
      ["patch", "/api/sya/matters/1"],
      ["delete", "/api/sya/matters/1"],
      ["get", "/api/sya/matters/1/work"],
      ["post", "/api/sya/matters/1/work"],
      ["get", "/api/sya/matters/1/deadlines"],
      ["post", "/api/sya/matters/1/deadlines"],
      ["post", "/api/sya/matters/1/deadlines/bulk"],
      ["post", "/api/sya/matters/1/deadlines/compute"],
      ["get", "/api/sya/matters/deadline-triggers"],
      ["get", "/api/sya/matters/deadlines/upcoming"],
    ];
    for (const [method, path] of endpoints) {
      const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[
        method
      ](path);
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
    }
  });
});

describe("sya matters end-to-end flow", () => {
  it("creates a matter, files a draft, builds a deadline diary, and enforces ownership", async () => {
    const agentA = await loginAgent(CODE_A);
    const agentB = await loginAgent(CODE_B);

    // 1. Create a matter (as after "Save into a matter file?" → new matter)
    const createRes = await agentA.post("/api/sya/matters").send({
      title: `Siti lwn Ahmad — Tuntutan Nafkah ${RUN_ID}`,
      clientName: "Siti Aminah",
      actingFor: "Plaintif",
      plaintiff: "Siti Aminah",
      defendant: "Ahmad bin Abu",
      matterType: "nafkah",
      court: "Mahkamah Rendah Syariah",
      caseNo: "14600-010-0123-2026",
      claimAmount: "24000",
      notes: `No. Fail: SYA/2026/1234 (${RUN_ID})`,
    });
    expect(createRes.status).toBe(201);
    const matterId = createRes.body.id as number;
    expect(createRes.body.title).toContain("Tuntutan Nafkah");
    expect(createRes.body.matterType).toBe("nafkah");

    // 2. File a generated draft into the matter
    const workRes = await agentA.post(`/api/sya/matters/${matterId}/work`).send({
      kind: "draft",
      title: "Penyata Tuntutan Nafkah",
      content: `DALAM MAHKAMAH RENDAH SYARIAH ... (draf ujian ${RUN_ID})`,
    });
    expect(workRes.status).toBe(201);
    expect(workRes.body.matterId).toBe(matterId);

    const workList = await agentA.get(`/api/sya/matters/${matterId}/work`);
    expect(workList.status).toBe(200);
    expect(workList.body).toHaveLength(1);
    expect(workList.body[0].title).toBe("Penyata Tuntutan Nafkah");

    // 3. Deadline triggers + compute + bulk add
    const triggers = await agentA.get("/api/sya/matters/deadline-triggers");
    expect(triggers.status).toBe(200);
    const saman = triggers.body.find(
      (t: { trigger: string }) => t.trigger === "saman_diserah",
    );
    expect(saman).toBeTruthy();

    const computed = await agentA
      .post(`/api/sya/matters/${matterId}/deadlines/compute`)
      .send({ trigger: "saman_diserah", triggerDate: "2026-08-03" });
    expect(computed.status).toBe(200);
    expect(computed.body.length).toBeGreaterThanOrEqual(2);
    expect(computed.body[0].dueDate).toBeTruthy();

    const bulk = await agentA
      .post(`/api/sya/matters/${matterId}/deadlines/bulk`)
      .send({ deadlines: computed.body });
    expect(bulk.status).toBe(201);
    expect(bulk.body.length).toBe(computed.body.length);

    // Manual deadline too
    const manual = await agentA
      .post(`/api/sya/matters/${matterId}/deadlines`)
      .send({ title: "Sebutan kes", dueDate: "2026-09-15T01:00:00.000Z" });
    expect(manual.status).toBe(201);

    // 4. Matter detail includes deadlines
    const detail = await agentA.get(`/api/sya/matters/${matterId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.deadlines.length).toBe(computed.body.length + 1);

    // Upcoming deadlines endpoint sees them
    const upcoming = await agentA.get(
      "/api/sya/matters/deadlines/upcoming?days=365",
    );
    expect(upcoming.status).toBe(200);
    expect(
      upcoming.body.some((d: { matterId: number }) => d.matterId === matterId),
    ).toBe(true);

    // 5. Mark a deadline done, then delete another
    const dlId = detail.body.deadlines[0].id as number;
    const done = await agentA
      .patch(`/api/sya/matters/${matterId}/deadlines/${dlId}`)
      .send({ status: "done" });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("done");

    // 6. Ownership: user B must not see or touch A's matter
    const bList = await agentB.get("/api/sya/matters");
    expect(bList.status).toBe(200);
    expect(bList.body.some((m: { id: number }) => m.id === matterId)).toBe(false);
    expect((await agentB.get(`/api/sya/matters/${matterId}`)).status).toBe(404);
    expect(
      (
        await agentB
          .patch(`/api/sya/matters/${matterId}`)
          .send({ title: "hijack" })
      ).status,
    ).toBe(404);
    expect(
      (
        await agentB
          .post(`/api/sya/matters/${matterId}/work`)
          .send({ title: "x", content: "y" })
      ).status,
    ).toBe(404);
    expect((await agentB.delete(`/api/sya/matters/${matterId}`)).status).toBe(404);

    // 7. Update and delete own matter (cascade cleans children)
    const patched = await agentA
      .patch(`/api/sya/matters/${matterId}`)
      .send({ status: "closed" });
    expect(patched.status).toBe(200);
    expect(patched.body.status).toBe("closed");

    const del = await agentA.delete(`/api/sya/matters/${matterId}`);
    expect(del.status).toBe(200);
    const [orphan] = await db
      .select()
      .from(syaSavedWorkTable)
      .where(eq(syaSavedWorkTable.matterId, matterId));
    expect(orphan).toBeUndefined();
  });

  it("validates input", async () => {
    const agentA = await loginAgent(CODE_A);
    expect((await agentA.post("/api/sya/matters").send({})).status).toBe(400);
    const m = await agentA
      .post("/api/sya/matters")
      .send({ title: `validation ${RUN_ID}` });
    expect(m.status).toBe(201);
    const id = m.body.id as number;
    expect(
      (await agentA.post(`/api/sya/matters/${id}/work`).send({ title: "no content" }))
        .status,
    ).toBe(400);
    expect(
      (
        await agentA
          .post(`/api/sya/matters/${id}/deadlines`)
          .send({ title: "bad date", dueDate: "not-a-date" })
      ).status,
    ).toBe(400);
    expect((await agentA.get("/api/sya/matters/abc")).status).toBe(400);
    expect((await agentA.delete(`/api/sya/matters/${id}`)).status).toBe(200);
  });
});
