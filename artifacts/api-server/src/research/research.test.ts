import { describe, it, expect, afterAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const RUN_ID = randomUUID();
const BATCH = `test-batch-${RUN_ID}`;

const { getAdapters, setAdapters } = await import("./adapters");
const { enqueue, claimNext, complete, fail, runNextJob, registerProcessor } =
  await import("./processing");
const { registerContainer, getContainer, routeToReview } =
  await import("./data/containers");
const { recordRightsDecision } = await import("./data/rights");
const { transitionContainer } = await import("./domain/containerStateMachine");
const {
  db,
  researchJobs,
  researchSourceContainers,
  researchTransformations,
  researchReviewItems,
  researchAuditEvents,
  researchRightsRecords,
} = await import("@workspace/db");
const { eq, like, inArray, and } = await import("drizzle-orm");

const FIXTURES = path.resolve(__dirname, "../../../../fixtures/synthetic");

async function fixtureContainer(name: string) {
  // Salt with the run id so parallel/consecutive runs never collide on the
  // (now globally unique) content SHA-256.
  const bytes = Buffer.concat([
    await readFile(path.join(FIXTURES, name)),
    Buffer.from(`\n<!-- ${RUN_ID}:${name} -->\n`),
  ]);
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
      .delete(researchRightsRecords)
      .where(inArray(researchRightsRecords.containerId, ids));
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
  it("resolves defaults with AI disabled and extraction adapters registered", async () => {
    const adapters = getAdapters();
    expect(adapters.storage.name).toBe("replit-object-storage");
    expect(adapters.ai.isEnabled()).toBe(false);
    // Phase 04: real extraction adapters replace the OCR stub
    expect(adapters.ocr.name).toBe("tesseract");
    expect(adapters.nativeText.name).toBe("poppler-pdftotext");
    expect(adapters.pageRenderer.name).toBe("poppler-pdftoppm");
    expect(adapters.layout.name).toBe("heuristic-layout");
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
    expect(getAdapters().search.name).toBe("postgres-fts");
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
    // Since Phase 03, the database enforces at most one container per
    // SHA-256; the ingest pipeline resolves re-uploads as DUPLICATE items.
    const a = await fixtureContainer("duplicate-of-single.txt");
    expect(a.contentSha256).toBeTruthy();
    let caught: unknown;
    try {
      await fixtureContainer("duplicate-of-single.txt");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const cause = (caught as Error & { cause?: { code?: string } }).cause;
    expect(cause?.code).toBe("23505");
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
    // ran === null means a parallel test worker's job loop claimed and ran
    // our job first — that still exercises the round trip; verify via the DB
    // row (poll briefly in case the stealer is mid-run).
    let [row] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, `roundtrip-${RUN_ID}`));
    for (let i = 0; i < 20 && row && row.state !== "SUCCEEDED"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      [row] = await db
        .select()
        .from(researchJobs)
        .where(eq(researchJobs.idempotencyKey, `roundtrip-${RUN_ID}`));
    }
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

  it("runNextJob() without a kind filter does not claim jobs for unregistered processor kinds", async () => {
    // Enqueue a job whose kind has no registered processor in this worker.
    // runNextJob() with no kind arg must restrict claims to registered kinds,
    // so this job must remain QUEUED and not be stolen.
    const unregisteredKind = `editorial.unregistered.${RUN_ID}`;
    const key = `no-steal-${RUN_ID}`;
    const job = await enqueue(unregisteredKind, key, {});
    expect(job).not.toBeNull();

    // Run the job runner once with no kind filter.  It should return null (or
    // a job of a *registered* kind) — never the unregistered job.
    const claimed = await runNextJob();
    if (claimed) {
      // If something else was in the queue, verify it was NOT our unregistered job.
      expect(claimed.kind).not.toBe(unregisteredKind);
    }

    // The unregistered job must still be QUEUED — not claimed, not failed.
    const [row] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, key));
    expect(row!.state).toBe("QUEUED");
    expect(row!.attempts).toBe(0);
  });

  it("runNextJob() fails a job for an unregistered processor kind with NO_PROCESSOR — no retry loop", async () => {
    // Set up a rights-approved container so the rights gate passes and execution
    // reaches the processor lookup, which then throws NO_PROCESSOR (retryable:false).
    // This proves the unregistered-kind path ends FAILED_PERMANENT in a single
    // attempt even when maxAttempts > 1.
    // Use a unique salt so this container never collides with other fixtures in the run.
    const uniqueBytes = Buffer.from(`noproc-container-${RUN_ID}`);
    const container = await registerContainer({
      originalName: "noproc-test.txt",
      sourceBatch: BATCH,
      contentSha256: createHash("sha256").update(uniqueBytes).digest("hex"),
      sizeBytes: uniqueBytes.length,
      mimeType: "text/plain",
      provenance: { enteredVia: "test-noproc", runId: RUN_ID },
    });
    await recordRightsDecision(
      container.id,
      {
        status: "PRIVATE_PROCESSING_APPROVED",
        reason: "task-86 test approval",
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
      },
      { actor: `tester-${RUN_ID}` },
    );
    for (const to of [
      "RIGHTS_REVIEW_REQUIRED",
      "RIGHTS_APPROVED",
    ] as const) {
      await transitionContainer(container.id, to, {
        actor: `tester-${RUN_ID}`,
        detail: { cause: "task-86-test" },
      });
    }

    const unregisteredKind = `editorial.noproc.${RUN_ID}`;
    const key = `noproc-${RUN_ID}`;
    // maxAttempts:3 to prove we don't retry even when retries are allowed.
    const job = await enqueue(
      unregisteredKind,
      key,
      { containerId: container.id },
      { maxAttempts: 3 },
    );
    expect(job).not.toBeNull();

    // runNextJob with explicit kind bypasses the registry filter, passes the rights
    // check (container is approved), and then fails with NO_PROCESSOR (retryable:false).
    await runNextJob(unregisteredKind);

    const [row] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, key));
    // Must be FAILED_PERMANENT — not re-queued despite maxAttempts:3.
    expect(row!.state).toBe("FAILED_PERMANENT");
    expect(row!.failureReason?.code).toBe("NO_PROCESSOR");
    // Exactly one attempt: the failure is non-retryable so no re-queue loop.
    expect(row!.attempts).toBe(1);
  });
});
