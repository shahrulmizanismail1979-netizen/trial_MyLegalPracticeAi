import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import express from "express";
import request from "supertest";

// Phase 04 proof tests: page-level extraction (native text layer vs OCR),
// page-image provenance, structured warnings, review routing (never guess),
// immutable raw rows + append-only corrections, and the staff review web
// layer. Live dev DB with RUN_ID-scoped rows cleaned afterAll (same
// convention as phase03.test.ts). Storage is an in-memory adapter; the
// native-text/renderer/OCR/layout adapters are the REAL poppler + tesseract
// implementations running on synthetic fixtures only.

const RUN_ID = randomUUID();

const { setAdapters, getAdapters } = await import("./adapters");
const {
  startExtraction,
  getLatestExtractionRun,
  registerExtractionProcessor,
  OCR_REVIEW_CONFIDENCE_THRESHOLD,
} = await import("./extraction/pipeline");
const { heuristicLayoutAnalyzer } = await import("./extraction/layoutAnalyzer");
const { registerContainer, getContainer } = await import("./data/containers");
const { recordRightsDecision } = await import("./data/rights");
const { transitionContainer } = await import("./domain/containerStateMachine");
const { runNextJob } = await import("./processing");
const {
  db,
  researchJobs,
  researchUploadBatchItems,
  researchValidationRuns,
  researchEditorialRuns,
  researchVerifiedJudgments,
  researchPageSections,
  researchCandidateCoherenceChecks,
  researchSourceContainers,
  researchSourcePages,
  researchExtractionRuns,
  researchPageExtractions,
  researchPageBlocks,
  researchPageWarnings,
  researchPageCorrections,
  researchRightsRecords,
  researchTransformations,
  researchReviewItems,
  researchAuditEvents,
  researchStoredArtifacts,
  researchUsers,
} = await import("@workspace/db");
const { eq, like, inArray, and } = await import("drizzle-orm");

const FIXTURES = path.resolve(
  __dirname,
  "../../../../fixtures/synthetic/extraction",
);
const fixture = (name: string) => readFileSync(path.join(FIXTURES, name));
const sha256 = (b: Buffer | string) =>
  createHash("sha256").update(b).digest("hex");

// In-memory storage adapter: keys → bytes.
const stored = new Map<string, Buffer>();
let previousAdapters: ReturnType<typeof setAdapters> | null = null;

const OWNER_EMAIL = `owner-${RUN_ID}@test.local`;
const GUEST_EMAIL = `guest-${RUN_ID}@test.local`;

beforeAll(async () => {
  registerExtractionProcessor();
  previousAdapters = setAdapters({
    storage: {
      name: "memory-test",
      async put(key, bytes) {
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
  await db.insert(researchUsers).values([
    { email: OWNER_EMAIL, displayName: "Phase04 Owner", role: "owner" },
    { email: GUEST_EMAIL, displayName: "Phase04 Guest", role: "guest" },
  ]);
});

let uploadSeq = 0;
function unique(bytes: Buffer): Buffer {
  // Trailing comment bytes keep the PDF parseable while making the content
  // hash unique per run (the containers table has a sha256 unique index).
  uploadSeq += 1;
  return Buffer.concat([
    bytes,
    Buffer.from(`\n%% phase04 run ${RUN_ID} #${uploadSeq}\n`),
  ]);
}

const trackedJobIds: number[] = [];

// Deletes jobs after clearing any rows that reference them (validation runs,
// editorial runs — created by auto-triggered downstream processing, possibly
// by parallel test workers mid-cleanup), retrying until it sticks.
async function deleteJobsSafely(jobIds: number[]): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const vrIds = (
        await db
          .select({ id: researchValidationRuns.id })
          .from(researchValidationRuns)
          .where(inArray(researchValidationRuns.jobId, jobIds))
      ).map((r) => r.id);
      if (vrIds.length > 0) {
        await db
          .delete(researchCandidateCoherenceChecks)
          .where(inArray(researchCandidateCoherenceChecks.validationRunId, vrIds));
        await db
          .delete(researchValidationRuns)
          .where(inArray(researchValidationRuns.id, vrIds));
      }
      const erIds = (
        await db
          .select({ id: researchEditorialRuns.id })
          .from(researchEditorialRuns)
          .where(inArray(researchEditorialRuns.jobId, jobIds))
      ).map((r) => r.id);
      if (erIds.length > 0) {
        await db
          .delete(researchVerifiedJudgments)
          .where(inArray(researchVerifiedJudgments.editorialRunId, erIds));
        await db
          .update(researchPageSections)
          .set({ editorialRunId: null })
          .where(inArray(researchPageSections.editorialRunId, erIds));
        await db
          .delete(researchEditorialRuns)
          .where(inArray(researchEditorialRuns.id, erIds));
      }
      await db.delete(researchJobs).where(inArray(researchJobs.id, jobIds));
      return;
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
async function drainJobs() {
  for (let i = 0; i < 100; i++) {
    const job = await runNextJob();
    if (!job) return;
    trackedJobIds.push(job.id);
  }
  throw new Error("job queue did not drain");
}

function approvedDecision() {
  return {
    status: "PRIVATE_PROCESSING_APPROVED",
    reason: "phase04 test approval",
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

/**
 * Register a rights-approved container in INVENTORIED from a synthetic
 * extraction fixture, with bytes staged in the in-memory storage adapter.
 */
async function makeExtractionContainer(fixtureName: string) {
  const bytes = unique(fixture(fixtureName));
  const storageKey = `test/phase04/${RUN_ID}/${uploadSeq}-${fixtureName}`;
  stored.set(storageKey, bytes);
  const container = await registerContainer({
    originalName: fixtureName,
    sourceBatch: `phase04-${RUN_ID}`,
    storageKey,
    contentSha256: sha256(bytes),
    sizeBytes: bytes.length,
    mimeType: "application/pdf",
    provenance: { runId: RUN_ID, fixture: fixtureName },
  });
  await recordRightsDecision(container.id, approvedDecision(), {
    actor: `tester-${RUN_ID}`,
  });
  for (const to of [
    "RIGHTS_REVIEW_REQUIRED",
    "RIGHTS_APPROVED",
    "INVENTORY_PENDING",
    "INVENTORIED",
  ] as const) {
    await transitionContainer(container.id, to, {
      actor: `tester-${RUN_ID}`,
      detail: { cause: "phase04-test-setup" },
    });
  }
  return container;
}

// Minimal express host for the research router: substitutes the platform
// staff gate (requireAuth + requireStaff run before the router in app.ts)
// with a header-driven identity so route-level auth is tested directly.
async function makeTestApp() {
  const researchRouter = (await import("./routes")).default;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.authEmail = (req.headers["x-test-email"] as string) ?? OWNER_EMAIL;
    req.log = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as typeof req.log;
    next();
  });
  app.use("/api/research", researchRouter);
  return app;
}

afterAll(async () => {
  // Manual ordered cleanup (no FK cascades in the research schema).
  const containers = await db
    .select({ id: researchSourceContainers.id })
    .from(researchSourceContainers)
    .where(eq(researchSourceContainers.sourceBatch, `phase04-${RUN_ID}`));
  const containerIds = containers.map((c) => c.id);
  if (containerIds.length > 0) {
    const runs = await db
      .select({ id: researchExtractionRuns.id })
      .from(researchExtractionRuns)
      .where(inArray(researchExtractionRuns.containerId, containerIds));
    const runIds = runs.map((r) => r.id);
    if (runIds.length > 0) {
      const extractions = await db
        .select({ id: researchPageExtractions.id })
        .from(researchPageExtractions)
        .where(inArray(researchPageExtractions.runId, runIds));
      const extractionIds = extractions.map((e) => e.id);
      if (extractionIds.length > 0) {
        await db
          .delete(researchPageBlocks)
          .where(inArray(researchPageBlocks.pageExtractionId, extractionIds));
        await db
          .delete(researchPageWarnings)
          .where(
            inArray(researchPageWarnings.pageExtractionId, extractionIds),
          );
        await db
          .delete(researchPageCorrections)
          .where(
            inArray(researchPageCorrections.pageExtractionId, extractionIds),
          );
        await db
          .delete(researchAuditEvents)
          .where(
            and(
              eq(researchAuditEvents.entityType, "page_extraction"),
              inArray(researchAuditEvents.entityId, extractionIds),
            ),
          );
        await db
          .delete(researchPageExtractions)
          .where(inArray(researchPageExtractions.id, extractionIds));
      }
      await db
        .delete(researchExtractionRuns)
        .where(inArray(researchExtractionRuns.id, runIds));
    }
    await db
      .delete(researchSourcePages)
      .where(inArray(researchSourcePages.containerId, containerIds));
    await db
      .delete(researchStoredArtifacts)
      .where(inArray(researchStoredArtifacts.containerId, containerIds));
    await db
      .delete(researchReviewItems)
      .where(inArray(researchReviewItems.containerId, containerIds));
    await db
      .delete(researchTransformations)
      .where(inArray(researchTransformations.containerId, containerIds));
    await db
      .delete(researchRightsRecords)
      .where(inArray(researchRightsRecords.containerId, containerIds));
    await db
      .delete(researchAuditEvents)
      .where(
        and(
          eq(researchAuditEvents.entityType, "container"),
          inArray(researchAuditEvents.entityId, containerIds),
        ),
      );
    // Only this run's jobs: extract-container-<id>-... for our containers.
    // Delete coherence checks → validation runs (FK chain) → jobs.
    for (const cid of containerIds) {
      const jobsToDelete = await db
        .select({ id: researchJobs.id })
        .from(researchJobs)
        .where(like(researchJobs.idempotencyKey, `extract-container-${cid}-%`));
      if (jobsToDelete.length > 0) {
        const jids = jobsToDelete.map((j) => j.id);
        const vrIds = (
          await db
            .select({ id: researchValidationRuns.id })
            .from(researchValidationRuns)
            .where(inArray(researchValidationRuns.jobId, jids))
        ).map((r) => r.id);
        if (vrIds.length > 0) {
          await db
            .delete(researchCandidateCoherenceChecks)
            .where(inArray(researchCandidateCoherenceChecks.validationRunId, vrIds));
          await db
            .delete(researchValidationRuns)
            .where(inArray(researchValidationRuns.id, vrIds));
        }
        await deleteJobsSafely(jids);
      }
    }
    if (trackedJobIds.length > 0) {
      const vrIds = (
        await db
          .select({ id: researchValidationRuns.id })
          .from(researchValidationRuns)
          .where(inArray(researchValidationRuns.jobId, trackedJobIds))
      ).map((r) => r.id);
      if (vrIds.length > 0) {
        await db
          .delete(researchCandidateCoherenceChecks)
          .where(inArray(researchCandidateCoherenceChecks.validationRunId, vrIds));
        await db
          .delete(researchValidationRuns)
          .where(inArray(researchValidationRuns.id, vrIds));
      }
      // drainJobs() can steal other test files' queued jobs (e.g. ingest jobs
      // referenced by their upload_batch_items) — deleting those violates FKs
      // and destroys rows the owning file's cleanup expects. Delete only jobs
      // that nothing references; the owning file cleans up the rest.
      const referenced = await db
        .select({ jobId: researchUploadBatchItems.jobId })
        .from(researchUploadBatchItems)
        .where(inArray(researchUploadBatchItems.jobId, trackedJobIds));
      const referencedIds = new Set(referenced.map((r) => r.jobId));
      const deletableJobIds = trackedJobIds.filter((id) => !referencedIds.has(id));
      if (deletableJobIds.length > 0) {
        await deleteJobsSafely(deletableJobIds);
      }
    }
    await db
      .delete(researchSourceContainers)
      .where(inArray(researchSourceContainers.id, containerIds));
  }
  await db
    .delete(researchUsers)
    .where(inArray(researchUsers.email, [OWNER_EMAIL, GUEST_EMAIL]));
  if (previousAdapters) setAdapters(previousAdapters);
});

describe("phase 04: native-text extraction", () => {
  it("extracts a native PDF page-by-page with provenance and no OCR", async () => {
    const container = await makeExtractionContainer("native-clean.pdf");
    await startExtraction(container.id, `tester-${RUN_ID}`);
    await drainJobs();

    const after = await getContainer(container.id);
    expect(after!.processingState).toBe("TEXT_EXTRACTED");

    const run = await getLatestExtractionRun(container.id);
    expect(run).toBeDefined();
    expect(run!.status).toBe("COMPLETE");
    expect(run!.pageCount).toBe(2);
    expect(run!.sourceChecksum).toBe(container.contentSha256);
    expect(run!.adapters).toMatchObject({
      nativeText: { name: "poppler-pdftotext" },
    });

    const extractions = await db
      .select()
      .from(researchPageExtractions)
      .where(eq(researchPageExtractions.runId, run!.id));
    expect(extractions).toHaveLength(2);
    for (const e of extractions) {
      expect(e.mode).toBe("NATIVE");
      expect(e.imageStorageKey).toBeNull();
      expect(e.ocrMeanConfidence).toBeNull();
      expect(e.rawTextSha256).toBe(sha256(e.rawText));
      expect(e.rawText.length).toBeGreaterThan(0);
    }

    // Character offsets are contiguous across pages (page N+1 starts at
    // page N's end + 1) so downstream spans can address the container text.
    const sorted = [...extractions].sort((a, b) => a.charStart - b.charStart);
    expect(sorted[0]!.charStart).toBe(0);
    expect(sorted[1]!.charStart).toBe(sorted[0]!.charEnd + 1);

    // Layout blocks exist and carry block-level char spans + reading order.
    const blocks = await db
      .select()
      .from(researchPageBlocks)
      .where(eq(researchPageBlocks.pageExtractionId, sorted[0]!.id));
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) {
      expect(b.charEnd).toBeGreaterThanOrEqual(b.charStart);
      expect(b.readingOrder).toBeGreaterThanOrEqual(0);
    }

    // Transformation recorded (judicial-text integrity: extraction is a
    // reviewable transformation, never silent).
    const transformations = await db
      .select()
      .from(researchTransformations)
      .where(
        and(
          eq(researchTransformations.containerId, container.id),
          eq(researchTransformations.kind, "extraction"),
        ),
      );
    expect(transformations).toHaveLength(1);
  });

  it("re-running extraction is idempotent (no duplicate runs or pages)", async () => {
    const container = await makeExtractionContainer("native-clean.pdf");
    await startExtraction(container.id, `tester-${RUN_ID}`);
    await drainJobs();
    // A parallel test worker may have claimed our extract job and still be
    // mid-run — poll briefly until the container leaves EXTRACTION_PENDING.
    for (let poll = 0; poll < 30; poll++) {
      const c = await getContainer(container.id);
      if (c!.processingState !== "EXTRACTION_PENDING") break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    // Second start: container is TEXT_EXTRACTED, so startExtraction refuses.
    await expect(
      startExtraction(container.id, `tester-${RUN_ID}`),
    ).rejects.toThrow(/INVALID_STATE|is TEXT_EXTRACTED/);

    const runs = await db
      .select()
      .from(researchExtractionRuns)
      .where(eq(researchExtractionRuns.containerId, container.id));
    expect(runs).toHaveLength(1);
    const extractions = await db
      .select()
      .from(researchPageExtractions)
      .where(eq(researchPageExtractions.runId, runs[0]!.id));
    expect(extractions).toHaveLength(2);
  });
});

describe("phase 04: OCR extraction", () => {
  it("OCRs a scanned PDF, stores the page image, and records confidence", async () => {
    const container = await makeExtractionContainer("scanned-judgment.pdf");
    await startExtraction(container.id, `tester-${RUN_ID}`);
    await drainJobs();
    // A parallel test worker may have claimed our extract job and still be
    // mid-run — poll briefly until the container leaves EXTRACTION_PENDING.
    for (let poll = 0; poll < 60; poll++) {
      const c = await getContainer(container.id);
      if (c!.processingState !== "EXTRACTION_PENDING") break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    const run = await getLatestExtractionRun(container.id);
    expect(run).toBeDefined();
    const [extraction] = await db
      .select()
      .from(researchPageExtractions)
      .where(eq(researchPageExtractions.runId, run!.id));
    expect(extraction!.mode).toBe("OCR");
    expect(extraction!.ocrMeanConfidence).not.toBeNull();
    // The stored key is whatever storage.put returned (adapters may prefix).
    expect(extraction!.imageStorageKey).toContain(
      `extractions/${container.id}/${run!.id}/page-1.png`,
    );
    // The original page image is stored with checksum provenance.
    const png = stored.get(extraction!.imageStorageKey!);
    expect(png).toBeDefined();
    expect(sha256(png!)).toBe(extraction!.imageSha256);
    const artifacts = await db
      .select()
      .from(researchStoredArtifacts)
      .where(eq(researchStoredArtifacts.containerId, container.id));
    expect(
      artifacts.some((a) => a.storageKey === extraction!.imageStorageKey),
    ).toBe(true);

    // Clean synthetic scan: OCR recovers the ground-truth text.
    expect(extraction!.rawText).toContain("SYNTHETIC");
    expect(extraction!.rawText).toContain("BETA LOGISTICS");

    // Review routing follows the confidence threshold deterministically.
    const after = await getContainer(container.id);
    if (extraction!.ocrMeanConfidence! >= OCR_REVIEW_CONFIDENCE_THRESHOLD) {
      expect(after!.processingState).toBe("TEXT_EXTRACTED");
    } else {
      expect(after!.processingState).toBe("OCR_REVIEW_REQUIRED");
    }
  }, 120_000);

  it("never fakes text when OCR is unavailable — routes to review instead", async () => {
    const withDefaults = getAdapters();
    setAdapters({
      ocr: {
        name: "disabled-test-ocr",
        version: "0",
        isEnabled: () => false,
        async recognize() {
          throw new Error("OCR disabled");
        },
      },
    });
    try {
      const container = await makeExtractionContainer("scanned-judgment.pdf");
      await startExtraction(container.id, `tester-${RUN_ID}`);
      await drainJobs();

      const after = await getContainer(container.id);
      expect(after!.processingState).toBe("OCR_REVIEW_REQUIRED");

      const run = await getLatestExtractionRun(container.id);
      const [extraction] = await db
        .select()
        .from(researchPageExtractions)
        .where(eq(researchPageExtractions.runId, run!.id));
      // Uncertainty preserved: no guessed content.
      expect(extraction!.rawText).toBe("");
      const warnings = await db
        .select()
        .from(researchPageWarnings)
        .where(eq(researchPageWarnings.pageExtractionId, extraction!.id));
      expect(warnings.some((w) => w.code === "POSSIBLE_MISSING_TEXT")).toBe(
        true,
      );
      const reviews = await db
        .select()
        .from(researchReviewItems)
        .where(eq(researchReviewItems.containerId, container.id));
      expect(reviews.some((r) => r.kind === "ocr")).toBe(true);
    } finally {
      setAdapters({ ocr: withDefaults.ocr });
    }
  });

  it("re-running after OCR_REVIEW_REQUIRED enqueues a new job and never strands the container", async () => {
    const withDefaults = getAdapters();
    setAdapters({
      ocr: {
        name: "disabled-test-ocr",
        version: "0",
        isEnabled: () => false,
        async recognize() {
          throw new Error("OCR disabled");
        },
      },
    });
    let container;
    let firstRunId: number;
    try {
      container = await makeExtractionContainer("scanned-judgment.pdf");
      const first = await startExtraction(container.id, `tester-${RUN_ID}`);
      expect(first.jobId).not.toBeNull();
      await drainJobs();
      // A parallel test worker may have claimed our extract job and still be
      // mid-run — poll briefly until the container leaves EXTRACTION_PENDING.
      let mid = await getContainer(container.id);
      for (
        let poll = 0;
        poll < 30 && mid!.processingState === "EXTRACTION_PENDING";
        poll++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        mid = await getContainer(container.id);
      }
      expect(mid!.processingState).toBe("OCR_REVIEW_REQUIRED");
      const firstRun = await getLatestExtractionRun(container.id);
      firstRunId = firstRun!.id;
    } finally {
      setAdapters({ ocr: withDefaults.ocr });
    }

    // Rerun after review: must enqueue a NEW job (rerun-safe idempotency key)
    // and move the container back to EXTRACTION_PENDING.
    const rerun = await startExtraction(container!.id, `tester-${RUN_ID}`);
    expect(rerun.jobId).not.toBeNull();
    const pending = await getContainer(container!.id);
    expect(pending!.processingState).toBe("EXTRACTION_PENDING");

    // A duplicate start while the rerun job is queued deduplicates without
    // touching state — no stranded transitions with no job behind them.
    const dup = await startExtraction(container!.id, `tester-${RUN_ID}`);
    expect(dup.jobId).toBeNull();

    await drainJobs();
    // A parallel test worker may have claimed the rerun job and still be
    // mid-run when the local drain returns — poll until it settles.
    let after = await getContainer(container!.id);
    for (
      let poll = 0;
      poll < 60 && after!.processingState === "EXTRACTION_PENDING";
      poll++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      after = await getContainer(container!.id);
    }
    // Whatever the outcome, the container is never stuck in
    // EXTRACTION_PENDING once the queue drains.
    expect(after!.processingState).not.toBe("EXTRACTION_PENDING");

    // The rerun must create a FRESH run that actually re-extracts pages —
    // it must never reuse the failed run's page extractions and flip the
    // container to TEXT_EXTRACTED without reprocessing.
    const secondRun = await getLatestExtractionRun(container!.id);
    expect(secondRun!.id).not.toBe(firstRunId!);
    const secondExtractions = await db
      .select()
      .from(researchPageExtractions)
      .where(eq(researchPageExtractions.runId, secondRun!.id));
    expect(secondExtractions.length).toBeGreaterThan(0);
    if (after!.processingState === "TEXT_EXTRACTED") {
      // Real OCR ran on the rerun: text must have been regenerated, not
      // inherited from the empty first-run extraction.
      expect(
        secondExtractions.some((e) => (e.rawText ?? "").trim().length > 0),
      ).toBe(true);
    }
  }, 120_000);

  it("routes pages with multiple uncertainty warnings to review even with high OCR confidence", async () => {
    const withDefaults = getAdapters();
    setAdapters({
      ocr: {
        name: "uncertain-test-ocr",
        version: "0",
        isEnabled: () => true,
        async recognize() {
          return {
            text: "CLEAR smudge",
            words: [
              {
                text: "CLEAR",
                confidence: 96,
                bbox: { x: 10, y: 10, width: 50, height: 12, unit: "px" as const },
              },
              {
                text: "smudge",
                confidence: 12, // below WORD_ILLEGIBLE_CONFIDENCE → ILLEGIBLE_REGION
                bbox: { x: 70, y: 10, width: 50, height: 12, unit: "px" as const },
              },
            ],
            meanConfidence: 95, // above the review threshold
            rotationDegrees: 90,
            rotationConfidence: 1, // below threshold → PAGE_ROTATION_UNCERTAIN
            languages: ["eng"],
          };
        },
      },
    });
    try {
      const container = await makeExtractionContainer("scanned-judgment.pdf");
      await startExtraction(container.id, `tester-${RUN_ID}`);
      await drainJobs();

      const after = await getContainer(container.id);
      expect(after!.processingState).toBe("OCR_REVIEW_REQUIRED");
      const run = await getLatestExtractionRun(container.id);
      const [extraction] = await db
        .select()
        .from(researchPageExtractions)
        .where(eq(researchPageExtractions.runId, run!.id));
      expect(extraction!.ocrMeanConfidence).toBe(95);
      const warnings = await db
        .select()
        .from(researchPageWarnings)
        .where(eq(researchPageWarnings.pageExtractionId, extraction!.id));
      const codes = warnings.map((w) => w.code);
      expect(codes).toContain("ILLEGIBLE_REGION");
      expect(codes).toContain("PAGE_ROTATION_UNCERTAIN");
      const reviews = await db
        .select()
        .from(researchReviewItems)
        .where(eq(researchReviewItems.containerId, container.id));
      expect(
        reviews.some((r) => String(r.reason).includes("uncertainty warnings")),
      ).toBe(true);
    } finally {
      setAdapters({ ocr: withDefaults.ocr });
    }
  });
});

describe("phase 04: layout analyzer", () => {
  it("orders two-column text left column before right", () => {
    const mkWord = (text: string, x: number, y: number) => ({
      text,
      bbox: { x, y, width: 40, height: 10, unit: "pt" as const },
    });
    const page = {
      pageNumber: 1,
      hasTextLayer: true,
      width: 600,
      height: 800,
      unit: "pt" as const,
      words: [
        // Right column interleaved in stream order — analyzer must reorder.
        // Column rows are vertically offset so line grouping keeps the two
        // columns on distinct lines (as real two-column output does).
        mkWord("R1", 330, 106),
        mkWord("L1", 50, 100),
        mkWord("R2", 330, 126),
        mkWord("L2", 50, 120),
        mkWord("R3", 330, 146),
        mkWord("L3", 50, 140),
        mkWord("R4", 330, 166),
        mkWord("L4", 50, 160),
        mkWord("R5", 330, 186),
        mkWord("L5", 50, 180),
        mkWord("R6", 330, 206),
        mkWord("L6", 50, 200),
      ],
    };
    const analysis = heuristicLayoutAnalyzer.analyze(page);
    const text = analysis.pageText.replaceAll(/\s+/g, " ");
    expect(text.indexOf("L6")).toBeLessThan(text.indexOf("R1"));
  });
});

describe("phase 04: web layer (extraction routes + review UI)", () => {
  // Generous timeout: under parallel-worker load another worker may claim the
  // extract job and take a while to finish before /pages serves output.
  it("serves pages, detail, image, corrections, and the review UI", { timeout: 120_000 }, async () => {
    const app = await makeTestApp();
    const container = await makeExtractionContainer("scanned-judgment.pdf");

    // Kick extraction through the HTTP surface.
    const kick = await request(app)
      .post(`/api/research/containers/${container.id}/extract`)
      .expect(202);
    expect(kick.body.jobId).toBeTruthy();
    await drainJobs();
    // A parallel test worker may have claimed our extract job and still be
    // mid-run — poll until the pages endpoint actually serves the extraction
    // output (the container can linger in intermediate states while the other
    // worker finishes, during which /pages still 404s or returns no pages).
    let pagesRes = await request(app).get(
      `/api/research/containers/${container.id}/pages`,
    );
    for (
      let poll = 0;
      poll < 60 && !(pagesRes.status === 200 && pagesRes.body.pages?.length > 0);
      poll++
    ) {
      if (poll > 0 && poll % 10 === 0) {
        // If a parallel worker claimed the job and died without finishing it,
        // no amount of waiting helps — re-kick extraction and drain again.
        await request(app).post(`/api/research/containers/${container.id}/extract`);
        await drainJobs();
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      pagesRes = await request(app).get(
        `/api/research/containers/${container.id}/pages`,
      );
    }
    expect(pagesRes.status).toBe(200);
    expect(pagesRes.body.pages).toHaveLength(1);
    const pageInfo = pagesRes.body.pages[0];
    expect(pageInfo.mode).toBe("OCR");
    expect(pageInfo.hasImage).toBe(true);
    expect(typeof pageInfo.warningCount).toBe("number");

    const detail = await request(app)
      .get(`/api/research/pages/${pageInfo.pageExtractionId}`)
      .expect(200);
    expect(detail.body.extraction.rawText).toContain("SYNTHETIC");
    expect(Array.isArray(detail.body.blocks)).toBe(true);
    expect(Array.isArray(detail.body.warnings)).toBe(true);

    const image = await request(app)
      .get(`/api/research/pages/${pageInfo.pageExtractionId}/image`)
      .expect(200);
    expect(image.headers["content-type"]).toContain("image/png");
    expect(image.body.length).toBeGreaterThan(1000);

    // Append-only corrections: raw preserved, versions increment, audited.
    const c1 = await request(app)
      .post(`/api/research/pages/${pageInfo.pageExtractionId}/corrections`)
      .send({ correctedText: "Corrected v1", reason: "fix OCR error" })
      .expect(201);
    expect(c1.body.version).toBe(1);
    expect(c1.body.rawOutput).toContain("SYNTHETIC");
    const c2 = await request(app)
      .post(`/api/research/pages/${pageInfo.pageExtractionId}/corrections`)
      .send({ correctedText: "Corrected v2", reason: "second pass" })
      .expect(201);
    expect(c2.body.version).toBe(2);

    // Raw extraction row untouched by corrections.
    const [rawAfter] = await db
      .select()
      .from(researchPageExtractions)
      .where(eq(researchPageExtractions.id, pageInfo.pageExtractionId));
    expect(rawAfter!.rawText).toContain("SYNTHETIC");

    const audits = await db
      .select()
      .from(researchAuditEvents)
      .where(
        and(
          eq(researchAuditEvents.entityType, "page_extraction"),
          eq(researchAuditEvents.entityId, pageInfo.pageExtractionId),
        ),
      );
    expect(audits).toHaveLength(2);
    expect(audits[0]!.actor).toBe(OWNER_EMAIL);

    // Correction history in the detail payload, newest first.
    const detail2 = await request(app)
      .get(`/api/research/pages/${pageInfo.pageExtractionId}`)
      .expect(200);
    expect(detail2.body.corrections.map((c: { version: number }) => c.version))
      .toEqual([2, 1]);

    // Review UI is served as HTML behind the same access checks.
    const ui = await request(app)
      .get(`/api/research/containers/${container.id}/review-ui`)
      .expect(200);
    expect(ui.headers["content-type"]).toContain("text/html");
    expect(ui.text).toContain("review");

    // Deny-by-default: a guest can neither start extraction nor correct.
    await request(app)
      .post(`/api/research/containers/${container.id}/extract`)
      .set("x-test-email", GUEST_EMAIL)
      .expect(403);
    await request(app)
      .post(`/api/research/pages/${pageInfo.pageExtractionId}/corrections`)
      .set("x-test-email", GUEST_EMAIL)
      .send({ correctedText: "x", reason: "y" })
      .expect(403);
  });
});
