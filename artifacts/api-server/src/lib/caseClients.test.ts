import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { inArray } from "drizzle-orm";

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
const { db, pool } = await import("@workspace/db");
const { accessCodesTable, accessCodeUsageTable, accMatters } = await import(
  "@workspace/db/schema"
);
const { ensureAccMatterTables } = await import("../accident/matters");
const { requireMatterTenant, ownerOf } = await import("../accident/matterAuth");
const { makeClientsRouter, makeMatterClientsRouter, ensureCaseClientMatterTable } =
  await import("./caseClients");

const RUN_ID = `caseclients-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
// verify-code uppercases the submitted code before lookup, so stored codes
// must be uppercase to match.
const CODE_A = `TEST-${RUN_ID}-A`.toUpperCase();
const CODE_B = `TEST-${RUN_ID}-B`.toUpperCase();

const codeIds: number[] = [];

// owner_key for the "acc" portal is String(owner_id).
const accOwnerKey = (req: Parameters<typeof ownerOf>[0]) => {
  try {
    return String(ownerOf(req));
  } catch {
    return null;
  }
};

// Mount the shared client + matter-clients routers onto the real app behind the
// accident portal auth, alongside the existing accident matters routes (so we
// can create matters to link against). The orchestrator mounts these the same
// way in production.
app.use(
  "/api/accident/clients",
  requireMatterTenant,
  makeClientsRouter("acc", accOwnerKey),
);
app.use(
  "/api/accident/matters/:matterId/clients",
  requireMatterTenant,
  makeMatterClientsRouter("acc", accOwnerKey),
);

async function loginAgent(code: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/accident/auth/verify-code").send({ code });
  expect(res.status).toBe(200);
  expect(res.body.valid).toBe(true);
  return agent;
}

async function createMatter(agent: ReturnType<typeof request.agent>, title: string) {
  const res = await agent
    .post("/api/accident/matters")
    .send({ title, actingFor: "Plaintiff" });
  expect(res.status).toBe(201);
  return res.body.id as number;
}

beforeAll(async () => {
  await ensureAccMatterTables();
  await ensureCaseClientMatterTable();
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
    const ownerKeys = codeIds.map((id) => String(id));
    await pool.query(
      `DELETE FROM case_client_matters WHERE portal = 'acc' AND owner_key = ANY($1)`,
      [ownerKeys],
    );
    await pool.query(
      `DELETE FROM case_clients WHERE portal = 'acc' AND owner_key = ANY($1)`,
      [ownerKeys],
    );
    await db.delete(accMatters).where(inArray(accMatters.ownerId, codeIds));
    await db
      .delete(accessCodeUsageTable)
      .where(inArray(accessCodeUsageTable.accessCodeId, codeIds));
    await db.delete(accessCodesTable).where(inArray(accessCodesTable.id, codeIds));
  }
});

describe("shared case clients authorization", () => {
  it("rejects unauthenticated access to every clients endpoint", async () => {
    const endpoints: Array<[string, string]> = [
      ["get", "/api/accident/clients"],
      ["post", "/api/accident/clients"],
      ["get", "/api/accident/clients/1"],
      ["patch", "/api/accident/clients/1"],
      ["delete", "/api/accident/clients/1"],
      ["post", "/api/accident/clients/1/link-matter"],
      ["delete", "/api/accident/clients/1/link-matter/1"],
      ["get", "/api/accident/matters/1/clients"],
    ];
    for (const [method, path] of endpoints) {
      const res = await (
        request(app) as unknown as Record<string, (p: string) => request.Test>
      )[method](path);
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
    }
  });
});

describe("shared case clients CRUD + linking", () => {
  it("creates, reads, updates, links and unlinks a client", async () => {
    const agentA = await loginAgent(CODE_A);

    // 1. Create (via the existing case_clients directory)
    const createRes = await agentA.post("/api/accident/clients").send({
      name: `Lim Ah Kow ${RUN_ID}`,
      ic_number: "800101-14-5678",
      phone: "012-3456789",
      email: "lim@example.com",
      address: "12 Jalan Test, KL",
      notes: `File note (${RUN_ID})`,
    });
    expect(createRes.status).toBe(201);
    const clientId = createRes.body.id as number;
    expect(createRes.body.name).toBe(`Lim Ah Kow ${RUN_ID}`);
    expect(createRes.body.ic_number).toBe("800101-14-5678");

    // create requires a name
    expect((await agentA.post("/api/accident/clients").send({})).status).toBe(400);

    // 2. List sees it
    const list = await agentA.get("/api/accident/clients");
    expect(list.status).toBe(200);
    expect(list.body.some((c: { id: number }) => c.id === clientId)).toBe(true);

    // 3. Get one (no links yet)
    const getRes = await agentA.get(`/api/accident/clients/${clientId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.matterIds).toEqual([]);

    // 4. Patch
    const patchRes = await agentA
      .patch(`/api/accident/clients/${clientId}`)
      .send({ phone: "011-99998888" });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.phone).toBe("011-99998888");
    // untouched field preserved
    expect(patchRes.body.email).toBe("lim@example.com");

    // 5. Link to two owned matters
    const matter1 = await createMatter(agentA, `Matter one ${RUN_ID}`);
    const matter2 = await createMatter(agentA, `Matter two ${RUN_ID}`);

    const link1 = await agentA
      .post(`/api/accident/clients/${clientId}/link-matter`)
      .send({ matterId: matter1 });
    expect(link1.status).toBe(201);
    expect(link1.body.matter_id).toBe(matter1);

    // linking is idempotent
    const link1again = await agentA
      .post(`/api/accident/clients/${clientId}/link-matter`)
      .send({ matterId: matter1 });
    expect(link1again.status).toBe(200);

    const link2 = await agentA
      .post(`/api/accident/clients/${clientId}/link-matter`)
      .send({ matterId: matter2 });
    expect(link2.status).toBe(201);

    // link requires a matterId
    expect(
      (await agentA.post(`/api/accident/clients/${clientId}/link-matter`).send({}))
        .status,
    ).toBe(400);

    // 6. Get one now shows linked matter ids
    const getLinked = await agentA.get(`/api/accident/clients/${clientId}`);
    expect(getLinked.status).toBe(200);
    expect(getLinked.body.matterIds.sort()).toEqual([matter1, matter2].sort());

    // 7. matters/:id/clients returns the linked client
    const matterClients = await agentA.get(`/api/accident/matters/${matter1}/clients`);
    expect(matterClients.status).toBe(200);
    expect(matterClients.body).toHaveLength(1);
    expect(matterClients.body[0].id).toBe(clientId);

    // 8. Unlink one
    const unlink = await agentA.delete(
      `/api/accident/clients/${clientId}/link-matter/${matter1}`,
    );
    expect(unlink.status).toBe(200);
    const afterUnlink = await agentA.get(`/api/accident/matters/${matter1}/clients`);
    expect(afterUnlink.body).toHaveLength(0);
    const stillLinked = await agentA.get(`/api/accident/clients/${clientId}`);
    expect(stillLinked.body.matterIds).toEqual([matter2]);

    // 9. Delete client cascades the remaining link
    const del = await agentA.delete(`/api/accident/clients/${clientId}`);
    expect(del.status).toBe(200);
    expect((await agentA.get(`/api/accident/clients/${clientId}`)).status).toBe(404);
    // matter2's link is gone too (FK ON DELETE CASCADE)
    const matter2Clients = await agentA.get(`/api/accident/matters/${matter2}/clients`);
    expect(matter2Clients.body).toHaveLength(0);
  });
});

describe("shared case clients cross-tenant isolation", () => {
  it("blocks tenant B from reading, mutating, or linking tenant A's records (404 sweep)", async () => {
    const agentA = await loginAgent(CODE_A);
    const agentB = await loginAgent(CODE_B);

    // A creates a client and an owned matter
    const created = await agentA
      .post("/api/accident/clients")
      .send({ name: `Confidential Client ${RUN_ID}` });
    expect(created.status).toBe(201);
    const clientId = created.body.id as number;
    const matterA = await createMatter(agentA, `A's matter ${RUN_ID}`);
    const matterB = await createMatter(agentB, `B's matter ${RUN_ID}`);

    // A links its own client to its own matter
    expect(
      (
        await agentA
          .post(`/api/accident/clients/${clientId}/link-matter`)
          .send({ matterId: matterA })
      ).status,
    ).toBe(201);

    // B cannot see A's client in its own list
    const bList = await agentB.get("/api/accident/clients");
    expect(bList.status).toBe(200);
    expect(bList.body.some((c: { id: number }) => c.id === clientId)).toBe(false);

    // B cannot read or patch A's client (owner-scoped WHERE → 404)
    expect((await agentB.get(`/api/accident/clients/${clientId}`)).status).toBe(404);
    expect(
      (
        await agentB
          .patch(`/api/accident/clients/${clientId}`)
          .send({ name: "hijack" })
      ).status,
    ).toBe(404);
    // B's delete is owner-scoped in SQL: it no-ops on A's client (never deletes
    // it), so A's row survives — verified below.
    await agentB.delete(`/api/accident/clients/${clientId}`);
    expect((await agentA.get(`/api/accident/clients/${clientId}`)).status).toBe(200);

    // B cannot link A's client to anything (client not found for B)
    expect(
      (
        await agentB
          .post(`/api/accident/clients/${clientId}/link-matter`)
          .send({ matterId: matterB })
      ).status,
    ).toBe(404);

    // Even with its own client, B cannot link to A's matter (matter not found)
    const bClient = await agentB
      .post("/api/accident/clients")
      .send({ name: `B's client ${RUN_ID}` });
    expect(bClient.status).toBe(201);
    expect(
      (
        await agentB
          .post(`/api/accident/clients/${bClient.body.id}/link-matter`)
          .send({ matterId: matterA })
      ).status,
    ).toBe(404);

    // B cannot read the client list of A's matter (matter not found for B)
    expect((await agentB.get(`/api/accident/matters/${matterA}/clients`)).status).toBe(
      404,
    );

    // A still sees its own linkage intact
    const aMatterClients = await agentA.get(`/api/accident/matters/${matterA}/clients`);
    expect(aMatterClients.status).toBe(200);
    expect(aMatterClients.body.some((c: { id: number }) => c.id === clientId)).toBe(
      true,
    );

    // Clean up A's + B's clients
    expect((await agentA.delete(`/api/accident/clients/${clientId}`)).status).toBe(200);
    expect(
      (await agentB.delete(`/api/accident/clients/${bClient.body.id}`)).status,
    ).toBe(200);
  });
});
