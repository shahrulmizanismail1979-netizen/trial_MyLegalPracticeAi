/**
 * Research Admin API — password-gated routes for the Case Law Research Admin
 * portal (/research-admin/). Uses ADMIN_PASSWORD session auth rather than
 * Clerk, so the standalone admin frontend can log in without a Clerk tenant.
 *
 * Mounted at /api/research-admin (outside the Clerk-gated /api/research prefix).
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod/v4";
import {
  db,
  driveAssets,
  driveInventoryRuns,
  researchJobs,
  researchAuditEvents,
  researchHeadnotes,
  researchCatchwords,
  researchVerifiedJudgments,
  researchCaseMetadata,
  researchSourceContainers,
  researchUploadBatchItems,
} from "@workspace/db";
import { and, asc, count, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { getAllFolderChildren, DRIVE_FOLDER_MIME } from "../research/drive/driveClient";
import { classifyDriveFile, rightsStatusForClassification } from "../research/drive/classify";
import {
  startBulkPipeline,
  getPipelineRunStatus,
  syncPipelineStatuses,
  ingestDriveAsset,
} from "../research/drive/ingestBridge";
import { DRIVE_INGEST_JOB_KIND, DRIVE_INGEST_PROCESSOR_VERSION } from "../research/drive/driveIngestProcessor";
import { enqueueHeadnotesJob, HEADNOTES_JOB_KIND, HEADNOTES_PROCESSOR_VERSION } from "../research/headnotes/processor";
import { recordRightsDecision } from "../research/data/rights";
import { startInventory } from "../research/ingestion/inventory";

const IS_PROD = process.env.NODE_ENV === "production";
const ADMIN_PASSWORD: string | null =
  process.env.ADMIN_PASSWORD || (IS_PROD ? null : "admin123");

if (!ADMIN_PASSWORD) {
  console.warn(
    "[research-admin] ADMIN_PASSWORD is not set — research-admin login is disabled until configured",
  );
}

const ROOT_FOLDER_ID = "1Rm5yiE4DsXEG1mVwbcTL8ehneCCRAtbx";

// ── Cookie-based auth (uses cookie-parser signed cookies) ────────────────────
const COOKIE_NAME = "ra_auth";

function requireAdminSession(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.signedCookies?.[COOKIE_NAME] === "1") {
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
}

// ── Router ───────────────────────────────────────────────────────────────────
const router = Router();

// ── Auth endpoints (no session required) ─────────────────────────────────────

router.post("/auth/login", (req: Request, res: Response) => {
  if (!ADMIN_PASSWORD) {
    res.status(503).json({ error: "Admin auth not configured" });
    return;
  }
  const { password } = (req.body ?? {}) as { password?: string };
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }
  res.cookie(COOKIE_NAME, "1", {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000, // 24h
  });
  res.json({ ok: true });
});

router.post("/auth/logout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get("/auth/me", (req: Request, res: Response) => {
  const authed = req.signedCookies?.[COOKIE_NAME] === "1";
  res.json({ authed });
});

// ── Dashboard Stats ───────────────────────────────────────────────────────────

router.get("/stats", requireAdminSession, async (_req: Request, res: Response) => {
  const [
    [totalRow],
    [approvedRow],
    [restrictedRow],
    [rightsReviewRow],
    [needsOfficialRow],
    [publishedRow],
    [failedRow],
    [pendingRow],
    [queuedJobsRow],
    [failedJobsRow],
    [latestRun],
  ] = await Promise.all([
    db.select({ c: count() }).from(driveAssets),
    db.select({ c: count() }).from(driveAssets).where(eq(driveAssets.rightsStatus, "APPROVED")),
    db.select({ c: count() }).from(driveAssets).where(eq(driveAssets.rightsStatus, "RESTRICTED_REFERENCE_ONLY")),
    db.select({ c: count() }).from(driveAssets).where(eq(driveAssets.rightsStatus, "RIGHTS_REVIEW_REQUIRED")),
    db.select({ c: count() }).from(driveAssets).where(eq(driveAssets.rightsStatus, "NEEDS_OFFICIAL_SOURCE")),
    db.select({ c: count() }).from(driveAssets).where(eq(driveAssets.processingStatus, "PUBLISHED")),
    db.select({ c: count() }).from(driveAssets).where(eq(driveAssets.processingStatus, "FAILED")),
    db.select({ c: count() }).from(driveAssets).where(eq(driveAssets.processingStatus, "PENDING")),
    db.select({ c: count() }).from(researchJobs).where(eq(researchJobs.state, "QUEUED")),
    db.select({ c: count() }).from(researchJobs).where(eq(researchJobs.state, "FAILED_PERMANENT")),
    db.select().from(driveInventoryRuns).orderBy(desc(driveInventoryRuns.createdAt)).limit(1),
  ]);

  res.json({
    totalDriveAssets: totalRow?.c ?? 0,
    approved: approvedRow?.c ?? 0,
    restricted: restrictedRow?.c ?? 0,
    rightsReview: rightsReviewRow?.c ?? 0,
    needsOfficialSource: needsOfficialRow?.c ?? 0,
    published: publishedRow?.c ?? 0,
    failed: failedRow?.c ?? 0,
    pending: pendingRow?.c ?? 0,
    queuedJobs: queuedJobsRow?.c ?? 0,
    failedJobs: failedJobsRow?.c ?? 0,
    latestInventoryRun: latestRun ?? null,
  });
});

// ── Drive Inventory ───────────────────────────────────────────────────────────

router.post("/drive/inventory/start", requireAdminSession, async (req: Request, res: Response) => {
  // Prevent concurrent runs
  const [existing] = await db
    .select({ id: driveInventoryRuns.id })
    .from(driveInventoryRuns)
    .where(eq(driveInventoryRuns.status, "RUNNING"))
    .limit(1);

  if (existing) {
    res.status(409).json({
      error: "An inventory run is already in progress",
      runId: existing.id,
    });
    return;
  }

  const [run] = await db
    .insert(driveInventoryRuns)
    .values({
      rootFolderId: ROOT_FOLDER_ID,
      actorId: "admin",
    })
    .returning();

  // Fire-and-forget — errors are written back to the run row
  runDriveInventory(run!.id, ROOT_FOLDER_ID).catch((err: unknown) => {
    console.error("[drive-inventory] Fatal:", err);
    db.update(driveInventoryRuns)
      .set({
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: String(err),
      })
      .where(eq(driveInventoryRuns.id, run!.id))
      .catch(console.error);
  });

  res.status(202).json({ runId: run!.id, status: "RUNNING" });
});

router.get("/drive/inventory/status", requireAdminSession, async (_req: Request, res: Response) => {
  const [run] = await db
    .select()
    .from(driveInventoryRuns)
    .orderBy(desc(driveInventoryRuns.createdAt))
    .limit(1);
  res.json(run ?? null);
});

router.get("/drive/inventory/runs", requireAdminSession, async (_req: Request, res: Response) => {
  const runs = await db
    .select()
    .from(driveInventoryRuns)
    .orderBy(desc(driveInventoryRuns.createdAt))
    .limit(50);
  res.json(runs);
});

// ── Drive Assets ──────────────────────────────────────────────────────────────

router.get("/drive/assets", requireAdminSession, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const rightsStatus = req.query.rightsStatus as string | undefined;
  const processingStatus = req.query.processingStatus as string | undefined;
  const sourceClassification = req.query.sourceClassification as string | undefined;
  const search = req.query.search as string | undefined;

  const conditions = [];
  if (rightsStatus) conditions.push(eq(driveAssets.rightsStatus, rightsStatus as Parameters<typeof eq>[1]));
  if (processingStatus) conditions.push(eq(driveAssets.processingStatus, processingStatus as Parameters<typeof eq>[1]));
  if (sourceClassification) conditions.push(eq(driveAssets.sourceClassification, sourceClassification as Parameters<typeof eq>[1]));
  if (search) {
    conditions.push(
      sql`(${driveAssets.name} ILIKE ${`%${search}%`} OR ${driveAssets.folderPath} ILIKE ${`%${search}%`})`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(driveAssets)
      .where(where)
      .orderBy(desc(driveAssets.inventoryTimestamp))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(driveAssets)
      .where(where),
  ]);

  res.json({ total, limit, offset, assets: rows });
});

router.get("/drive/assets/:id", requireAdminSession, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [asset] = await db.select().from(driveAssets).where(eq(driveAssets.id, id));
  if (!asset) { res.status(404).json({ error: "Not found" }); return; }
  res.json(asset);
});

const PatchRightsSchema = z.object({
  rightsStatus: z.enum([
    "RESTRICTED_REFERENCE_ONLY",
    "NEEDS_OFFICIAL_SOURCE",
    "RIGHTS_REVIEW_REQUIRED",
    "APPROVED",
  ]),
});

/**
 * Bulk-update rights_status for all RIGHTS_REVIEW_REQUIRED assets.
 * Optionally filter by source_classification.
 * Body: { rightsStatus, sourceClassification? }
 */
router.post("/drive/assets/bulk-rights", requireAdminSession, async (req: Request, res: Response) => {
  const BulkSchema = z.object({
    rightsStatus: z.enum(["APPROVED", "RESTRICTED_REFERENCE_ONLY", "NEEDS_OFFICIAL_SOURCE"]),
    sourceClassification: z.string().optional(),
  });

  const parsed = BulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }

  const conditions = [eq(driveAssets.rightsStatus, "RIGHTS_REVIEW_REQUIRED")];
  if (parsed.data.sourceClassification) {
    conditions.push(eq(driveAssets.sourceClassification, parsed.data.sourceClassification as Parameters<typeof eq>[1]));
  }

  // Atomically update rights AND insert durable job rows in one transaction.
  // If the job inserts fail for any reason the rights change rolls back too,
  // preventing stranded APPROVED/PENDING assets with no processing job.
  const { updatedCount, ingestionQueued } = await db.transaction(async (tx) => {
    const updated = await tx
      .update(driveAssets)
      .set({ rightsStatus: parsed.data.rightsStatus, updatedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: driveAssets.id });

    const updatedIds = updated.map((r) => r.id);
    let queued = 0;

    if (parsed.data.rightsStatus === "APPROVED" && updatedIds.length > 0) {
      // Batch-insert job rows directly (ON CONFLICT DO NOTHING for idempotency).
      // Chunk by 200 to stay well within Postgres's parameter limit.
      const CHUNK = 200;
      for (let i = 0; i < updatedIds.length; i += CHUNK) {
        const chunk = updatedIds.slice(i, i + CHUNK);
        const inserted = await tx
          .insert(researchJobs)
          .values(
            chunk.map((assetId) => ({
              kind: DRIVE_INGEST_JOB_KIND,
              idempotencyKey: `drive.ingest:asset:${assetId}`,
              payload: { driveAssetId: assetId } as Record<string, unknown>,
              maxAttempts: 3,
              processorVersion: DRIVE_INGEST_PROCESSOR_VERSION,
              provenance: { actor: "admin-bulk-approve" } as Record<string, unknown>,
            })),
          )
          .onConflictDoNothing({ target: researchJobs.idempotencyKey })
          .returning({ id: researchJobs.id });
        queued += inserted.length;
      }
    }

    return { updatedCount: updatedIds.length, ingestionQueued: queued };
  });

  res.json({ updated: updatedCount, ingestionQueued });
});

router.patch("/drive/assets/:id/rights", requireAdminSession, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = PatchRightsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }

  const [updated] = await db
    .update(driveAssets)
    .set({ rightsStatus: parsed.data.rightsStatus, updatedAt: new Date() })
    .where(eq(driveAssets.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// ── Drive Pipeline ────────────────────────────────────────────────────────────

router.post("/drive/pipeline/start", requireAdminSession, async (_req: Request, res: Response) => {
  const result = await startBulkPipeline();
  if (!result.started) {
    res.status(409).json({ error: result.reason });
    return;
  }
  res.status(202).json({ started: true, status: getPipelineRunStatus() });
});

router.get("/drive/pipeline/status", requireAdminSession, (_req: Request, res: Response) => {
  res.json(getPipelineRunStatus() ?? null);
});

router.post("/drive/pipeline/sync", requireAdminSession, async (_req: Request, res: Response) => {
  const updated = await syncPipelineStatuses();
  res.json({ updated });
});

// ── Bulk container rights approval ───────────────────────────────────────────

/**
 * Approve container-level rights for all drive-sourced containers that are
 * still at RIGHTS_REVIEW_REQUIRED. Fires and forgets; progress is tracked in
 * `activeContainerApproval` (same pattern as `activePipelineRun`).
 *
 * This is distinct from `/drive/assets/bulk-rights` which updates drive_assets
 * rights (Drive ingestion gate). This endpoint clears the research pipeline's
 * own rights gate so containers proceed: RIGHTS_REVIEW_REQUIRED → RIGHTS_APPROVED
 * → INVENTORY_PENDING → full pipeline.
 */

interface BulkContainerApprovalStatus {
  running: boolean;
  startedAt: Date | null;
  total: number;
  approved: number;
  skipped: number;
  failed: number;
  completed: number;
  currentContainerId: number | null;
  errors: { containerId: number; message: string }[];
}

let activeContainerApproval: BulkContainerApprovalStatus | null = null;

router.get("/drive/containers/approve-rights/status", requireAdminSession, (_req: Request, res: Response) => {
  res.json(activeContainerApproval ?? null);
});

router.post("/drive/containers/approve-rights", requireAdminSession, async (_req: Request, res: Response) => {
  if (activeContainerApproval?.running) {
    res.status(409).json({ error: "An approval run is already in progress", status: activeContainerApproval });
    return;
  }

  // Find all drive-sourced containers that still need rights approval
  const eligible = await db
    .selectDistinct({ containerId: researchSourceContainers.id })
    .from(researchSourceContainers)
    .innerJoin(researchUploadBatchItems, eq(researchUploadBatchItems.containerId, researchSourceContainers.id))
    .innerJoin(driveAssets, eq(driveAssets.sourceBatchItemId, researchUploadBatchItems.id))
    .where(eq(researchSourceContainers.processingState, "RIGHTS_REVIEW_REQUIRED"));

  if (eligible.length === 0) {
    res.json({ started: false, reason: "No drive containers need rights approval" });
    return;
  }

  activeContainerApproval = {
    running: true,
    startedAt: new Date(),
    total: eligible.length,
    approved: 0,
    skipped: 0,
    failed: 0,
    completed: 0,
    currentContainerId: null,
    errors: [],
  };

  res.status(202).json({ started: true, total: eligible.length, status: activeContainerApproval });

  const now = new Date();
  const actor = "admin-bulk-container-approve";

  (async () => {
    for (const { containerId } of eligible) {
      if (!activeContainerApproval) break;
      activeContainerApproval.currentContainerId = containerId;
      try {
        await recordRightsDecision(
          containerId,
          {
            status: "OFFICIAL_COURT_SOURCE",
            reason: "Official court judgment — approved for research use (bulk Drive container approval)",
            source: "google-drive",
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
            notes: "Bulk-approved via Research Admin — Drive container rights approval",
          },
          { actor },
        );
        await startInventory(containerId, actor);
        activeContainerApproval.approved++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Skip containers that have already progressed past RIGHTS_REVIEW_REQUIRED
        if (msg.includes("INVALID_STATE")) {
          activeContainerApproval.skipped++;
        } else {
          activeContainerApproval.failed++;
          if (activeContainerApproval.errors.length < 50) {
            activeContainerApproval.errors.push({ containerId, message: msg });
          }
        }
      }
      activeContainerApproval.completed++;
    }
    if (activeContainerApproval) {
      activeContainerApproval.running = false;
      activeContainerApproval.currentContainerId = null;
    }
  })().catch((err) => {
    console.error("[research-admin] Container approval run crashed:", err);
    if (activeContainerApproval) {
      activeContainerApproval.running = false;
      activeContainerApproval.currentContainerId = null;
    }
  });
});

/** Re-queue a single failed or pending asset. */
router.post("/drive/assets/:id/ingest", requireAdminSession, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Allow re-ingesting PENDING or FAILED assets
  const [asset] = await db.select({ processingStatus: driveAssets.processingStatus })
    .from(driveAssets).where(eq(driveAssets.id, id));
  if (!asset) { res.status(404).json({ error: "Not found" }); return; }

  if (!["PENDING", "FAILED"].includes(asset.processingStatus)) {
    res.status(409).json({ error: `Asset is ${asset.processingStatus} — only PENDING or FAILED assets can be re-ingested` });
    return;
  }

  // Reset to PENDING so ingestDriveAsset will pick it up
  if (asset.processingStatus === "FAILED") {
    await db.update(driveAssets)
      .set({ processingStatus: "PENDING", pipelineError: null, sourceBatchItemId: null, updatedAt: new Date() })
      .where(eq(driveAssets.id, id));
  }

  const result = await ingestDriveAsset(id);
  res.json(result);
});

// ── Processing Queue (research jobs) ─────────────────────────────────────────

router.get("/queue", requireAdminSession, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const status = req.query.status as string | undefined;

  const where = status ? eq(researchJobs.state, status as Parameters<typeof eq>[1]) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(researchJobs)
      .where(where)
      .orderBy(desc(researchJobs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(researchJobs)
      .where(where),
  ]);

  res.json({ total, limit, offset, jobs: rows });
});

router.get("/queue/stats", requireAdminSession, async (_req: Request, res: Response) => {
  const statuses = [
    "QUEUED",
    "RUNNING",
    "FAILED_RETRYABLE",
    "REVIEW_REQUIRED",
    "BLOCKED_BY_RIGHTS",
    "SUCCEEDED",
    "FAILED_PERMANENT",
    "CANCELLED",
  ] as const;

  const results = await Promise.all(
    statuses.map((s) =>
      db
        .select({ c: count() })
        .from(researchJobs)
        .where(eq(researchJobs.state, s))
        .then(([r]) => [s, r?.c ?? 0] as const),
    ),
  );

  res.json(Object.fromEntries(results));
});

// ── Headnotes & Catchwords Review ────────────────────────────────────────────

/** List judgments that have ai_draft headnotes pending review. */
router.get("/headnotes", requireAdminSession, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  // Judgments with at least one ai_draft headnote
  const rows = await db
    .selectDistinct({ judgmentId: researchHeadnotes.judgmentId })
    .from(researchHeadnotes)
    .where(eq(researchHeadnotes.status, "ai_draft"))
    .orderBy(asc(researchHeadnotes.judgmentId))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(distinct ${researchHeadnotes.judgmentId})::int` })
    .from(researchHeadnotes)
    .where(eq(researchHeadnotes.status, "ai_draft"));

  // Enrich with case name metadata
  const judgmentIds = rows.map((r) => r.judgmentId);
  const caseNames = judgmentIds.length > 0
    ? await db
        .select({ judgmentId: researchCaseMetadata.judgmentId, value: researchCaseMetadata.value })
        .from(researchCaseMetadata)
        .where(
          and(
            inArray(researchCaseMetadata.judgmentId, judgmentIds),
            eq(researchCaseMetadata.fieldName, "caseName"),
          ),
        )
        .orderBy(desc(researchCaseMetadata.id))
    : [];

  const nameByJudgment = new Map<number, string>();
  for (const m of caseNames) {
    if (!nameByJudgment.has(m.judgmentId) && m.value) {
      nameByJudgment.set(m.judgmentId, Array.isArray(m.value) ? m.value.join(", ") : String(m.value));
    }
  }

  res.json({
    total,
    limit,
    offset,
    items: rows.map((r) => ({
      judgmentId: r.judgmentId,
      caseName: nameByJudgment.get(r.judgmentId) ?? null,
    })),
  });
});

/** Get all headnotes + catchwords for a judgment (all statuses). */
router.get("/headnotes/:judgmentId", requireAdminSession, async (req: Request, res: Response) => {
  const judgmentId = Number(req.params.judgmentId);
  if (isNaN(judgmentId)) { res.status(400).json({ error: "Invalid judgmentId" }); return; }

  const [headnotes, catchwords, judgment, caseName] = await Promise.all([
    db.select().from(researchHeadnotes)
      .where(eq(researchHeadnotes.judgmentId, judgmentId))
      .orderBy(asc(researchHeadnotes.number)),
    db.select().from(researchCatchwords)
      .where(eq(researchCatchwords.judgmentId, judgmentId))
      .orderBy(asc(researchCatchwords.sortOrder)),
    db.select({ id: researchVerifiedJudgments.id, containerId: researchVerifiedJudgments.containerId })
      .from(researchVerifiedJudgments)
      .where(eq(researchVerifiedJudgments.id, judgmentId))
      .limit(1)
      .then(([r]) => r ?? null),
    db.select({ value: researchCaseMetadata.value })
      .from(researchCaseMetadata)
      .where(and(
        eq(researchCaseMetadata.judgmentId, judgmentId),
        eq(researchCaseMetadata.fieldName, "caseName"),
      ))
      .orderBy(desc(researchCaseMetadata.id))
      .limit(1)
      .then(([r]) => r?.value ? (Array.isArray(r.value) ? r.value.join(", ") : String(r.value)) : null),
  ]);

  if (!judgment) { res.status(404).json({ error: "Judgment not found" }); return; }

  res.json({ judgmentId, caseName, containerId: judgment.containerId, headnotes, catchwords });
});

const PatchHeadnoteSchema = z.object({
  text: z.string().min(5).optional(),
  paragraphRef: z.string().optional(),
  status: z.enum(["accepted", "rejected", "ai_draft"]).optional(),
});

/** Update a single headnote (edit text, accept, or reject). */
router.patch("/headnotes/:judgmentId/headnotes/:id", requireAdminSession, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = PatchHeadnoteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.issues }); return; }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.text !== undefined) update.text = parsed.data.text;
  if (parsed.data.paragraphRef !== undefined) update.paragraphRef = parsed.data.paragraphRef;
  if (parsed.data.status !== undefined) {
    update.status = parsed.data.status;
    update.reviewedBy = "admin";
    update.reviewedAt = new Date();
  }

  const [updated] = await db.update(researchHeadnotes).set(update).where(eq(researchHeadnotes.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

/** Accept or reject a catchword. */
router.patch("/headnotes/:judgmentId/catchwords/:id", requireAdminSession, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = z.object({
    catchwordLine: z.string().min(3).optional(),
    status: z.enum(["accepted", "rejected", "ai_draft"]).optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.issues }); return; }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.catchwordLine !== undefined) update.catchwordLine = parsed.data.catchwordLine;
  if (parsed.data.status !== undefined) {
    update.status = parsed.data.status;
    update.reviewedBy = "admin";
    update.reviewedAt = new Date();
  }

  const [updated] = await db.update(researchCatchwords).set(update).where(eq(researchCatchwords.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

/** Accept ALL ai_draft headnotes + catchwords for a judgment in one click. */
router.post("/headnotes/:judgmentId/accept-all", requireAdminSession, async (req: Request, res: Response) => {
  const judgmentId = Number(req.params.judgmentId);
  if (isNaN(judgmentId)) { res.status(400).json({ error: "Invalid judgmentId" }); return; }

  const now = new Date();
  const [h, c] = await Promise.all([
    db.update(researchHeadnotes)
      .set({ status: "accepted", reviewedBy: "admin", reviewedAt: now, updatedAt: now })
      .where(and(eq(researchHeadnotes.judgmentId, judgmentId), eq(researchHeadnotes.status, "ai_draft")))
      .returning({ id: researchHeadnotes.id }),
    db.update(researchCatchwords)
      .set({ status: "accepted", reviewedBy: "admin", reviewedAt: now, updatedAt: now })
      .where(and(eq(researchCatchwords.judgmentId, judgmentId), eq(researchCatchwords.status, "ai_draft")))
      .returning({ id: researchCatchwords.id }),
  ]);

  res.json({ acceptedHeadnotes: h.length, acceptedCatchwords: c.length });
});

/** Regenerate headnotes for a judgment — deletes ai_draft output + re-enqueues. */
router.post("/headnotes/:judgmentId/regenerate", requireAdminSession, async (req: Request, res: Response) => {
  const judgmentId = Number(req.params.judgmentId);
  if (isNaN(judgmentId)) { res.status(400).json({ error: "Invalid judgmentId" }); return; }

  const [judgment] = await db
    .select({ id: researchVerifiedJudgments.id, containerId: researchVerifiedJudgments.containerId })
    .from(researchVerifiedJudgments)
    .where(eq(researchVerifiedJudgments.id, judgmentId));

  if (!judgment) { res.status(404).json({ error: "Judgment not found" }); return; }

  // Delete existing ai_draft headnotes + catchwords so the new run upserts fresh
  await Promise.all([
    db.delete(researchHeadnotes).where(and(
      eq(researchHeadnotes.judgmentId, judgmentId),
      eq(researchHeadnotes.status, "ai_draft"),
    )),
    db.delete(researchCatchwords).where(and(
      eq(researchCatchwords.judgmentId, judgmentId),
      eq(researchCatchwords.status, "ai_draft"),
    )),
    // Delete the previous queued/failed job so we can re-enqueue with the same idempotency key
    db.delete(researchJobs).where(and(
      eq(researchJobs.kind, HEADNOTES_JOB_KIND),
      eq(researchJobs.idempotencyKey, `${HEADNOTES_JOB_KIND}:judgment:${judgmentId}:${HEADNOTES_PROCESSOR_VERSION}`),
    )),
  ]);

  await enqueueHeadnotesJob(judgmentId, judgment.containerId);
  res.json({ queued: true, judgmentId });
});

// ── Audit Log ────────────────────────────────────────────────────────────────

router.get("/audit", requireAdminSession, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(researchAuditEvents)
      .orderBy(desc(researchAuditEvents.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(researchAuditEvents),
  ]);

  res.json({ total, limit, offset, events: rows });
});

// ── Error assets ─────────────────────────────────────────────────────────────

router.get("/errors", requireAdminSession, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(driveAssets)
      .where(eq(driveAssets.processingStatus, "FAILED"))
      .orderBy(desc(driveAssets.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(driveAssets)
      .where(eq(driveAssets.processingStatus, "FAILED")),
  ]);

  res.json({ total, limit, offset, assets: rows });
});

// ── Inventory worker (runs async in process) ─────────────────────────────────

async function runDriveInventory(runId: number, rootFolderId: string): Promise<void> {
  let totalItems = 0;
  let totalFolders = 0;
  let totalBytes = 0;

  async function walkFolder(folderId: string, pathParts: string[]): Promise<void> {
    const children = await getAllFolderChildren(folderId);

    for (const file of children) {
      if (file.mimeType === DRIVE_FOLDER_MIME) {
        totalFolders++;
        await walkFolder(file.id, [...pathParts, file.name]);
      } else {
        totalItems++;
        const folderPath = pathParts.join(" / ");
        const fileSize = file.size ? Number(file.size) : 0;
        totalBytes += fileSize;

        const classification = classifyDriveFile(file, folderPath);
        const rightsStatus = rightsStatusForClassification(classification);

        await db
          .insert(driveAssets)
          .values({
            driveFileId: file.id,
            name: file.name,
            mimeType: file.mimeType ?? null,
            size: fileSize || null,
            createdTime: file.createdTime ? new Date(file.createdTime) : null,
            modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : null,
            folderPath,
            contributorFolder: pathParts[0] ?? null,
            dateFolder: pathParts[1] ?? null,
            md5Checksum: file.md5Checksum ?? null,
            parentFolderId: folderId,
            sourceClassification: classification,
            rightsStatus,
            processingStatus: "PENDING",
            inventoryRunId: runId,
          })
          .onConflictDoUpdate({
            target: driveAssets.driveFileId,
            set: {
              name: file.name,
              mimeType: file.mimeType ?? null,
              size: fileSize || null,
              modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : null,
              folderPath,
              md5Checksum: file.md5Checksum ?? null,
              parentFolderId: folderId,
              inventoryTimestamp: new Date(),
              inventoryRunId: runId,
              updatedAt: new Date(),
            },
          });
      }
    }

    // Persist running progress after each folder
    await db
      .update(driveInventoryRuns)
      .set({ totalItems, totalFolders, totalBytes })
      .where(eq(driveInventoryRuns.id, runId));
  }

  await walkFolder(rootFolderId, []);

  await db
    .update(driveInventoryRuns)
    .set({
      status: "COMPLETED",
      completedAt: new Date(),
      totalItems,
      totalFolders,
      totalBytes,
    })
    .where(eq(driveInventoryRuns.id, runId));
}

export default router;
