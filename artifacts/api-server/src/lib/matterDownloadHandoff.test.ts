import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import {
  issueMatterDownload,
  restoreMatterDownload,
} from "./matterDownloadHandoff";

const TEST_SECRET = "dummy-matter-download-test-secret";
const OPEN_PATH = "/api/accident/matters/123/case-home/documents/456/open";

function handoffCookie(response: { headers: Record<string, unknown> }): string {
  const cookies = response.headers["set-cookie"];
  const cookie = Array.isArray(cookies)
    ? cookies.find((value): value is string =>
        typeof value === "string" && value.startsWith("matter_download="),
      )
    : undefined;
  expect(cookie).toBeDefined();
  return cookie!.split(";")[0]!;
}

function makeApp() {
  const app = express();
  app.use(cookieParser());
  app.use(restoreMatterDownload);

  app.post(OPEN_PATH, issueMatterDownload);
  app.get(OPEN_PATH, (req, res) => {
    if (req.headers.authorization === "Bearer revoked-token") {
      res.status(401).json({ error: "Authorization revoked" });
      return;
    }
    res.json({
      authorization: req.headers.authorization ?? null,
      master: req.headers["x-master-code"] ?? null,
    });
  });

  return app;
}

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", TEST_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("matter download handoff middleware", () => {
  it("encrypts credentials into a cookie and restores bearer/master headers", async () => {
    const app = makeApp();
    const minted = await request(app)
      .post(OPEN_PATH)
      .set("Authorization", "Bearer dummy-bearer-token")
      .set("x-master-code", "dummy-master-code");

    expect(minted.status).toBe(200);
    expect(minted.body.url).toBe(`${OPEN_PATH}?download=1`);
    const cookie = handoffCookie(minted);
    const setCookie = minted.headers["set-cookie"]?.join("\n") ?? "";
    expect(setCookie).not.toContain("dummy-bearer-token");
    expect(setCookie).not.toContain("dummy-master-code");

    const restored = await request(app)
      .get(`${OPEN_PATH}?download=1`)
      // Navigation requests cannot normally carry these headers. Supplying
      // conflicting values here proves the encrypted handoff wins.
      .set("Authorization", "Bearer attacker-token")
      .set("x-master-code", "attacker-master-code")
      .set("Cookie", cookie);

    expect(restored.status).toBe(200);
    expect(restored.body).toEqual({
      authorization: "Bearer dummy-bearer-token",
      master: "dummy-master-code",
    });
  });

  it("fails closed for a wrong path and never reaches downstream", async () => {
    const app = makeApp();
    const minted = await request(app)
      .post(OPEN_PATH)
      .set("Authorization", "Bearer dummy-bearer-token");
    const cookie = handoffCookie(minted);

    const wrongPath = await request(app)
      .get("/api/accident/matters/123/case-home/documents/999/open?download=1")
      .set("Cookie", cookie);

    expect(wrongPath.status).toBe(401);
    expect(wrongPath.body.error).toContain("Download link expired");
  });

  it("fails closed for a tampered encrypted cookie", async () => {
    const app = makeApp();
    const minted = await request(app)
      .post(OPEN_PATH)
      .set("Authorization", "Bearer dummy-bearer-token");
    const cookie = handoffCookie(minted);
    const token = cookie.slice("matter_download=".length);
    const tamperedToken =
      token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");

    const tampered = await request(app)
      .get(`${OPEN_PATH}?download=1`)
      .set("Cookie", `matter_download=${tamperedToken}`);

    expect(tampered.status).toBe(401);
    expect(tampered.body.error).toContain("Download link expired");
  });

  it("fails closed after the short handoff expiry", async () => {
    const app = makeApp();
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    try {
      const minted = await request(app)
        .post(OPEN_PATH)
        .set("Authorization", "Bearer dummy-bearer-token");
      const cookie = handoffCookie(minted);

      clock.mockReturnValue(1_060_001);
      const expired = await request(app)
        .get(`${OPEN_PATH}?download=1`)
        .set("Cookie", cookie);

      expect(expired.status).toBe(401);
      expect(expired.body.error).toContain("Download link expired");
    } finally {
      clock.mockRestore();
    }
  });

  it("does not bypass downstream revoked authorization", async () => {
    const app = makeApp();
    const minted = await request(app)
      .post(OPEN_PATH)
      .set("Authorization", "Bearer revoked-token");

    const response = await request(app)
      .get(`${OPEN_PATH}?download=1`)
      .set("Cookie", handoffCookie(minted));

    expect(response.status).toBe(401);
    expect(response.body.error).toBe("Authorization revoked");
  });

  it("fails closed when the signing secret is missing", async () => {
    const app = makeApp();
    const minted = await request(app)
      .post(OPEN_PATH)
      .set("Authorization", "Bearer dummy-bearer-token");
    const cookie = handoffCookie(minted);

    vi.stubEnv("SESSION_SECRET", undefined);
    const response = await request(app)
      .get(`${OPEN_PATH}?download=1`)
      .set("Cookie", cookie);

    expect(response.status).toBe(401);
    expect(response.body.error).toContain("Download link expired");
  });
});