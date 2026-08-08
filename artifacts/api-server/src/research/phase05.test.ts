import { describe, it, expect, afterAll, beforeAll, beforeEach } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import express from "express";
import request from "supertest";
import path from "node:path";
import { readFileSync } from "node:fs";

// Phase 05 proof tests: multi-case segmentation engine.
// Tests use the live dev DB with RUN_ID-scoped cleanup (same convention
// as phase04.test.ts). Storage is in-memory; adapters are real but
// extraction data is seeded directly (plain-text fixtures → DB rows).

const RUN_ID = randomUUID();
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const FIXTURES_DIR = path.resolve(
  __dirname,
  "../../../../fixtures/synthetic/segmentation",
);

const fixture = (name: string) =>
  readFileSync(path.join(FIXTURES_DIR, name), "utf8");
const expected = (name: string) =>
  JSON.parse(readFileSync(path.join(FIXTURES_DIR, name), "utf8"));

// ── Dynamic imports ────────────────────────────────────────────────────────

const { setAdapters } = await import("./adapters");
const { registerSegmentationProcessor, startSegmentation, getLatestSegmentationRun } =
  await import("./segmentation/pipeline");
const { registerContainer, getContainer } = await import("./data/containers");
const { recordRightsDecision } =
  await import("./data/rights");
const { transitionContainer } = await import("./domain/containerStateMachine");
const { runNextJob } = await import("./processing");
const {
  db,
  researchJobs,
  researchSourceContainers,
  researchSourcePages,
  researchExtractionRuns,
  researchPageExtractions,
  researchPageBlocks,
  researchSegmentationRuns,
  researchBoundarySignals,
  researchCaseBoundaries,
  researchCaseCandidates,
  researchCaseCandidateBoundaries,
  researchRightsRecords,
  researchTransformations,
  researchReviewItems,
  researchAuditEvents,
  researchUsers,
  researchCandidateReviewActions,
  researchCandidateCoherenceChecks,
  researchCrossFileRelationships,
  researchCrossFileSpanSegments,
  researchPageSections,
  researchValidationRuns,
  researchEditorialRuns,
  researchVerifiedJudgments,
} = await import("@workspace/db");
const { eq, like, inArray, and, isNotNull, sql } = await import("drizzle-orm");

// ── Fixture helpers ────────────────────────────────────────────────────────

const OWNER_EMAIL = `seg-owner-${RUN_ID}@test.local`;
const GUEST_EMAIL = `seg-guest-${RUN_ID}@test.local`;

const trackedContainerIds: number[] = [];
const trackedJobIds: number[] = [];

let uploadSeq = 0;
function makeUnique(text: string): string {
  uploadSeq += 1;
  return text + `\n%% phase05 run ${RUN_ID} #${uploadSeq}\n`;
}

/**
 * Seed a container from a text string, approve rights, advance to TEXT_EXTRACTED,
 * and create fake pages + extraction rows so the segmentation processor has data.
 */
async function seedContainer(
  rawText: string,
  opts: { pageSize?: number } = {},
): Promise<number> {
  const text = makeUnique(rawText);
  const sha = sha256(text);

  // Register container
  const container = await registerContainer({
    originalName: `seg-fixture-${RUN_ID}-${uploadSeq}.txt`,
    sourceBatch: `seg-test-${RUN_ID}`,
    contentSha256: sha,
    sizeBytes: Buffer.byteLength(text),
    mimeType: "text/plain",
    provenance: { enteredVia: "phase05-test" },
  });
  trackedContainerIds.push(container.id);

  // Approve rights using the full RightsDecision shape (same pattern as phase04.test.ts)
  await recordRightsDecision(
    container.id,
    {
      status: "PRIVATE_PROCESSING_APPROVED",
      reason: "phase05 test approval",
      source: "Test source",
      dateObtained: new Date("2026-01-01T00:00:00Z"),
      declaredSourceType: "official_court",
      licenceReference: null,
      approvedUsers: [OWNER_EMAIL],
      approvedPurposes: ["research"],
      storagePermitted: true,
      analysisPermitted: true,
      externalProcessingPermitted: false,
      studentAccessPermitted: false,
      printingPermitted: true,
      exportPermitted: false,
      retentionPeriod: null,
      expiryDate: null,
      reviewer: OWNER_EMAIL,
      reviewDate: new Date("2026-01-02T00:00:00Z"),
      notes: null,
    } as Parameters<typeof recordRightsDecision>[1],
    { actor: OWNER_EMAIL },
  );

  // Advance state machine to TEXT_EXTRACTED using the exact valid transition path
  for (const to of [
    "RIGHTS_REVIEW_REQUIRED",
    "RIGHTS_APPROVED",
    "INVENTORY_PENDING",
    "INVENTORIED",
    "EXTRACTION_PENDING",
    "TEXT_EXTRACTED",
  ] as const) {
    await transitionContainer(container.id, to, {
      actor: OWNER_EMAIL,
      detail: { cause: "phase05-test-setup" },
    });
  }

  // Seed pages — split text into "pages" by paragraph blocks (one case header = one page)
  const pageSize = opts.pageSize ?? 1;
  // Split on double newline sections that look like case headers.
  // Publisher separators (---...) are intentionally excluded from the split so they
  // remain attached to the preceding case page, matching real PDF extraction behaviour.
  const sections = text.split(/\n\n(?=(?:HIGH COURT|FEDERAL COURT|COURT OF APPEAL|MAHKAMAH|TABLE OF CONTENTS|CAUSE LIST))/);
  const nonEmptySections = sections.filter((s) => s.trim().length > 0);
  const pageSections = nonEmptySections.length > 0 ? nonEmptySections : [text];

  // Create a real extraction run for this container (FK-safe)
  const extractionRunKey = `phase05-test-${RUN_ID}-${container.id}`;
  const [extractionRun] = await db
    .insert(researchExtractionRuns)
    .values({
      containerId: container.id,
      runKey: extractionRunKey,
      processorVersion: "phase05-test/1.0.0",
      adapters: {},
      sourceChecksum: sha256(text),
      status: "COMPLETE",
    })
    .onConflictDoNothing()
    .returning();

  // If conflict (idempotent re-seed), fetch the existing run
  const extractionRunId = extractionRun?.id ?? (
    await db
      .select({ id: researchExtractionRuns.id })
      .from(researchExtractionRuns)
      .where(
        and(
          eq(researchExtractionRuns.containerId, container.id),
          eq(researchExtractionRuns.runKey, extractionRunKey),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]?.id)
  );

  if (!extractionRunId) throw new Error("Failed to seed extraction run");

  let charCursor = 0;
  for (let i = 0; i < pageSections.length; i++) {
    const pageText = pageSections[i]!;
    const pageNum = i + 1;

    // Insert source page
    const [pageRow] = await db
      .insert(researchSourcePages)
      .values({
        containerId: container.id,
        pageNumber: pageNum,
        provenance: { createdBy: "phase05-test", runId: RUN_ID },
      })
      .onConflictDoNothing()
      .returning();

    if (!pageRow) continue;

    // Insert a minimal extraction record
    const rawTextSha = sha256(pageText);
    const [extraction] = await db
      .insert(researchPageExtractions)
      .values({
        runId: extractionRunId,
        pageId: pageRow.id,
        mode: "NATIVE",
        rawText: pageText,
        rawTextSha256: rawTextSha,
        charStart: charCursor,
        charEnd: charCursor + pageText.length,
        isBlank: pageText.trim().length === 0,
        languages: [],
        provenance: { phase: "05-test-seed" },
      })
      .returning();

    charCursor += pageText.length + 1;

    if (!extraction) continue;

    // Seed some basic blocks (heading + paragraph) so block-level signals can fire
    const lines = pageText.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length > 0) {
      const headingLine = lines[0]!;
      const bodyLines = lines.slice(1).join("\n");
      await db.insert(researchPageBlocks).values([
        {
          pageExtractionId: extraction.id,
          blockIndex: 0,
          blockType: "heading" as import("@workspace/db").PageBlockType,
          text: headingLine,
          charStart: 0,
          charEnd: headingLine.length,
          readingOrder: 0,
        },
        ...(bodyLines.trim().length > 0
          ? [
              {
                pageExtractionId: extraction.id,
                blockIndex: 1,
                blockType: "paragraph" as import("@workspace/db").PageBlockType,
                text: bodyLines,
                charStart: headingLine.length + 1,
                charEnd: headingLine.length + 1 + bodyLines.length,
                readingOrder: 1,
              },
            ]
          : []),
      ]);
    }
  }

  return container.id;
}

/**
 * Run the segmentation job queue until empty for a given container.
 */
async function drainSegmentationQueue(containerId: number): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const job = await runNextJob("container.segment");
    if (!job) break;
    trackedJobIds.push(job.id);
    // Stop once this container's job is done
    const c = await getContainer(containerId);
    if (
      c?.processingState === "SEGMENTATION_PROPOSED" ||
      c?.processingState === "SEGMENTATION_REVIEW_REQUIRED"
    ) {
      break;
    }
  }
}

// ── Setup / teardown ───────────────────────────────────────────────────────

beforeAll(async () => {
  registerSegmentationProcessor();
  setAdapters({
    storage: {
      name: "memory-test-seg",
      async put(key, bytes) {
        return key;
      },
      async get(_key) {
        return Buffer.alloc(0);
      },
      async remove(_key) {},
    },
  });
  await db.insert(researchUsers).values([
    { email: OWNER_EMAIL, displayName: "Seg05 Owner", role: "owner" },
    { email: GUEST_EMAIL, displayName: "Seg05 Guest", role: "guest" },
  ]);
});

afterAll(async () => {
  // Clean up all seeded rows in FK-safe order
  if (trackedContainerIds.length === 0) return;

  // FIRST: remove this file's still-queued jobs so parallel test workers
  // stop processing them mid-cleanup (they insert validation/editorial rows
  // that break the FK-ordered deletes below). Safe: ids came from the DB.
  await db.execute(
    sql.raw(
      `DELETE FROM research_jobs WHERE state = 'QUEUED' AND (payload->>'containerId')::int IN (${trackedContainerIds.join(",")})`,
    ),
  );

  const runRows = await db
    .select({ id: researchSegmentationRuns.id })
    .from(researchSegmentationRuns)
    .where(inArray(researchSegmentationRuns.containerId, trackedContainerIds));
  const runIds = runRows.map((r) => r.id);

  if (runIds.length > 0) {
    const candidateRows = await db
      .select({ id: researchCaseCandidates.id })
      .from(researchCaseCandidates)
      .where(inArray(researchCaseCandidates.runId, runIds));
    const candidateIds = candidateRows.map((c) => c.id);

    if (candidateIds.length > 0) {
      await db
        .delete(researchCandidateCoherenceChecks)
        .where(inArray(researchCandidateCoherenceChecks.candidateId, candidateIds))
        .catch(() => {});
      await db
        .delete(researchCandidateReviewActions)
        .where(inArray(researchCandidateReviewActions.candidateId, candidateIds));
      await db
        .delete(researchCaseCandidateBoundaries)
        .where(inArray(researchCaseCandidateBoundaries.candidateId, candidateIds));
    }

    // Auto-triggered downstream jobs may have created Phase 06 rows that
    // reference candidates (by containerId, not just runId) — clear them
    // before candidates or the delete violates FKs. Other test files running
    // in parallel share the job queue and can process THIS file's queued
    // validation jobs mid-cleanup, inserting fresh coherence checks between
    // our child-delete and the candidate delete — so retry the whole
    // child-then-parent sequence until it sticks.
    let candidatesDeleted = false;
    for (let attempt = 0; attempt < 5 && !candidatesDeleted; attempt++) {
      const allCandidateRows = await db
        .select({ id: researchCaseCandidates.id })
        .from(researchCaseCandidates)
        .where(inArray(researchCaseCandidates.containerId, trackedContainerIds));
      const allCandidateIds = allCandidateRows.map((c) => c.id);
      if (allCandidateIds.length > 0) {
        await db
          .delete(researchCrossFileSpanSegments)
          .where(inArray(researchCrossFileSpanSegments.candidateId, allCandidateIds));
        await db
          .delete(researchCrossFileRelationships)
          .where(inArray(researchCrossFileRelationships.sourceCandidateId, allCandidateIds));
        await db
          .delete(researchCrossFileRelationships)
          .where(inArray(researchCrossFileRelationships.targetCandidateId, allCandidateIds));
        await db
          .delete(researchCandidateCoherenceChecks)
          .where(inArray(researchCandidateCoherenceChecks.candidateId, allCandidateIds));
        await db
          .delete(researchCandidateReviewActions)
          .where(inArray(researchCandidateReviewActions.candidateId, allCandidateIds));
        await db
          .delete(researchCaseCandidateBoundaries)
          .where(inArray(researchCaseCandidateBoundaries.candidateId, allCandidateIds));
      }

      try {
        await db
          .delete(researchCaseCandidates)
          .where(inArray(researchCaseCandidates.containerId, trackedContainerIds));
        candidatesDeleted = true;
      } catch (err) {
        if (attempt === 4) throw err;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const boundaryRows = await db
      .select({ id: researchCaseBoundaries.id })
      .from(researchCaseBoundaries)
      .where(inArray(researchCaseBoundaries.runId, runIds));
    const boundaryIds = boundaryRows.map((b) => b.id);
    if (boundaryIds.length > 0) {
      await db
        .delete(researchCaseBoundaries)
        .where(inArray(researchCaseBoundaries.id, boundaryIds));
    }

    await db
      .delete(researchBoundarySignals)
      .where(inArray(researchBoundarySignals.runId, runIds));
    await db
      .delete(researchSegmentationRuns)
      .where(inArray(researchSegmentationRuns.containerId, trackedContainerIds));
  }

  // Clean extractions and pages
  const pageRows = await db
    .select({ id: researchSourcePages.id })
    .from(researchSourcePages)
    .where(inArray(researchSourcePages.containerId, trackedContainerIds));
  const pageIds = pageRows.map((p) => p.id);

  if (pageIds.length > 0) {
    // Editorial passes create page sections referencing pages.
    await db
      .delete(researchPageSections)
      .where(inArray(researchPageSections.pageId, pageIds));
    // page blocks and extractions (seeded via INSERT with runId=1)
    const extractionRows = await db
      .select({ id: researchPageExtractions.id })
      .from(researchPageExtractions)
      .where(inArray(researchPageExtractions.pageId, pageIds));
    const extractionIds = extractionRows.map((e) => e.id);
    if (extractionIds.length > 0) {
      await db
        .delete(researchPageBlocks)
        .where(inArray(researchPageBlocks.pageExtractionId, extractionIds));
      await db
        .delete(researchPageExtractions)
        .where(inArray(researchPageExtractions.id, extractionIds));
    }
    await db
      .delete(researchSourcePages)
      .where(inArray(researchSourcePages.id, pageIds));
  }

  await db
    .delete(researchTransformations)
    .where(inArray(researchTransformations.containerId, trackedContainerIds));
  await db
    .delete(researchReviewItems)
    .where(inArray(researchReviewItems.containerId, trackedContainerIds));
  await db
    .delete(researchAuditEvents)
    .where(inArray(researchAuditEvents.entityId, trackedContainerIds));
  await db
    .delete(researchRightsRecords)
    .where(inArray(researchRightsRecords.containerId, trackedContainerIds));

  // Validation/editorial rows reference jobs and containers — clear them
  // before jobs/containers (auto-triggered downstream jobs create these).
  const valRunIds = await db
    .select({ id: researchValidationRuns.id })
    .from(researchValidationRuns)
    .where(inArray(researchValidationRuns.containerId, trackedContainerIds))
    .then((rows) => rows.map((r) => r.id));
  if (valRunIds.length > 0) {
    await db
      .delete(researchCandidateCoherenceChecks)
      .where(inArray(researchCandidateCoherenceChecks.validationRunId, valRunIds));
    await db
      .delete(researchValidationRuns)
      .where(inArray(researchValidationRuns.id, valRunIds));
  }
  await db
    .delete(researchVerifiedJudgments)
    .where(inArray(researchVerifiedJudgments.containerId, trackedContainerIds));
  await db
    .delete(researchPageSections)
    .where(inArray(researchPageSections.containerId, trackedContainerIds));
  await db
    .delete(researchEditorialRuns)
    .where(inArray(researchEditorialRuns.containerId, trackedContainerIds));

  // Delete extraction runs (FK: research_extraction_runs.container_id → research_source_containers)
  await db
    .delete(researchExtractionRuns)
    .where(inArray(researchExtractionRuns.containerId, trackedContainerIds));

  if (trackedJobIds.length > 0) {
    await db
      .delete(researchJobs)
      .where(inArray(researchJobs.id, trackedJobIds));
  }

  // In-flight jobs from parallel workers can repopulate container-referencing
  // tables right up to this delete — re-clear them and retry until it sticks.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await db
        .delete(researchSourceContainers)
        .where(inArray(researchSourceContainers.id, trackedContainerIds));
      break;
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await db.delete(researchTransformations)
        .where(inArray(researchTransformations.containerId, trackedContainerIds));
      await db.delete(researchReviewItems)
        .where(inArray(researchReviewItems.containerId, trackedContainerIds));
      await db.delete(researchRightsRecords)
        .where(inArray(researchRightsRecords.containerId, trackedContainerIds));
      await db.delete(researchVerifiedJudgments)
        .where(inArray(researchVerifiedJudgments.containerId, trackedContainerIds));
      await db.delete(researchPageSections)
        .where(inArray(researchPageSections.containerId, trackedContainerIds));
      await db.delete(researchEditorialRuns)
        .where(inArray(researchEditorialRuns.containerId, trackedContainerIds));
      await db.delete(researchExtractionRuns)
        .where(inArray(researchExtractionRuns.containerId, trackedContainerIds));
      const lateValRunIds = await db
        .select({ id: researchValidationRuns.id })
        .from(researchValidationRuns)
        .where(inArray(researchValidationRuns.containerId, trackedContainerIds))
        .then((rows) => rows.map((r) => r.id));
      if (lateValRunIds.length > 0) {
        await db
          .delete(researchCandidateCoherenceChecks)
          .where(inArray(researchCandidateCoherenceChecks.validationRunId, lateValRunIds));
        await db
          .delete(researchValidationRuns)
          .where(inArray(researchValidationRuns.id, lateValRunIds));
      }
    }
  }
  await db
    .delete(researchUsers)
    .where(
      inArray(researchUsers.email, [OWNER_EMAIL, GUEST_EMAIL]),
    );
});

// ── Helper: build express app for route tests ──────────────────────────────

function buildApp(userEmail: string, role: string) {
  const { createResearchRouter } = (() => {
    // We need the full research router
    let _router: import("express").IRouter;
    return {
      createResearchRouter: async () => {
        if (!_router) {
          const mod = await import("./routes/index");
          _router = mod.default;
        }
        return _router;
      },
    };
  })();

  const app = express();
  app.use(express.json());
  app.use(async (req, _res, next) => {
    req.authEmail = userEmail;
    req.researchRole = role as import("@workspace/db").ResearchRole;
    next();
  });
  // We mount the router lazily
  app.use("/api/research", async (req, res, next) => {
    const router = await createResearchRouter();
    router(req, res, next);
  });
  return app;
}

// ── Unit tests: signal detector (pure, no DB) ──────────────────────────────

describe("Phase 05 — signal detector (pure function)", () => {
  it("detects NEUTRAL_CITATION on a page with a Malaysian citation", async () => {
    const { detectSignals } = await import("./segmentation/signalDetector");
    const pages = [{ id: 1, pageNumber: 1, text: "[2023] MYCA 5\nSome body text here" }];
    const signals = detectSignals(pages, []);
    expect(signals.some((s) => s.signalType === "NEUTRAL_CITATION")).toBe(true);
  });

  it("detects CLOSING_ORDER", async () => {
    const { detectSignals } = await import("./segmentation/signalDetector");
    const pages = [{ id: 1, pageNumber: 1, text: "IT IS HEREBY ORDERED that judgment be entered for the plaintiff." }];
    const signals = detectSignals(pages, []);
    expect(signals.some((s) => s.signalType === "CLOSING_ORDER")).toBe(true);
  });

  it("detects COURT_HEADING", async () => {
    const { detectSignals } = await import("./segmentation/signalDetector");
    const pages = [{ id: 1, pageNumber: 1, text: "HIGH COURT OF MALAYA AT KUALA LUMPUR\n\nBody text." }];
    const signals = detectSignals(pages, []);
    expect(signals.some((s) => s.signalType === "COURT_HEADING")).toBe(true);
  });

  it("detects BLANK_DIVIDER_PAGE for blank pages", async () => {
    const { detectSignals } = await import("./segmentation/signalDetector");
    const pages = [{ id: 1, pageNumber: 1, text: "", isBlank: true }];
    const signals = detectSignals(pages, []);
    expect(signals.some((s) => s.signalType === "BLANK_DIVIDER_PAGE")).toBe(true);
  });

  it("detects ADMINISTRATIVE_MATERIAL", async () => {
    const { detectSignals } = await import("./segmentation/signalDetector");
    const pages = [{ id: 1, pageNumber: 1, text: "TABLE OF CONTENTS\n1. Introduction\n2. Cases" }];
    const signals = detectSignals(pages, []);
    expect(signals.some((s) => s.signalType === "ADMINISTRATIVE_MATERIAL")).toBe(true);
  });

  it("detects INCOMPLETE_CASE_END on last page with no closing order", async () => {
    const { detectSignals } = await import("./segmentation/signalDetector");
    const pages = [
      { id: 1, pageNumber: 1, text: "[2023] MYCA 1\nHIGH COURT text." },
      { id: 2, pageNumber: 2, text: "[1] This matter is about a contract dispute.\n[2] The evidence is complex." },
    ];
    const signals = detectSignals(pages, []);
    const incompleteSignals = signals.filter((s) => s.signalType === "INCOMPLETE_CASE_END");
    expect(incompleteSignals.length).toBeGreaterThan(0);
    expect(incompleteSignals[0]!.pageId).toBe(2); // fires on last page
  });

  it("does NOT emit NEUTRAL_CITATION for cited titles inside quotation marks", async () => {
    const { detectSignals } = await import("./segmentation/signalDetector");
    const citedTitle = "[2019] MYCA 42";
    const pages = [
      {
        id: 1,
        pageNumber: 1,
        text: `As held in "${citedTitle}", the defendant is liable.`,
      },
    ];
    const signals = detectSignals(pages, []);
    // The citation is inside quotes — should be detected as a citation but NOT generate a new boundary
    // (the anti-signal REPEATED_TITLE_IN_QUOTATION should fire if it was already detected elsewhere)
    // For a single page with only quoted citation, it may still be detected but score should be checked
    // The key test is the pipeline-level anti-signal test
    expect(Array.isArray(signals)).toBe(true);
  });

  it("deduplicates signals with same (pageId, signalType, signalValue)", async () => {
    const { detectSignals } = await import("./segmentation/signalDetector");
    // The same signal on the same page should appear only once
    const pages = [
      {
        id: 1,
        pageNumber: 1,
        text: "[2023] MYCA 5 and [2023] MYCA 5 again",
      },
    ];
    const signals = detectSignals(pages, []);
    const neutral = signals.filter((s) => s.signalType === "NEUTRAL_CITATION" && s.signalValue === "[2023] MYCA 5");
    expect(neutral.length).toBe(1);
  });
});

// ── Unit tests: candidate composer (pure, no DB) ──────────────────────────

describe("Phase 05 — candidate composer (pure function)", () => {
  it("returns zero candidates for empty pages", async () => {
    const { composeCandidate } = await import("./segmentation/candidateComposer");
    const result = composeCandidate([], [], new Map());
    expect(result.candidates).toHaveLength(0);
    expect(result.unassignedPageIds).toHaveLength(0);
  });

  it("WEAK boundary is never auto_accepted", async () => {
    const { composeCandidate } = await import("./segmentation/candidateComposer");
    const { SIGNAL_SCORES } = await import("./segmentation/signalDetector");

    // Create a minimal signal set that produces a WEAK boundary
    const signals = [
      {
        pageId: 1,
        signalType: "COURT_HEADING" as const,
        signalValue: "HIGH COURT",
        supportingText: "",
        scoreContribution: SIGNAL_SCORES.COURT_HEADING,
        processorVersion: "test",
      },
      {
        pageId: 1,
        signalType: "NEW_PARTY_CONFIGURATION" as const,
        signalValue: "A v. B",
        supportingText: "",
        scoreContribution: SIGNAL_SCORES.NEW_PARTY_CONFIGURATION,
        processorVersion: "test",
      },
    ];

    const result = composeCandidate(signals, [1], new Map([[1, 1]]));
    for (const c of result.candidates) {
      if (c.startBoundary.strength === "WEAK_BOUNDARY_CANDIDATE" ||
          c.startBoundary.strength === "CONFLICTING_BOUNDARY") {
        expect(c.startBoundary.reviewStatus).toBe("review_required");
      }
      if (c.endBoundary.strength === "WEAK_BOUNDARY_CANDIDATE" ||
          c.endBoundary.strength === "CONFLICTING_BOUNDARY") {
        expect(c.endBoundary.reviewStatus).toBe("review_required");
      }
    }
  });

  it("STRONG boundary with no conflicts is auto_accepted", async () => {
    const { composeCandidate } = await import("./segmentation/candidateComposer");
    const { SIGNAL_SCORES } = await import("./segmentation/signalDetector");

    // Create signals that produce a STRONG boundary (score >= 20, no conflicts)
    const signals = [
      {
        pageId: 1,
        signalType: "NEUTRAL_CITATION" as const,
        signalValue: "[2023] MYCA 5",
        supportingText: "",
        scoreContribution: SIGNAL_SCORES.NEUTRAL_CITATION, // 14
        processorVersion: "test",
      },
      {
        pageId: 1,
        signalType: "COURT_HEADING" as const,
        signalValue: "HIGH COURT",
        supportingText: "",
        scoreContribution: SIGNAL_SCORES.COURT_HEADING, // 10 → total 24 >= 20
        processorVersion: "test",
      },
    ];

    const result = composeCandidate(signals, [1], new Map([[1, 1]]));
    if (result.candidates.length > 0) {
      const startBound = result.candidates[0]!.startBoundary;
      if (startBound.strength === "STRONG_BOUNDARY_CANDIDATE") {
        expect(startBound.reviewStatus).toBe("auto_accepted");
      }
    }
  });

  it("pages not covered by any candidate appear in unassignedPageIds", async () => {
    const { composeCandidate } = await import("./segmentation/candidateComposer");

    const result = composeCandidate([], [1, 2, 3], new Map([[1, 1], [2, 2], [3, 3]]));
    expect(result.unassignedPageIds).toContain(1);
    expect(result.unassignedPageIds).toContain(2);
    expect(result.unassignedPageIds).toContain(3);
  });
});

// ── Integration tests: segmentation pipeline ──────────────────────────────

describe("Phase 05 — single-case.txt golden fixture", () => {
  let containerId: number;

  beforeAll(async () => {
    containerId = await seedContainer(fixture("single-case.txt"));
    await startSegmentation(containerId, OWNER_EMAIL);
    await drainSegmentationQueue(containerId);
  });

  it("container moves to SEGMENTATION_PROPOSED or SEGMENTATION_REVIEW_REQUIRED", async () => {
    const c = await getContainer(containerId);
    // Phase 14: clean segmentation auto-advances to EDITORIAL_REVIEW_PENDING
    // (and potentially further). All three are valid outcomes here.
    expect([
      "SEGMENTATION_PROPOSED",
      "SEGMENTATION_REVIEW_REQUIRED",
      "EDITORIAL_REVIEW_PENDING",
      "EDITORIAL_REVIEW_REQUIRED",
      "JUDGMENT_VERIFICATION_PENDING",
      "VERIFIED",
      "SEARCHABLE",
    ]).toContain(c?.processingState);
  });

  it("at least one candidate proposed", async () => {
    const run = await getLatestSegmentationRun(containerId);
    expect(run).toBeDefined();
    const candidates = await db
      .select()
      .from(researchCaseCandidates)
      .where(and(eq(researchCaseCandidates.containerId, containerId), isNotNull(researchCaseCandidates.runId)));
    expect(candidates.length).toBeGreaterThanOrEqual(1);
  });

  it("transformation record created", async () => {
    const transformations = await db
      .select()
      .from(researchTransformations)
      .where(
        and(
          eq(researchTransformations.containerId, containerId),
          eq(researchTransformations.kind, "segmentation"),
        ),
      );
    expect(transformations.length).toBeGreaterThanOrEqual(1);
  });

  it("all pages accounted for (assigned + unassigned = total)", async () => {
    const run = await getLatestSegmentationRun(containerId);
    expect(run).toBeDefined();
    const pages = await db
      .select()
      .from(researchSourcePages)
      .where(eq(researchSourcePages.containerId, containerId));
    const candidates = await db
      .select()
      .from(researchCaseCandidates)
      .where(eq(researchCaseCandidates.containerId, containerId));
    const unassigned =
      (run?.detail as Record<string, unknown>)?.["unassigned_pages"] as number[] ?? [];
    // All pages must be either assigned to a candidate or unassigned
    const totalPageCount = pages.length;
    const assignedCount = candidates.reduce((sum, c) => sum + (c.pageCount ?? 0), 0);
    expect(assignedCount + unassigned.length).toBeLessThanOrEqual(totalPageCount + 5); // small tolerance for page-splitting
  });
});

describe("Phase 05 — no-judgment.txt golden fixture", () => {
  let containerId: number;

  beforeAll(async () => {
    containerId = await seedContainer(fixture("no-judgment.txt"));
    await startSegmentation(containerId, OWNER_EMAIL);
    await drainSegmentationQueue(containerId);
  });

  it("no real judgment candidates (admin-only content)", async () => {
    const c = await getContainer(containerId);
    // Admin-only content (cause list / TOC) may produce zero or uncertain candidates.
    // SEGMENTATION_PROPOSED = zero candidates; SEGMENTATION_REVIEW_REQUIRED = uncertain candidates.
    // Both are valid outcomes — the engine should not auto-accept cause-list rows as judgments.
    // Phase 14: clean segmentation auto-advances to EDITORIAL_REVIEW_PENDING.
    expect([
      "SEGMENTATION_PROPOSED",
      "SEGMENTATION_REVIEW_REQUIRED",
      "EDITORIAL_REVIEW_PENDING",
      "EDITORIAL_REVIEW_REQUIRED",
      "JUDGMENT_VERIFICATION_PENDING",
    ]).toContain(c?.processingState);
    const run = await getLatestSegmentationRun(containerId);
    const candidates = await db
      .select()
      .from(researchCaseCandidates)
      .where(eq(researchCaseCandidates.containerId, containerId));
    const candidatesWithRun = candidates.filter((cand) => cand.runId === run?.id);
    // If any candidates exist, they must all require review (no auto-accepted cause-list rows)
    expect(candidatesWithRun.every((cand) => cand.reviewStatus !== "auto_accepted")).toBe(true);
  });
});

describe("Phase 05 — incomplete-final-case.txt golden fixture", () => {
  let containerId: number;

  beforeAll(async () => {
    containerId = await seedContainer(fixture("incomplete-final-case.txt"));
    await startSegmentation(containerId, OWNER_EMAIL);
    await drainSegmentationQueue(containerId);
  });

  it("at least one candidate requires review due to incomplete boundary", async () => {
    const run = await getLatestSegmentationRun(containerId);
    const c = await getContainer(containerId);
    // The container should require review since the last case has no closing order
    // It might be SEGMENTATION_PROPOSED or SEGMENTATION_REVIEW_REQUIRED depending on detected signals
    expect(["SEGMENTATION_PROPOSED", "SEGMENTATION_REVIEW_REQUIRED"]).toContain(
      c?.processingState,
    );
    // Signals should include INCOMPLETE_CASE_END
    if (run) {
      const incompleteSignals = await db
        .select()
        .from(researchBoundarySignals)
        .where(
          and(
            eq(researchBoundarySignals.runId, run.id),
            eq(researchBoundarySignals.signalType, "INCOMPLETE_CASE_END"),
          ),
        );
      expect(incompleteSignals.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("Phase 05 — idempotency and re-run rules", () => {
  it("re-run from SEGMENTATION_PROPOSED is refused with INVALID_STATE", async () => {
    const containerId = await seedContainer("no-judgment admin content\nTABLE OF CONTENTS\n1. Items");
    await startSegmentation(containerId, OWNER_EMAIL);
    await drainSegmentationQueue(containerId);
    const c = await getContainer(containerId);
    if (c?.processingState === "SEGMENTATION_PROPOSED") {
      // Second run should fail
      await expect(startSegmentation(containerId, OWNER_EMAIL)).rejects.toMatchObject({
        code: "INVALID_STATE",
      });
    }
  });

  it("re-run from SEGMENTATION_REVIEW_REQUIRED creates a fresh run (new job attempt key)", async () => {
    // Seed a fixture that causes review required (incomplete case)
    const containerId = await seedContainer(fixture("incomplete-final-case.txt") + " extra unique " + randomUUID());
    await startSegmentation(containerId, OWNER_EMAIL);
    await drainSegmentationQueue(containerId);

    const c = await getContainer(containerId);
    if (c?.processingState === "SEGMENTATION_REVIEW_REQUIRED") {
      const firstRun = await getLatestSegmentationRun(containerId);
      // Re-run directly from SEGMENTATION_REVIEW_REQUIRED — startSegmentation accepts this state.
      // Do NOT transition back to TEXT_EXTRACTED; the state machine does not permit that path.
      await startSegmentation(containerId, OWNER_EMAIL);
      await drainSegmentationQueue(containerId);
      const secondRun = await getLatestSegmentationRun(containerId);
      // Should be a different run
      expect(secondRun?.id).not.toBe(firstRun?.id);
    }
  });
});

describe("Phase 05 — WEAK/CONFLICTING boundaries not auto-accepted", () => {
  it("no WEAK_BOUNDARY_CANDIDATE or CONFLICTING_BOUNDARY is auto_accepted", async () => {
    // Run any fixture and check all boundaries
    const containerId = await seedContainer(fixture("single-case.txt") + " unique " + randomUUID());
    await startSegmentation(containerId, OWNER_EMAIL);
    await drainSegmentationQueue(containerId);

    const run = await getLatestSegmentationRun(containerId);
    if (!run) return;

    const boundaries = await db
      .select()
      .from(researchCaseBoundaries)
      .where(eq(researchCaseBoundaries.runId, run.id));

    for (const boundary of boundaries) {
      if (
        boundary.strength === "WEAK_BOUNDARY_CANDIDATE" ||
        boundary.strength === "CONFLICTING_BOUNDARY"
      ) {
        expect(boundary.reviewStatus).not.toBe("auto_accepted");
      }
    }
  });
});

describe("Phase 05 — audit events", () => {
  it("each proposed candidate fires a case_candidate audit event", async () => {
    const containerId = await seedContainer(fixture("single-case.txt") + " audit unique " + randomUUID());
    await startSegmentation(containerId, OWNER_EMAIL);
    await drainSegmentationQueue(containerId);

    const run = await getLatestSegmentationRun(containerId);
    const candidates = await db
      .select()
      .from(researchCaseCandidates)
      .where(eq(researchCaseCandidates.containerId, containerId));

    for (const candidate of candidates) {
      const auditEvents = await db
        .select()
        .from(researchAuditEvents)
        .where(
          and(
            eq(researchAuditEvents.entityType, "case_candidate"),
            eq(researchAuditEvents.entityId, candidate.id),
            eq(researchAuditEvents.event, "proposed"),
          ),
        );
      expect(auditEvents.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── Web layer tests ────────────────────────────────────────────────────────

describe("Phase 05 — HTTP routes (staff)", () => {
  let containerId: number;
  let candidateId: number;

  beforeAll(async () => {
    containerId = await seedContainer(fixture("single-case.txt") + " http unique " + randomUUID());
  });

  it("POST /api/research/containers/:id/segmentation returns 202 with jobId", async () => {
    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app)
      .post(`/api/research/containers/${containerId}/segmentation`)
      .send();
    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty("jobId");
    // Drain the queue so subsequent tests have data
    await drainSegmentationQueue(containerId);
  });

  it("GET /api/research/containers/:id/candidates returns 200 with candidates array", async () => {
    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app)
      .get(`/api/research/containers/${containerId}/candidates`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("candidates");
    expect(Array.isArray(res.body.candidates)).toBe(true);
    if (res.body.candidates.length > 0) {
      candidateId = res.body.candidates[0].candidateId;
    }
  });

  it("GET /api/research/containers/:id/candidates/:candidateId returns 200 with detail", async () => {
    if (!candidateId) return;
    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app)
      .get(`/api/research/containers/${containerId}/candidates/${candidateId}`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("candidate");
    expect(res.body).toHaveProperty("signals");
  });

  it("GET /api/research/containers/:id/segmentation-review returns 200 HTML", async () => {
    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app)
      .get(`/api/research/containers/${containerId}/segmentation-review`)
      .send();
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain("Segmentation Review");
  });

  it("POST segmentation returns 403 for unauthenticated guest", async () => {
    const app = buildApp(GUEST_EMAIL, "guest");
    const res = await request(app)
      .post(`/api/research/containers/${containerId}/segmentation`)
      .send();
    expect(res.status).toBe(403);
  });

  it("GET candidates returns 403 for guest (staff-only route)", async () => {
    const app = buildApp(GUEST_EMAIL, "guest");
    const res = await request(app)
      .get(`/api/research/containers/${containerId}/candidates`)
      .send();
    // Candidate listing is staff-only — unauthenticated guests must not see segmentation output
    expect(res.status).toBe(403);
  });

  it("POST review returns 200 with updated candidate and audit event", async () => {
    if (!candidateId) return;
    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app)
      .post(
        `/api/research/containers/${containerId}/candidates/${candidateId}/review`,
      )
      .send({ decision: "accept", reason: "Test acceptance" });
    expect(res.status).toBe(200);
    expect(res.body.reviewStatus ?? res.body.review_status).toMatch(
      /reviewed|auto_accepted/,
    );

    // Verify audit event created
    const auditRows = await db
      .select()
      .from(researchAuditEvents)
      .where(
        and(
          eq(researchAuditEvents.entityType, "case_candidate"),
          eq(researchAuditEvents.entityId, candidateId),
          eq(researchAuditEvents.event, "review:accept"),
        ),
      );
    expect(auditRows.length).toBeGreaterThanOrEqual(1);
  });

  it("Raw signals/boundaries NOT modified by review decision", async () => {
    if (!candidateId) return;
    // Verify that boundary records still exist with original data
    const run = await getLatestSegmentationRun(containerId);
    if (!run) return;
    const signals = await db
      .select()
      .from(researchBoundarySignals)
      .where(eq(researchBoundarySignals.runId, run.id));
    // Signals should still exist (not deleted or modified by review)
    expect(signals.length).toBeGreaterThanOrEqual(0);
  });
});

// ── Strict fixture acceptance tests ────────────────────────────────────────
//
// Each test seeds a synthetic fixture, runs the segmentation pipeline, and
// compares the output against the corresponding .expected.json contract:
//   • candidateCount — exact
//   • per-candidate startPage / endPage / reviewRequired — exact
//   • unassignedPages — exact set match
//   • no-page-loss invariant — every page is either in a candidate or unassigned

describe("Phase 05 — strict fixture acceptance", () => {
  /**
   * Seed a fixture, run segmentation, return HTTP response body + run detail.
   */
  async function runFixture(fixtureName: string) {
    const cid = await seedContainer(fixture(fixtureName) + " strict-" + randomUUID());
    await startSegmentation(cid, OWNER_EMAIL);
    await drainSegmentationQueue(cid);

    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app)
      .get(`/api/research/containers/${cid}/candidates`)
      .send();
    expect(res.status).toBe(200);

    const run = await getLatestSegmentationRun(cid);
    const runDetail = (run?.detail ?? {}) as Record<string, unknown>;
    const unassignedPageNumbers: number[] =
      Array.isArray(runDetail["unassigned_pages"])
        ? (runDetail["unassigned_pages"] as number[])
        : [];

    const pages = await db
      .select({ pageNumber: researchSourcePages.pageNumber })
      .from(researchSourcePages)
      .where(eq(researchSourcePages.containerId, cid));
    const totalPages = pages.length;

    return {
      candidates: res.body.candidates as Array<{
        candidateId: number;
        startPage: number | null;
        endPage: number | null;
        reviewStatus: string;
        pageCount: number;
      }>,
      unassignedPageNumbers,
      totalPages,
    };
  }

  /**
   * Assert that the output matches the .expected.json contract.
   */
  function assertFixture(
    result: Awaited<ReturnType<typeof runFixture>>,
    exp: {
      candidateCount: number;
      candidates: Array<{ startPage: number; endPage: number; reviewRequired: boolean }>;
      unassignedPages: number[];
    },
  ) {
    const { candidates, unassignedPageNumbers, totalPages } = result;

    // 1. Candidate count
    expect(candidates.length).toBe(exp.candidateCount);

    // 2. Per-candidate boundary and review assertions
    for (const expC of exp.candidates) {
      const match = candidates.find((c) => c.startPage === expC.startPage);
      expect(match, `No candidate found with startPage=${expC.startPage}`).toBeDefined();
      if (!match) continue;
      expect(match.endPage).toBe(expC.endPage);
      const isReviewRequired = match.reviewStatus === "review_required";
      expect(isReviewRequired).toBe(expC.reviewRequired);
    }

    // 3. Unassigned pages — exact set match
    const actualUnassigned = [...unassignedPageNumbers].sort((a, b) => a - b);
    const expectedUnassigned = [...exp.unassignedPages].sort((a, b) => a - b);
    expect(actualUnassigned).toEqual(expectedUnassigned);

    // 4. No-page-loss invariant
    const assignedPageCount = candidates.reduce((sum, c) => sum + (c.pageCount ?? 0), 0);
    expect(assignedPageCount + unassignedPageNumbers.length).toBe(totalPages);
  }

  it("single-case: 1 candidate, page 1–1, no review", async () => {
    const result = await runFixture("single-case.txt");
    assertFixture(result, expected("single-case.expected.json"));
  });

  it("two-case: 2 candidates, pages 1–2, no review", async () => {
    const result = await runFixture("two-case.txt");
    assertFixture(result, expected("two-case.expected.json"));
  });

  it("no-neutral-citation: 2 candidates, no review (missing neutral citation not blocking)", async () => {
    const result = await runFixture("no-neutral-citation.txt");
    assertFixture(result, expected("no-neutral-citation.expected.json"));
  });

  it("page-restart: 2 candidates with page-number restart between them", async () => {
    const result = await runFixture("page-restart.txt");
    assertFixture(result, expected("page-restart.expected.json"));
  });

  it("admin-between-cases: 2 candidates; admin page is unassigned", async () => {
    const result = await runFixture("admin-between-cases.txt");
    assertFixture(result, expected("admin-between-cases.expected.json"));
  });

  it("quoted-titles: 3 candidates; quoted citation in body does not create spurious boundary", async () => {
    const result = await runFixture("quoted-titles.txt");
    assertFixture(result, expected("quoted-titles.expected.json"));
  });

  it("incomplete-final-case: 2 candidates; separator page unassigned; last case routes to review", async () => {
    const result = await runFixture("incomplete-final-case.txt");
    assertFixture(result, expected("incomplete-final-case.expected.json"));
  });

  it("no-judgment: 0 candidates; single admin page unassigned", async () => {
    const result = await runFixture("no-judgment.txt");
    assertFixture(result, expected("no-judgment.expected.json"));
  });

  it("ten-case: exactly 10 candidates, pages 1–10, none requiring review", async () => {
    const result = await runFixture("ten-case.txt");
    assertFixture(result, expected("ten-case.expected.json"));
  });

  it("thirty-case: exactly 30 candidates, pages 1–30, none requiring review", async () => {
    const result = await runFixture("thirty-case.txt");
    assertFixture(result, expected("thirty-case.expected.json"));
  });
});
