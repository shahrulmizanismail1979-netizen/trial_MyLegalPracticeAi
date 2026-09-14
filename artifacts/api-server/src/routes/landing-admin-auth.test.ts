import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

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

const MASTER_ACCESS_CODE = "landing-admin-test-master-code";
const SESSION_SECRET = "landing-admin-test-session-secret";
const FINGERPRINT_KEY = "landing-admin-test-fingerprint-key";
const LEGACY_ADMIN_PASSWORD = "legacy-admin-route-password";

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

vi.mock("../lib/alertStatus", () => ({
  getAlertStatus: vi.fn().mockResolvedValue([]),
}));

vi.stubEnv("MASTER_ACCESS_CODE", MASTER_ACCESS_CODE);
vi.stubEnv("SESSION_SECRET", SESSION_SECRET);
vi.stubEnv("MASTER_ACCESS_FINGERPRINT_KEY", FINGERPRINT_KEY);
vi.stubEnv("ADMIN_ALLOWED_EMAILS", "staff@example.com");

const { default: app } = await import("../app");

afterAll(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  state.auth = { userId: null };
  state.users = {};
  vi.stubEnv("MASTER_ACCESS_CODE", MASTER_ACCESS_CODE);
  vi.stubEnv("SESSION_SECRET", SESSION_SECRET);
  vi.stubEnv("MASTER_ACCESS_FINGERPRINT_KEY", FINGERPRINT_KEY);
  vi.stubEnv("ADMIN_PASSWORD", "");
});

function signInAsStaff(): void {
  state.auth = { userId: "landing_staff" };
  state.users.landing_staff = {
    emailAddresses: [{ id: "email_1", emailAddress: "staff@example.com" }],
    primaryEmailAddressId: "email_1",
  };
}

describe("landing command-center master authentication", () => {
  it("issues a signed httpOnly cookie and authorizes the scoped admin mount", async () => {
    const agent = request.agent(app);
    const login = await agent
      .post("/api/admin/master/login")
      .send({ password: MASTER_ACCESS_CODE })
      .expect(200);

    expect(login.body).toEqual({ ok: true });
    const setCookie = (login.headers["set-cookie"] as string[]).find((cookie) =>
      cookie.startsWith("landing_admin_master="),
    );
    expect(setCookie).toMatch(/landing_admin_master=s%3A[0-9a-f]{64}\./);
    expect(setCookie).toMatch(/HttpOnly/);

    await agent
      .get("/api/admin/master/session")
      .expect(200, { authenticated: true });
    await agent.get("/api/admin/alert-status").expect(200, []);
  });

  it("clears the master session on logout", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/admin/master/login")
      .send({ password: MASTER_ACCESS_CODE })
      .expect(200);
    await agent
      .get("/api/admin/master/session")
      .expect(200, { authenticated: true });

    await agent.post("/api/admin/master/logout").expect(200, { ok: true });

    await agent
      .get("/api/admin/master/session")
      .expect(200, { authenticated: false });
    await agent.get("/api/admin/alert-status").expect(401);
  });

  it.each(["wrong-landing-master-code", ""])(
    "rejects a wrong or blank master credential (%s)",
    async (password) => {
      await request(app)
        .post("/api/admin/master/login")
        .send({ password })
        .expect(401);
    },
  );

  it("fails closed when MASTER_ACCESS_CODE is unset or blank", async () => {
    vi.stubEnv("MASTER_ACCESS_CODE", " ");
    vi.stubEnv("ADMIN_PASSWORD", LEGACY_ADMIN_PASSWORD);

    await request(app)
      .post("/api/admin/master/login")
      .send({ password: MASTER_ACCESS_CODE })
      .expect(503);
  });

  it("does not treat the legacy ADMIN_PASSWORD as a landing master credential", async () => {
    vi.stubEnv("ADMIN_PASSWORD", LEGACY_ADMIN_PASSWORD);

    await request(app)
      .post("/api/admin/master/login")
      .send({ password: LEGACY_ADMIN_PASSWORD })
      .expect(401);
  });

  it("invalidates the signed master session when MASTER_ACCESS_CODE rotates", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/admin/master/login")
      .send({ password: MASTER_ACCESS_CODE })
      .expect(200);

    vi.stubEnv("MASTER_ACCESS_CODE", "rotated-landing-admin-master-code");

    await agent
      .get("/api/admin/master/session")
      .expect(200, { authenticated: false });
    await agent.get("/api/admin/alert-status").expect(401);
  });

  it("preserves Clerk staff access independently of the master session", async () => {
    signInAsStaff();

    await request(app).get("/api/admin/alert-status").expect(200, []);
    await request(app)
      .get("/api/admin/master/session")
      .expect(200, { authenticated: false });
  });

  it("does not authorize the protected admin mount without either identity", async () => {
    await request(app).get("/api/admin/alert-status").expect(401);
  });

  it("does not let the landing master session cross into research routes", async () => {
    const agent = request.agent(app);
    await agent
      .post("/api/admin/master/login")
      .send({ password: MASTER_ACCESS_CODE })
      .expect(200);

    await agent.get("/api/research").expect(401);
  });

  it("rate-limits repeated master credential failures", async () => {
    await request(app)
      .post("/api/internal/e2e/login-rate-limit/reset")
      .set("x-case-home-e2e-token", SESSION_SECRET)
      .expect(204);

    for (let attempt = 0; attempt < 20; attempt++) {
      await request(app)
        .post("/api/admin/master/login")
        .send({ password: "wrong-landing-master-code" })
        .expect(401);
    }

    await request(app)
      .post("/api/admin/master/login")
      .send({ password: "wrong-landing-master-code" })
      .expect(429);
  });
});