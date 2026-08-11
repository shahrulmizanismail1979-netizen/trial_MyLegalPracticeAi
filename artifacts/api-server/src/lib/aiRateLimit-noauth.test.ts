/**
 * Task #176 — Confirm the AI rate limit can't be bypassed by hitting it
 * unauthenticated.
 *
 * The `subscriberKey` generator in aiRateLimit.ts falls back to a single
 * shared "__noauth__" bucket when a request carries no subscriber identity.
 * If any AI endpoint were reachable unauthenticated, every scripted request
 * would drain that one shared bucket, letting an attacker exhaust the quota
 * for all unauthenticated callers (and proving the auth ordering is wrong).
 *
 * This test verifies, against the REAL app (full middleware stack, exactly
 * as mounted in production):
 *
 *  1. Unauthenticated requests to every aiRateLimit-guarded AI endpoint are
 *     rejected by auth middleware (401/402/403) BEFORE the rate limiter runs.
 *     With AI_RATE_LIMIT_PER_MINUTE=1, if even two of the sweep's requests
 *     had reached the limiter they would have collapsed into "__noauth__"
 *     and the second would have returned 429 — so asserting "never 429"
 *     across a 2x sweep of every endpoint proves the limiter is unreachable
 *     without a session.
 *
 *  2. The "__noauth__" bucket is literally untouched after the sweep: a
 *     probe request routed through the very same aiRateLimit instance with
 *     no auth signals (key = "__noauth__") is NOT rate-limited on its first
 *     hit, which would be impossible if any sweep request had consumed it.
 *
 *  3. The intentionally-unauthenticated limiters don't collapse to a shared
 *     constant: `ipAiRateLimit` keys per client IP and `attemptAiRateLimit`
 *     keys per attempt ID (unit-tested against mini apps).
 *
 * Module isolation: vitest runs files sequentially in one thread, so we set
 * AI_RATE_LIMIT_PER_MINUTE=1 and reset the module registry BEFORE importing
 * the app, ensuring the limiter instances in the app read our limit.
 */

import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

process.env.AI_RATE_LIMIT_PER_MINUTE = "1";
vi.resetModules();

// Fresh instances that read AI_RATE_LIMIT_PER_MINUTE=1.
const { aiRateLimit, ipAiRateLimit, attemptAiRateLimit } = await import("./aiRateLimit");
// The full production app — imported AFTER the reset so every portal router
// shares the same limiter instances (and in-memory stores) imported above.
const { default: app } = await import("../app");

/**
 * Every AI endpoint guarded by the shared subscriber-keyed `aiRateLimit`,
 * one per portal mount (plus extra mounts within a portal where the limiter
 * is attached separately). Paths mirror src/routes/index.ts + each portal
 * router. If a new portal adds AI routes, add its path here.
 */
const AI_ENDPOINTS: string[] = [
  "/api/crim/ai/legal-research", // crim: requireAuth + gateAiTools before limiter
  "/api/lit/ai/anything", // lit: litSessionGate before all /ai|/gemini|/irac mounts
  "/api/lit/gemini/litConversations",
  "/api/lit/irac/anything",
  "/api/lit/banking-recovery/anything",
  "/api/sya/gemini/conversations", // sya: syaSessionGate before AI-prefix limiter
  "/api/sya/smart-search/anything",
  "/api/ccb/gemini/conversations/1/messages", // ccb: requirePractitioner before routers
  "/api/ccb/tools/generate",
  "/api/corp/gemini/conversations", // corp: requireSession before limiter
  "/api/corp/legal/ai-tools/chat",
  "/api/accident/ai/chat", // accident: requireAccidentSession before limiter
  "/api/convey/chat", // convey: conveyGate 401s unauthenticated POSTs first
  "/api/convey/case-research",
  "/api/acad/admin/question-bank/seed", // acad: requireAdminMiddleware before limiter
];

describe("AI rate limit cannot be reached unauthenticated (Task #176)", () => {
  it(
    "rejects unauthenticated requests to every AI endpoint with auth errors, " +
      "never 429 (limit=1 would 429 on the 2nd request if __noauth__ were reachable)",
    async () => {
      for (const path of AI_ENDPOINTS) {
        // Two requests per endpoint: if BOTH reached the limiter they'd share
        // the "__noauth__" key and the second would be 429 with limit=1.
        for (let attempt = 1; attempt <= 2; attempt++) {
          const res = await request(app).post(path).send({ messages: [{ role: "user", content: "x" }] });
          expect(
            res.status,
            `${path} (attempt ${attempt}) must be rejected by auth, got ${res.status}: ${JSON.stringify(res.body)}`,
          ).toBeOneOf([401, 402, 403]);
        }
      }
    },
    60_000,
  );

  it("the shared __noauth__ bucket is untouched after the unauthenticated sweep", async () => {
    // A bare app with NO auth signals routes through the SAME aiRateLimit
    // instance the production app uses, so subscriberKey resolves to
    // "__noauth__". With limit=1, this first probe would be 429 if ANY sweep
    // request above had reached the limiter unauthenticated.
    const probe = express();
    probe.use(aiRateLimit);
    probe.post("/probe", (_req, res) => void res.json({ ok: true }));

    const first = await request(probe).post("/probe").send({});
    expect(
      first.status,
      "__noauth__ bucket must be full (untouched) before this probe — a 429 here means an AI endpoint leaked unauthenticated traffic into the limiter",
    ).toBe(200);

    // Sanity: the probe itself consumed the bucket, proving the store works.
    const second = await request(probe).post("/probe").send({});
    expect(second.status).toBe(429);
  });
});

describe("intentionally-unauthenticated limiters use per-caller keys, not a shared constant", () => {
  it("ipAiRateLimit keys by client IP — one IP's exhaustion doesn't block another", async () => {
    const ipApp = express();
    ipApp.set("trust proxy", 1); // same as the production app
    ipApp.use(ipAiRateLimit);
    ipApp.post("/gen", (_req, res) => void res.json({ ok: true }));

    // IP A uses its quota (limit=1), then gets blocked.
    const a1 = await request(ipApp).post("/gen").set("X-Forwarded-For", "203.0.113.10").send({});
    expect(a1.status).toBe(200);
    const a2 = await request(ipApp).post("/gen").set("X-Forwarded-For", "203.0.113.10").send({});
    expect(a2.status, "same IP must be rate-limited").toBe(429);

    // IP B has an independent bucket — a shared-constant key would 429 here.
    const b1 = await request(ipApp).post("/gen").set("X-Forwarded-For", "203.0.113.20").send({});
    expect(b1.status, "a different IP must NOT share IP A's bucket").toBe(200);
  });

  it("attemptAiRateLimit keys by attempt ID — one attempt's exhaustion doesn't block another", async () => {
    const attemptApp = express();
    attemptApp.post("/attempts/:id/answers", attemptAiRateLimit, (_req, res) => void res.json({ ok: true }));

    const a1 = await request(attemptApp).post("/attempts/attempt-aaa/answers").send({});
    expect(a1.status).toBe(200);
    const a2 = await request(attemptApp).post("/attempts/attempt-aaa/answers").send({});
    expect(a2.status, "same attempt must be rate-limited").toBe(429);

    const b1 = await request(attemptApp).post("/attempts/attempt-bbb/answers").send({});
    expect(b1.status, "a different attempt must NOT share attempt A's bucket").toBe(200);
  });
});
