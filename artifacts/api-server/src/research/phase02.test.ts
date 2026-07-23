import { describe, it, expect, afterAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";

// Phase 02 proof tests: rights-review workflow, quarantine, enforcement
// gates, and the processor-side rights re-check. Uses the live dev DB with
// RUN_ID-scoped rows cleaned up afterAll (same convention as
// research.test.ts).

const RUN_ID = randomUUID();
const BATCH = `test-phase02-${RUN_ID}`;

const { registerContainer, getContainer } = await import("./data/containers");
const { recordRightsDecision, listRightsRecords } = await import(
  "./data/rights"
);
const { transitionContainer } = await import("./domain/containerStateMachine");
const {
  checkContainerAccess,
  assertExportAllowed,
  assertExternalAiSubmissionAllowed,
  filterSearchVisible,
  AccessDeniedError,
} = await import("./domain/gates");
const { enqueue, runNextJob, registerProcessor } = await import("./processing");
const {
  db,
  researchJobs,
  researchSourceContainers,
  researchRightsRecords,
  researchTransformations,
  researchReviewItems,
  researchAuditEvents,
} = await import("@workspace/db");
const { eq, like, inArray, and } = await import("drizzle-orm");

let counter = 0;
async function makeContainer() {
  counter += 1;
  const content = `phase02-${RUN_ID}-${counter}`;
  return registerContainer({
    originalName: `${content}.txt`,
    sourceBatch: BATCH,
    contentSha256: createHash("sha256").update(content).digest("hex"),
    sizeBytes: content.length,
    mimeType: "text/plain",
    provenance: { enteredVia: "test", runId: RUN_ID },
  });
}

function decision(overrides: Record<string, unknown> = {}) {
  return {
    status: "PRIVATE_PROCESSING_APPROVED",
    reason: "test decision",
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
    ...overrides,
  } as Parameters<typeof recordRightsDecision>[1];
}

afterAll(async () => {
  const rows = await db
    .select({ id: researchSourceContainers.id })
    .from(researchSourceContainers)
    .where(eq(researchSourceContainers.sourceBatch, BATCH));
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    await db
      .delete(researchRightsRecords)
      .where(inArray(researchRightsRecords.containerId, ids));
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

describe("rights-review workflow", () => {
  it("appends a full 17-field record, mirrors status, and records transformation + audit atomically", async () => {
    const container = await makeContainer();
    expect(container.rightsStatus).toBe("UNREVIEWED");

    const record = await recordRightsDecision(container.id, decision(), {
      actor: "reviewer@test",
    });
    expect(record.status).toBe("PRIVATE_PROCESSING_APPROVED");
    expect(record.reviewer).toBe("reviewer@test");
    expect(record.storagePermitted).toBe(true);
    expect(record.exportPermitted).toBe(false);

    const updated = await getContainer(container.id);
    expect(updated?.rightsStatus).toBe("PRIVATE_PROCESSING_APPROVED");

    const transformations = await db
      .select()
      .from(researchTransformations)
      .where(eq(researchTransformations.containerId, container.id));
    expect(transformations.some((t) => t.kind === "rights_change")).toBe(true);

    const audits = await db
      .select()
      .from(researchAuditEvents)
      .where(
        and(
          eq(researchAuditEvents.entityType, "container"),
          eq(researchAuditEvents.entityId, container.id),
        ),
      );
    expect(audits.some((a) => a.event === "rights-decision")).toBe(true);
  });

  it("keeps full history: a second decision appends, never overwrites", async () => {
    const container = await makeContainer();
    await recordRightsDecision(container.id, decision(), { actor: "r1" });
    await recordRightsDecision(
      container.id,
      decision({ status: "EXPORT_RESTRICTED", reason: "narrowed" }),
      { actor: "r2" },
    );
    const records = await listRightsRecords(container.id);
    expect(records).toHaveLength(2);
    expect(records[0]!.status).toBe("EXPORT_RESTRICTED"); // newest first
    const updated = await getContainer(container.id);
    expect(updated?.rightsStatus).toBe("EXPORT_RESTRICTED");
  });

  it("DO_NOT_RETAIN routes the container to DELETION_PENDING via the state machine", async () => {
    const container = await makeContainer();
    await recordRightsDecision(
      container.id,
      decision({ status: "DO_NOT_RETAIN", reason: "not retainable" }),
      { actor: "reviewer@test" },
    );
    const updated = await getContainer(container.id);
    expect(updated?.processingState).toBe("DELETION_PENDING");
    expect(updated?.rightsStatus).toBe("DO_NOT_RETAIN");
  });
});

describe("quarantine and enforcement gates", () => {
  it("quarantined containers: only rights roles may view; nothing else", async () => {
    const container = await makeContainer();
    await recordRightsDecision(container.id, decision(), { actor: "r" });
    await transitionContainer(container.id, "QUARANTINED", {
      actor: "test",
      detail: { cause: "test" },
    });

    const viewAsReviewer = await checkContainerAccess(
      container.id,
      "rights_reviewer",
      "view",
    );
    expect(viewAsReviewer.decision.allowed).toBe(true);

    const viewAsResearcher = await checkContainerAccess(
      container.id,
      "researcher",
      "view",
    );
    expect(viewAsResearcher.decision.allowed).toBe(false);
    expect(viewAsResearcher.decision.reason).toBe("HOLD_QUARANTINED");

    const processAsOwner = await checkContainerAccess(
      container.id,
      "owner",
      "process",
    );
    expect(processAsOwner.decision.allowed).toBe(false);

    // Denial was audited.
    const audits = await db
      .select()
      .from(researchAuditEvents)
      .where(
        and(
          eq(researchAuditEvents.entityType, "container"),
          eq(researchAuditEvents.entityId, container.id),
        ),
      );
    expect(audits.filter((a) => a.event === "access-denied").length)
      .toBeGreaterThanOrEqual(2);
  });

  it("quarantined/unreviewed containers never appear in search listings", async () => {
    const approved = await makeContainer();
    await recordRightsDecision(approved.id, decision(), { actor: "r" });
    const quarantined = await makeContainer();
    await recordRightsDecision(quarantined.id, decision(), { actor: "r" });
    await transitionContainer(quarantined.id, "QUARANTINED", {
      actor: "test",
      detail: { cause: "test" },
    });
    const unreviewed = await makeContainer();

    const all = await db
      .select()
      .from(researchSourceContainers)
      .where(eq(researchSourceContainers.sourceBatch, BATCH));
    const visible = (await filterSearchVisible(all, "owner")).map((c) => c.id);
    expect(visible).toContain(approved.id);
    expect(visible).not.toContain(quarantined.id);
    expect(visible).not.toContain(unreviewed.id);
  });

  it("external-AI gate structurally refuses restricted sources", async () => {
    const container = await makeContainer();
    await recordRightsDecision(
      container.id,
      decision({
        status: "EXTERNAL_AI_RESTRICTED",
        externalProcessingPermitted: true, // even express approval cannot beat the cap
      }),
      { actor: "r" },
    );
    await expect(
      assertExternalAiSubmissionAllowed(container.id, "owner"),
    ).rejects.toThrow(AccessDeniedError);
  });

  it("export gate requires express approval in the rights record", async () => {
    const container = await makeContainer();
    await recordRightsDecision(
      container.id,
      decision({ status: "OFFICIAL_COURT_SOURCE", exportPermitted: false }),
      { actor: "r" },
    );
    await expect(
      assertExportAllowed(container.id, "administrator"),
    ).rejects.toThrow(AccessDeniedError);

    await recordRightsDecision(
      container.id,
      decision({ status: "OFFICIAL_COURT_SOURCE", exportPermitted: true }),
      { actor: "r" },
    );
    const ok = await assertExportAllowed(container.id, "administrator");
    expect(ok.id).toBe(container.id);
  });
});

describe("processor-side rights re-check", () => {
  it("blocks content-touching jobs on unapproved containers and routes review", async () => {
    const container = await makeContainer(); // UNREVIEWED
    const kind = `test.content.${RUN_ID}`;
    const unregister = registerProcessor(kind, async () => ({}));
    try {
      const key = `content-blocked-${RUN_ID}`;
      await enqueue(kind, key, { containerId: container.id });
      const ran = await runNextJob(kind);
      expect(ran?.idempotencyKey).toBe(key);
      const [row] = await db
        .select()
        .from(researchJobs)
        .where(eq(researchJobs.idempotencyKey, key));
      expect(row!.state).toBe("BLOCKED_BY_RIGHTS");
      const items = await db
        .select()
        .from(researchReviewItems)
        .where(eq(researchReviewItems.containerId, container.id));
      expect(items.some((i) => i.kind === "rights")).toBe(true);
    } finally {
      unregister();
    }
  });

  it("runs content-touching jobs once processing is rights-approved", async () => {
    const container = await makeContainer();
    await recordRightsDecision(container.id, decision(), { actor: "r" });
    const kind = `test.content-ok.${RUN_ID}`;
    const unregister = registerProcessor(kind, async () => ({}));
    try {
      const key = `content-ok-${RUN_ID}`;
      await enqueue(kind, key, { containerId: container.id });
      await runNextJob(kind);
      const [row] = await db
        .select()
        .from(researchJobs)
        .where(eq(researchJobs.idempotencyKey, key));
      expect(row!.state).toBe("SUCCEEDED");
    } finally {
      unregister();
    }
  });

  it("registration jobs (non-content) still run on UNREVIEWED containers", async () => {
    const container = await makeContainer();
    const key = `container-registered-${container.id}`;
    // Job was enqueued by registerContainer? No — tests register directly via
    // data layer, so enqueue explicitly here.
    await enqueue("container.registered", key, { containerId: container.id });
    let ran = await runNextJob("container.registered");
    while (ran && ran.idempotencyKey !== key) {
      ran = await runNextJob("container.registered");
    }
    const [row] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, key));
    expect(row!.state).toBe("SUCCEEDED");
  });
});
