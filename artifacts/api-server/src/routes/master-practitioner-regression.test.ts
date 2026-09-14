/**
 * Regression coverage for the owner override on practitioner login paths.
 *
 * This intentionally uses only dummy credentials. It exercises the real
 * mounted routes so a successful login must survive the downstream session
 * guard, not merely return a success response.
 */
process.env.NODE_ENV = "test";
process.env.MASTER_ACCESS_CODE = "dummy-master-practitioner-regression";
process.env.SESSION_SECRET = "dummy-session-secret-for-regression";

import { afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

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
const { db, microsoftLinks } = await import("@workspace/db");
const { usersTable: conveyUsers } = await import("@workspace/db/schema");
const { usersTable: acadUsers } = await import("@workspace/db/acad");
const { corpAccessCodes, litAccessCodes } = await import("@workspace/db");
const { eq } = await import("drizzle-orm");
const { signMsTicket } = await import("../microsoft");

const MASTER = "dummy-master-practitioner-regression";
const CONVEY_TENANT = "MASTER-OVERRIDE-CONVEY";
const LIT_TENANT = "MASTER-OVERRIDE-LIT";
const ACAD_EMAIL = "master-override@mylawacad.local";
const LEGACY_CONVEY = "dummy-legacy-convey-master";
const LEGACY_LIT = "dummy-legacy-lit-master";
const LEGACY_CORP = "legacy-corp-master";
const SSO_SENTINEL_EMAIL = "convey-sso-sentinel-regression@example.invalid";

describe("master practitioner route regressions", () => {
  it("logs into Acad with the access-code path and survives /auth/me", async () => {
    const agent = request.agent(app);

    const login = await agent
      .post("/api/acad/auth/code-login")
      .send({ code: MASTER });
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    expect(login.body.user?.role).toBe("admin");

    const me = await agent.get("/api/acad/auth/me");
    expect(me.status, JSON.stringify(me.body)).toBe(200);
    expect(me.body.user?.email).toBe(ACAD_EMAIL);
    expect(me.body.user?.role).toBe("admin");
  });

  it("keeps the Sya owner credential case-sensitive while accepting the raw value", async () => {
    const agent = request.agent(app);
    const login = await agent
      .post("/api/sya/auth/verify")
      .send({ accessCode: MASTER });
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    expect(login.body.user?.id).toBe(-1);

    const wrongCase = await request(app)
      .post("/api/sya/auth/verify")
      .send({ accessCode: MASTER.toUpperCase() });
    expect(wrongCase.status).toBe(401);
  });

  it("creates one Convey synthetic tenant and keeps its bearer session usable", async () => {
    const login = await request(app)
      .post("/api/convey/auth")
      .send({ accessCode: MASTER });
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    expect(typeof login.body.token).toBe("string");

    const me = await request(app)
      .get("/api/convey/me")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(me.status, JSON.stringify(me.body)).toBe(200);
    expect(me.body.user?.accessCode).toBeUndefined();

    const [tenant] = await db
      .select({ accessCode: conveyUsers.accessCode })
      .from(conveyUsers)
      .where(eq(conveyUsers.accessCode, CONVEY_TENANT))
      .limit(1);
    expect(tenant?.accessCode).toBe(CONVEY_TENANT);

    const ordinaryLogin = await request(app)
      .post("/api/convey/auth")
      .send({ accessCode: CONVEY_TENANT });
    expect(ordinaryLogin.status).toBe(401);
  });

  it("rejects the Convey synthetic tenant through linked SSO and deactivates its binding", async () => {
    await db.delete(microsoftLinks).where(eq(microsoftLinks.email, SSO_SENTINEL_EMAIL));
    await db.insert(microsoftLinks).values({
      email: SSO_SENTINEL_EMAIL,
      app: "convey",
      accessCode: CONVEY_TENANT,
      active: true,
    });

    const login = await request(app)
      .post("/api/convey/auth/sso")
      .send({ ticket: signMsTicket(SSO_SENTINEL_EMAIL, "convey") });
    expect(login.status, JSON.stringify(login.body)).toBe(401);

    const [binding] = await db
      .select({ active: microsoftLinks.active })
      .from(microsoftLinks)
      .where(eq(microsoftLinks.email, SSO_SENTINEL_EMAIL));
    expect(binding?.active).toBe(false);
  });

  it("creates one Lit synthetic tenant and keeps its session verifiable", async () => {
    const agent = request.agent(app);

    const login = await agent
      .post("/api/lit/auth/login")
      .send({ password: MASTER });
    expect(login.status, JSON.stringify(login.body)).toBe(200);

    const verify = await agent.get("/api/lit/auth/verify");
    expect(verify.status, JSON.stringify(verify.body)).toBe(200);
    expect(verify.body.authenticated).toBe(true);

    const [tenant] = await db
      .select({ code: litAccessCodes.code })
      .from(litAccessCodes)
      .where(eq(litAccessCodes.code, LIT_TENANT))
      .limit(1);
    expect(tenant?.code).toBe(LIT_TENANT);

    const ordinaryLogin = await request(app)
      .post("/api/lit/auth/login")
      .send({ password: LIT_TENANT });
    expect(ordinaryLogin.status).toBe(401);
  });

  it("does not expose the Corp synthetic tenant as a normal password", async () => {
    const ownerLogin = await request(app)
      .post("/api/corp/legal/verify-password")
      .send({ password: MASTER });
    expect(ownerLogin.status, JSON.stringify(ownerLogin.body)).toBe(200);
    expect(ownerLogin.body.success).toBe(true);

    const ordinaryLogin = await request(app)
      .post("/api/corp/legal/verify-password")
      .send({ password: "MASTER-OVERRIDE" });
    expect(ordinaryLogin.status, JSON.stringify(ordinaryLogin.body)).toBe(200);
    expect(ordinaryLogin.body.success).toBe(false);
  });

  it("revokes legacy owner rows in place without deleting their records", async () => {
    await db.insert(conveyUsers).values({
      accessCode: LEGACY_CONVEY,
      displayName: "Master Access",
      role: "admin",
      isActive: true,
      grandfathered: true,
      subscriptionTier: "firm",
      subscriptionStatus: "active",
    });
    await db.insert(litAccessCodes).values({
      code: LEGACY_LIT,
      recipientName: "Legacy Master",
      recipientEmail: "master@mylitai.local",
      status: "active",
      compedAccess: true,
    });
    await db.insert(corpAccessCodes).values({
      code: LEGACY_CORP,
      label: "Master override (full access)",
      tier: "legacy_full",
      isActive: true,
    });

    expect(
      (await request(app).post("/api/convey/auth").send({ accessCode: LEGACY_CONVEY })).status,
    ).toBe(401);
    expect(
      (await request(app).post("/api/lit/auth/login").send({ password: LEGACY_LIT })).status,
    ).toBe(401);
    expect(
      (await request(app)
        .post("/api/corp/legal/verify-password")
        .send({ password: LEGACY_CORP })).body.success,
    ).toBe(false);

    const [conveyRow] = await db
      .select({ isActive: conveyUsers.isActive })
      .from(conveyUsers)
      .where(eq(conveyUsers.accessCode, LEGACY_CONVEY));
    const [litRow] = await db
      .select({ status: litAccessCodes.status })
      .from(litAccessCodes)
      .where(eq(litAccessCodes.code, LEGACY_LIT));
    const [corpRow] = await db
      .select({ isActive: corpAccessCodes.isActive })
      .from(corpAccessCodes)
      .where(eq(corpAccessCodes.code, LEGACY_CORP));
    expect(conveyRow?.isActive).toBe(false);
    expect(litRow?.status).toBe("revoked");
    expect(corpRow?.isActive).toBe(false);
  });

  it("does not let an old master value authenticate after rotation", async () => {
    const oldValue = process.env.MASTER_ACCESS_CODE;
    const oldToken = await request(app)
      .post("/api/convey/auth")
      .send({ accessCode: oldValue });
    expect(oldToken.status).toBe(200);

    process.env.MASTER_ACCESS_CODE = "dummy-rotated-master-regression";
    try {
      const stale = await request(app)
        .post("/api/convey/auth")
        .send({ accessCode: oldValue });
      expect(stale.status).toBe(401);
    } finally {
      process.env.MASTER_ACCESS_CODE = oldValue;
    }
  });
});

afterAll(async () => {
  // Synthetic rows are stable reserved tenants; remove only the rows this
  // regression owns so repeated runs do not accumulate test accounts.
  await db.delete(acadUsers).where(eq(acadUsers.email, ACAD_EMAIL));
  await db.delete(conveyUsers).where(eq(conveyUsers.accessCode, CONVEY_TENANT));
  await db.delete(litAccessCodes).where(eq(litAccessCodes.code, LIT_TENANT));
  await db.delete(conveyUsers).where(eq(conveyUsers.accessCode, LEGACY_CONVEY));
  await db.delete(litAccessCodes).where(eq(litAccessCodes.code, LEGACY_LIT));
  await db.delete(corpAccessCodes).where(eq(corpAccessCodes.code, LEGACY_CORP));
  await db.delete(microsoftLinks).where(eq(microsoftLinks.email, SSO_SENTINEL_EMAIL));
});