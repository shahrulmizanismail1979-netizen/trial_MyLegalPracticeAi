/**
 * Drive-to-Pipeline Ingestion Bridge
 *
 * Downloads Drive assets and feeds them into the existing research processing
 * pipeline (ingest → extract → segment → validate → editorial → metadata →
 * search index). Designed to be idempotent: re-running skips assets that have
 * already been sent to the pipeline.
 */
import { createHash } from "node:crypto";
import {
  db,
  driveAssets,
  researchSourceContainers,
  researchUploadBatchItems,
  type DriveAsset,
} from "@workspace/db";
import { and, eq, inArray, isNull, isNotNull, or, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { downloadDriveFile } from "./driveClient";
import { getAdapters } from "../adapters";
import {
  createBatch,
  createBatchItem,
  transitionBatchItem,
} from "../data/uploads";
import { enqueueIngestJob } from "../ingestion/service";

// ── Container state → drive processing status mapping ────────────────────────

type DriveProcessingStatus = DriveAsset["processingStatus"];

const CONTAINER_STATE_MAP: Record<string, DriveProcessingStatus> = {
  UPLOADED: "INGESTION_RUNNING",
  QUARANTINED: "FAILED",
  RIGHTS_REVIEW_REQUIRED: "INGESTION_RUNNING",
  RIGHTS_APPROVED: "INGESTION_RUNNING",
  INVENTORY_PENDING: "INGESTION_COMPLETE",
  INVENTORIED: "INGESTION_COMPLETE",
  EXTRACTION_PENDING: "EXTRACTION_QUEUED",
  TEXT_EXTRACTED: "EXTRACTION_COMPLETE",
  OCR_REVIEW_REQUIRED: "EXTRACTION_COMPLETE",
  SEGMENTATION_PENDING: "SEGMENTATION_QUEUED",
  SEGMENTATION_PROPOSED: "SEGMENTATION_RUNNING",
  SEGMENTATION_REVIEW_REQUIRED: "SEGMENTATION_COMPLETE",
  EDITORIAL_REVIEW_PENDING: "REVIEW_QUEUED",
  EDITORIAL_REVIEW_REQUIRED: "REVIEW_IN_PROGRESS",
  JUDGMENT_VERIFICATION_PENDING: "REVIEW_IN_PROGRESS",
  VERIFIED: "REVIEW_COMPLETE",
  SEARCHABLE: "PUBLISHED",
  PROCESSING_BLOCKED: "FAILED",
  DELETION_PENDING: "CANCELLED",
  DELETED: "CANCELLED",
};

// ── Single-asset ingestion ────────────────────────────────────────────────────

export interface IngestResult {
  assetId: number;
  queued: boolean;
  skipped: boolean;
  reason?: string;
  batchItemId?: number;
  errorMessage?: string;
}

/**
 * Download a single Drive asset and feed it into the research pipeline.
 * Idempotent: skips assets that aren't PENDING or APPROVED.
 *
 * Pass `forceReset: true` on retry attempts so a previously-FAILED asset is
 * reset to PENDING before attempting ingestion again. Without this, the
 * idempotency guard would see FAILED and skip the retry silently.
 */
export async function ingestDriveAsset(
  assetId: number,
  opts: { forceReset?: boolean } = {},
): Promise<IngestResult> {
  if (opts.forceReset) {
    // Reset → PENDING for two cases, both safe to retry:
    //  • processingStatus = 'FAILED': explicit failure recorded by the catch block.
    //  • processingStatus = 'INGESTION_QUEUED' AND sourceBatchItemId IS NULL:
    //    the server crashed after setting INGESTION_QUEUED but before creating
    //    or linking a batch item, so no durable work was persisted and the
    //    asset is permanently orphaned without this reset.
    //
    // Genuinely-progressing assets are left alone:
    //  • INGESTION_QUEUED + sourceBatchItemId IS NOT NULL: batch item exists;
    //    the batch-item-reuse path below will pick it up.
    //  • INGESTION_RUNNING, EXTRACTION_QUEUED, etc.: real downstream progress.
    await db
      .update(driveAssets)
      .set({ processingStatus: "PENDING", pipelineError: null, updatedAt: new Date() })
      .where(
        and(
          eq(driveAssets.id, assetId),
          eq(driveAssets.rightsStatus, "APPROVED"),
          or(
            eq(driveAssets.processingStatus, "FAILED"),
            and(
              eq(driveAssets.processingStatus, "INGESTION_QUEUED"),
              isNull(driveAssets.sourceBatchItemId),
            ),
          ),
        ),
      );
  }

  const [asset] = await db
    .select()
    .from(driveAssets)
    .where(eq(driveAssets.id, assetId));
  if (!asset) throw new Error(`Drive asset ${assetId} not found`);

  // Idempotency guard.
  // Allow INGESTION_QUEUED assets that already have a linked batch item to fall
  // through to the reuse path below.  They represent a crash that occurred after
  // sourceBatchItemId was persisted but before or during the downstream enqueue
  // — the batch item is real and must not be duplicated.  All other non-PENDING
  // states represent genuine downstream progress and must be skipped.
  if (asset.processingStatus !== "PENDING") {
    const canReuse =
      asset.processingStatus === "INGESTION_QUEUED" && asset.sourceBatchItemId != null;
    if (!canReuse) {
      return { assetId, queued: false, skipped: true, reason: `Status is ${asset.processingStatus}` };
    }
  }
  if (asset.rightsStatus !== "APPROVED") {
    return { assetId, queued: false, skipped: true, reason: `Rights not approved (${asset.rightsStatus})` };
  }

  // Batch-item idempotency: if a previous attempt already created and linked a
  // batch item (sourceBatchItemId is set), reuse it instead of re-downloading
  // and creating a duplicate item + downstream container.ingest job.
  // Reached for PENDING assets or INGESTION_QUEUED + sourceBatchItemId set (see guard above).
  if (asset.sourceBatchItemId != null) {
    const [existingItem] = await db
      .select()
      .from(researchUploadBatchItems)
      .where(eq(researchUploadBatchItems.id, asset.sourceBatchItemId));

    if (existingItem && !["DEAD_LETTER", "REJECTED"].includes(existingItem.state)) {
      // Retryable batch item — re-enqueue its downstream container.ingest job
      // rather than downloading and staging the file again.
      await enqueueIngestJob(existingItem, (existingItem.retryCount ?? 0) + 1, "drive-bridge-retry");
      await db
        .update(driveAssets)
        .set({ processingStatus: "INGESTION_QUEUED", pipelineError: null, updatedAt: new Date() })
        .where(eq(driveAssets.id, assetId));
      logger.info(
        { assetId, batchItemId: existingItem.id },
        "Drive asset: reusing existing batch item on retry",
      );
      return { assetId, queued: true, skipped: false, batchItemId: existingItem.id };
    }

    // Terminal batch item — clear the stale reference so we fall through to
    // a fresh download on this attempt.
    await db
      .update(driveAssets)
      .set({ sourceBatchItemId: null, updatedAt: new Date() })
      .where(eq(driveAssets.id, assetId));
  }

  try {
    // Mark as queued immediately so concurrent runs don't double-ingest
    await db
      .update(driveAssets)
      .set({ processingStatus: "INGESTION_QUEUED", updatedAt: new Date() })
      .where(
        and(
          eq(driveAssets.id, assetId),
          eq(driveAssets.processingStatus, "PENDING"),
        ),
      );

    // Download from Google Drive
    const { bytes, mimeType } = await downloadDriveFile(
      asset.driveFileId,
      asset.mimeType,
    );

    const sha256 = createHash("sha256").update(bytes).digest("hex");

    // Create an upload batch for this Drive import
    const batch = await createBatch({
      declaredSource: `google-drive:${asset.driveFileId}`,
      uploadedBy: "drive-bridge",
      provenance: {
        driveFileId: asset.driveFileId,
        driveAssetId: asset.id,
        folderPath: asset.folderPath ?? null,
        inventoryRunId: asset.inventoryRunId ?? null,
        source: "drive-ingestion-bridge",
      },
    });

    // Stage bytes in object storage
    const stagingKey = await getAdapters().storage.put(
      `drive/${asset.driveFileId}/${sha256}`,
      bytes,
      mimeType,
    );

    // Create the batch item AND link it to the drive asset atomically in a
    // single transaction.  This eliminates the crash window between
    // createBatchItem() committing and the asset link update — with separate
    // statements a crash in that interval would leave an orphaned batch item
    // that a retry would duplicate.  createBatchItem accepts a `dbc` parameter
    // so its internal writes participate in the outer transaction (drizzle
    // handles the nested call via a savepoint on PostgreSQL).
    const item = await db.transaction(async (tx) => {
      const newItem = await createBatchItem(
        {
          batchId: batch.id,
          originalPath: asset.name,
          contentSha256: sha256,
          sizeBytes: bytes.length,
          mimeType,
          stagingKey,
        },
        tx,
      );

      // Link immediately within the same transaction so both commit or
      // neither commits — no intermediate orphan state is possible.
      await tx
        .update(driveAssets)
        .set({
          processingStatus: "INGESTION_QUEUED",
          sourceBatchItemId: newItem.id,
          pipelineError: null,
          updatedAt: new Date(),
        })
        .where(eq(driveAssets.id, assetId));

      return newItem;
    });

    // Enqueue the container.ingest job after the atomic commit.
    // A crash here leaves sourceBatchItemId set → the retry reuses the
    // existing batch item without re-downloading.
    await enqueueIngestJob(item, 0, "drive-bridge");

    logger.info(
      { assetId, driveFileId: asset.driveFileId, batchItemId: item.id },
      "Drive asset enqueued for ingestion",
    );

    return { assetId, queued: true, skipped: false, batchItemId: item.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ assetId, driveFileId: asset.driveFileId, err: msg }, "Drive asset ingestion failed");

    await db
      .update(driveAssets)
      .set({ processingStatus: "FAILED", pipelineError: msg, updatedAt: new Date() })
      .where(eq(driveAssets.id, assetId));

    return { assetId, queued: false, skipped: false, errorMessage: msg };
  }
}

// ── Bulk pipeline trigger ─────────────────────────────────────────────────────

export interface PipelineRunStatus {
  running: boolean;
  startedAt: Date | null;
  total: number;
  queued: number;
  skipped: number;
  failed: number;
  completed: number;
  currentAssetId: number | null;
  errors: { assetId: number; message: string }[];
}

let activePipelineRun: PipelineRunStatus | null = null;

export function getPipelineRunStatus(): PipelineRunStatus | null {
  return activePipelineRun;
}

/**
 * Start a bulk pipeline run: find all APPROVED + PENDING assets and ingest them
 * one by one. Fire-and-forget; progress is available via getPipelineRunStatus().
 */
export async function startBulkPipeline(): Promise<{
  started: boolean;
  reason?: string;
}> {
  if (activePipelineRun?.running) {
    return { started: false, reason: "A pipeline run is already in progress" };
  }

  // Find eligible assets
  const eligible = await db
    .select({ id: driveAssets.id })
    .from(driveAssets)
    .where(
      and(
        eq(driveAssets.rightsStatus, "APPROVED"),
        eq(driveAssets.processingStatus, "PENDING"),
      ),
    );

  if (eligible.length === 0) {
    return { started: false, reason: "No APPROVED + PENDING assets found" };
  }

  activePipelineRun = {
    running: true,
    startedAt: new Date(),
    total: eligible.length,
    queued: 0,
    skipped: 0,
    failed: 0,
    completed: 0,
    currentAssetId: null,
    errors: [],
  };

  // Fire-and-forget
  (async () => {
    for (const { id } of eligible) {
      if (!activePipelineRun) break;
      activePipelineRun.currentAssetId = id;
      try {
        const result = await ingestDriveAsset(id);
        if (result.queued) activePipelineRun.queued++;
        else if (result.skipped) activePipelineRun.skipped++;
        else {
          activePipelineRun.failed++;
          if (result.errorMessage) {
            activePipelineRun.errors.push({ assetId: id, message: result.errorMessage });
          }
        }
      } catch (err) {
        activePipelineRun.failed++;
        activePipelineRun.errors.push({
          assetId: id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
      activePipelineRun.completed++;
    }
    if (activePipelineRun) {
      activePipelineRun.running = false;
      activePipelineRun.currentAssetId = null;
    }
  })().catch((err) => {
    logger.error({ err }, "Bulk pipeline run crashed");
    if (activePipelineRun) {
      activePipelineRun.running = false;
      activePipelineRun.currentAssetId = null;
    }
  });

  return { started: true };
}

// ── Status sync ───────────────────────────────────────────────────────────────

/**
 * Sync processingStatus on drive_assets from the research pipeline's own state.
 * Should be called periodically (e.g., by the admin UI's status poll) or
 * triggered manually. Only updates assets that are in-flight (have a
 * sourceBatchItemId but haven't reached PUBLISHED/FAILED/CANCELLED).
 *
 * Returns the number of rows updated.
 */
export async function syncPipelineStatuses(): Promise<number> {
  const IN_FLIGHT_STATUSES: DriveProcessingStatus[] = [
    "INGESTION_QUEUED",
    "INGESTION_RUNNING",
    "INGESTION_COMPLETE",
    "EXTRACTION_QUEUED",
    "EXTRACTION_RUNNING",
    "EXTRACTION_COMPLETE",
    "SEGMENTATION_QUEUED",
    "SEGMENTATION_RUNNING",
    "SEGMENTATION_COMPLETE",
    "REVIEW_QUEUED",
    "REVIEW_IN_PROGRESS",
    "REVIEW_COMPLETE",
    "PUBLICATION_QUEUED",
  ];

  // Find in-flight assets that have a linked batch item
  const inFlight = await db
    .select({
      assetId: driveAssets.id,
      assetStatus: driveAssets.processingStatus,
      batchItemId: driveAssets.sourceBatchItemId,
    })
    .from(driveAssets)
    .where(
      and(
        isNotNull(driveAssets.sourceBatchItemId),
        inArray(driveAssets.processingStatus, IN_FLIGHT_STATUSES),
      ),
    )
    .limit(500);

  if (inFlight.length === 0) return 0;

  // Fetch batch item states
  const batchItemIds = inFlight.map((r) => r.batchItemId!);
  const batchItems = await db
    .select({
      id: researchUploadBatchItems.id,
      state: researchUploadBatchItems.state,
      containerId: researchUploadBatchItems.containerId,
    })
    .from(researchUploadBatchItems)
    .where(inArray(researchUploadBatchItems.id, batchItemIds));

  const batchItemMap = new Map(batchItems.map((b) => [b.id, b]));

  // Collect container IDs to batch-fetch their states
  const containerIds = batchItems
    .map((b) => b.containerId)
    .filter((id): id is number => id != null);

  const containers =
    containerIds.length > 0
      ? await db
          .select({ id: researchSourceContainers.id, processingState: researchSourceContainers.processingState })
          .from(researchSourceContainers)
          .where(inArray(researchSourceContainers.id, containerIds))
      : [];

  const containerMap = new Map(containers.map((c) => [c.id, c.processingState]));

  // Compute new status for each in-flight asset
  let updated = 0;
  for (const row of inFlight) {
    const batchItem = batchItemMap.get(row.batchItemId!);
    if (!batchItem) continue;

    let newStatus: DriveProcessingStatus | null = null;

    if (batchItem.state === "DEAD_LETTER" || batchItem.state === "REJECTED") {
      newStatus = "FAILED";
    } else if (batchItem.state === "DUPLICATE") {
      // Duplicate: the original container drives status
      if (batchItem.containerId) {
        const containerState = containerMap.get(batchItem.containerId);
        if (containerState) {
          newStatus = CONTAINER_STATE_MAP[containerState] ?? null;
        }
      }
    } else if (batchItem.containerId) {
      const containerState = containerMap.get(batchItem.containerId);
      if (containerState) {
        newStatus = CONTAINER_STATE_MAP[containerState] ?? null;
      }
    } else {
      // Batch item PENDING, not yet ingested
      newStatus = "INGESTION_QUEUED";
    }

    if (newStatus && newStatus !== row.assetStatus) {
      await db
        .update(driveAssets)
        .set({ processingStatus: newStatus, updatedAt: new Date() })
        .where(eq(driveAssets.id, row.assetId));
      updated++;
    }
  }

  return updated;
}
