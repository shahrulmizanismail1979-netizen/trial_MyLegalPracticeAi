import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import express from "express";
import request from "supertest";

// Phase 12a: Audit Event Coverage tests.
//
// Tests verify:
//   1.  sanitiseForAudit strips string values > 500 chars
//   2.  sanitiseForAudit preserves short strings
//   3.  sanitiseForAudit handles nested objects recursively
//   4.  sanitiseForAudit handles arrays
//   5.  sanitiseForAudit preserves non-string values unchanged
//   6.  DOCUMENT_ACCESSED event emitted on GET /judgments/:id
//   7.  SEARCH_EXECUTED event emitted on GET /search
//   8.  QUOTATION_CREATED event emitted on quotation save
//   9.  EXPORT_REQUESTED event emitted on POST /containers/:id/exports
//  10.  ADMIN_ACTION event emitted on rights decision
//  11.  AI_ANALYSIS_REQUESTED event emitted on analysis run
//  12.  AI_PROVIDER_USED event emitted on analysis run
//  13.  ACCESS_DENIED event emitted on forbidden container access
//  14.  Admin audit-events route returns events, owner-only (non-owner gets 403)
//  15.  Admin audit-events route filters by action
//  16.  Admin audit-events route filters by entityId
//  17.  Judgment text is absent from all logged event metadata (text-leak guard)
//  18.  Long passage text in QUOTATION_CREATED detail is redacted in the audit log

const RUN_ID = randomUUID();
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// ── Dynamic imports ─────────────────────────────────────────────────────────

const { sanitiseForAudit, AUDIT_MAX_STRING_LENGTH, AuditAction } = await import(
  "./domain/auditEvents"
);

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
  researchQuotationCollections,
  researchWorkspaceQuotations,
} = await import("@workspace/db");
const { eq, inArray, and, like, desc } = await import("drizzle-orm");

const { registerContainer } = await import("./data/containers");
const { recordRightsDecision } = await import("./data/rights");
const { transitionContainer } = await import("./domain/containerStateMachine");
const { runAiAnalysis } = await import("./analysis/generator");

// ── IDs for teardown ────────────────────────────────────────────────────────

const trackedContainerIds: number[] = [];
const trackedJudgmentIds: number[] = [];
const trackedProviderIds: number[] = [];

const OWNER_EMAIL = `ph12a-owner-${RUN_ID}@test.local`;
const RESEARCHER_EMAIL = `ph12a-researcher-${RUN_ID}@test.local`;

let ownerUserId = 0;
let researcherUserId = 0;

let uploadSeq = 0;
function makeUnique(text: string) {
  uploadSeq++;
  return text + `\n%% phase12a run ${RUN_ID} #${uploadSeq}\n`;
}

// ── HTTP test app ───────────────────────────────────────────────────────────

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

// ── Fixture helpers ─────────────────────────────────────────────────────────

async function seedContainer(rawText: string): Promise<number> {
  const text = makeUnique(rawText);
  const s = sha256(text);
  const container = await registerContainer({
    originalName: `ph12a-fixture-${RUN_ID}-${uploadSeq}.txt`,
    sourceBatch: `ph12a-batch-${RUN_ID}`,
    contentSha256: s,
    sizeBytes: Buffer.byteLength(text),
    mimeType: "text/plain",
    provenance: { enteredVia: "phase12a-test" },
  });
  trackedContainerIds.push(container.id);
  await recordRightsDecision(
    container.id,
    {
      status: "OFFICIAL_COURT_SOURCE",
      reason: "phase12a test",
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
          originalName: "ph12a-fixture.txt",
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

function makeAiOutput(): string {
  return JSON.stringify({
    catchwords: [],
    proceduralPosture: [],
    materialFacts: [],
    legalIssues: [
      {
        propositionId: randomUUID(),
        content: "Was the test valid?",
        supportingParagraphIds: ["[1]"],
        supportingPassages: ["Was the test valid?"],
        confidenceCategory: "HIGH",
      },
    ],
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
  });
}

// ── Wait helper for fire-and-forget audit events ────────────────────────────

/** Polls for a matching audit event row, retrying up to `maxMs` ms. */
async function waitForAuditEvent(
  predicate: (e: Record<string, unknown>) => boolean,
  maxMs = 3000,
): Promise<Record<string, unknown> | null> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const rows = await db
      .select()
      .from(researchAuditEvents)
      .orderBy(desc(researchAuditEvents.id))
      .limit(100);
    const match = rows.find((r) => predicate(r as Record<string, unknown>));
    if (match) return match as Record<string, unknown>;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

// ── Setup / teardown ────────────────────────────────────────────────────────

beforeAll(async () => {
  const [o] = await db
    .insert(researchUsers)
    .values({ email: OWNER_EMAIL, displayName: "Phase12a Owner", role: "owner", active: true })
    .onConflictDoNothing()
    .returning({ id: researchUsers.id });
  const [r] = await db
    .insert(researchUsers)
    .values({
      email: RESEARCHER_EMAIL,
      displayName: "Phase12a Researcher",
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
});

afterAll(async () => {
  // Workspace tables
  if (ownerUserId) {
    const collIds = (
      await db
        .select({ id: researchQuotationCollections.id })
        .from(researchQuotationCollections)
        .where(eq(researchQuotationCollections.ownerId, ownerUserId))
        .catch(() => [])
    ).map((r) => r.id);
    if (collIds.length > 0) {
      await db.delete(researchWorkspaceQuotations).where(inArray(researchWorkspaceQuotations.collectionId, collIds)).catch(() => {});
      await db.delete(researchQuotationCollections).where(inArray(researchQuotationCollections.id, collIds)).catch(() => {});
    }
  }

  // AI tables
  if (trackedJudgmentIds.length > 0) {
    const runs = await db
      .select({ id: researchAiAnalysisRuns.id })
      .from(researchAiAnalysisRuns)
      .where(inArray(researchAiAnalysisRuns.judgmentId, trackedJudgmentIds))
      .catch(() => []);
    if (runs.length > 0) {
      await db.delete(researchAiPropositions).where(inArray(researchAiPropositions.runId, runs.map((r) => r.id))).catch(() => {});
    }
    await db.delete(researchAiAnalysisRuns).where(inArray(researchAiAnalysisRuns.judgmentId, trackedJudgmentIds)).catch(() => {});
    await db.delete(researchVerifiedJudgments).where(inArray(researchVerifiedJudgments.id, trackedJudgmentIds)).catch(() => {});
  }
  if (trackedProviderIds.length > 0) {
    await db.delete(researchAiProviders).where(inArray(researchAiProviders.id, trackedProviderIds)).catch(() => {});
  }

  // Container cleanup
  if (trackedContainerIds.length > 0) {
    const candidateIds = (
      await db
        .select({ id: researchCaseCandidates.id })
        .from(researchCaseCandidates)
        .where(inArray(researchCaseCandidates.containerId, trackedContainerIds))
        .catch(() => [])
    ).map((r) => r.id);
    const segRunIds = (
      await db
        .select({ id: researchSegmentationRuns.id })
        .from(researchSegmentationRuns)
        .where(inArray(researchSegmentationRuns.containerId, trackedContainerIds))
        .catch(() => [])
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
      await db
        .select({ id: researchSourcePages.id })
        .from(researchSourcePages)
        .where(inArray(researchSourcePages.containerId, trackedContainerIds))
        .catch(() => [])
    ).map((r) => r.id);
    if (pageIds.length > 0) {
      await db.delete(researchPageExtractions).where(inArray(researchPageExtractions.pageId, pageIds)).catch(() => {});
    }
    await db.delete(researchExtractionRuns).where(inArray(researchExtractionRuns.containerId, trackedContainerIds)).catch(() => {});
    await db.delete(researchSourcePages).where(inArray(researchSourcePages.containerId, trackedContainerIds)).catch(() => {});
    await db.delete(researchRightsRecords).where(inArray(researchRightsRecords.containerId, trackedContainerIds)).catch(() => {});
    const jobsToDelete = await db
      .select({ id: researchJobs.id })
      .from(researchJobs)
      .where(like(researchJobs.idempotencyKey, `%${RUN_ID.slice(0, 8)}%`))
      .catch(() => []);
    if (jobsToDelete.length > 0) {
      await db.delete(researchJobs).where(inArray(researchJobs.id, jobsToDelete.map((j) => j.id))).catch(() => {});
    }
    // Audit events for tracked containers / judgments (clean up test noise)
    await db
      .delete(researchAuditEvents)
      .where(
        and(
          eq(researchAuditEvents.entityType, "container"),
          inArray(researchAuditEvents.entityId, trackedContainerIds),
        ),
      )
      .catch(() => {});
    if (trackedJudgmentIds.length > 0) {
      await db
        .delete(researchAuditEvents)
        .where(
          and(
            eq(researchAuditEvents.entityType, "judgment"),
            inArray(researchAuditEvents.entityId, trackedJudgmentIds),
          ),
        )
        .catch(() => {});
    }
    if (trackedProviderIds.length > 0) {
      await db
        .delete(researchAuditEvents)
        .where(
          and(
            eq(researchAuditEvents.entityType, "ai_provider"),
            inArray(researchAuditEvents.entityId, trackedProviderIds),
          ),
        )
        .catch(() => {});
    }
    await db.delete(researchSourceContainers).where(inArray(researchSourceContainers.id, trackedContainerIds)).catch(() => {});
  }

  await db.delete(researchUsers).where(eq(researchUsers.email, OWNER_EMAIL)).catch(() => {});
  await db.delete(researchUsers).where(eq(researchUsers.email, RESEARCHER_EMAIL)).catch(() => {});
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Phase 12a: Audit Event Coverage", () => {

  // ── 1–5. sanitiseForAudit unit tests (pure function) ──────────────────

  it("1. sanitiseForAudit: replaces long strings with a redacted placeholder", () => {
    const longStr = "x".repeat(AUDIT_MAX_STRING_LENGTH + 1);
    const result = sanitiseForAudit({ body: longStr });
    expect(result.body).toMatch(/^\[REDACTED:/);
    expect(result.body).not.toContain("x");
  });

  it("2. sanitiseForAudit: preserves strings within the limit", () => {
    const shortStr = "short";
    const result = sanitiseForAudit({ body: shortStr });
    expect(result.body).toBe("short");
  });

  it("3. sanitiseForAudit: recurses into nested objects", () => {
    const longStr = "y".repeat(AUDIT_MAX_STRING_LENGTH + 1);
    const result = sanitiseForAudit({ outer: { inner: longStr, safe: "ok" } });
    expect(result.outer.inner).toMatch(/^\[REDACTED:/);
    expect(result.outer.safe).toBe("ok");
  });

  it("4. sanitiseForAudit: recurses into arrays", () => {
    const longStr = "z".repeat(AUDIT_MAX_STRING_LENGTH + 1);
    const result = sanitiseForAudit({ items: [longStr, "fine"] });
    expect(result.items[0]).toMatch(/^\[REDACTED:/);
    expect(result.items[1]).toBe("fine");
  });

  it("5. sanitiseForAudit: preserves non-string values (number, boolean, null)", () => {
    const result = sanitiseForAudit({ n: 42, b: true, nul: null, u: undefined });
    expect(result.n).toBe(42);
    expect(result.b).toBe(true);
    expect(result.nul).toBeNull();
    expect(result.u).toBeUndefined();
  });

  // ── 6. DOCUMENT_ACCESSED ──────────────────────────────────────────────

  it("6. DOCUMENT_ACCESSED event is emitted when a judgment is fetched", async () => {
    const { judgmentId } = await seedVerifiedJudgment([
      "IN THE HIGH COURT\n[1] Was the test valid?\n[2] The court reasoned that the test was valid.",
    ]);

    const ownerApp = buildApp(OWNER_EMAIL);
    const res = await request(ownerApp).get(`/api/research/judgments/${judgmentId}`);
    expect(res.status).toBe(200);

    const event = await waitForAuditEvent(
      (e) => e.event === AuditAction.DOCUMENT_ACCESSED && e.entityId === judgmentId,
    );
    expect(event).not.toBeNull();
    expect(event!.entityType).toBe("judgment");
    expect(event!.actor).toBe(OWNER_EMAIL);
    // Verify the detail does NOT contain long strings (judgment text guard).
    const detailStr = JSON.stringify(event!.detail);
    expect(detailStr.length).toBeLessThan(1000);
  });

  // ── 7. SEARCH_EXECUTED ────────────────────────────────────────────────

  it("7. SEARCH_EXECUTED event is emitted on a search query", async () => {
    const ownerApp = buildApp(OWNER_EMAIL);
    const res = await request(ownerApp).get("/api/research/search?q=valid+test");
    expect(res.status).toBe(200);

    const event = await waitForAuditEvent(
      (e) => e.event === AuditAction.SEARCH_EXECUTED && (e.detail as any)?.q === "valid test",
    );
    expect(event).not.toBeNull();
    expect(event!.actor).toBe(OWNER_EMAIL);
    // Query string is audited; result text is not.
    const detail = event!.detail as Record<string, unknown>;
    expect(typeof detail.resultCount).toBe("number");
    expect(detail.q).toBe("valid test");
  });

  // ── 8. QUOTATION_CREATED ──────────────────────────────────────────────

  it("8. QUOTATION_CREATED event is emitted when a quotation is saved", async () => {
    const { judgmentId } = await seedVerifiedJudgment(["IN THE HIGH COURT\n[1] Quotation test."]);

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
    trackedProviderIds.push(provider!.id);

    const { run } = await runAiAnalysis(judgmentId, provider!.id, {
      callLlm: async () => makeAiOutput(),
      dbc: db,
    });

    const props = await db.select().from(researchAiPropositions).where(eq(researchAiPropositions.runId, run.id));
    expect(props.length).toBeGreaterThan(0);

    // Create a collection and save a quotation via API.
    const [coll] = await db
      .insert(researchQuotationCollections)
      .values({ ownerId: ownerUserId, name: `Test Collection ${RUN_ID}` })
      .returning();

    const ownerApp = buildApp(OWNER_EMAIL);
    const res = await request(ownerApp)
      .post(`/api/research/workspace/quotation-collections/${coll!.id}/quotations`)
      .send({ propositionId: props[0]!.id, passageText: "Was the test valid?", label: "Issue" });
    expect(res.status).toBe(201);

    const quotationId = res.body.id as number;
    const event = await waitForAuditEvent(
      (e) => e.event === AuditAction.QUOTATION_CREATED && e.entityId === quotationId,
    );
    expect(event).not.toBeNull();
    expect(event!.actor).toBe(OWNER_EMAIL);
  });

  // ── 9. EXPORT_REQUESTED ──────────────────────────────────────────────

  it("9. EXPORT_REQUESTED event is emitted on export gate pass", async () => {
    const containerId = await seedContainer("Export test document.");
    await transitionContainer(containerId, "RIGHTS_REVIEW_REQUIRED", { actor: "test" });
    await transitionContainer(containerId, "RIGHTS_APPROVED", { actor: "test" });

    const ownerApp = buildApp(OWNER_EMAIL);
    const res = await request(ownerApp)
      .post(`/api/research/containers/${containerId}/exports`)
      .send({ format: "pdf", scope: "full" });
    expect(res.status).toBe(200);
    expect(res.body.gate).toBe("passed");

    const event = await waitForAuditEvent(
      (e) =>
        e.event === AuditAction.EXPORT_REQUESTED &&
        e.entityId === containerId &&
        (e.detail as any)?.format === "pdf",
    );
    expect(event).not.toBeNull();
    expect(event!.actor).toBe(OWNER_EMAIL);
  });

  // ── 10. ADMIN_ACTION ────────────────────────────────────────────────

  it("10. ADMIN_ACTION event is emitted when a rights decision is recorded", async () => {
    const containerId = await seedContainer("Admin action test.");
    const ownerApp = buildApp(OWNER_EMAIL);
    const res = await request(ownerApp)
      .post(`/api/research/containers/${containerId}/rights-decision`)
      .send({
        status: "OFFICIAL_COURT_SOURCE",
        reason: "phase12a admin test",
        source: "Test Source",
        dateObtained: "2026-01-01T00:00:00Z",
        declaredSourceType: "official_court",
        licenceReference: null,
        approvedUsers: [],
        approvedPurposes: ["research"],
        storagePermitted: true,
        analysisPermitted: true,
        externalProcessingPermitted: false,
        studentAccessPermitted: false,
        printingPermitted: false,
        exportPermitted: false,
        retentionPeriod: null,
        expiryDate: null,
        reviewer: OWNER_EMAIL,
        reviewDate: "2026-01-01T00:00:00Z",
        notes: null,
      });
    expect(res.status).toBe(201);

    const event = await waitForAuditEvent(
      (e) =>
        e.event === AuditAction.ADMIN_ACTION &&
        e.entityId === containerId &&
        (e.detail as any)?.adminAction === "rights_decision",
    );
    expect(event).not.toBeNull();
    expect(event!.actor).toBe(OWNER_EMAIL);
  });

  // ── 11–12. AI events ──────────────────────────────────────────────────

  it("11–12. AI_ANALYSIS_REQUESTED and AI_PROVIDER_USED events are emitted on analysis run", async () => {
    const { judgmentId } = await seedVerifiedJudgment(["IN THE HIGH COURT\n[1] AI audit test."]);

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
    trackedProviderIds.push(provider!.id);

    await runAiAnalysis(judgmentId, provider!.id, {
      callLlm: async () => makeAiOutput(),
      dbc: db,
    });

    // Both events are fire-and-forget; wait for them.
    const requestedEvent = await waitForAuditEvent(
      (e) =>
        e.event === AuditAction.AI_ANALYSIS_REQUESTED &&
        e.entityId === judgmentId &&
        (e.detail as any)?.providerId === provider!.id,
    );
    expect(requestedEvent).not.toBeNull();

    const usedEvent = await waitForAuditEvent(
      (e) =>
        e.event === AuditAction.AI_PROVIDER_USED &&
        e.entityId === provider!.id &&
        (e.detail as any)?.judgmentId === judgmentId,
    );
    expect(usedEvent).not.toBeNull();
  });

  // ── 13. ACCESS_DENIED ────────────────────────────────────────────────

  it("13. ACCESS_DENIED event is emitted when a researcher accesses a quarantined container", async () => {
    // Register a new container without any rights approval (UNREVIEWED state) and quarantine it.
    const containerId = await seedContainer("Quarantine access denied test.");
    await transitionContainer(containerId, "QUARANTINED", { actor: "test" });

    const researcherApp = buildApp(RESEARCHER_EMAIL);
    const res = await request(researcherApp).get(`/api/research/containers/${containerId}`);
    // Non-leak: looks like 404 to the researcher.
    expect(res.status).toBe(404);

    const event = await waitForAuditEvent(
      (e) =>
        e.event === AuditAction.ACCESS_DENIED &&
        e.entityId === containerId &&
        e.actor === RESEARCHER_EMAIL,
    );
    expect(event).not.toBeNull();
    // Metadata must contain the action and reason, not judgment text.
    const detail = event!.detail as Record<string, unknown>;
    expect(detail.action).toBe("view");
    expect(typeof detail.reason).toBe("string");
  });

  // ── 14. Admin audit-events route ─────────────────────────────────────

  it("14. Admin audit-events route requires owner/admin role (non-admin gets 403)", async () => {
    const researcherApp = buildApp(RESEARCHER_EMAIL);
    const res = await request(researcherApp).get("/api/research/audit-events");
    expect(res.status).toBe(403);
  });

  it("14b. Admin audit-events route returns paginated events for owner", async () => {
    const ownerApp = buildApp(OWNER_EMAIL);
    const res = await request(ownerApp).get("/api/research/audit-events?limit=10&offset=0");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.limit).toBe(10);
    expect(res.body.offset).toBe(0);
  });

  // ── 15. Filter by action ──────────────────────────────────────────────

  it("15. Admin audit-events route filters by action correctly", async () => {
    // We know DOCUMENT_ACCESSED events were emitted in test 6. Filter for them.
    const ownerApp = buildApp(OWNER_EMAIL);
    const res = await request(ownerApp).get(
      `/api/research/audit-events?action=${AuditAction.DOCUMENT_ACCESSED}&limit=50`,
    );
    expect(res.status).toBe(200);
    // All returned events must have the requested action.
    for (const evt of res.body.events as any[]) {
      expect(evt.event).toBe(AuditAction.DOCUMENT_ACCESSED);
    }
    expect(res.body.events.length).toBeGreaterThan(0);
  });

  // ── 16. Filter by entityId ────────────────────────────────────────────

  it("16. Admin audit-events route filters by entityId correctly", async () => {
    const { judgmentId } = await seedVerifiedJudgment(["IN THE HIGH COURT\n[1] EntityId filter test."]);
    const ownerApp = buildApp(OWNER_EMAIL);
    // Trigger a DOCUMENT_ACCESSED event.
    await request(ownerApp).get(`/api/research/judgments/${judgmentId}`);
    await waitForAuditEvent(
      (e) => e.event === AuditAction.DOCUMENT_ACCESSED && e.entityId === judgmentId,
    );

    const res = await request(ownerApp).get(
      `/api/research/audit-events?entityKind=judgment&entityId=${judgmentId}`,
    );
    expect(res.status).toBe(200);
    for (const evt of res.body.events as any[]) {
      expect(evt.entityId).toBe(judgmentId);
      expect(evt.entityType).toBe("judgment");
    }
    expect(res.body.events.length).toBeGreaterThan(0);
  });

  // ── 17. Text-leak guard: judgment text absent from all audit metadata ─

  it("17. Judgment text does not appear in any audit event detail", async () => {
    // Use a distinctive marker string that should NEVER appear in audit logs.
    const marker = `RESTRICTED_JUDICIAL_TEXT_${RUN_ID}`;
    const { judgmentId } = await seedVerifiedJudgment([
      `IN THE HIGH COURT\n[1] ${marker} The court found the matter to be established.`,
    ]);

    const ownerApp = buildApp(OWNER_EMAIL);
    await request(ownerApp).get(`/api/research/judgments/${judgmentId}`);
    // Wait a moment for the fire-and-forget event to land.
    await new Promise((r) => setTimeout(r, 500));

    // Fetch all audit events for this judgment.
    const events = await db
      .select()
      .from(researchAuditEvents)
      .where(
        and(
          eq(researchAuditEvents.entityType, "judgment"),
          eq(researchAuditEvents.entityId, judgmentId),
        ),
      );

    expect(events.length).toBeGreaterThan(0);
    for (const evt of events) {
      const detailStr = JSON.stringify(evt.detail);
      expect(detailStr).not.toContain(marker);
    }
  });

  // ── 18. Long passage text is redacted in QUOTATION_CREATED detail ─────

  it("18. Long passage text in QUOTATION_CREATED detail is redacted by sanitiseForAudit", async () => {
    const longPassage = "L".repeat(AUDIT_MAX_STRING_LENGTH + 100);
    // Test the sanitiser directly on the shape that the route would log.
    const detail = sanitiseForAudit({
      collectionId: 1,
      propositionId: 99,
      label: "Ratio",
      passageText: longPassage,
    });
    expect(detail.passageText).toMatch(/^\[REDACTED:/);
    expect(detail.passageText).not.toContain("L".repeat(10));
    // Short fields are preserved.
    expect(detail.label).toBe("Ratio");
    expect(detail.collectionId).toBe(1);
  });
});
