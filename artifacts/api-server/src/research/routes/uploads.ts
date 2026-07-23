import { Router, type IRouter } from "express";
import multer from "multer";
import { z } from "zod/v4";
import { requireResearchRole } from "../auth";
import {
  getBatch,
  getBatchItem,
  listBatches,
  listBatchItems,
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
import { registerInventoryProcessor } from "../ingestion/inventory";
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
  const items = await listBatchItems(id);
  res.json({ batch, progress: computeProgress(items), items });
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
