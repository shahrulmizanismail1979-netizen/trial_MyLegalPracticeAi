import { describe, it, expect, vi } from "vitest";
import request from "supertest";

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
