/**
 * Integration test: persona WRITE authorization (`PUT /api/personas`).
 *
 * The persona layer keys a "professional mode" to a subscriber's access code.
 * A write must NOT be authorized purely from the raw code in the body — it is
 * bound to the caller's authenticated portal session server-side. The only
 * exception is create-only onboarding (the landing-page front door PUTs
 * {code, primaryRole} with no session): unauthenticated writes are allowed
 * ONLY when no persona row exists yet for that code.
 *
 * Coverage:
 *   (a) unauthenticated PUT creates a persona for a fresh code            → 200
 *   (b) unauthenticated PUT on a code that already has a persona          → 401
 *   (c) PUT with a valid portal session for the SAME code updates it      → 200
 *   (d) session for code A cannot write persona of code B                 → 403
 *
 * Sessions are minted the way the real portals do:
 *   - accident: an access_code_usage row + a `session_id` HttpOnly cookie
 *   - convey:   an active user + a signed Bearer token (req.currentUser)
 *
 * Real DB, RUN_ID-scoped rows, cleaned up in afterAll (mirrors
 * matter-files.test.ts).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

// The app pulls in Clerk middleware for the admin dashboard; mock it so these
// tests run without Clerk credentials (mirrors matter-files.test.ts).
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

// Object storage depends on the Replit sidecar + GCS; stub it out (the app
// imports it transitively via the lit/other routers).
vi.mock("../lib/objectStorage", () => {
  class FakeObjectStorageService {
    async getObjectEntityUploadURL(): Promise<string> {
      return `https://storage.example.com/bucket/.private/uploads/${randomUUID()}?sig=x`;
    }
    normalizeObjectEntityPath(rawPath: string): string {
      const m = rawPath.match(/uploads\/([0-9a-f-]+)/);
      return `/objects/uploads/${m ? m[1] : rawPath}`;
    }
    async getObjectEntityFile(): Promise<never> {
      const err = new Error("Object not found") as Error & { name: string };
      err.name = "ObjectNotFoundError";
      throw err;
    }
  }
  return {
    ObjectStorageService: FakeObjectStorageService,
    ObjectNotFoundError: class extends Error {},
  };
});

const { default: app } = await import("../app");
const { db, accessCodesTable, accessCodeUsageTable, usersTable, pool } = await import(
  "@workspace/db"
);
const { inArray, like } = await import("drizzle-orm");
const { signToken } = await import("./auth");

const RUN_ID = randomUUID().slice(0, 8).toUpperCase();

// Fresh code (no persona yet) — onboarding create path.
const FRESH_CODE = `PERSONA-FRESH-${RUN_ID}`;
// Code that will already have a persona before the unauthenticated write.
const EXISTING_CODE = `PERSONA-EXIST-${RUN_ID}`;
// Accident-session subject codes (A can write A, cannot write B).
const ACC_CODE_A = `PERSONA-ACC-A-${RUN_ID}`;
const ACC_CODE_B = `PERSONA-ACC-B-${RUN_ID}`;
// Convey subject code (bearer session).
const CONVEY_CODE = `PERSONA-CONVEY-${RUN_ID}`;

const ACC_SESSION_A = `persona-acc-sess-a-${RUN_ID}`;

// Seeded ids.
const seeded = {
  accessCodeIds: [] as number[],
  userIds: [] as number[],
};
let conveyToken = "";

// Every code we touch, so we can purge persona rows in afterAll.
const ALL_CODES = [FRESH_CODE, EXISTING_CODE, ACC_CODE_A, ACC_CODE_B, CONVEY_CODE].map((c) =>
  c.toUpperCase(),
);

beforeAll(async () => {
  // Seed access_codes so accessCodeExists() passes for every code under test.
  const codeRows = await db
    .insert(accessCodesTable)
    .values(
      [FRESH_CODE, EXISTING_CODE, ACC_CODE_A, ACC_CODE_B, CONVEY_CODE].map((code) => ({
        code,
        label: `persona test ${RUN_ID}`,
        isActive: true,
      })),
    )
    .returning({ id: accessCodesTable.id, code: accessCodesTable.code });
  seeded.accessCodeIds = codeRows.map((r) => r.id);

  const idFor = (code: string): number => {
    const row = codeRows.find((r) => r.code === code);
    if (!row) throw new Error(`missing seeded code ${code}`);
    return row.id;
  };

  // Accident session for code A: a live usage row keyed by session_id.
  await db.insert(accessCodeUsageTable).values({
    accessCodeId: idFor(ACC_CODE_A),
    sessionId: ACC_SESSION_A,
    usedAt: new Date(),
  });

  // Convey user for CONVEY_CODE (grandfathered so the paywall never blocks the
  // token from resolving to a live user in attachUser).
  const userRows = await db
    .insert(usersTable)
    .values({
      accessCode: CONVEY_CODE,
      displayName: `convey persona ${RUN_ID}`,
      isActive: true,
      grandfathered: true,
    })
    .returning({ id: usersTable.id });
  seeded.userIds = userRows.map((r) => r.id);
  conveyToken = signToken(userRows[0].id);
});

afterAll(async () => {
  await pool.query(
    `DELETE FROM user_personas WHERE owner_key = ANY($1::text[])`,
    [ALL_CODES],
  );
  if (seeded.userIds.length) {
    await db.delete(usersTable).where(inArray(usersTable.id, seeded.userIds));
  }
  await db.delete(usersTable).where(like(usersTable.accessCode, `PERSONA-%-${RUN_ID}`));
  if (seeded.accessCodeIds.length) {
    await db
      .delete(accessCodeUsageTable)
      .where(inArray(accessCodeUsageTable.accessCodeId, seeded.accessCodeIds));
    await db.delete(accessCodesTable).where(inArray(accessCodesTable.id, seeded.accessCodeIds));
  }
  await db.delete(accessCodesTable).where(like(accessCodesTable.code, `PERSONA-%-${RUN_ID}`));
});

describe("PUT /api/personas write authorization", () => {
  it("(a) unauthenticated PUT creates a persona for a fresh code", async () => {
    const res = await request(app)
      .put("/api/personas")
      .send({ code: FRESH_CODE, primaryRole: "student" });
    expect(res.status).toBe(200);
    expect(res.body?.persona?.primaryRole).toBe("student");
  });

  it("(b) unauthenticated PUT on a code that already has a persona → 401", async () => {
    // First create the persona (this is itself the onboarding path).
    const create = await request(app)
      .put("/api/personas")
      .send({ code: EXISTING_CODE, primaryRole: "academic" });
    expect(create.status).toBe(200);

    // A second anonymous write must be rejected — updating an existing persona
    // requires a session.
    const update = await request(app)
      .put("/api/personas")
      .send({ code: EXISTING_CODE, primaryRole: "practitioner" });
    expect(update.status).toBe(401);
    expect(update.body?.error).toMatch(/sign in/i);

    // And the stored persona is unchanged.
    const lookup = await request(app)
      .post("/api/personas/lookup")
      .send({ code: EXISTING_CODE });
    expect(lookup.body?.persona?.primaryRole).toBe("academic");
  });

  it("(c) PUT with a valid portal session for the SAME code updates it (accident cookie)", async () => {
    // Seed an initial persona via the onboarding path.
    const create = await request(app)
      .put("/api/personas")
      .send({ code: ACC_CODE_A, primaryRole: "other" });
    expect(create.status).toBe(200);

    // Now authenticated as code A via the accident session cookie — an UPDATE
    // is allowed because the session resolves to the same code.
    const update = await request(app)
      .put("/api/personas")
      .set("Cookie", [`session_id=${ACC_SESSION_A}`])
      .send({ code: ACC_CODE_A, primaryRole: "judicial" });
    expect(update.status).toBe(200);
    expect(update.body?.persona?.primaryRole).toBe("judicial");
  });

  it("(c') PUT with a valid convey bearer session updates its own code", async () => {
    const create = await request(app)
      .put("/api/personas")
      .send({ code: CONVEY_CODE, primaryRole: "other" });
    expect(create.status).toBe(200);

    const update = await request(app)
      .put("/api/personas")
      .set("Authorization", `Bearer ${conveyToken}`)
      .send({ code: CONVEY_CODE, primaryRole: "inhouse" });
    expect(update.status).toBe(200);
    expect(update.body?.persona?.primaryRole).toBe("inhouse");
  });

  it("(d) session for code A cannot write persona of code B → 403", async () => {
    // Create B's persona via onboarding so the write we test is an UPDATE.
    const create = await request(app)
      .put("/api/personas")
      .send({ code: ACC_CODE_B, primaryRole: "student" });
    expect(create.status).toBe(200);

    // Caller authenticated as code A tries to change code B's persona.
    const cross = await request(app)
      .put("/api/personas")
      .set("Cookie", [`session_id=${ACC_SESSION_A}`])
      .send({ code: ACC_CODE_B, primaryRole: "practitioner" });
    expect(cross.status).toBe(403);

    // B's persona is unchanged.
    const lookup = await request(app)
      .post("/api/personas/lookup")
      .send({ code: ACC_CODE_B });
    expect(lookup.body?.persona?.primaryRole).toBe("student");
  });
});
