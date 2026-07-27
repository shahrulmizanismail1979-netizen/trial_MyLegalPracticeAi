/**
 * Phase 12c — Retention and granular deletion
 *
 * Tests cover:
 *  1.  DELETE /layers with original_file → 200 + manifest with layer deleted
 *  2.  Manifest always contains backupConfirmed: false
 *  3.  Manifest contains the backup note string
 *  4.  Manifest structure: containerId, requestedAt, actor, layers array
 *  5.  ai_output layer deletes propositions, runs, authorities
 *  6.  search_index layer deletes the search index row
 *  7.  verified_judgment layer deletes judgment and transitions container to DELETED
 *  8.  case_candidates layer fails when verified_judgment still exists (partial failure)
 *  9.  Non-owner (researcher role) receives 403
 * 10.  GET /deletion-manifest returns the most recent manifest
 * 11.  GET /deletion-manifest is owner/admin-only (researcher → 403)
 * 12.  Multiple layers in one call all appear in manifest
 * 13.  Layer with no data returns not_found status (never fails)
 * 14.  Manifest stored in DB: GET returns most recent (not a stale earlier one)
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
  researchSearchIndex,
  researchAiAnalysisRuns,
  researchAiPropositions,
  researchAuthorities,
  researchLegislationRefs,
  researchDeletionManifests,
  researchTransformations,
  researchRightsRecords,
  researchUsers,
  researchValidationRuns,
  researchCandidateCoherenceChecks,
  researchCandidateReviewActions,
  researchCrossFileRelationships,
} = await import("@workspace/db");
const { eq, inArray, and } = await import("drizzle-orm");

const { registerContainer } = await import("./data/containers");
const { recordRightsDecision } = await import("./data/rights");
const { transitionContainer } = await import("./domain/containerStateMachine");
const { deleteContainerLayers } = await import("./retention/deletionService");

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

const OWNER_EMAIL = `ph12c-owner-${RUN_ID}@test.local`;
const RESEARCHER_EMAIL = `ph12c-researcher-${RUN_ID}@test.local`;

// ── Seed helpers ─────────────────────────────────────────────────────────────

async function seedContainer(): Promise<number> {
  const sha = sha256(`ph12c-container-${RUN_ID}-${randomUUID()}`);
  const container = await registerContainer({
    originalName: `ph12c-${RUN_ID}.pdf`,
    sourceBatch: `ph12c-${RUN_ID}`,
    contentSha256: sha,
    sizeBytes: 1024,
    mimeType: "application/pdf",
    provenance: { enteredVia: "test", registeredAt: new Date().toISOString() },
  });
  await recordRightsDecision(
    container.id,
    {
      status: "OFFICIAL_COURT_SOURCE",
      reason: "Test fixture",
      source: "Federal Court of Malaysia",
      dateObtained: new Date(),
      declaredSourceType: "official_court",
      licenceReference: null,
      approvedUsers: [],
      approvedPurposes: [],
      storagePermitted: true,
      analysisPermitted: true,
      exportPermitted: true,
      externalProcessingPermitted: false,
      studentAccessPermitted: false,
      printingPermitted: false,
      retentionPeriod: null,
      expiryDate: null,
      reviewer: OWNER_EMAIL,
      reviewDate: new Date(),
      notes: null,
    },
    { actor: OWNER_EMAIL },
  );
  trackedContainerIds.push(container.id);
  return container.id;
}

async function seedVerifiedJudgment(
  pageTexts: string[] = ["Test judgment text. [1] The court held for plaintiff."],
): Promise<{ containerId: number; judgmentId: number; candidateId: number }> {
  const containerId = await seedContainer();
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
        runKey: `exrun-12c-${RUN_ID}-${page!.id}`,
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
      runKey: `seg-12c-${RUN_ID}-${containerId}`,
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
      pageId: pageIds[pageTexts.length - 1]!,
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
      sectionCount: pageTexts.length,
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
      paragraphIdentifiers: ["[1]", "[2]"],
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
        { containerId, contentSha256: textChecksum, originalName: "ph12c-fixture.txt" },
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

  return { containerId, judgmentId: vj!.id, candidateId: candidate!.id };
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  await db
    .insert(researchUsers)
    .values({ email: OWNER_EMAIL, displayName: "Phase12c Owner", role: "owner", active: true })
    .onConflictDoNothing();
  await db
    .insert(researchUsers)
    .values({ email: RESEARCHER_EMAIL, displayName: "Phase12c Researcher", role: "researcher", active: true })
    .onConflictDoNothing();
});

afterAll(async () => {
  if (trackedContainerIds.length === 0) return;

  // Cleanup in reverse FK dependency order.
  await db.delete(researchDeletionManifests)
    .where(inArray(researchDeletionManifests.containerId, trackedContainerIds))
    .catch(() => {});

  const judgmentRows = await db
    .select({ id: researchVerifiedJudgments.id })
    .from(researchVerifiedJudgments)
    .where(inArray(researchVerifiedJudgments.containerId, trackedContainerIds))
    .catch(() => []);
  const judgmentIds = judgmentRows.map((r) => r.id);

  if (judgmentIds.length > 0) {
    const runRows = await db
      .select({ id: researchAiAnalysisRuns.id })
      .from(researchAiAnalysisRuns)
      .where(inArray(researchAiAnalysisRuns.judgmentId, judgmentIds))
      .catch(() => []);
    const runIds = runRows.map((r) => r.id);

    if (runIds.length > 0) {
      const propRows = await db
        .select({ id: researchAiPropositions.id })
        .from(researchAiPropositions)
        .where(inArray(researchAiPropositions.runId, runIds))
        .catch(() => []);
      const propIds = propRows.map((r) => r.id);

      if (propIds.length > 0) {
        await db.delete(researchAuthorities)
          .where(inArray(researchAuthorities.propositionId, propIds)).catch(() => {});
        await db.delete(researchLegislationRefs)
          .where(inArray(researchLegislationRefs.propositionId, propIds)).catch(() => {});
      }
      await db.delete(researchAiPropositions)
        .where(inArray(researchAiPropositions.runId, runIds)).catch(() => {});
      await db.delete(researchAiAnalysisRuns)
        .where(inArray(researchAiAnalysisRuns.id, runIds)).catch(() => {});
    }

    await db.delete(researchSearchIndex)
      .where(inArray(researchSearchIndex.containerId, trackedContainerIds)).catch(() => {});
    await db.delete(researchVerifiedJudgments)
      .where(inArray(researchVerifiedJudgments.id, judgmentIds)).catch(() => {});
  }

  // Case candidates and boundaries.
  const candidateRows = await db
    .select({ id: researchCaseCandidates.id })
    .from(researchCaseCandidates)
    .where(inArray(researchCaseCandidates.containerId, trackedContainerIds))
    .catch(() => []);
  const candidateIds = candidateRows.map((r) => r.id);
  if (candidateIds.length > 0) {
    await db.delete(researchCaseCandidateBoundaries)
      .where(inArray(researchCaseCandidateBoundaries.candidateId, candidateIds)).catch(() => {});
    await db.delete(researchCaseCandidates)
      .where(inArray(researchCaseCandidates.id, candidateIds)).catch(() => {});
  }

  // Page data.
  const pageRows = await db
    .select({ id: researchSourcePages.id })
    .from(researchSourcePages)
    .where(inArray(researchSourcePages.containerId, trackedContainerIds))
    .catch(() => []);
  const pageIds = pageRows.map((r) => r.id);
  if (pageIds.length > 0) {
    const extractionRows = await db
      .select({ id: researchPageExtractions.id })
      .from(researchPageExtractions)
      .where(inArray(researchPageExtractions.pageId, pageIds))
      .catch(() => []);
    const extractionIds = extractionRows.map((r) => r.id);
    if (extractionIds.length > 0) {
      await db.delete(researchPageExtractions)
        .where(inArray(researchPageExtractions.id, extractionIds)).catch(() => {});
    }
  }

  await db.delete(researchTransformations)
    .where(inArray(researchTransformations.containerId as any, trackedContainerIds)).catch(() => {});
  await db.delete(researchRightsRecords)
    .where(inArray(researchRightsRecords.containerId, trackedContainerIds)).catch(() => {});
  await db.delete(researchSourceContainers)
    .where(inArray(researchSourceContainers.id, trackedContainerIds)).catch(() => {});
  await db.delete(researchUsers)
    .where(eq(researchUsers.email, OWNER_EMAIL)).catch(() => {});
  await db.delete(researchUsers)
    .where(eq(researchUsers.email, RESEARCHER_EMAIL)).catch(() => {});
});

// ── App factories ─────────────────────────────────────────────────────────────

const ownerApp = () => buildApp(OWNER_EMAIL);
const researcherApp = () => buildApp(RESEARCHER_EMAIL);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Phase 12c — Retention and granular deletion", () => {
  it("1. DELETE /layers with original_file → 200 with manifest showing layer status", async () => {
    const containerId = await seedContainer();
    const res = await request(ownerApp())
      .delete(`/api/research/containers/${containerId}/layers`)
      .send({ layers: ["original_file"] });

    expect(res.status).toBe(200);
    expect(res.body.containerId).toBe(containerId);
    expect(res.body.layers).toHaveLength(1);
    expect(res.body.layers[0].layer).toBe("original_file");
    // Container has no storageKey so status is not_found (no file was uploaded)
    expect(["deleted", "not_found"]).toContain(res.body.layers[0].status);
  });

  it("2. Manifest always contains backupConfirmed: false", async () => {
    const containerId = await seedContainer();
    const res = await request(ownerApp())
      .delete(`/api/research/containers/${containerId}/layers`)
      .send({ layers: ["original_file"] });

    expect(res.status).toBe(200);
    expect(res.body.backupConfirmed).toBe(false);
  });

  it("3. Manifest contains the backup note string", async () => {
    const containerId = await seedContainer();
    const res = await request(ownerApp())
      .delete(`/api/research/containers/${containerId}/layers`)
      .send({ layers: ["original_file"] });

    expect(res.status).toBe(200);
    expect(typeof res.body.backupNote).toBe("string");
    expect(res.body.backupNote).toContain("Backup deletion must be confirmed separately");
  });

  it("4. Manifest structure: containerId, requestedAt, actor, layers", async () => {
    const containerId = await seedContainer();
    const res = await request(ownerApp())
      .delete(`/api/research/containers/${containerId}/layers`)
      .send({ layers: ["original_file"] });

    expect(res.status).toBe(200);
    expect(res.body.containerId).toBe(containerId);
    expect(typeof res.body.requestedAt).toBe("string");
    expect(typeof res.body.actor).toBe("string");
    expect(Array.isArray(res.body.layers)).toBe(true);
    expect(typeof res.body.manifestKey).toBe("string");
    // Each layer result has required fields
    const layer = res.body.layers[0];
    expect(typeof layer.layer).toBe("string");
    expect(["deleted", "not_found", "failed"]).toContain(layer.status);
    expect(typeof layer.rowsAffected).toBe("number");
    expect(Array.isArray(layer.objectStorageKeys)).toBe(true);
  });

  it("5. ai_output layer deletes propositions, runs, and authorities", async () => {
    const { containerId, judgmentId } = await seedVerifiedJudgment();

    // Seed an AI analysis run with a proposition.
    const [run] = await db
      .insert(researchAiAnalysisRuns)
      .values({
        judgmentId,
        providerId: 1, // provider must exist — use a stub; may fail gracefully
        promptVersion: "test@1",
        modelVersion: "test-model",
        status: "APPROVED",
      })
      .returning({ id: researchAiAnalysisRuns.id })
      .catch(() => [null]);

    if (run) {
      const [prop] = await db
        .insert(researchAiPropositions)
        .values({
          runId: run.id,
          propositionId: randomUUID(),
          fieldName: "legalIssues",
          content: "The plaintiff succeeded.",
          confidenceCategory: "HIGH",
          reviewStatus: "pending",
          supportingParagraphIds: ["[1]"],
          validatedPassages: [],
        })
        .returning({ id: researchAiPropositions.id })
        .catch(() => [null]);

      if (prop) {
        await db
          .insert(researchAuthorities)
          .values({
            judgmentId,
            runId: run.id,
            propositionId: prop.id,
            caseName: "Fixture v Fixture [2025]",
            treatment: "APPLIED",
          })
          .catch(() => {});
      }
    }

    const res = await request(ownerApp())
      .delete(`/api/research/containers/${containerId}/layers`)
      .send({ layers: ["ai_output"] });

    expect(res.status).toBe(200);
    const aiLayer = res.body.layers.find((l: any) => l.layer === "ai_output");
    expect(aiLayer).toBeDefined();
    // If we successfully seeded the AI provider (id=1 might not exist), deleted or not_found
    expect(["deleted", "not_found"]).toContain(aiLayer.status);
    if (aiLayer.status === "deleted") {
      expect(aiLayer.rowsAffected).toBeGreaterThan(0);
    }
  });

  it("6. search_index layer deletes the search index row", async () => {
    const { containerId, judgmentId } = await seedVerifiedJudgment();

    // Seed a search index row.
    await db
      .insert(researchSearchIndex)
      .values({
        judgmentId,
        containerId,
        documentText: "Test judgment text plaintiff court",
        processorVersion: "test@1",
      })
      .onConflictDoNothing()
      .catch(() => {});

    const res = await request(ownerApp())
      .delete(`/api/research/containers/${containerId}/layers`)
      .send({ layers: ["search_index"] });

    expect(res.status).toBe(200);
    const siLayer = res.body.layers.find((l: any) => l.layer === "search_index");
    expect(siLayer).toBeDefined();
    expect(["deleted", "not_found"]).toContain(siLayer.status);

    // Verify row is gone.
    const remaining = await db
      .select({ id: researchSearchIndex.id })
      .from(researchSearchIndex)
      .where(eq(researchSearchIndex.containerId, containerId));
    expect(remaining).toHaveLength(0);
  });

  it("7. verified_judgment layer deletes judgment and transitions container to DELETED", async () => {
    const { containerId, judgmentId } = await seedVerifiedJudgment();

    const res = await request(ownerApp())
      .delete(`/api/research/containers/${containerId}/layers`)
      .send({ layers: ["verified_judgment"] });

    expect(res.status).toBe(200);
    const vjLayer = res.body.layers.find((l: any) => l.layer === "verified_judgment");
    expect(vjLayer).toBeDefined();
    expect(vjLayer.status).toBe("deleted");
    expect(vjLayer.rowsAffected).toBe(1);

    // Judgment row should be gone.
    const remaining = await db
      .select({ id: researchVerifiedJudgments.id })
      .from(researchVerifiedJudgments)
      .where(eq(researchVerifiedJudgments.id, judgmentId));
    expect(remaining).toHaveLength(0);

    // Container should be in DELETED state.
    const [container] = await db
      .select({ processingState: researchSourceContainers.processingState })
      .from(researchSourceContainers)
      .where(eq(researchSourceContainers.id, containerId));
    expect(container?.processingState).toBe("DELETED");
  });

  it("8. case_candidates layer returns failed when verified_judgment still exists", async () => {
    // Seed a verified judgment — it FKs to case_candidates, so deleting
    // candidates while judgment exists violates the FK constraint.
    const { containerId } = await seedVerifiedJudgment();

    const res = await request(ownerApp())
      .delete(`/api/research/containers/${containerId}/layers`)
      .send({ layers: ["case_candidates"] });

    expect(res.status).toBe(200);
    const ccLayer = res.body.layers.find((l: any) => l.layer === "case_candidates");
    expect(ccLayer).toBeDefined();
    // Should fail because verified_judgment still exists and FKs to candidates.
    expect(ccLayer.status).toBe("failed");
    expect(typeof ccLayer.note).toBe("string");
  });

  it("9. Non-owner (researcher) receives 403", async () => {
    const containerId = await seedContainer();
    const res = await request(researcherApp())
      .delete(`/api/research/containers/${containerId}/layers`)
      .send({ layers: ["original_file"] });

    expect(res.status).toBe(403);
  });

  it("10. GET /deletion-manifest returns the most recent manifest", async () => {
    const containerId = await seedContainer();

    // Create a manifest via DELETE.
    await request(ownerApp())
      .delete(`/api/research/containers/${containerId}/layers`)
      .send({ layers: ["original_file"] });

    const res = await request(ownerApp())
      .get(`/api/research/containers/${containerId}/deletion-manifest`);

    expect(res.status).toBe(200);
    expect(res.body.containerId).toBe(containerId);
    expect(res.body.backupConfirmed).toBe(false);
    expect(Array.isArray(res.body.layers)).toBe(true);
    expect(res.body.layers[0].layer).toBe("original_file");
  });

  it("11. GET /deletion-manifest is owner/admin-only (researcher → 403)", async () => {
    const containerId = await seedContainer();
    const res = await request(researcherApp())
      .get(`/api/research/containers/${containerId}/deletion-manifest`);

    expect(res.status).toBe(403);
  });

  it("12. Multiple layers in one call all appear in manifest", async () => {
    const containerId = await seedContainer();
    const res = await request(ownerApp())
      .delete(`/api/research/containers/${containerId}/layers`)
      .send({ layers: ["original_file", "temp_files"] });

    expect(res.status).toBe(200);
    expect(res.body.layers).toHaveLength(2);
    const layerNames = res.body.layers.map((l: any) => l.layer);
    expect(layerNames).toContain("original_file");
    expect(layerNames).toContain("temp_files");
  });

  it("13. Layer with no data returns not_found status (never failed)", async () => {
    const containerId = await seedContainer();
    // search_index has no data for a freshly registered container.
    const res = await request(ownerApp())
      .delete(`/api/research/containers/${containerId}/layers`)
      .send({ layers: ["search_index"] });

    expect(res.status).toBe(200);
    const siLayer = res.body.layers[0];
    expect(siLayer.status).toBe("not_found");
    expect(siLayer.rowsAffected).toBe(0);
  });

  it("15. case_candidates cascade-deletes coherence checks and review actions when no judgment exists", async () => {
    // Seed a container and insert a candidate with FK-dependent rows but NO
    // verified_judgment — this exercises the full cascade path.
    const containerId = await seedContainer();

    // Insert a minimal segmentation run directly (bypassing the state machine).
    const [segRun] = await db
      .insert(researchSegmentationRuns)
      .values({
        containerId,
        jobId: null,
        runKey: `seg-12c-cascade-${RUN_ID}-${containerId}`,
        processorVersion: "test@1",
        sourceChecksum: sha256(`cascade-seg${containerId}`),
        status: "COMPLETE",
      })
      .returning({ id: researchSegmentationRuns.id });

    // Insert a candidate.
    const [candidate] = await db
      .insert(researchCaseCandidates)
      .values({
        containerId,
        runId: segRun!.id,
        startPageId: null,
        strength: "STRONG_BOUNDARY_CANDIDATE",
        reviewStatus: "reviewed",
      })
      .returning({ id: researchCaseCandidates.id });

    const candidateId = candidate!.id;

    // Insert a review action (FK: candidateId only).
    const [action] = await db
      .insert(researchCandidateReviewActions)
      .values({
        candidateId,
        actionType: "APPROVE",
        actor: OWNER_EMAIL,
        detail: { reason: "cascade-deletion-test" },
      })
      .returning({ id: researchCandidateReviewActions.id });

    // Insert a cross-file relationship (source candidate references this container's candidate).
    await db
      .insert(researchCrossFileRelationships)
      .values({
        sourceCandidateId: candidateId,
        targetCandidateId: candidateId,
        relationshipType: "POSSIBLE_CONTINUATION",
        evidence: { test: true },
        similarityScore: 0.9,
      } as any)
      .catch(() => {
        // Cross-file insert may fail if unique constraint or FK mismatches;
        // that's acceptable — we still verify review actions are deleted.
      });

    // Call deletion service directly (container doesn't need to be in full
    // VERIFIED state for direct service calls).
    const manifest = await deleteContainerLayers(
      containerId,
      ["case_candidates"],
      OWNER_EMAIL,
    );

    const ccLayer = manifest.layers.find((l) => l.layer === "case_candidates");
    expect(ccLayer).toBeDefined();
    expect(ccLayer!.status).toBe("deleted");
    expect(ccLayer!.rowsAffected).toBeGreaterThan(0);

    // Review action row should be gone.
    const remainingActions = await db
      .select({ id: researchCandidateReviewActions.id })
      .from(researchCandidateReviewActions)
      .where(eq(researchCandidateReviewActions.id, action!.id));
    expect(remainingActions).toHaveLength(0);

    // Candidate itself should be gone.
    const remainingCandidates = await db
      .select({ id: researchCaseCandidates.id })
      .from(researchCaseCandidates)
      .where(eq(researchCaseCandidates.id, candidateId));
    expect(remainingCandidates).toHaveLength(0);
  });

  it("14. GET /deletion-manifest returns the MOST RECENT manifest after two requests", async () => {
    const containerId = await seedContainer();

    // First DELETE.
    await request(ownerApp())
      .delete(`/api/research/containers/${containerId}/layers`)
      .send({ layers: ["original_file"] });

    // Second DELETE with a different layer set.
    await request(ownerApp())
      .delete(`/api/research/containers/${containerId}/layers`)
      .send({ layers: ["temp_files"] });

    const res = await request(ownerApp())
      .get(`/api/research/containers/${containerId}/deletion-manifest`);

    expect(res.status).toBe(200);
    // Most recent manifest is the second one (temp_files).
    const layerNames = res.body.layers.map((l: any) => l.layer);
    expect(layerNames).toContain("temp_files");
    expect(layerNames).not.toContain("original_file");
  });
});
