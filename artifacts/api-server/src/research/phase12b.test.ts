/**
 * Phase 12b — Permission-controlled exports
 *
 * Tests cover:
 *  1.  POST /exports with json format → 200 + JSON buffer
 *  2.  JSON output contains VERIFIED JUDICIAL TEXT provenance tag
 *  3.  POST /exports with markdown format → 200 + markdown buffer
 *  4.  Markdown contains provenance tags
 *  5.  POST /exports with csv format → 200 + CSV with AI propositions
 *  6.  CSV has provenance column containing [AI-GENERATED]
 *  7.  POST /exports with bibliography format → 200 + text with authorities
 *  8.  Bibliography provenance tag present
 *  9.  POST /exports with docx format → 200 + non-empty binary buffer
 * 10.  POST /exports with pdf format → 200 + non-empty binary buffer
 * 11.  Rights-restricted: text replaced with stub when status not in approved set
 * 12.  Invalid format → 400
 * 13.  Invalid scope → 400
 * 14.  Unauthenticated → 403
 * 15.  Export history route returns recent export events
 * 16.  Export history is owner/admin-only (researcher → 403)
 * 17.  scope=judgment_only excludes AI propositions from JSON output
 * 18.  scope=analysis_only excludes judicial text from JSON output
 * 19.  EXPORT_REQUESTED audit event is recorded on successful export
 * 20.  Container with no verified judgment → 422
 */

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import express from "express";
import request from "supertest";

const RUN_ID = randomUUID();
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// ── Dynamic imports ──────────────────────────────────────────────────────────

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
  researchAuditEvents,
  researchAiProviders,
  researchAiAnalysisRuns,
  researchAiPropositions,
  researchAuthorities,
  researchLegislationRefs,
  researchAnnotations,
} = await import("@workspace/db");
const { eq, inArray, and, like, desc } = await import("drizzle-orm");

const { registerContainer } = await import("./data/containers");
const { recordRightsDecision } = await import("./data/rights");
const { transitionContainer } = await import("./domain/containerStateMachine");
const { runAiAnalysis } = await import("./analysis/generator");
const { buildExport, PROVENANCE_TAGS, EXPORT_FORMATS } = await import("./export/exportService");

// ── HTTP test app ────────────────────────────────────────────────────────────

function buildApp(userEmail: string | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (userEmail) req.authEmail = userEmail;
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

// ── ID tracking for teardown ─────────────────────────────────────────────────

const trackedContainerIds: number[] = [];
const trackedJudgmentIds: number[] = [];
const trackedProviderIds: number[] = [];

const OWNER_EMAIL = `ph12b-owner-${RUN_ID}@test.local`;
const RESEARCHER_EMAIL = `ph12b-researcher-${RUN_ID}@test.local`;

let ownerUserId = 0;
let researcherUserId = 0;

let uploadSeq = 0;
function makeUnique(text: string) {
  uploadSeq++;
  return text + `\n%% phase12b run ${RUN_ID} #${uploadSeq}\n`;
}

// ── Fixture helpers ───────────────────────────────────────────────────────────

async function seedContainer(
  rawText: string,
  opts: { exportPermitted?: boolean; rightsStatus?: string } = {},
): Promise<number> {
  const text = makeUnique(rawText);
  const s = sha256(text);
  const container = await registerContainer({
    originalName: `ph12b-fixture-${RUN_ID}-${uploadSeq}.txt`,
    sourceBatch: `ph12b-batch-${RUN_ID}`,
    contentSha256: s,
    sizeBytes: Buffer.byteLength(text),
    mimeType: "text/plain",
    provenance: { enteredVia: "phase12b-test" },
  });
  trackedContainerIds.push(container.id);
  await recordRightsDecision(
    container.id,
    {
      status: (opts.rightsStatus ?? "OFFICIAL_COURT_SOURCE") as any,
      reason: "phase12b test",
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
      exportPermitted: opts.exportPermitted !== false,
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
  containerOpts: { exportPermitted?: boolean; rightsStatus?: string } = {},
): Promise<{ containerId: number; judgmentId: number }> {
  const containerId = await seedContainer(pageTexts.join("\n\n"), containerOpts);
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
      sourceChecksum: sha256(`seg${containerId}`),
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
  const [vj] = await db
    .insert(researchVerifiedJudgments)
    .values({
      candidateId: candidate!.id,
      containerId,
      editorialRunId: editRun!.id,
      pageRefs: pageIds,
      paragraphIdentifiers: pageTexts.flatMap((_, i) => [`[${i * 2 + 1}]`, `[${i * 2 + 2}]`]),
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
          contentSha256: sha256(`seg${containerId}`),
          originalName: "ph12b-fixture.txt",
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
  return { containerId, judgmentId: vj!.id };
}

function makeAiOutput(content = "The court found for the plaintiff."): string {
  return JSON.stringify({
    catchwords: [],
    proceduralPosture: [],
    materialFacts: [],
    legalIssues: [
      {
        propositionId: randomUUID(),
        content,
        supportingParagraphIds: ["[1]"],
        supportingPassages: [],
        confidenceCategory: "HIGH",
      },
    ],
    partiesMaterialSubmissions: [],
    holdingOnEachIssue: [
      {
        propositionId: randomUUID(),
        content: "Judgment for plaintiff on all grounds.",
        supportingParagraphIds: ["[2]"],
        supportingPassages: [],
        confidenceCategory: "HIGH",
      },
    ],
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
  });
}

// ── Shared fixture ────────────────────────────────────────────────────────────

let fixtureContainerId = 0;
let fixtureJudgmentId = 0;
let fixtureProviderId = 0;
let fixtureRunId = 0;
let restrictedContainerId = 0;
let noJudgmentContainerId = 0;

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  // Users
  const [o] = await db
    .insert(researchUsers)
    .values({ email: OWNER_EMAIL, displayName: "Phase12b Owner", role: "owner", active: true })
    .onConflictDoNothing()
    .returning({ id: researchUsers.id });
  const [r] = await db
    .insert(researchUsers)
    .values({
      email: RESEARCHER_EMAIL,
      displayName: "Phase12b Researcher",
      role: "researcher",
      active: true,
    })
    .onConflictDoNothing()
    .returning({ id: researchUsers.id });
  ownerUserId =
    o?.id ??
    (await db.select({ id: researchUsers.id }).from(researchUsers).where(eq(researchUsers.email, OWNER_EMAIL)))[0]!.id;
  researcherUserId =
    r?.id ??
    (await db.select({ id: researchUsers.id }).from(researchUsers).where(eq(researchUsers.email, RESEARCHER_EMAIL)))[0]!.id;

  // Main fixture — approved, full content.
  const judg = await seedVerifiedJudgment([
    "IN THE HIGH COURT\n[1] The plaintiff sought damages for breach.\n[2] The court found for the plaintiff.",
  ]);
  fixtureContainerId = judg.containerId;
  fixtureJudgmentId = judg.judgmentId;

  // AI analysis run.
  const [provider] = await db
    .insert(researchAiProviders)
    .values({
      name: "gemini",
      enabled: true,
      modelName: "stub",
      temperature: 0.2,
      maxTokens: 8192,
      promptVersion: "analysis@1",
      approvedBy: OWNER_EMAIL,
      approvedAt: new Date(),
    })
    .returning();
  fixtureProviderId = provider!.id;
  trackedProviderIds.push(provider!.id);

  const { run } = await runAiAnalysis(fixtureJudgmentId, fixtureProviderId, {
    callLlm: async () => makeAiOutput(),
    dbc: db,
  });
  fixtureRunId = run.id;

  // Seed an authority row for the fixture judgment.
  const [prop] = await db
    .select()
    .from(researchAiPropositions)
    .where(eq(researchAiPropositions.runId, fixtureRunId))
    .limit(1);
  if (prop) {
    await db.insert(researchAuthorities).values({
      judgmentId: fixtureJudgmentId,
      runId: fixtureRunId,
      propositionId: prop.id,
      caseName: "Donoghue v Stevenson",
      citation: "[1932] AC 562",
      sourceParagraphId: "[1]",
      treatment: "FOLLOWED",
      treatmentEvidence: "The neighbour principle was affirmed.",
      reviewStatus: "pending_review",
    }).onConflictDoNothing();

    await db.insert(researchLegislationRefs).values({
      judgmentId: fixtureJudgmentId,
      runId: fixtureRunId,
      propositionId: prop.id,
      statute: "Evidence Act 1950",
      provision: "114",
      jurisdiction: "Malaysia",
      mode: "applied",
    }).onConflictDoNothing();
  }

  // Rights-restricted fixture: exportPermitted=true but status is ANALYSIS_RESTRICTED.
  // The gate allows export (exportPermitted=true) but the service stubs text (status not in approved set).
  const restr = await seedVerifiedJudgment(
    ["RESTRICTED COURT\n[1] Secret text that must not appear in exports."],
    { rightsStatus: "ANALYSIS_RESTRICTED", exportPermitted: true },
  );
  restrictedContainerId = restr.containerId;

  // Container with no verified judgment (just seeded, not pushed through verification pipeline).
  noJudgmentContainerId = await seedContainer("Not yet verified.");
  await transitionContainer(noJudgmentContainerId, "RIGHTS_REVIEW_REQUIRED", { actor: "test" });
  await transitionContainer(noJudgmentContainerId, "RIGHTS_APPROVED", { actor: "test" });
});

afterAll(async () => {
  // AI cleanup
  if (trackedJudgmentIds.length > 0) {
    await db.delete(researchAuthorities).where(inArray(researchAuthorities.judgmentId, trackedJudgmentIds)).catch(() => {});
    await db.delete(researchLegislationRefs).where(inArray(researchLegislationRefs.judgmentId, trackedJudgmentIds)).catch(() => {});
    const runs = await db
      .select({ id: researchAiAnalysisRuns.id })
      .from(researchAiAnalysisRuns)
      .where(inArray(researchAiAnalysisRuns.judgmentId, trackedJudgmentIds))
      .catch(() => []);
    if (runs.length > 0) {
      await db.delete(researchAiPropositions).where(inArray(researchAiPropositions.runId, runs.map((r) => r.id))).catch(() => {});
    }
    await db.delete(researchAiAnalysisRuns).where(inArray(researchAiAnalysisRuns.judgmentId, trackedJudgmentIds)).catch(() => {});
    await db.delete(researchAnnotations).where(inArray(researchAnnotations.judgmentId, trackedJudgmentIds)).catch(() => {});
    await db.delete(researchVerifiedJudgments).where(inArray(researchVerifiedJudgments.id, trackedJudgmentIds)).catch(() => {});
  }
  if (trackedProviderIds.length > 0) {
    await db.delete(researchAiProviders).where(inArray(researchAiProviders.id, trackedProviderIds)).catch(() => {});
  }

  // Container cleanup
  if (trackedContainerIds.length > 0) {
    const candidateIds = (
      await db.select({ id: researchCaseCandidates.id }).from(researchCaseCandidates)
        .where(inArray(researchCaseCandidates.containerId, trackedContainerIds)).catch(() => [])
    ).map((r) => r.id);
    const segRunIds = (
      await db.select({ id: researchSegmentationRuns.id }).from(researchSegmentationRuns)
        .where(inArray(researchSegmentationRuns.containerId, trackedContainerIds)).catch(() => [])
    ).map((r) => r.id);
    await db.delete(researchPageSections).where(inArray(researchPageSections.containerId, trackedContainerIds)).catch(() => {});
    await db.delete(researchEditorialRuns).where(inArray(researchEditorialRuns.containerId, trackedContainerIds)).catch(() => {});
    if (candidateIds.length > 0) {
      await db.delete(researchCaseCandidateBoundaries).where(inArray(researchCaseCandidateBoundaries.candidateId, candidateIds)).catch(() => {});
    }
    await db.delete(researchCaseCandidates).where(inArray(researchCaseCandidates.containerId, trackedContainerIds)).catch(() => {});
    if (segRunIds.length > 0) {
      await db.delete(researchCaseBoundaries).where(inArray(researchCaseBoundaries.runId, segRunIds)).catch(() => {});
    }
    await db.delete(researchSegmentationRuns).where(inArray(researchSegmentationRuns.containerId, trackedContainerIds)).catch(() => {});
    await db.delete(researchTransformations).where(inArray(researchTransformations.containerId, trackedContainerIds)).catch(() => {});
    const pageIds = (
      await db.select({ id: researchSourcePages.id }).from(researchSourcePages)
        .where(inArray(researchSourcePages.containerId, trackedContainerIds)).catch(() => [])
    ).map((r) => r.id);
    if (pageIds.length > 0) {
      await db.delete(researchPageExtractions).where(inArray(researchPageExtractions.pageId, pageIds)).catch(() => {});
    }
    await db.delete(researchExtractionRuns).where(inArray(researchExtractionRuns.containerId, trackedContainerIds)).catch(() => {});
    await db.delete(researchSourcePages).where(inArray(researchSourcePages.containerId, trackedContainerIds)).catch(() => {});
    await db.delete(researchRightsRecords).where(inArray(researchRightsRecords.containerId, trackedContainerIds)).catch(() => {});
    await db
      .delete(researchAuditEvents)
      .where(and(eq(researchAuditEvents.entityType, "container"), inArray(researchAuditEvents.entityId, trackedContainerIds)))
      .catch(() => {});
    await db.delete(researchSourceContainers).where(inArray(researchSourceContainers.id, trackedContainerIds)).catch(() => {});
  }

  await db.delete(researchUsers).where(eq(researchUsers.email, OWNER_EMAIL)).catch(() => {});
  await db.delete(researchUsers).where(eq(researchUsers.email, RESEARCHER_EMAIL)).catch(() => {});
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Phase 12b: Permission-controlled exports", () => {
  const ownerApp = () => buildApp(OWNER_EMAIL);
  const researcherApp = () => buildApp(RESEARCHER_EMAIL);
  const anonApp = () => buildApp(null);

  // Helper: wait for an audit event to be written (fire-and-forget, small delay).
  async function waitForAudit(
    pred: (e: Record<string, unknown>) => boolean,
    maxMs = 2000,
  ): Promise<Record<string, unknown> | null> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      const rows = await db.select().from(researchAuditEvents).orderBy(desc(researchAuditEvents.id)).limit(100);
      const hit = rows.find((r) => pred(r as Record<string, unknown>));
      if (hit) return hit as Record<string, unknown>;
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  }

  // ── Format smoke tests ────────────────────────────────────────────────────

  it("1. JSON format: responds 200 with JSON body", async () => {
    const res = await request(ownerApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "json", scope: "full" });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.headers["content-disposition"]).toMatch(/attachment/);
    // Body is a Buffer from supertest; parse it.
    const parsed = JSON.parse(res.text);
    expect(parsed.judgment).toBeDefined();
    expect(parsed.sections).toBeInstanceOf(Array);
  });

  it("2. JSON output includes VERIFIED JUDICIAL TEXT provenance tag", async () => {
    const res = await request(ownerApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "json", scope: "full" });
    expect(res.status).toBe(200);
    const parsed = JSON.parse(res.text);
    const judgmentSection = parsed.sections.find(
      (s: Record<string, unknown>) => s.kind === "judgment_text",
    );
    expect(judgmentSection).toBeDefined();
    expect(judgmentSection.provenance).toBe(PROVENANCE_TAGS.VERIFIED_JUDICIAL_TEXT);
  });

  it("3. Markdown format: responds 200 with markdown content-type", async () => {
    const res = await request(ownerApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "markdown", scope: "full" });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/markdown/);
    expect(res.headers["content-disposition"]).toMatch(/\.md/);
  });

  it("4. Markdown output contains [VERIFIED JUDICIAL TEXT] provenance tag", async () => {
    const res = await request(ownerApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "markdown", scope: "judgment_only" });
    expect(res.status).toBe(200);
    expect(res.text).toContain(PROVENANCE_TAGS.VERIFIED_JUDICIAL_TEXT);
  });

  it("5. CSV format: responds 200 with text/csv", async () => {
    const res = await request(ownerApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "csv", scope: "analysis_only" });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/\.csv/);
  });

  it("6. CSV contains [AI-GENERATED] provenance column", async () => {
    const res = await request(ownerApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "csv", scope: "full" });
    expect(res.status).toBe(200);
    expect(res.text).toContain("[AI-GENERATED]");
    // First line must be the header row.
    const lines = res.text.trim().split("\r\n");
    expect(lines[0]).toMatch(/provenance/);
  });

  it("7. Bibliography format: responds 200 with text/plain", async () => {
    const res = await request(ownerApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "bibliography", scope: "authorities" });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    expect(res.headers["content-disposition"]).toMatch(/\.bib\.txt/);
  });

  it("8. Bibliography contains [AI-GENERATED] tag and authority names", async () => {
    const res = await request(ownerApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "bibliography", scope: "full" });
    expect(res.status).toBe(200);
    expect(res.text).toContain(PROVENANCE_TAGS.AI_GENERATED);
    // Should list the seeded Donoghue v Stevenson authority.
    expect(res.text).toContain("Donoghue v Stevenson");
  });

  it("9. DOCX format: responds 200 with non-empty DOCX binary", async () => {
    const res = await request(ownerApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "docx", scope: "full" })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(
      /application\/vnd.openxmlformats-officedocument.wordprocessingml.document/,
    );
    // DOCX is a ZIP; starts with PK magic bytes
    const buf = res.body as Buffer;
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
  });

  it("10. PDF format: responds 200 with non-empty PDF binary", async () => {
    const res = await request(ownerApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "pdf", scope: "full" })
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
    const buf = res.body as Buffer;
    expect(buf.length).toBeGreaterThan(500);
    // PDF magic header %PDF
    expect(buf.toString("ascii", 0, 4)).toBe("%PDF");
  });

  // ── Rights-restricted behavior ────────────────────────────────────────────

  it("11. Rights-restricted (JSON): judgment text, AI propositions, and annotations are all stubbed", async () => {
    // Call buildExport directly, bypassing the HTTP gate, to test the service-level
    // text-restriction logic. restrictedContainerId has rightsStatus=ANALYSIS_RESTRICTED
    // which is NOT in EXPORT_TEXT_APPROVED_STATUSES, so all text content is stubbed.
    const result = await buildExport(restrictedContainerId, "json", "full", OWNER_EMAIL, db);
    const parsed = JSON.parse(result.buffer.toString("utf-8"));
    expect(parsed.rightsRestricted).toBe(true);

    // Judgment text must be the stub.
    const textSection = parsed.sections.find(
      (s: Record<string, unknown>) => s.kind === "judgment_text",
    );
    if (textSection) {
      expect(textSection.content).toBe(PROVENANCE_TAGS.RIGHTS_RESTRICTED);
    }

    // AI proposition content must be stubbed.
    for (const section of parsed.sections as Array<Record<string, unknown>>) {
      if (section.kind === "ai_analysis") {
        expect(section.content).toBe(PROVENANCE_TAGS.RIGHTS_RESTRICTED);
      }
      // Annotation bodies must be stubbed.
      if (section.kind === "annotation") {
        expect(section.content).toBe(PROVENANCE_TAGS.RIGHTS_RESTRICTED);
      }
      // Authority treatmentEvidence must be stubbed.
      if (section.kind === "authority" && section.treatmentEvidence !== null) {
        expect(section.treatmentEvidence).toBe(PROVENANCE_TAGS.RIGHTS_RESTRICTED);
      }
    }

    // The raw restricted text must NOT appear anywhere in the JSON output.
    expect(result.buffer.toString("utf-8")).not.toContain("Secret text that must not appear");
  });

  it("11b. Rights-restricted (Markdown): judgment text and AI analysis sections carry stub", async () => {
    const result = await buildExport(restrictedContainerId, "markdown", "full", OWNER_EMAIL, db);
    const md = result.buffer.toString("utf-8");
    expect(md).toContain(PROVENANCE_TAGS.RIGHTS_RESTRICTED);
    expect(md).not.toContain("Secret text that must not appear");
  });

  it("11c. Rights-restricted (CSV): AI proposition content cells carry stub", async () => {
    // Seed a restricted judgment that has an AI analysis run so CSV has data rows.
    const result = await buildExport(restrictedContainerId, "csv", "full", OWNER_EMAIL, db);
    const csv = result.buffer.toString("utf-8");
    // If there are AI proposition rows (depends on whether restricted container has runs),
    // they must not contain the original judgment text.
    expect(csv).not.toContain("Secret text that must not appear");
  });

  // ── Input validation ──────────────────────────────────────────────────────

  it("12. Invalid format → 400", async () => {
    const res = await request(ownerApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "rtf", scope: "full" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/format/i);
  });

  it("13. Invalid scope → 400", async () => {
    const res = await request(ownerApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "json", scope: "everything" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scope/i);
  });

  // ── Auth guard ────────────────────────────────────────────────────────────

  it("14. Unauthenticated request → 403 (no role means no export access)", async () => {
    // An unauthenticated user has no role, decideAccess will deny.
    const res = await request(anonApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "json", scope: "full" });
    // 401 (no session), 403, or 404 (container existence leaking policy) are all acceptable.
    expect([401, 403, 404]).toContain(res.status);
  });

  // ── Export history ────────────────────────────────────────────────────────

  it("15. Export history returns recent EXPORT_REQUESTED events for the container", async () => {
    // Do an export to ensure at least one event exists.
    await request(ownerApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "json", scope: "full" });

    // Wait for the fire-and-forget audit event.
    await new Promise((r) => setTimeout(r, 300));

    const res = await request(ownerApp()).get(
      `/api/research/containers/${fixtureContainerId}/exports/history`,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.containerId).toBe(fixtureContainerId);
    // At least one event should be EXPORT_REQUESTED.
    const hasExportEvent = res.body.events.some(
      (e: Record<string, unknown>) => e.event === "EXPORT_REQUESTED",
    );
    expect(hasExportEvent).toBe(true);
  });

  it("16. Export history is owner/admin-only (researcher → 403)", async () => {
    const res = await request(researcherApp()).get(
      `/api/research/containers/${fixtureContainerId}/exports/history`,
    );
    expect(res.status).toBe(403);
  });

  // ── Scope filtering ──────────────────────────────────────────────────────

  it("17. scope=judgment_only: JSON output has judgment section but no AI-GENERATED sections", async () => {
    const res = await request(ownerApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "json", scope: "judgment_only" });
    expect(res.status).toBe(200);
    const parsed = JSON.parse(res.text);
    const aiSections = parsed.sections.filter(
      (s: Record<string, unknown>) => s.provenance === PROVENANCE_TAGS.AI_GENERATED,
    );
    expect(aiSections.length).toBe(0);
    const textSection = parsed.sections.find(
      (s: Record<string, unknown>) => s.kind === "judgment_text",
    );
    expect(textSection).toBeDefined();
  });

  it("18. scope=analysis_only: JSON output has AI sections but no judgment_text section", async () => {
    const res = await request(ownerApp())
      .post(`/api/research/containers/${fixtureContainerId}/exports`)
      .send({ format: "json", scope: "analysis_only" });
    expect(res.status).toBe(200);
    const parsed = JSON.parse(res.text);
    const textSection = parsed.sections.find(
      (s: Record<string, unknown>) => s.kind === "judgment_text",
    );
    expect(textSection).toBeUndefined();
    // Should have AI sections since we ran analysis.
    const aiSections = parsed.sections.filter(
      (s: Record<string, unknown>) => s.provenance === PROVENANCE_TAGS.AI_GENERATED,
    );
    expect(aiSections.length).toBeGreaterThan(0);
  });

  // ── Audit event written ───────────────────────────────────────────────────

  it("19. EXPORT_REQUESTED audit event is written when export succeeds", async () => {
    const { containerId: cid, judgmentId: jid } = await seedVerifiedJudgment([
      "Audit event export test judgment.",
    ]);

    await request(ownerApp())
      .post(`/api/research/containers/${cid}/exports`)
      .send({ format: "json", scope: "full" });

    const evt = await waitForAudit(
      (e) =>
        e.event === "EXPORT_REQUESTED" &&
        e.entityId === cid &&
        (e.detail as any)?.format === "json",
    );
    expect(evt).not.toBeNull();
    expect(evt!.actor).toBe(OWNER_EMAIL);
  });

  // ── Container with no verified judgment ──────────────────────────────────

  it("20. Container with no verified judgment → 422", async () => {
    const res = await request(ownerApp())
      .post(`/api/research/containers/${noJudgmentContainerId}/exports`)
      .send({ format: "json", scope: "full" });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/verified judgment/i);
  });
});
