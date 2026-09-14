/**
 * Focused signed-token regression tests. These use dummy values and avoid the
 * database-backed subscriber paths entirely.
 */
process.env.NODE_ENV = "test";
process.env.MASTER_ACCESS_CODE = "dummy-token-master-regression";
process.env.SESSION_SECRET = "dummy-token-session-secret";

import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const { createMasterToken, isMasterToken } = await import("./accident");
const { requirePractitioner, CCB_MASTER_TOKEN_ID } = await import("../ccb/routes/auth");
const { getMasterAccessFingerprint } = await import("../lib/masterAccess");

const MASTER = "dummy-token-master-regression";
const SECRET = "dummy-token-session-secret";

describe("master signed-token regressions", () => {
  afterEach(() => {
    vi.useRealTimers();
    process.env.MASTER_ACCESS_CODE = MASTER;
  });

  it("accepts an accident token, rejects tampering, and expires it", () => {
    const token = createMasterToken();
    expect(isMasterToken(token)).toBe(true);

    process.env.MASTER_ACCESS_CODE = "dummy-token-master-rotated";
    expect(isMasterToken(token)).toBe(false);
    delete process.env.MASTER_ACCESS_CODE;
    expect(isMasterToken(token)).toBe(false);
    process.env.MASTER_ACCESS_CODE = MASTER;

    const pieces = token.split(".");
    pieces[3] = `${pieces[3]!}00`;
    expect(isMasterToken(pieces.join("."))).toBe(false);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    const expiring = createMasterToken();
    vi.setSystemTime(new Date("2030-01-09T00:00:01.000Z"));
    expect(isMasterToken(expiring)).toBe(false);
  });

  it("revalidates the CCB master claim after the configured code rotates", async () => {
    const app = express();
    app.get("/", requirePractitioner, (_req, res) => {
      res.json({ ok: true });
    });
    const token = jwt.sign({
      role: "practitioner",
      code: CCB_MASTER_TOKEN_ID,
      master: true,
      masterFingerprint: getMasterAccessFingerprint(),
    }, SECRET, { expiresIn: "7d" });

    const current = await request(app)
      .get("/")
      .set("Authorization", `Bearer ${token}`);
    expect(current.status, JSON.stringify(current.body)).toBe(200);

    process.env.MASTER_ACCESS_CODE = "dummy-token-master-rotated";
    const stale = await request(app)
      .get("/")
      .set("Authorization", `Bearer ${token}`);
    expect(stale.status).toBe(401);

    const legacy = jwt.sign({ role: "practitioner", code: MASTER }, SECRET, {
      expiresIn: "7d",
    });
    const legacyRes = await request(app)
      .get("/")
      .set("Authorization", `Bearer ${legacy}`);
    expect(legacyRes.status).toBe(401);
  });
});