import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void): void => next(),
  getAuth: () => ({ userId: null }),
  clerkClient: { users: { getUser: async () => Promise.reject(new Error("not found")) } },
}));

const { default: app } = await import("../../app");
const { db, litAccessCodes, litMatters } = await import("@workspace/db");
const { inArray } = await import("drizzle-orm");
const { ensureMatterPreparationSchema } = await import("../lib/ensureMatterPreparationSchema");

const runId = randomUUID().slice(0, 8).toUpperCase();
const codeA = `TEST-PREP-A-${runId}`;
const codeB = `TEST-PREP-B-${runId}`;
let codeIds: number[] = [];
let matterId = 0;

async function login(code: string): Promise<request.Agent> {
  const agent = request.agent(app);
  expect((await agent.post("/api/lit/auth/login").send({ password: code })).status).toBe(200);
  return agent;
}

beforeAll(async () => {
  await ensureMatterPreparationSchema();
  const codes = await db.insert(litAccessCodes).values([
    { code: codeA, recipientName: "Preparation A", recipientEmail: `preparation-a-${runId}@test.invalid`, status: "active" },
    { code: codeB, recipientName: "Preparation B", recipientEmail: `preparation-b-${runId}@test.invalid`, status: "active" },
  ]).returning({ id: litAccessCodes.id });
  codeIds = codes.map((row) => row.id);
  const [matter] = await db.insert(litMatters)
    .values({ accessCodeId: codeIds[0]!, title: `Preparation matter ${runId}`, notes: "Original matter notes" })
    .returning({ id: litMatters.id });
  matterId = matter!.id;
});

afterAll(async () => {
  if (codeIds.length) {
    await db.delete(litMatters).where(inArray(litMatters.accessCodeId, codeIds));
    await db.delete(litAccessCodes).where(inArray(litAccessCodes.id, codeIds));
  }
});

describe("lit matter preparation persistence", () => {
  it("round-trips server-side preparation state without changing matter data", async () => {
    const agent = await login(codeA);
    const initial = await agent.get(`/api/lit/matters/${matterId}/preparation`);
    expect(initial.status).toBe(200);
    expect(initial.body).toMatchObject({ issues: "", filingReadiness: {}, benchmarks: [] });

    const saved = await agent.patch(`/api/lit/matters/${matterId}/preparation`).send({
      issues: "Whether the duty was breached",
      evidence: "Witness statement and signed contract",
      relief: "Damages, interest and costs",
      filingReadiness: { "0": true },
      benchmarks: [{
        id: 1,
        caseName: "Example v Authority",
        citation: "[2025] 1 MLJ 1",
        proposition: "The pleaded duty must be proved.",
        pinpoint: "[34]",
        sourceUrl: "https://example.test/judgment",
      }],
      practiceChecklists: { debt: { "0": true } },
      causePaperPacks: { debt: { "65": true } },
    });
    expect(saved.status).toBe(200);
    expect(saved.body.issues).toBe("Whether the duty was breached");
    expect(saved.body.benchmarks).toHaveLength(1);

    const reloaded = await agent.get(`/api/lit/matters/${matterId}/preparation`);
    expect(reloaded.status).toBe(200);
    expect(reloaded.body).toEqual(saved.body);
    const matter = await agent.get(`/api/lit/matters/${matterId}`);
    expect(matter.body).toMatchObject({ title: `Preparation matter ${runId}`, notes: "Original matter notes" });
  });

  it("does not expose or update another subscriber's preparation state", async () => {
    const otherTenant = await login(codeB);
    expect((await otherTenant.get(`/api/lit/matters/${matterId}/preparation`)).status).toBe(404);
    expect((await otherTenant.patch(`/api/lit/matters/${matterId}/preparation`).send({ issues: "Not allowed" })).status).toBe(404);
  });
});