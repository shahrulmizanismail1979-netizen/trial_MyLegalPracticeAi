import { afterAll, describe, expect, it, vi } from "vitest";
import express, { type Express, type IRouter } from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import request from "supertest";

const ADMIN_PASSWORD = "admin-route-test-password";
const MASTER_ACCESS_CODE = "master-route-test-code";
const COOKIE_SECRET = "admin-route-test-cookie-secret";

vi.stubEnv("ADMIN_PASSWORD", ADMIN_PASSWORD);
vi.stubEnv("MASTER_ACCESS_CODE", MASTER_ACCESS_CODE);
vi.stubEnv("SESSION_SECRET", COOKIE_SECRET);

const { default: ccbAdminRouter } = await import("../ccb/routes/admin");
const { default: corpAdminRouter } = await import("../corp/routes/admin/index");
const { default: crimAdminRouter } = await import("../crim/routes/admin");
const { default: litAdminRouter } = await import("../lit/routes/admin");
const { default: accidentAdminRouter } = await import("./accident-admin");
const { default: conveyAdminRouter } = await import("./convey-admin");
const { default: legacyCodesRouter } = await import("./legacy-codes");
const { default: researchAdminRouter } = await import("./research-admin");

afterAll(() => {
  vi.unstubAllEnvs();
});

function jsonApp(
  router: IRouter,
  options: { sessions?: boolean; signedCookies?: boolean } = {},
): Express {
  const app = express();
  app.use(express.json());
  if (options.sessions) {
    app.use(
      session({
        secret: COOKIE_SECRET,
        resave: false,
        saveUninitialized: false,
      }),
    );
  }
  if (options.signedCookies) {
    app.use(cookieParser(COOKIE_SECRET));
  }
  app.use(router);
  return app;
}

type CredentialRoute = {
  name: string;
  submit: (credential: string) => Promise<request.Response>;
  assertSession?: (response: request.Response) => void;
};

const credentialRoutes: CredentialRoute[] = [
  {
    name: "CCB admin login",
    submit: (credential) =>
      request(jsonApp(ccbAdminRouter))
        .post("/admin/login")
        .send({ password: credential }),
    assertSession: (response) => {
      expect(response.body.token).toEqual(expect.any(String));
    },
  },
  {
    name: "Corp admin login",
    submit: (credential) =>
      request(jsonApp(corpAdminRouter))
        .post("/admin/login")
        .send({ password: credential }),
    assertSession: (response) => {
      expect(response.body.adminToken).toEqual(expect.any(String));
    },
  },
  {
    name: "Crim admin login",
    submit: (credential) =>
      request(jsonApp(crimAdminRouter, { sessions: true }))
        .post("/admin/login")
        .send({ password: credential }),
    assertSession: (response) => {
      expect(response.body.ok).toBe(true);
      expect(response.headers["set-cookie"]).toBeDefined();
    },
  },
  {
    name: "Lit admin verify",
    submit: (credential) =>
      request(jsonApp(litAdminRouter))
        .post("/verify")
        .send({ password: credential }),
    assertSession: (response) => {
      expect(response.body.success).toBe(true);
    },
  },
  {
    name: "Accident admin login",
    submit: (credential) =>
      request(jsonApp(accidentAdminRouter))
        .post("/admin/login")
        .send({ password: credential }),
    assertSession: (response) => {
      expect(response.headers["set-cookie"]?.join(";")).toContain("admin_session=");
    },
  },
  {
    name: "Convey admin auth",
    submit: (credential) =>
      request(jsonApp(conveyAdminRouter))
        .post("/convey-admin/auth")
        .send({ password: credential }),
    assertSession: (response) => {
      expect(response.body.success).toBe(true);
    },
  },
  {
    name: "Legacy code import auth",
    submit: (credential) =>
      request(jsonApp(legacyCodesRouter))
        .post("/legacy-codes/import")
        .set("x-admin-token", credential)
        .send({
          app: "lit",
          dryRun: true,
          codes: [{ code: "dummy-import-code" }],
        }),
    assertSession: (response) => {
      expect(response.body.dryRun).toBe(true);
    },
  },
  {
    name: "Research admin login",
    submit: (credential) =>
      request(jsonApp(researchAdminRouter, { signedCookies: true }))
        .post("/auth/login")
        .send({ password: credential }),
    assertSession: (response) => {
      expect(response.body.ok).toBe(true);
      expect(response.headers["set-cookie"]?.join(";")).toContain("ra_auth=");
    },
  },
];

describe("password-admin route credential boundaries", () => {
  it.each(credentialRoutes)(
    "$name accepts the configured ADMIN_PASSWORD",
    async ({ submit, assertSession }) => {
      const response = await submit(ADMIN_PASSWORD);
      expect(response.status).toBe(200);
      assertSession?.(response);
    },
  );

  it.each(credentialRoutes)(
    "$name accepts the configured MASTER_ACCESS_CODE",
    async ({ submit, assertSession }) => {
      const response = await submit(MASTER_ACCESS_CODE);
      expect(response.status).toBe(200);
      assertSession?.(response);
    },
  );

  it.each(credentialRoutes)(
    "$name rejects an incorrect credential",
    async ({ submit }) => {
      const response = await submit("wrong-admin-route-credential");
      expect(response.status).toBe(401);
    },
  );

  it.each(credentialRoutes)(
    "$name rejects a blank credential",
    async ({ submit }) => {
      const response = await submit("");
      expect(response.status).toBe(401);
    },
  );

  it("research admin fails closed when both password-admin secrets are blank", async () => {
    vi.stubEnv("ADMIN_PASSWORD", " ");
    vi.stubEnv("MASTER_ACCESS_CODE", "");

    const response = await request(jsonApp(researchAdminRouter, { signedCookies: true }))
      .post("/auth/login")
      .send({ password: "wrong-admin-route-credential" });

    expect(response.status).toBe(503);
  });
});