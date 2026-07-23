import { describe, it, expect, afterAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const RUN_ID = randomUUID();
const BATCH = `test-batch-${RUN_ID}`;

const { getAdapters, setAdapters } = await import("./adapters");
const { enqueue, claimNext, complete, fail, runNextJob } =
  await import("./processing");
const { registerContainer, getContainer, routeToReview } =
  await import("./data/containers");
const {
  db,
  researchJobs,
  researchSourceContainers,
  researchTransformations,
  researchReviewItems,
  researchAuditEvents,
} = await import("@workspace/db");
const { eq, like, inArray, and } = await import("drizzle-orm");

const FIXTURES = path.resolve(__dirname, "../../../../fixtures/synthetic");

async function fixtureContainer(name: string) {
  const bytes = await readFile(path.join(FIXTURES, name));
  return registerContainer({
    originalName: name,
    sourceBatch: BATCH,
    contentSha256: createHash("sha256").update(bytes).digest("hex"),
    sizeBytes: bytes.length,
    mimeType: "text/plain",
    provenance: { enteredVia: "test", runId: RUN_ID },
  });
}

afterAll(async () => {
  const rows = await db
    .select({ id: researchSourceContainers.id })
    .from(researchSourceContainers)
    .where(eq(researchSourceContainers.sourceBatch, BATCH));
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    await db
      .delete(researchTransformations)
      .where(inArray(researchTransformations.containerId, ids));
    await db
      .delete(researchReviewItems)
      .where(inArray(researchReviewItems.containerId, ids));
    await db
      .delete(researchAuditEvents)
      .where(
        and(
          eq(researchAuditEvents.entityType, "container"),
          inArray(researchAuditEvents.entityId, ids),
        ),
      );
    await db
      .delete(researchSourceContainers)
      .where(inArray(researchSourceContainers.id, ids));
  }
  const jobs = await db
    .select({ id: researchJobs.id })
    .from(researchJobs)
    .where(like(researchJobs.idempotencyKey, `%${RUN_ID}%`));
  const jobIds = jobs.map((j) => j.id);
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
});

describe("adapter registry", () => {
  it("resolves defaults with OCR and AI disabled", async () => {
    const adapters = getAdapters();
    expect(adapters.storage.name).toBe("replit-object-storage");
    expect(adapters.ocr.isEnabled()).toBe(false);
    expect(adapters.ai.isEnabled()).toBe(false);
  });

  it("rejects AI propositions while disabled", async () => {
    await expect(getAdapters().ai.propose("anything")).rejects.toThrow(
      /disabled/,
    );
  });

  it("is replaceable and restorable", () => {
    const previous = setAdapters({
      search: {
        name: "test-search",
        index: async () => {},
        search: async () => [],
      },
    });
    expect(getAdapters().search.name).toBe("test-search");
    setAdapters(previous);
    expect(getAdapters().search.name).toBe("postgres-search-stub");
  });
});

describe("source containers (rights gating + provenance)", () => {
  it("registers a container starting UNREVIEWED and UPLOADED", async () => {
    const container = await fixtureContainer("single-judgment.txt");
    expect(container.rightsStatus).toBe("UNREVIEWED");
    expect(container.processingState).toBe("UPLOADED");

    // Registration is recorded as a transformation (provenance).
    const transformations = await db
      .select()
      .from(researchTransformations)
      .where(eq(researchTransformations.containerId, container.id));
    expect(transformations.some((t) => t.kind === "registration")).toBe(true);
  });

  it("detects duplicate containers by checksum", async () => {
    const a = await fixtureContainer("single-judgment.txt");
    const b = await fixtureContainer("duplicate-of-single.txt");
    expect(a.contentSha256).toBe(b.contentSha256);
    expect(a.id).not.toBe(b.id); // both containers kept; dedupe is a later, reviewable phase
  });

  it("routes uncertainty to human review instead of guessing", async () => {
    const container = await fixtureContainer("multi-judgment.txt");
    await routeToReview(container.id, "incomplete judgment detected (test)");
    const updated = await getContainer(container.id);
    expect(updated?.processingState).toBe("RIGHTS_REVIEW_REQUIRED");
    const items = await db
      .select()
      .from(researchReviewItems)
      .where(eq(researchReviewItems.containerId, container.id));
    expect(items).toHaveLength(1);
    expect(items[0]!.status).toBe("open");
  });
});

describe("job queue", () => {
  it("enqueues idempotently", async () => {
    const key = `idem-${RUN_ID}`;
    const first = await enqueue("container.registered", key, { test: true });
    const second = await enqueue("container.registered", key, { test: true });
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("claims, runs, and completes a job (round trip)", async () => {
    const container = await fixtureContainer("empty-container.txt");
    const kind = "container.registered";
    await enqueue(kind, `roundtrip-${RUN_ID}`, { containerId: container.id });

    // Claiming other suites' jobs could collide with parallel runs; claim in
    // a loop until we see our job or the queue drains.
    let ran = await runNextJob(kind);
    while (ran && ran.idempotencyKey !== `roundtrip-${RUN_ID}`) {
      ran = await runNextJob(kind);
    }
    expect(ran).not.toBeNull();

    const [row] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, `roundtrip-${RUN_ID}`));
    expect(row!.state).toBe("SUCCEEDED");
    expect(row!.attempts).toBe(1);
    expect(row!.startedAt).not.toBeNull();
    expect(row!.finishedAt).not.toBeNull();
  });

  it("retries retryable failures then ends FAILED_PERMANENT with the reason recorded", async () => {
    const key = `deadjob-${RUN_ID}`;
    const kind = `test.failing.${RUN_ID}`;
    const job = await enqueue(kind, key, {}, { maxAttempts: 2 });
    expect(job).not.toBeNull();

    // Two attempts allowed → first failure requeues, second exhausts retries.
    let claimed = await claimNext(kind);
    expect(claimed?.idempotencyKey).toBe(key);
    await fail(claimed!.id, {
      code: "TEST_FAILURE",
      message: "first failure",
      retryable: true,
    });

    claimed = await claimNext(kind);
    expect(claimed?.idempotencyKey).toBe(key);
    await fail(claimed!.id, {
      code: "TEST_FAILURE",
      message: "second failure",
      retryable: true,
    });

    const [row] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, key));
    expect(row!.state).toBe("FAILED_PERMANENT");
    expect(row!.lastError).toBe("second failure");
    expect(row!.failureReason?.code).toBe("TEST_FAILURE");
  });

  it("complete() marks a claimed job SUCCEEDED", async () => {
    const key = `complete-${RUN_ID}`;
    const kind = `test.complete.${RUN_ID}`;
    const job = await enqueue(kind, key, {});
    expect(job).not.toBeNull();
    const claimed = await claimNext(kind);
    expect(claimed?.idempotencyKey).toBe(key);
    await complete(claimed!.id, { outputChecksum: "0".repeat(64) });
    const [row] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.id, job!.id));
    expect(row!.state).toBe("SUCCEEDED");
    expect(row!.outputChecksum).toBe("0".repeat(64));
  });
});
