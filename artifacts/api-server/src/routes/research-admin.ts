/**
 * Research Admin API — password-gated routes for the Case Law Research Admin
 * portal (/research-admin/). Uses ADMIN_PASSWORD session auth rather than
 * Clerk, so the standalone admin frontend can log in without a Clerk tenant.
 *
 * Mounted at /api/research-admin (outside the Clerk-gated /api/research prefix).
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";
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
  pool,
} from "@workspace/db";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lte, ne, or, sql } from "drizzle-orm";
import { getAllFolderChildren, DRIVE_FOLDER_MIME } from "../research/drive/driveClient";
import { classifyDriveFile, rightsStatusForClassification } from "../research/drive/classify";
import { getAdapters } from "../research/adapters";
import {
  startBulkPipeline,
  getPipelineRunStatus,
  syncPipelineStatuses,
  ingestDriveAsset,
} from "../research/drive/ingestBridge";
import { DRIVE_INGEST_JOB_KIND, DRIVE_INGEST_PROCESSOR_VERSION } from "../research/drive/driveIngestProcessor";
import { enqueueHeadnotesJob, HEADNOTES_JOB_KIND, HEADNOTES_PROCESSOR_VERSION } from "../research/headnotes/processor";
import { enqueueAcceptedContentReindex } from "../research/search/searchIndexProcessor";
import { recordRightsDecision } from "../research/data/rights";
import { startInventory } from "../research/ingestion/inventory";
import { transitionContainer } from "../research/domain/containerStateMachine";
import type { DbClient } from "../research/domain/types";
import {
  addLawyesSection,
  createLawyesReport,
  getLawyesReport,
  materializeVerifiedParagraphs,
  transitionLawyesReport,
} from "../research/editorial/lawyesReportService";

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

/**
 * Promote a fully verified judgment only after at least one headnote has been
 * accepted. Callers pass their open transaction so accepting review content
 * and making it visible in portal search either commit together or roll back.
 */
async function promoteVerifiedJudgmentWhenHeadnoted(
  dbc: DbClient,
  judgmentId: number,
  acceptancePath: "individual-headnote" | "individual-catchword" | "accept-all",
): Promise<boolean> {
  const [[judgment], [acceptedHeadnote]] = await Promise.all([
    dbc
      .select({ containerId: researchVerifiedJudgments.containerId })
      .from(researchVerifiedJudgments)
      .where(eq(researchVerifiedJudgments.id, judgmentId))
      .limit(1),
    dbc
      .select({ id: researchHeadnotes.id })
      .from(researchHeadnotes)
      .where(
        and(
          eq(researchHeadnotes.judgmentId, judgmentId),
          eq(researchHeadnotes.status, "accepted"),
        ),
      )
      .limit(1),
  ]);
  if (!judgment || !acceptedHeadnote) return false;

  const [container] = await dbc
    .select({ processingState: researchSourceContainers.processingState })
    .from(researchSourceContainers)
    .where(eq(researchSourceContainers.id, judgment.containerId))
    .limit(1);
  if (container?.processingState !== "VERIFIED") return false;

  await transitionContainer(judgment.containerId, "SEARCHABLE", {
    dbc,
    actor: "research-admin:headnotes-acceptance",
    detail: { judgmentId, acceptancePath },
  });
  return true;
}

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

  if (parsed.data.rightsStatus !== "APPROVED") {
    // Non-approval changes are simple updates (no job required).
    const [updated] = await db
      .update(driveAssets)
      .set({ rightsStatus: parsed.data.rightsStatus, updatedAt: new Date() })
      .where(eq(driveAssets.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
    return;
  }

  // APPROVED path: atomically update rights + reset processing status if
  // the asset was cancelled (so the ingest bridge's PENDING guard is satisfied)
  // + insert a durable ingest job — all in one transaction so a job-insert
  // failure rolls back the rights change rather than leaving a stranded asset.
  const updated = await db.transaction(async (tx) => {
    const [asset] = await tx
      .select({ id: driveAssets.id, processingStatus: driveAssets.processingStatus })
      .from(driveAssets)
      .where(eq(driveAssets.id, id))
      .for("update");
    if (!asset) return null;

    const setFields: Record<string, unknown> = {
      rightsStatus: "APPROVED",
      updatedAt: new Date(),
    };
    // A previously-rejected (CANCELLED) asset must be reset to PENDING so the
    // ingest bridge doesn't skip it — ingestBridge.ingestDriveAsset() requires
    // processingStatus === 'PENDING'.
    if (asset.processingStatus === "CANCELLED") {
      setFields.processingStatus = "PENDING";
      setFields.pipelineError = null;
    }

    const [row] = await tx
      .update(driveAssets)
      .set(setFields)
      .where(eq(driveAssets.id, id))
      .returning();

    // Delete any terminal job (CANCELLED, FAILED_PERMANENT, SUCCEEDED) so that
    // reapproval after a rejection creates a fresh runnable QUEUED row.
    // onConflictDoNothing below handles non-terminal jobs (QUEUED, RUNNING,
    // FAILED_RETRYABLE) — those are already active and need no replacement.
    await tx
      .delete(researchJobs)
      .where(
        and(
          eq(researchJobs.idempotencyKey, `drive.ingest:asset:${id}`),
          inArray(researchJobs.state as never, ["CANCELLED", "FAILED_PERMANENT", "SUCCEEDED"]),
        ),
      );

    await tx
      .insert(researchJobs)
      .values({
        kind: DRIVE_INGEST_JOB_KIND,
        idempotencyKey: `drive.ingest:asset:${id}`,
        payload: { driveAssetId: id } as Record<string, unknown>,
        maxAttempts: 3,
        processorVersion: DRIVE_INGEST_PROCESSOR_VERSION,
        provenance: { actor: "admin-rights-approve" } as Record<string, unknown>,
      })
      .onConflictDoNothing({ target: researchJobs.idempotencyKey });

    return row ?? null;
  });

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

/**
 * Reject a single RESTRICTED_REFERENCE_ONLY drive asset.
 * Sets processingStatus = CANCELLED and cancels any active ingest job so the
 * worker cannot process a rejected asset. Atomic: row-locked transaction with
 * a WHERE predicate on rightsStatus so a concurrent approval cannot slip past.
 */
router.post("/drive/assets/:id/reject", requireAdminSession, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = z.object({
    reason: z.string().optional().default("Rejected by rights reviewer — no licence found"),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }

  const result = await db.transaction(async (tx) => {
    // Lock the row so a concurrent approve cannot commit between our read and
    // write, and include rightsStatus in the UPDATE predicate as a final guard.
    const [asset] = await tx
      .select({
        id: driveAssets.id,
        rightsStatus: driveAssets.rightsStatus,
        sourceBatchItemId: driveAssets.sourceBatchItemId,
      })
      .from(driveAssets)
      .where(eq(driveAssets.id, id))
      .for("update");

    if (!asset) return { notFound: true } as const;
    if (asset.rightsStatus !== "RESTRICTED_REFERENCE_ONLY") return { conflict: true } as const;

    const [updated] = await tx
      .update(driveAssets)
      .set({ processingStatus: "CANCELLED", pipelineError: parsed.data.reason, updatedAt: new Date() })
      // Double-predicate: even if approve wins the lock first, this UPDATE
      // is a no-op because rightsStatus will no longer be RESTRICTED_REFERENCE_ONLY.
      .where(and(eq(driveAssets.id, id), eq(driveAssets.rightsStatus, "RESTRICTED_REFERENCE_ONLY")))
      .returning();

    if (!updated) return { notFound: true } as const;

    // Cancel any active ingest job so the worker cannot continue processing
    // a just-rejected asset.
    await tx
      .update(researchJobs)
      .set({ state: "CANCELLED" as never })
      .where(
        and(
          eq(researchJobs.idempotencyKey, `drive.ingest:asset:${id}`),
          inArray(researchJobs.state as never, ["QUEUED", "RUNNING", "FAILED_RETRYABLE"]),
        ),
      );

    // Atomically DEAD_LETTER any linked batch item so that an ingestBridge
    // worker that already committed the batch-item link (but hasn't enqueued
    // the downstream container.ingest job yet) will find the item dead and not
    // produce runnable downstream work. This closes the post-link/pre-enqueue
    // race without requiring an unlocked status check in the bridge.
    let stagingKey: string | null = null;
    if (asset.sourceBatchItemId) {
      const [deadItem] = await tx
        .update(researchUploadBatchItems)
        .set({ state: "DEAD_LETTER" as never, updatedAt: new Date() })
        .where(
          and(
            eq(researchUploadBatchItems.id, asset.sourceBatchItemId),
            inArray(researchUploadBatchItems.state as never, ["PENDING"]),
          ),
        )
        .returning({ stagingKey: researchUploadBatchItems.stagingKey });
      stagingKey = deadItem?.stagingKey ?? null;
    }

    return { updated, stagingKey } as const;
  });

  if ("notFound" in result) { res.status(404).json({ error: "Not found" }); return; }
  if ("conflict" in result) {
    res.status(409).json({ error: "Only RESTRICTED_REFERENCE_ONLY assets can be rejected via this endpoint" });
    return;
  }

  // Best-effort: remove staged commercial bytes from object storage now that
  // the batch item is DEAD_LETTER. Failure is logged but does not fail the
  // request (the DB state is already consistent).
  if (result.stagingKey) {
    await getAdapters()
      .storage.remove(result.stagingKey)
      .catch((err) =>
        logger.warn({ id, stagingKey: result.stagingKey, err }, "reject: failed to remove staged bytes — manual cleanup needed"),
      );
  }

  res.json(result.updated);
});

/**
 * Bulk-reject all RESTRICTED_REFERENCE_ONLY drive assets (or approve them all
 * if action = "approve"). Bulk approve enqueues ingestion jobs for each asset.
 * Body: { action: "approve" | "reject", ids?: number[] }
 *
 * `ids` is an optional allowlist that scopes the operation to specific asset
 * IDs. When omitted, ALL RESTRICTED_REFERENCE_ONLY assets are targeted.
 * Tests must supply `ids` so they only affect their own fixture rows — never
 * rely on snapshot/restore to "undo" effects on pre-existing protected content.
 */
router.post("/drive/assets/bulk-restricted", requireAdminSession, async (req: Request, res: Response) => {
  const BulkRestrictedSchema = z.object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().optional().default("Bulk rejection — no licence found"),
    /** Optional explicit allowlist of asset IDs to scope the operation. */
    ids: z.array(z.number().int().positive()).optional(),
  });

  const parsed = BulkRestrictedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }

  const { action, reason, ids } = parsed.data;

  // An explicitly supplied empty ids list means "nothing selected" — treat as
  // a no-op rather than falling through to the global bulk operation, which
  // would otherwise approve or cancel every restricted asset in the database.
  if (ids !== undefined && ids.length === 0) {
    res.json({ action, updated: 0, ...(action === "approve" ? { ingestionQueued: 0 } : {}) });
    return;
  }

  // Build the id-scope clause (only when ids is a non-empty array).
  const idScope = ids && ids.length > 0 ? inArray(driveAssets.id, ids) : undefined;

  if (action === "reject") {
    // Discover the assets to reject. This read is unlocked, but each chunk
    // transaction re-checks the predicates atomically, so races are safe.
    const discoverConditions = [
      eq(driveAssets.rightsStatus, "RESTRICTED_REFERENCE_ONLY"),
      ne(driveAssets.processingStatus, "CANCELLED" as never),
    ];
    if (idScope) discoverConditions.push(idScope);

    const toReject = await db
      .select({ id: driveAssets.id, sourceBatchItemId: driveAssets.sourceBatchItemId })
      .from(driveAssets)
      .where(and(...discoverConditions));

    if (toReject.length === 0) {
      res.json({ action: "reject", updated: 0 });
      return;
    }

    // Process in chunks. Each chunk runs inside a single transaction so the
    // asset cancellation, active-job cancellation, and linked-PENDING-item
    // DEAD_LETTER all commit atomically. A bridge worker that already passed
    // its post-link status read will find the batch item DEAD_LETTER before
    // any downstream container.ingest processor can treat it as runnable.
    const CHUNK = 100;
    let totalUpdated = 0;
    const stagedKeys: string[] = [];

    for (let i = 0; i < toReject.length; i += CHUNK) {
      const chunk = toReject.slice(i, i + CHUNK);
      const chunkIds = chunk.map((r) => r.id);
      const batchItemIds = chunk
        .map((r) => r.sourceBatchItemId)
        .filter((id): id is number => id !== null);
      const chunkJobKeys = chunkIds.map((id) => `drive.ingest:asset:${id}`);

      const chunkStagedKeys = await db.transaction(async (tx) => {
        // 1. Cancel assets (re-checks predicates; no-op if condition no longer met).
        //    RETURNING includes sourceBatchItemId so we capture the CURRENT linked
        //    item, not a stale discovery snapshot. If a bridge committed a new link
        //    between the discover SELECT and this UPDATE, the RETURNING value will
        //    reflect it because UPDATE reads the committed row state at update time.
        const cancelledAssets = await tx
          .update(driveAssets)
          .set({ processingStatus: "CANCELLED", pipelineError: reason, updatedAt: new Date() })
          .where(
            and(
              inArray(driveAssets.id, chunkIds),
              eq(driveAssets.rightsStatus, "RESTRICTED_REFERENCE_ONLY"),
              ne(driveAssets.processingStatus, "CANCELLED" as never),
            ),
          )
          .returning({ id: driveAssets.id, sourceBatchItemId: driveAssets.sourceBatchItemId });

        totalUpdated += cancelledAssets.length;
        if (cancelledAssets.length === 0) return [];

        // 2. Cancel active drive.ingest jobs for every asset in this chunk.
        const cancelledIds = cancelledAssets.map((r) => r.id);
        const cancelledJobKeys = cancelledIds.map((id) => `drive.ingest:asset:${id}`);
        await tx
          .update(researchJobs)
          .set({ state: "CANCELLED" as never })
          .where(
            and(
              inArray(researchJobs.idempotencyKey, cancelledJobKeys),
              inArray(researchJobs.state as never, ["QUEUED", "RUNNING", "FAILED_RETRYABLE"]),
            ),
          );

        // 3. DEAD_LETTER any linked PENDING batch items in the same transaction.
        //    Use the sourceBatchItemIds from RETURNING (live values) not from the
        //    pre-discovery snapshot, so a bridge that linked an item after discovery
        //    but before this UPDATE is also neutralised.
        const currentBatchItemIds = cancelledAssets
          .map((r) => r.sourceBatchItemId)
          .filter((id): id is number => id !== null);
        if (currentBatchItemIds.length === 0) return [];

        const deadItems = await tx
          .update(researchUploadBatchItems)
          .set({ state: "DEAD_LETTER" as never })
          .where(
            and(
              inArray(researchUploadBatchItems.id, currentBatchItemIds),
              inArray(researchUploadBatchItems.state as never, ["PENDING"]),
            ),
          )
          .returning({ stagingKey: researchUploadBatchItems.stagingKey });

        return deadItems.filter((r) => r.stagingKey !== null).map((r) => r.stagingKey as string);
      });

      stagedKeys.push(...chunkStagedKeys);
    }

    // Best-effort: remove staged commercial bytes from object storage after all
    // chunks commit. Failures are logged but do not roll back the DB state.
    if (stagedKeys.length > 0) {
      await Promise.allSettled(
        stagedKeys.map((k) =>
          getAdapters()
            .storage.remove(k)
            .catch((err) =>
              logger.warn({ stagingKey: k, err }, "bulk-reject: failed to remove staged bytes — manual cleanup needed"),
            ),
        ),
      );
    }

    res.json({ action: "reject", updated: totalUpdated });
    return;
  }

  // action === "approve": set rightsStatus = APPROVED and enqueue ingestion.
  // CANCELLED assets (previously rejected) are also reset to PENDING so the
  // ingest bridge's processingStatus === 'PENDING' guard is satisfied.
  const { updatedCount, ingestionQueued } = await db.transaction(async (tx) => {
    const approveConditions = [eq(driveAssets.rightsStatus, "RESTRICTED_REFERENCE_ONLY")];
    if (idScope) approveConditions.push(idScope);

    const updated = await tx
      .update(driveAssets)
      .set({
        rightsStatus: "APPROVED",
        // Reset CANCELLED → PENDING; all other statuses are left unchanged.
        processingStatus: sql<"PENDING">`CASE WHEN ${driveAssets.processingStatus} = 'CANCELLED' THEN 'PENDING'::drive_processing_status ELSE ${driveAssets.processingStatus} END`,
        pipelineError: sql<string | null>`CASE WHEN ${driveAssets.processingStatus} = 'CANCELLED' THEN NULL ELSE ${driveAssets.pipelineError} END`,
        updatedAt: new Date(),
      })
      .where(and(...approveConditions))
      .returning({ id: driveAssets.id });

    const updatedIds = updated.map((r) => r.id);
    let queued = 0;

    if (updatedIds.length > 0) {
      const CHUNK = 200;
      for (let i = 0; i < updatedIds.length; i += CHUNK) {
        const chunk = updatedIds.slice(i, i + CHUNK);
        const chunkKeys = chunk.map((id) => `drive.ingest:asset:${id}`);

        // Delete any terminal job (CANCELLED, FAILED_PERMANENT, SUCCEEDED) for
        // each asset in this chunk so reapproval always creates a fresh runnable
        // job. onConflictDoNothing below handles non-terminal active jobs
        // (QUEUED, RUNNING, FAILED_RETRYABLE) — those need no replacement.
        await tx
          .delete(researchJobs)
          .where(
            and(
              inArray(researchJobs.idempotencyKey, chunkKeys),
              inArray(researchJobs.state as never, ["CANCELLED", "FAILED_PERMANENT", "SUCCEEDED"]),
            ),
          );

        const inserted = await tx
          .insert(researchJobs)
          .values(
            chunk.map((assetId) => ({
              kind: DRIVE_INGEST_JOB_KIND,
              idempotencyKey: `drive.ingest:asset:${assetId}`,
              payload: { driveAssetId: assetId } as Record<string, unknown>,
              maxAttempts: 3,
              processorVersion: DRIVE_INGEST_PROCESSOR_VERSION,
              provenance: { actor: "admin-bulk-restricted-approve" } as Record<string, unknown>,
            })),
          )
          .onConflictDoNothing({ target: researchJobs.idempotencyKey })
          .returning({ id: researchJobs.id });
        queued += inserted.length;
      }
    }

    return { updatedCount: updatedIds.length, ingestionQueued: queued };
  });

  res.json({ action: "approve", updated: updatedCount, ingestionQueued });
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
  const judgmentId = Number(req.params.judgmentId);
  const id = Number(req.params.id);
  if (isNaN(judgmentId) || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = PatchHeadnoteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.issues }); return; }

  const now = new Date();
  const update: Record<string, unknown> = { updatedAt: now };
  if (parsed.data.text !== undefined) update.text = parsed.data.text;
  if (parsed.data.paragraphRef !== undefined) update.paragraphRef = parsed.data.paragraphRef;
  if (parsed.data.status !== undefined) {
    update.status = parsed.data.status;
    update.reviewedBy = "admin";
    update.reviewedAt = now;
  }

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ status: researchHeadnotes.status })
      .from(researchHeadnotes)
      .where(and(eq(researchHeadnotes.id, id), eq(researchHeadnotes.judgmentId, judgmentId)));
    if (!existing) return null;

    const [updated] = await tx
      .update(researchHeadnotes)
      .set(update)
      .where(and(eq(researchHeadnotes.id, id), eq(researchHeadnotes.judgmentId, judgmentId)))
      .returning();
    if (!updated) return null;
    const statusChanged =
      parsed.data.status !== undefined && parsed.data.status !== existing.status;
    const acceptedContentChanged =
      (parsed.data.text !== undefined || statusChanged) &&
      (existing.status === "accepted" || updated.status === "accepted");
    if (acceptedContentChanged) {
      const [judgment] = await tx
        .select({ containerId: researchVerifiedJudgments.containerId })
        .from(researchVerifiedJudgments)
        .where(eq(researchVerifiedJudgments.id, judgmentId));
      if (judgment) {
        await enqueueAcceptedContentReindex(judgmentId, judgment.containerId, now.getTime(), {
          actor: "admin-headnote-acceptance",
          dbc: tx,
        });
      }
    }
    const promotedToSearchable =
      parsed.data.status === "accepted"
        ? await promoteVerifiedJudgmentWhenHeadnoted(tx, judgmentId, "individual-headnote")
        : false;
    return { updated, promotedToSearchable };
  });
  if (!result) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...result.updated, promotedToSearchable: result.promotedToSearchable });
});

/** Accept or reject a catchword. */
router.patch("/headnotes/:judgmentId/catchwords/:id", requireAdminSession, async (req: Request, res: Response) => {
  const judgmentId = Number(req.params.judgmentId);
  const id = Number(req.params.id);
  if (isNaN(judgmentId) || isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = z.object({
    catchwordLine: z.string().min(3).optional(),
    status: z.enum(["accepted", "rejected", "ai_draft"]).optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body", details: parsed.error.issues }); return; }

  const now = new Date();
  const update: Record<string, unknown> = { updatedAt: now };
  if (parsed.data.catchwordLine !== undefined) update.catchwordLine = parsed.data.catchwordLine;
  if (parsed.data.status !== undefined) {
    update.status = parsed.data.status;
    update.reviewedBy = "admin";
    update.reviewedAt = now;
  }

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ status: researchCatchwords.status })
      .from(researchCatchwords)
      .where(and(eq(researchCatchwords.id, id), eq(researchCatchwords.judgmentId, judgmentId)));
    if (!existing) return null;

    const [updated] = await tx
      .update(researchCatchwords)
      .set(update)
      .where(and(eq(researchCatchwords.id, id), eq(researchCatchwords.judgmentId, judgmentId)))
      .returning();
    if (!updated) return null;
    const statusChanged =
      parsed.data.status !== undefined && parsed.data.status !== existing.status;
    const acceptedContentChanged =
      (parsed.data.catchwordLine !== undefined || statusChanged) &&
      (existing.status === "accepted" || updated.status === "accepted");
    if (acceptedContentChanged) {
      const [judgment] = await tx
        .select({ containerId: researchVerifiedJudgments.containerId })
        .from(researchVerifiedJudgments)
        .where(eq(researchVerifiedJudgments.id, judgmentId));
      if (judgment) {
        await enqueueAcceptedContentReindex(judgmentId, judgment.containerId, now.getTime(), {
          actor: "admin-catchword-acceptance",
          dbc: tx,
        });
      }
    }
    const promotedToSearchable =
      parsed.data.status === "accepted"
        ? await promoteVerifiedJudgmentWhenHeadnoted(tx, judgmentId, "individual-catchword")
        : false;
    return { updated, promotedToSearchable };
  });
  if (!result) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...result.updated, promotedToSearchable: result.promotedToSearchable });
});

/** Accept ALL ai_draft headnotes + catchwords for a judgment in one click. */
router.post("/headnotes/:judgmentId/accept-all", requireAdminSession, async (req: Request, res: Response) => {
  const judgmentId = Number(req.params.judgmentId);
  if (isNaN(judgmentId)) { res.status(400).json({ error: "Invalid judgmentId" }); return; }

  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [judgment] = await tx
      .select({ containerId: researchVerifiedJudgments.containerId })
      .from(researchVerifiedJudgments)
      .where(eq(researchVerifiedJudgments.id, judgmentId));
    if (!judgment) return null;

    const [h, c] = await Promise.all([
      tx.update(researchHeadnotes)
        .set({ status: "accepted", reviewedBy: "admin", reviewedAt: now, updatedAt: now })
        .where(and(eq(researchHeadnotes.judgmentId, judgmentId), eq(researchHeadnotes.status, "ai_draft")))
        .returning({ id: researchHeadnotes.id }),
      tx.update(researchCatchwords)
        .set({ status: "accepted", reviewedBy: "admin", reviewedAt: now, updatedAt: now })
        .where(and(eq(researchCatchwords.judgmentId, judgmentId), eq(researchCatchwords.status, "ai_draft")))
        .returning({ id: researchCatchwords.id }),
    ]);
    if (h.length > 0 || c.length > 0) {
      await enqueueAcceptedContentReindex(judgmentId, judgment.containerId, now.getTime(), {
        actor: "admin-headnotes-accept-all",
        dbc: tx,
      });
    }
    const promotedToSearchable = await promoteVerifiedJudgmentWhenHeadnoted(
      tx,
      judgmentId,
      "accept-all",
    );
    return { h, c, promotedToSearchable };
  });
  if (!result) { res.status(404).json({ error: "Judgment not found" }); return; }

  res.json({
    acceptedHeadnotes: result.h.length,
    acceptedCatchwords: result.c.length,
    promotedToSearchable: result.promotedToSearchable,
  });
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

// LAWYes adapter: password authentication grants workbench access only. It
// never substitutes for the active legal_reviewer identity required to sign
// off or publish.
const adminState = (state: string) => ({
  Draft: "DRAFT", "AI-assisted": "AI_ASSISTED_DRAFT",
  "Lawyer reviewed": "LAWYER_REVIEWED", Published: "PUBLISHED",
}[state] ?? "ACCESS_RECORD");

async function lawyesAdminReport(id: number): Promise<Record<string, any>> {
  const report = await getLawyesReport(id, "research-admin:password-session") as Record<string, any>;
  const source = await pool.query(
    `SELECT c.original_name,c.content_sha256,c.rights_status,j.verified_at,j.verified_by
     FROM research_lawyes_reports r JOIN research_verified_judgments j ON j.id=r.judgment_id
     JOIN research_source_containers c ON c.id=j.container_id WHERE r.id=$1`, [id],
  );
  const pinpointIds = new Map<number, number[]>();
  for (const row of report.pinpoints ?? []) {
    pinpointIds.set(row.proposition_id, [...(pinpointIds.get(row.proposition_id) ?? []), row.paragraph_id]);
  }
  const flags = (report.propositions ?? []).filter((p: any) => p.material && !pinpointIds.get(p.id)?.length)
    .map((p: any) => ({ id: -p.id, kind: "UNSUPPORTED_PROPOSITION", message: "Material proposition has no verified paragraph pinpoint", field: String(p.section_id), severity: "critical", resolved: false }));
  const sourceRow = source.rows[0] ?? {};
  const latestReview = [...(report.reviews ?? [])].pop();
  return {
    id: report.id, caseName: report.title, citation: report.report_citation ?? report.neutral_citation ?? null,
    court: report.court ?? null, state: adminState(report.state),
    assignee: report.assigned_editor_id ? String(report.assigned_editor_id) : null, updatedAt: report.updated_at,
    flagCount: flags.length, reviewedParagraphs: 0, paragraphCount: (report.paragraphs ?? []).length,
    containerId: report.container_id,
    source: { name: sourceRow.original_name ?? report.title, url: report.source_url ?? null, classification: "VERIFIED_JUDICIAL_TEXT", rightsStatus: sourceRow.rights_status ?? "UNREVIEWED", checksum: sourceRow.content_sha256 ?? null, verifiedAt: sourceRow.verified_at ?? null, verifiedBy: sourceRow.verified_by ?? null },
    metadata: { caseNumber: report.case_number ?? null, decisionDate: report.decision_date ?? null, registry: report.registry ?? null, coram: Array.isArray(report.coram) ? report.coram.join("; ") : null, counsel: Array.isArray(report.counsel) ? report.counsel.join("; ") : null },
    sections: (report.sections ?? []).map((s: any) => ({ key: s.kind, label: s.heading, content: s.body, required: false, missingFromSource: false })),
    paragraphs: (report.paragraphs ?? []).map((p: any) => ({ id: p.id, label: p.paragraph_key, text: p.text, pageNumber: p.source_page, reviewed: false, excluded: false })),
    propositions: (report.propositions ?? []).map((p: any) => ({ id: p.id, field: String(p.section_id), text: p.proposition, paragraphIds: pinpointIds.get(p.id) ?? [], status: pinpointIds.get(p.id)?.length ? "SUPPORTED" : "UNSUPPORTED" })),
    flags,
    revisions: (report.revisions ?? []).map((r: any) => ({ id: r.id, number: r.revision, createdAt: r.created_at, createdBy: r.actor, summary: r.reason })),
    review: { signedOffAt: latestReview?.created_at ?? null, signedOffBy: latestReview?.reviewer_id ? String(latestReview.reviewer_id) : null, declaration: latestReview?.notes ?? null },
    publicationBlockers: report.state === "Published" ? [] : ["Use sign-off and publish; live source and pinpoint checks apply."],
  };
}

router.get("/editorial/reports", requireAdminSession, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const map: Record<string, string> = { DRAFT: "Draft", AI_ASSISTED_DRAFT: "AI-assisted", LAWYER_REVIEWED: "Lawyer reviewed", PUBLISHED: "Published" };
  const requested = typeof req.query.state === "string" ? map[req.query.state] : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const params: unknown[] = []; const conditions: string[] = [];
  if (requested) { params.push(requested); conditions.push(`state=$${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`(title ILIKE $${params.length} OR neutral_citation ILIKE $${params.length})`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const countResult = await pool.query(`SELECT count(*)::int total FROM research_lawyes_reports ${where}`, params);
  params.push(limit, offset);
  const rows = await pool.query<{ id: number }>(`SELECT id FROM research_lawyes_reports ${where} ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  res.json({ total: countResult.rows[0]?.total ?? 0, limit, offset, reports: await Promise.all(rows.rows.map((r) => lawyesAdminReport(r.id))) });
});

router.get("/editorial/reports/:id", requireAdminSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return void res.status(400).json({ error: "Invalid report id" });
  try { res.json(await lawyesAdminReport(id)); } catch { res.status(404).json({ error: "Report not found" }); }
});

// Password administrators may prepare editorial material, but these endpoints
// deliberately do not accept a reviewer identity or a publishable state.
// Legal acts remain on the Clerk-authenticated /api/research router.
const AdminReportInput = z.object({
  judgmentId: z.number().int().positive(),
  title: z.string().min(1),
  sourceUrl: z.string().url(),
});
const AdminSectionInput = z.object({
  kind: z.string().min(1),
  heading: z.string().min(1),
  body: z.string(),
  sortOrder: z.number().int().nonnegative(),
  propositions: z.array(z.object({
    proposition: z.string().min(1),
    material: z.boolean(),
    paragraphIds: z.array(z.number().int().positive()),
  })).default([]),
});

router.get("/editorial/reports/:id/workbench", requireAdminSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return void res.status(400).json({ error: "Invalid report id" });
  try {
    res.json(await getLawyesReport(id, "research-admin:password-session"));
  } catch (error) {
    if ((error as { code?: string }).code === "REPORT_NOT_FOUND") {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    throw error;
  }
});

router.post("/editorial/reports", requireAdminSession, async (req, res) => {
  const parsed = AdminReportInput.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid report" });
  try {
    res.status(201).json(await createLawyesReport({
      ...parsed.data,
      actor: "research-admin:password-session",
    }));
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Report creation failed" });
  }
});

router.post("/editorial/reports/:id/paragraphs/materialize", requireAdminSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return void res.status(400).json({ error: "Invalid report id" });
  try {
    res.json({ inserted: await materializeVerifiedParagraphs(id, "research-admin:password-session") });
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Paragraph materialisation failed" });
  }
});

router.post("/editorial/reports/:id/sections", requireAdminSession, async (req, res) => {
  const id = Number(req.params.id);
  const parsed = AdminSectionInput.safeParse(req.body);
  if (!Number.isInteger(id) || !parsed.success) return void res.status(400).json({ error: "Invalid report section" });
  try {
    res.status(201).json(await addLawyesSection({
      reportId: id, ...parsed.data, actor: "research-admin:password-session",
    }));
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Invalid report section" });
  }
});

router.post("/editorial/reports/:id/source/verify", requireAdminSession, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return void res.status(400).json({ error: "Invalid report id" });
  try { res.json(await lawyesAdminReport(id)); } catch { res.status(404).json({ error: "Report not found" }); }
});

const immutableEditorialCorpus = (_req: Request, res: Response) => res.status(409).json({ error: "Source paragraphs, pinpoints, and flags are immutable; use LAWYes report endpoints." });
router.patch("/editorial/reports/:id/sections/:key", requireAdminSession, immutableEditorialCorpus);
router.patch("/editorial/reports/:id/paragraphs/:paragraphId", requireAdminSession, immutableEditorialCorpus);
router.patch("/editorial/reports/:id/propositions/:propositionId", requireAdminSession, immutableEditorialCorpus);
router.patch("/editorial/reports/:id/flags/:flagId", requireAdminSession, immutableEditorialCorpus);

router.post("/editorial/reports/:id/sign-off", requireAdminSession, async (req, res) => {
  // Kept as an explicit failure rather than a 404 so password-only clients
  // receive actionable guidance. Never look up or impersonate a configured
  // reviewer here.
  res.status(403).json({
    error: "Legal sign-off requires an authenticated Clerk legal reviewer on /api/research/reports/:id/reviews",
  });
});

router.post("/editorial/reports/:id/publish", requireAdminSession, async (req, res) => {
  res.status(403).json({
    error: "Publication requires an authenticated Clerk legal reviewer or owner on /api/research/reports/:id/transitions",
  });
});
router.post("/editorial/reports/:id/unpublish", requireAdminSession, async (req, res) => {
  const id = Number(req.params.id); const reason = z.string().min(1).safeParse(req.body?.reason);
  if (!Number.isInteger(id) || !reason.success) return void res.status(400).json({ error: "A report id and reason are required" });
  try { await transitionLawyesReport(id, "Draft", "research-admin:password-session", reason.data); res.json(await lawyesAdminReport(id)); }
  catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : "Unpublication failed" }); }
});

router.get("/editorial/reports/:id/revisions/compare", requireAdminSession, async (req, res) => {
  const id = Number(req.params.id), from = Number(req.query.from), to = Number(req.query.to);
  if (![id, from, to].every(Number.isInteger)) return void res.status(400).json({ error: "Valid report and revision ids are required" });
  const rows = await pool.query(`SELECT * FROM research_lawyes_revisions WHERE report_id=$1 AND id IN ($2,$3)`, [id, from, to]);
  const a = rows.rows.find((r) => r.id === from), b = rows.rows.find((r) => r.id === to);
  if (!a || !b) return void res.status(404).json({ error: "Revision not found for report" });
  res.json({ from: { id: a.id, number: a.revision, createdAt: a.created_at, createdBy: a.actor, summary: a.reason }, to: { id: b.id, number: b.revision, createdAt: b.created_at, createdBy: b.actor, summary: b.reason }, changes: a.snapshot === b.snapshot ? [] : [{ field: "editorial_snapshot", before: null, after: null }] });
});

export default router;
