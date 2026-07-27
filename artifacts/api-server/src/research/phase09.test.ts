import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import express from "express";
import request from "supertest";

// Phase 09 proof tests: exact quotation selection, integrity verification,
// alteration recording, citation formatting, and permission gating.
// All integration tests use the live dev DB with RUN_ID-scoped cleanup.

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
  researchQuotations,
  researchQuotationAlterations,
} = await import("@workspace/db");
const { eq, inArray, like, and } = await import("drizzle-orm");
const { formatCitation, renderAlteredText } = await import(
  "./quotations/formatter"
);

// ── Test fixture helpers ───────────────────────────────────────────────────

const OWNER_EMAIL = `ph09-owner-${RUN_ID}@test.local`;
const GUEST_EMAIL = `ph09-guest-norow-${RUN_ID}@test.local`; // no DB row → resolves to "guest"

const trackedContainerIds: number[] = [];
const trackedJudgmentIds: number[] = [];
const trackedUserIds: number[] = [];
let ownerUserId: number | null = null;
let researcherUserId: number | null = null;
let uploadSeq = 0;

function makeUnique(text: string): string {
  uploadSeq += 1;
  return text + `\n%% phase09 run ${RUN_ID} #${uploadSeq}\n`;
}

async function seedContainer(rawText: string): Promise<number> {
  const text = makeUnique(rawText);
  const sha = sha256(text);
  const container = await registerContainer({
    originalName: `ph09-fixture-${RUN_ID}-${uploadSeq}.txt`,
    sourceBatch: `ph09-batch-${RUN_ID}`,
    contentSha256: sha,
    sizeBytes: Buffer.byteLength(text),
    mimeType: "text/plain",
    provenance: { enteredVia: "phase09-test" },
  });
  trackedContainerIds.push(container.id);
  await recordRightsDecision(
    container.id,
    {
      // OFFICIAL_COURT_SOURCE has export: true in the caps matrix, so owners
      // can call the export endpoint in tests. PRIVATE_PROCESSING_APPROVED has
      // export: false and would always deny the export action.
      status: "OFFICIAL_COURT_SOURCE",
      reason: "phase09 test",
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

/**
 * Seed a verified judgment with the given page texts.
 * Returns { containerId, judgmentId, pageIds, pageTexts, judicialText }.
 * judicialText = pageTexts.join("\n") — the deterministic reconstruction.
 */
async function seedVerifiedJudgment(
  pageTexts: string[],
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
          contentSha256: sha256(`seg-${RUN_ID}-${containerId}`),
          originalName: `ph09-fixture.txt`,
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

  // The judicial text is the deterministic reconstruction used by the service.
  const judicialText = pageTexts.join("\n");
  return { containerId, judgmentId: vj!.id, pageIds, judicialText };
}

// ── Express test app ───────────────────────────────────────────────────────

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

// ── Setup / teardown ──────────────────────────────────────────────────────

beforeAll(async () => {
  // Create owner user (role: owner)
  const [owner] = await db
    .insert(researchUsers)
    .values({
      email: OWNER_EMAIL,
      displayName: "Phase09 Test Owner",
      role: "owner",
      active: true,
    })
    .onConflictDoNothing()
    .returning({ id: researchUsers.id });
  ownerUserId = owner?.id ?? null;
  if (!ownerUserId) {
    const [ex] = await db
      .select({ id: researchUsers.id })
      .from(researchUsers)
      .where(eq(researchUsers.email, OWNER_EMAIL));
    ownerUserId = ex?.id ?? null;
  }
  if (ownerUserId) trackedUserIds.push(ownerUserId);

  // Create researcher user (role: researcher) — also has quotation create rights
  const researcherEmail = `ph09-researcher-${RUN_ID}@test.local`;
  const [researcher] = await db
    .insert(researchUsers)
    .values({
      email: researcherEmail,
      displayName: "Phase09 Researcher",
      role: "researcher",
      active: true,
    })
    .onConflictDoNothing()
    .returning({ id: researchUsers.id });
  researcherUserId = researcher?.id ?? null;
  if (!researcherUserId) {
    const [ex] = await db
      .select({ id: researchUsers.id })
      .from(researchUsers)
      .where(eq(researchUsers.email, researcherEmail));
    researcherUserId = ex?.id ?? null;
  }
  if (researcherUserId) trackedUserIds.push(researcherUserId);
});

afterAll(async () => {
  // Delete quotations and alterations first (FK order)
  if (trackedJudgmentIds.length > 0) {
    const quotationIds = (
      await db
        .select({ id: researchQuotations.id })
        .from(researchQuotations)
        .where(inArray(researchQuotations.judgmentId, trackedJudgmentIds))
    ).map((r) => r.id);
    if (quotationIds.length > 0) {
      await db
        .delete(researchQuotationAlterations)
        .where(inArray(researchQuotationAlterations.quotationId, quotationIds))
        .catch(() => {});
      await db
        .delete(researchQuotations)
        .where(inArray(researchQuotations.id, quotationIds))
        .catch(() => {});
    }
    await db
      .delete(researchCaseMetadata)
      .where(inArray(researchCaseMetadata.judgmentId, trackedJudgmentIds))
      .catch(() => {});
    await db
      .delete(researchVerifiedJudgments)
      .where(inArray(researchVerifiedJudgments.id, trackedJudgmentIds))
      .catch(() => {});
  }
  if (trackedContainerIds.length > 0) {
    const candidateIds = (
      await db
        .select({ id: researchCaseCandidates.id })
        .from(researchCaseCandidates)
        .where(inArray(researchCaseCandidates.containerId, trackedContainerIds))
    ).map((r) => r.id);
    const segRunIds = (
      await db
        .select({ id: researchSegmentationRuns.id })
        .from(researchSegmentationRuns)
        .where(inArray(researchSegmentationRuns.containerId, trackedContainerIds))
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
  if (trackedUserIds.length > 0) {
    await db
      .delete(researchUsers)
      .where(inArray(researchUsers.id, trackedUserIds))
      .catch(() => {});
  }
});

// ══════════════════════════════════════════════════════════════════════════
// UNIT TESTS — formatter (pure, no DB)
// ══════════════════════════════════════════════════════════════════════════

describe("formatCitation — pure function", () => {
  const baseQuotation = {
    selectedText: "The court held that the contract was void.",
    caseName: "Abu Bakar v Chong Wei Liang",
    citation: "[2024] 1 MLJU 999",
    court: "High Court of Malaya at Kuala Lumpur",
    judge: "Tan Sri Justice Ahmad",
    decisionDate: "2024-03-15",
    paragraphIdentifier: "[5]",
    kind: "exact" as const,
  };

  const meta = {
    caseName: "Abu Bakar v Chong Wei Liang",
    neutralCitation: "[2024] 1 MLJU 999",
    reportCitation: "[2024] 3 CLJ 101",
    court: "High Court of Malaya at Kuala Lumpur",
    judges: "Tan Sri Justice Ahmad",
    decisionDate: "2024-03-15",
  };

  it("neutral-citation-first — includes neutral citation and court", () => {
    const out = formatCitation(baseQuotation, "neutral-citation-first", meta, true);
    expect(out).toContain("Abu Bakar v Chong Wei Liang");
    expect(out).toContain("[2024] 1 MLJU 999");
  });

  it("bluebook — includes REPORTER CITATION NOT VERIFIED when reportCitation absent", () => {
    const metaNoReport = { ...meta, reportCitation: undefined };
    const out = formatCitation(baseQuotation, "bluebook", metaNoReport, false);
    expect(out).toContain("REPORTER CITATION NOT VERIFIED");
    expect(out).not.toContain("CLJ");
  });

  it("bluebook — includes verified reporter citation when available", () => {
    const out = formatCitation(baseQuotation, "bluebook", meta, true);
    expect(out).toContain("[2024] 3 CLJ 101");
    expect(out).not.toContain("REPORTER CITATION NOT VERIFIED");
  });

  it("oscola — marks unverified reporter with REPORTER CITATION NOT VERIFIED", () => {
    const out = formatCitation(baseQuotation, "oscola", meta, false);
    expect(out).toContain("REPORTER CITATION NOT VERIFIED");
  });

  it("academic-footnote — includes para ref", () => {
    const out = formatCitation(baseQuotation, "academic-footnote", meta, true);
    expect(out).toContain("[5]");
    expect(out.endsWith(".")).toBe(true);
  });

  it("bibliography — does not end with stray whitespace", () => {
    const out = formatCitation(baseQuotation, "bibliography", meta, true);
    expect(out).toBe(out.trimEnd());
    expect(out).toContain("Abu Bakar v Chong Wei Liang");
  });

  it("exact style — returns selectedText verbatim", () => {
    const out = formatCitation(baseQuotation, "exact", meta, true);
    expect(out).toBe(baseQuotation.selectedText);
  });

  it("renderAlteredText — omission renders as […]", () => {
    const text = "The court held that the contract was void.";
    const out = renderAlteredText(text, [
      { kind: "omission", positionStart: 9, positionEnd: 15, replacementText: "" },
    ]);
    expect(out).toContain("[…]");
    expect(out).not.toContain("held t");
  });

  it("renderAlteredText — insertion renders as [bracketed text]", () => {
    const text = "The court held that the contract was void.";
    const out = renderAlteredText(text, [
      {
        kind: "insertion",
        positionStart: 9,
        positionEnd: 9,
        replacementText: "unanimously",
      },
    ]);
    expect(out).toContain("[unanimously]");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ══════════════════════════════════════════════════════════════════════════

describe("quotation integrity — exact selection", () => {
  it("creates a quotation when selected text exactly matches stored paragraph", async () => {
    const pages = [
      "IN THE HIGH COURT OF MALAYA AT KUALA LUMPUR",
      "[1] This is the judgment of the court.",
    ];
    const { judgmentId, judicialText } = await seedVerifiedJudgment(pages);

    // Select "[1] This is the judgment of the court." (second page text, after newline)
    const needle = "[1] This is the judgment of the court.";
    const offset = judicialText.indexOf(needle);
    expect(offset).toBeGreaterThan(-1);

    const app = buildApp(OWNER_EMAIL);
    const res = await request(app)
      .post("/api/research/quotations")
      .send({
        judgmentId,
        selectedText: needle,
        charStart: offset,
        charEnd: offset + needle.length,
        paragraphIdentifier: "[1]",
        userNote: "Key holding",
      });

    expect(res.status).toBe(201);
    expect(res.body.selectedText).toBe(needle);
    expect(res.body.kind).toBe("exact");
    expect(typeof res.body.sourceChecksum).toBe("string");
    expect(res.body.sourceChecksum).toHaveLength(64); // SHA-256 hex
    expect(res.body.paragraphIdentifier).toBe("[1]");
  });
});

describe("quotation integrity — multi-paragraph selection", () => {
  it("creates a quotation spanning across multiple pages", async () => {
    const pages = [
      "[1] The first paragraph of the judgment.",
      "[2] The second paragraph continues the reasoning.",
    ];
    const { judgmentId, judicialText } = await seedVerifiedJudgment(pages);

    // Select text that spans the page boundary (includes the \n joiner)
    const needle = "the judgment.\n[2] The second paragraph";
    const offset = judicialText.indexOf(needle);
    expect(offset).toBeGreaterThan(-1);

    const app = buildApp(OWNER_EMAIL);
    const res = await request(app)
      .post("/api/research/quotations")
      .send({
        judgmentId,
        selectedText: needle,
        charStart: offset,
        charEnd: offset + needle.length,
      });

    expect(res.status).toBe(201);
    expect(res.body.selectedText).toBe(needle);
    expect(res.body.kind).toBe("exact");
  });
});

describe("quotation integrity — punctuation", () => {
  it("correctly matches text with em-dashes, quotation marks, and colons", async () => {
    const pages = [
      'The court stated: "The contract — being void ab initio — cannot be enforced; see: Smith v Jones."',
    ];
    const { judgmentId, judicialText } = await seedVerifiedJudgment(pages);

    const needle = '"The contract — being void ab initio — cannot be enforced; see: Smith v Jones."';
    const offset = judicialText.indexOf(needle);
    expect(offset).toBeGreaterThan(-1);

    const app = buildApp(OWNER_EMAIL);
    const res = await request(app)
      .post("/api/research/quotations")
      .send({
        judgmentId,
        selectedText: needle,
        charStart: offset,
        charEnd: offset + needle.length,
      });

    expect(res.status).toBe(201);
    expect(res.body.selectedText).toBe(needle);
  });
});

describe("quotation integrity — unicode", () => {
  it("correctly matches text containing Malay and Arabic characters", async () => {
    const pages = [
      "Mahkamah memutuskan bahawa kontrak itu adalah tidak sah. الحكم: باطل.",
    ];
    const { judgmentId, judicialText } = await seedVerifiedJudgment(pages);

    const needle = "kontrak itu adalah tidak sah. الحكم: باطل.";
    const offset = judicialText.indexOf(needle);
    expect(offset).toBeGreaterThan(-1);

    const app = buildApp(OWNER_EMAIL);
    const res = await request(app)
      .post("/api/research/quotations")
      .send({
        judgmentId,
        selectedText: needle,
        charStart: offset,
        charEnd: offset + needle.length,
      });

    expect(res.status).toBe(201);
    expect(res.body.selectedText).toBe(needle);
  });
});

describe("quotation integrity — footnotes", () => {
  it("correctly matches text containing a footnote marker", async () => {
    const pages = [
      "[1] The principle was established in Donoghue v Stevenson.¹\n¹ [1932] AC 562 (HL).",
    ];
    const { judgmentId, judicialText } = await seedVerifiedJudgment(pages);

    const needle = "Donoghue v Stevenson.¹";
    const offset = judicialText.indexOf(needle);
    expect(offset).toBeGreaterThan(-1);

    const app = buildApp(OWNER_EMAIL);
    const res = await request(app)
      .post("/api/research/quotations")
      .send({
        judgmentId,
        selectedText: needle,
        charStart: offset,
        charEnd: offset + needle.length,
      });

    expect(res.status).toBe(201);
    expect(res.body.selectedText).toBe(needle);
  });
});

describe("quotation alterations — ellipsis (omission)", () => {
  it("records an omission and flips quotation kind to altered; original selectedText preserved", async () => {
    const pages = [
      "[1] The court held that the defendant was negligent and liable for damages.",
    ];
    const { judgmentId, judicialText } = await seedVerifiedJudgment(pages);

    const needle = "the defendant was negligent and liable for damages.";
    const offset = judicialText.indexOf(needle);

    const app = buildApp(OWNER_EMAIL);
    const createRes = await request(app)
      .post("/api/research/quotations")
      .send({
        judgmentId,
        selectedText: needle,
        charStart: offset,
        charEnd: offset + needle.length,
      });
    expect(createRes.status).toBe(201);
    const quotationId: number = createRes.body.id;

    // Record an omission: remove "negligent and" (positions 20–33 within needle)
    const omissionStart = needle.indexOf("negligent and");
    const omissionEnd = omissionStart + "negligent and".length;
    const altRes = await request(app)
      .patch(`/api/research/quotations/${quotationId}/alterations`)
      .send({
        kind: "omission",
        positionStart: omissionStart,
        positionEnd: omissionEnd,
        originalText: "negligent and",
        replacementText: "",
      });
    expect(altRes.status).toBe(200);
    expect(altRes.body.quotation.kind).toBe("altered");

    // Verify: original selectedText is preserved on the parent row
    const readRes = await request(app).get(`/api/research/quotations/${quotationId}`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.quotation.selectedText).toBe(needle); // original unchanged
    expect(readRes.body.quotation.kind).toBe("altered");
    expect(readRes.body.alterations).toHaveLength(1);
    expect(readRes.body.alterations[0].kind).toBe("omission");
  });
});

describe("quotation alterations — bracketed addition (insertion)", () => {
  it("records an insertion and flips kind to altered", async () => {
    const pages = [
      "[1] The defendant failed to exercise reasonable care.",
    ];
    const { judgmentId, judicialText } = await seedVerifiedJudgment(pages);
    const needle = "failed to exercise reasonable care.";
    const offset = judicialText.indexOf(needle);

    const app = buildApp(OWNER_EMAIL);
    const createRes = await request(app)
      .post("/api/research/quotations")
      .send({
        judgmentId,
        selectedText: needle,
        charStart: offset,
        charEnd: offset + needle.length,
      });
    expect(createRes.status).toBe(201);
    const quotationId: number = createRes.body.id;

    // Insert clarification word at position 9 (after "failed to")
    const altRes = await request(app)
      .patch(`/api/research/quotations/${quotationId}/alterations`)
      .send({
        kind: "insertion",
        positionStart: 9,
        positionEnd: 9,
        originalText: "",
        replacementText: "wholly",
      });
    expect(altRes.status).toBe(200);
    expect(altRes.body.quotation.kind).toBe("altered");

    // Verify the rendered cite includes [wholly]
    const citeRes = await request(app).get(
      `/api/research/quotations/${quotationId}/cite?style=neutral-citation-first`,
    );
    expect(citeRes.status).toBe(200);
    expect(citeRes.body.renderedText).toContain("[wholly]");
    expect(citeRes.body.kind).toBe("altered");
  });
});

describe("citation formatter — missing reporter citation", () => {
  it("renders REPORTER CITATION NOT VERIFIED when reportCitation is not present in metadata", async () => {
    const pages = [
      "IN THE HIGH COURT OF MALAYA\n[1] Judgment in favour of plaintiff.",
    ];
    const { judgmentId, judicialText } = await seedVerifiedJudgment(pages);

    // Insert only neutral citation metadata (no reportCitation)
    await db.insert(researchCaseMetadata).values({
      judgmentId,
      containerId: trackedContainerIds[trackedContainerIds.length - 1]!,
      fieldName: "neutralCitation",
      value: "[2024] MLJU 888",
      confidence: 0.9,
      method: "regex",
      processorVersion: "metadata_extract@1",
      reviewerStatus: "pending",
    });

    const needle = "[1] Judgment in favour of plaintiff.";
    const offset = judicialText.indexOf(needle);
    const app = buildApp(OWNER_EMAIL);
    const createRes = await request(app)
      .post("/api/research/quotations")
      .send({
        judgmentId,
        selectedText: needle,
        charStart: offset,
        charEnd: offset + needle.length,
      });
    expect(createRes.status).toBe(201);
    const quotationId: number = createRes.body.id;

    // bluebook requires a reporter citation
    const citeRes = await request(app).get(
      `/api/research/quotations/${quotationId}/cite?style=bluebook`,
    );
    expect(citeRes.status).toBe(200);
    expect(citeRes.body.citation).toContain("REPORTER CITATION NOT VERIFIED");
  });
});

describe("quotation export — permission gating", () => {
  it("returns 403 for guest role on export endpoint", async () => {
    const pages = ["[1] This court finds for the plaintiff."];
    const { judgmentId, judicialText } = await seedVerifiedJudgment(pages);

    const needle = "finds for the plaintiff.";
    const offset = judicialText.indexOf(needle);

    // Create quotation as owner
    const ownerApp = buildApp(OWNER_EMAIL);
    const createRes = await request(ownerApp)
      .post("/api/research/quotations")
      .send({
        judgmentId,
        selectedText: needle,
        charStart: offset,
        charEnd: offset + needle.length,
      });
    expect(createRes.status).toBe(201);
    const quotationId: number = createRes.body.id;

    // Guest has no DB row → resolves to "guest" role → cannot export
    const guestApp = buildApp(GUEST_EMAIL);
    const exportRes = await request(guestApp).get(
      `/api/research/quotations/${quotationId}/export`,
    );
    expect(exportRes.status).toBe(403);

    // Owner can export
    const ownerExportRes = await request(ownerApp).get(
      `/api/research/quotations/${quotationId}/export`,
    );
    expect(ownerExportRes.status).toBe(200);
    expect(ownerExportRes.body.quotation).toBeDefined();
    expect(ownerExportRes.body.exportedAt).toBeDefined();
  });
});

describe("quotation source integrity — changed source text", () => {
  it("returns sourceChanged: true when the page extraction text is mutated after quotation creation", async () => {
    const pages = ["[1] The original judicial text that will be altered."];
    const { judgmentId, judicialText, pageIds } =
      await seedVerifiedJudgment(pages);

    const needle = "original judicial text";
    const offset = judicialText.indexOf(needle);

    const app = buildApp(OWNER_EMAIL);
    const createRes = await request(app)
      .post("/api/research/quotations")
      .send({
        judgmentId,
        selectedText: needle,
        charStart: offset,
        charEnd: offset + needle.length,
      });
    expect(createRes.status).toBe(201);
    const quotationId: number = createRes.body.id;

    // Verify: sourceChanged is false initially
    const readBefore = await request(app).get(
      `/api/research/quotations/${quotationId}`,
    );
    expect(readBefore.body.sourceChanged).toBe(false);

    // Mutate the page extraction — simulate a corrected re-extraction
    const newText = "[1] The modified judicial text that was altered post-creation.";
    await db
      .update(researchPageExtractions)
      .set({ rawText: newText, rawTextSha256: sha256(newText) })
      .where(eq(researchPageExtractions.pageId, pageIds[0]!));

    // Now sourceChanged should be true
    const readAfter = await request(app).get(
      `/api/research/quotations/${quotationId}`,
    );
    expect(readAfter.status).toBe(200);
    expect(readAfter.body.sourceChanged).toBe(true);
  });
});

describe("quotation alteration — altered quotation not presentable as exact", () => {
  it("rejects a cite?style=exact request for an altered quotation with 409", async () => {
    const pages = [
      "[1] The court concluded that the claimant had established his case on the balance of probabilities.",
    ];
    const { judgmentId, judicialText } = await seedVerifiedJudgment(pages);

    const needle =
      "the claimant had established his case on the balance of probabilities.";
    const offset = judicialText.indexOf(needle);

    const app = buildApp(OWNER_EMAIL);
    const createRes = await request(app)
      .post("/api/research/quotations")
      .send({
        judgmentId,
        selectedText: needle,
        charStart: offset,
        charEnd: offset + needle.length,
      });
    expect(createRes.status).toBe(201);
    const quotationId: number = createRes.body.id;

    // Record an omission to flip kind → "altered"
    await request(app)
      .patch(`/api/research/quotations/${quotationId}/alterations`)
      .send({
        kind: "omission",
        positionStart: 0,
        positionEnd: 4,
        originalText: "the ",
        replacementText: "",
      });

    // Verify kind is now "altered"
    const readRes = await request(app).get(`/api/research/quotations/${quotationId}`);
    expect(readRes.body.quotation.kind).toBe("altered");

    // Attempting cite?style=exact should be rejected
    const citeRes = await request(app).get(
      `/api/research/quotations/${quotationId}/cite?style=exact`,
    );
    expect(citeRes.status).toBe(409);
    expect(citeRes.body.code).toBe("ALTERED_QUOTATION_NOT_EXACT");

    // But regular citation styles must still work
    const regularCiteRes = await request(app).get(
      `/api/research/quotations/${quotationId}/cite?style=neutral-citation-first`,
    );
    expect(regularCiteRes.status).toBe(200);
    expect(regularCiteRes.body.kind).toBe("altered");
  });

  it("verifies that an altered quotation's kind field is never 'exact'", async () => {
    const pages = ["[1] A short passage for kind verification."];
    const { judgmentId, judicialText } = await seedVerifiedJudgment(pages);

    const needle = "A short passage for kind verification.";
    const offset = judicialText.indexOf(needle);

    const app = buildApp(OWNER_EMAIL);
    const createRes = await request(app)
      .post("/api/research/quotations")
      .send({
        judgmentId,
        selectedText: needle,
        charStart: offset,
        charEnd: offset + needle.length,
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.kind).toBe("exact");
    const quotationId: number = createRes.body.id;

    await request(app)
      .patch(`/api/research/quotations/${quotationId}/alterations`)
      .send({
        kind: "insertion",
        positionStart: 0,
        positionEnd: 0,
        originalText: "",
        replacementText: "Important",
      });

    const readRes = await request(app).get(`/api/research/quotations/${quotationId}`);
    expect(readRes.body.quotation.kind).not.toBe("exact");
    expect(readRes.body.quotation.kind).toBe("altered");
  });
});

describe("quotation integrity — rejection on mismatch", () => {
  it("returns 422 when selectedText does not match the judicial text at stated offsets", async () => {
    const pages = ["[1] The truth is this passage is unique."];
    const { judgmentId } = await seedVerifiedJudgment(pages);

    const app = buildApp(OWNER_EMAIL);
    const res = await request(app)
      .post("/api/research/quotations")
      .send({
        judgmentId,
        selectedText: "This text does not match what is stored.",
        charStart: 0,
        charEnd: 39,
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("TEXT_MISMATCH");
  });
});

describe("quotations list — by judgment", () => {
  it("lists all quotations for a judgment via the judgments sub-path", async () => {
    const pages = ["[1] The court dismissed the appeal with costs."];
    const { judgmentId, judicialText } = await seedVerifiedJudgment(pages);

    const needle = "dismissed the appeal with costs.";
    const offset = judicialText.indexOf(needle);

    const app = buildApp(OWNER_EMAIL);
    await request(app)
      .post("/api/research/quotations")
      .send({
        judgmentId,
        selectedText: needle,
        charStart: offset,
        charEnd: offset + needle.length,
      });

    const listRes = await request(app).get(
      `/api/research/judgments/${judgmentId}/quotations`,
    );
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.length).toBeGreaterThanOrEqual(1);
    expect(listRes.body[0].judgmentId).toBe(judgmentId);
  });
});
