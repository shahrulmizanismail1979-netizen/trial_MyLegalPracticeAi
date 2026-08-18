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

// Import the function under test AFTER mocks are registered.
const { sweepExpiredCorpUploads } = await import("./uploads");

// ── Test data ────────────────────────────────────────────────────────────────

const RUN_ID = `sweep-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
// corp_access_codes.code is varchar(20)
const CODE = `SWPUP${crypto.randomBytes(4).toString("hex").toUpperCase()}`.slice(0, 20);

let codeId: number;

beforeAll(async () => {
  const [row] = await db
    .insert(corpAccessCodes)
    .values({ code: CODE, label: `Sweep test ${RUN_ID}`, isActive: true })
    .returning();
  codeId = row.id;
});

afterAll(async () => {
  // Cascade deletes corp_pending_uploads rows via FK, then remove the code.
  await db.delete(corpAccessCodes).where(eq(corpAccessCodes.id, codeId));
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
