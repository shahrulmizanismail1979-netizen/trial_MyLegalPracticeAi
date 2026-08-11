/**
 * Integration test: AI abuse guard fires HTTP 429 before a scripted subscriber
 * can spam requests beyond the per-minute limit.
 *
 * Design
 * ------
 * We test the aiRateLimit middleware directly against a minimal Express app
 * rather than routing through the full crim/lit app stack.  This keeps the
 * in-memory rate-limit store completely fresh (no interference from other test
 * files sharing the same worker), avoids session / Clerk bootstrapping costs,
 * and targets exactly what the task requires: verify the guard fires a 429 with
 * the right body before a scripted subscriber can spam requests.
 *
 * Module isolation
 * ----------------
 * vitest with fileParallelism:false runs all test files sequentially in the
 * same thread, which means the module registry is shared.  If another test
 * file already imported aiRateLimit.ts, the MAX constant was read from the
 * env at THAT point — not ours.  We call vi.resetModules() before the dynamic
 * import to force a fresh copy that reads our AI_RATE_LIMIT_PER_MINUTE=5.
 */

import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

const LIMIT = 5;

// Set env var THEN reset the module cache so the fresh import picks it up.
process.env.AI_RATE_LIMIT_PER_MINUTE = String(LIMIT);
vi.resetModules();

// Dynamic import AFTER reset — this is a fresh module instance with MAX=5.
const { aiRateLimit } = await import("./aiRateLimit");

/**
 * Build a tiny Express app that mimics the crim middleware stack:
 *   fakeCrimAuth (sets res.locals.accessCode.id)  →  aiRateLimit  →  handler
 *
 * All calls share the same `aiRateLimit` instance (and thus the same in-memory
 * store).  Tests use different codeId values so their buckets don't collide.
 */
function buildApp(codeId: number) {
  const app = express();
  app.use(express.json());

  // Simulate crim's requireAuth: attach the access-code row to res.locals.
  app.use((_req, res, next) => {
    res.locals.accessCode = { id: codeId, tier: "full" };
    next();
  });

  app.use(aiRateLimit);

  app.post("/ai/test", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

describe("AI rate limiter", () => {
  it(`allows the first ${LIMIT} requests and blocks the ${LIMIT + 1}th with 429`, async () => {
    const app = buildApp(1001);

    // First LIMIT requests must all be allowed.
    for (let i = 1; i <= LIMIT; i++) {
      const res = await request(app).post("/ai/test").send({});
      expect(res.status, `request ${i} of ${LIMIT} must not be rate-limited`).not.toBe(429);
    }

    // The (LIMIT+1)th request must be blocked with the prescribed error body.
    const blocked = await request(app).post("/ai/test").send({});
    expect(blocked.status, "over-limit request must return 429").toBe(429);
    expect(blocked.body).toEqual({
      error: "Too many AI requests. Please try again shortly.",
    });
  });

  it("a different subscriber has an independent quota", async () => {
    const appA = buildApp(2001);
    const appB = buildApp(2002);

    // Exhaust subscriber A's quota (send LIMIT+1 so the bucket is full).
    for (let i = 0; i < LIMIT; i++) {
      await request(appA).post("/ai/test").send({});
    }
    const aBlocked = await request(appA).post("/ai/test").send({});
    expect(aBlocked.status, "subscriber A should be rate-limited").toBe(429);

    // Subscriber B is on a different key — their first request must still pass.
    const bFirst = await request(appB).post("/ai/test").send({});
    expect(
      bFirst.status,
      "subscriber B must not be rate-limited by subscriber A's quota",
    ).not.toBe(429);
  });

  it("returns the exact error body prescribed by the spec", async () => {
    const app = buildApp(3001);

    // Exhaust the quota.
    for (let i = 0; i < LIMIT; i++) {
      await request(app).post("/ai/test").send({});
    }

    const res = await request(app).post("/ai/test").send({});
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({
      error: "Too many AI requests. Please try again shortly.",
    });
  });
});
