/**
 * Integration tests for POST /api/shared/uploads/extract
 *
 * Verifies that the shared multipart upload endpoint correctly enforces auth
 * for the two corporate portals that use it — MyCCBLitAI and MyConveyLitAI —
 * and that cross-subscriber isolation holds.
 *
 * Context
 * -------
 * MyCorpLegalAI uses the presigned-URL flow (/api/corp/legal/uploads/*) with
 * DB-backed ownership enforcement via corp_pending_uploads.
 *
 * MyCCBLitAI (Bearer JWT, role=practitioner|admin) and MyConveyLitAI (Bearer
 * JWT, uid=<userId>) both use /api/shared/uploads/extract instead — a direct
 * multipart endpoint that:
 *   1. Requires a valid portal session (requirePortalAuth middleware).
 *   2. For CCB: verifies the code is in the canonical static-code set OR has an
 *      active, unexpired DB row. Enforces seat limits for capped codes.
 *   3. For Convey: verifies the user is active and subscription not expired,
 *      and enforces seat limits for team-bundle codes.
 *   4. Processes files entirely in-memory within the request.
 *   5. Returns extracted text only to the authenticated caller.
 *
 * Because the endpoint has no server-side file storage between requests,
 * cross-subscriber isolation is structural: each response returns only to
 * the caller who made it. These tests verify the auth gate that makes this hold.
 *
 * Auth paths exercised:
 *   CCB  → JWT signed with SESSION_SECRET, role=practitioner|admin + code,
 *           static codes always allowed; DB codes need active=true, not expired,
 *           and seat available (maxSeats).
 *   Convey → JWT with uid=<userId>; DB user is_active=true, subscription not
 *             expired, claimSeat enforced for capped-seat team-bundle codes.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

// Mock Clerk — the app imports clerkMiddleware at bootstrap time; running
// without real Clerk credentials would crash the process otherwise.
vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => ({ userId: null }),
  clerkClient: { users: { getUser: async () => Promise.reject(new Error("not found")) } },
}));

// Bypass the IP-based rate limiter (10 req / 15 min) so the test suite's own
// requests don't exhaust the quota and produce 429s instead of the 401/200 we
// are asserting on.
vi.mock("express-rate-limit", () => ({
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  rateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  MemoryStore: class {
    resetAll(): void {}
  },
}));

const { default: app } = await import("../app");

// Import ccbAccessCodes after app to avoid module-ordering issues.
const { ccbAccessCodes } = await import("@workspace/db");

// ── Helpers ───────────────────────────────────────────────────────────────────

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me";

/** Mint a CCB-style JWT (role + code fields — matches what ccb/routes/auth.ts issues). */
function mintCCBToken(role: string, code: string): string {
  return jwt.sign({ role, code }, SESSION_SECRET, { expiresIn: "1h" });
}

/** Mint a Convey-style JWT (uid field, no role). */
function mintConveyToken(uid: number): string {
  return jwt.sign({ uid }, SESSION_SECRET, { expiresIn: "1h" });
}

/**
 * Build a multipart POST to /api/shared/uploads/extract with a tiny TXT file.
 * `userAgent` lets us simulate a distinct device (IP+UA = seat key).
 */
function uploadTxt(text: string, token?: string, userAgent?: string): request.Test {
  const buf = Buffer.from(text, "utf-8");
  let req = request(app)
    .post("/api/shared/uploads/extract")
    .attach("files", buf, { filename: "test.txt", contentType: "text/plain" });
  if (token) req = req.set("Authorization", `Bearer ${token}`);
  if (userAgent) req = req.set("User-Agent", userAgent);
  return req;
}

// ── Tests: unauthenticated access blocked ─────────────────────────────────────

describe("shared uploads: unauthenticated access blocked", () => {
  it("returns 401 with no credentials", async () => {
    const res = await uploadTxt("hello");
    expect(res.status).toBe(401);
  });

  it("returns 401 with a garbage Bearer token", async () => {
    const res = await uploadTxt("hello", "not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("returns 401 with a JWT signed by a different secret", async () => {
    const forged = jwt.sign({ role: "practitioner", code: "FORGED" }, "wrong-secret", {
      expiresIn: "1h",
    });
    const res = await uploadTxt("hello", forged);
    expect(res.status).toBe(401);
  });
});

// ── Tests: CCB JWT auth (MyCCBLitAI) ─────────────────────────────────────────

describe("shared uploads: CCB JWT auth (MyCCBLitAI)", () => {
  const RUN_ID = randomUUID();
  const shortId = RUN_ID.replace(/-/g, "").slice(0, 12);
  const codeActive = `TCCBA-${shortId}`.slice(0, 20).toUpperCase();
  const codeInactive = `TCCBI-${shortId}`.slice(0, 20).toUpperCase();
  const codeExpired = `TCCBE-${shortId}`.slice(0, 20).toUpperCase();
  const codeCapped = `TCCBC-${shortId}`.slice(0, 20).toUpperCase();
  const insertedIds: number[] = [];

  beforeAll(async () => {
    const rows = await db
      .insert(ccbAccessCodes)
      .values([
        // Active, no expiry, no seat cap
        { code: codeActive, label: `test-active-${RUN_ID}`, active: true },
        // Deactivated
        { code: codeInactive, label: `test-inactive-${RUN_ID}`, active: false },
        // Expired (expiresAt in the past)
        {
          code: codeExpired,
          label: `test-expired-${RUN_ID}`,
          active: true,
          expiresAt: new Date(Date.now() - 1000),
        },
        // Capped at 1 seat
        { code: codeCapped, label: `test-capped-${RUN_ID}`, active: true, maxSeats: 1 },
      ])
      .returning({ id: ccbAccessCodes.id });
    insertedIds.push(...rows.map((r) => r.id));
  });

  afterAll(async () => {
    if (insertedIds.length > 0) {
      await db.delete(ccbAccessCodes).where(inArray(ccbAccessCodes.id, insertedIds));
    }
  });

  // ── Positive cases ────────────────────────────────────────────────────────

  it("accepts a practitioner JWT for an active DB code", async () => {
    const token = mintCCBToken("practitioner", codeActive);
    const res = await uploadTxt("CCB practitioner file content", token, "DeviceA/1.0");
    expect(res.status).toBe(200);
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0].text).toContain("CCB practitioner file content");
    expect(res.body.files[0].error).toBeUndefined();
  });

  it("accepts an admin JWT for an active DB code", async () => {
    const token = mintCCBToken("admin", codeActive);
    const res = await uploadTxt("CCB admin file content", token, "DeviceA/1.0");
    expect(res.status).toBe(200);
    expect(res.body.files[0].text).toContain("CCB admin file content");
  });

  it("accepts canonical static/env codes without a DB row", async () => {
    // "CCBLIT2024" is in the default CCB_ACCESS_CODES list → always allowed.
    const token = mintCCBToken("practitioner", "CCBLIT2024");
    const res = await uploadTxt("static code content", token, "DeviceA/1.0");
    expect(res.status).toBe(200);
    expect(res.body.files[0].text).toContain("static code content");
  });

  // ── Negative cases ────────────────────────────────────────────────────────

  it("rejects a JWT with an unprivileged role even for a valid code", async () => {
    const token = mintCCBToken("user", codeActive);
    const res = await uploadTxt("should be blocked", token);
    expect(res.status).toBe(401);
  });

  it("rejects a JWT with no code field", async () => {
    // Legitimate practitioner JWTs always carry the code they logged in with.
    const token = jwt.sign({ role: "practitioner" }, SESSION_SECRET, { expiresIn: "1h" });
    const res = await uploadTxt("should be blocked", token);
    expect(res.status).toBe(401);
  });

  it("rejects a JWT for a deactivated code", async () => {
    const token = mintCCBToken("practitioner", codeInactive);
    const res = await uploadTxt("should be blocked", token);
    expect(res.status).toBe(401);
  });

  it("rejects a JWT for an expired code", async () => {
    const token = mintCCBToken("practitioner", codeExpired);
    const res = await uploadTxt("should be blocked", token);
    expect(res.status).toBe(401);
  });

  it("rejects a JWT with an entirely unknown code (not static, no DB row)", async () => {
    // This covers the fail-closed path: a code that appears in no static list
    // and has no DB row must always be denied.
    const token = mintCCBToken("practitioner", "TOTALLY-UNKNOWN-CODE-XYZ");
    const res = await uploadTxt("should be blocked", token);
    expect(res.status).toBe(401);
  });

  // ── Seat enforcement ──────────────────────────────────────────────────────

  it("allows the first device on a capped code, blocks a second distinct device", async () => {
    const token = mintCCBToken("practitioner", codeCapped);
    // Device A claims the only seat.
    const resA = await uploadTxt("seat A content", token, "CappedDeviceA/1.0");
    expect(resA.status).toBe(200);

    // Device B — distinct User-Agent → different seat key → seats exhausted → 401.
    const resB = await uploadTxt("seat B content", token, "CappedDeviceB/1.0");
    expect(resB.status).toBe(401);
  });

  // ── Cross-request isolation ───────────────────────────────────────────────

  it("each CCB request gets back only its own extracted content", async () => {
    const tokenA = mintCCBToken("practitioner", codeActive);
    const tokenB = mintCCBToken("practitioner", codeActive);

    const [resA, resB] = await Promise.all([
      uploadTxt("subscriber A secret", tokenA, "IsoDeviceA/1.0"),
      uploadTxt("subscriber B secret", tokenB, "IsoDeviceA/1.0"),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.body.files[0].text).toContain("subscriber A secret");
    expect(resA.body.files[0].text).not.toContain("subscriber B secret");
    expect(resB.body.files[0].text).toContain("subscriber B secret");
    expect(resB.body.files[0].text).not.toContain("subscriber A secret");
  });
});

// ── Tests: Convey JWT auth (MyConveyLitAI) ───────────────────────────────────

describe("shared uploads: Convey JWT auth (MyConveyLitAI)", () => {
  const RUN_ID = randomUUID();
  let conveyUserId: number;
  let conveyUserId2: number;
  let cappedUserId: number;
  const cappedCode = `capped-${RUN_ID.replace(/-/g, "").slice(0, 14)}`;

  beforeAll(async () => {
    // Primary test user: active, no seat cap.
    const [row] = await db
      .insert(usersTable)
      .values({
        displayName: `shared-upload-test-${RUN_ID}`,
        accessCode: `test-shared-${RUN_ID.replace(/-/g, "").slice(0, 16)}`,
        isActive: true,
        role: "user",
      })
      .returning({ id: usersTable.id });
    conveyUserId = row.id;

    // Second test user for cross-subscriber isolation.
    const [row2] = await db
      .insert(usersTable)
      .values({
        displayName: `shared-upload-test2-${RUN_ID}`,
        accessCode: `test-shared2-${RUN_ID.replace(/-/g, "").slice(0, 14)}`,
        isActive: true,
        role: "user",
      })
      .returning({ id: usersTable.id });
    conveyUserId2 = row2.id;

    // Capped user: maxSeats=1 so a second device is denied.
    const [row3] = await db
      .insert(usersTable)
      .values({
        displayName: `shared-upload-capped-${RUN_ID}`,
        accessCode: cappedCode,
        isActive: true,
        role: "user",
        maxSeats: 1,
      })
      .returning({ id: usersTable.id });
    cappedUserId = row3.id;
  });

  afterAll(async () => {
    const ids = [conveyUserId, conveyUserId2, cappedUserId].filter(Boolean);
    if (ids.length > 0) {
      await db.delete(usersTable).where(inArray(usersTable.id, ids));
    }
  });

  // ── Positive cases ────────────────────────────────────────────────────────

  it("accepts a valid Convey uid JWT and returns extracted text", async () => {
    const token = mintConveyToken(conveyUserId);
    const res = await uploadTxt("Convey file content", token, "ConveyDeviceA/1.0");
    expect(res.status).toBe(200);
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0].text).toContain("Convey file content");
    expect(res.body.files[0].error).toBeUndefined();
  });

  // ── Negative cases ────────────────────────────────────────────────────────

  it("rejects a Convey JWT referencing a non-existent uid", async () => {
    const token = mintConveyToken(99999999);
    const res = await uploadTxt("should be blocked", token);
    expect(res.status).toBe(401);
  });

  it("rejects a Convey JWT for a deactivated user", async () => {
    await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.id, conveyUserId));

    const token = mintConveyToken(conveyUserId);
    const res = await uploadTxt("should be blocked", token);
    expect(res.status).toBe(401);

    // Restore for subsequent tests.
    await db.update(usersTable).set({ isActive: true }).where(eq(usersTable.id, conveyUserId));
  });

  // ── Seat enforcement ──────────────────────────────────────────────────────

  it("allows the first Convey device on a capped code, blocks a second distinct device", async () => {
    const token = mintConveyToken(cappedUserId);

    // Device A claims the only seat.
    const resA = await uploadTxt("capped convey seat A", token, "ConveyCappedDeviceA/1.0");
    expect(resA.status).toBe(200);
    expect(resA.body.files[0].text).toContain("capped convey seat A");

    // Device B — distinct User-Agent → different seat key → seats exhausted → 401.
    const resB = await uploadTxt("capped convey seat B", token, "ConveyCappedDeviceB/1.0");
    expect(resB.status).toBe(401);
  });

  // ── Cross-request isolation ───────────────────────────────────────────────

  it("each Convey subscriber gets back only their own extracted content", async () => {
    const tokenA = mintConveyToken(conveyUserId);
    const tokenB = mintConveyToken(conveyUserId2);

    const [resA, resB] = await Promise.all([
      uploadTxt("convey subscriber A secret", tokenA, "ConveyIsoDeviceA/1.0"),
      uploadTxt("convey subscriber B secret", tokenB, "ConveyIsoDeviceB/1.0"),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(resA.body.files[0].text).toContain("convey subscriber A secret");
    expect(resA.body.files[0].text).not.toContain("convey subscriber B secret");
    expect(resB.body.files[0].text).toContain("convey subscriber B secret");
    expect(resB.body.files[0].text).not.toContain("convey subscriber A secret");
  });
});
