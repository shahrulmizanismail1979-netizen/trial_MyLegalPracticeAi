import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import express from "express";
import request from "supertest";

// Phase 07 proof tests: publisher-content isolation, section classification,
// completeness checking, isolation gate, editorial processor, and routes.
// The suite uses a disposable per-file schema via isolateProofTests,
// with additional RUN_ID-scoped cleanup.

const RUN_ID = randomUUID();
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// ── Dynamic imports ────────────────────────────────────────────────────────

const { setAdapters } = await import("./adapters");
const { registerContainer, getContainer } = await import("./data/containers");
const { recordRightsDecision } = await import("./data/rights");
const { transitionContainer } = await import("./domain/containerStateMachine");
const { runNextJob } = await import("./processing");
const {
  registerEditorialProcessor,
  startEditorialClassification,
  EDITORIAL_JOB_KIND,
} = await import("./isolation/editorialProcessor");
const { classifySections } = await import("./isolation/sectionClassifier");
const { checkCompleteness } = await import("./isolation/completenessChecker");
const { applyIsolationGate, gateHasExclusions } = await import("./isolation/isolationGate");
const {
  db,
  researchSourceContainers,
  researchSourcePages,
  researchExtractionRuns,
  researchPageExtractions,
  researchPageSections,
  researchEditorialRuns,
  researchVerifiedJudgments,
  researchTransformations,
  researchJobs,
  researchUsers,
  researchCaseCandidates,
  researchCaseBoundaries,
  researchCaseCandidateBoundaries,
  researchSegmentationRuns,
  researchBoundarySignals,
  researchValidationRuns,
  researchCandidateCoherenceChecks,
  researchPageBlocks,
} = await import("@workspace/db");
const { eq, inArray, and, sql } = await import("drizzle-orm");

// ── App helper (same pattern as phase05.test.ts) ───────────────────────────

function buildApp(userEmail: string, role: string) {
  const app = express();
  app.use(express.json());
  app.use(async (req, _res, next) => {
    req.authEmail = userEmail;
    req.researchRole = role as import("@workspace/db").ResearchRole;
    next();
  });
  let _router: import("express").IRouter;
  app.use("/api/research", async (req, res, next) => {
    if (!_router) {
      const mod = await import("./routes/index");
      _router = mod.default;
    }
    _router(req, res, next);
  });
  return app;
}

// ── Setup ──────────────────────────────────────────────────────────────────

const OWNER_EMAIL = `ph07-owner-${RUN_ID}@test.local`;
const trackedContainerIds: number[] = [];
let uploadSeq = 0;

function makeUnique(text: string): string {
  uploadSeq += 1;
  return text + `\n%% phase07 run ${RUN_ID} #${uploadSeq}\n`;
}

async function seedContainer(rawText: string): Promise<number> {
  const text = makeUnique(rawText);
  const sha = sha256(text);
  const container = await registerContainer({
    originalName: `ph07-fixture-${RUN_ID}-${uploadSeq}.txt`,
    sourceBatch: `ph07-batch-${RUN_ID}`,
    contentSha256: sha,
    sizeBytes: Buffer.byteLength(text),
    mimeType: "text/plain",
    provenance: { enteredVia: "phase07-test" },
  });
  trackedContainerIds.push(container.id);

  await recordRightsDecision(container.id, {
    status: "PRIVATE_PROCESSING_APPROVED",
    reason: "phase07 test",
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
    reviewDate: new Date("2026-01-01T00:00:00Z"),
    notes: null,
  }, { actor: OWNER_EMAIL });

  return container.id;
}

/**
 * Seed a page extraction row correctly: inserts an extraction run row and a
 * page extraction row, then returns the page extraction id.
 */
async function seedPageExtraction(containerId: number, pageId: number, text: string): Promise<number> {
  const [exRun] = await db
    .insert(researchExtractionRuns)
    .values({
      containerId,
      jobId: null,
      runKey: `exrun-${RUN_ID}-${containerId}-${pageId}`,
      processorVersion: "test@1",
      adapters: {},
      sourceChecksum: sha256(text),
      status: "COMPLETE",
    })
    .returning({ id: researchExtractionRuns.id });
  const raw = text;
  const [ex] = await db
    .insert(researchPageExtractions)
    .values({
      runId: exRun!.id,
      pageId,
      mode: "NATIVE",
      rawText: raw,
      rawTextSha256: sha256(raw),
      charStart: 0,
      charEnd: raw.length,
      provenance: {},
    })
    .returning({ id: researchPageExtractions.id });
  return ex!.id;
}

/**
 * Seed a container through to JUDGMENT_VERIFICATION_PENDING state by
 * manually transitioning through the state machine and inserting the
 * minimum required rows for the editorial processor and verify endpoint.
 */
async function seedVerificationReadyContainer(opts: {
  pageTexts?: string[];
  sectionClassifications?: string[];
} = {}): Promise<{
  containerId: number;
  candidateId: number;
  sectionIds: number[];
}> {
  const pageTexts = opts.pageTexts ?? [
    "IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR\nCIVIL SUIT NO: 22-12345-2024\n\nCORAM: TAN SRI JUSTICE AHMAD\n\nGROUNDS OF JUDGMENT",
    "[1] This is the judgment of the court.\n[2] IT IS HEREBY ORDERED that judgment be entered for the plaintiff with costs.",
  ];

  const containerId = await seedContainer(pageTexts.join("\n\n"));

  await transitionContainer(containerId, "RIGHTS_REVIEW_REQUIRED", { actor: "test" });
  await transitionContainer(containerId, "RIGHTS_APPROVED", { actor: "test" });
  await transitionContainer(containerId, "INVENTORY_PENDING", { actor: "test" });
  await transitionContainer(containerId, "INVENTORIED", { actor: "test" });
  await transitionContainer(containerId, "EXTRACTION_PENDING", { actor: "test" });

  // Insert pages + extractions
  const pageIds: number[] = [];
  for (let i = 0; i < pageTexts.length; i++) {
    const [page] = await db
      .insert(researchSourcePages)
      .values({ containerId, pageNumber: i + 1, provenance: {} })
      .returning({ id: researchSourcePages.id });
    pageIds.push(page!.id);
    await seedPageExtraction(containerId, page!.id, pageTexts[i]!);
  }

  await transitionContainer(containerId, "TEXT_EXTRACTED", { actor: "test" });
  await transitionContainer(containerId, "SEGMENTATION_PENDING", { actor: "test" });

  // Insert segmentation run + candidate + boundaries
  const [segRun] = await db
    .insert(researchSegmentationRuns)
    .values({
      containerId,
      jobId: null,
      runKey: `seg-${RUN_ID}-${containerId}`,
      processorVersion: "test@1",
      sourceChecksum: sha256(`seg-${RUN_ID}-${containerId}`),
      status: "COMPLETE",
    })
    .returning({ id: researchSegmentationRuns.id });

  const [startBound] = await db
    .insert(researchCaseBoundaries)
    .values({
      runId: segRun!.id,
      pageId: pageIds[0]!,
      boundaryRole: "start",
      strength: "STRONG_BOUNDARY_CANDIDATE",
      compositeScore: 1.0,
      conflictingSignalCount: 0,
    })
    .returning({ id: researchCaseBoundaries.id });
  const [endBound] = await db
    .insert(researchCaseBoundaries)
    .values({
      runId: segRun!.id,
      pageId: pageIds[pageIds.length - 1]!,
      boundaryRole: "end",
      strength: "STRONG_BOUNDARY_CANDIDATE",
      compositeScore: 1.0,
      conflictingSignalCount: 0,
    })
    .returning({ id: researchCaseBoundaries.id });

  const [candidate] = await db
    .insert(researchCaseCandidates)
    .values({
      containerId,
      runId: segRun!.id,
      startPageId: pageIds[0]!,
      strength: "STRONG_BOUNDARY_CANDIDATE",
      reviewStatus: "reviewed",
    })
    .returning({ id: researchCaseCandidates.id });
  const candidateId = candidate!.id;

  await db.insert(researchCaseCandidateBoundaries).values({
    candidateId,
    startBoundaryId: startBound!.id,
    endBoundaryId: endBound!.id,
  });

  await transitionContainer(containerId, "SEGMENTATION_PROPOSED", { actor: "test" });
  await transitionContainer(containerId, "EDITORIAL_REVIEW_PENDING", { actor: "test" });
  await transitionContainer(containerId, "JUDGMENT_VERIFICATION_PENDING", { actor: "test" });

  // Insert editorial run + page sections
  const [editRun] = await db
    .insert(researchEditorialRuns)
    .values({
      containerId,
      jobId: null,
      processorVersion: "container.editorial_classify@1",
      sectionCount: pageIds.length,
      uncertainCount: 0,
      suspectedEditorialCount: 0,
      criticalWarningCount: 0,
      nonCriticalWarningCount: 0,
    })
    .returning({ id: researchEditorialRuns.id });

  const classifications = opts.sectionClassifications ?? pageIds.map(() => "VERIFIED_JUDICIAL_TEXT");
  const sectionIds: number[] = [];
  for (let i = 0; i < pageIds.length; i++) {
    const [sec] = await db
      .insert(researchPageSections)
      .values({
        containerId,
        pageId: pageIds[i]!,
        editorialRunId: editRun!.id,
        sectionIndex: 0,
        classification: (classifications[i] ?? "VERIFIED_JUDICIAL_TEXT") as any,
        confidence: 0.9,
        supportingEvidence: ["test"],
        detectorVersion: "container.editorial_classify@1",
        isolationApplied: false,
      })
      .returning({ id: researchPageSections.id });
    sectionIds.push(sec!.id);
  }

  return { containerId, candidateId, sectionIds };
}

beforeAll(async () => {
  await db.insert(researchUsers).values({
    email: OWNER_EMAIL,
    displayName: "Phase07 Test Owner",
    role: "owner",
    active: true,
  }).onConflictDoNothing();

  registerEditorialProcessor();
});

afterAll(async () => {
  if (trackedContainerIds.length === 0) return;
  const candidateIds = (await db.select({ id: researchCaseCandidates.id }).from(researchCaseCandidates).where(inArray(researchCaseCandidates.containerId, trackedContainerIds))).map(r => r.id);
  const segRunIds = (await db.select({ id: researchSegmentationRuns.id }).from(researchSegmentationRuns).where(inArray(researchSegmentationRuns.containerId, trackedContainerIds))).map(r => r.id);
  await db.delete(researchVerifiedJudgments).where(inArray(researchVerifiedJudgments.containerId, trackedContainerIds)).catch(() => {});
  await db.delete(researchPageSections).where(inArray(researchPageSections.containerId, trackedContainerIds)).catch(() => {});
  await db.delete(researchEditorialRuns).where(inArray(researchEditorialRuns.containerId, trackedContainerIds)).catch(() => {});
  if (candidateIds.length > 0) {
    await db.delete(researchCaseCandidateBoundaries).where(inArray(researchCaseCandidateBoundaries.candidateId, candidateIds)).catch(() => {});
  }
  await db.delete(researchCaseCandidates).where(inArray(researchCaseCandidates.containerId, trackedContainerIds)).catch(() => {});
  if (segRunIds.length > 0) {
    await db.delete(researchCaseBoundaries).where(inArray(researchCaseBoundaries.runId, segRunIds)).catch(() => {});
    await db.delete(researchBoundarySignals).where(inArray(researchBoundarySignals.runId, segRunIds)).catch(() => {});
  }
  await db.delete(researchSegmentationRuns).where(inArray(researchSegmentationRuns.containerId, trackedContainerIds)).catch(() => {});
  await db.delete(researchValidationRuns).where(inArray(researchValidationRuns.containerId, trackedContainerIds)).catch(() => {});
  await db.delete(researchPageExtractions).where(inArray(researchPageExtractions.pageId, (await db.select({ id: researchSourcePages.id }).from(researchSourcePages).where(inArray(researchSourcePages.containerId, trackedContainerIds))).map(r => r.id))).catch(() => {});
  await db.delete(researchExtractionRuns).where(inArray(researchExtractionRuns.containerId, trackedContainerIds)).catch(() => {});
  await db.delete(researchTransformations).where(inArray(researchTransformations.containerId, trackedContainerIds)).catch(() => {});
  await db.delete(researchSourcePages).where(inArray(researchSourcePages.containerId, trackedContainerIds)).catch(() => {});
  const jobsToDelete = await db.select({ id: researchJobs.id }).from(researchJobs).where(
    inArray(sql<string>`${researchJobs.payload}->>'containerId'`, trackedContainerIds.map(String)),
  ).catch(() => []);
  if (jobsToDelete.length > 0) {
    await db.delete(researchJobs).where(inArray(researchJobs.id, jobsToDelete.map(j => j.id))).catch(() => {});
  }
  await db.delete(researchSourceContainers).where(inArray(researchSourceContainers.id, trackedContainerIds)).catch(() => {});
});

// ══════════════════════════════════════════════════════════════════════════
// UNIT TESTS — classifySections (pure, no DB)
// ══════════════════════════════════════════════════════════════════════════

describe("classifySections — pure function", () => {
  it("classifies clear court heading as VERIFIED_JUDICIAL_TEXT", () => {
    const pages = [{ id: 1, pageNumber: 1, text: "IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR\nCIVIL SUIT NO: 22-100-2024", isBlank: false }];
    const blocks = [{ id: 10, pageId: 1, blockIndex: 0, text: "IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR", blockType: "heading", font: null }];
    const result = classifySections(pages, blocks);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.classification).toBe("VERIFIED_JUDICIAL_TEXT");
  });

  it("classifies CORAM block as VERIFIED_JUDICIAL_TEXT", () => {
    const pages = [{ id: 1, pageNumber: 1, text: "CORAM: JUSTICE AHMAD", isBlank: false }];
    const blocks = [{ id: 10, pageId: 1, blockIndex: 0, text: "CORAM: JUSTICE AHMAD", blockType: "paragraph", font: null }];
    const result = classifySections(pages, blocks);
    expect(result[0]!.classification).toBe("VERIFIED_JUDICIAL_TEXT");
  });

  it("classifies JUDGMENT heading as VERIFIED_JUDICIAL_TEXT", () => {
    const pages = [{ id: 1, pageNumber: 1, text: "JUDGMENT", isBlank: false }];
    const blocks = [{ id: 10, pageId: 1, blockIndex: 0, text: "JUDGMENT", blockType: "heading", font: { bold: true } }];
    const result = classifySections(pages, blocks);
    expect(result[0]!.classification).toBe("VERIFIED_JUDICIAL_TEXT");
  });

  it("classifies closing order as VERIFIED_JUDICIAL_TEXT", () => {
    const pages = [{ id: 1, pageNumber: 1, text: "IT IS HEREBY ORDERED that the appeal is dismissed with costs.", isBlank: false }];
    const blocks = [{ id: 10, pageId: 1, blockIndex: 0, text: "IT IS HEREBY ORDERED that the appeal is dismissed with costs.", blockType: "paragraph", font: null }];
    const result = classifySections(pages, blocks);
    expect(result[0]!.classification).toBe("VERIFIED_JUDICIAL_TEXT");
  });

  it("classifies numbered paragraph block as VERIFIED_JUDICIAL_TEXT", () => {
    const text = "[1] The court has considered all the evidence presented.\n[2] The plaintiff's claim is hereby allowed.";
    const pages = [{ id: 1, pageNumber: 1, text, isBlank: false }];
    const blocks = [{ id: 10, pageId: 1, blockIndex: 0, text, blockType: "paragraph", font: null }];
    const result = classifySections(pages, blocks);
    expect(result[0]!.classification).toBe("VERIFIED_JUDICIAL_TEXT");
  });

  it("classifies TABLE OF CONTENTS as ADMINISTRATIVE_METADATA", () => {
    const text = "TABLE OF CONTENTS\n\n1. Case A v Case B ..... 1";
    const pages = [{ id: 1, pageNumber: 1, text, isBlank: false }];
    const blocks = [{ id: 10, pageId: 1, blockIndex: 0, text, blockType: "paragraph", font: null }];
    const result = classifySections(pages, blocks);
    expect(result[0]!.classification).toBe("ADMINISTRATIVE_METADATA");
  });

  it("classifies blank page as SOURCE_ARTIFACT", () => {
    const pages = [{ id: 1, pageNumber: 1, text: "", isBlank: true }];
    const result = classifySections(pages, []);
    expect(result.length).toBe(1);
    expect(result[0]!.classification).toBe("SOURCE_ARTIFACT");
  });

  it("classifies publisher branding block as SUSPECTED_PUBLISHER_EDITORIAL", () => {
    const text = "MALAYAN LAW JOURNAL\n© 2024 LexisNexis. All Rights Reserved.";
    const pages = [{ id: 1, pageNumber: 1, text, isBlank: false }];
    const blocks = [{ id: 10, pageId: 1, blockIndex: 0, text, blockType: "heading", font: { bold: true } }];
    const result = classifySections(pages, blocks);
    expect(result[0]!.classification).toBe("SUSPECTED_PUBLISHER_EDITORIAL");
  });

  it("classifies ISBN block as SUSPECTED_PUBLISHER_EDITORIAL", () => {
    const text = "ISBN 978-967-400-100-1\nPublished by Malayan Law Journal Sdn. Bhd.";
    const pages = [{ id: 1, pageNumber: 1, text, isBlank: false }];
    const blocks = [{ id: 10, pageId: 1, blockIndex: 0, text, blockType: "paragraph", font: null }];
    const result = classifySections(pages, blocks);
    expect(result[0]!.classification).toBe("SUSPECTED_PUBLISHER_EDITORIAL");
  });

  it("classifies editorial vocabulary as SUSPECTED_PUBLISHER_EDITORIAL", () => {
    const text = "HEADNOTES: The court in this case held that the defendant was liable.";
    const pages = [{ id: 1, pageNumber: 1, text, isBlank: false }];
    const blocks = [{ id: 10, pageId: 1, blockIndex: 0, text, blockType: "paragraph", font: null }];
    const result = classifySections(pages, blocks);
    expect(result[0]!.classification).toBe("SUSPECTED_PUBLISHER_EDITORIAL");
  });

  it("SAFEGUARD: summary text alone must NOT be classified as SUSPECTED_PUBLISHER_EDITORIAL", () => {
    const text = "SUMMARY OF DECISION\nThe court finds in favour of the plaintiff and awards damages.";
    const pages = [{ id: 1, pageNumber: 1, text, isBlank: false }];
    const blocks = [{ id: 10, pageId: 1, blockIndex: 0, text, blockType: "paragraph", font: null }];
    const result = classifySections(pages, blocks);
    expect(result[0]!.classification).not.toBe("SUSPECTED_PUBLISHER_EDITORIAL");
  });

  it("SAFEGUARD: catchword-like text alone must NOT be classified as SUSPECTED_PUBLISHER_EDITORIAL", () => {
    const text = "CATCHWORDS: Contract — Breach — Remoteness of damage — Whether plaintiff suffered loss";
    const pages = [{ id: 1, pageNumber: 1, text, isBlank: false }];
    const blocks = [{ id: 10, pageId: 1, blockIndex: 0, text, blockType: "paragraph", font: null }];
    const result = classifySections(pages, blocks);
    expect(result[0]!.classification).not.toBe("SUSPECTED_PUBLISHER_EDITORIAL");
  });

  it("SAFEGUARD: bold heading alone must NOT classify as SUSPECTED_PUBLISHER_EDITORIAL", () => {
    const text = "PARTIES AND REPRESENTATION";
    const pages = [{ id: 1, pageNumber: 1, text, isBlank: false }];
    const blocks = [{ id: 10, pageId: 1, blockIndex: 0, text, blockType: "heading", font: { bold: true } }];
    const result = classifySections(pages, blocks);
    expect(result[0]!.classification).not.toBe("SUSPECTED_PUBLISHER_EDITORIAL");
  });

  it("returns higher confidence for publisher branding than for probable judicial text", () => {
    const publisherText = "MALAYAN LAW JOURNAL\n© 2024 LexisNexis";
    const judicialText = "Both parties agreed to the facts set out above.";
    const pages = [{ id: 1, pageNumber: 1, text: publisherText + "\n" + judicialText, isBlank: false }];
    const blocks = [
      { id: 10, pageId: 1, blockIndex: 0, text: publisherText, blockType: "heading", font: null },
      { id: 11, pageId: 1, blockIndex: 1, text: judicialText, blockType: "paragraph", font: null },
    ];
    const result = classifySections(pages, blocks);
    const publisherSection = result.find((s) => s.classification === "SUSPECTED_PUBLISHER_EDITORIAL");
    const judicialSection = result.find((s) => s.classification !== "SUSPECTED_PUBLISHER_EDITORIAL");
    expect(publisherSection).toBeDefined();
    expect(publisherSection!.confidence).toBeGreaterThan(0.5);
  });

  it("falls back to UNKNOWN for very short blocks with no signals", () => {
    const pages = [{ id: 1, pageNumber: 1, text: "OK", isBlank: false }];
    const blocks = [{ id: 10, pageId: 1, blockIndex: 0, text: "OK", blockType: "paragraph", font: null }];
    const result = classifySections(pages, blocks);
    expect(result[0]!.classification).toBe("UNKNOWN");
  });

  it("produces one section per block when blocks are provided", () => {
    const pages = [{ id: 1, pageNumber: 1, text: "CORAM: J\nJUDGMENT", isBlank: false }];
    const blocks = [
      { id: 10, pageId: 1, blockIndex: 0, text: "CORAM: J", blockType: "paragraph", font: null },
      { id: 11, pageId: 1, blockIndex: 1, text: "JUDGMENT", blockType: "heading", font: null },
    ];
    const result = classifySections(pages, blocks);
    expect(result).toHaveLength(2);
  });

  it("produces one section per page when no blocks are provided", () => {
    const pages = [
      { id: 1, pageNumber: 1, text: "IN THE HIGH COURT OF MALAYA\nCORAM: JUSTICE LEE", isBlank: false },
      { id: 2, pageNumber: 2, text: "[1] The court finds in favour of the plaintiff.", isBlank: false },
    ];
    const result = classifySections(pages, []);
    expect(result).toHaveLength(2);
  });

  it("records supporting evidence in all classified sections", () => {
    const text = "CORAM: TAN SRI JUSTICE RAUS";
    const pages = [{ id: 1, pageNumber: 1, text, isBlank: false }];
    const blocks = [{ id: 10, pageId: 1, blockIndex: 0, text, blockType: "paragraph", font: null }];
    const result = classifySections(pages, blocks);
    expect(result[0]!.supportingEvidence.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Completeness Checker
// ══════════════════════════════════════════════════════════════════════════

describe("checkCompleteness — pure function", () => {
  function makeSection(pageId: number, classification = "VERIFIED_JUDICIAL_TEXT"): any {
    return { pageId, sectionIndex: 0, classification, confidence: 0.9, supportingEvidence: [], detectorVersion: "test@1" };
  }

  function makePage(id: number, pageNumber: number, text: string): any {
    return { id, pageNumber, text, isBlank: false };
  }

  it("returns zero critical warnings for a complete judgment", () => {
    const pages = [
      makePage(1, 1, "IN THE HIGH COURT OF MALAYA\nCIVIL SUIT NO: 22-999-2024\nCORAM: JUSTICE A\nGROUNDS OF JUDGMENT\n[1] The facts are as follows.\n[2] IT IS HEREBY ORDERED that judgment be entered for the plaintiff."),
    ];
    const sections = [makeSection(1)];
    const result = checkCompleteness(sections, pages, 1);
    expect(result.criticalWarnings).toHaveLength(0);
  });

  it("CRITICAL: no sections → NO_JUDICIAL_SECTIONS warning", () => {
    const pages = [makePage(1, 1, "Some text")];
    const result = checkCompleteness([], pages, 1);
    expect(result.criticalWarnings.map((w) => w.code)).toContain("NO_JUDICIAL_SECTIONS");
  });

  it("CRITICAL: no dispositif → INCOMPLETE_ENDING warning", () => {
    const pages = [
      makePage(1, 1, "IN THE HIGH COURT OF MALAYA\nCIVIL SUIT NO: 22-1-2024\nCORAM: JUSTICE B\n[1] The facts are undisputed. [2] The defendant failed to perform."),
    ];
    const sections = [makeSection(1)];
    const result = checkCompleteness(sections, pages, 1);
    expect(result.criticalWarnings.map((w) => w.code)).toContain("INCOMPLETE_ENDING");
  });

  it("CRITICAL: no case-opening pattern → INCOMPLETE_OPENING warning", () => {
    const pages = [
      makePage(1, 1, "IT IS HEREBY ORDERED that the appeal is dismissed with costs."),
    ];
    const sections = [makeSection(1)];
    const result = checkCompleteness(sections, pages, 1);
    expect(result.criticalWarnings.map((w) => w.code)).toContain("INCOMPLETE_OPENING");
  });

  it("NON-CRITICAL: skipped paragraph numbers triggers warning", () => {
    const pages = [
      makePage(1, 1, "[1] First paragraph.\n[2] Second paragraph.\n[5] Fifth paragraph.\n[6] IT IS HEREBY ORDERED judgment is entered."),
    ];
    const sections = [makeSection(1)];
    const result = checkCompleteness(sections, pages, 1);
    expect(result.nonCriticalWarnings.map((w) => w.code)).toContain("SKIPPED_PARAGRAPH_NUMBERS");
  });

  it("NON-CRITICAL: duplicate paragraph numbers triggers warning", () => {
    const pages = [
      makePage(1, 1, "IN THE HIGH COURT\nCIVIL SUIT NO: 22-2-2024\nCORAM: J\n[1] First.\n[2] Second.\n[2] Duplicate second.\n[3] IT IS HEREBY ORDERED judgment for plaintiff."),
    ];
    const sections = [makeSection(1)];
    const result = checkCompleteness(sections, pages, 1);
    expect(result.nonCriticalWarnings.map((w) => w.code)).toContain("DUPLICATE_PARAGRAPH_NUMBERS");
  });

  it("NON-CRITICAL: annexure referenced but no heading triggers warning", () => {
    const pages = [
      makePage(1, 1, "IN THE HIGH COURT\nCIVIL SUIT NO: 22-3-2024\nCORAM: J\n[1] Refer to Exhibit A attached.\n[2] See Annexure B herein.\n[3] IT IS HEREBY ORDERED judgment be entered."),
    ];
    const sections = [makeSection(1)];
    const result = checkCompleteness(sections, pages, 1);
    expect(result.nonCriticalWarnings.map((w) => w.code)).toContain("POSSIBLE_MISSING_ANNEXURES");
  });

  it("NON-CRITICAL: unreadable pages trigger warning", () => {
    const pages = [
      makePage(1, 1, "IN THE HIGH COURT\nCIVIL SUIT NO: 22-4-2024\nCORAM: J\n[1] Facts.\nIT IS HEREBY ORDERED judgment for plaintiff."),
      makePage(2, 2, "  "),
    ];
    const sections = [makeSection(1), makeSection(2)];
    const result = checkCompleteness(sections, pages, 2);
    expect(result.nonCriticalWarnings.map((w) => w.code)).toContain("UNREADABLE_PAGES");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// UNIT TESTS — Isolation Gate
// ══════════════════════════════════════════════════════════════════════════

describe("applyIsolationGate — pure function", () => {
  function makeSection(classification: string, pageId = 1): any {
    return { pageId, sectionIndex: 0, classification, confidence: 0.9, supportingEvidence: [], detectorVersion: "test@1" };
  }

  it("passes VERIFIED_JUDICIAL_TEXT through the gate", () => {
    expect(applyIsolationGate([makeSection("VERIFIED_JUDICIAL_TEXT")])).toHaveLength(1);
  });

  it("passes PROBABLE_JUDICIAL_TEXT through the gate", () => {
    expect(applyIsolationGate([makeSection("PROBABLE_JUDICIAL_TEXT")])).toHaveLength(1);
  });

  it("blocks SUSPECTED_PUBLISHER_EDITORIAL", () => {
    expect(applyIsolationGate([makeSection("SUSPECTED_PUBLISHER_EDITORIAL")])).toHaveLength(0);
  });

  it("blocks ADMINISTRATIVE_METADATA", () => {
    expect(applyIsolationGate([makeSection("ADMINISTRATIVE_METADATA")])).toHaveLength(0);
  });

  it("blocks SOURCE_ARTIFACT", () => {
    expect(applyIsolationGate([makeSection("SOURCE_ARTIFACT")])).toHaveLength(0);
  });

  it("blocks UNKNOWN", () => {
    expect(applyIsolationGate([makeSection("UNKNOWN")])).toHaveLength(0);
  });

  it("blocks MANUAL_REVIEW_REQUIRED", () => {
    expect(applyIsolationGate([makeSection("MANUAL_REVIEW_REQUIRED")])).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(applyIsolationGate([])).toHaveLength(0);
  });

  it("filters mixed input correctly", () => {
    const sections = [
      makeSection("VERIFIED_JUDICIAL_TEXT", 1),
      makeSection("SUSPECTED_PUBLISHER_EDITORIAL", 2),
      makeSection("PROBABLE_JUDICIAL_TEXT", 3),
      makeSection("ADMINISTRATIVE_METADATA", 4),
    ];
    const result = applyIsolationGate(sections);
    expect(result).toHaveLength(2);
    expect(result.map((s: any) => s.classification)).toEqual([
      "VERIFIED_JUDICIAL_TEXT",
      "PROBABLE_JUDICIAL_TEXT",
    ]);
  });

  it("gateHasExclusions returns false when nothing is excluded", () => {
    const sections = [makeSection("VERIFIED_JUDICIAL_TEXT"), makeSection("PROBABLE_JUDICIAL_TEXT")];
    expect(gateHasExclusions(sections)).toBe(false);
  });

  it("gateHasExclusions returns true when something is excluded", () => {
    const sections = [makeSection("VERIFIED_JUDICIAL_TEXT"), makeSection("SUSPECTED_PUBLISHER_EDITORIAL")];
    expect(gateHasExclusions(sections)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS — editorial routes via supertest
// ══════════════════════════════════════════════════════════════════════════

describe("GET /api/research/containers/:id/sections", () => {
  it("returns sections for a container with page sections", async () => {
    const { containerId } = await seedVerificationReadyContainer();
    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app).get(`/api/research/containers/${containerId}/sections`);
    expect(res.status).toBe(200);
    // Response is grouped by page: { containerId, pages: [{ pageId, sections: [...] }] }
    expect(res.body).toHaveProperty("containerId", containerId);
    expect(Array.isArray(res.body.pages)).toBe(true);
    expect(res.body.pages.length).toBeGreaterThan(0);
    expect(res.body.pages[0]).toHaveProperty("pageId");
    expect(Array.isArray(res.body.pages[0].sections)).toBe(true);
    expect(res.body.pages[0].sections[0]).toHaveProperty("classification");
    expect(res.body.pages[0].sections[0]).toHaveProperty("containerId", containerId);
  });

  it("returns empty pages array for container with no sections yet", async () => {
    const containerId = await seedContainer("Some text without classification");
    await transitionContainer(containerId, "RIGHTS_REVIEW_REQUIRED", { actor: "test" });
    await transitionContainer(containerId, "RIGHTS_APPROVED", { actor: "test" });
    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app).get(`/api/research/containers/${containerId}/sections`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("containerId", containerId);
    expect(Array.isArray(res.body.pages)).toBe(true);
    expect(res.body.pages).toHaveLength(0);
  });
});

describe("PATCH /api/research/containers/:id/sections/:sectionId", () => {
  it("allows overriding a section classification", async () => {
    const { containerId, sectionIds } = await seedVerificationReadyContainer({
      sectionClassifications: ["MANUAL_REVIEW_REQUIRED", "VERIFIED_JUDICIAL_TEXT"],
    });
    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app)
      .patch(`/api/research/containers/${containerId}/sections/${sectionIds[0]}`)
      .send({ classification: "PROBABLE_JUDICIAL_TEXT", note: "Reviewed manually" });
    expect(res.status).toBe(200);
    expect(res.body.reviewerDecision).toBe("PROBABLE_JUDICIAL_TEXT");
    expect(res.body.reviewerNote).toBe("Reviewed manually");
    expect(res.body.reviewerDecidedAt).toBeTruthy();
  });

  it("returns 400 for invalid classification", async () => {
    const { containerId, sectionIds } = await seedVerificationReadyContainer();
    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app)
      .patch(`/api/research/containers/${containerId}/sections/${sectionIds[0]}`)
      .send({ classification: "NOT_A_REAL_CLASSIFICATION" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for section not belonging to container", async () => {
    const { containerId } = await seedVerificationReadyContainer();
    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app)
      .patch(`/api/research/containers/${containerId}/sections/999999`)
      .send({ classification: "VERIFIED_JUDICIAL_TEXT" });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/research/containers/:id/judicial-text", () => {
  it("returns only judicial sections, excluding publisher-editorial", async () => {
    const { containerId } = await seedVerificationReadyContainer({
      pageTexts: [
        "MALAYAN LAW JOURNAL\n© 2024 LexisNexis",
        "IN THE HIGH COURT OF MALAYA\nCORAM: JUSTICE A\nJUDGMENT\n[1] IT IS HEREBY ORDERED judgment for plaintiff.",
      ],
      sectionClassifications: ["SUSPECTED_PUBLISHER_EDITORIAL", "VERIFIED_JUDICIAL_TEXT"],
    });
    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app).get(`/api/research/containers/${containerId}/judicial-text`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("sections");
    expect(res.body.isolationApplied).toBe(true);
    const classifications = res.body.sections.map((s: any) => s.effectiveClassification);
    expect(classifications).not.toContain("SUSPECTED_PUBLISHER_EDITORIAL");
    expect(classifications).toContain("VERIFIED_JUDICIAL_TEXT");
  });

  it("returns isolationApplied: false when all sections are judicial", async () => {
    const { containerId } = await seedVerificationReadyContainer({
      sectionClassifications: ["VERIFIED_JUDICIAL_TEXT", "VERIFIED_JUDICIAL_TEXT"],
    });
    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app).get(`/api/research/containers/${containerId}/judicial-text`);
    expect(res.status).toBe(200);
    expect(res.body.isolationApplied).toBe(false);
  });
});

describe("POST /api/research/containers/:id/verify", () => {
  it("creates verified judgment and transitions to VERIFIED when completeness passes", async () => {
    const { containerId, candidateId } = await seedVerificationReadyContainer({
      pageTexts: [
        "IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR\nCIVIL SUIT NO: 22-VERIFY-2024\nCORAM: JUSTICE VERIFY\nGROUNDS OF JUDGMENT\n[1] This is the verified judgment.\n[2] IT IS HEREBY ORDERED that judgment be entered for the plaintiff with costs.",
      ],
      sectionClassifications: ["VERIFIED_JUDICIAL_TEXT"],
    });

    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app)
      .post(`/api/research/containers/${containerId}/verify`)
      .send({ candidateId });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("verifiedJudgmentId");
    expect(res.body).toHaveProperty("textChecksum");
    expect(res.body.state).toBe("VERIFIED");
    expect(res.body.candidateId).toBe(candidateId);

    // Container should now be VERIFIED
    const container = await getContainer(containerId);
    expect(container?.processingState).toBe("VERIFIED");

    // Verified judgment row should exist
    const [vj] = await db.select().from(researchVerifiedJudgments).where(eq(researchVerifiedJudgments.candidateId, candidateId));
    expect(vj).toBeDefined();
    expect(vj!.textChecksum.length).toBe(64);
  });

  it("creates verified judgment when sections have blockId (real processor output shape)", async () => {
    // This test replicates real editorial processor output: sections reference
    // specific blocks, not whole pages. The /verify handler must assemble
    // judicial text from block texts so that completeness analysis works
    // correctly even when span offsets are absent.
    const judicialText =
      "IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR\n" +
      "CIVIL SUIT NO: 22-BLOCKTEST-2024\n" +
      "CORAM: JUSTICE BLOCKTEST\n" +
      "GROUNDS OF JUDGMENT\n" +
      "[1] Block-scoped judgment text.\n" +
      "[2] IT IS HEREBY ORDERED that judgment be entered for the plaintiff with costs.";
    const editorialText = "\u00a9 Publisher 2024 | Page 1";
    const fullPageText = judicialText + "\n" + editorialText;

    // Seed via helper (creates one whole-page section without blockId)
    const { containerId, candidateId, sectionIds } = await seedVerificationReadyContainer({
      pageTexts: [fullPageText],
      sectionClassifications: ["VERIFIED_JUDICIAL_TEXT"],
    });

    // Fetch the page and its extraction to attach blocks
    const [page] = await db
      .select({ id: researchSourcePages.id })
      .from(researchSourcePages)
      .where(eq(researchSourcePages.containerId, containerId));
    const [extraction] = await db
      .select({ id: researchPageExtractions.id })
      .from(researchPageExtractions)
      .where(eq(researchPageExtractions.pageId, page!.id));

    // Insert a judicial block and an editorial block for the page
    const [judicialBlock] = await db
      .insert(researchPageBlocks)
      .values({
        pageExtractionId: extraction!.id,
        blockIndex: 0,
        blockType: "paragraph",
        text: judicialText,
        charStart: 0,
        charEnd: judicialText.length,
        readingOrder: 0,
      })
      .returning({ id: researchPageBlocks.id });

    await db.insert(researchPageBlocks).values({
      pageExtractionId: extraction!.id,
      blockIndex: 1,
      blockType: "footer",
      text: editorialText,
      charStart: judicialText.length + 1,
      charEnd: fullPageText.length,
      readingOrder: 1,
    });

    // Update the existing section to reference the judicial block (no spans)
    await db
      .update(researchPageSections)
      .set({ blockId: judicialBlock!.id })
      .where(eq(researchPageSections.id, sectionIds[0]!));

    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app)
      .post(`/api/research/containers/${containerId}/verify`)
      .send({ candidateId });

    // Must succeed: completeness check must use block text, not empty string
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("verifiedJudgmentId");
    expect(res.body.state).toBe("VERIFIED");
    expect(res.body).toHaveProperty("textChecksum");

    const [vj] = await db
      .select()
      .from(researchVerifiedJudgments)
      .where(eq(researchVerifiedJudgments.candidateId, candidateId));
    expect(vj).toBeDefined();
    expect(vj!.textChecksum.length).toBe(64);
  });

  it("returns 422 when no judicial sections produce critical warnings", async () => {
    // Build a container in JUDGMENT_VERIFICATION_PENDING with NO sections → completeness must fail
    const containerId = await seedContainer("Some random non-judicial text.");
    await transitionContainer(containerId, "RIGHTS_REVIEW_REQUIRED", { actor: "test" });
    await transitionContainer(containerId, "RIGHTS_APPROVED", { actor: "test" });
    await transitionContainer(containerId, "INVENTORY_PENDING", { actor: "test" });
    await transitionContainer(containerId, "INVENTORIED", { actor: "test" });
    await transitionContainer(containerId, "EXTRACTION_PENDING", { actor: "test" });
    const [page] = await db.insert(researchSourcePages).values({ containerId, pageNumber: 1, provenance: {} }).returning({ id: researchSourcePages.id });
    await seedPageExtraction(containerId, page!.id, "Some random non-judicial text.");
    await transitionContainer(containerId, "TEXT_EXTRACTED", { actor: "test" });
    await transitionContainer(containerId, "SEGMENTATION_PENDING", { actor: "test" });
    const [segRun] = await db.insert(researchSegmentationRuns).values({ containerId, jobId: null, runKey: `seg-verify422-${RUN_ID}`, processorVersion: "test@1", sourceChecksum: sha256(`seg-verify422-${RUN_ID}`), status: "COMPLETE" }).returning({ id: researchSegmentationRuns.id });
    const [sb] = await db.insert(researchCaseBoundaries).values({ runId: segRun!.id, pageId: page!.id, boundaryRole: "start", strength: "STRONG_BOUNDARY_CANDIDATE", compositeScore: 1, conflictingSignalCount: 0 }).returning({ id: researchCaseBoundaries.id });
    const [eb] = await db.insert(researchCaseBoundaries).values({ runId: segRun!.id, pageId: page!.id, boundaryRole: "end", strength: "STRONG_BOUNDARY_CANDIDATE", compositeScore: 1, conflictingSignalCount: 0 }).returning({ id: researchCaseBoundaries.id });
    const [cand] = await db.insert(researchCaseCandidates).values({ containerId, runId: segRun!.id, startPageId: page!.id, strength: "STRONG_BOUNDARY_CANDIDATE", reviewStatus: "reviewed" }).returning({ id: researchCaseCandidates.id });
    await db.insert(researchCaseCandidateBoundaries).values({ candidateId: cand!.id, startBoundaryId: sb!.id, endBoundaryId: eb!.id });
    await transitionContainer(containerId, "SEGMENTATION_PROPOSED", { actor: "test" });
    await transitionContainer(containerId, "EDITORIAL_REVIEW_PENDING", { actor: "test" });
    await transitionContainer(containerId, "JUDGMENT_VERIFICATION_PENDING", { actor: "test" });
    // No sections → all gated = NO_JUDICIAL_SECTIONS

    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app)
      .post(`/api/research/containers/${containerId}/verify`)
      .send({ candidateId: cand!.id });
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty("criticalWarnings");
    expect(Array.isArray(res.body.criticalWarnings)).toBe(true);
    expect(res.body.criticalWarnings.length).toBeGreaterThan(0);
  });

  it("returns 409 if candidate already verified", async () => {
    const { containerId, candidateId } = await seedVerificationReadyContainer({
      pageTexts: [
        "IN THE HIGH COURT OF MALAYA\nCIVIL SUIT NO: 22-DOUBLE-2024\nCORAM: JUSTICE DOUBLE\nGROUNDS OF JUDGMENT\n[1] Facts.\n[2] IT IS HEREBY ORDERED judgment for plaintiff.",
      ],
      sectionClassifications: ["VERIFIED_JUDICIAL_TEXT"],
    });
    const app = buildApp(OWNER_EMAIL, "owner");
    const res1 = await request(app).post(`/api/research/containers/${containerId}/verify`).send({ candidateId });
    expect(res1.status).toBe(201);
    const res2 = await request(app).post(`/api/research/containers/${containerId}/verify`).send({ candidateId });
    expect(res2.status).toBe(409);
  });

  it("returns 400 for missing candidateId", async () => {
    const { containerId } = await seedVerificationReadyContainer();
    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app).post(`/api/research/containers/${containerId}/verify`).send({});
    expect(res.status).toBe(400);
  });
});

describe("POST /api/research/containers/:id/editorial-review/complete", () => {
  it("enqueues an editorial classification job for a container in EDITORIAL_REVIEW_PENDING", async () => {
    const containerId = await seedContainer("IN THE HIGH COURT OF MALAYA\nJUDGMENT");
    await transitionContainer(containerId, "RIGHTS_REVIEW_REQUIRED", { actor: "test" });
    await transitionContainer(containerId, "RIGHTS_APPROVED", { actor: "test" });
    await transitionContainer(containerId, "INVENTORY_PENDING", { actor: "test" });
    await transitionContainer(containerId, "INVENTORIED", { actor: "test" });
    await transitionContainer(containerId, "EXTRACTION_PENDING", { actor: "test" });
    await transitionContainer(containerId, "TEXT_EXTRACTED", { actor: "test" });
    await transitionContainer(containerId, "SEGMENTATION_PENDING", { actor: "test" });
    await transitionContainer(containerId, "SEGMENTATION_PROPOSED", { actor: "test" });
    await transitionContainer(containerId, "EDITORIAL_REVIEW_PENDING", { actor: "test" });

    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app)
      .post(`/api/research/containers/${containerId}/editorial-review/complete`);
    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty("jobId");
  });

  it("returns 409 when container is not in editorial state", async () => {
    const containerId = await seedContainer("Random text");
    await transitionContainer(containerId, "RIGHTS_REVIEW_REQUIRED", { actor: "test" });
    await transitionContainer(containerId, "RIGHTS_APPROVED", { actor: "test" });
    const app = buildApp(OWNER_EMAIL, "owner");
    const res = await request(app)
      .post(`/api/research/containers/${containerId}/editorial-review/complete`);
    expect(res.status).toBe(409);
  });
});

describe("editorial processor job", () => {
  it("creates page sections and transitions to JUDGMENT_VERIFICATION_PENDING when no uncertain sections", async () => {
    const judgeText = "IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR\nCIVIL SUIT NO: 22-EDJOB-2024\nCORAM: JUSTICE JOB\nGROUNDS OF JUDGMENT\n[1] This is the editorial processor test judgment.\n[2] IT IS HEREBY ORDERED judgment for the plaintiff.";
    const containerId = await seedContainer(judgeText);

    await transitionContainer(containerId, "RIGHTS_REVIEW_REQUIRED", { actor: "test" });
    await transitionContainer(containerId, "RIGHTS_APPROVED", { actor: "test" });
    await transitionContainer(containerId, "INVENTORY_PENDING", { actor: "test" });
    await transitionContainer(containerId, "INVENTORIED", { actor: "test" });
    await transitionContainer(containerId, "EXTRACTION_PENDING", { actor: "test" });

    const [page] = await db.insert(researchSourcePages).values({ containerId, pageNumber: 1, provenance: {} }).returning({ id: researchSourcePages.id });
    await seedPageExtraction(containerId, page!.id, judgeText);

    await transitionContainer(containerId, "TEXT_EXTRACTED", { actor: "test" });
    await transitionContainer(containerId, "SEGMENTATION_PENDING", { actor: "test" });
    await transitionContainer(containerId, "SEGMENTATION_PROPOSED", { actor: "test" });
    await transitionContainer(containerId, "EDITORIAL_REVIEW_PENDING", { actor: "test" });

    await startEditorialClassification(containerId, "test-runner");

    // Retry loop: pass EDITORIAL_JOB_KIND so runNextJob() only claims editorial
    // classification jobs and cannot steal jobs from other test files that also
    // write to the shared research_jobs table during a full suite run.
    for (let i = 0; i < 15; i++) {
      const job = await runNextJob(EDITORIAL_JOB_KIND);
      const c = await getContainer(containerId);
      if (
        c?.processingState === "JUDGMENT_VERIFICATION_PENDING" ||
        c?.processingState === "EDITORIAL_REVIEW_REQUIRED"
      )
        break;
      if (!job && c?.processingState === "EDITORIAL_REVIEW_PENDING") {
        // Previous job may have failed via NO_PROCESSOR in another worker; re-enqueue.
        await startEditorialClassification(containerId, "test-runner");
      }
    }

    const container = await getContainer(containerId);
    // Clear judicial text → JUDGMENT_VERIFICATION_PENDING (no uncertain sections)
    expect(container?.processingState).toBe("JUDGMENT_VERIFICATION_PENDING");

    const sections = await db.select().from(researchPageSections).where(eq(researchPageSections.containerId, containerId));
    expect(sections.length).toBeGreaterThan(0);

    const runs = await db.select().from(researchEditorialRuns).where(eq(researchEditorialRuns.containerId, containerId));
    expect(runs.length).toBeGreaterThan(0);
  });
});

describe("isolation gate integration with judicial-text endpoint", () => {
  it("reviewer override changes effective classification in judicial-text view", async () => {
    const { containerId, sectionIds } = await seedVerificationReadyContainer({
      sectionClassifications: ["SUSPECTED_PUBLISHER_EDITORIAL", "VERIFIED_JUDICIAL_TEXT"],
    });
    const app = buildApp(OWNER_EMAIL, "owner");

    // Override first section (SUSPECTED) to PROBABLE_JUDICIAL_TEXT
    const patchRes = await request(app)
      .patch(`/api/research/containers/${containerId}/sections/${sectionIds[0]}`)
      .send({ classification: "PROBABLE_JUDICIAL_TEXT", note: "Confirmed judicial" });
    expect(patchRes.status).toBe(200);

    // Judicial text view must now include the overridden section
    const textRes = await request(app).get(`/api/research/containers/${containerId}/judicial-text`);
    expect(textRes.status).toBe(200);
    const classifications = textRes.body.sections.map((s: any) => s.effectiveClassification);
    expect(classifications).toContain("PROBABLE_JUDICIAL_TEXT");
    expect(classifications).not.toContain("SUSPECTED_PUBLISHER_EDITORIAL");
  });
});
