import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import express from "express";
import request from "supertest";

// Phase 11a proof tests: Authorities & Legislation Extraction.
//
// Tests cover:
//   1. parseCaseFromContent — "X v Y" + citation extraction
//   2. parseCaseFromContent — "Re X" case name
//   3. detectTreatment — keyword + valid passage → specific label
//   4. detectTreatment — keyword in content, no valid passage → UNCLEAR
//   5. detectTreatment — no keyword at all → UNCLEAR (mere mention)
//   6. extractAuthorities — UNCLEAR treatment creates review item
//   7. extractAuthorities — idempotent on re-run
//   8. extractLegislation — statute + provision + mode
//   9. citation graph — outbound + disclaimer always present
//  10. authorities route — container gate: guest gets 404
//  11. authorities route — legal_reviewer with access gets 200 + disclaimer

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
  researchAuthorities,
  researchLegislationRefs,
  researchReviewItems,
} = await import("@workspace/db");
const { eq, inArray, like } = await import("drizzle-orm");

// Authorities-specific imports.
const { parseCaseFromContent, detectTreatment, extractAuthorities, extractLegislation, CITATION_GRAPH_DISCLAIMER } =
  await import("./authorities/extractor");
const { getCitationGraph } = await import("./authorities/citationGraph");
const { runAiAnalysis } = await import("./analysis/generator");

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

// ── Fixture helpers ────────────────────────────────────────────────────────

const OWNER_EMAIL = `ph11a-owner-${RUN_ID}@test.local`;

const trackedContainerIds: number[] = [];
const trackedJudgmentIds: number[] = [];
const trackedProviderIds: number[] = [];
let uploadSeq = 0;

function makeUnique(text: string): string {
  uploadSeq += 1;
  return text + `\n%% phase11a run ${RUN_ID} #${uploadSeq}\n`;
}

async function seedContainer(rawText: string): Promise<number> {
  const text = makeUnique(rawText);
  const sha = sha256(text);
  const container = await registerContainer({
    originalName: `ph11a-fixture-${RUN_ID}-${uploadSeq}.txt`,
    sourceBatch: `ph11a-batch-${RUN_ID}`,
    contentSha256: sha,
    sizeBytes: Buffer.byteLength(text),
    mimeType: "text/plain",
    provenance: { enteredVia: "phase11a-test" },
  });
  trackedContainerIds.push(container.id);
  await recordRightsDecision(
    container.id,
    {
      status: "OFFICIAL_COURT_SOURCE",
      reason: "phase11a test",
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
): Promise<{ containerId: number; judgmentId: number }> {
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
      .values({ containerId, jobId: null, runKey: `exrun-${RUN_ID}-${containerId}-${page!.id}`, processorVersion: "test@1", adapters: {}, sourceChecksum: sha256(text), status: "COMPLETE" })
      .returning({ id: researchExtractionRuns.id });
    await db.insert(researchPageExtractions).values({ runId: exRun!.id, pageId: page!.id, mode: "NATIVE", rawText: text, rawTextSha256: sha256(text), charStart: 0, charEnd: text.length, provenance: {} });
  }

  await transitionContainer(containerId, "TEXT_EXTRACTED", { actor: "test" });
  await transitionContainer(containerId, "SEGMENTATION_PENDING", { actor: "test" });

  const [segRun] = await db
    .insert(researchSegmentationRuns)
    .values({ containerId, jobId: null, runKey: `seg-${RUN_ID}-${containerId}`, processorVersion: "test@1", sourceChecksum: sha256(`seg-${RUN_ID}-${containerId}`), status: "COMPLETE" })
    .returning({ id: researchSegmentationRuns.id });
  const [startBound] = await db.insert(researchCaseBoundaries).values({ runId: segRun!.id, pageId: pageIds[0]!, boundaryRole: "start", strength: "STRONG_BOUNDARY_CANDIDATE", compositeScore: 1.0, conflictingSignalCount: 0 }).returning({ id: researchCaseBoundaries.id });
  const [endBound] = await db.insert(researchCaseBoundaries).values({ runId: segRun!.id, pageId: pageIds[pageIds.length - 1]!, boundaryRole: "end", strength: "STRONG_BOUNDARY_CANDIDATE", compositeScore: 1.0, conflictingSignalCount: 0 }).returning({ id: researchCaseBoundaries.id });
  const [candidate] = await db.insert(researchCaseCandidates).values({ containerId, runId: segRun!.id, startPageId: pageIds[0]!, strength: "STRONG_BOUNDARY_CANDIDATE", reviewStatus: "reviewed" }).returning({ id: researchCaseCandidates.id });
  await db.insert(researchCaseCandidateBoundaries).values({ candidateId: candidate!.id, startBoundaryId: startBound!.id, endBoundaryId: endBound!.id });

  await transitionContainer(containerId, "SEGMENTATION_PROPOSED", { actor: "test" });
  await transitionContainer(containerId, "EDITORIAL_REVIEW_PENDING", { actor: "test" });
  await transitionContainer(containerId, "JUDGMENT_VERIFICATION_PENDING", { actor: "test" });

  const [editRun] = await db.insert(researchEditorialRuns).values({ containerId, jobId: null, processorVersion: "container.editorial_classify@1", sectionCount: pageIds.length, uncertainCount: 0, suspectedEditorialCount: 0, criticalWarningCount: 0, nonCriticalWarningCount: 0 }).returning({ id: researchEditorialRuns.id });
  for (let i = 0; i < pageIds.length; i++) {
    await db.insert(researchPageSections).values({ containerId, pageId: pageIds[i]!, editorialRunId: editRun!.id, sectionIndex: 0, classification: "VERIFIED_JUDICIAL_TEXT" as any, confidence: 0.9, supportingEvidence: ["test"], detectorVersion: "container.editorial_classify@1", isolationApplied: true });
  }

  const textChecksum = sha256(pageTexts.join("\n"));
  const [vj] = await db
    .insert(researchVerifiedJudgments)
    .values({
      candidateId: candidate!.id,
      containerId,
      editorialRunId: editRun!.id,
      pageRefs: pageIds,
      paragraphIdentifiers: pageTexts.flatMap((_, i) => [`[${i * 2 + 1}]`, `[${i * 2 + 2}]`]),
      textChecksum,
      approvedJudicialSpans: pageIds.map((pid, i) => ({ sectionId: i + 1, containerId, pageId: pid, sectionIndex: 0, classification: "VERIFIED_JUDICIAL_TEXT", spanStartChar: null, spanEndChar: null })),
      sourceRefs: [{ containerId, contentSha256: sha256(`seg-${RUN_ID}-${containerId}`), originalName: "ph11a-fixture.txt" }],
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
  return { containerId, judgmentId: vj!.id };
}

async function seedEnabledProvider(): Promise<number> {
  const [row] = await db
    .insert(researchAiProviders)
    .values({ name: "gemini", enabled: true, modelName: "stub-model", temperature: 0.2, maxTokens: 8192, promptVersion: "analysis@1", approvedBy: OWNER_EMAIL, approvedAt: new Date() })
    .returning();
  trackedProviderIds.push(row!.id);
  return row!.id;
}

/** Minimal output with a single casesConsidered and statutesConsidered prop. */
function makeOutput(casesConsidered: object[], statutesConsidered: object[]): string {
  return JSON.stringify({
    catchwords: [], proceduralPosture: [], materialFacts: [], legalIssues: [],
    partiesMaterialSubmissions: [], holdingOnEachIssue: [], reasoning: [],
    possibleRatioDecidendi: [], possibleObiterDicta: [], orders: [],
    statutesConsidered,
    casesConsidered,
    significance: [], summary50Word: [], summary150Word: [],
    detailedCaseBrief: [], teachingNote: [],
  });
}

// ── Setup / teardown ──────────────────────────────────────────────────────

beforeAll(async () => {
  await db.insert(researchUsers).values({ email: OWNER_EMAIL, displayName: "Phase11a Test Owner", role: "owner", active: true }).onConflictDoNothing();
});

afterAll(async () => {
  // 1. Authorities and legislation refs (FK to judgments/runs).
  if (trackedJudgmentIds.length > 0) {
    await db.delete(researchAuthorities).where(inArray(researchAuthorities.judgmentId, trackedJudgmentIds)).catch(() => {});
    await db.delete(researchLegislationRefs).where(inArray(researchLegislationRefs.judgmentId, trackedJudgmentIds)).catch(() => {});
    const runs = await db.select({ id: researchAiAnalysisRuns.id }).from(researchAiAnalysisRuns).where(inArray(researchAiAnalysisRuns.judgmentId, trackedJudgmentIds)).catch(() => [] as { id: number }[]);
    if (runs.length > 0) {
      const runIds = runs.map((r) => r.id);
      await db.delete(researchAiPropositions).where(inArray(researchAiPropositions.runId, runIds)).catch(() => {});
    }
    await db.delete(researchAiAnalysisRuns).where(inArray(researchAiAnalysisRuns.judgmentId, trackedJudgmentIds)).catch(() => {});
    await db.delete(researchCaseMetadata).where(inArray(researchCaseMetadata.judgmentId, trackedJudgmentIds)).catch(() => {});
    await db.delete(researchVerifiedJudgments).where(inArray(researchVerifiedJudgments.id, trackedJudgmentIds)).catch(() => {});
  }
  if (trackedProviderIds.length > 0) {
    await db.delete(researchAiProviders).where(inArray(researchAiProviders.id, trackedProviderIds)).catch(() => {});
  }
  if (trackedContainerIds.length > 0) {
    const candidateIds = (await db.select({ id: researchCaseCandidates.id }).from(researchCaseCandidates).where(inArray(researchCaseCandidates.containerId, trackedContainerIds)).catch(() => [] as { id: number }[])).map((r) => r.id);
    const segRunIds = (await db.select({ id: researchSegmentationRuns.id }).from(researchSegmentationRuns).where(inArray(researchSegmentationRuns.containerId, trackedContainerIds)).catch(() => [] as { id: number }[])).map((r) => r.id);
    await db.delete(researchPageSections).where(inArray(researchPageSections.containerId, trackedContainerIds)).catch(() => {});
    await db.delete(researchEditorialRuns).where(inArray(researchEditorialRuns.containerId, trackedContainerIds)).catch(() => {});
    if (candidateIds.length > 0) await db.delete(researchCaseCandidateBoundaries).where(inArray(researchCaseCandidateBoundaries.candidateId, candidateIds)).catch(() => {});
    await db.delete(researchCaseCandidates).where(inArray(researchCaseCandidates.containerId, trackedContainerIds)).catch(() => {});
    if (segRunIds.length > 0) await db.delete(researchCaseBoundaries).where(inArray(researchCaseBoundaries.runId, segRunIds)).catch(() => {});
    await db.delete(researchSegmentationRuns).where(inArray(researchSegmentationRuns.containerId, trackedContainerIds)).catch(() => {});
    await db.delete(researchTransformations).where(inArray(researchTransformations.containerId, trackedContainerIds)).catch(() => {});
    const pageIds = (await db.select({ id: researchSourcePages.id }).from(researchSourcePages).where(inArray(researchSourcePages.containerId, trackedContainerIds)).catch(() => [] as { id: number }[])).map((r) => r.id);
    if (pageIds.length > 0) await db.delete(researchPageExtractions).where(inArray(researchPageExtractions.pageId, pageIds)).catch(() => {});
    await db.delete(researchExtractionRuns).where(inArray(researchExtractionRuns.containerId, trackedContainerIds)).catch(() => {});
    await db.delete(researchSourcePages).where(inArray(researchSourcePages.containerId, trackedContainerIds)).catch(() => {});
    await db.delete(researchRightsRecords).where(inArray(researchRightsRecords.containerId, trackedContainerIds)).catch(() => {});
    const jobsToDelete = await db.select({ id: researchJobs.id }).from(researchJobs).where(like(researchJobs.idempotencyKey, `%${RUN_ID.slice(0, 8)}%`)).catch(() => []);
    if (jobsToDelete.length > 0) await db.delete(researchJobs).where(inArray(researchJobs.id, jobsToDelete.map((j) => j.id))).catch(() => {});
    await db.delete(researchSourceContainers).where(inArray(researchSourceContainers.id, trackedContainerIds)).catch(() => {});
  }
  await db.delete(researchUsers).where(eq(researchUsers.email, OWNER_EMAIL)).catch(() => {});
  // Clean up review items created by UNCLEAR tests.
  await db.delete(researchReviewItems).where(like(researchReviewItems.reason, `%phase11a%`)).catch(() => {});
  await db.delete(researchReviewItems).where(like(researchReviewItems.reason, `%ph11a%`)).catch(() => {});
});

// ── Pure-function tests ────────────────────────────────────────────────────

describe("Phase 11a: Authorities & Legislation Extraction", () => {

  // ── 1. parseCaseFromContent: "X v Y" + citation ───────────────────────

  it("parses 'X v Y' case name and neutral citation from proposition content", () => {
    const content =
      "The court applied the principle from Kerajaan Malaysia v Ahmad Jefri [2020] 1 MLJ 100 " +
      "where the Federal Court held that judicial review was available.";
    const result = parseCaseFromContent(content);
    expect(result.caseName).toContain("Ahmad Jefri");
    expect(result.citation).toMatch(/\[2020\]/);
    expect(result.citation).toMatch(/MLJ/i);
  });

  // ── 2. parseCaseFromContent: "Re X" ───────────────────────────────────

  it("parses 'Re X' case name from proposition content", () => {
    const content = "The court followed Re Goldberg [2019] 3 CLJ 200 on the question of costs.";
    const result = parseCaseFromContent(content);
    expect(result.caseName).toMatch(/Re Goldberg/);
    expect(result.citation).toMatch(/CLJ/i);
  });

  // ── 3. detectTreatment: keyword + valid passage → specific label ──────

  it("assigns APPLIED treatment when keyword appears in content AND valid passage", () => {
    const content = "The court applied Smith v Jones [2018] 5 CLJ 100 to the facts.";
    const passages = [
      { text: "The court applied Smith v Jones [2018] 5 CLJ 100 to the facts.", valid: true, charStart: 0, charEnd: 62 },
    ];
    const result = detectTreatment(content, passages);
    expect(result.treatment).toBe("APPLIED");
    expect(result.evidenced).toBe(true);
  });

  // ── 4. detectTreatment: keyword in content, no valid passage → UNCLEAR ─

  it("assigns UNCLEAR when keyword appears in content but no passage is valid", () => {
    const content = "The court applied Smith v Jones [2018] 5 CLJ 100 to the facts.";
    const passages = [
      { text: "unrelated text", valid: false, charStart: null, charEnd: null, failureReason: "not found" },
    ];
    const result = detectTreatment(content, passages);
    expect(result.treatment).toBe("UNCLEAR");
    expect(result.evidenced).toBe(false);
  });

  // ── 5. detectTreatment: no keyword → UNCLEAR (mere mention) ──────────

  it("assigns UNCLEAR when content mentions a case but has no treatment keyword", () => {
    const content = "See also Tan Sri Lee v Foo [2015] 2 MLJ 50.";
    const passages = [
      { text: "Tan Sri Lee v Foo [2015] 2 MLJ 50.", valid: true, charStart: 0, charEnd: 36 },
    ];
    const result = detectTreatment(content, passages);
    expect(result.treatment).toBe("UNCLEAR");
  });

  // ── 5b. Treatment label coverage: all 13 determinable labels ─────────
  //
  // Each sub-case: content keyword + a valid passage containing the same
  // keyword → evidenced treatment label.  No DB interaction required.

  const evidencedCases: Array<[string, string]> = [
    ["OVERRULED",          "The earlier decision was overruled by the Federal Court."],
    ["DECLINED_TO_FOLLOW", "The Court of Appeal declined to follow the earlier approach."],
    ["DOUBTED",            "The ratio was doubted in subsequent cases."],
    ["CRITICISED",         "The reasoning was criticised as too broad."],         // British
    ["CRITICISED",         "The dissent criticized the majority's analysis."],    // US
    ["DISTINGUISHED",      "The court distinguished the facts from the precedent."],
    ["APPLIED",            "The test from that case was applied to the present facts."],
    ["FOLLOWED",           "The lower court followed the Court of Appeal's ruling."],
    ["APPROVED",           "The Federal Court approved of the approach taken."],
    ["ADOPTED",            "The judge adopted the reasoning from the Privy Council."],
    ["EXPLAINED",          "The court explained the earlier decision's scope."],
    ["DISCUSSED",          "The authority was discussed at length in the judgment."],
    ["CONSIDERED",         "The judge considered the case before reaching a conclusion."],
    ["REFERRED_TO",        "The court referred to the case in passing."],
  ];

  it.each(evidencedCases)(
    "assigns %s when keyword is evidenced in a valid passage (%s)",
    (expectedLabel, sentence) => {
      const passages = [{ text: sentence, valid: true, charStart: 0, charEnd: sentence.length }];
      const result = detectTreatment(sentence, passages);
      expect(result.treatment).toBe(expectedLabel);
      expect(result.evidenced).toBe(true);
    },
  );

  it("assigns UNCLEAR (not CRITICISED) when 'criticised' appears in content but passage is invalid", () => {
    const content = "The reasoning was criticised as overbroad.";
    const passages = [{ text: content, valid: false, charStart: null, charEnd: null, failureReason: "not found" }];
    const result = detectTreatment(content, passages);
    expect(result.treatment).toBe("UNCLEAR");
    expect(result.evidenced).toBe(false);
  });

  // ── 6. extractAuthorities: UNCLEAR treatment creates review item ──────

  it("extractAuthorities creates a review item when treatment is UNCLEAR", async () => {
    const judicialText =
      "IN THE HIGH COURT OF MALAYA\n" +
      "[1] See also Tan Sri Lee v Foo [2015] 2 MLJ 50 on the general principle.\n" +
      "[2] The court made its order accordingly.";

    const { judgmentId } = await seedVerifiedJudgment([judicialText]);
    const providerId = await seedEnabledProvider();

    // Stub: casesConsidered with no treatment keyword + invalid passage.
    const { run } = await runAiAnalysis(judgmentId, providerId, {
      callLlm: async () => makeOutput([
        {
          propositionId: randomUUID(),
          content: "See also Tan Sri Lee v Foo [2015] 2 MLJ 50 on the general principle.",
          supportingParagraphIds: ["[1]"],
          supportingPassages: ["See also Tan Sri Lee v Foo [2015] 2 MLJ 50 on the general principle."],
          confidenceCategory: "MEDIUM",
        },
      ], []),
      dbc: db,
    });

    // Approve the run so extraction is permitted.
    await db.update(researchAiAnalysisRuns).set({ status: "APPROVED", approvedAt: new Date() }).where(eq(researchAiAnalysisRuns.id, run.id));

    const before = await db.select({ id: researchReviewItems.id }).from(researchReviewItems).where(like(researchReviewItems.kind, "authority.%"));
    const { inserted, reviewItemsCreated } = await extractAuthorities(run.id, db);

    // The proposition has no treatment keyword → UNCLEAR → review item.
    expect(inserted).toBe(1);
    expect(reviewItemsCreated).toBeGreaterThanOrEqual(1);

    const after = await db.select({ id: researchReviewItems.id }).from(researchReviewItems).where(like(researchReviewItems.kind, "authority.%"));
    expect(after.length).toBeGreaterThan(before.length);

    const authority = await db.select().from(researchAuthorities).where(eq(researchAuthorities.runId, run.id));
    expect(authority[0]?.treatment).toBe("UNCLEAR");
    expect(authority[0]?.reviewStatus).toBe("pending_review");
  });

  // ── 7. extractAuthorities: idempotent on re-run ───────────────────────

  it("extractAuthorities is idempotent — second call inserts 0 rows", async () => {
    const judicialText =
      "IN THE HIGH COURT OF MALAYA\n" +
      "[1] The court applied Smith v Jones [2018] 5 CLJ 100 to the facts before it.\n" +
      "[2] Judgment for plaintiff.";

    const { judgmentId } = await seedVerifiedJudgment([judicialText]);
    const providerId = await seedEnabledProvider();

    const passage = "The court applied Smith v Jones [2018] 5 CLJ 100 to the facts before it.";

    const { run } = await runAiAnalysis(judgmentId, providerId, {
      callLlm: async () => makeOutput([
        {
          propositionId: randomUUID(),
          content: `The court applied Smith v Jones [2018] 5 CLJ 100 to the facts before it.`,
          supportingParagraphIds: ["[1]"],
          supportingPassages: [passage],
          confidenceCategory: "HIGH",
        },
      ], []),
      dbc: db,
    });

    await db.update(researchAiAnalysisRuns).set({ status: "APPROVED", approvedAt: new Date() }).where(eq(researchAiAnalysisRuns.id, run.id));

    const first = await extractAuthorities(run.id, db);
    const second = await extractAuthorities(run.id, db);

    expect(first.inserted).toBe(1);
    expect(second.inserted).toBe(0); // idempotent
  });

  // ── 8. extractLegislation: statute + provision + mode ─────────────────

  it("extractLegislation parses statute, provision, and mode correctly", async () => {
    const judicialText =
      "IN THE HIGH COURT OF MALAYA\n" +
      "[1] The court interpreted section 218 of the Companies Act 2016 in light of the facts.\n" +
      "[2] Judgment accordingly.";

    const { judgmentId } = await seedVerifiedJudgment([judicialText]);
    const providerId = await seedEnabledProvider();

    const passage = "The court interpreted section 218 of the Companies Act 2016 in light of the facts.";

    const { run } = await runAiAnalysis(judgmentId, providerId, {
      callLlm: async () => makeOutput([], [
        {
          propositionId: randomUUID(),
          content: "The court interpreted section 218 of the Companies Act 2016 in light of the facts.",
          supportingParagraphIds: ["[1]"],
          supportingPassages: [passage],
          confidenceCategory: "HIGH",
        },
      ]),
      dbc: db,
    });

    await db.update(researchAiAnalysisRuns).set({ status: "APPROVED", approvedAt: new Date() }).where(eq(researchAiAnalysisRuns.id, run.id));

    const { inserted } = await extractLegislation(run.id, db);
    expect(inserted).toBe(1);

    const refs = await db.select().from(researchLegislationRefs).where(eq(researchLegislationRefs.runId, run.id));
    expect(refs.length).toBe(1);
    expect(refs[0]?.statute).toMatch(/Companies Act/i);
    expect(refs[0]?.provision).toMatch(/section\s*218/i);
    expect(refs[0]?.mode).toBe("interpreted");
  });

  // ── 9. citation graph: disclaimer always present ──────────────────────

  it("getCitationGraph always includes the collection-limitation disclaimer", async () => {
    const judicialText =
      "IN THE HIGH COURT OF MALAYA\n[1] General judgment.";
    const { judgmentId } = await seedVerifiedJudgment([judicialText]);

    const graph = await getCitationGraph(judgmentId, db);

    expect(graph.disclaimer).toBe(CITATION_GRAPH_DISCLAIMER);
    expect(graph.disclaimer).toMatch(/not a comprehensive citator/i);
    expect(graph.outbound).toBeDefined();
    expect(graph.inbound).toBeDefined();
  });

  // ── 10. authorities route: role gate — guest gets 403 on extract ─────
  //
  // POST /judgments/:id/authorities/extract requires legal_reviewer or above.
  // A guest user (no DB row → resolves to "guest" role) gets 403 from the
  // requireResearchRole middleware before the container gate fires.
  // (Note: GET /authorities is not role-gated; it uses the container view
  //  gate only. For OFFICIAL_COURT_SOURCE containers, all roles including
  //  guest have view access per the rights caps matrix.)

  it("POST /judgments/:id/authorities/extract returns 403 for a guest caller", async () => {
    const { judgmentId } = await seedVerifiedJudgment(["IN THE HIGH COURT OF MALAYA\n[1] Test judgment."]);

    const guestApp = buildApp(`ph11a-guest-${RUN_ID}@test.local`);
    const res = await request(guestApp)
      .post(`/api/research/judgments/${judgmentId}/authorities/extract`);

    // Guest role is blocked by requireResearchRole middleware → 403.
    expect(res.status).toBe(403);
  });

  // ── 11. authorities route: legal_reviewer gets 200 + disclaimer ───────

  it("GET /judgments/:id/authorities returns 200 with disclaimer for legal_reviewer", async () => {
    const reviewerEmail = `ph11a-reviewer-${RUN_ID}@test.local`;
    await db.insert(researchUsers).values({ email: reviewerEmail, displayName: "Phase11a Reviewer", role: "legal_reviewer", active: true }).onConflictDoNothing();

    const { judgmentId } = await seedVerifiedJudgment(["IN THE HIGH COURT OF MALAYA\n[1] Test judgment for reviewer."]);

    const reviewerApp = buildApp(reviewerEmail);
    const res = await request(reviewerApp)
      .get(`/api/research/judgments/${judgmentId}/authorities`);

    expect(res.status).toBe(200);
    expect(res.body.disclaimer).toBe(CITATION_GRAPH_DISCLAIMER);
    expect(Array.isArray(res.body.authorities)).toBe(true);

    await db.delete(researchUsers).where(eq(researchUsers.email, reviewerEmail)).catch(() => {});
  });

});
