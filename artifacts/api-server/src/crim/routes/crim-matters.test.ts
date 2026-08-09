import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import crypto from "crypto";
import { db, crimAccessCodesTable, crimMatters, crimMatterDeadlines, crimSavedWork } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

// The app pulls in Clerk middleware for the main admin dashboard; mock it so
// these tests run without Clerk credentials.
vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => ({ userId: null }),
  clerkClient: { users: { getUser: async () => Promise.reject(new Error("not found")) } },
}));

const { default: app } = await import("../../app");

const RUN_ID = crypto.randomUUID();

function makeCode(): string {
  return `TEST${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

async function createLoggedInAgent() {
  const code = makeCode();
  const [row] = await db
    .insert(crimAccessCodesTable)
    .values({ code, label: `matter-test ${RUN_ID}`, isActive: true, tier: "full" })
    .returning();
  const agent = request.agent(app);
  const res = await agent.post("/api/crim/auth/verify").send({ accessCode: code });
  expect(res.status).toBe(200);
  expect(res.body.authenticated).toBe(true);
  return { agent, codeId: row.id };
}

let a: Awaited<ReturnType<typeof createLoggedInAgent>>;
let b: Awaited<ReturnType<typeof createLoggedInAgent>>;
const codeIds: number[] = [];

beforeAll(async () => {
  a = await createLoggedInAgent();
  b = await createLoggedInAgent();
  codeIds.push(a.codeId, b.codeId);
});

afterAll(async () => {
  // Cascades remove matters, deadlines and saved work owned by the test codes.
  await db.delete(crimAccessCodesTable).where(inArray(crimAccessCodesTable.id, codeIds));
});

describe("crim matters — auth", () => {
  it("rejects unauthenticated access to matters and saved work", async () => {
    for (const path of ["/api/crim/matters", "/api/crim/saved-work"]) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(401);
    }
  });
});

describe("crim matters — draft → file into matter → reopen → see document", () => {
  let matterId: number;

  it("creates a matter with an auto file ref", async () => {
    const res = await a.agent.post("/api/crim/matters").send({
      title: `PP v Ahmad ${RUN_ID}`,
      fileRef: "MLA/2026/1234",
      stage: "trial",
      charge: "s.39B(1)(a) DDA 1952",
    });
    expect(res.status).toBe(201);
    expect(res.body.fileRef).toBe("MLA/2026/1234");
    matterId = res.body.id;
  });

  it("files a completed AI draft into the matter", async () => {
    const res = await a.agent.post("/api/crim/saved-work").send({
      kind: "draft",
      title: "Bail Application (Permohonan Jaminan)",
      matterId,
      content: "DALAM MAHKAMAH SESYEN ... draft body",
    });
    expect(res.status).toBe(201);
    expect(res.body.matterId).toBe(matterId);
  });

  it("reopening the matter shows the filed document", async () => {
    const detail = await a.agent.get(`/api/crim/matters/${matterId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.title).toContain("PP v Ahmad");

    const work = await a.agent.get(`/api/crim/matters/${matterId}/work`);
    expect(work.status).toBe(200);
    expect(work.body).toHaveLength(1);
    expect(work.body[0].title).toBe("Bail Application (Permohonan Jaminan)");
    expect(work.body[0].content).toContain("draft body");
  });

  it("supports the criminal deadline diary (manual + computed)", async () => {
    const manual = await a.agent.post(`/api/crim/matters/${matterId}/deadlines`).send({
      title: "File Notice of Appeal",
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
      category: "appeal",
      basis: "s.307(1) CPC",
    });
    expect(manual.status).toBe(201);

    const preview = await a.agent
      .post(`/api/crim/matters/${matterId}/deadlines/compute`)
      .send({ trigger: "conviction_subordinate", triggerDate: new Date().toISOString() });
    expect(preview.status).toBe(200);
    expect(preview.body.length).toBeGreaterThan(0);
    expect(preview.body[0]).toHaveProperty("dueDate");
    expect(preview.body.map((p: { category: string }) => p.category)).toContain("appeal");

    const bulk = await a.agent
      .post(`/api/crim/matters/${matterId}/deadlines/bulk`)
      .send({ deadlines: preview.body });
    expect(bulk.status).toBe(201);

    const list = await a.agent.get(`/api/crim/matters/${matterId}/deadlines`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1 + preview.body.length);

    const upcoming = await a.agent.get("/api/crim/matters/deadlines/upcoming?days=30");
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.some((d: { matterId: number }) => d.matterId === matterId)).toBe(true);
  });

  it("exposes criminal-procedure triggers (not civil ROC)", async () => {
    const res = await a.agent.get("/api/crim/matters/deadline-triggers");
    expect(res.status).toBe(200);
    const triggers = res.body.map((t: { trigger: string }) => t.trigger);
    expect(triggers).toContain("arrest");
    expect(triggers).toContain("charge");
    expect(triggers).toContain("conviction_subordinate");
    expect(triggers).not.toContain("writ_served");
  });

  it("enforces ownership: a foreign matter id is a 404 everywhere", async () => {
    const detail = await b.agent.get(`/api/crim/matters/${matterId}`);
    expect(detail.status).toBe(404);

    const work = await b.agent.get(`/api/crim/matters/${matterId}/work`);
    expect(work.status).toBe(404);

    const attach = await b.agent.post("/api/crim/saved-work").send({
      kind: "draft",
      title: "cross-tenant attach attempt",
      matterId,
      content: "x",
    });
    expect(attach.status).toBe(404);

    const deadline = await b.agent.post(`/api/crim/matters/${matterId}/deadlines`).send({
      title: "intrusion",
      dueDate: new Date().toISOString(),
    });
    expect(deadline.status).toBe(404);

    const patch = await b.agent.patch(`/api/crim/matters/${matterId}`).send({ title: "hijack" });
    expect(patch.status).toBe(404);

    const del = await b.agent.delete(`/api/crim/matters/${matterId}`);
    expect(del.status).toBe(404);

    // And listing shows nothing of tenant A's.
    const list = await b.agent.get("/api/crim/matters");
    expect(list.status).toBe(200);
    expect(list.body.some((m: { id: number }) => m.id === matterId)).toBe(false);
  });

  it("saved work is tenant-scoped too", async () => {
    const mine = await a.agent.get("/api/crim/saved-work");
    expect(mine.status).toBe(200);
    expect(mine.body.length).toBe(1);
    const workId = mine.body[0].id;

    const foreign = await b.agent.get(`/api/crim/saved-work/${workId}`);
    expect(foreign.status).toBe(404);
    const foreignPatch = await b.agent.patch(`/api/crim/saved-work/${workId}`).send({ title: "steal" });
    expect(foreignPatch.status).toBe(404);
    const foreignDel = await b.agent.delete(`/api/crim/saved-work/${workId}`);
    expect(foreignDel.status).toBe(404);
  });

  it("deleting the matter cascades its deadlines and keeps saved work retrievable", async () => {
    const del = await a.agent.delete(`/api/crim/matters/${matterId}`);
    expect(del.status).toBe(200);
    const gone = await a.agent.get(`/api/crim/matters/${matterId}`);
    expect(gone.status).toBe(404);
    const deadlines = await db
      .select()
      .from(crimMatterDeadlines)
      .where(eq(crimMatterDeadlines.matterId, matterId));
    expect(deadlines).toHaveLength(0);
    // Saved work rows are not FK-cascaded (matterId is a soft link) and remain
    // in the tenant's saved-work list.
    const work = await a.agent.get("/api/crim/saved-work");
    expect(work.status).toBe(200);
    expect(work.body.length).toBe(1);
  });
});
