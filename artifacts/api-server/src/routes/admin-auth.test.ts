import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

// Mutable state controlling the mocked Clerk auth for each test.
const state = vi.hoisted(() => ({
  auth: { userId: null as string | null },
  users: {} as Record<
    string,
    {
      emailAddresses: Array<{ id: string; emailAddress: string }>;
      primaryEmailAddressId: string | null;
    }
  >,
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => state.auth,
  clerkClient: {
    users: {
      getUser: async (id: string) => {
        const user = state.users[id];
        if (!user) throw new Error(`user ${id} not found`);
        return user;
      },
    },
  },
}));

// Import after the mock is registered.
const { default: app } = await import("../app");

function signInAs(userId: string, email: string): void {
  state.auth = { userId };
  state.users[userId] = {
    emailAddresses: [{ id: "email_1", emailAddress: email }],
    primaryEmailAddressId: "email_1",
  };
}

const ADMIN_ENDPOINTS: Array<[string, string]> = [
  ["get", "/api/admin/dashboard"],
  ["get", "/api/admin/subscribers"],
  ["get", "/api/admin/kohorts"],
  ["get", "/api/admin/pricing"],
  ["get", "/api/admin/vouchers"],
  ["get", "/api/admin/contributions"],
];

beforeEach(() => {
  state.auth = { userId: null };
  state.users = {};
  process.env.ADMIN_ALLOWED_EMAILS = "staff@example.com";
});

describe("admin API authorization", () => {
  it("returns 401 for every admin endpoint when unauthenticated", async () => {
    for (const [method, path] of ADMIN_ENDPOINTS) {
      const res = await (request(app) as never as Record<string, (p: string) => request.Test>)[
        method
      ](path);
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
    }
  });

  it("returns 403 when authenticated but not an allowlisted staff member", async () => {
    signInAs("user_outsider", "outsider@example.com");
    for (const [method, path] of ADMIN_ENDPOINTS) {
      const res = await (request(app) as never as Record<string, (p: string) => request.Test>)[
        method
      ](path);
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(403);
    }
  });

  it("returns 403 when authenticated but allowlist is empty (fail closed)", async () => {
    process.env.ADMIN_ALLOWED_EMAILS = "";
    signInAs("user_staff", "staff@example.com");
    const res = await request(app).get("/api/admin/dashboard");
    expect(res.status).toBe(403);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns isStaff=false for a signed-in non-staff user", async () => {
    signInAs("user_outsider", "outsider@example.com");
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      userId: "user_outsider",
      email: "outsider@example.com",
      isStaff: false,
    });
  });

  it("returns isStaff=true for a signed-in staff user", async () => {
    signInAs("user_staff", "staff@example.com");
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      userId: "user_staff",
      email: "staff@example.com",
      isStaff: true,
    });
  });

  it("matches staff emails case-insensitively", async () => {
    process.env.ADMIN_ALLOWED_EMAILS = "Staff@Example.com";
    signInAs("user_staff", "STAFF@example.COM");
    const res = await request(app).get("/api/auth/me");
    expect(res.body.isStaff).toBe(true);
  });
});

describe("public endpoints remain accessible", () => {
  it("serves the health check without authentication", async () => {
    const res = await request(app).get("/api/healthz");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok" });
  });
});
