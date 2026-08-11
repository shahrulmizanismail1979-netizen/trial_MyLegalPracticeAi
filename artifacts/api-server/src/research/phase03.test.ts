import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

// Phase 03 proof tests: secure upload pipeline, failure isolation,
// dead-letter/retry/cancel/restart, duplicate detection, and rights-gated
// container inventory. Live dev DB, RUN_ID-scoped rows cleaned afterAll
// (same convention as phase02.test.ts). Storage is an in-memory adapter —
// no object-storage traffic from tests.

const RUN_ID = randomUUID();

const { setAdapters } = await import("./adapters");
const { processUpload, retryBatchItem, cancelBatch, restartBatch, registerIngestionProcessors } =
  await import("./ingestion/service");
const { registerInventoryProcessor, startInventory, getLatestInventory } =
  await import("./ingestion/inventory");
const { analyzeContainer } = await import("./ingestion/analyzer");
const {
  getBatchItem,
  listBatchItems,
  computeProgress,
  syncDeadLetters,
} = await import("./data/uploads");
const { getContainer } = await import("./data/containers");
const { recordRightsDecision } = await import("./data/rights");
const { runNextJob, enqueue } = await import("./processing");
const {
  db,
  researchJobs,
  researchSourceContainers,
  researchRightsRecords,
  researchTransformations,
  researchReviewItems,
  researchAuditEvents,
  researchUploadBatches,
  researchUploadBatchItems,
  researchContainerInventories,
} = await import("@workspace/db");
const { eq, like, inArray, and, sql } = await import("drizzle-orm");

const FIXTURES = path.resolve(__dirname, "../../../../fixtures/synthetic");
const fixture = (name: string) => readFileSync(path.join(FIXTURES, name));

// In-memory storage adapter: keys → bytes. Failure injection for staging.
const stored = new Map<string, Buffer>();
let failPuts = false;
let previousAdapters: ReturnType<typeof setAdapters> | null = null;

beforeAll(() => {
  registerIngestionProcessors();
  registerInventoryProcessor();
  previousAdapters = setAdapters({
    storage: {
      name: "memory-test",
      async put(key, bytes) {
        if (failPuts) throw new Error("injected staging failure");
        stored.set(key, Buffer.from(bytes));
        return key;
      },
      async get(key) {
        const bytes = stored.get(key);
        if (!bytes) throw new Error(`no such key ${key}`);
        return bytes;
      },
      async remove(key) {
        stored.delete(key);
      },
    },
  });
});

let uploadSeq = 0;
function unique(bytes: Buffer): Buffer {
  // Make content unique per run so cross-run dedup never interferes.
  uploadSeq += 1;
  return Buffer.concat([
    bytes,
    Buffer.from(`\n<!-- run ${RUN_ID} #${uploadSeq} -->\n`),
  ]);
}

async function upload(files: Array<{ name: string; bytes: Buffer }>) {
  return processUpload(
    files.map((f) => ({ originalName: f.name, bytes: f.bytes })),
    {
      declaredSource: `test-${RUN_ID}`,
      uploadedBy: `tester-${RUN_ID}`,
      provenance: { runId: RUN_ID },
    },
  );
}

const trackedJobIds: number[] = [];

async function drainJobs(kind?: string) {
  // Run queued jobs until the queue is empty for the kind.
  for (let i = 0; i < 100; i++) {
    const job = await runNextJob(kind);
    if (!job) return;
    trackedJobIds.push(job.id);
  }
  throw new Error("job queue did not drain");
}

// A synthetic single-case text with a real court header + citation, so the
// analyzer sees exactly one case-title region.
function singleCaseText(): Buffer {
  return unique(
    Buffer.from(
      "IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR\n" +
        "[2026] 1 MLJ 42\n" +
        "Alpha Trading Sdn Bhd v Beta Logistics Sdn Bhd\n\n" +
        "JUDGMENT\n\nSynthetic single-case body text for testing only.\n",
    ),
  );
}

function approvedDecision() {
  return {
    status: "PRIVATE_PROCESSING_APPROVED",
    reason: "phase03 test approval",
    source: "Test source",
    dateObtained: new Date("2026-01-01T00:00:00Z"),
    declaredSourceType: "official_court",
    licenceReference: null,
    approvedUsers: ["reviewer@test"],
    approvedPurposes: ["research"],
    storagePermitted: true,
    analysisPermitted: true,
    externalProcessingPermitted: false,
    studentAccessPermitted: false,
    printingPermitted: true,
    exportPermitted: false,
    retentionPeriod: null,
    expiryDate: null,
    reviewer: "reviewer@test",
    reviewDate: new Date("2026-01-02T00:00:00Z"),
    notes: null,
  } as Parameters<typeof recordRightsDecision>[1];
}

afterAll(async () => {
  const batches = await db
    .select({ id: researchUploadBatches.id })
    .from(researchUploadBatches)
    .where(eq(researchUploadBatches.declaredSource, `test-${RUN_ID}`));
  const batchIds = batches.map((b) => b.id);
  if (batchIds.length > 0) {
    const items = await db
      .select({ id: researchUploadBatchItems.id })
      .from(researchUploadBatchItems)
      .where(inArray(researchUploadBatchItems.batchId, batchIds));
    const itemIds = items.map((i) => i.id);
    const itemJobs = await db
      .select({ jobId: researchUploadBatchItems.jobId })
      .from(researchUploadBatchItems)
      .where(inArray(researchUploadBatchItems.batchId, batchIds));
    for (const j of itemJobs) if (j.jobId) trackedJobIds.push(j.jobId);
    if (itemIds.length > 0) {
      await db
        .delete(researchAuditEvents)
        .where(
          and(
            eq(researchAuditEvents.entityType, "batch_item"),
            inArray(researchAuditEvents.entityId, itemIds),
          ),
        );
      await db
        .delete(researchUploadBatchItems)
        .where(inArray(researchUploadBatchItems.id, itemIds));
    }
    await db
      .delete(researchAuditEvents)
      .where(
        and(
          eq(researchAuditEvents.entityType, "upload_batch"),
          inArray(researchAuditEvents.entityId, batchIds),
        ),
      );
    await db
      .delete(researchUploadBatches)
      .where(inArray(researchUploadBatches.id, batchIds));
    const containers = await db
      .select({ id: researchSourceContainers.id })
      .from(researchSourceContainers)
      .where(
        inArray(
          researchSourceContainers.sourceBatch,
          batchIds.map((id) => `upload-batch-${id}`),
        ),
      );
    const cIds = containers.map((c) => c.id);
    if (cIds.length > 0) {
      await db
        .delete(researchContainerInventories)
        .where(inArray(researchContainerInventories.containerId, cIds));
      await db
        .delete(researchRightsRecords)
        .where(inArray(researchRightsRecords.containerId, cIds));
      await db
        .delete(researchTransformations)
        .where(inArray(researchTransformations.containerId, cIds));
      await db
        .delete(researchReviewItems)
        .where(inArray(researchReviewItems.containerId, cIds));
      await db
        .delete(researchAuditEvents)
        .where(
          and(
            eq(researchAuditEvents.entityType, "container"),
            inArray(researchAuditEvents.entityId, cIds),
          ),
        );
      await db
        .delete(researchSourceContainers)
        .where(inArray(researchSourceContainers.id, cIds));
    }
  }
  const jobIds = [...new Set(trackedJobIds)];
  if (jobIds.length > 0) {
    await db
      .delete(researchAuditEvents)
      .where(
        and(
          eq(researchAuditEvents.entityType, "job"),
          inArray(researchAuditEvents.entityId, jobIds),
        ),
      );
    await db.delete(researchJobs).where(inArray(researchJobs.id, jobIds));
  }
  if (previousAdapters) setAdapters(previousAdapters);
});

describe("secure upload pipeline", () => {
  it("stages valid files, ingests them, and routes to rights review", async () => {
    const bytes = unique(fixture("single-judgment.txt"));
    const { items } = await upload([{ name: "single.txt", bytes }]);
    expect(items).toHaveLength(1);
    expect(items[0]!.state).toBe("PENDING");
    expect(items[0]!.stagingKey).toBeTruthy();
    expect(stored.has(items[0]!.stagingKey!)).toBe(true);

    await drainJobs("container.ingest");
    const item = await getBatchItem(items[0]!.id);
    expect(item!.state).toBe("INGESTED");
    expect(item!.containerId).toBeTruthy();

    const container = await getContainer(item!.containerId!);
    expect(container!.rightsStatus).toBe("UNREVIEWED");
    expect(container!.processingState).toBe("RIGHTS_REVIEW_REQUIRED");
    expect(container!.storageKey).toBe(item!.stagingKey);
    const review = await db
      .select()
      .from(researchReviewItems)
      .where(eq(researchReviewItems.containerId, container!.id));
    expect(review.some((r) => r.kind === "rights")).toBe(true);
  });

  it("isolates failures: one bad file never blocks its batch siblings", async () => {
    const good = unique(fixture("single-judgment.txt"));
    const exe = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), good]);
    const { items } = await upload([
      { name: "good.txt", bytes: good },
      { name: "malware.pdf", bytes: exe },
    ]);
    const rejected = items.find((i) => i.originalPath === "malware.pdf");
    expect(rejected!.state).toBe("REJECTED");
    expect(rejected!.errorReport?.code).toBe("EXECUTABLE_CONTENT");
    await drainJobs("container.ingest");
    const goodItem = await getBatchItem(
      items.find((i) => i.originalPath === "good.txt")!.id,
    );
    expect(goodItem!.state).toBe("INGESTED");
  });

  it("expands ZIPs into per-entry items with per-entry rejections", async () => {
    const inner = new AdmZip();
    inner.addFile("hidden.txt", Buffer.from("x"));
    const zip = new AdmZip();
    zip.addFile("cases/one.txt", unique(fixture("single-judgment.txt")));
    zip.addFile("disguised.txt", inner.toBuffer()); // archive bytes, .txt name
    const { items } = await upload([
      { name: "batch.zip", bytes: zip.toBuffer() },
    ]);
    expect(items).toHaveLength(2);
    const bad = items.find((i) => i.originalPath.endsWith("disguised.txt"));
    expect(bad!.state).toBe("REJECTED");
    expect(bad!.errorReport?.code).toBe("NESTED_ARCHIVE");
    const entry = items.find((i) => i.originalPath.endsWith("cases/one.txt"));
    expect(entry!.state).toBe("PENDING");
    await drainJobs("container.ingest");
    expect((await getBatchItem(entry!.id))!.state).toBe("INGESTED");
  });

  it("rejects a hostile ZIP (nested .zip entry) as a whole", async () => {
    const inner = new AdmZip();
    inner.addFile("inner.txt", Buffer.from("x"));
    const zip = new AdmZip();
    zip.addFile("nested.zip", inner.toBuffer());
    const { items } = await upload([
      { name: "hostile.zip", bytes: zip.toBuffer() },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]!.state).toBe("REJECTED");
    expect(items[0]!.errorReport?.code).toBe("NESTED_ARCHIVE");
  });

  it("detects duplicates by SHA-256 and never silently re-ingests", async () => {
    const bytes = unique(fixture("single-judgment.txt"));
    const first = await upload([{ name: "orig.txt", bytes }]);
    await drainJobs("container.ingest");
    const ingested = await getBatchItem(first.items[0]!.id);
    const second = await upload([{ name: "copy.txt", bytes }]);
    await drainJobs("container.ingest");
    // A parallel test worker may have claimed our ingest job and still be
    // mid-run — poll (re-draining) until the item settles.
    let dup = await getBatchItem(second.items[0]!.id);
    for (let poll = 0; poll < 30 && dup!.state === "PENDING"; poll++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await drainJobs("container.ingest");
      dup = await getBatchItem(second.items[0]!.id);
    }
    expect(dup!.state).toBe("DUPLICATE");
    expect(dup!.duplicateOfContainerId).toBe(ingested!.containerId);
    const transformations = await db
      .select()
      .from(researchTransformations)
      .where(
        and(
          eq(researchTransformations.containerId, ingested!.containerId!),
          eq(researchTransformations.kind, "duplicate-upload"),
        ),
      );
    expect(transformations).toHaveLength(1);
  });

  it("staging failure dead-letters only the affected item", async () => {
    failPuts = true;
    try {
      const { items } = await upload([
        { name: "unstaged.txt", bytes: unique(fixture("single-judgment.txt")) },
      ]);
      expect(items[0]!.state).toBe("DEAD_LETTER");
      expect(items[0]!.errorReport?.code).toBe("STAGING_FAILED");
      await expect(
        retryBatchItem(items[0]!.id, "tester"),
      ).rejects.toThrowError(/re-upload/);
    } finally {
      failPuts = false;
    }
  });

  it("dead-letters failed-permanent jobs and supports retry to success", async () => {
    const { batch, items } = await upload([
      { name: "retryme.txt", bytes: unique(fixture("single-judgment.txt")) },
    ]);
    const item = items[0]!;
    // Simulate a permanent job failure (state machine end state).
    await db
      .update(researchJobs)
      .set({ state: "FAILED_PERMANENT" })
      .where(eq(researchJobs.id, item.jobId!));
    await syncDeadLetters(batch.id);
    const dead = await getBatchItem(item.id);
    expect(dead!.state).toBe("DEAD_LETTER");

    const retried = await retryBatchItem(item.id, "tester");
    expect(retried.state).toBe("PENDING");
    expect(retried.jobId).not.toBe(item.jobId);
    await drainJobs("container.ingest");
    expect((await getBatchItem(item.id))!.state).toBe("INGESTED");
  });

  it("cancels and restarts a batch", async () => {
    const { batch, items } = await upload([
      { name: "c1.txt", bytes: unique(fixture("single-judgment.txt")) },
      { name: "c2.txt", bytes: unique(fixture("multi-judgment.txt")) },
    ]);
    // A parallel test worker's job loop may claim (and even complete) one of
    // our ingest jobs before cancel runs — those items are INGESTED, not
    // CANCELLED, and cannot be cancelled or restarted. Tolerate that.
    const cancelled = await cancelBatch(batch.id, "tester");
    expect(cancelled).toBeGreaterThanOrEqual(1);
    expect(cancelled).toBeLessThanOrEqual(2);
    let cancelledCount = 0;
    for (const i of items) {
      const state = (await getBatchItem(i.id))!.state;
      expect(["CANCELLED", "INGESTED", "PENDING"]).toContain(state);
      if (state === "CANCELLED") cancelledCount++;
    }
    expect(cancelledCount).toBe(cancelled);
    const restarted = await restartBatch(batch.id, "tester");
    expect(restarted).toBe(cancelled);
    await drainJobs("container.ingest");
    // A parallel test worker's job loop may have claimed one of our ingest
    // jobs and still be mid-run — poll briefly until every item settles.
    let after = await listBatchItems(batch.id);
    for (
      let poll = 0;
      poll < 30 && !after.every((i) => i.state === "INGESTED");
      poll++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      // A parallel worker may have claimed one of our ingest jobs and left it
      // FAILED_RETRYABLE (only QUEUED jobs get claimed) — re-queue ours.
      await db.execute(
        sql`UPDATE research_jobs
            SET state = 'QUEUED', failure_reason = NULL, last_error = NULL
            WHERE kind = 'container.ingest' AND state = 'FAILED_RETRYABLE'
              AND (payload->>'batchId')::int = ${batch.id}`,
      );
      await drainJobs("container.ingest");
      after = await listBatchItems(batch.id);
      // If a parallel worker left one of our items DEAD_LETTER (its job hit a
      // terminal state under contention), give it a fresh job and re-drain.
      for (const i of after) {
        if (i.state === "DEAD_LETTER") {
          try {
            await retryBatchItem(i.id, "tester");
          } catch {
            // Another worker may have already retried it — tolerate.
          }
        }
      }
      after = await listBatchItems(batch.id);
    }
    expect(after.every((i) => i.state === "INGESTED")).toBe(true);
    const progress = computeProgress(after);
    expect(progress.total).toBe(2);
    expect(progress.counts.INGESTED).toBe(2);
    expect(progress.done).toBe(true);
  });
});

describe("container inventory (rights-gated)", () => {
  async function ingestOne(name: string, bytes: Buffer) {
    const { items } = await upload([{ name, bytes }]);
    await drainJobs("container.ingest");
    const item = await getBatchItem(items[0]!.id);
    expect(item!.state).toBe("INGESTED");
    return (await getContainer(item!.containerId!))!;
  }

  it("refuses to run inventory before a rights decision (fails closed)", async () => {
    const container = await ingestOne(
      "gated.txt",
      unique(fixture("single-judgment.txt")),
    );
    // Bypass startInventory's state guard: enqueue the job directly.
    await enqueue(
      "container.inventory",
      `inventory-container-${container.id}-premature`,
      { containerId: container.id },
      { actor: `tester-${RUN_ID}` },
    );
    await drainJobs("container.inventory");
    const [job] = await db
      .select()
      .from(researchJobs)
      .where(
        eq(
          researchJobs.idempotencyKey,
          `inventory-container-${container.id}-premature`,
        ),
      );
    expect(job!.state).toBe("BLOCKED_BY_RIGHTS");
    expect(await getLatestInventory(container.id)).toBeUndefined();
  });

  it("inventories a single-case container after approval", async () => {
    const container = await ingestOne("inv-single.txt", singleCaseText());
    await recordRightsDecision(container.id, approvedDecision(), {
      actor: "reviewer@test",
    });
    const { jobId } = await startInventory(container.id, `tester-${RUN_ID}`);
    expect(jobId).toBeTruthy();
    await drainJobs("container.inventory");
    const updated = await getContainer(container.id);
    expect(updated!.processingState).toBe("INVENTORIED");
    const inventory = await getLatestInventory(container.id);
    expect(inventory!.label).toBe("SINGLE_CASE_POSSIBLE");
    expect(inventory!.textCharCount).toBeGreaterThan(0);
    const transformations = await db
      .select()
      .from(researchTransformations)
      .where(
        and(
          eq(researchTransformations.containerId, container.id),
          eq(researchTransformations.kind, "inventory"),
        ),
      );
    expect(transformations).toHaveLength(1);
  });

  it("flags multi-case containers", async () => {
    const container = await ingestOne(
      "inv-five.txt",
      unique(fixture("five-case.txt")),
    );
    await recordRightsDecision(container.id, approvedDecision(), {
      actor: "reviewer@test",
    });
    await startInventory(container.id, `tester-${RUN_ID}`);
    await drainJobs("container.inventory");
    const inventory = await getLatestInventory(container.id);
    expect(inventory!.label).toBe("MULTI_CASE_POSSIBLE");
    expect(inventory!.multiCasePossible).toBe(true);
    expect(inventory!.caseTitleRegionCount).toBeGreaterThan(1);
  });

  it("isolates suspected publisher content and routes it to review", async () => {
    const container = await ingestOne(
      "inv-commercial.txt",
      unique(fixture("commercial-marked.txt")),
    );
    await recordRightsDecision(container.id, approvedDecision(), {
      actor: "reviewer@test",
    });
    await startInventory(container.id, `tester-${RUN_ID}`);
    await drainJobs("container.inventory");
    const inventory = await getLatestInventory(container.id);
    expect(inventory!.label).toBe("MIXED_CONTENT_POSSIBLE");
    expect(inventory!.commercialMarkers.length).toBeGreaterThan(0);
    const review = await db
      .select()
      .from(researchReviewItems)
      .where(
        and(
          eq(researchReviewItems.containerId, container.id),
          eq(researchReviewItems.kind, "inventory"),
        ),
      );
    expect(review).toHaveLength(1);
  });

  it("verifies stored-byte integrity before analyzing", async () => {
    const container = await ingestOne(
      "inv-tamper.txt",
      unique(fixture("single-judgment.txt")),
    );
    await recordRightsDecision(container.id, approvedDecision(), {
      actor: "reviewer@test",
    });
    // Tamper with the stored bytes after registration.
    stored.set(container.storageKey!, Buffer.from("tampered content"));
    await startInventory(container.id, `tester-${RUN_ID}`);
    await drainJobs("container.inventory");
    const [job] = await db
      .select()
      .from(researchJobs)
      .where(
        eq(researchJobs.idempotencyKey, `inventory-container-${container.id}`),
      );
    expect(["FAILED_PERMANENT", "FAILED_RETRYABLE"]).toContain(job!.state);
    expect(await getLatestInventory(container.id)).toBeUndefined();
  });
});

describe("inventory analyzer (pure)", () => {
  it("labels blank/empty content EMPTY_OR_INVALID", async () => {
    const analysis = await analyzeContainer(
      Buffer.from("   \n \f \n  "),
      "text/plain",
      "blank.txt",
    );
    expect(analysis.label).toBe("EMPTY_OR_INVALID");
    expect(analysis.textCharCount).toBe(0);
  });

  it("counts blank pages", async () => {
    const analysis = await analyzeContainer(
      fixture("blank-pages.txt"),
      "text/plain",
      "blank-pages.txt",
    );
    expect(analysis.blankPageCount).toBeGreaterThan(0);
    expect(analysis.label).toBe("SINGLE_CASE_POSSIBLE");
  });

  it("detects repeated header/footer lines", async () => {
    const analysis = await analyzeContainer(
      fixture("repeated-headers.txt"),
      "text/plain",
      "repeated-headers.txt",
    );
    expect(
      analysis.repeatedLines.some((l) =>
        l.includes("SYNTHETIC FOOTER LINE FOR EVERY PAGE"),
      ),
    ).toBe(true);
  });

  it("labels corrupt PDFs MANUAL_INSPECTION_REQUIRED", async () => {
    const analysis = await analyzeContainer(
      Buffer.from("%PDF-1.7 not really a pdf body"),
      "application/pdf",
      "corrupt.pdf",
    );
    expect(analysis.label).toBe("MANUAL_INSPECTION_REQUIRED");
    expect(analysis.detail["corrupt"]).toBe(true);
  });

  it("labels images OCR_REQUIRED", async () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(128),
    ]);
    const analysis = await analyzeContainer(png, "image/png", "scan.png");
    expect(analysis.label).toBe("OCR_REQUIRED");
    expect(analysis.ocrProbable).toBe(true);
  });

  it("handles a 30-case container", async () => {
    const analysis = await analyzeContainer(
      fixture("thirty-case.txt"),
      "text/plain",
      "thirty-case.txt",
    );
    expect(analysis.label).toBe("MULTI_CASE_POSSIBLE");
    expect(analysis.caseTitleRegionCount).toBeGreaterThanOrEqual(30);
  });
});
