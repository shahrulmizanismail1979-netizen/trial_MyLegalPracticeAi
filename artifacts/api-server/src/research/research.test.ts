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
} = await import("@workspace/db");
const { eq, like, inArray } = await import("drizzle-orm");

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
      .delete(researchSourceContainers)
      .where(inArray(researchSourceContainers.id, ids));
  }
  await db
    .delete(researchJobs)
    .where(like(researchJobs.idempotencyKey, `%${RUN_ID}%`));
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
  it("registers a container with rights status defaulting to UNREVIEWED", async () => {
    const container = await fixtureContainer("single-judgment.txt");
    expect(container.rightsStatus).toBe("UNREVIEWED");
    expect(container.processingState).toBe("REGISTERED");

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
    expect(updated?.processingState).toBe("NEEDS_REVIEW");
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

    // Claim only our own job kinds could collide with parallel runs; claim in
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
    expect(row!.state).toBe("succeeded");
    expect(row!.attempts).toBe(1);
    expect(row!.finishedAt).not.toBeNull();
  });

  it("retries failures then marks the job dead with the error recorded", async () => {
    const key = `deadjob-${RUN_ID}`;
    const job = await enqueue("no.such.handler", key, {}, 2);
    expect(job).not.toBeNull();

    // Two attempts allowed → first failure requeues, second kills it.
    let claimed = await claimNext("no.such.handler");
    while (claimed && claimed.idempotencyKey !== key) {
      await fail(claimed.id, "wrong job claimed in test");
      claimed = await claimNext("no.such.handler");
    }
    expect(claimed).not.toBeNull();
    await fail(claimed!.id, "first failure");

    claimed = await claimNext("no.such.handler");
    while (claimed && claimed.idempotencyKey !== key) {
      claimed = await claimNext("no.such.handler");
    }
    expect(claimed).not.toBeNull();
    await fail(claimed!.id, "second failure");

    const [row] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, key));
    expect(row!.state).toBe("dead");
    expect(row!.lastError).toBe("second failure");
  });

  it("complete() marks a claimed job succeeded", async () => {
    const key = `complete-${RUN_ID}`;
    const job = await enqueue("container.registered", key, {});
    expect(job).not.toBeNull();
    await complete(job!.id);
    const [row] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.id, job!.id));
    expect(row!.state).toBe("succeeded");
  });
});
