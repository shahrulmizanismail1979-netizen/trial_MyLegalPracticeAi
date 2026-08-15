/**
 * Integration tests: case law routes respect Convey subscription expiry.
 *
 * Scenario
 * --------
 * A Convey subscriber holds a valid, non-expired Bearer JWT.  When their row in
 * the `subscribers` table has a past `subscription_expiry`, every request to
 * the portal-accessible case law API (/api/cases/search, /api/cases/:id) must
 * return 401 — not 200 or any other success code.  Updating the expiry to a
 * future date must reinstate access (200 from the auth layer; downstream 404s
 * for missing case data are acceptable).
 *
 * Design
 * ------
 * We mount only `requireAnyPortalAuth` in front of a stub 200 handler so that
 * the tests target the auth layer in isolation — no research tables, no FTS
 * engine, no rate-limit state to clean up.  The real Convey JWT (signed with
 * the dev SESSION_SECRET) and real DB rows (users + subscribers) are used so
 * the live SQL path inside the middleware is fully exercised.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import * as jwt from "jsonwebtoken";

// Dynamic imports so module resolution picks up the shared db singleton.
const { requireAnyPortalAuth } = await import(
  "../middlewares/requireAnyPortalAuth"
);
const { db } = await import("@workspace/db");
const { usersTable, subscribersTable } = await import("@workspace/db/schema");
const { eq } = await import("drizzle-orm");

// ── Constants ────────────────────────────────────────────────────────────────

const RUN_ID = `cases-expiry-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const ACCESS_CODE = `TEST-CE-${RUN_ID.slice(-10).toUpperCase()}`;

// Signing secret — must match what requireAnyPortalAuth uses.
const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "dev-secret-change-me";

// ── Test state ────────────────────────────────────────────────────────────────

let userId: number;
let subscriberId: number;
/** A valid 30-day JWT for the test user — we never rotate this during the run. */
let token: string;

// ── App factory ──────────────────────────────────────────────────────────────

/**
 * Minimal Express app: requireAnyPortalAuth guard → stub 200 handler.
 *
 * We deliberately do NOT mount the real casesRouter: the tests exercise the
 * auth layer only.  A 200 means the middleware passed the request through;
 * a 401 means it rejected it.
 */
function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  // Stub for GET /api/cases/search
  app.get(
    "/api/cases/search",
    requireAnyPortalAuth as express.RequestHandler,
    (_req, res) => res.json({ ok: true, stub: true }),
  );
  // Stub for GET /api/cases/:id
  app.get(
    "/api/cases/:id",
    requireAnyPortalAuth as express.RequestHandler,
    (_req, res) => res.json({ ok: true, stub: true }),
  );
  return app;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Create a Convey user linked to the test access code.
  const [user] = await db
    .insert(usersTable)
    .values({
      accessCode: ACCESS_CODE,
      displayName: `Convey Expiry Test ${RUN_ID}`,
      role: "user",
      isActive: true,
    })
    .returning();
  userId = user.id;

  // Sign the JWT the way the real Convey login endpoint does.
  token = jwt.sign({ uid: userId }, SESSION_SECRET, { expiresIn: "30d" });

  // Create a subscriber row with a PAST expiry (yesterday).
  const [sub] = await db
    .insert(subscribersTable)
    .values({
      name: `Expiry Test Sub ${RUN_ID}`,
      email: `expiry-test-${RUN_ID}@example.com`,
      phone: "0000000000",
      apps: ["MyConveyLitAI"],
      accessCode: ACCESS_CODE,
      paymentStatus: "paid",
      paymentAmount: "0",
      subscriptionExpiry: new Date(Date.now() - 86_400_000), // yesterday
    })
    .returning();
  subscriberId = sub.id;
});

afterAll(async () => {
  await db
    .delete(subscribersTable)
    .where(eq(subscribersTable.id, subscriberId));
  await db.delete(usersTable).where(eq(usersTable.id, userId));
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("case law routes — Convey subscription expiry gate", () => {
  it("returns 401 on GET /api/cases/search when the subscriber plan is expired", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/cases/search")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("returns 401 on GET /api/cases/:id when the subscriber plan is expired", async () => {
    const app = buildApp();
    const res = await request(app)
      .get("/api/cases/1")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("returns 401 and not a 200 for any non-master auth approach on expired plan", async () => {
    // Extra guard: confirm the rejection body is meaningful.
    const app = buildApp();
    const res = await request(app)
      .get("/api/cases/search?q=test")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it("reinstates access on /search once expiry is moved to the future", async () => {
    // Push expiry 30 days forward.
    await db
      .update(subscribersTable)
      .set({ subscriptionExpiry: new Date(Date.now() + 86_400_000 * 30) })
      .where(eq(subscribersTable.id, subscriberId));

    const app = buildApp();
    const res = await request(app)
      .get("/api/cases/search")
      .set("Authorization", `Bearer ${token}`);
    // 200 = auth passed; the stub handler returns { ok: true }.
    expect(res.status).toBe(200);
  });

  it("reinstates access on /cases/:id once expiry is moved to the future", async () => {
    // Expiry is already future from the previous test — no further update needed.
    const app = buildApp();
    const res = await request(app)
      .get("/api/cases/42")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
