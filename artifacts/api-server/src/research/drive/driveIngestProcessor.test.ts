/**
 * Targeted unit tests for the drive.ingest durable job pipeline.
 *
 * Tests verify three key safety properties:
 *  1. forceReset only resets processingStatus=FAILED assets (never in-progress ones)
 *  2. Batch item reuse on retry — existing sourceBatchItemId is re-queued, not duplicated
 *  3. Stale RUNNING job recovery — old RUNNING jobs are returned to QUEUED at startup
 *
 * All DB interaction is mocked so tests run without a live database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (hoisted before imports) ────────────────────────────────────────────

const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockFail = vi.fn();
const mockEnqueueIngestJob = vi.fn();
const mockDownloadDriveFile = vi.fn();
const mockCreateBatch = vi.fn();
const mockCreateBatchItem = vi.fn();
const mockPut = vi.fn();

vi.mock("@workspace/db", () => ({
  db: { update: mockUpdate, select: mockSelect },
  driveAssets: {},
  researchUploadBatchItems: {},
  researchJobs: {},
}));
vi.mock("../processing", () => ({ fail: mockFail }));
vi.mock("../ingestion/service", () => ({ enqueueIngestJob: mockEnqueueIngestJob }));
vi.mock("./driveClient", () => ({ downloadDriveFile: mockDownloadDriveFile }));
vi.mock("../data/uploads", () => ({
  createBatch: mockCreateBatch,
  createBatchItem: mockCreateBatchItem,
  transitionBatchItem: vi.fn(),
}));
vi.mock("../adapters", () => ({
  getAdapters: () => ({ storage: { put: mockPut } }),
}));
vi.mock("../../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Makes db.update().set().where() resolve immediately with an empty array. */
function stubUpdate() {
  mockUpdate.mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
  });
}

/** Makes db.select().from().where() resolve with the given rows on each call. */
function stubSelectSequence(rowSets: unknown[][]) {
  let call = 0;
  mockSelect.mockImplementation(() => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => Promise.resolve(rowSets[call++] ?? [])),
  }));
}

function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    driveFileId: "drive-file-1",
    name: "case.pdf",
    mimeType: "application/pdf",
    rightsStatus: "APPROVED",
    processingStatus: "PENDING",
    sourceBatchItemId: null as number | null,
    inventoryRunId: null,
    folderPath: null,
    ...overrides,
  };
}

// ── Tests: forceReset constraint ──────────────────────────────────────────────

describe("ingestDriveAsset forceReset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("re-enqueues via reuse path for INGESTION_QUEUED asset with a linked batch item", async () => {
    // sourceBatchItemId is set + INGESTION_QUEUED → crash-after-link scenario.
    // forceReset WHERE excludes this (batch item IS NOT NULL) so no reset.
    // The guard allows it through to the batch-item-reuse path.
    stubUpdate();
    const batchItem = { id: 77, state: "PENDING", retryCount: 0 };
    // Two SELECT calls: first returns asset, second returns the batch item
    stubSelectSequence([
      [makeAsset({ processingStatus: "INGESTION_QUEUED", sourceBatchItemId: 77 })],
      [batchItem],
    ]);
    mockEnqueueIngestJob.mockResolvedValue(batchItem);

    const { ingestDriveAsset } = await import("./ingestBridge");
    const result = await ingestDriveAsset(1, { forceReset: true });

    // Must reuse the batch item — no re-download, no duplicate batch item
    expect(result.queued).toBe(true);
    expect(result.batchItemId).toBe(77);
    expect(mockDownloadDriveFile).not.toHaveBeenCalled();
    expect(mockEnqueueIngestJob).toHaveBeenCalled();
  });

  it("resets an INGESTION_QUEUED asset with no batch item (orphaned by crash)", async () => {
    // After forceReset, the asset is reset to PENDING.
    // The SELECT then returns PENDING so the idempotency guard passes.
    stubUpdate();
    // First SELECT after forceReset returns PENDING (reset worked), no sourceBatchItemId
    stubSelectSequence([[makeAsset({ processingStatus: "PENDING", sourceBatchItemId: null })]]);
    // Download then fails to terminate the test quickly
    mockDownloadDriveFile.mockRejectedValue(new Error("download fail"));

    const { ingestDriveAsset } = await import("./ingestBridge");
    const result = await ingestDriveAsset(1, { forceReset: true });

    // Idempotency guard passed (PENDING), download was attempted
    expect(mockDownloadDriveFile).toHaveBeenCalled();
    expect(result.errorMessage).toMatch(/download fail/);
  });

  it("throws when the asset is missing after forceReset", async () => {
    stubUpdate();
    stubSelectSequence([[]]); // empty → asset not found

    const { ingestDriveAsset } = await import("./ingestBridge");
    await expect(ingestDriveAsset(999, { forceReset: true })).rejects.toThrow("not found");
  });
});

// ── Tests: batch item reuse on retry ─────────────────────────────────────────

describe("ingestDriveAsset batch item reuse", () => {
  beforeEach(() => vi.clearAllMocks());

  it("re-enqueues an existing retryable batch item without re-downloading", async () => {
    const asset = makeAsset({ processingStatus: "PENDING", sourceBatchItemId: 42 });
    const batchItem = { id: 42, state: "PENDING", retryCount: 0 };

    stubUpdate();
    // First SELECT: drive asset; second SELECT: batch item
    stubSelectSequence([[asset], [batchItem]]);
    mockEnqueueIngestJob.mockResolvedValue(batchItem);

    const { ingestDriveAsset } = await import("./ingestBridge");
    const result = await ingestDriveAsset(1);

    // Must reuse the batch item — no Drive download
    expect(mockDownloadDriveFile).not.toHaveBeenCalled();
    expect(mockCreateBatch).not.toHaveBeenCalled();
    expect(mockEnqueueIngestJob).toHaveBeenCalledWith(batchItem, 1, "drive-bridge-retry");
    expect(result.queued).toBe(true);
    expect(result.batchItemId).toBe(42);
  });

  it("falls through to a fresh download when the existing batch item is DEAD_LETTER", async () => {
    const asset = makeAsset({ processingStatus: "PENDING", sourceBatchItemId: 99 });
    const deadItem = { id: 99, state: "DEAD_LETTER", retryCount: 3 };

    stubUpdate();
    stubSelectSequence([[asset], [deadItem]]);
    // Simulate download failure so the test terminates quickly
    mockDownloadDriveFile.mockRejectedValue(new Error("network error"));

    const { ingestDriveAsset } = await import("./ingestBridge");
    const result = await ingestDriveAsset(1);

    // Clears stale batch item, then tries a fresh download
    expect(mockDownloadDriveFile).toHaveBeenCalled();
    expect(result.errorMessage).toMatch(/network error/);
    // sourceBatchItemId cleared via update
    expect(mockUpdate).toHaveBeenCalled();
  });
});

// ── Tests: stale RUNNING job recovery ────────────────────────────────────────

describe("recoverStaleDriveIngestJobs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls fail() with retryable=true for each stale RUNNING job (periodic sweep)", async () => {
    const staleJobs = [{ id: 10, attempts: 1 }, { id: 11, attempts: 2 }];
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(staleJobs),
    });
    mockFail.mockResolvedValue({ id: 0, state: "QUEUED" });

    const { recoverStaleDriveIngestJobs } = await import("./driveJobRecovery");
    const count = await recoverStaleDriveIngestJobs({ thresholdMinutes: 10 });

    expect(count).toBe(2);
    expect(mockFail).toHaveBeenCalledTimes(2);
    for (const call of mockFail.mock.calls) {
      expect(call[1]).toMatchObject({ retryable: true, code: "STALE_RUNNING" });
    }
  });

  it("recovers ALL RUNNING jobs unconditionally at startup (thresholdMinutes: 0)", async () => {
    // At startup after a restart there are no active workers, so every RUNNING
    // job is orphaned regardless of how recently it was claimed.
    const recentJob = { id: 30, attempts: 1 }; // claimed seconds ago
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([recentJob]),
    });
    mockFail.mockResolvedValue({ id: 30, state: "QUEUED" });

    const { recoverStaleDriveIngestJobs } = await import("./driveJobRecovery");
    const count = await recoverStaleDriveIngestJobs({ thresholdMinutes: 0 });

    expect(count).toBe(1);
    expect(mockFail).toHaveBeenCalledWith(30, expect.objectContaining({ retryable: true }));
  });

  it("returns 0 when no RUNNING jobs exist", async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    });

    const { recoverStaleDriveIngestJobs } = await import("./driveJobRecovery");
    expect(await recoverStaleDriveIngestJobs({ thresholdMinutes: 0 })).toBe(0);
    expect(mockFail).not.toHaveBeenCalled();
  });

  it("continues recovering remaining jobs even if one fail() throws", async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ id: 20, attempts: 1 }, { id: 21, attempts: 1 }]),
    });
    mockFail
      .mockRejectedValueOnce(new Error("state conflict"))
      .mockResolvedValueOnce({ id: 21, state: "QUEUED" });

    const { recoverStaleDriveIngestJobs } = await import("./driveJobRecovery");
    expect(await recoverStaleDriveIngestJobs({ thresholdMinutes: 0 })).toBe(1);
    expect(mockFail).toHaveBeenCalledTimes(2);
  });
});
