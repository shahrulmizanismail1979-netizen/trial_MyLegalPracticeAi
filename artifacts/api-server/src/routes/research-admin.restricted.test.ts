/**
 * Tests for the RESTRICTED_REFERENCE_ONLY drive asset workflow:
 *   - individual reject  (POST /drive/assets/:id/reject)
 *   - individual approve (PATCH /drive/assets/:id/rights) with CANCELLED→PENDING reset
 *   - bulk reject/approve (POST /drive/assets/bulk-restricted)
 *   - session guard (401 without cookie)
 *
 * Per-asset tests use real DB calls scoped to rows created by this run.
 *
 * Bulk tests pass an explicit `ids` allowlist containing only fixture rows so
 * the operation never touches pre-existing protected content in the shared DB.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => ({ userId: null }),
  clerkClient: { users: { getUser: async () => { throw new Error("not used"); } } },
}));

vi.mock("../stripeClient", () => ({
  getStripeSync: vi.fn().mockRejectedValue(new Error("Stripe unavailable")),
  getUncachableStripeClient: vi.fn().mockRejectedValue(new Error("Stripe unavailable")),
}));

vi.mock("../lib/objectStorage", () => {
  class ObjectNotFoundError extends Error {
    constructor() { super("Object not found"); this.name = "ObjectNotFoundError"; }
  }
  class ObjectStorageService {
    async getObjectEntityFile(_p: string) {
      return { download: async (): Promise<[Buffer]> => [Buffer.from("")] };
    }
  }
  return { ObjectStorageService, ObjectNotFoundError };
});

// ── App + DB imports (after mocks) ───────────────────────────────────────────

const { default: app } = await import("../app");
const { db, driveAssets, researchJobs, researchUploadBatches, researchUploadBatchItems } = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");

// ── Helpers ──────────────────────────────────────────────────────────────────

const RUN_ID = randomUUID();
const createdAssetIds: number[] = [];

/**
 * Log in and return the Set-Cookie string for ra_auth.
 *
 * research-admin.ts captures ADMIN_PASSWORD at module-load time using:
 *   process.env.ADMIN_PASSWORD || (IS_PROD ? null : "admin123")
 * Mirror the same resolution so we always match the in-process value.
 */
async function getAdminCookie(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const res = await request(app)
    .post("/api/research-admin/auth/login")
    .send({ password });
  expect(res.status, "admin login should succeed").toBe(200);
  const setCookie = res.headers["set-cookie"] as string[] | string | undefined;
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const raw = cookies.find((c) => c.startsWith("ra_auth="));
  if (!raw) throw new Error("ra_auth cookie not set after login");
  return raw.split(";")[0]!;
}

/** Insert a test drive_asset; tracks the id for cleanup. */
async function insertAsset(overrides: {
  rightsStatus?: "RESTRICTED_REFERENCE_ONLY" | "APPROVED" | "RIGHTS_REVIEW_REQUIRED" | "NEEDS_OFFICIAL_SOURCE";
  processingStatus?: "PENDING" | "CANCELLED" | "FAILED" | "INGESTION_QUEUED";
  sourceClassification?: "COMMERCIAL_PUBLISHER_REPORT" | "OFFICIAL_JUDGMENT" | "UNKNOWN_SOURCE";
} = {}): Promise<number> {
  const [row] = await db
    .insert(driveAssets)
    .values({
      driveFileId: `test-restricted-${RUN_ID}-${randomUUID()}`,
      name: `Test Restricted Asset ${RUN_ID}`,
      rightsStatus: overrides.rightsStatus ?? "RESTRICTED_REFERENCE_ONLY",
      processingStatus: overrides.processingStatus ?? "PENDING",
      sourceClassification: overrides.sourceClassification ?? "COMMERCIAL_PUBLISHER_REPORT",
    })
    .returning({ id: driveAssets.id });
  createdAssetIds.push(row!.id);
  return row!.id;
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

let cookie: string;

beforeAll(async () => {
  cookie = await getAdminCookie();
});

afterAll(async () => {
  if (createdAssetIds.length > 0) {
    for (const id of createdAssetIds) {
      await db
        .delete(researchJobs)
        .where(eq(researchJobs.idempotencyKey, `drive.ingest:asset:${id}`))
        .catch(() => {});
    }
    await db.delete(driveAssets).where(inArray(driveAssets.id, createdAssetIds)).catch(() => {});
  }
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("research-admin restricted asset workflow", () => {

  // ── Auth guard ─────────────────────────────────────────────────────────────

  it("returns 401 without a session cookie", async () => {
    const id = await insertAsset();
    const [rejectRes, approveRes, bulkRes] = await Promise.all([
      request(app).post(`/api/research-admin/drive/assets/${id}/reject`).send({}),
      request(app).patch(`/api/research-admin/drive/assets/${id}/rights`).send({ rightsStatus: "APPROVED" }),
      request(app).post("/api/research-admin/drive/assets/bulk-restricted").send({ action: "reject", ids: [id] }),
    ]);
    expect(rejectRes.status).toBe(401);
    expect(approveRes.status).toBe(401);
    expect(bulkRes.status).toBe(401);
  });

  // ── Individual reject ──────────────────────────────────────────────────────

  it("rejects a RESTRICTED_REFERENCE_ONLY asset: sets processingStatus=CANCELLED", async () => {
    const id = await insertAsset({ rightsStatus: "RESTRICTED_REFERENCE_ONLY", processingStatus: "PENDING" });

    const res = await request(app)
      .post(`/api/research-admin/drive/assets/${id}/reject`)
      .set("Cookie", cookie)
      .send({ reason: "No licence available" });

    expect(res.status).toBe(200);
    expect(res.body.processingStatus).toBe("CANCELLED");
    expect(res.body.pipelineError).toBe("No licence available");
    expect(res.body.rightsStatus).toBe("RESTRICTED_REFERENCE_ONLY");

    const [row] = await db.select().from(driveAssets).where(eq(driveAssets.id, id));
    expect(row?.processingStatus).toBe("CANCELLED");
    expect(row?.rightsStatus).toBe("RESTRICTED_REFERENCE_ONLY");
  });

  it("reject uses default reason when none provided", async () => {
    const id = await insertAsset();
    const res = await request(app)
      .post(`/api/research-admin/drive/assets/${id}/reject`)
      .set("Cookie", cookie)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.processingStatus).toBe("CANCELLED");
    expect(res.body.pipelineError).toMatch(/no licence/i);
  });

  it("returns 409 when rejecting a non-RESTRICTED asset", async () => {
    const id = await insertAsset({ rightsStatus: "RIGHTS_REVIEW_REQUIRED" });
    const res = await request(app)
      .post(`/api/research-admin/drive/assets/${id}/reject`)
      .set("Cookie", cookie)
      .send({});
    expect(res.status).toBe(409);
  });

  it("returns 404 when rejecting a non-existent asset", async () => {
    const res = await request(app)
      .post("/api/research-admin/drive/assets/999999999/reject")
      .set("Cookie", cookie)
      .send({});
    expect(res.status).toBe(404);
  });

  // ── Individual approve — transaction + CANCELLED reset ────────────────────

  it("approves a PENDING restricted asset: rightsStatus=APPROVED, ingest job enqueued atomically", async () => {
    const id = await insertAsset({ rightsStatus: "RESTRICTED_REFERENCE_ONLY", processingStatus: "PENDING" });

    const res = await request(app)
      .patch(`/api/research-admin/drive/assets/${id}/rights`)
      .set("Cookie", cookie)
      .send({ rightsStatus: "APPROVED" });

    expect(res.status).toBe(200);
    expect(res.body.rightsStatus).toBe("APPROVED");
    expect(res.body.processingStatus).toBe("PENDING");

    const [job] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, `drive.ingest:asset:${id}`));
    expect(job).toBeDefined();
    expect((job!.payload as { driveAssetId: number }).driveAssetId).toBe(id);
  });

  it("reject → approve: CANCELLED asset is reset to PENDING so ingest bridge picks it up", async () => {
    const id = await insertAsset({ rightsStatus: "RESTRICTED_REFERENCE_ONLY", processingStatus: "PENDING" });

    // Step 1 — reject
    const rejectRes = await request(app)
      .post(`/api/research-admin/drive/assets/${id}/reject`)
      .set("Cookie", cookie)
      .send({ reason: "test rejection" });
    expect(rejectRes.status).toBe(200);

    const [afterReject] = await db.select().from(driveAssets).where(eq(driveAssets.id, id));
    expect(afterReject?.processingStatus).toBe("CANCELLED");

    // Step 2 — approve: CANCELLED must be reset to PENDING
    const approveRes = await request(app)
      .patch(`/api/research-admin/drive/assets/${id}/rights`)
      .set("Cookie", cookie)
      .send({ rightsStatus: "APPROVED" });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.rightsStatus).toBe("APPROVED");
    // ingest bridge requires processingStatus === 'PENDING'
    expect(approveRes.body.processingStatus).toBe("PENDING");
    expect(approveRes.body.pipelineError).toBeNull();

    const [job] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, `drive.ingest:asset:${id}`));
    expect(job).toBeDefined();
  });

  it("reapproval after rejection creates a fresh runnable QUEUED job even when a terminal CANCELLED job already exists", async () => {
    const id = await insertAsset({ rightsStatus: "RESTRICTED_REFERENCE_ONLY", processingStatus: "PENDING" });

    // Step 1: First approve — creates the ingest job.
    const first = await request(app)
      .patch(`/api/research-admin/drive/assets/${id}/rights`)
      .set("Cookie", cookie)
      .send({ rightsStatus: "APPROVED" });
    expect(first.status).toBe(200);

    // Step 2: Simulate the job being processed and ending in a terminal state.
    await db.update(researchJobs)
      .set({ state: "CANCELLED" as never })
      .where(eq(researchJobs.idempotencyKey, `drive.ingest:asset:${id}`));

    // Step 3: Reset asset to RESTRICTED so we can re-reject and re-approve it.
    await db.update(driveAssets)
      .set({ rightsStatus: "RESTRICTED_REFERENCE_ONLY", processingStatus: "CANCELLED" })
      .where(eq(driveAssets.id, id));

    // Step 4: Reapprove — must delete the terminal job and insert a fresh QUEUED one.
    const reapprove = await request(app)
      .patch(`/api/research-admin/drive/assets/${id}/rights`)
      .set("Cookie", cookie)
      .send({ rightsStatus: "APPROVED" });
    expect(reapprove.status).toBe(200);
    expect(reapprove.body.rightsStatus).toBe("APPROVED");
    expect(reapprove.body.processingStatus).toBe("PENDING"); // CANCELLED was reset

    const [job] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, `drive.ingest:asset:${id}`));
    expect(job).toBeDefined();
    expect(job!.state).toBe("QUEUED"); // must be runnable, not CANCELLED
  });

  it("reject cancels an active QUEUED ingest job so the worker does not process a rejected asset", async () => {
    const id = await insertAsset({ rightsStatus: "RESTRICTED_REFERENCE_ONLY", processingStatus: "PENDING" });

    // Approve first to enqueue the ingest job.
    const approve = await request(app)
      .patch(`/api/research-admin/drive/assets/${id}/rights`)
      .set("Cookie", cookie)
      .send({ rightsStatus: "APPROVED" });
    expect(approve.status).toBe(200);

    const [jobBefore] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, `drive.ingest:asset:${id}`));
    expect(jobBefore?.state).toBe("QUEUED");

    // Reset back to RESTRICTED so reject endpoint accepts the call.
    await db.update(driveAssets)
      .set({ rightsStatus: "RESTRICTED_REFERENCE_ONLY", processingStatus: "PENDING" })
      .where(eq(driveAssets.id, id));

    // Reject must cancel the active QUEUED job.
    const reject = await request(app)
      .post(`/api/research-admin/drive/assets/${id}/reject`)
      .set("Cookie", cookie)
      .send({});
    expect(reject.status).toBe(200);
    expect(reject.body.processingStatus).toBe("CANCELLED");

    const [jobAfter] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, `drive.ingest:asset:${id}`));
    expect(jobAfter?.state).toBe("CANCELLED");
  });

  it("approve is idempotent: second approve on the same asset does not error", async () => {
    const id = await insertAsset({ rightsStatus: "RESTRICTED_REFERENCE_ONLY", processingStatus: "PENDING" });

    const first = await request(app)
      .patch(`/api/research-admin/drive/assets/${id}/rights`)
      .set("Cookie", cookie)
      .send({ rightsStatus: "APPROVED" });
    expect(first.status).toBe(200);

    const second = await request(app)
      .patch(`/api/research-admin/drive/assets/${id}/rights`)
      .set("Cookie", cookie)
      .send({ rightsStatus: "APPROVED" });
    expect(second.status).toBe(200);
    expect(second.body.rightsStatus).toBe("APPROVED");
  });

  it("returns 404 when approving a non-existent asset", async () => {
    const res = await request(app)
      .patch("/api/research-admin/drive/assets/999999999/rights")
      .set("Cookie", cookie)
      .send({ rightsStatus: "APPROVED" });
    expect(res.status).toBe(404);
  });

  it("rejection of an INGESTION_QUEUED asset with a linked PENDING batch item atomically DEAD_LETTERs the item (deterministic post-link race)", async () => {
    // Simulate the state an ingestBridge produces after its layer-2 transaction
    // commits (batch item linked, processingStatus=INGESTION_QUEUED) but before
    // enqueueIngestJob is called. Rejection at that point must atomically
    // DEAD_LETTER the batch item so any subsequent enqueueIngestJob call cannot
    // produce runnable downstream work with staged commercial bytes.
    const id = await insertAsset({ processingStatus: "INGESTION_QUEUED" });

    // Create an upload batch and a PENDING batch item linked to the asset,
    // matching what ingestBridge.ingestDriveAsset creates in its transaction.
    const [batch] = await db
      .insert(researchUploadBatches)
      .values({
        declaredSource: `google-drive:test-${RUN_ID}`,
        uploadedBy: "drive-bridge",
        provenance: { source: "test" } as Record<string, unknown>,
      })
      .returning({ id: researchUploadBatches.id });

    const [batchItem] = await db
      .insert(researchUploadBatchItems)
      .values({
        batchId: batch!.id,
        originalPath: `test-${RUN_ID}.pdf`,
        contentSha256: "abc123",
        sizeBytes: 1024,
        mimeType: "application/pdf",
        stagingKey: `drive/test-${RUN_ID}/abc123`,
        state: "PENDING" as never,
        detail: {},
      })
      .returning({ id: researchUploadBatchItems.id });

    // Link the batch item to the asset (mirrors ingestBridge transaction).
    await db
      .update(driveAssets)
      .set({ sourceBatchItemId: batchItem!.id })
      .where(eq(driveAssets.id, id));

    // Reject — must atomically DEAD_LETTER the linked batch item.
    const reject = await request(app)
      .post(`/api/research-admin/drive/assets/${id}/reject`)
      .set("Cookie", cookie)
      .send({ reason: "Commercial publisher — no licence" });

    expect(reject.status).toBe(200);
    expect(reject.body.processingStatus).toBe("CANCELLED");

    // The batch item must be DEAD_LETTER so no downstream container.ingest
    // job can treat it as runnable (even if enqueueIngestJob was already called
    // just after the reject transaction committed).
    const [item] = await db
      .select({ state: researchUploadBatchItems.state })
      .from(researchUploadBatchItems)
      .where(eq(researchUploadBatchItems.id, batchItem!.id));
    expect(item?.state).toBe("DEAD_LETTER");

    // Cleanup (batch item FK prevents plain asset delete; clean items first).
    await db
      .update(driveAssets)
      .set({ sourceBatchItemId: null })
      .where(eq(driveAssets.id, id))
      .catch(() => {});
    await db
      .delete(researchUploadBatchItems)
      .where(eq(researchUploadBatchItems.id, batchItem!.id))
      .catch(() => {});
    await db
      .delete(researchUploadBatches)
      .where(eq(researchUploadBatches.id, batch!.id))
      .catch(() => {});
  });

  // ── Bulk reject — scoped to fixture IDs only ───────────────────────────────

  it("bulk reject of an INGESTION_QUEUED asset with a linked PENDING batch item atomically DEAD_LETTERs the item (deterministic bulk post-link race)", async () => {
    // Simulate the post-link mid-flight state: asset is INGESTION_QUEUED and
    // ingestBridge has already committed the batch-item link. Bulk reject must
    // atomically DEAD_LETTER the batch item in the same transaction as the
    // asset cancellation so that even if enqueueIngestJob runs immediately
    // after the transaction commits, the downstream processor finds the item dead.
    const id = await insertAsset({ processingStatus: "INGESTION_QUEUED" });

    const [batch] = await db
      .insert(researchUploadBatches)
      .values({
        declaredSource: `google-drive:bulk-race-${RUN_ID}`,
        uploadedBy: "drive-bridge",
        provenance: { source: "test" } as Record<string, unknown>,
      })
      .returning({ id: researchUploadBatches.id });

    const [batchItem] = await db
      .insert(researchUploadBatchItems)
      .values({
        batchId: batch!.id,
        originalPath: `bulk-race-${RUN_ID}.pdf`,
        contentSha256: "def456",
        sizeBytes: 2048,
        mimeType: "application/pdf",
        stagingKey: `drive/bulk-race-${RUN_ID}/def456`,
        state: "PENDING" as never,
        detail: {},
      })
      .returning({ id: researchUploadBatchItems.id });

    await db
      .update(driveAssets)
      .set({ sourceBatchItemId: batchItem!.id })
      .where(eq(driveAssets.id, id));

    // Bulk reject (scoped to this fixture asset).
    const res = await request(app)
      .post("/api/research-admin/drive/assets/bulk-restricted")
      .set("Cookie", cookie)
      .send({ action: "reject", reason: "Bulk commercial publisher rejection", ids: [id] });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);

    const [item] = await db
      .select({ state: researchUploadBatchItems.state })
      .from(researchUploadBatchItems)
      .where(eq(researchUploadBatchItems.id, batchItem!.id));
    expect(item?.state).toBe("DEAD_LETTER");

    // Cleanup.
    await db.update(driveAssets).set({ sourceBatchItemId: null }).where(eq(driveAssets.id, id)).catch(() => {});
    await db.delete(researchUploadBatchItems).where(eq(researchUploadBatchItems.id, batchItem!.id)).catch(() => {});
    await db.delete(researchUploadBatches).where(eq(researchUploadBatches.id, batch!.id)).catch(() => {});
  });

  it("bulk reject (scoped): cancels PENDING and INGESTION_QUEUED fixture assets, leaves already-CANCELLED ones unchanged, and cancels their active ingest jobs", async () => {
    const pendingId = await insertAsset({ processingStatus: "PENDING" });
    const ingestQueuedId = await insertAsset({ processingStatus: "INGESTION_QUEUED" });
    const cancelledId = await insertAsset({ processingStatus: "CANCELLED" });

    // Seed an active ingest job for the INGESTION_QUEUED asset.
    await db.insert(researchJobs).values({
      kind: "drive.ingest",
      idempotencyKey: `drive.ingest:asset:${ingestQueuedId}`,
      payload: { driveAssetId: ingestQueuedId } as Record<string, unknown>,
      maxAttempts: 3,
      processorVersion: "test",
      provenance: { actor: "test" } as Record<string, unknown>,
      state: "QUEUED" as never,
    }).onConflictDoNothing({ target: researchJobs.idempotencyKey });

    // Pass only fixture IDs — no pre-existing protected content is touched.
    const res = await request(app)
      .post("/api/research-admin/drive/assets/bulk-restricted")
      .set("Cookie", cookie)
      .send({ action: "reject", reason: "Bulk test rejection", ids: [pendingId, ingestQueuedId, cancelledId] });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("reject");
    // PENDING + INGESTION_QUEUED are cancellable; already-CANCELLED is excluded.
    expect(res.body.updated).toBe(2);

    const [pending] = await db.select().from(driveAssets).where(eq(driveAssets.id, pendingId));
    expect(pending?.processingStatus).toBe("CANCELLED");

    const [ingestQueued] = await db.select().from(driveAssets).where(eq(driveAssets.id, ingestQueuedId));
    expect(ingestQueued?.processingStatus).toBe("CANCELLED");

    const [alreadyCancelled] = await db.select().from(driveAssets).where(eq(driveAssets.id, cancelledId));
    expect(alreadyCancelled?.processingStatus).toBe("CANCELLED");

    // The active ingest job for the INGESTION_QUEUED asset must also be cancelled.
    const [job] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, `drive.ingest:asset:${ingestQueuedId}`));
    expect(job?.state).toBe("CANCELLED");
  });

  // ── Bulk approve — scoped to fixture IDs only ──────────────────────────────

  it("bulk approve (scoped): CANCELLED fixture assets reset to PENDING and get ingest jobs", async () => {
    const cancelledId = await insertAsset({
      rightsStatus: "RESTRICTED_REFERENCE_ONLY",
      processingStatus: "CANCELLED",
    });

    const res = await request(app)
      .post("/api/research-admin/drive/assets/bulk-restricted")
      .set("Cookie", cookie)
      .send({ action: "approve", ids: [cancelledId] });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("approve");
    expect(res.body.updated).toBe(1);

    const [row] = await db.select().from(driveAssets).where(eq(driveAssets.id, cancelledId));
    expect(row?.rightsStatus).toBe("APPROVED");
    expect(row?.processingStatus).toBe("PENDING"); // CANCELLED was reset

    const [job] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, `drive.ingest:asset:${cancelledId}`));
    expect(job).toBeDefined();
  });

  it("bulk approve (scoped): PENDING fixture assets are approved and get ingest jobs", async () => {
    const pendingId = await insertAsset({
      rightsStatus: "RESTRICTED_REFERENCE_ONLY",
      processingStatus: "PENDING",
    });

    const res = await request(app)
      .post("/api/research-admin/drive/assets/bulk-restricted")
      .set("Cookie", cookie)
      .send({ action: "approve", ids: [pendingId] });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);

    const [row] = await db.select().from(driveAssets).where(eq(driveAssets.id, pendingId));
    expect(row?.rightsStatus).toBe("APPROVED");
    expect(row?.processingStatus).toBe("PENDING");

    const [job] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, `drive.ingest:asset:${pendingId}`));
    expect(job).toBeDefined();
  });

  it("bulk approve (scoped): ids filter means non-fixture restricted assets are untouched", async () => {
    // Confirm that passing an explicit ids list only affects those rows.
    const fixtureId = await insertAsset({
      rightsStatus: "RESTRICTED_REFERENCE_ONLY",
      processingStatus: "PENDING",
    });
    const bystander = await insertAsset({
      rightsStatus: "RESTRICTED_REFERENCE_ONLY",
      processingStatus: "PENDING",
    });

    // Only approve fixtureId
    const res = await request(app)
      .post("/api/research-admin/drive/assets/bulk-restricted")
      .set("Cookie", cookie)
      .send({ action: "approve", ids: [fixtureId] });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);

    const [fixture] = await db.select().from(driveAssets).where(eq(driveAssets.id, fixtureId));
    const [bystanderRow] = await db.select().from(driveAssets).where(eq(driveAssets.id, bystander));
    expect(fixture?.rightsStatus).toBe("APPROVED");
    expect(bystanderRow?.rightsStatus).toBe("RESTRICTED_REFERENCE_ONLY"); // untouched
  });

  // ── Bulk approve reapproval — terminal job replaced ────────────────────────

  it("bulk approve: CANCELLED fixture asset with terminal CANCELLED job gets a fresh QUEUED job", async () => {
    const id = await insertAsset({
      rightsStatus: "RESTRICTED_REFERENCE_ONLY",
      processingStatus: "CANCELLED",
    });

    // Seed a terminal CANCELLED job that would block onConflictDoNothing.
    await db.insert(researchJobs).values({
      kind: "drive.ingest",
      idempotencyKey: `drive.ingest:asset:${id}`,
      payload: { driveAssetId: id } as Record<string, unknown>,
      maxAttempts: 3,
      processorVersion: "test",
      provenance: { actor: "test" } as Record<string, unknown>,
      state: "CANCELLED" as never,
    }).onConflictDoNothing({ target: researchJobs.idempotencyKey });

    const res = await request(app)
      .post("/api/research-admin/drive/assets/bulk-restricted")
      .set("Cookie", cookie)
      .send({ action: "approve", ids: [id] });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);
    expect(res.body.ingestionQueued).toBe(1); // old terminal job replaced

    const [job] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, `drive.ingest:asset:${id}`));
    expect(job).toBeDefined();
    expect(job!.state).toBe("QUEUED"); // must be runnable, not CANCELLED
  });

  // ── Empty ids[] is a no-op — must never fall through to global bulk ────────

  it("bulk reject with ids=[] is a no-op: no rows are changed", async () => {
    const pendingId = await insertAsset({ processingStatus: "PENDING" });

    const res = await request(app)
      .post("/api/research-admin/drive/assets/bulk-restricted")
      .set("Cookie", cookie)
      .send({ action: "reject", ids: [] });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(0);

    // Our fixture asset must be untouched
    const [row] = await db.select().from(driveAssets).where(eq(driveAssets.id, pendingId));
    expect(row?.processingStatus).toBe("PENDING");
  });

  it("bulk approve with ids=[] is a no-op: no rows or ingest jobs are created", async () => {
    const restrictedId = await insertAsset({
      rightsStatus: "RESTRICTED_REFERENCE_ONLY",
      processingStatus: "PENDING",
    });

    const res = await request(app)
      .post("/api/research-admin/drive/assets/bulk-restricted")
      .set("Cookie", cookie)
      .send({ action: "approve", ids: [] });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(0);
    expect(res.body.ingestionQueued).toBe(0);

    // Our fixture asset must be untouched
    const [row] = await db.select().from(driveAssets).where(eq(driveAssets.id, restrictedId));
    expect(row?.rightsStatus).toBe("RESTRICTED_REFERENCE_ONLY");
    expect(row?.processingStatus).toBe("PENDING");

    // No ingest job should have been created
    const [job] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, `drive.ingest:asset:${restrictedId}`));
    expect(job).toBeUndefined();
  });

  // ── Bulk schema validation ─────────────────────────────────────────────────

  it("bulk-restricted returns 400 for an invalid action", async () => {
    const res = await request(app)
      .post("/api/research-admin/drive/assets/bulk-restricted")
      .set("Cookie", cookie)
      .send({ action: "delete" });
    expect(res.status).toBe(400);
  });

  it("bulk-restricted returns 400 for a negative id in the ids array", async () => {
    const res = await request(app)
      .post("/api/research-admin/drive/assets/bulk-restricted")
      .set("Cookie", cookie)
      .send({ action: "reject", ids: [-1] });
    expect(res.status).toBe(400);
  });
});
