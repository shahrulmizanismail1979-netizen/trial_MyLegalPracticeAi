/**
 * Integration tests for the aiRateLimit middleware:
 *
 * 1. AI abuse guard fires HTTP 429 before a scripted subscriber can spam
 *    requests beyond the per-minute limit.
 * 2. Each lawyer in a firm (team-bundle) sharing one access code gets their
 *    OWN quota bucket — one heavy user cannot block a colleague.
 *
 * Design
 * ------
 * We test the aiRateLimit middleware directly against a minimal Express app
 * rather than routing through the full crim/lit app stack.  This keeps the
 * in-memory rate-limit store completely fresh (no interference from other test
 * files sharing the same worker), avoids session / Clerk bootstrapping costs,
 * and targets exactly what the tasks require.
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
// firmAiRateLimit imports aiRateLimit (ensureAiSeat) — import in the same
// reset generation so both share the seat-cookie signing key.
const { firmAiRateLimit } = await import("../firm/lib/firmAiRateLimit");
const { STAFF_COOKIE, signSession } = await import("../firm/lib/managerSession");

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

/**
 * Minimal app that mimics a session-based portal (lit/crim/sya): auth
 * middleware has already attached the shared team access code and a
 * per-login express session ID. The test drives those via headers.
 */
function sessionPortalApp() {
  const app = express();
  app.use((req, res, next) => {
    // Same shared team-bundle access code for every request…
    (req as unknown as { session: { accessCodeId: number } }).session = {
      accessCodeId: 4242,
    };
    // …but a distinct express session ID per lawyer login.
    Object.defineProperty(req, "sessionID", {
      value: req.headers["x-test-session"] ?? "sess-default",
      configurable: true,
    });
    next();
  });
  app.post("/ai", aiRateLimit, (_req, res) => res.json({ ok: true }));
  return app;
}

/**
 * Minimal app that mimics a device-keyed portal (ccb/corp/accident): the
 * shared access code id is in res.locals, and individual lawyers are
 * separated by the server-issued ai_seat cookie (NOT by IP/user-agent —
 * two lawyers on office Wi-Fi share both).
 */
function devicePortalApp() {
  const app = express();
  app.use((_req, res, next) => {
    res.locals.ccbAccessCodeId = 777;
    next();
  });
  app.post("/ai", aiRateLimit, (_req, res) => res.json({ ok: true }));
  return app;
}

/**
 * Minimal app that mimics MyLawFirmAI's staff routes: cookie-parser + the
 * firm AI limiter. All staff on a team bundle share ONE access-code row id
 * in their fm_staff cookie; the ai_seat cookie is what separates lawyers.
 */
async function firmPortalApp() {
  const cookieParser = (await import("cookie-parser")).default;
  const app = express();
  app.use(cookieParser());
  app.post("/ai", firmAiRateLimit, (_req, res) => res.json({ ok: true }));
  return app;
}

/**
 * Simulate a browser's first contact: make one request, capture the
 * server-issued ai_seat cookie from Set-Cookie, and return it as a
 * `name=value` string to echo back on subsequent requests.
 */
async function obtainSeatCookie(
  app: express.Express,
  ua: string,
  extraCookie?: string,
): Promise<string> {
  let r = request(app).post("/ai").set("user-agent", ua);
  if (extraCookie) r = r.set("cookie", extraCookie);
  const res = await r;
  const setCookies = res.headers["set-cookie"] as unknown as string[] | undefined;
  const seat = (setCookies ?? []).find((c) => c.startsWith("ai_seat="));
  expect(seat, "server must issue an ai_seat cookie on first contact").toBeTruthy();
  return (seat as string).split(";")[0];
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

describe("per-seat AI rate limit for team bundles", () => {
  it("session-based portal: two lawyers on the same access code have independent quotas", async () => {
    const app = sessionPortalApp();

    // Lawyer A uses up their full personal quota…
    for (let i = 0; i < LIMIT; i++) {
      const res = await request(app).post("/ai").set("x-test-session", "lawyer-A");
      expect(res.status).toBe(200);
    }
    // …and the next request from A is blocked.
    const blockedA = await request(app).post("/ai").set("x-test-session", "lawyer-A");
    expect(blockedA.status).toBe(429);
    expect(blockedA.body.error).toMatch(/Too many AI requests/);

    // Lawyer B, sharing the SAME access code, is NOT blocked and can make
    // their own full quota of requests.
    for (let i = 0; i < LIMIT; i++) {
      const res = await request(app).post("/ai").set("x-test-session", "lawyer-B");
      expect(res.status).toBe(200);
    }
    // B only hits 429 after exhausting their OWN quota.
    const blockedB = await request(app).post("/ai").set("x-test-session", "lawyer-B");
    expect(blockedB.status).toBe(429);

    // A is still blocked (buckets did not reset or merge).
    const stillBlockedA = await request(app).post("/ai").set("x-test-session", "lawyer-A");
    expect(stillBlockedA.status).toBe(429);
  });

  it("device-keyed portal: two lawyers with IDENTICAL IP and user-agent (same office Wi-Fi, same browser) still get independent quotas", async () => {
    const app = devicePortalApp();
    // Same UA for both; supertest requests come from the same IP. The ONLY
    // difference between the two lawyers is their (server-issued) seat cookie.
    const UA = "OfficeChrome/120.0";

    // Each lawyer's browser gets a server-issued ai_seat cookie on first
    // contact (a warm-up request, like loading any page before spamming).
    const seatA = await obtainSeatCookie(app, UA);
    const seatB = await obtainSeatCookie(app, UA);
    expect(seatA).not.toBe(seatB);

    // Lawyer A exhausts their personal quota…
    for (let i = 0; i < LIMIT; i++) {
      const res = await request(app).post("/ai").set("user-agent", UA).set("cookie", seatA);
      expect(res.status).toBe(200);
    }
    const blockedA = await request(app).post("/ai").set("user-agent", UA).set("cookie", seatA);
    expect(blockedA.status).toBe(429);
    expect(blockedA.body.error).toMatch(/Too many AI requests/);

    // …but lawyer B — same IP, same user-agent, same access code — can still
    // make their full quota of requests.
    for (let i = 0; i < LIMIT; i++) {
      const res = await request(app).post("/ai").set("user-agent", UA).set("cookie", seatB);
      expect(res.status, `lawyer B request ${i + 1} must not share A's bucket`).toBe(200);
    }
    const blockedB = await request(app).post("/ai").set("user-agent", UA).set("cookie", seatB);
    expect(blockedB.status).toBe(429);

    // A is still blocked (buckets stayed separate, didn't reset or merge).
    const stillBlockedA = await request(app)
      .post("/ai")
      .set("user-agent", UA)
      .set("cookie", seatA);
    expect(stillBlockedA.status).toBe(429);
  });

  it("a cookie-less scripted client (no seat cookie ever) still hits the limit via the device fingerprint", async () => {
    const app = devicePortalApp();
    const UA = "curl/8.0-scripted";
    // Never echo the seat cookie back — every request looks cookie-less.
    for (let i = 0; i < LIMIT; i++) {
      const res = await request(app).post("/ai").set("user-agent", UA);
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).post("/ai").set("user-agent", UA);
    expect(blocked.status, "dropping the cookie must not grant unlimited quota").toBe(429);
  });

  it("MyLawFirmAI: two staff sharing one team-bundle code (same IP + UA) get independent quotas", async () => {
    const app = await firmPortalApp();
    const UA = "OfficeChrome/120.0";
    // Both staff logged in with the SAME firm access-code row id.
    const staffCookie = `${STAFF_COOKIE}=${signSession(9876)}`;
    const seatA = await obtainSeatCookie(app, UA, staffCookie);
    const seatB = await obtainSeatCookie(app, UA, staffCookie);
    expect(seatA).not.toBe(seatB);

    for (let i = 0; i < LIMIT; i++) {
      const res = await request(app)
        .post("/ai")
        .set("user-agent", UA)
        .set("cookie", `${staffCookie}; ${seatA}`);
      expect(res.status).toBe(200);
    }
    const blockedA = await request(app)
      .post("/ai")
      .set("user-agent", UA)
      .set("cookie", `${staffCookie}; ${seatA}`);
    expect(blockedA.status).toBe(429);

    // Staff B: same access code, same IP, same user-agent — NOT blocked.
    const okB = await request(app)
      .post("/ai")
      .set("user-agent", UA)
      .set("cookie", `${staffCookie}; ${seatB}`);
    expect(okB.status, "staff B must not share staff A's quota bucket").toBe(200);
  });
});
