// Phase 07 — Editorial review & verification routes (ADR 0008).
//
// Endpoints:
//   GET  /containers/:id/sections                    — list page sections
//   PATCH /containers/:id/sections/:sectionId        — override classification
//   POST /containers/:id/editorial-review/complete   — mark editorial review done (enqueue classification)
//   GET  /containers/:id/judicial-text               — gated judicial text view
//   POST /containers/:id/verify                      — completeness check + verify

import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import {
  db,
  researchPageSections,
  researchVerifiedJudgments,
  researchSourceContainers,
  researchSourcePages,
  researchPageExtractions,
  researchPageBlocks,
  researchCaseCandidates,
  researchCaseCandidateBoundaries,
  researchCaseBoundaries,
  researchTransformations,
  researchUsers,
  SECTION_CLASSIFICATIONS_DB,
} from "@workspace/db";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { requireResearchRole } from "../auth";
import { recordAuditEvent } from "../domain/audit";
import { checkContainerAccess } from "../domain/gates";
import { transitionContainer } from "../domain/containerStateMachine";
import { EntityNotFoundError } from "../domain/types";
import { ProcessorFailure } from "../processing/handlers";
import {
  classifySections,
  applyIsolationGate,
  checkCompleteness,
  computeJudicialTextChecksum,
  registerEditorialProcessor,
  startEditorialClassification,
  type PageInput,
  type BlockInput,
  type ClassifiedSection,
} from "../isolation";

// Register the processor once (idempotent guard in registerProcessor)
registerEditorialProcessor();

const router: IRouter = Router();

const REVIEW_ROLES = ["owner", "administrator", "legal_reviewer"] as const;
const STAFF_ROLES = ["owner", "administrator", "rights_reviewer", "legal_reviewer"] as const;

// ── Access helper ──────────────────────────────────────────────────────────

async function requireContainerView(
  req: import("express").Request,
  res: import("express").Response,
  containerId: number,
): Promise<boolean> {
  try {
    const { decision } = await checkContainerAccess(
      containerId,
      req.researchRole ?? null,
      "view",
      { actor: req.authEmail ?? undefined },
    );
    if (!decision.allowed) {
      res.status(404).json({ error: "Not found" });
      return false;
    }
    return true;
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return false;
    }
    throw err;
  }
}

function actorFrom(req: import("express").Request): string {
  return req.authEmail ?? `role:${req.researchRole}`;
}

// ── GET /containers/:id/sections ──────────────────────────────────────────

router.get("/containers/:id/sections", requireResearchRole(...STAFF_ROLES), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid container id" }); return; }
  if (!(await requireContainerView(req, res, id))) return;

  const sections = await db
    .select()
    .from(researchPageSections)
    .where(eq(researchPageSections.containerId, id))
    .orderBy(asc(researchPageSections.pageId), asc(researchPageSections.sectionIndex));

  // Group by page as required by ADR 0008 contract (pageId is nullable for span-only sections; use 0 as sentinel)
  const pageMap = new Map<number, typeof sections>();
  for (const s of sections) {
    const key = s.pageId ?? 0;
    const list = pageMap.get(key) ?? [];
    list.push(s);
    pageMap.set(key, list);
  }
  const pages = [...pageMap.entries()].map(([pageId, secs]) => ({ pageId, sections: secs }));
  res.json({ containerId: id, pages });
});

// ── PATCH /containers/:id/sections/:sectionId — override classification ───

const PatchSectionBody = z.object({
  classification: z.enum(SECTION_CLASSIFICATIONS_DB),
  note: z.string().optional(),
});

router.patch(
  "/containers/:id/sections/:sectionId",
  requireResearchRole(...REVIEW_ROLES),
  async (req, res) => {
    const id = Number(req.params.id);
    const sectionId = Number(req.params.sectionId);
    if (!Number.isInteger(id) || !Number.isInteger(sectionId)) {
      res.status(400).json({ error: "Invalid id" }); return;
    }
    if (!(await requireContainerView(req, res, id))) return;

    const [section] = await db
      .select()
      .from(researchPageSections)
      .where(and(eq(researchPageSections.id, sectionId), eq(researchPageSections.containerId, id)));
    if (!section) { res.status(404).json({ error: "Section not found" }); return; }

    const parsed = PatchSectionBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

    const actor = actorFrom(req);
    const now = new Date();

    // Resolve reviewer FK — look up research_users by email (nullable if not found)
    const reviewerEmail = req.authEmail ?? null;
    let reviewerUserId: number | null = null;
    if (reviewerEmail) {
      const [ru] = await db
        .select({ id: researchUsers.id })
        .from(researchUsers)
        .where(eq(researchUsers.email, reviewerEmail))
        .limit(1);
      reviewerUserId = ru?.id ?? null;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(researchPageSections)
        .set({
          reviewerDecision: parsed.data.classification,
          reviewerNote: parsed.data.note ?? null,
          notes: parsed.data.note ?? null,
          reviewerId: reviewerUserId,
          reviewerDecidedAt: now,
          isolationApplied: !["VERIFIED_JUDICIAL_TEXT", "PROBABLE_JUDICIAL_TEXT"].includes(parsed.data.classification),
        })
        .where(eq(researchPageSections.id, sectionId));

      await tx.insert(researchTransformations).values({
        containerId: id,
        kind: "editorial.section_override",
        detail: {
          sectionId,
          previousClassification: section.classification,
          newClassification: parsed.data.classification,
          note: parsed.data.note,
        },
        actor,
      });

      await recordAuditEvent(tx, {
        entityType: "page_section",
        entityId: sectionId,
        event: "editorial:override",
        fromState: section.reviewerDecision ?? section.classification,
        toState: parsed.data.classification,
        actor,
        detail: { containerId: id, note: parsed.data.note },
      });
    });

    const [updated] = await db.select().from(researchPageSections).where(eq(researchPageSections.id, sectionId));
    res.json(updated);
  },
);

// ── POST /containers/:id/editorial-review/complete ────────────────────────
// Called by a reviewer after overriding all MANUAL_REVIEW_REQUIRED sections.
// Validates no unresolved sections remain, transitions EDITORIAL_REVIEW_REQUIRED →
// EDITORIAL_REVIEW_PENDING if needed, then enqueues re-classification.

router.post(
  "/containers/:id/editorial-review/complete",
  requireResearchRole(...REVIEW_ROLES),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid container id" }); return; }
    if (!(await requireContainerView(req, res, id))) return;

    // Validate: no MANUAL_REVIEW_REQUIRED sections may remain without a reviewer decision
    const mrrSections = await db
      .select({ id: researchPageSections.id, reviewerDecision: researchPageSections.reviewerDecision })
      .from(researchPageSections)
      .where(and(
        eq(researchPageSections.containerId, id),
        eq(researchPageSections.classification, "MANUAL_REVIEW_REQUIRED"),
      ));
    const unresolvedSections = mrrSections.filter((s) => s.reviewerDecision === null);
    if (unresolvedSections.length > 0) {
      res.status(409).json({
        error: `${unresolvedSections.length} section(s) still require a manual classification override. Use PATCH /containers/${id}/sections/:sectionId to resolve each before completing editorial review.`,
        code: "UNRESOLVED_MANUAL_REVIEW",
        unresolvedCount: unresolvedSections.length,
      });
      return;
    }

    const actor = actorFrom(req);

    // Transition EDITORIAL_REVIEW_REQUIRED → EDITORIAL_REVIEW_PENDING so the
    // state path matches: REQUIRED → PENDING → JUDGMENT_VERIFICATION_PENDING.
    const { container } = await checkContainerAccess(id, req.researchRole ?? null, "view", { actor }).catch(() => ({ container: null }));
    if (container?.processingState === "EDITORIAL_REVIEW_REQUIRED") {
      try {
        await transitionContainer(id, "EDITORIAL_REVIEW_PENDING", {
          actor,
          detail: { reason: "reviewer_complete", resolvedSectionCount: mrrSections.length },
        });
      } catch {
        // Race condition — processor may have already transitioned; proceed to enqueue
      }
    }

    try {
      const { jobId } = await startEditorialClassification(id, actor);
      res.status(202).json({ jobId, message: "Editorial classification enqueued" });
    } catch (err) {
      if (err instanceof ProcessorFailure) {
        res.status(409).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  },
);

// ── GET /containers/:id/judicial-text ─────────────────────────────────────
// Returns only VERIFIED_JUDICIAL_TEXT + PROBABLE_JUDICIAL_TEXT sections,
// with their page text and source provenance.
// Isolation gate is applied here — SUSPECTED sections are never returned.

router.get(
  "/containers/:id/judicial-text",
  requireResearchRole(...STAFF_ROLES),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid container id" }); return; }
    if (!(await requireContainerView(req, res, id))) return;

    const rawSections = await db
      .select()
      .from(researchPageSections)
      .where(eq(researchPageSections.containerId, id))
      .orderBy(asc(researchPageSections.pageId), asc(researchPageSections.sectionIndex));

    if (rawSections.length === 0) {
      res.json({ containerId: id, sections: [], isolationApplied: false });
      return;
    }

    // Convert DB rows to ClassifiedSection for the gate
    const asSections: ClassifiedSection[] = rawSections.map((s) => ({
      pageId: s.pageId ?? 0,
      blockId: s.blockId ?? undefined,
      sectionIndex: s.sectionIndex,
      classification: (s.reviewerDecision ?? s.classification) as ClassifiedSection["classification"],
      confidence: s.confidence,
      supportingEvidence: s.supportingEvidence as string[],
      detectorVersion: s.detectorVersion,
    }));

    const gated = applyIsolationGate(asSections);
    const isolationApplied = gated.length < asSections.length;

    const gatedPageIds = [...new Set(gated.map((s) => s.pageId))];
    let pageTexts: Record<number, string> = {};
    if (gatedPageIds.length > 0) {
      const extractions = await db
        .select({ pageId: researchPageExtractions.pageId, rawText: researchPageExtractions.rawText })
        .from(researchPageExtractions)
        .where(inArray(researchPageExtractions.pageId, gatedPageIds))
        .orderBy(desc(researchPageExtractions.id));
      for (const ex of extractions) {
        if (!(ex.pageId in pageTexts)) pageTexts[ex.pageId] = ex.rawText ?? "";
      }
    }

    // Fetch block-level text for sections that have a blockId.
    // On mixed pages, we must not return the full page text — only the
    // specific block's text for each judicial section (isolation enforcement).
    const gatedBlockIds = rawSections
      .filter((r) => r.blockId !== null && gated.some((g) => g.pageId === r.pageId && g.sectionIndex === r.sectionIndex))
      .map((r) => r.blockId!);
    const blockTextMap = new Map<number, string>();
    if (gatedBlockIds.length > 0) {
      const blocks = await db
        .select({ id: researchPageBlocks.id, text: researchPageBlocks.text })
        .from(researchPageBlocks)
        .where(inArray(researchPageBlocks.id, gatedBlockIds));
      for (const b of blocks) blockTextMap.set(b.id, b.text);
    }

    const result = gated.map((s) => {
      const raw = rawSections.find((r) => r.pageId === s.pageId && r.sectionIndex === s.sectionIndex);
      // Use block-level text when available (mixed-page isolation).
      // Fall back to full page text only for whole-page synthetic sections (no blockId).
      const sectionText = raw?.blockId != null
        ? (blockTextMap.get(raw.blockId) ?? pageTexts[s.pageId] ?? null)
        : (pageTexts[s.pageId] ?? null);
      return { ...raw, effectiveClassification: s.classification, sectionText };
    });

    res.json({ containerId: id, sections: result, isolationApplied });
  },
);

// ── POST /containers/:id/verify ────────────────────────────────────────────
// Runs completeness checks and, if clean, creates research_verified_judgments
// + transitions to VERIFIED.
// Returns 422 if any critical warning is present.

const VerifyBody = z.object({
  candidateId: z.number().int().positive(),
});

router.post(
  "/containers/:id/verify",
  requireResearchRole(...REVIEW_ROLES),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid container id" }); return; }
    if (!(await requireContainerView(req, res, id))) return;

    const parsed = VerifyBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }

    const { candidateId } = parsed.data;

    // Verify candidate belongs to this container
    const [candidate] = await db
      .select()
      .from(researchCaseCandidates)
      .where(and(eq(researchCaseCandidates.id, candidateId), eq(researchCaseCandidates.containerId, id)));
    if (!candidate) { res.status(404).json({ error: "Candidate not found in container" }); return; }

    // Already verified?
    const [existing] = await db
      .select()
      .from(researchVerifiedJudgments)
      .where(eq(researchVerifiedJudgments.candidateId, candidateId));
    if (existing) {
      res.status(409).json({ error: "Candidate already verified", code: "ALREADY_VERIFIED", verifiedJudgmentId: existing.id });
      return;
    }

    // Must be in JUDGMENT_VERIFICATION_PENDING
    const { container } = await checkContainerAccess(id, req.researchRole ?? null, "view", { actor: actorFrom(req) }).catch(() => ({ container: null }));
    if (!container || container.processingState !== "JUDGMENT_VERIFICATION_PENDING") {
      res.status(409).json({
        error: "Container is not in JUDGMENT_VERIFICATION_PENDING state",
        code: "INVALID_STATE",
        currentState: container?.processingState ?? "unknown",
      });
      return;
    }

    // ── Finding 4 fix: resolve candidate span BEFORE fetching sections ────
    // Sections must be scoped to the active candidate's pages only so that
    // non-candidate sections never contaminate pageRefs, approvedJudicialSpans,
    // or the completeness check.

    // 1. Fetch all container pages (needed for boundary resolution)
    const allPages = await db
      .select()
      .from(researchSourcePages)
      .where(eq(researchSourcePages.containerId, id));

    const totalContainerPages = allPages.length;

    // 2. Resolve candidate page span
    const [cb] = await db.select().from(researchCaseCandidateBoundaries).where(eq(researchCaseCandidateBoundaries.candidateId, candidateId));
    let candidatePageIds: number[] = [];
    if (cb) {
      const [startBound, endBound] = await Promise.all([
        db.select().from(researchCaseBoundaries).where(eq(researchCaseBoundaries.id, cb.startBoundaryId)).then((r) => r[0]),
        db.select().from(researchCaseBoundaries).where(eq(researchCaseBoundaries.id, cb.endBoundaryId)).then((r) => r[0]),
      ]);
      if (startBound && endBound) {
        const startPageRow = allPages.find((p) => p.id === startBound.pageId);
        const endPageRow = allPages.find((p) => p.id === endBound.pageId);
        if (startPageRow && endPageRow) {
          const minPage = Math.min(startPageRow.pageNumber, endPageRow.pageNumber);
          const maxPage = Math.max(startPageRow.pageNumber, endPageRow.pageNumber);
          candidatePageIds = allPages.filter((p) => p.pageNumber >= minPage && p.pageNumber <= maxPage).map((p) => p.id);
        }
      }
    }

    const candidatePageObjs = candidatePageIds.length > 0
      ? allPages.filter((p) => candidatePageIds.includes(p.id))
      : allPages;

    // 3. Fetch sections scoped to candidate pages only
    const rawSections = candidatePageIds.length > 0
      ? await db
          .select()
          .from(researchPageSections)
          .where(and(
            eq(researchPageSections.containerId, id),
            inArray(researchPageSections.pageId, candidatePageIds),
          ))
          .orderBy(asc(researchPageSections.pageId), asc(researchPageSections.sectionIndex))
      : await db
          .select()
          .from(researchPageSections)
          .where(eq(researchPageSections.containerId, id))
          .orderBy(asc(researchPageSections.pageId), asc(researchPageSections.sectionIndex));

    const asSections: ClassifiedSection[] = rawSections.map((s) => ({
      pageId: s.pageId ?? 0,
      blockId: s.blockId ?? undefined,
      sectionIndex: s.sectionIndex,
      classification: (s.reviewerDecision ?? s.classification) as ClassifiedSection["classification"],
      confidence: s.confidence,
      supportingEvidence: s.supportingEvidence as string[],
      detectorVersion: s.detectorVersion,
    }));

    const judicialSections = applyIsolationGate(asSections);

    // Fetch extractions for page text
    const pageTextMap: Record<number, string> = {};
    if (candidatePageObjs.length > 0) {
      const exts = await db
        .select()
        .from(researchPageExtractions)
        .where(inArray(researchPageExtractions.pageId, candidatePageObjs.map((p) => p.id)))
        .orderBy(desc(researchPageExtractions.id));
      for (const ex of exts) {
        if (!(ex.pageId in pageTextMap)) pageTextMap[ex.pageId] = ex.rawText ?? "";
      }
    }

    const pageInputs: PageInput[] = candidatePageObjs.map((p) => ({
      id: p.id,
      pageNumber: p.pageNumber,
      text: pageTextMap[p.id] ?? "",
    }));

    const { criticalWarnings, nonCriticalWarnings } = checkCompleteness(
      judicialSections,
      pageInputs,
      totalContainerPages,
    );

    if (criticalWarnings.length > 0) {
      res.status(422).json({
        error: "Completeness check failed — critical warnings must be resolved before verification",
        criticalWarnings,
        nonCriticalWarnings,
      });
      return;
    }

    // Build a quick-lookup map for raw sections (pageId-sectionIndex → row)
    const rawSectionByKey = new Map<string, typeof rawSections[number]>();
    for (const s of rawSections) rawSectionByKey.set(`${s.pageId}-${s.sectionIndex}`, s);

    // Fetch block-level text for judicial sections that have a blockId.
    // On mixed pages this ensures the checksum and completeness check operate
    // only on judicial block content, never on adjacent editorial blocks.
    const judicialBlockIds = judicialSections
      .map((s) => rawSectionByKey.get(`${s.pageId}-${s.sectionIndex}`)?.blockId)
      .filter((id): id is number => id !== undefined && id !== null);
    const verifyBlockTextMap = new Map<number, string>();
    if (judicialBlockIds.length > 0) {
      const blocks = await db
        .select({ id: researchPageBlocks.id, text: researchPageBlocks.text })
        .from(researchPageBlocks)
        .where(inArray(researchPageBlocks.id, judicialBlockIds));
      for (const b of blocks) verifyBlockTextMap.set(b.id, b.text);
    }

    // Assemble judicial texts: use block text when blockId is present (section-level
    // isolation); fall back to full page text only for synthetic whole-page sections.
    const judicialTexts = judicialSections.map((s) => {
      const raw = rawSectionByKey.get(`${s.pageId}-${s.sectionIndex}`);
      if (raw?.blockId != null) return verifyBlockTextMap.get(raw.blockId) ?? "";
      return pageTextMap[s.pageId] ?? "";
    });
    const textChecksum = computeJudicialTextChecksum(judicialTexts);

    const actor = actorFrom(req);
    const pageRefs = [...new Set(judicialSections.map((s) => s.pageId))];

    // Extract paragraph identifiers from all judicial text
    const fullText = judicialTexts.join("\n");
    const paraMatches = [...fullText.matchAll(/(?:^\s*\[(\d+)\]|^\s*(\d+)\.\s+)/gm)];
    const paragraphIdentifiers = [...new Set(paraMatches.map((m) => m[1] ?? m[2] ?? "").filter(Boolean))];

    // Get latest editorial run for this container
    const latestRunRow = await db
      .select({ editorialRunId: researchPageSections.editorialRunId })
      .from(researchPageSections)
      .where(eq(researchPageSections.containerId, id))
      .orderBy(desc(researchPageSections.id))
      .limit(1);
    const editorialRunId = latestRunRow[0]?.editorialRunId ?? null;

    // ADR 0008 §6: build approved judicial spans with full provenance
    // (containerId, pageId, sectionIndex, classification, span chars)
    const approvedJudicialSpans = judicialSections.map((s) => {
      const raw = rawSectionByKey.get(`${s.pageId}-${s.sectionIndex}`);
      return {
        sectionId: raw?.id ?? 0,
        containerId: id,
        pageId: s.pageId,
        sectionIndex: s.sectionIndex,
        classification: s.classification,
        spanStartChar: raw?.spanStartChar ?? null,
        spanEndChar: raw?.spanEndChar ?? null,
      };
    });

    // ADR 0008 §6: source refs — provenance back to the container
    const containerRow = await db
      .select({
        containerId: researchSourceContainers.id,
        contentSha256: researchSourceContainers.contentSha256,
        originalName: researchSourceContainers.originalName,
      })
      .from(researchSourceContainers)
      .where(eq(researchSourceContainers.id, id))
      .then((r) => r[0]);
    const sourceRefs = containerRow
      ? [{ containerId: containerRow.containerId, contentSha256: containerRow.contentSha256, originalName: containerRow.originalName }]
      : [];

    // ADR 0008 §6: original page refs — page numbers within the source document
    const originalPageRefs = candidatePageObjs
      .filter((p) => judicialSections.some((s) => s.pageId === p.id))
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((p) => p.pageNumber);

    let verifiedJudgment: { id: number } | undefined;
    await db.transaction(async (tx) => {
      const [vj] = await tx
        .insert(researchVerifiedJudgments)
        .values({
          candidateId,
          containerId: id,
          editorialRunId,
          pageRefs,
          paragraphIdentifiers,
          textChecksum,
          approvedJudicialSpans,
          sourceRefs,
          originalPageRefs,
          unresolvedWarnings: nonCriticalWarnings,
          criticalIntegrityWarnings: [],
          unresolvedNonCriticalWarnings: nonCriticalWarnings,
          verifiedBy: actor,
          provenance: { verifiedAt: new Date().toISOString(), sectionCount: judicialSections.length },
        })
        .returning({ id: researchVerifiedJudgments.id });

      verifiedJudgment = vj;

      await tx.insert(researchTransformations).values({
        containerId: id,
        kind: "judgment.verified",
        detail: {
          candidateId,
          verifiedJudgmentId: vj?.id,
          sectionCount: judicialSections.length,
          textChecksum,
          nonCriticalWarningsCount: nonCriticalWarnings.length,
        },
        actor,
        reviewed: true,
      });

      await recordAuditEvent(tx, {
        entityType: "container",
        entityId: id,
        event: "judgment:verified",
        toState: "VERIFIED",
        actor,
        detail: { candidateId, verifiedJudgmentId: vj?.id, textChecksum },
      });

      await transitionContainer(id, "VERIFIED", {
        actor,
        detail: { candidateId, verifiedJudgmentId: vj?.id },
        dbc: tx,
      });
    });

    res.status(201).json({
      verifiedJudgmentId: verifiedJudgment?.id,
      candidateId,
      containerId: id,
      textChecksum,
      pageRefs,
      paragraphIdentifiers,
      nonCriticalWarnings,
      state: "VERIFIED",
    });
  },
);

export default router;
