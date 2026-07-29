import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { getAdapters } from "../adapters";
import { registerContainer, listContainers } from "../data/containers";
import {
  recordRightsDecision,
  listRightsRecords,
  RightsDecisionInput,
} from "../data/rights";
import { enqueue } from "../processing";
import { resolveResearchRole, requireResearchRole } from "../auth";
import { decideAccess } from "../domain/access";
import {
  AccessDeniedError,
  checkContainerAccess,
  filterSearchVisible,
  getRestrictions,
  assertExternalAiSubmissionAllowed,
  assertExportAllowed,
} from "../domain/gates";
import { EntityNotFoundError } from "../domain/types";
import uploadsRouter from "./uploads";
import extractionRouter from "./extraction";
import segmentationRouter from "./segmentation";
import candidateReviewRouter from "./candidateReview";
import editorialRouter from "./editorial";
import searchRouter from "./search";
import viewerRouter from "./viewer";
import quotationsRouter, { listForJudgmentHandler } from "./quotations";
import analysisRouter from "./analysis";
import authoritiesRouter from "./authorities";
import workspaceRouter from "./workspace";
import queueExportRouter from "./queueExport";
import { startInventory, getLatestInventory } from "../ingestion/inventory";
import { ProcessorFailure } from "../processing/handlers";
import {
  db,
  researchReviewItems,
  researchAuditEvents,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { emitAuditEvent } from "../domain/audit";
import { AuditAction } from "../domain/auditEvents";
import {
  buildExport,
  EXPORT_FORMATS,
  EXPORT_SCOPES,
  type ExportFormat,
  type ExportScope,
} from "../export/exportService";
import {
  deleteContainerLayers,
  getLatestDeletionManifest,
  LAYER_KINDS,
  type LayerKind,
} from "../retention/deletionService";

// Denied gated operations must not leak container existence: callers who
// cannot even VIEW the container get the same 404 as a non-existent id;
// only callers with view access see a 403 + structured reason.
async function denyGatedOp(
  req: import("express").Request,
  res: import("express").Response,
  containerId: number,
  err: AccessDeniedError,
): Promise<void> {
  const view = await checkContainerAccess(
    containerId,
    req.researchRole ?? null,
    "view",
    { actor: req.authEmail ?? undefined, audit: false },
  ).catch(() => null);
  if (view?.decision.allowed) {
    res.status(403).json({ error: "Forbidden", reason: err.reason });
  } else {
    res.status(404).json({ error: "Not found" });
  }
}

// Web layer of the research module. Mounted at /api/research behind the
// staff gate (requireAuth + requireStaff — see the API server's routes/
// index.ts); Phase 02 additionally resolves each staff member's research
// role and gates every resource through decideAccess (deny-by-default).
// There are NO public URLs into research data — sharing by public URL is
// structurally impossible from this router.

import { csrfGuard } from "./csrf";

const router: IRouter = Router();

router.use(resolveResearchRole);
router.use(csrfGuard);

router.get("/health", (_req, res) => {
  const adapters = getAdapters();
  res.json({
    status: "ok",
    phase: "08",
    adapters: {
      storage: adapters.storage.name,
      nativeText: {
        name: adapters.nativeText.name,
        enabled: adapters.nativeText.isEnabled(),
      },
      pageRenderer: {
        name: adapters.pageRenderer.name,
        enabled: adapters.pageRenderer.isEnabled(),
      },
      ocr: { name: adapters.ocr.name, enabled: adapters.ocr.isEnabled() },
      layout: {
        name: adapters.layout.name,
        enabled: adapters.layout.isEnabled(),
      },
      search: adapters.search.name,
      ai: { name: adapters.ai.name, enabled: adapters.ai.isEnabled() },
    },
  });
});

/** The caller's resolved research identity (no secrets). */
router.get("/me", (req, res) => {
  res.json({
    role: req.researchRole ?? null,
    researchUserId: req.researchUserId ?? null,
  });
});

const RegisterContainerBody = z.object({
  originalName: z.string().min(1),
  sourceBatch: z.string().min(1),
  contentSha256: z.string().length(64),
  sizeBytes: z.number().int().nonnegative(),
  mimeType: z.string().optional(),
});

// Registration is reserved for operational roles; rights status still always
// starts UNREVIEWED (the insert schema forbids supplying it).
router.post(
  "/containers",
  requireResearchRole("owner", "administrator", "rights_reviewer"),
  async (req, res) => {
    const parsed = RegisterContainerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const container = await registerContainer({
      ...parsed.data,
      provenance: {
        enteredVia: "api",
        registeredAt: new Date().toISOString(),
        registeredByRole: req.researchRole,
      },
    });
    await enqueue(
      "container.registered",
      `container-registered-${container.id}`,
      { containerId: container.id },
      {
        processorVersion: "container.registered@1",
        sourceChecksum: container.contentSha256,
        provenance: { containerId: container.id },
      },
    );
    res.status(201).json(container);
  },
);

// Listing applies per-container view decisions: containers the caller may
// not view are absent from the response entirely (no metadata leak).
router.get("/containers", async (req, res) => {
  const role = req.researchRole ?? null;
  const containers = await listContainers();
  const visible = [];
  for (const c of containers) {
    const restrictions = await getRestrictions(c.id);
    const decision = decideAccess({
      role,
      rightsStatus: c.rightsStatus,
      processingState: c.processingState,
      action: "view",
      restrictions,
    });
    if (decision.allowed) visible.push(c);
  }
  res.json(visible);
});

// Search listing gate: quarantined/restricted containers never appear.
router.get("/containers/search-visible", async (req, res) => {
  const role = req.researchRole ?? null;
  const containers = await listContainers();
  res.json(await filterSearchVisible(containers, role));
});

router.get("/containers/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid container id" });
    return;
  }
  try {
    const { decision, container } = await checkContainerAccess(
      id,
      req.researchRole ?? null,
      "view",
      { actor: req.authEmail ?? undefined },
    );
    if (!decision.allowed) {
      // Deny as not-found: restricted resources are invisible, not teased.
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(container);
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }
});

// ── Phase 03: secure uploads & batches (ADR 0004) ────────────────────────

router.use("/uploads", uploadsRouter);

// ── Phase 04: extraction jobs + page review (ADR 0005) ───────────────────

router.use(extractionRouter);

// ── Phase 05: segmentation jobs + candidate review (ADR 0006) ────────────

router.use(segmentationRouter);

// ── Phase 06: validation, human review & cross-file reconstruction (ADR 0007) ──

router.use(candidateReviewRouter);

// ── Phase 07: publisher-content isolation & verified judicial text (ADR 0008) ──

router.use(editorialRouter);

// ── Phase 08: search & research UI (ADR 0009) ─────────────────────────────

router.use("/search", searchRouter);
router.use("/judgments", viewerRouter);

// ── Phase 09: exact quotations & citation tools ────────────────────────────

router.use("/quotations", quotationsRouter);

// ── Phase 10: AI-generated headnotes & case analysis ─────────────────────

router.use(analysisRouter);
// Judgment-scoped quotation listing (shares the /judgments prefix already
// claimed by viewerRouter, so we register it explicitly here rather than
// inside viewerRouter to avoid touching that file).
router.get("/judgments/:judgmentId/quotations", listForJudgmentHandler);

// ── Phase 11a: Authorities & legislation extraction ───────────────────────

router.use(authoritiesRouter);

// ── Phase 11b: Research Workspace ────────────────────────────────────────

router.use(workspaceRouter);

// ── Phase 12 stress: Queue export / import ───────────────────────────────

router.use(queueExportRouter);

// Start a (rights-gated) inventory job. The processor re-checks rights
// before touching content; this endpoint additionally requires the caller
// to hold process access.
router.post(
  "/containers/:id/inventory",
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
        // Non-leak policy: callers who cannot even VIEW the container get
        // the same 404 as a non-existent id; callers with view access but
        // no process right get an explicit 403.
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
      const { jobId } = await startInventory(
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

router.get("/containers/:id/inventory", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid container id" });
    return;
  }
  try {
    const { decision } = await checkContainerAccess(
      id,
      req.researchRole ?? null,
      "view",
      { actor: req.authEmail ?? undefined },
    );
    if (!decision.allowed) {
      res.status(404).json({ error: "Not found" });
      return;
    }
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }
  const inventory = await getLatestInventory(id);
  if (!inventory) {
    res.status(404).json({ error: "No inventory recorded" });
    return;
  }
  res.json(inventory);
});

// Review-queue listing (rights / inventory / duplicate items). Containers
// the caller may not view are filtered out entirely.
router.get(
  "/review-items",
  requireResearchRole(
    "owner",
    "administrator",
    "rights_reviewer",
    "legal_reviewer",
  ),
  async (req, res) => {
    const status = req.query.status === "resolved" ? "resolved" : "open";
    const rows = await db
      .select()
      .from(researchReviewItems)
      .where(eq(researchReviewItems.status, status))
      .orderBy(desc(researchReviewItems.id))
      .limit(200);
    const visible = [];
    for (const item of rows) {
      if (item.containerId === null) {
        visible.push(item);
        continue;
      }
      try {
        const { decision } = await checkContainerAccess(
          item.containerId,
          req.researchRole ?? null,
          "view",
          { actor: req.authEmail ?? undefined, audit: false },
        );
        if (decision.allowed) visible.push(item);
      } catch {
        // Container gone — keep the review item invisible rather than leak.
      }
    }
    res.json(visible);
  },
);

// ── Rights-review workflow ────────────────────────────────────────────────

router.get(
  "/containers/:id/rights-records",
  requireResearchRole(
    "owner",
    "administrator",
    "rights_reviewer",
    "legal_reviewer",
  ),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid container id" });
      return;
    }
    // Role gate is not enough: the container-level view decision must also
    // pass (e.g. legal_reviewer cannot read records for quarantined
    // containers). Deny as 404 — restricted resources are invisible.
    try {
      const { decision } = await checkContainerAccess(
        id,
        req.researchRole ?? null,
        "view",
        { actor: req.authEmail ?? undefined },
      );
      if (!decision.allowed) {
        res.status(404).json({ error: "Not found" });
        return;
      }
    } catch (err) {
      if (err instanceof EntityNotFoundError) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
    res.json(await listRightsRecords(id));
  },
);

router.post(
  "/containers/:id/rights-decision",
  requireResearchRole("owner", "administrator", "rights_reviewer"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid container id" });
      return;
    }
    const parsed = RightsDecisionInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    try {
      const record = await recordRightsDecision(id, parsed.data, {
        actor: req.authEmail ?? `role:${req.researchRole}`,
      });
      void emitAuditEvent({
        entityType: "container",
        entityId: id,
        event: AuditAction.ADMIN_ACTION,
        actor: req.authEmail ?? `role:${req.researchRole ?? "unknown"}`,
        detail: {
          adminAction: "rights_decision",
          rightsStatus: parsed.data.status,
          rightsRecordId: record.id,
        },
      });
      res.status(201).json(record);
    } catch (err) {
      if (err instanceof EntityNotFoundError) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
  },
);

// ── Gated operations (Phase 02 builds the gates, not the features) ───────

// External-AI submission gate: structurally refuses restricted sources.
// There is no external call behind this in Phase 02.
router.post("/containers/:id/external-ai-submissions", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid container id" });
    return;
  }
  try {
    await assertExternalAiSubmissionAllowed(id, req.researchRole ?? null, {
      actor: req.authEmail ?? undefined,
    });
    // The gate passed, but external AI adapters remain disabled by default.
    res.status(503).json({
      error: "External AI adapters are disabled",
      gate: "passed",
    });
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      await denyGatedOp(req, res, id, err);
      return;
    }
    if (err instanceof EntityNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }
});

// ── Phase 12b: Real export implementation ────────────────────────────────

/**
 * POST /containers/:id/exports
 * Body: { format: ExportFormat, scope?: ExportScope }
 * Streams the generated file with appropriate Content-Disposition header.
 */
router.post("/containers/:id/exports", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid container id" });
    return;
  }

  const format = req.body?.format as string | undefined;
  const scope = (req.body?.scope as string | undefined) ?? "full";

  if (!format || !(EXPORT_FORMATS as readonly string[]).includes(format)) {
    res.status(400).json({
      error: `Invalid or missing format. Supported: ${EXPORT_FORMATS.join(", ")}`,
    });
    return;
  }
  if (!(EXPORT_SCOPES as readonly string[]).includes(scope)) {
    res.status(400).json({
      error: `Invalid scope. Supported: ${EXPORT_SCOPES.join(", ")}`,
    });
    return;
  }

  try {
    await assertExportAllowed(id, req.researchRole ?? null, {
      actor: req.authEmail ?? undefined,
    });

    const actor = req.authEmail ?? `role:${req.researchRole ?? "unknown"}`;

    // Emit the audit event before building (so it's recorded even if the render fails).
    void emitAuditEvent({
      entityType: "container",
      entityId: id,
      event: AuditAction.EXPORT_REQUESTED,
      actor,
      detail: { format, scope },
    });

    const result = await buildExport(
      id,
      format as ExportFormat,
      scope as ExportScope,
      actor,
    );

    res.setHeader("Content-Type", result.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader("Content-Length", result.buffer.length);
    res.send(result.buffer);
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      await denyGatedOp(req, res, id, err);
      return;
    }
    if (err instanceof EntityNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === "JUDGMENT_NOT_FOUND") {
      res.status(422).json({ error: "No verified judgment found for this container" });
      return;
    }
    throw err;
  }
});

/**
 * GET /containers/:id/exports/history
 * Returns the last 50 EXPORT_REQUESTED audit events for a container.
 * Owner and administrator only.
 */
router.get(
  "/containers/:id/exports/history",
  requireResearchRole("owner", "administrator"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid container id" });
      return;
    }

    const events = await db
      .select()
      .from(researchAuditEvents)
      .where(
        and(
          eq(researchAuditEvents.entityType, "container"),
          eq(researchAuditEvents.entityId, id),
          eq(researchAuditEvents.event, AuditAction.EXPORT_REQUESTED),
        ),
      )
      .orderBy(desc(researchAuditEvents.createdAt))
      .limit(50);

    res.json({ containerId: id, total: events.length, events });
  },
);

// ── Phase 12c: Granular deletion + manifest routes ────────────────────────

const DeleteLayersBody = z.object({
  layers: z.array(z.enum(LAYER_KINDS as unknown as [string, ...string[]])).min(1),
});

/**
 * DELETE /containers/:id/layers
 * Body: { layers: LayerKind[] }
 * Owner/administrator only. Deletes the specified data layers for the
 * container and returns a deletion manifest. Failures on individual
 * layers are collected; already-completed layers are not rolled back.
 * The manifest always states backupConfirmed: false.
 */
router.delete(
  "/containers/:id/layers",
  requireResearchRole("owner", "administrator"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid container id" });
      return;
    }

    const parsed = DeleteLayersBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    const actor = req.authEmail ?? `role:${req.researchRole ?? "unknown"}`;

    try {
      // Verify the container exists and the caller has view access.
      const { decision } = await checkContainerAccess(
        id,
        req.researchRole ?? null,
        "view",
        { actor },
      );
      if (!decision.allowed) {
        res.status(404).json({ error: "Not found" });
        return;
      }
    } catch (err) {
      if (err instanceof EntityNotFoundError) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }

    const manifest = await deleteContainerLayers(
      id,
      parsed.data.layers as LayerKind[],
      actor,
    );

    res.json(manifest);
  },
);

/**
 * GET /containers/:id/deletion-manifest
 * Returns the most recent deletion manifest for a container from object
 * storage. Owner and administrator only.
 */
router.get(
  "/containers/:id/deletion-manifest",
  requireResearchRole("owner", "administrator"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid container id" });
      return;
    }

    const manifest = await getLatestDeletionManifest(id);
    if (!manifest) {
      res.status(404).json({ error: "No deletion manifest found for this container" });
      return;
    }
    res.json(manifest);
  },
);

// ── Phase 14: Per-container audit trail ───────────────────────────────────

/**
 * GET /containers/:id/audit
 * Returns all audit events for a container in chronological order.
 * Optional ?stage= filter: upload | rights | extraction | segmentation |
 *   verification | search | export
 */
router.get(
  "/containers/:id/audit",
  requireResearchRole("owner", "administrator", "rights_reviewer", "legal_reviewer"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid container id" });
      return;
    }
    try {
      const { decision } = await checkContainerAccess(id, req.researchRole ?? null, "view", {
        actor: req.authEmail ?? undefined,
        audit: false,
      });
      if (!decision.allowed) {
        res.status(404).json({ error: "Not found" });
        return;
      }
    } catch (err) {
      if (err instanceof EntityNotFoundError) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }

    const stage = typeof req.query.stage === "string" ? req.query.stage : undefined;

    // Stage → event-prefix allow-list
    const STAGE_PREFIXES: Record<string, string[]> = {
      upload:       ["upload", "state-transition", "duplicate", "batch"],
      rights:       ["rights", "state-transition", "access"],
      extraction:   ["ocr", "extraction", "state-transition"],
      segmentation: ["segmentation", "boundary", "state-transition"],
      verification: ["editorial", "editorial-classification", "judgment", "state-transition"],
      search:       ["search"],
      export:       ["export", "print"],
    };

    const rows = await db
      .select()
      .from(researchAuditEvents)
      .where(
        and(
          eq(researchAuditEvents.entityType, "container"),
          eq(researchAuditEvents.entityId, id),
        ),
      )
      .orderBy(researchAuditEvents.createdAt)
      .limit(500);

    const allowedPrefixes = stage ? STAGE_PREFIXES[stage] : undefined;
    const filtered = allowedPrefixes
      ? rows.filter((r) =>
          allowedPrefixes.some((p) => r.event.toLowerCase().startsWith(p)),
        )
      : rows;

    res.json({ containerId: id, stage: stage ?? "all", total: filtered.length, events: filtered });
  },
);

// ── Phase 14: Quotation-integrity check ───────────────────────────────────

const QuotationCheckBody = z.object({
  candidateId: z.number().int().positive(),
  /**
   * Strings the reviewer wants to verify against the raw OCR/extraction.
   * Each must be 10–500 characters. Supply passages from an independent
   * source (e.g. a published law report) — NOT strings copied from the
   * review UI itself.  At most 20 strings per call.
   */
  quotesToVerify: z
    .array(z.string().min(10).max(500))
    .min(1)
    .max(20),
});

/**
 * POST /containers/:id/quotation-check
 * Body: { candidateId: number, quotesToVerify: string[] }
 *
 * For each string in `quotesToVerify` (provided by the reviewer from an
 * independent source — e.g. a published law report or court document) this
 * endpoint reports whether the string appears verbatim in the container's
 * raw OCR/extraction corpus.
 *
 * The source of the strings to check is intentionally kept external to the
 * pipeline: if they came from the extraction corpus itself the check would
 * be circular and unable to detect extraction errors.
 */
router.post(
  "/containers/:id/quotation-check",
  requireResearchRole(
    "owner",
    "administrator",
    "rights_reviewer",
    "legal_reviewer",
    "researcher",
  ),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid container id" });
      return;
    }

    const parsed = QuotationCheckBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    try {
      const { decision } = await checkContainerAccess(id, req.researchRole ?? null, "view", {
        actor: req.authEmail ?? undefined,
      });
      if (!decision.allowed) {
        res.status(404).json({ error: "Not found" });
        return;
      }
    } catch (err) {
      if (err instanceof EntityNotFoundError) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }

    const {
      researchCaseCandidates: rcc,
      researchSourcePages: rsp,
      researchPageExtractions: rpe,
    } = await import("@workspace/db");

    // Confirm candidate belongs to this container (authorization boundary).
    const [candidate] = await db
      .select({ id: rcc.id })
      .from(rcc)
      .where(and(eq(rcc.id, parsed.data.candidateId), eq(rcc.containerId, id)))
      .limit(1);

    if (!candidate) {
      res.status(404).json({ error: "Candidate not found on this container" });
      return;
    }

    // Build full source corpus from the container's raw OCR/extraction pages.
    // This is the authoritative verbatim text from the ingestion pipeline.
    const allPages = await db
      .select()
      .from(rsp)
      .where(eq(rsp.containerId, id));

    const allPageIds = allPages.map((p) => p.id);

    const allExtractions = allPageIds.length > 0
      ? await db
          .select()
          .from(rpe)
          .where(inArray(rpe.pageId, allPageIds))
      : [];

    // Latest extraction per page (highest id wins).
    const latestByPage = new Map<number, string>();
    const sortedExts = [...allExtractions].sort((a, b) => b.id - a.id);
    for (const ex of sortedExts) {
      if (!latestByPage.has(ex.pageId) && ex.rawText) {
        latestByPage.set(ex.pageId, ex.rawText);
      }
    }
    const fullSourceText = allPages
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((p) => latestByPage.get(p.id) ?? "")
      .join("\n");

    // Check each reviewer-supplied string against the independent source corpus.
    // foundInSource=true  → exact passage present in OCR output (expected)
    // foundInSource=false → passage absent — OCR error, wrong container, or
    //                       the passage was not in this document.
    const quotes = parsed.data.quotesToVerify.map((text) => ({
      text,
      foundInSource: fullSourceText.includes(text),
    }));

    const foundCount = quotes.filter((q) => q.foundInSource).length;
    res.json({
      containerId: id,
      candidateId: parsed.data.candidateId,
      quotesChecked: quotes.length,
      quotes,
      integrityNote: `${foundCount}/${quotes.length} supplied passages verified verbatim in source extraction corpus.`,
      checkedAt: new Date().toISOString(),
    });
  },
);

// ── Phase 12a: Admin audit-event query route ──────────────────────────────

/**
 * GET /api/research/audit-events
 * Paginated audit log. Owner and administrator only.
 * Filters: actor, action (event name), entityKind, entityId, dateFrom, dateTo.
 * Returns events in descending created_at order (newest first).
 */
router.get(
  "/audit-events",
  requireResearchRole("owner", "administrator"),
  async (req, res) => {
    const actor = typeof req.query.actor === "string" ? req.query.actor : undefined;
    const action = typeof req.query.action === "string" ? req.query.action : undefined;
    const entityKind = typeof req.query.entityKind === "string" ? req.query.entityKind : undefined;
    const entityId = req.query.entityId ? Number(req.query.entityId) : undefined;
    const dateFrom = typeof req.query.dateFrom === "string" ? new Date(req.query.dateFrom) : undefined;
    const dateTo = typeof req.query.dateTo === "string" ? new Date(req.query.dateTo) : undefined;
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);

    const conditions = [];
    if (actor) conditions.push(eq(researchAuditEvents.actor, actor));
    if (action) conditions.push(eq(researchAuditEvents.event, action));
    if (entityKind) conditions.push(eq(researchAuditEvents.entityType, entityKind));
    if (entityId !== undefined && !isNaN(entityId)) {
      conditions.push(eq(researchAuditEvents.entityId, entityId));
    }
    if (dateFrom && !isNaN(dateFrom.getTime())) {
      conditions.push(gte(researchAuditEvents.createdAt, dateFrom));
    }
    if (dateTo && !isNaN(dateTo.getTime())) {
      conditions.push(lte(researchAuditEvents.createdAt, dateTo));
    }

    const rows = await db
      .select()
      .from(researchAuditEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(researchAuditEvents.createdAt))
      .limit(limit)
      .offset(offset);

    // Count total matching rows for pagination metadata.
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(researchAuditEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    res.json({ total: count, limit, offset, events: rows });
  },
);

export default router;
