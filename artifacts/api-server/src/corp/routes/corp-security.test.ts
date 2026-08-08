import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db, corpAccessCodes, corpSessions, corpConversations } from "@workspace/db";

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

const GEMINI_ENDPOINTS: Array<[string, string]> = [
  ["get", "/api/corp/gemini/conversations"],
  ["post", "/api/corp/gemini/conversations"],
  ["get", "/api/corp/gemini/conversations/1"],
  ["delete", "/api/corp/gemini/conversations/1"],
  ["get", "/api/corp/gemini/conversations/1/messages"],
  ["post", "/api/corp/gemini/conversations/1/messages"],
];

const CORP_ADMIN_ENDPOINTS: Array<[string, string]> = [
  ["post", "/api/corp/admin/logout"],
  ["get", "/api/corp/admin/codes"],
  ["post", "/api/corp/admin/codes"],
  ["patch", "/api/corp/admin/codes/1/toggle"],
  ["delete", "/api/corp/admin/codes/1"],
  ["post", "/api/corp/admin/codes/1/kick"],
];

type Method = "get" | "post" | "patch" | "delete";

function call(method: string, path: string, token?: string): request.Test {
  let req = request(app)[method as Method](path);
  if (token) req = req.set("Authorization", `Bearer ${token}`);
  return req;
}

describe("corp gemini route authorization", () => {
  it("returns 401 for every gemini endpoint without a token", async () => {
    for (const [method, path] of GEMINI_ENDPOINTS) {
      const res = await call(method, path);
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
    }
  });

  it("returns 401 for every gemini endpoint with an invalid token", async () => {
    for (const [method, path] of GEMINI_ENDPOINTS) {
      const res = await call(method, path, "not-a-real-session-token");
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
    }
  });
});

describe("corp admin route authorization", () => {
  it("returns 401 for every protected corp admin endpoint without a token", async () => {
    for (const [method, path] of CORP_ADMIN_ENDPOINTS) {
      const res = await call(method, path);
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
    }
  });

  it("returns 401 for every protected corp admin endpoint with an invalid token", async () => {
    for (const [method, path] of CORP_ADMIN_ENDPOINTS) {
      const res = await call(method, path, "bogus-admin-token");
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
    }
  });

  it("rejects admin login with a wrong password", async () => {
    const res = await request(app)
      .post("/api/corp/admin/login")
      .send({ password: "definitely-wrong-password" });
    expect(res.status).toBe(401);
  });
});

// Cross-tenant isolation: two valid subscriber sessions with different access
// codes must never see each other's conversations. Rows are tagged with a
// per-run marker and cleaned up in afterAll.
describe("corp gemini cross-tenant isolation", () => {
  const RUN_ID = randomUUID();
  const codeIds: number[] = [];
  const tokenA = `t21a-${RUN_ID}`.slice(0, 64);
  const tokenB = `t21b-${RUN_ID}`.slice(0, 64);
  let convA: number;
  let convB: number;

  beforeAll(async () => {
    const shortId = RUN_ID.replace(/-/g, "").slice(0, 12);
    const rows = await db
      .insert(corpAccessCodes)
      .values([
        { code: `T21A-${shortId}`.slice(0, 20), label: `test-run ${RUN_ID}` },
        { code: `T21B-${shortId}`.slice(0, 20), label: `test-run ${RUN_ID}` },
      ])
      .returning();
    codeIds.push(...rows.map((r) => r.id));

    await db.insert(corpSessions).values([
      { accessCodeId: codeIds[0], sessionToken: tokenA },
      { accessCodeId: codeIds[1], sessionToken: tokenB },
    ]);

    const resA = await call("post", "/api/corp/gemini/conversations", tokenA).send({
      title: `conv-a ${RUN_ID}`,
    });
    const resB = await call("post", "/api/corp/gemini/conversations", tokenB).send({
      title: `conv-b ${RUN_ID}`,
    });
    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    convA = resA.body.id;
    convB = resB.body.id;
  });

  afterAll(async () => {
    if (codeIds.length > 0) {
      await db.delete(corpConversations).where(inArray(corpConversations.accessCodeId, codeIds));
      await db.delete(corpSessions).where(inArray(corpSessions.accessCodeId, codeIds));
      await db.delete(corpAccessCodes).where(inArray(corpAccessCodes.id, codeIds));
    }
  });

  it("each session sees only its own conversations in the list", async () => {
    const listA = await call("get", "/api/corp/gemini/conversations", tokenA);
    const listB = await call("get", "/api/corp/gemini/conversations", tokenB);
    expect(listA.status).toBe(200);
    expect(listB.status).toBe(200);

    const idsA = (listA.body as Array<{ id: number }>).map((c) => c.id);
    const idsB = (listB.body as Array<{ id: number }>).map((c) => c.id);
    expect(idsA).toContain(convA);
    expect(idsA).not.toContain(convB);
    expect(idsB).toContain(convB);
    expect(idsB).not.toContain(convA);
  });

  it("returns 404 when reading another tenant's conversation", async () => {
    for (const [token, otherConv] of [
      [tokenA, convB],
      [tokenB, convA],
    ] as const) {
      const detail = await call("get", `/api/corp/gemini/conversations/${otherConv}`, token);
      expect(detail.status).toBe(404);
      const messages = await call(
        "get",
        `/api/corp/gemini/conversations/${otherConv}/messages`,
        token,
      );
      expect(messages.status).toBe(404);
    }
  });

  it("returns 404 when posting messages to or deleting another tenant's conversation", async () => {
    const post = await call("post", `/api/corp/gemini/conversations/${convB}/messages`, tokenA).send(
      { content: "should not work" },
    );
    expect(post.status).toBe(404);

    const del = await call("delete", `/api/corp/gemini/conversations/${convA}`, tokenB);
    expect(del.status).toBe(404);

    // Victim's conversation must still exist.
    const stillThere = await call("get", `/api/corp/gemini/conversations/${convA}`, tokenA);
    expect(stillThere.status).toBe(200);
  });
});
