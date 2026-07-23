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
import { startInventory, getLatestInventory } from "../ingestion/inventory";
import { ProcessorFailure } from "../processing/handlers";
import { db, researchReviewItems } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

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

const router: IRouter = Router();

router.use(resolveResearchRole);

router.get("/health", (_req, res) => {
  const adapters = getAdapters();
  res.json({
    status: "ok",
    phase: "05",
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

// Export gate: rights caps + express approval in the latest rights record.
router.post("/containers/:id/exports", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid container id" });
    return;
  }
  try {
    const container = await assertExportAllowed(id, req.researchRole ?? null, {
      actor: req.authEmail ?? undefined,
    });
    res.json({
      gate: "passed",
      containerId: container.id,
      note: "Export mechanics arrive in a later phase; approval verified.",
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

export default router;
