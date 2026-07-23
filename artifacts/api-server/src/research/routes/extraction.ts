import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import {
  db,
  researchExtractionRuns,
  researchPageBlocks,
  researchPageCorrections,
  researchPageExtractions,
  researchPageWarnings,
  researchSourcePages,
} from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { getAdapters } from "../adapters";
import { requireResearchRole } from "../auth";
import { recordAuditEvent } from "../domain/audit";
import { checkContainerAccess } from "../domain/gates";
import { EntityNotFoundError } from "../domain/types";
import { ProcessorFailure } from "../processing/handlers";
import {
  startExtraction,
  getLatestExtractionRun,
  registerExtractionProcessor,
} from "../extraction/pipeline";
import { reviewUiHtml } from "./reviewUi";

// Phase 04 web layer: extraction jobs + the page-review surface. Mounted
// inside the research router (staff gate + research-role resolution already
// applied). Raw extraction rows are immutable — the only write here is the
// append-only correction endpoint.

registerExtractionProcessor();

const router: IRouter = Router();

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

/** Resolve a page extraction with its page + container, or 404. */
async function getPageExtraction(id: number) {
  const [row] = await db
    .select({
      extraction: researchPageExtractions,
      page: researchSourcePages,
    })
    .from(researchPageExtractions)
    .innerJoin(
      researchSourcePages,
      eq(researchPageExtractions.pageId, researchSourcePages.id),
    )
    .where(eq(researchPageExtractions.id, id));
  return row;
}

// Start a (rights-gated) extraction job; processor re-checks rights.
router.post(
  "/containers/:id/extract",
  requireResearchRole("owner", "administrator", "rights_reviewer"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid container id" });
      return;
    }
    try {
      const { decision } = await checkContainerAccess(
        id,
        req.researchRole ?? null,
        "process",
        { actor: req.authEmail ?? undefined },
      );
      if (!decision.allowed) {
        const { decision: viewDecision } = await checkContainerAccess(
          id,
          req.researchRole ?? null,
          "view",
          { actor: req.authEmail ?? undefined },
        );
        if (!viewDecision.allowed) {
          res.status(404).json({ error: "Not found" });
          return;
        }
        res.status(403).json({ error: "Forbidden", reason: decision.reason });
        return;
      }
      const { jobId } = await startExtraction(
        id,
        req.authEmail ?? `role:${req.researchRole}`,
      );
      res.status(202).json({ jobId });
    } catch (err) {
      if (err instanceof EntityNotFoundError) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (err instanceof ProcessorFailure) {
        res.status(409).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  },
);

// Latest extraction run for a container.
router.get("/containers/:id/extraction", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid container id" });
    return;
  }
  if (!(await requireContainerView(req, res, id))) return;
  const run = await getLatestExtractionRun(id);
  if (!run) {
    res.status(404).json({ error: "No extraction recorded" });
    return;
  }
  res.json(run);
});

// Page list for the latest run: number, mode, blank flag, warning count.
router.get("/containers/:id/pages", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid container id" });
    return;
  }
  if (!(await requireContainerView(req, res, id))) return;
  const run = await getLatestExtractionRun(id);
  if (!run) {
    res.status(404).json({ error: "No extraction recorded" });
    return;
  }
  const rows = await db
    .select({
      extraction: researchPageExtractions,
      page: researchSourcePages,
    })
    .from(researchPageExtractions)
    .innerJoin(
      researchSourcePages,
      eq(researchPageExtractions.pageId, researchSourcePages.id),
    )
    .where(eq(researchPageExtractions.runId, run.id))
    .orderBy(asc(researchSourcePages.pageNumber));
  const pages = [];
  for (const { extraction, page } of rows) {
    const warnings = await db
      .select({ id: researchPageWarnings.id })
      .from(researchPageWarnings)
      .where(eq(researchPageWarnings.pageExtractionId, extraction.id));
    pages.push({
      pageExtractionId: extraction.id,
      pageNumber: page.pageNumber,
      mode: extraction.mode,
      isBlank: extraction.isBlank,
      ocrMeanConfidence: extraction.ocrMeanConfidence,
      hasImage: extraction.imageStorageKey !== null,
      warningCount: warnings.length,
      charStart: extraction.charStart,
      charEnd: extraction.charEnd,
    });
  }
  res.json({ runId: run.id, status: run.status, pages });
});

// Full page detail: raw text, blocks, warnings, correction history.
router.get("/pages/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid page extraction id" });
    return;
  }
  const row = await getPageExtraction(id);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!(await requireContainerView(req, res, row.page.containerId))) return;
  const [blocks, warnings, corrections] = await Promise.all([
    db
      .select()
      .from(researchPageBlocks)
      .where(eq(researchPageBlocks.pageExtractionId, id))
      .orderBy(asc(researchPageBlocks.readingOrder)),
    db
      .select()
      .from(researchPageWarnings)
      .where(eq(researchPageWarnings.pageExtractionId, id)),
    db
      .select()
      .from(researchPageCorrections)
      .where(eq(researchPageCorrections.pageExtractionId, id))
      .orderBy(desc(researchPageCorrections.version)),
  ]);
  res.json({
    extraction: row.extraction,
    pageNumber: row.page.pageNumber,
    containerId: row.page.containerId,
    blocks,
    warnings,
    corrections,
  });
});

// Original page image (OCR'd pages). Streams the stored PNG — no public
// URL exists; access re-checks the container view decision every request.
router.get("/pages/:id/image", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid page extraction id" });
    return;
  }
  const row = await getPageExtraction(id);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (!(await requireContainerView(req, res, row.page.containerId))) return;
  if (!row.extraction.imageStorageKey) {
    res.status(404).json({ error: "No page image stored" });
    return;
  }
  const png = await getAdapters().storage.get(row.extraction.imageStorageKey);
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "private, no-store");
  res.send(png);
});

const CorrectionBody = z.object({
  correctedText: z.string(),
  reason: z.string().min(1),
});

// Append-only correction. The raw extraction row is never modified; each
// correction stores the raw output it corrected, the reviewer, the reason,
// and the processor version — with an atomic audit event.
router.post(
  "/pages/:id/corrections",
  requireResearchRole(
    "owner",
    "administrator",
    "rights_reviewer",
    "legal_reviewer",
  ),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid page extraction id" });
      return;
    }
    const parsed = CorrectionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const row = await getPageExtraction(id);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (!(await requireContainerView(req, res, row.page.containerId))) return;
    const reviewer = req.authEmail ?? `role:${req.researchRole}`;

    // Retry once on version collision (concurrent corrections).
    for (let attempt = 0; attempt < 2; attempt++) {
      const [latest] = await db
        .select({ version: researchPageCorrections.version })
        .from(researchPageCorrections)
        .where(eq(researchPageCorrections.pageExtractionId, id))
        .orderBy(desc(researchPageCorrections.version))
        .limit(1);
      const version = (latest?.version ?? 0) + 1;
      try {
        const correction = await db.transaction(async (tx) => {
          const [inserted] = await tx
            .insert(researchPageCorrections)
            .values({
              pageExtractionId: id,
              version,
              rawOutput: row.extraction.rawText,
              correctedText: parsed.data.correctedText,
              reviewer,
              reason: parsed.data.reason,
              processorVersion: row.extraction.provenance?.[
                "processorVersion"
              ] as string ?? "unknown",
            })
            .returning();
          await recordAuditEvent(tx, {
            entityType: "page_extraction",
            entityId: id,
            event: "correction",
            actor: reviewer,
            detail: {
              version,
              reason: parsed.data.reason,
              containerId: row.page.containerId,
              pageNumber: row.page.pageNumber,
            },
          });
          return inserted;
        });
        res.status(201).json(correction);
        return;
      } catch (err) {
        const isUnique = (e: unknown): boolean => {
          if (typeof e !== "object" || e === null) return false;
          const x = e as { code?: unknown; cause?: unknown };
          return x.code === "23505" || isUnique(x.cause);
        };
        if (isUnique(err) && attempt === 0) continue;
        throw err;
      }
    }
  },
);

// Staff-only page-review UI (server-rendered shell; data via the JSON
// endpoints above, same staff gate + per-request access checks).
router.get("/containers/:id/review-ui", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid container id" });
    return;
  }
  if (!(await requireContainerView(req, res, id))) return;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.send(reviewUiHtml(id));
});

export default router;
