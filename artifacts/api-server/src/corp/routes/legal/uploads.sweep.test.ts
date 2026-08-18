/**
 * Integration tests: sweepExpiredCorpUploads (Task #479)
 *
 * Verifies that the hourly sweep correctly:
 *   1. Deletes the DB row AND attempts to delete the storage object for an
 *      expired pending upload.
 *   2. Does NOT throw and still removes the DB row when the storage delete
 *      fails (object already gone / never uploaded).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import crypto from "node:crypto";
import { db, corpAccessCodes, corpPendingUploads } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Mock object storage BEFORE the module under test is loaded ───────────────
// ObjectStorageService is instantiated at module level in uploads.ts; we must
// intercept the constructor so our spy is attached to the instance used by
// sweepExpiredCorpUploads.

const mockDelete = vi.fn().mockResolvedValue(undefined);
const mockGetObjectEntityFile = vi.fn().mockResolvedValue({
  delete: mockDelete,
});

vi.mock("../../../lib/objectStorage", () => {
  function ObjectStorageService(this: unknown) {
    (this as Record<string, unknown>).getObjectEntityFile =
      mockGetObjectEntityFile;
  }
  return { ObjectStorageService };
});

// Also mock Clerk so the app module can load without real credentials.
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

// Import the functions under test AFTER mocks are registered.
const { sweepExpiredCorpUploads, registerPendingUpload, consumePendingUpload } =
  await import("./uploads");

// ── Test data ────────────────────────────────────────────────────────────────

const RUN_ID = `sweep-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
// corp_access_codes.code is varchar(20)
const CODE_A = `SWPA${crypto.randomBytes(4).toString("hex").toUpperCase()}`.slice(0, 20);
const CODE_B = `SWPB${crypto.randomBytes(4).toString("hex").toUpperCase()}`.slice(0, 20);

let codeId: number;
let codeIdB: number;

beforeAll(async () => {
  const [rowA] = await db
    .insert(corpAccessCodes)
    .values({ code: CODE_A, label: `Sweep test A ${RUN_ID}`, isActive: true })
    .returning();
  codeId = rowA.id;

  const [rowB] = await db
    .insert(corpAccessCodes)
    .values({ code: CODE_B, label: `Sweep test B ${RUN_ID}`, isActive: true })
    .returning();
  codeIdB = rowB.id;
});

afterAll(async () => {
  // Cascade deletes corp_pending_uploads rows via FK, then remove the codes.
  await db.delete(corpAccessCodes).where(eq(corpAccessCodes.id, codeId));
  await db.delete(corpAccessCodes).where(eq(corpAccessCodes.id, codeIdB));
});

// Helper: insert a pending-upload row that is already expired.
async function insertExpiredRow(objectPath: string): Promise<void> {
  const pastDate = new Date(Date.now() - 60_000); // 1 minute in the past
  await db.insert(corpPendingUploads).values({
    objectPath,
    accessCodeId: codeId,
    expiresAt: pastDate,
  });
}

// Helper: check whether a pending-upload row still exists in the DB.
async function rowExists(objectPath: string): Promise<boolean> {
  const rows = await db
    .select({ id: corpPendingUploads.id })
    .from(corpPendingUploads)
    .where(eq(corpPendingUploads.objectPath, objectPath));
  return rows.length > 0;
}

// Helper: insert a fresh (non-expired) pending-upload row directly.
async function insertFreshRow(
  objectPath: string,
  accessCodeId: number,
): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min from now
  await db.insert(corpPendingUploads).values({
    objectPath,
    accessCodeId,
    expiresAt,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("sweepExpiredCorpUploads", () => {
  it("deletes the DB row and attempts to delete the storage object when a pending upload expires", async () => {
    const objectPath = `/objects/sweep-test-${RUN_ID}-happy`;
    await insertExpiredRow(objectPath);
    expect(await rowExists(objectPath)).toBe(true);

    mockGetObjectEntityFile.mockClear();
    mockDelete.mockClear();

    await sweepExpiredCorpUploads();

    // DB row must be gone.
    expect(await rowExists(objectPath)).toBe(false);

    // Storage delete must have been attempted for this specific path.
    expect(mockGetObjectEntityFile).toHaveBeenCalledWith(objectPath);
    expect(mockDelete).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  it("still removes the DB row even when the storage delete throws (object already gone)", async () => {
    const objectPath = `/objects/sweep-test-${RUN_ID}-fail`;
    await insertExpiredRow(objectPath);
    expect(await rowExists(objectPath)).toBe(true);

    // Simulate a storage error (e.g. object was never uploaded, GCS returns 404).
    mockGetObjectEntityFile.mockRejectedValueOnce(
      new Error("Object not found in storage"),
    );

    // sweepExpiredCorpUploads must NOT throw.
    await expect(sweepExpiredCorpUploads()).resolves.toBeUndefined();

    // DB row must be gone regardless of the storage error.
    expect(await rowExists(objectPath)).toBe(false);
  });
});

describe("registerPendingUpload + consumePendingUpload – ownership transfer", () => {
  it("newer session wins: re-registering under session B lets B consume while A is rejected", async () => {
    const objectPath = `/objects/ownership-transfer-${RUN_ID}-${crypto.randomBytes(4).toString("hex")}`;

    // Session A registers the upload path first.
    await registerPendingUpload(objectPath, codeId);
    expect(await rowExists(objectPath)).toBe(true);

    // Session B re-registers the same path — ownership must transfer to B.
    await registerPendingUpload(objectPath, codeIdB);
    expect(await rowExists(objectPath)).toBe(true);

    // Session A (stale) must be rejected.
    const ownedByA = await consumePendingUpload(objectPath, codeId);
    expect(ownedByA).toBe(false);

    // The row must still be present (A's failed consume must not delete it).
    expect(await rowExists(objectPath)).toBe(true);

    // Session B (current owner) must succeed.
    const ownedByB = await consumePendingUpload(objectPath, codeIdB);
    expect(ownedByB).toBe(true);

    // Row must be gone after B consumes it.
    expect(await rowExists(objectPath)).toBe(false);
  });

  it("original session can consume when no re-registration has occurred", async () => {
    const objectPath = `/objects/ownership-original-${RUN_ID}-${crypto.randomBytes(4).toString("hex")}`;

    await registerPendingUpload(objectPath, codeId);

    // No re-registration — original session A must still own it.
    const owned = await consumePendingUpload(objectPath, codeId);
    expect(owned).toBe(true);
    expect(await rowExists(objectPath)).toBe(false);
  });

  it("consume is one-time use: a second consume by the same session returns false", async () => {
    const objectPath = `/objects/ownership-onetime-${RUN_ID}-${crypto.randomBytes(4).toString("hex")}`;

    await insertFreshRow(objectPath, codeId);

    const first = await consumePendingUpload(objectPath, codeId);
    expect(first).toBe(true);

    // Row is gone; second consume must return false.
    const second = await consumePendingUpload(objectPath, codeId);
    expect(second).toBe(false);
  });
});
