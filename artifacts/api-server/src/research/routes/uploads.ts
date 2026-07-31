import { Router, type IRouter } from "express";
import multer from "multer";
import { z } from "zod/v4";
import { requireResearchRole } from "../auth";
import {
  getBatch,
  getBatchItem,
  listBatches,
  listBatchItems,
  listBatchItemsWithTiming,
  computeAvgSecondsPerItem,
  computeProgress,
  syncDeadLetters,
} from "../data/uploads";
import {
  processUpload,
  retryBatchItem,
  cancelBatch,
  restartBatch,
  registerIngestionProcessors,
} from "../ingestion/service";
import { registerInventoryProcessor, startInventory } from "../ingestion/inventory";
import { recordRightsDecision } from "../data/rights";
import { getContainer } from "../data/containers";
import { LIMITS } from "../ingestion/validation";
import { ProcessorFailure } from "../processing/handlers";
import { StateTransitionError, EntityNotFoundError } from "../domain/types";

// Phase 03 upload/batch routes (ADR 0004). Mounted inside the research
// router: staff gate + research-role resolution already applied. Upload and
// batch control are reserved for operational roles.

registerIngestionProcessors();
registerInventoryProcessor();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LIMITS.maxFileBytes, files: 25 },
});

const UploadBody = z.object({
  declaredSource: z.string().min(1, "declaredSource is required"),
});

const router: IRouter = Router();

const OPERATIONAL = ["owner", "administrator", "rights_reviewer"] as const;

router.post(
  "/",
  requireResearchRole(...OPERATIONAL),
  (req, res, next) => {
    upload.array("files")(req, res, (err) => {
      if (err) {
        res.status(400).json({
          error: "Upload rejected",
          code: err instanceof multer.MulterError ? err.code : "UPLOAD_ERROR",
        });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const parsed = UploadBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "No files provided" });
      return;
    }
    const actor = req.authEmail ?? `role:${req.researchRole}`;
    const { batch, items } = await processUpload(
      files.map((f) => ({
        originalName: f.originalname,
        bytes: f.buffer,
        declaredMime: f.mimetype,
      })),
      {
        declaredSource: parsed.data.declaredSource,
        uploadedBy: actor,
        provenance: { enteredVia: "upload-api", role: req.researchRole },
      },
    );
    res.status(201).json({
      batch,
      progress: computeProgress(items),
      items: items.map((i) => ({
        id: i.id,
        originalPath: i.originalPath,
        state: i.state,
        errorReport: i.errorReport,
      })),
    });
  },
);

router.get("/", requireResearchRole(...OPERATIONAL), async (_req, res) => {
  res.json(await listBatches());
});

// Batch progress. Dead letters are synced on read: PENDING items whose jobs
// ended FAILED_PERMANENT surface as DEAD_LETTER with per-file error reports.
router.get("/:id", requireResearchRole(...OPERATIONAL), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid batch id" });
    return;
  }
  const batch = await getBatch(id);
  if (!batch) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await syncDeadLetters(id);
  const items = await listBatchItemsWithTiming(id);
  const avgSecondsPerItem = computeAvgSecondsPerItem(items);
  res.json({
    batch,
    progress: computeProgress(items),
    avgSecondsPerItem,
    items: items.map((i) => ({
      id: i.id,
      originalPath: i.originalPath,
      state: i.state,
      errorReport: i.errorReport,
      jobState: i.jobState,
      jobStartedAt: i.jobStartedAt,
      jobFinishedAt: i.jobFinishedAt,
    })),
  });
});

router.post(
  "/:id/items/:itemId/retry",
  requireResearchRole(...OPERATIONAL),
  async (req, res) => {
    const id = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(id) || !Number.isInteger(itemId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    await syncDeadLetters(id);
    const item = await getBatchItem(itemId);
    if (!item || item.batchId !== id) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    try {
      const updated = await retryBatchItem(
        itemId,
        req.authEmail ?? `role:${req.researchRole}`,
      );
      res.json(updated);
    } catch (err) {
      if (err instanceof StateTransitionError) {
        res.status(409).json({ error: err.message });
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

router.post(
  "/:id/cancel",
  requireResearchRole(...OPERATIONAL),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid batch id" });
      return;
    }
    if (!(await getBatch(id))) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const cancelled = await cancelBatch(
      id,
      req.authEmail ?? `role:${req.researchRole}`,
    );
    res.json({ cancelled });
  },
);

/**
 * Bulk rights approval for a batch. Finds all INGESTED batch items whose
 * container is still at RIGHTS_REVIEW_REQUIRED, records an OFFICIAL_COURT_SOURCE
 * rights decision for each, then kicks off the inventory job so the pipeline
 * continues automatically (RIGHTS_REVIEW_REQUIRED → RIGHTS_APPROVED →
 * INVENTORY_PENDING → full pipeline).
 *
 * Idempotent: already-approved containers are skipped.
 */
router.post(
  "/:id/approve-rights",
  requireResearchRole(...OPERATIONAL),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid batch id" });
      return;
    }
    const batch = await getBatch(id);
    if (!batch) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const actor = req.authEmail ?? `role:${req.researchRole}`;
    const items = await listBatchItems(id);
    const now = new Date();

    let approved = 0;
    let skipped = 0;
    const errors: { containerId: number; error: string }[] = [];

    for (const item of items) {
      if (!item.containerId) continue;
      const container = await getContainer(item.containerId);
      if (!container) continue;
      if (container.processingState !== "RIGHTS_REVIEW_REQUIRED") {
        skipped += 1;
        continue;
      }
      try {
        await recordRightsDecision(
          item.containerId,
          {
            status: "OFFICIAL_COURT_SOURCE",
            reason:
              "Official court judgment — approved for research use (bulk batch approval)",
            source: batch.declaredSource,
            dateObtained: now,
            declaredSourceType: "official_court_judgment",
            licenceReference: null,
            approvedUsers: [],
            approvedPurposes: ["research", "analysis", "ai_processing"],
            storagePermitted: true,
            analysisPermitted: true,
            externalProcessingPermitted: true,
            studentAccessPermitted: false,
            printingPermitted: false,
            exportPermitted: false,
            retentionPeriod: null,
            expiryDate: null,
            reviewer: actor,
            reviewDate: now,
            notes: `Bulk-approved via admin batch #${id}`,
          },
          { actor },
        );
        await startInventory(item.containerId, actor);
        approved += 1;
      } catch (err) {
        errors.push({
          containerId: item.containerId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    res.json({ approved, skipped, errors });
  },
);

router.post(
  "/:id/restart",
  requireResearchRole(...OPERATIONAL),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid batch id" });
      return;
    }
    if (!(await getBatch(id))) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    try {
      const restarted = await restartBatch(
        id,
        req.authEmail ?? `role:${req.researchRole}`,
      );
      res.json({ restarted });
    } catch (err) {
      if (err instanceof EntityNotFoundError) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }
  },
);

export default router;
