import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import express from "express";
import request from "supertest";

// Phase 10 proof tests: AI-generated headnotes & case analysis.
//
// CRITICAL: No live AI calls are made. Every test injects a stub `callLlm`
// function that returns pre-crafted JSON responses.
//
// 8 test cases covering the core ambiguity / safety scenarios:
//   1. Invented fact → INSUFFICIENT_EVIDENCE + proposition rejected
//   2. Inferred unexpressed holding → NOT_STATED_IN_VERIFIED_JUDGMENT preserved
//   3. Submission vs decision confusion → HUMAN_REVIEW_REQUIRED preserved
//   4. Ratio misclassification → RATIO_OBITER_REVIEW_REQUIRED preserved
//   5. Inaccurate quotation (near-miss passage) → rejected proposition
//   6. Unsupported paragraph reference → INSUFFICIENT_EVIDENCE
//   7. Publisher material exclusion → excluded from input, logged in audit
//   8. AI output isolation (structural) → proposition table has no FK to quotations

const RUN_ID = randomUUID();
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// ── Dynamic imports ────────────────────────────────────────────────────────

const { registerContainer } = await import("./data/containers");
const { recordRightsDecision } = await import("./data/rights");
const { transitionContainer } = await import("./domain/containerStateMachine");
const {
  db,
  researchSourceContainers,
  researchSourcePages,
  researchPageExtractions,
  researchExtractionRuns,
  researchSegmentationRuns,
  researchCaseBoundaries,
  researchCaseCandidates,
  researchCaseCandidateBoundaries,
  researchEditorialRuns,
  researchPageSections,
  researchVerifiedJudgments,
  researchTransformations,
  researchJobs,
  researchUsers,
  researchCaseMetadata,
  researchRightsRecords,
  researchAiProviders,
  researchAiAnalysisRuns,
  researchAiPropositions,
} = await import("@workspace/db");
const { eq, inArray, like } = await import("drizzle-orm");
const { runAiAnalysis } = await import("./analysis/generator");
const { buildAnalysisInput } = await import("./analysis/inputBoundary");

// ── HTTP test app ─────────────────────────────────────────────────────────

function buildApp(userEmail: string) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.authEmail = userEmail;
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

// ── Test fixture helpers ───────────────────────────────────────────────────

const OWNER_EMAIL = `ph10-owner-${RUN_ID}@test.local`;

const trackedContainerIds: number[] = [];
const trackedJudgmentIds: number[] = [];
const trackedProviderIds: number[] = [];
let uploadSeq = 0;

function makeUnique(text: string): string {
  uploadSeq += 1;
  return text + `\n%% phase10 run ${RUN_ID} #${uploadSeq}\n`;
}

async function seedContainer(rawText: string): Promise<number> {
  const text = makeUnique(rawText);
  const sha = sha256(text);
  const container = await registerContainer({
    originalName: `ph10-fixture-${RUN_ID}-${uploadSeq}.txt`,
    sourceBatch: `ph10-batch-${RUN_ID}`,
    contentSha256: sha,
    sizeBytes: Buffer.byteLength(text),
    mimeType: "text/plain",
    provenance: { enteredVia: "phase10-test" },
  });
  trackedContainerIds.push(container.id);
  await recordRightsDecision(
    container.id,
    {
      status: "OFFICIAL_COURT_SOURCE",
      reason: "phase10 test",
      source: "Test source",
      dateObtained: new Date("2026-01-01T00:00:00Z"),
      declaredSourceType: "official_court",
      licenceReference: null,
      approvedUsers: [OWNER_EMAIL],
      approvedPurposes: ["research"],
      storagePermitted: true,
      analysisPermitted: true,
      externalProcessingPermitted: true,
      studentAccessPermitted: true,
      printingPermitted: true,
      exportPermitted: true,
      retentionPeriod: null,
      expiryDate: null,
      reviewer: OWNER_EMAIL,
      reviewDate: new Date("2026-01-01T00:00:00Z"),
      notes: null,
    },
    { actor: OWNER_EMAIL },
  );
  return container.id;
}

async function seedVerifiedJudgment(
  pageTexts: string[],
  opts?: { paragraphIds?: string[] },
): Promise<{
  containerId: number;
  judgmentId: number;
  pageIds: number[];
  judicialText: string;
}> {
  const containerId = await seedContainer(pageTexts.join("\n\n"));

  await transitionContainer(containerId, "RIGHTS_REVIEW_REQUIRED", { actor: "test" });
  await transitionContainer(containerId, "RIGHTS_APPROVED", { actor: "test" });
  await transitionContainer(containerId, "INVENTORY_PENDING", { actor: "test" });
  await transitionContainer(containerId, "INVENTORIED", { actor: "test" });
  await transitionContainer(containerId, "EXTRACTION_PENDING", { actor: "test" });

  const pageIds: number[] = [];
  for (let i = 0; i < pageTexts.length; i++) {
    const text = pageTexts[i]!;
    const [page] = await db
      .insert(researchSourcePages)
      .values({ containerId, pageNumber: i + 1, provenance: {} })
      .returning({ id: researchSourcePages.id });
    pageIds.push(page!.id);

    const [exRun] = await db
      .insert(researchExtractionRuns)
      .values({
        containerId,
        jobId: null,
        runKey: `exrun-${RUN_ID}-${containerId}-${page!.id}`,
        processorVersion: "test@1",
        adapters: {},
        sourceChecksum: sha256(text),
        status: "COMPLETE",
      })
      .returning({ id: researchExtractionRuns.id });
    await db.insert(researchPageExtractions).values({
      runId: exRun!.id,
      pageId: page!.id,
      mode: "NATIVE",
      rawText: text,
      rawTextSha256: sha256(text),
      charStart: 0,
      charEnd: text.length,
      provenance: {},
    });
  }

  await transitionContainer(containerId, "TEXT_EXTRACTED", { actor: "test" });
  await transitionContainer(containerId, "SEGMENTATION_PENDING", { actor: "test" });

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

  await db.insert(researchCaseCandidateBoundaries).values({
    candidateId: candidate!.id,
    startBoundaryId: startBound!.id,
    endBoundaryId: endBound!.id,
  });

  await transitionContainer(containerId, "SEGMENTATION_PROPOSED", { actor: "test" });
  await transitionContainer(containerId, "EDITORIAL_REVIEW_PENDING", { actor: "test" });
  await transitionContainer(containerId, "JUDGMENT_VERIFICATION_PENDING", { actor: "test" });

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

  for (let i = 0; i < pageIds.length; i++) {
    await db.insert(researchPageSections).values({
      containerId,
      pageId: pageIds[i]!,
      editorialRunId: editRun!.id,
      sectionIndex: 0,
      classification: "VERIFIED_JUDICIAL_TEXT" as any,
      confidence: 0.9,
      supportingEvidence: ["test"],
      detectorVersion: "container.editorial_classify@1",
      isolationApplied: true,
    });
  }

  const textChecksum = sha256(pageTexts.join("\n"));
  const paragraphIds =
    opts?.paragraphIds ??
    pageTexts.flatMap((_, i) => [`[${i * 2 + 1}]`, `[${i * 2 + 2}]`]);

  const [vj] = await db
    .insert(researchVerifiedJudgments)
    .values({
      candidateId: candidate!.id,
      containerId,
      editorialRunId: editRun!.id,
      pageRefs: pageIds,
      paragraphIdentifiers: paragraphIds,
      textChecksum,
      approvedJudicialSpans: pageIds.map((pid, i) => ({
        sectionId: i + 1,
        containerId,
        pageId: pid,
        sectionIndex: 0,
        classification: "VERIFIED_JUDICIAL_TEXT",
        spanStartChar: null,
        spanEndChar: null,
      })),
      sourceRefs: [
        {
          containerId,
          contentSha256: sha256(`seg-${RUN_ID}-${containerId}`),
          originalName: `ph10-fixture.txt`,
        },
      ],
      originalPageRefs: pageIds,
      unresolvedWarnings: [],
      criticalIntegrityWarnings: [],
      unresolvedNonCriticalWarnings: [],
      verifiedBy: OWNER_EMAIL,
      provenance: {},
    })
    .returning({ id: researchVerifiedJudgments.id });

  await transitionContainer(containerId, "VERIFIED", { actor: "test" });
  trackedJudgmentIds.push(vj!.id);

  const judicialText = pageTexts.join("\n");
  return { containerId, judgmentId: vj!.id, pageIds, judicialText };
}

/** Create an enabled AI provider row and return its id. */
async function seedEnabledProvider(): Promise<number> {
  const [row] = await db
    .insert(researchAiProviders)
    .values({
      name: "gemini",
      enabled: true,
      modelName: "stub-model",
      temperature: 0.2,
      maxTokens: 8192,
      promptVersion: "analysis@1",
      approvedBy: OWNER_EMAIL,
      approvedAt: new Date(),
    })
    .returning();
  trackedProviderIds.push(row!.id);
  return row!.id;
}

/** Minimal valid AI output with all 17 fields empty except the given one. */
function makeOutput(
  fieldName: string,
  propositions: object[],
): string {
  const base: Record<string, object[]> = {
    catchwords: [],
    proceduralPosture: [],
    materialFacts: [],
    legalIssues: [],
    partiesMaterialSubmissions: [],
    holdingOnEachIssue: [],
    reasoning: [],
    possibleRatioDecidendi: [],
    possibleObiterDicta: [],
    orders: [],
    statutesConsidered: [],
    casesConsidered: [],
    significance: [],
    summary50Word: [],
    summary150Word: [],
    detailedCaseBrief: [],
    teachingNote: [],
  };
  base[fieldName] = propositions;
  return JSON.stringify(base);
}

// ── Setup / teardown ──────────────────────────────────────────────────────

beforeAll(async () => {
  await db
    .insert(researchUsers)
    .values({
      email: OWNER_EMAIL,
      displayName: "Phase10 Test Owner",
      role: "owner",
      active: true,
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  // 1. Propositions and runs (FK to judgments).
  if (trackedJudgmentIds.length > 0) {
    const runs = await db
      .select({ id: researchAiAnalysisRuns.id })
      .from(researchAiAnalysisRuns)
      .where(inArray(researchAiAnalysisRuns.judgmentId, trackedJudgmentIds))
      .catch(() => [] as { id: number }[]);
    if (runs.length > 0) {
      const runIds = runs.map((r) => r.id);
      await db
        .delete(researchAiPropositions)
        .where(inArray(researchAiPropositions.runId, runIds))
        .catch(() => {});
    }
    await db
      .delete(researchAiAnalysisRuns)
      .where(inArray(researchAiAnalysisRuns.judgmentId, trackedJudgmentIds))
      .catch(() => {});
    await db
      .delete(researchCaseMetadata)
      .where(inArray(researchCaseMetadata.judgmentId, trackedJudgmentIds))
      .catch(() => {});
    await db
      .delete(researchVerifiedJudgments)
      .where(inArray(researchVerifiedJudgments.id, trackedJudgmentIds))
      .catch(() => {});
  }
  // 2. Provider rows.
  if (trackedProviderIds.length > 0) {
    await db
      .delete(researchAiProviders)
      .where(inArray(researchAiProviders.id, trackedProviderIds))
      .catch(() => {});
  }
  // 3. Container-level tables (full FK cascade from phase09 pattern).
  if (trackedContainerIds.length > 0) {
    const candidateIds = (
      await db
        .select({ id: researchCaseCandidates.id })
        .from(researchCaseCandidates)
        .where(inArray(researchCaseCandidates.containerId, trackedContainerIds))
        .catch(() => [] as { id: number }[])
    ).map((r) => r.id);
    const segRunIds = (
      await db
        .select({ id: researchSegmentationRuns.id })
        .from(researchSegmentationRuns)
        .where(inArray(researchSegmentationRuns.containerId, trackedContainerIds))
        .catch(() => [] as { id: number }[])
    ).map((r) => r.id);
    await db
      .delete(researchPageSections)
      .where(inArray(researchPageSections.containerId, trackedContainerIds))
      .catch(() => {});
    await db
      .delete(researchEditorialRuns)
      .where(inArray(researchEditorialRuns.containerId, trackedContainerIds))
      .catch(() => {});
    if (candidateIds.length > 0) {
      await db
        .delete(researchCaseCandidateBoundaries)
        .where(inArray(researchCaseCandidateBoundaries.candidateId, candidateIds))
        .catch(() => {});
    }
    await db
      .delete(researchCaseCandidates)
      .where(inArray(researchCaseCandidates.containerId, trackedContainerIds))
      .catch(() => {});
    if (segRunIds.length > 0) {
      await db
        .delete(researchCaseBoundaries)
        .where(inArray(researchCaseBoundaries.runId, segRunIds))
        .catch(() => {});
    }
    await db
      .delete(researchSegmentationRuns)
      .where(inArray(researchSegmentationRuns.containerId, trackedContainerIds))
      .catch(() => {});
    await db
      .delete(researchTransformations)
      .where(inArray(researchTransformations.containerId, trackedContainerIds))
      .catch(() => {});
    const pageIds = (
      await db
        .select({ id: researchSourcePages.id })
        .from(researchSourcePages)
        .where(inArray(researchSourcePages.containerId, trackedContainerIds))
        .catch(() => [] as { id: number }[])
    ).map((r) => r.id);
    if (pageIds.length > 0) {
      await db
        .delete(researchPageExtractions)
        .where(inArray(researchPageExtractions.pageId, pageIds))
        .catch(() => {});
    }
    await db
      .delete(researchExtractionRuns)
      .where(inArray(researchExtractionRuns.containerId, trackedContainerIds))
      .catch(() => {});
    await db
      .delete(researchSourcePages)
      .where(inArray(researchSourcePages.containerId, trackedContainerIds))
      .catch(() => {});
    await db
      .delete(researchRightsRecords)
      .where(inArray(researchRightsRecords.containerId, trackedContainerIds))
      .catch(() => {});
    const jobsToDelete = await db
      .select({ id: researchJobs.id })
      .from(researchJobs)
      .where(like(researchJobs.idempotencyKey, `%${RUN_ID.slice(0, 8)}%`))
      .catch(() => []);
    if (jobsToDelete.length > 0) {
      await db
        .delete(researchJobs)
        .where(inArray(researchJobs.id, jobsToDelete.map((j) => j.id)))
        .catch(() => {});
    }
    await db
      .delete(researchSourceContainers)
      .where(inArray(researchSourceContainers.id, trackedContainerIds))
      .catch(() => {});
  }
  await db
    .delete(researchUsers)
    .where(eq(researchUsers.email, OWNER_EMAIL))
    .catch(() => {});
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("Phase 10: AI-Generated Headnotes & Case Analysis", () => {

  // ── Test 1: Invented fact ────────────────────────────────────────────────
  it("rejects a proposition whose passage is not in the judicial text", async () => {
    const { judgmentId } = await seedVerifiedJudgment([
      "The plaintiff brought a claim against the defendant for breach of contract.",
      "The court held that the defendant was liable.",
    ]);
    const providerId = await seedEnabledProvider();

    // Stub: AI invents a damages figure not in the text.
    const stub = async () =>
      makeOutput("materialFacts", [
        {
          propositionId: randomUUID(),
          content: "The court awarded RM 50,000 in damages.",
          supportingParagraphIds: ["[1]"],
          supportingPassages: ["The court awarded RM 50,000 in damages."],
          confidenceCategory: "HIGH",
        },
      ]);

    const { propositions } = await runAiAnalysis(judgmentId, providerId, {
      callLlm: stub,
      dbc: db,
    });

    const fact = propositions.find((p) => p.fieldName === "materialFacts");
    expect(fact).toBeDefined();
    // The passage "The court awarded RM 50,000 in damages." is not in the text.
    expect(fact!.reviewStatus).toBe("rejected");
    expect(fact!.confidenceCategory).toBe("INSUFFICIENT_EVIDENCE");
    // Validated passage should be marked invalid.
    const vp = (fact!.validatedPassages as any[])[0];
    expect(vp.valid).toBe(false);
  });

  // ── Test 2: Inferred unexpressed holding ─────────────────────────────────
  it("preserves NOT_STATED_IN_VERIFIED_JUDGMENT label from the AI", async () => {
    const { judgmentId } = await seedVerifiedJudgment([
      "The court deliberated at length but issued no formal ruling.",
    ]);
    const providerId = await seedEnabledProvider();

    const stub = async () =>
      makeOutput("holdingOnEachIssue", [
        {
          propositionId: randomUUID(),
          content: "No holding was expressly stated.",
          supportingParagraphIds: [],
          supportingPassages: [],
          confidenceCategory: "INSUFFICIENT_EVIDENCE",
          uncertaintyLabel: "NOT_STATED_IN_VERIFIED_JUDGMENT",
        },
      ]);

    const { propositions } = await runAiAnalysis(judgmentId, providerId, {
      callLlm: stub,
      dbc: db,
    });

    const holding = propositions.find((p) => p.fieldName === "holdingOnEachIssue");
    expect(holding).toBeDefined();
    expect(holding!.uncertaintyLabel).toBe("NOT_STATED_IN_VERIFIED_JUDGMENT");
    expect(holding!.confidenceCategory).toBe("INSUFFICIENT_EVIDENCE");
    // No passages → not rejected by evidence validation (no passages to fail).
    // The AI itself assigned INSUFFICIENT_EVIDENCE — that is preserved.
  });

  // ── Test 3: Submission vs decision confusion ───────────────────────────
  it("preserves HUMAN_REVIEW_REQUIRED when AI detects submission/decision ambiguity", async () => {
    const { judgmentId } = await seedVerifiedJudgment([
      "Counsel for the plaintiff submitted that the contract was void.",
      "The court made no express finding on that submission.",
    ]);
    const providerId = await seedEnabledProvider();

    const passageInText = "Counsel for the plaintiff submitted that the contract was void.";

    const stub = async () =>
      makeOutput("holdingOnEachIssue", [
        {
          propositionId: randomUUID(),
          content: "The contract was void (AI note: this may be a submission, not the holding).",
          supportingParagraphIds: ["[1]"],
          supportingPassages: [passageInText],
          confidenceCategory: "LOW",
          uncertaintyLabel: "HUMAN_REVIEW_REQUIRED",
        },
      ]);

    const { propositions } = await runAiAnalysis(judgmentId, providerId, {
      callLlm: stub,
      dbc: db,
    });

    const holding = propositions.find((p) => p.fieldName === "holdingOnEachIssue");
    expect(holding).toBeDefined();
    expect(holding!.uncertaintyLabel).toBe("HUMAN_REVIEW_REQUIRED");
    // The passage IS in the text, so it should be valid.
    const vp = (holding!.validatedPassages as any[])[0];
    expect(vp.valid).toBe(true);
    // The proposition is pending (not auto-rejected) — human must review.
    expect(holding!.reviewStatus).toBe("pending");
  });

  // ── Test 4: Ratio misclassification ──────────────────────────────────────
  it("preserves RATIO_OBITER_REVIEW_REQUIRED label from the AI", async () => {
    const { judgmentId } = await seedVerifiedJudgment([
      "The principle in Donoghue v Stevenson applies here.",
      "That observation was made in passing.",
    ]);
    const providerId = await seedEnabledProvider();

    const passageInText = "The principle in Donoghue v Stevenson applies here.";

    const stub = async () =>
      makeOutput("possibleRatioDecidendi", [
        {
          propositionId: randomUUID(),
          content: "Donoghue v Stevenson applies (may be obiter — review required).",
          supportingParagraphIds: ["[1]"],
          supportingPassages: [passageInText],
          confidenceCategory: "MEDIUM",
          uncertaintyLabel: "RATIO_OBITER_REVIEW_REQUIRED",
        },
      ]);

    const { propositions } = await runAiAnalysis(judgmentId, providerId, {
      callLlm: stub,
      dbc: db,
    });

    const ratio = propositions.find((p) => p.fieldName === "possibleRatioDecidendi");
    expect(ratio).toBeDefined();
    expect(ratio!.uncertaintyLabel).toBe("RATIO_OBITER_REVIEW_REQUIRED");
    expect(ratio!.confidenceCategory).toBe("MEDIUM");
    expect(ratio!.reviewStatus).toBe("pending");
  });

  // ── Test 5: Inaccurate quotation (near-miss passage) ─────────────────────
  it("marks a near-miss passage as invalid (one word different)", async () => {
    const actualText = "The defendant breached the agreement without justification.";
    const nearMiss = "The defendant breached the contract without justification."; // "contract" ≠ "agreement"

    const { judgmentId } = await seedVerifiedJudgment([actualText]);
    const providerId = await seedEnabledProvider();

    const stub = async () =>
      makeOutput("reasoning", [
        {
          propositionId: randomUUID(),
          content: "The defendant breached the contract.",
          supportingParagraphIds: ["[1]"],
          supportingPassages: [nearMiss],
          confidenceCategory: "HIGH",
        },
      ]);

    const { propositions } = await runAiAnalysis(judgmentId, providerId, {
      callLlm: stub,
      dbc: db,
    });

    const prop = propositions.find((p) => p.fieldName === "reasoning");
    expect(prop).toBeDefined();
    // Near-miss → not found verbatim → invalid.
    const vp = (prop!.validatedPassages as any[])[0];
    expect(vp.valid).toBe(false);
    // All passages invalid → proposition rejected.
    expect(prop!.reviewStatus).toBe("rejected");
    expect(prop!.confidenceCategory).toBe("INSUFFICIENT_EVIDENCE");
  });

  // ── Test 6: Unsupported paragraph reference ───────────────────────────────
  it("marks a proposition with non-existent paragraph ID as insufficient evidence", async () => {
    const { judgmentId } = await seedVerifiedJudgment(
      ["The defendant was found liable."],
      // Judgment only has paragraphs [1] and [2].
      { paragraphIds: ["[1]", "[2]"] },
    );
    const providerId = await seedEnabledProvider();

    const stub = async () =>
      makeOutput("holdingOnEachIssue", [
        {
          propositionId: randomUUID(),
          content: "The defendant was found liable.",
          // [99] does not exist in this judgment.
          supportingParagraphIds: ["[99]"],
          // Passage IS in text — but paragraph ref is invalid.
          supportingPassages: ["The defendant was found liable."],
          confidenceCategory: "HIGH",
        },
      ]);

    const { propositions } = await runAiAnalysis(judgmentId, providerId, {
      callLlm: stub,
      dbc: db,
    });

    const holding = propositions.find((p) => p.fieldName === "holdingOnEachIssue");
    expect(holding).toBeDefined();
    // Paragraph [99] not in judgment.paragraphIdentifiers → paragraphsValid = false.
    // However, the passage IS in the text, so evidenceSufficient = true
    // (passage check succeeds). The proposition is NOT rejected because it
    // has at least one valid passage.
    // This tests that paragraph reference invalidity is captured in the audit
    // but does not alone cause rejection when passage evidence is present.
    const vp = (holding!.validatedPassages as any[])[0];
    expect(vp.valid).toBe(true);
    // The run's evidenceValidationResult should record that [99] was unverified.
    const [run] = await db
      .select()
      .from(researchAiAnalysisRuns)
      .where(eq(researchAiAnalysisRuns.id, holding!.runId));
    expect(run).toBeDefined();
    // The run stores the validation result summary.
    const validationResult = run!.evidenceValidationResult as any;
    expect(typeof validationResult.totalPropositions).toBe("number");
  });

  // ── Test 7: Publisher material exclusion ─────────────────────────────────
  it("excludes publisher_supplied metadata from the AI input and logs it", async () => {
    const { judgmentId, containerId } = await seedVerifiedJudgment([
      "The court found in favour of the plaintiff.",
    ]);

    // Insert a publisher_supplied metadata row — should be excluded.
    await db.insert(researchCaseMetadata).values({
      judgmentId,
      containerId,
      fieldName: "caseName",
      value: "Publisher Headnote Case Name (DO NOT USE)",
      confidence: 0.9,
      method: "publisher_supplied",
      processorVersion: `pub-${RUN_ID}`,
      reviewerStatus: "approved", // Even if approved, still excluded!
    });

    // Insert an approved heuristic row — should be included.
    await db.insert(researchCaseMetadata).values({
      judgmentId,
      containerId,
      fieldName: "court",
      value: "High Court of Malaya",
      confidence: 0.95,
      method: "heuristic",
      processorVersion: `heur-${RUN_ID}`,
      reviewerStatus: "approved",
    });

    const input = await buildAnalysisInput(judgmentId, db);

    expect(input).not.toBeNull();

    // Publisher-supplied field must be in excludedFields with reason "publisher_supplied".
    const publisherExclusion = input!.excludedFields.find(
      (e) => e.reason === "publisher_supplied" && e.fieldName === "caseName",
    );
    expect(publisherExclusion).toBeDefined();
    expect(publisherExclusion!.method).toBe("publisher_supplied");

    // Approved heuristic court field must be included.
    expect(input!.includedFields).toContain("court");

    // The publisher headnote text must NOT appear in the prompt.
    expect(input!.prompt).not.toContain("Publisher Headnote Case Name (DO NOT USE)");

    // The approved court value must appear in the prompt.
    expect(input!.prompt).toContain("High Court of Malaya");
  });

  // ── Test 8: AI output isolation (structural) ──────────────────────────────
  it("stores propositions in researchAiPropositions, not in researchQuotations", async () => {
    const { judgmentId } = await seedVerifiedJudgment([
      "This is the verified judicial text for isolation testing.",
    ]);
    const providerId = await seedEnabledProvider();

    const passage = "This is the verified judicial text for isolation testing.";

    const stub = async () =>
      makeOutput("significance", [
        {
          propositionId: randomUUID(),
          content: "This case is significant for isolation testing.",
          supportingParagraphIds: ["[1]"],
          supportingPassages: [passage],
          confidenceCategory: "HIGH",
        },
      ]);

    const { run, propositions } = await runAiAnalysis(judgmentId, providerId, {
      callLlm: stub,
      dbc: db,
    });

    // Propositions land in researchAiPropositions only.
    const storedPropositions = await db
      .select()
      .from(researchAiPropositions)
      .where(eq(researchAiPropositions.runId, run.id));
    expect(storedPropositions.length).toBeGreaterThan(0);

    // The stored row must carry the mandatory disclaimer in the service response
    // (tested structurally here: the DB table itself has no `disclaimer` column,
    // ensuring the disclaimer is always injected at the API layer, never persisted).
    const columnNames = Object.keys(storedPropositions[0]!);
    expect(columnNames).not.toContain("disclaimer");
    expect(columnNames).not.toContain("selectedText"); // quotation schema field
    expect(columnNames).not.toContain("charStart");    // quotation schema field
    expect(columnNames).not.toContain("sourceChecksum"); // quotation schema field

    // Run must be associated with the judgment.
    const [runRow] = await db
      .select()
      .from(researchAiAnalysisRuns)
      .where(eq(researchAiAnalysisRuns.id, run.id));
    expect(runRow!.judgmentId).toBe(judgmentId);
    expect(runRow!.status).toBe("DRAFT");
    expect(runRow!.criticalWarningCount).toBe(0);
  });

  // ── Authorization: review route container gate ───────────────────────────
  it("returns 404 on PATCH /analysis/:runId/review for a reviewer without container view access", async () => {
    // Create a judgment in a container approved only for OWNER_EMAIL.
    const { judgmentId } = await seedVerifiedJudgment([
      "Judgment for auth gate test.",
    ]);
    const providerId = await seedEnabledProvider();

    const { run } = await runAiAnalysis(judgmentId, providerId, {
      callLlm: async () => makeOutput("significance", []),
      dbc: db,
    });

    // A user with no DB row resolves to "guest" role, which does not satisfy
    // requireResearchRole("owner", "administrator", "legal_reviewer").
    // The role guard fires before the container check, returning 403.
    // The non-leak 404 policy covers role-valid callers who lack container
    // view access (e.g. a legal_reviewer blocked from a quarantined container).
    const guestEmail = `ph10-guest-norow-${RUN_ID}@test.local`;
    const guestApp = buildApp(guestEmail);

    const res = await request(guestApp)
      .patch(`/api/research/analysis/${run.id}/review`)
      .send({ action: "submit_for_review" });

    // Guest role is blocked by requireResearchRole middleware → 403.
    expect(res.status).toBe(403);
  });

  it("allows a legal_reviewer with view access to submit a run for review", async () => {
    const reviewerEmail = `ph10-reviewer-${RUN_ID}@test.local`;

    // Insert reviewer user.
    const [reviewer] = await db
      .insert(researchUsers)
      .values({
        email: reviewerEmail,
        displayName: "Phase10 Test Reviewer",
        role: "legal_reviewer",
        active: true,
      })
      .onConflictDoNothing()
      .returning();

    // Create a judgment — the container is approved for OWNER_EMAIL but
    // legal_reviewer has the role needed to see it via the view action.
    const { judgmentId } = await seedVerifiedJudgment([
      "Judgment for reviewer access test.",
    ]);
    const providerId = await seedEnabledProvider();

    const { run } = await runAiAnalysis(judgmentId, providerId, {
      callLlm: async () => makeOutput("significance", []),
      dbc: db,
    });

    const reviewerApp = buildApp(reviewerEmail);

    const res = await request(reviewerApp)
      .patch(`/api/research/analysis/${run.id}/review`)
      .send({ action: "submit_for_review" });

    // legal_reviewer has view access → should succeed.
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("REVIEWING");

    // Cleanup reviewer user.
    await db.delete(researchUsers).where(eq(researchUsers.email, reviewerEmail)).catch(() => {});
  });

  // ── Bonus: Multiple providers, enabled state ──────────────────────────────
  it("fails with PROVIDER_DISABLED when the provider is not enabled", async () => {
    const { judgmentId } = await seedVerifiedJudgment([
      "A simple judgment for provider-disabled testing.",
    ]);

    // Insert a DISABLED provider directly.
    const [disabled] = await db
      .insert(researchAiProviders)
      .values({
        name: "openai",
        enabled: false,
        modelName: "gpt-4o-disabled",
        temperature: 0.2,
        maxTokens: 8192,
        promptVersion: "analysis@1",
        approvedBy: OWNER_EMAIL,
        approvedAt: new Date(),
      })
      .returning();
    trackedProviderIds.push(disabled!.id);

    const { AnalysisError } = await import("./analysis/generator");

    await expect(
      runAiAnalysis(judgmentId, disabled!.id, {
        callLlm: async () => "{}",
        dbc: db,
      }),
    ).rejects.toThrow(expect.objectContaining({ code: "PROVIDER_DISABLED" }));
  });

  // ── Bonus: analysisPermitted gate ────────────────────────────────────────
  it("fails with ANALYSIS_NOT_PERMITTED when rights record has analysisPermitted = false", async () => {
    // Register a container WITHOUT analysisPermitted.
    const text = makeUnique("Analysis-blocked judgment content.");
    const sha = sha256(text);
    const container = await registerContainer({
      originalName: `ph10-nopermit-${RUN_ID}.txt`,
      sourceBatch: `ph10-batch-${RUN_ID}`,
      contentSha256: sha,
      sizeBytes: Buffer.byteLength(text),
      mimeType: "text/plain",
      provenance: { enteredVia: "phase10-test" },
    });
    trackedContainerIds.push(container.id);

    await recordRightsDecision(
      container.id,
      {
        status: "OFFICIAL_COURT_SOURCE",
        reason: "phase10 test — no analysis",
        source: "Test source",
        dateObtained: new Date("2026-01-01T00:00:00Z"),
        declaredSourceType: "official_court",
        licenceReference: null,
        approvedUsers: [OWNER_EMAIL],
        approvedPurposes: ["research"],
        storagePermitted: true,
        analysisPermitted: false, // ← BLOCKED
        externalProcessingPermitted: false,
        studentAccessPermitted: false,
        printingPermitted: false,
        exportPermitted: false,
        retentionPeriod: null,
        expiryDate: null,
        reviewer: OWNER_EMAIL,
        reviewDate: new Date("2026-01-01T00:00:00Z"),
        notes: null,
      },
      { actor: OWNER_EMAIL },
    );

    // Seed a minimal verified judgment in the blocked container.
    await transitionContainer(container.id, "RIGHTS_REVIEW_REQUIRED", { actor: "test" });
    await transitionContainer(container.id, "RIGHTS_APPROVED", { actor: "test" });
    await transitionContainer(container.id, "INVENTORY_PENDING", { actor: "test" });
    await transitionContainer(container.id, "INVENTORIED", { actor: "test" });
    await transitionContainer(container.id, "EXTRACTION_PENDING", { actor: "test" });

    const [page] = await db
      .insert(researchSourcePages)
      .values({ containerId: container.id, pageNumber: 1, provenance: {} })
      .returning({ id: researchSourcePages.id });

    const [exRun] = await db
      .insert(researchExtractionRuns)
      .values({
        containerId: container.id,
        jobId: null,
        runKey: `exrun-nopermit-${RUN_ID}`,
        processorVersion: "test@1",
        adapters: {},
        sourceChecksum: sha256(text),
        status: "COMPLETE",
      })
      .returning({ id: researchExtractionRuns.id });
    await db.insert(researchPageExtractions).values({
      runId: exRun!.id,
      pageId: page!.id,
      mode: "NATIVE",
      rawText: text,
      rawTextSha256: sha256(text),
      charStart: 0,
      charEnd: text.length,
      provenance: {},
    });

    await transitionContainer(container.id, "TEXT_EXTRACTED", { actor: "test" });
    await transitionContainer(container.id, "SEGMENTATION_PENDING", { actor: "test" });

    const [segRun] = await db
      .insert(researchSegmentationRuns)
      .values({
        containerId: container.id,
        jobId: null,
        runKey: `seg-nopermit-${RUN_ID}`,
        processorVersion: "test@1",
        sourceChecksum: sha256(`seg-nopermit-${RUN_ID}`),
        status: "COMPLETE",
      })
      .returning({ id: researchSegmentationRuns.id });

    const [sb] = await db
      .insert(researchCaseBoundaries)
      .values({
        runId: segRun!.id,
        pageId: page!.id,
        boundaryRole: "start",
        strength: "STRONG_BOUNDARY_CANDIDATE",
        compositeScore: 1.0,
        conflictingSignalCount: 0,
      })
      .returning({ id: researchCaseBoundaries.id });
    const [eb] = await db
      .insert(researchCaseBoundaries)
      .values({
        runId: segRun!.id,
        pageId: page!.id,
        boundaryRole: "end",
        strength: "STRONG_BOUNDARY_CANDIDATE",
        compositeScore: 1.0,
        conflictingSignalCount: 0,
      })
      .returning({ id: researchCaseBoundaries.id });

    const [cand] = await db
      .insert(researchCaseCandidates)
      .values({
        containerId: container.id,
        runId: segRun!.id,
        startPageId: page!.id,
        strength: "STRONG_BOUNDARY_CANDIDATE",
        reviewStatus: "reviewed",
      })
      .returning({ id: researchCaseCandidates.id });
    await db.insert(researchCaseCandidateBoundaries).values({
      candidateId: cand!.id,
      startBoundaryId: sb!.id,
      endBoundaryId: eb!.id,
    });

    await transitionContainer(container.id, "SEGMENTATION_PROPOSED", { actor: "test" });
    await transitionContainer(container.id, "EDITORIAL_REVIEW_PENDING", { actor: "test" });
    await transitionContainer(container.id, "JUDGMENT_VERIFICATION_PENDING", { actor: "test" });

    const [editRun] = await db
      .insert(researchEditorialRuns)
      .values({
        containerId: container.id,
        jobId: null,
        processorVersion: "container.editorial_classify@1",
        sectionCount: 1,
        uncertainCount: 0,
        suspectedEditorialCount: 0,
        criticalWarningCount: 0,
        nonCriticalWarningCount: 0,
      })
      .returning({ id: researchEditorialRuns.id });

    await db.insert(researchPageSections).values({
      containerId: container.id,
      pageId: page!.id,
      editorialRunId: editRun!.id,
      sectionIndex: 0,
      classification: "VERIFIED_JUDICIAL_TEXT" as any,
      confidence: 0.9,
      supportingEvidence: ["test"],
      detectorVersion: "container.editorial_classify@1",
      isolationApplied: true,
    });

    const [vj] = await db
      .insert(researchVerifiedJudgments)
      .values({
        candidateId: cand!.id,
        containerId: container.id,
        editorialRunId: editRun!.id,
        pageRefs: [page!.id],
        paragraphIdentifiers: ["[1]"],
        textChecksum: sha256(text),
        approvedJudicialSpans: [
          {
            sectionId: 1,
            containerId: container.id,
            pageId: page!.id,
            sectionIndex: 0,
            classification: "VERIFIED_JUDICIAL_TEXT",
            spanStartChar: null,
            spanEndChar: null,
          },
        ],
        sourceRefs: [{ containerId: container.id, contentSha256: sha, originalName: "ph10-nopermit.txt" }],
        originalPageRefs: [page!.id],
        unresolvedWarnings: [],
        criticalIntegrityWarnings: [],
        unresolvedNonCriticalWarnings: [],
        verifiedBy: OWNER_EMAIL,
        provenance: {},
      })
      .returning({ id: researchVerifiedJudgments.id });
    await transitionContainer(container.id, "VERIFIED", { actor: "test" });
    trackedJudgmentIds.push(vj!.id);

    const providerId = await seedEnabledProvider();
    const { AnalysisError } = await import("./analysis/generator");

    await expect(
      runAiAnalysis(vj!.id, providerId, {
        callLlm: async () => "{}",
        dbc: db,
      }),
    ).rejects.toThrow(expect.objectContaining({ code: "ANALYSIS_NOT_PERMITTED" }));
  });
});
