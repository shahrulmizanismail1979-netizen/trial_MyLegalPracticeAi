/**
 * Contract test: the draft-8 rate-limit headers emitted by express-rate-limit
 * must remain parseable by the portal frontends' rate-limit monitor
 * (artifacts/<portal>/src/lib/rate-limit-monitor.tsx), which shows lawyers how
 * many AI requests they have left before they're blocked.
 *
 * The frontend extracts r= (remaining), t= (seconds to reset) from the
 * `RateLimit` header and q= (limit) from `RateLimit-Policy` using the regex
 * below. If express-rate-limit changes its header format, this test fails
 * before lawyers silently lose the warning banner.
 */

import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

const LIMIT = 5;
process.env.AI_RATE_LIMIT_PER_MINUTE = String(LIMIT);
vi.resetModules();
const { aiRateLimit } = await import("./aiRateLimit");

// Keep in sync with parseDraft8() in the portals' rate-limit-monitor.tsx.
function parseDraft8(header: string): { r?: number; t?: number; q?: number } {
  const out: { r?: number; t?: number; q?: number } = {};
  for (const m of header.matchAll(/\b([rtq])\s*=\s*(\d+)/g)) {
    out[m[1] as "r" | "t" | "q"] = parseInt(m[2], 10);
  }
  return out;
}

function buildApp(codeId: number) {
  const app = express();
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

describe("draft-8 rate-limit headers (frontend contract)", () => {
  it("successful responses carry a parseable RateLimit header", async () => {
    const app = buildApp(9101);
    const res = await request(app).post("/ai/test").send({});
    expect(res.status).toBe(200);

    const rl = res.headers["ratelimit"];
    expect(rl, "RateLimit header must be present on AI responses").toBeTruthy();
    const { r, t } = parseDraft8(String(rl));
    expect(r, "remaining (r=) must be parseable").toBe(LIMIT - 1);
    expect(t, "reset seconds (t=) must be parseable").toBeGreaterThan(0);
    expect(t).toBeLessThanOrEqual(60);

    const policy = res.headers["ratelimit-policy"];
    expect(policy, "RateLimit-Policy header must be present").toBeTruthy();
    expect(parseDraft8(String(policy)).q, "limit (q=) must be parseable").toBe(LIMIT);
  });

  it("remaining counts down to 0 and the 429 still carries the headers", async () => {
    const app = buildApp(9102);

    let lastRemaining = Infinity;
    for (let i = 0; i < LIMIT; i++) {
      const res = await request(app).post("/ai/test").send({});
      const { r } = parseDraft8(String(res.headers["ratelimit"]));
      expect(r).toBeLessThan(lastRemaining);
      lastRemaining = r!;
    }
    expect(lastRemaining).toBe(0);

    const blocked = await request(app).post("/ai/test").send({});
    expect(blocked.status).toBe(429);
    const { r, t } = parseDraft8(String(blocked.headers["ratelimit"]));
    expect(r, "blocked response must still report remaining=0").toBe(0);
    expect(t).toBeGreaterThan(0);
  });
});
