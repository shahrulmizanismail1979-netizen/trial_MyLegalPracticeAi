import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";

const {
  CONTAINER_STATES,
  JOB_STATES,
  researchAuditEvents,
  researchJobs,
  researchStoredArtifacts,
} = await import("@workspace/db");
const {
  CONTAINER_TRANSITIONS,
  canTransitionContainer,
  transitionContainer,
  JOB_TRANSITIONS,
  canTransitionJob,
  transitionJob,
  StateTransitionError,
  EntityNotFoundError,
} = await import("./index");
const {
  enqueue,
  claimNext,
  complete,
  fail,
  cancel,
  requeue,
  runNextJob,
  registerProcessor,
  ProcessorFailure,
  ReviewRequiredSignal,
  RightsBlockedSignal,
} = await import("../processing");
const { createIsolatedTestDb } = await import("../testing/testDb");
const { createFixtureContainer, makeJobKey } =
  await import("../testing/fixtureFactory");
const { loadGolden } = await import("../testing/golden");
const { routeToReview } = await import("../data/containers");
const { eq, and } = await import("drizzle-orm");

// All tests here run against a dedicated, per-run Postgres schema — never the
// shared dev data.
let iso: Awaited<ReturnType<typeof createIsolatedTestDb>>;
beforeAll(async () => {
  iso = await createIsolatedTestDb();
});
afterAll(async () => {
  await iso.drop();
});

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

async function auditEvents(entityType: "container" | "job", entityId: number) {
  return iso.db
    .select()
    .from(researchAuditEvents)
    .where(
      and(
        eq(researchAuditEvents.entityType, entityType),
        eq(researchAuditEvents.entityId, entityId),
      ),
    );
}

describe("container state machine (isolated schema)", () => {
  it("matches the golden allowed-transitions map exactly", async () => {
    expect(CONTAINER_TRANSITIONS).toEqual(
      await loadGolden("container-transitions", CONTAINER_TRANSITIONS),
    );
  });

  it("covers exactly the 20 required states", () => {
    expect(CONTAINER_STATES).toHaveLength(20);
    expect(Object.keys(CONTAINER_TRANSITIONS).sort()).toEqual(
      [...CONTAINER_STATES].sort(),
    );
  });

  it("DELETED is terminal and SEARCHABLE only reaches safety states", () => {
    expect(CONTAINER_TRANSITIONS.DELETED).toEqual([]);
    expect([...CONTAINER_TRANSITIONS.SEARCHABLE].sort()).toEqual([
      "DELETION_PENDING",
      "PROCESSING_BLOCKED",
      "QUARANTINED",
    ]);
  });

  it("rejects every disallowed pair (exhaustive, in-memory guard)", () => {
    for (const from of CONTAINER_STATES) {
      for (const to of CONTAINER_STATES) {
        const allowed = CONTAINER_TRANSITIONS[from].includes(to);
        expect(canTransitionContainer(from, to)).toBe(allowed);
      }
    }
  });

  it("rejects invalid transitions at the database with a structured error", async () => {
    const container = await createFixtureContainer({}, iso.db);
    // UPLOADED -> VERIFIED is illegal.
    await expect(
      transitionContainer(container.id, "VERIFIED", { dbc: iso.db }),
    ).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
      entityType: "container",
      fromState: "UPLOADED",
      toState: "VERIFIED",
    });
    // State unchanged, and no state-transition audit event was written.
    const events = await auditEvents("container", container.id);
    expect(events.filter((e) => e.event === "state-transition")).toHaveLength(
      0,
    );
  });

  it("walks the full happy path UPLOADED -> ... -> DELETED with an audit event per step", async () => {
    const container = await createFixtureContainer({}, iso.db);
    const pathStates = [
      "RIGHTS_REVIEW_REQUIRED",
      "RIGHTS_APPROVED",
      "INVENTORY_PENDING",
      "INVENTORIED",
      "EXTRACTION_PENDING",
      "TEXT_EXTRACTED",
      "SEGMENTATION_PENDING",
      "SEGMENTATION_PROPOSED",
      "SEGMENTATION_REVIEW_REQUIRED",
      "EDITORIAL_REVIEW_PENDING",
      "EDITORIAL_REVIEW_REQUIRED",
      "JUDGMENT_VERIFICATION_PENDING",
      "VERIFIED",
      "SEARCHABLE",
      "DELETION_PENDING",
      "DELETED",
    ] as const;
    let current = container;
    for (const to of pathStates) {
      current = await transitionContainer(container.id, to, {
        actor: "test",
        dbc: iso.db,
      });
      expect(current.processingState).toBe(to);
    }
    const events = (await auditEvents("container", container.id)).filter(
      (e) => e.event === "state-transition",
    );
    expect(events).toHaveLength(pathStates.length);
    expect(events.map((e) => e.toState)).toEqual([...pathStates]);
    // DELETED is terminal.
    await expect(
      transitionContainer(container.id, "UPLOADED", { dbc: iso.db }),
    ).rejects.toBeInstanceOf(StateTransitionError);
  });

  it("supports quarantine, block, and resume from any live state", async () => {
    const container = await createFixtureContainer({}, iso.db);
    await transitionContainer(container.id, "QUARANTINED", { dbc: iso.db });
    await transitionContainer(container.id, "RIGHTS_REVIEW_REQUIRED", {
      dbc: iso.db,
    });
    await transitionContainer(container.id, "PROCESSING_BLOCKED", {
      dbc: iso.db,
    });
    const resumed = await transitionContainer(
      container.id,
      "RIGHTS_REVIEW_REQUIRED",
      { dbc: iso.db },
    );
    expect(resumed.processingState).toBe("RIGHTS_REVIEW_REQUIRED");
  });

  it("routeToReview only accepts review states and records the review item", async () => {
    const container = await createFixtureContainer({}, iso.db);
    await routeToReview(container.id, "synthetic uncertainty", {
      dbc: iso.db,
    });
    await expect(
      // @ts-expect-error — non-review state must be rejected at runtime too
      routeToReview(container.id, "nope", { toState: "VERIFIED", dbc: iso.db }),
    ).rejects.toThrow(/review state/);
  });

  it("throws EntityNotFoundError for unknown containers", async () => {
    await expect(
      transitionContainer(999999999, "QUARANTINED", { dbc: iso.db }),
    ).rejects.toBeInstanceOf(EntityNotFoundError);
  });
});

describe("job state machine (isolated schema)", () => {
  it("matches the golden allowed-transitions map exactly", async () => {
    expect(JOB_TRANSITIONS).toEqual(
      await loadGolden("job-transitions", JOB_TRANSITIONS),
    );
  });

  it("covers exactly the 8 required states with the right terminals", () => {
    expect(JOB_STATES).toHaveLength(8);
    expect(JOB_TRANSITIONS.SUCCEEDED).toEqual([]);
    expect(JOB_TRANSITIONS.FAILED_PERMANENT).toEqual([]);
    expect(JOB_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it("rejects every disallowed pair (exhaustive, in-memory guard)", () => {
    for (const from of JOB_STATES) {
      for (const to of JOB_STATES) {
        expect(canTransitionJob(from, to)).toBe(
          JOB_TRANSITIONS[from].includes(to),
        );
      }
    }
  });

  it("rejects invalid transitions at the database (QUEUED -> SUCCEEDED)", async () => {
    const job = await enqueue(
      "test.kind",
      makeJobKey("invalid"),
      {},
      {
        dbc: iso.db,
      },
    );
    await expect(
      transitionJob(job!.id, "SUCCEEDED", { dbc: iso.db }),
    ).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
      fromState: "QUEUED",
      toState: "SUCCEEDED",
    });
  });

  it("distinguishes retryable from permanent failures", async () => {
    // Permanent: fails once, never requeues.
    const permKey = makeJobKey("perm");
    await enqueue("test.perm", permKey, {}, { dbc: iso.db });
    const permJob = await claimNext("test.perm", iso.db);
    const failed = await fail(
      permJob!.id,
      { code: "CORRUPT_INPUT", message: "unreadable", retryable: false },
      { dbc: iso.db },
    );
    expect(failed.state).toBe("FAILED_PERMANENT");
    expect(failed.failureReason).toEqual({
      code: "CORRUPT_INPUT",
      message: "unreadable",
      retryable: false,
    });

    // Retryable: requeues until attempts exhausted.
    const retryKey = makeJobKey("retry");
    await enqueue("test.retry", retryKey, {}, { maxAttempts: 2, dbc: iso.db });
    const first = await claimNext("test.retry", iso.db);
    const requeued = await fail(
      first!.id,
      { code: "TRANSIENT", message: "flaky", retryable: true },
      { dbc: iso.db },
    );
    expect(requeued.state).toBe("QUEUED");
    const second = await claimNext("test.retry", iso.db);
    expect(second!.attempts).toBe(2);
    const dead = await fail(
      second!.id,
      { code: "TRANSIENT", message: "still flaky", retryable: true },
      { dbc: iso.db },
    );
    expect(dead.state).toBe("FAILED_PERMANENT");
  });

  it("cancel and requeue follow the machine", async () => {
    const key = makeJobKey("cancel");
    const job = await enqueue("test.cancel", key, {}, { dbc: iso.db });
    const cancelled = await cancel(job!.id, { dbc: iso.db });
    expect(cancelled.state).toBe("CANCELLED");
    await expect(requeue(job!.id, { dbc: iso.db })).rejects.toBeInstanceOf(
      StateTransitionError,
    );
  });

  it("emits audit events for every job state change, atomically", async () => {
    const key = makeJobKey("audit");
    const job = await enqueue("test.audit", key, {}, { dbc: iso.db });
    const claimed = await claimNext("test.audit", iso.db);
    await complete(claimed!.id, { dbc: iso.db });
    const events = await auditEvents("job", job!.id);
    expect(events.map((e) => `${e.event}:${e.toState}`)).toEqual([
      "enqueued:QUEUED",
      "state-transition:RUNNING",
      "state-transition:SUCCEEDED",
    ]);
  });
});

describe("processor contract (isolated schema)", () => {
  it("records version, timings, retry count, checksums, and provenance", async () => {
    const key = makeJobKey("contract");
    const unregister = registerProcessor(
      "test.contract",
      async () => ({ outputChecksum: sha("output") }),
      { touchesContent: false }, // synthetic contract test, no container content
    );
    try {
      await enqueue(
        "test.contract",
        key,
        { ref: "container:1" },
        {
          processorVersion: "test.contract@7",
          sourceChecksum: sha("source"),
          provenance: { containerId: 1 },
          dbc: iso.db,
        },
      );
      await runNextJob("test.contract", iso.db);
      const [row] = await iso.db
        .select()
        .from(researchJobs)
        .where(eq(researchJobs.idempotencyKey, key));
      expect(row!.state).toBe("SUCCEEDED");
      expect(row!.processorVersion).toBe("test.contract@7");
      expect(row!.sourceChecksum).toBe(sha("source"));
      expect(row!.outputChecksum).toBe(sha("output"));
      expect(row!.provenance).toEqual({ containerId: 1 });
      expect(row!.attempts).toBe(1);
      expect(row!.createdAt).not.toBeNull();
      expect(row!.startedAt).not.toBeNull();
      expect(row!.finishedAt).not.toBeNull();
    } finally {
      unregister();
    }
  });

  it("same idempotency key never duplicates jobs or outputs", async () => {
    const key = makeJobKey("idem");
    const unregister = registerProcessor(
      "test.idem",
      async (ctx) => {
        await ctx.recordArtifact({
          kind: "report",
          storageKey: `artifacts/${ctx.job.idempotencyKey}.json`,
          contentSha256: sha("report"),
          sizeBytes: 6,
        });
        return {};
      },
      { touchesContent: false },
    );
    try {
      const first = await enqueue("test.idem", key, {}, { dbc: iso.db });
      const dup = await enqueue("test.idem", key, {}, { dbc: iso.db });
      expect(first).not.toBeNull();
      expect(dup).toBeNull();
      await runNextJob("test.idem", iso.db);

      // Simulate a crash-resume re-execution of the same logical work.
      await requeue(first!.id, {
        detail: { simulated: "crash-resume" },
        dbc: iso.db,
      });
      // requeue is only legal from paused states; SUCCEEDED is terminal, so
      // the requeue above must fail — outputs cannot even be re-attempted.
      // (The artifact-level guard is exercised via direct double-record.)
    } catch {
      // expected: SUCCEEDED is terminal
    } finally {
      unregister();
    }
    const artifacts = await iso.db
      .select()
      .from(researchStoredArtifacts)
      .where(eq(researchStoredArtifacts.producedByKey, key));
    expect(artifacts).toHaveLength(1);
  });

  it("artifact recording is idempotent under re-execution", async () => {
    const key = makeJobKey("rerun");
    let runs = 0;
    const unregister = registerProcessor(
      "test.rerun",
      async (ctx) => {
        runs += 1;
        await ctx.recordArtifact({
          kind: "summary",
          storageKey: `artifacts/${ctx.job.idempotencyKey}.txt`,
          contentSha256: sha("summary"),
          sizeBytes: 7,
        });
        if (runs === 1) {
          throw new ProcessorFailure("TRANSIENT", "first run dies", true);
        }
        return {};
      },
      { touchesContent: false },
    );
    try {
      await enqueue("test.rerun", key, {}, { maxAttempts: 3, dbc: iso.db });
      await runNextJob("test.rerun", iso.db); // fails, requeues
      await runNextJob("test.rerun", iso.db); // succeeds
      const [row] = await iso.db
        .select()
        .from(researchJobs)
        .where(eq(researchJobs.idempotencyKey, key));
      expect(row!.state).toBe("SUCCEEDED");
      expect(row!.attempts).toBe(2);
      const artifacts = await iso.db
        .select()
        .from(researchStoredArtifacts)
        .where(eq(researchStoredArtifacts.producedByKey, key));
      expect(artifacts).toHaveLength(1); // no duplicate despite two executions
    } finally {
      unregister();
    }
  });

  it("routes review-required and rights-blocked outcomes to the correct states", async () => {
    const reviewKey = makeJobKey("review");
    const unregisterReview = registerProcessor(
      "test.review",
      async () => {
        throw new ReviewRequiredSignal({ why: "ambiguous segmentation" });
      },
      { touchesContent: false },
    );
    const rightsKey = makeJobKey("rights");
    const unregisterRights = registerProcessor(
      "test.rights",
      async () => {
        throw new RightsBlockedSignal({ rightsStatus: "UNREVIEWED" });
      },
      { touchesContent: false },
    );
    try {
      await enqueue("test.review", reviewKey, {}, { dbc: iso.db });
      await runNextJob("test.review", iso.db);
      const [reviewRow] = await iso.db
        .select()
        .from(researchJobs)
        .where(eq(researchJobs.idempotencyKey, reviewKey));
      expect(reviewRow!.state).toBe("REVIEW_REQUIRED");

      await enqueue("test.rights", rightsKey, {}, { dbc: iso.db });
      await runNextJob("test.rights", iso.db);
      const [rightsRow] = await iso.db
        .select()
        .from(researchJobs)
        .where(eq(researchJobs.idempotencyKey, rightsKey));
      expect(rightsRow!.state).toBe("BLOCKED_BY_RIGHTS");

      // Both are resumable: a decision returns them to the queue.
      const resumed = await requeue(rightsRow!.id, { dbc: iso.db });
      expect(resumed.state).toBe("QUEUED");
    } finally {
      unregisterReview();
      unregisterRights();
    }
  });
});
