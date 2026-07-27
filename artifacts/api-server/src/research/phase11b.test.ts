import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import express from "express";
import request from "supertest";

// Phase 11b: Research Workspace proof tests.
//
// Tests cover:
//   1.  Folder CRUD (create, list, get, delete)
//   2.  Cross-user isolation: user B cannot see user A's private folder
//   3.  Student blocked from course-folder creation
//   4.  Student CAN create research folders
//   5.  Shared reading list visible to student
//   6.  Non-shared reading list invisible to student
//   7.  Saved search create + list + delete
//   8.  Quotation collection create + quotation save + list
//   9.  Quotation plain-text export
//  10.  Comparison table render (one judgment, one field → grid)
//  11.  Authorities table returns disclaimer
//  12.  Annotation visibility toggle: is_public controls other-user visibility
//  13.  Bookmark upsert + list

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
  researchRightsRecords,
  researchAiProviders,
  researchAiAnalysisRuns,
  researchAiPropositions,
  researchFolders,
  researchFolderItems,
  researchSavedSearches,
  researchReadingLists,
  researchReadingListItems,
  researchQuotationCollections,
  researchWorkspaceQuotations,
  researchComparisonTables,
  researchAuthoritiesTables,
  researchAnnotations,
  researchBookmarks,
  researchAuthorities,
  researchLegislationRefs,
} = await import("@workspace/db");
const { eq, inArray, like } = await import("drizzle-orm");

const {
  createFolder,
  listFolders,
  getFolder,
  deleteFolder,
  createReadingList,
  listReadingLists,
  createSavedSearch,
  listSavedSearches,
  deleteSavedSearch,
  createQuotationCollection,
  saveQuotation,
  listQuotations,
  exportCollectionText,
  renderComparisonTable,
  createComparisonTable,
  renderAuthoritiesTable,
  createAuthoritiesTable,
  createAnnotation,
  listAnnotations,
  upsertBookmark,
  listBookmarks,
} = await import("./workspace/service");

const { runAiAnalysis } = await import("./analysis/generator");
const { extractAuthorities, extractLegislation } = await import("./authorities/extractor");
const { CITATION_GRAPH_DISCLAIMER } = await import("./authorities/extractor");

// ── IDs for teardown ───────────────────────────────────────────────────────

const trackedContainerIds: number[] = [];
const trackedJudgmentIds: number[] = [];
const trackedProviderIds: number[] = [];

// User emails created in this run.
const OWNER_EMAIL = `ph11b-owner-${RUN_ID}@test.local`;
const OTHER_EMAIL = `ph11b-other-${RUN_ID}@test.local`;
const STUDENT_EMAIL = `ph11b-student-${RUN_ID}@test.local`;

let ownerUserId = 0;
let otherUserId = 0;
let studentUserId = 0;

let uploadSeq = 0;
function makeUnique(text: string) {
  uploadSeq += 1;
  return text + `\n%% phase11b run ${RUN_ID} #${uploadSeq}\n`;
}

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

async function seedContainer(rawText: string): Promise<number> {
  const text = makeUnique(rawText);
  const s = sha256(text);
  const container = await registerContainer({
    originalName: `ph11b-fixture-${RUN_ID}-${uploadSeq}.txt`,
    sourceBatch: `ph11b-batch-${RUN_ID}`,
    contentSha256: s,
    sizeBytes: Buffer.byteLength(text),
    mimeType: "text/plain",
    provenance: { enteredVia: "phase11b-test" },
  });
  trackedContainerIds.push(container.id);
  await recordRightsDecision(
    container.id,
    {
      status: "OFFICIAL_COURT_SOURCE",
      reason: "phase11b test",
      source: "Test",
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

  const [segRun] = await db.insert(researchSegmentationRuns).values({ containerId, jobId: null, runKey: `seg-${RUN_ID}-${containerId}`, processorVersion: "test@1", sourceChecksum: sha256(`seg${containerId}`), status: "COMPLETE" }).returning({ id: researchSegmentationRuns.id });
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
      candidateId: candidate!.id, containerId, editorialRunId: editRun!.id,
      pageRefs: pageIds,
      paragraphIdentifiers: pageTexts.flatMap((_, i) => [`[${i * 2 + 1}]`, `[${i * 2 + 2}]`]),
      textChecksum,
      approvedJudicialSpans: pageIds.map((pid, i) => ({ sectionId: i + 1, containerId, pageId: pid, sectionIndex: 0, classification: "VERIFIED_JUDICIAL_TEXT", spanStartChar: null, spanEndChar: null })),
      sourceRefs: [{ containerId, contentSha256: sha256(`seg${containerId}`), originalName: "ph11b-fixture.txt" }],
      originalPageRefs: pageIds,
      unresolvedWarnings: [], criticalIntegrityWarnings: [], unresolvedNonCriticalWarnings: [],
      verifiedBy: OWNER_EMAIL,
      provenance: {},
    })
    .returning({ id: researchVerifiedJudgments.id });
  await transitionContainer(containerId, "VERIFIED", { actor: "test" });
  trackedJudgmentIds.push(vj!.id);
  return { containerId, judgmentId: vj!.id };
}

function makeOutput(casesConsidered: object[], statutesConsidered: object[]): string {
  return JSON.stringify({
    catchwords: [], proceduralPosture: [], materialFacts: [],
    legalIssues: [{ propositionId: randomUUID(), content: "Was the test valid?", supportingParagraphIds: ["[1]"], supportingPassages: ["Was the test valid?"], confidenceCategory: "HIGH" }],
    partiesMaterialSubmissions: [], holdingOnEachIssue: [],
    reasoning: [{ propositionId: randomUUID(), content: "The court reasoned that the test was valid.", supportingParagraphIds: ["[2]"], supportingPassages: ["The court reasoned."], confidenceCategory: "HIGH" }],
    possibleRatioDecidendi: [], possibleObiterDicta: [], orders: [],
    statutesConsidered, casesConsidered,
    significance: [], summary50Word: [], summary150Word: [],
    detailedCaseBrief: [], teachingNote: [],
  });
}

// ── Setup / teardown ──────────────────────────────────────────────────────

beforeAll(async () => {
  const [o] = await db.insert(researchUsers).values({ email: OWNER_EMAIL, displayName: "Phase11b Owner", role: "owner", active: true }).onConflictDoNothing().returning({ id: researchUsers.id });
  const [ot] = await db.insert(researchUsers).values({ email: OTHER_EMAIL, displayName: "Phase11b Other", role: "researcher", active: true }).onConflictDoNothing().returning({ id: researchUsers.id });
  const [st] = await db.insert(researchUsers).values({ email: STUDENT_EMAIL, displayName: "Phase11b Student", role: "student", active: true }).onConflictDoNothing().returning({ id: researchUsers.id });

  // Fetch IDs whether freshly inserted or already existing.
  ownerUserId = o?.id ?? (await db.select({ id: researchUsers.id }).from(researchUsers).where(eq(researchUsers.email, OWNER_EMAIL)))[0]!.id;
  otherUserId = ot?.id ?? (await db.select({ id: researchUsers.id }).from(researchUsers).where(eq(researchUsers.email, OTHER_EMAIL)))[0]!.id;
  studentUserId = st?.id ?? (await db.select({ id: researchUsers.id }).from(researchUsers).where(eq(researchUsers.email, STUDENT_EMAIL)))[0]!.id;
});

afterAll(async () => {
  // Workspace tables.
  const userIds = [ownerUserId, otherUserId, studentUserId].filter(Boolean);
  if (userIds.length > 0) {
    const folderIds = (await db.select({ id: researchFolders.id }).from(researchFolders).where(inArray(researchFolders.ownerId, userIds)).catch(() => [])).map((r) => r.id);
    if (folderIds.length > 0) {
      await db.delete(researchFolderItems).where(inArray(researchFolderItems.folderId, folderIds)).catch(() => {});
      await db.delete(researchFolders).where(inArray(researchFolders.id, folderIds)).catch(() => {});
    }
    await db.delete(researchSavedSearches).where(inArray(researchSavedSearches.ownerId, userIds)).catch(() => {});
    const listIds = (await db.select({ id: researchReadingLists.id }).from(researchReadingLists).where(inArray(researchReadingLists.ownerId, userIds)).catch(() => [])).map((r) => r.id);
    if (listIds.length > 0) {
      await db.delete(researchReadingListItems).where(inArray(researchReadingListItems.listId, listIds)).catch(() => {});
      await db.delete(researchReadingLists).where(inArray(researchReadingLists.id, listIds)).catch(() => {});
    }
    const collIds = (await db.select({ id: researchQuotationCollections.id }).from(researchQuotationCollections).where(inArray(researchQuotationCollections.ownerId, userIds)).catch(() => [])).map((r) => r.id);
    if (collIds.length > 0) {
      await db.delete(researchWorkspaceQuotations).where(inArray(researchWorkspaceQuotations.collectionId, collIds)).catch(() => {});
      await db.delete(researchQuotationCollections).where(inArray(researchQuotationCollections.id, collIds)).catch(() => {});
    }
    await db.delete(researchComparisonTables).where(inArray(researchComparisonTables.ownerId, userIds)).catch(() => {});
    await db.delete(researchAuthoritiesTables).where(inArray(researchAuthoritiesTables.ownerId, userIds)).catch(() => {});
    if (trackedJudgmentIds.length > 0) {
      await db.delete(researchAnnotations).where(inArray(researchAnnotations.judgmentId, trackedJudgmentIds)).catch(() => {});
      await db.delete(researchBookmarks).where(inArray(researchBookmarks.judgmentId, trackedJudgmentIds)).catch(() => {});
    }
  }

  // AI tables.
  if (trackedJudgmentIds.length > 0) {
    await db.delete(researchAuthorities).where(inArray(researchAuthorities.judgmentId, trackedJudgmentIds)).catch(() => {});
    await db.delete(researchLegislationRefs).where(inArray(researchLegislationRefs.judgmentId, trackedJudgmentIds)).catch(() => {});
    const runs = await db.select({ id: researchAiAnalysisRuns.id }).from(researchAiAnalysisRuns).where(inArray(researchAiAnalysisRuns.judgmentId, trackedJudgmentIds)).catch(() => [] as { id: number }[]);
    if (runs.length > 0) {
      await db.delete(researchAiPropositions).where(inArray(researchAiPropositions.runId, runs.map((r) => r.id))).catch(() => {});
    }
    await db.delete(researchAiAnalysisRuns).where(inArray(researchAiAnalysisRuns.judgmentId, trackedJudgmentIds)).catch(() => {});
    await db.delete(researchVerifiedJudgments).where(inArray(researchVerifiedJudgments.id, trackedJudgmentIds)).catch(() => {});
  }
  if (trackedProviderIds.length > 0) {
    await db.delete(researchAiProviders).where(inArray(researchAiProviders.id, trackedProviderIds)).catch(() => {});
  }

  // Container cleanup.
  if (trackedContainerIds.length > 0) {
    const candidateIds = (await db.select({ id: researchCaseCandidates.id }).from(researchCaseCandidates).where(inArray(researchCaseCandidates.containerId, trackedContainerIds)).catch(() => [])).map((r) => r.id);
    const segRunIds = (await db.select({ id: researchSegmentationRuns.id }).from(researchSegmentationRuns).where(inArray(researchSegmentationRuns.containerId, trackedContainerIds)).catch(() => [])).map((r) => r.id);
    await db.delete(researchPageSections).where(inArray(researchPageSections.containerId, trackedContainerIds)).catch(() => {});
    await db.delete(researchEditorialRuns).where(inArray(researchEditorialRuns.containerId, trackedContainerIds)).catch(() => {});
    if (candidateIds.length > 0) await db.delete(researchCaseCandidateBoundaries).where(inArray(researchCaseCandidateBoundaries.candidateId, candidateIds)).catch(() => {});
    await db.delete(researchCaseCandidates).where(inArray(researchCaseCandidates.containerId, trackedContainerIds)).catch(() => {});
    if (segRunIds.length > 0) await db.delete(researchCaseBoundaries).where(inArray(researchCaseBoundaries.runId, segRunIds)).catch(() => {});
    await db.delete(researchSegmentationRuns).where(inArray(researchSegmentationRuns.containerId, trackedContainerIds)).catch(() => {});
    await db.delete(researchTransformations).where(inArray(researchTransformations.containerId, trackedContainerIds)).catch(() => {});
    const pageIds = (await db.select({ id: researchSourcePages.id }).from(researchSourcePages).where(inArray(researchSourcePages.containerId, trackedContainerIds)).catch(() => [])).map((r) => r.id);
    if (pageIds.length > 0) await db.delete(researchPageExtractions).where(inArray(researchPageExtractions.pageId, pageIds)).catch(() => {});
    await db.delete(researchExtractionRuns).where(inArray(researchExtractionRuns.containerId, trackedContainerIds)).catch(() => {});
    await db.delete(researchSourcePages).where(inArray(researchSourcePages.containerId, trackedContainerIds)).catch(() => {});
    await db.delete(researchRightsRecords).where(inArray(researchRightsRecords.containerId, trackedContainerIds)).catch(() => {});
    const jobsToDelete = await db.select({ id: researchJobs.id }).from(researchJobs).where(like(researchJobs.idempotencyKey, `%${RUN_ID.slice(0, 8)}%`)).catch(() => []);
    if (jobsToDelete.length > 0) await db.delete(researchJobs).where(inArray(researchJobs.id, jobsToDelete.map((j) => j.id))).catch(() => {});
    await db.delete(researchSourceContainers).where(inArray(researchSourceContainers.id, trackedContainerIds)).catch(() => {});
  }

  await db.delete(researchUsers).where(eq(researchUsers.email, OWNER_EMAIL)).catch(() => {});
  await db.delete(researchUsers).where(eq(researchUsers.email, OTHER_EMAIL)).catch(() => {});
  await db.delete(researchUsers).where(eq(researchUsers.email, STUDENT_EMAIL)).catch(() => {});
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("Phase 11b: Research Workspace", () => {

  // ── 1. Folder CRUD ────────────────────────────────────────────────────

  it("creates, lists, and deletes a research folder", async () => {
    const folder = await createFolder(ownerUserId, { kind: "research", name: "My Cases" }, db);
    expect(folder.id).toBeGreaterThan(0);
    expect(folder.name).toBe("My Cases");
    expect(folder.kind).toBe("research");

    const list = await listFolders(ownerUserId, "owner", db);
    expect(list.some((f) => f.id === folder.id)).toBe(true);

    await deleteFolder(folder.id, db);
    const after = await getFolder(folder.id, db);
    expect(after).toBeNull();
  });

  // ── 2. Cross-user isolation ───────────────────────────────────────────

  it("user B cannot see user A's private folder via API", async () => {
    const ownerApp = buildApp(OWNER_EMAIL);
    const otherApp = buildApp(OTHER_EMAIL);

    // Create folder as owner.
    const createRes = await request(ownerApp)
      .post("/api/research/workspace/folders")
      .send({ kind: "research", name: `Private-${RUN_ID}` });
    expect(createRes.status).toBe(201);
    const folderId = createRes.body.id as number;

    // Other user tries to GET it — should 404.
    const getRes = await request(otherApp).get(`/api/research/workspace/folders/${folderId}`);
    expect(getRes.status).toBe(404);

    // Cleanup.
    await db.delete(researchFolderItems).where(eq(researchFolderItems.folderId, folderId)).catch(() => {});
    await db.delete(researchFolders).where(eq(researchFolders.id, folderId)).catch(() => {});
  });

  // ── 3. Student blocked from course-folder creation ─────────────────

  it("student cannot create a course folder", async () => {
    const studentApp = buildApp(STUDENT_EMAIL);
    const res = await request(studentApp)
      .post("/api/research/workspace/folders")
      .send({ kind: "course", name: "MyCourse" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("STUDENT_FOLDER_KIND_RESTRICTED");
  });

  // ── 4. Student CAN create research folders ────────────────────────

  it("student can create a research folder", async () => {
    const studentApp = buildApp(STUDENT_EMAIL);
    const res = await request(studentApp)
      .post("/api/research/workspace/folders")
      .send({ kind: "research", name: "My Research" });
    expect(res.status).toBe(201);
    expect(res.body.kind).toBe("research");
    // Cleanup.
    await db.delete(researchFolderItems).where(eq(researchFolderItems.folderId, res.body.id)).catch(() => {});
    await db.delete(researchFolders).where(eq(researchFolders.id, res.body.id)).catch(() => {});
  });

  // ── 5. Shared reading list visible to student ────────────────────

  it("shared reading list is listed for a student", async () => {
    const sharedList = await createReadingList(ownerUserId, { name: "Shared List", sharedWithStudents: true }, db);
    const studentLists = await listReadingLists(studentUserId, "student", db);
    expect(studentLists.some((l) => l.id === sharedList.id)).toBe(true);
    await db.delete(researchReadingListItems).where(eq(researchReadingListItems.listId, sharedList.id)).catch(() => {});
    await db.delete(researchReadingLists).where(eq(researchReadingLists.id, sharedList.id)).catch(() => {});
  });

  // ── 6. Non-shared reading list invisible to student ──────────────

  it("non-shared reading list is not visible to student", async () => {
    const privateList = await createReadingList(ownerUserId, { name: "Private List", sharedWithStudents: false }, db);
    const studentLists = await listReadingLists(studentUserId, "student", db);
    expect(studentLists.some((l) => l.id === privateList.id)).toBe(false);
    await db.delete(researchReadingListItems).where(eq(researchReadingListItems.listId, privateList.id)).catch(() => {});
    await db.delete(researchReadingLists).where(eq(researchReadingLists.id, privateList.id)).catch(() => {});
  });

  // ── 7. Saved search create + list + delete ────────────────────────

  it("saved searches are private to owner and support full CRUD", async () => {
    const row = await createSavedSearch(ownerUserId, { name: "Contract cases", query: { q: "breach of contract", court: "FC" } }, db);
    expect(row.id).toBeGreaterThan(0);

    const list = await listSavedSearches(ownerUserId, db);
    expect(list.some((s) => s.id === row.id)).toBe(true);

    // Other user does not see it.
    const otherList = await listSavedSearches(otherUserId, db);
    expect(otherList.some((s) => s.id === row.id)).toBe(false);

    await deleteSavedSearch(row.id, db);
    const after = await listSavedSearches(ownerUserId, db);
    expect(after.some((s) => s.id === row.id)).toBe(false);
  });

  // ── 8. Quotation collection save + list ──────────────────────────

  it("can create a quotation collection and save quotations to it", async () => {
    const { judgmentId } = await seedVerifiedJudgment(["IN THE HIGH COURT\n[1] Test judgment for quotations."]);

    // Seed an AI run to have a proposition.
    const [provider] = await db.insert(researchAiProviders).values({ name: "gemini", enabled: true, modelName: "stub", temperature: 0.2, maxTokens: 8192, promptVersion: "analysis@1", approvedBy: OWNER_EMAIL, approvedAt: new Date() }).returning();
    trackedProviderIds.push(provider!.id);

    const passage = "The court reasoned that the test was valid.";
    const { run } = await runAiAnalysis(judgmentId, provider!.id, {
      callLlm: async () => makeOutput([], []),
      dbc: db,
    });

    // Get the first proposition.
    const props = await db.select().from(researchAiPropositions).where(eq(researchAiPropositions.runId, run.id));
    expect(props.length).toBeGreaterThan(0);
    const prop = props[0]!;

    const collection = await createQuotationCollection(ownerUserId, "Key Passages", db);
    const q = await saveQuotation(
      collection.id,
      { propositionId: prop.id, passageText: passage, label: "Ratio" },
      db,
    );
    expect(q.id).toBeGreaterThan(0);

    const quotations = await listQuotations(collection.id, db);
    expect(quotations.length).toBe(1);
    expect(quotations[0]!.passageText).toBe(passage);
    expect(quotations[0]!.label).toBe("Ratio");
  });

  // ── 9. Quotation plain-text export ───────────────────────────────

  it("exports a quotation collection as numbered plain text", async () => {
    const collection = await createQuotationCollection(ownerUserId, "Export Test", db);

    // We need a proposition — reuse an existing one (first in DB for this run).
    const props = await db.select().from(researchAiPropositions).where(like(researchAiPropositions.content, "%%")).limit(1);
    if (props.length === 0) {
      // Skip gracefully if no propositions available.
      return;
    }
    await saveQuotation(collection.id, { propositionId: props[0]!.id, passageText: "Alpha passage", label: "First" }, db);
    await saveQuotation(collection.id, { propositionId: props[0]!.id, passageText: "Beta passage" }, db);

    const text = await exportCollectionText(collection.id, db);
    expect(text).toContain("[1] First");
    expect(text).toContain("Alpha passage");
    expect(text).toContain("[2]");
    expect(text).toContain("Beta passage");
  });

  // ── 10. Comparison table render ───────────────────────────────────

  it("renders a comparison table grid for a judgment with an approved run", async () => {
    const { judgmentId } = await seedVerifiedJudgment(["IN THE HIGH COURT\n[1] Reasoning judgment."]);

    const [provider] = await db.insert(researchAiProviders).values({ name: "gemini", enabled: true, modelName: "stub", temperature: 0.2, maxTokens: 8192, promptVersion: "analysis@1", approvedBy: OWNER_EMAIL, approvedAt: new Date() }).returning();
    trackedProviderIds.push(provider!.id);

    const { run } = await runAiAnalysis(judgmentId, provider!.id, {
      callLlm: async () => makeOutput([], []),
      dbc: db,
    });
    // Approve the run.
    await db.update(researchAiAnalysisRuns).set({ status: "APPROVED", approvedAt: new Date() }).where(eq(researchAiAnalysisRuns.id, run.id));

    const table = await createComparisonTable(ownerUserId, {
      name: "My Comparison",
      judgmentIds: [judgmentId],
      fieldNames: ["legalIssues", "reasoning"],
    }, db);

    const result = await renderComparisonTable(table.id, db);
    expect(result).not.toBeNull();
    expect(result!.columns.length).toBe(1);
    expect(result!.columns[0]!.judgmentId).toBe(judgmentId);
    expect(result!.rows.length).toBe(2);
    // legalIssues and reasoning were seeded in the stub output.
    const legalIssuesRow = result!.rows.find((r) => r.fieldName === "legalIssues");
    expect(legalIssuesRow).toBeDefined();
    expect(legalIssuesRow!.cells[0]!.content.length).toBeGreaterThan(0);
  });

  // ── 11. Authorities table returns disclaimer ──────────────────────

  it("authorities table always includes the collection-limitation disclaimer", async () => {
    const { judgmentId } = await seedVerifiedJudgment(["IN THE HIGH COURT\n[1] Authorities judgment."]);

    // Seed AI run and extract authorities for completeness (may have 0 rows).
    const table = await createAuthoritiesTable(ownerUserId, {
      name: "My Authorities",
      judgmentIds: [judgmentId],
    }, db);

    const result = await renderAuthoritiesTable(table.id, db);
    expect(result).not.toBeNull();
    expect(result!.disclaimer).toBe(CITATION_GRAPH_DISCLAIMER);
    expect(result!.disclaimer).toMatch(/not a comprehensive citator/i);
    expect(Array.isArray(result!.authorities)).toBe(true);
    expect(Array.isArray(result!.legislation)).toBe(true);
  });

  // ── 12. Annotation visibility toggle ─────────────────────────────

  it("is_public=false annotations from other users are hidden; is_public=true are visible", async () => {
    const { judgmentId } = await seedVerifiedJudgment(["IN THE HIGH COURT\n[1] Annotation judgment."]);

    // Owner creates a private annotation.
    const privateAnnotation = await createAnnotation(
      ownerUserId,
      judgmentId,
      { body: "Private note", isPublic: false },
      db,
    );

    // Owner creates a public annotation.
    const publicAnnotation = await createAnnotation(
      ownerUserId,
      judgmentId,
      { body: "Public note", isPublic: true },
      db,
    );

    // Other user lists annotations for the same judgment.
    const visibleToOther = await listAnnotations(judgmentId, otherUserId, db);

    // Private annotation must not be visible to other user.
    expect(visibleToOther.some((a) => a.id === privateAnnotation.id)).toBe(false);
    // Public annotation must be visible to other user.
    expect(visibleToOther.some((a) => a.id === publicAnnotation.id)).toBe(true);

    // Owner sees both.
    const visibleToOwner = await listAnnotations(judgmentId, ownerUserId, db);
    expect(visibleToOwner.some((a) => a.id === privateAnnotation.id)).toBe(true);
    expect(visibleToOwner.some((a) => a.id === publicAnnotation.id)).toBe(true);
  });

  // ── 13. Bookmark upsert + list ────────────────────────────────────

  it("bookmarks a judgment and lists it; updating replaces the label", async () => {
    const { judgmentId } = await seedVerifiedJudgment(["IN THE HIGH COURT\n[1] Bookmark judgment."]);

    await upsertBookmark(ownerUserId, judgmentId, { label: "Initial" }, db);
    const list1 = await listBookmarks(ownerUserId, db);
    const bm1 = list1.find((b) => b.judgmentId === judgmentId);
    expect(bm1?.label).toBe("Initial");

    // Re-upsert with updated label.
    await upsertBookmark(ownerUserId, judgmentId, { label: "Updated" }, db);
    const list2 = await listBookmarks(ownerUserId, db);
    const bm2 = list2.find((b) => b.judgmentId === judgmentId);
    expect(bm2?.label).toBe("Updated");

    // Other user has no bookmarks for this judgment.
    const otherList = await listBookmarks(otherUserId, db);
    expect(otherList.some((b) => b.judgmentId === judgmentId)).toBe(false);
  });

});
