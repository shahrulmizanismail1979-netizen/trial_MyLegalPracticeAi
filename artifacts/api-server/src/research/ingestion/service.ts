import { createHash } from "node:crypto";
import path from "node:path";

// ── Filename sanitisation ──────────────────────────────────────────────────

/**
 * Safe character set for uploaded filenames.
 * We allow Latin letters, digits, dot, hyphen, underscore, and space.
 * Any other character is replaced with `_`.
 */
const SAFE_FILENAME_RE = /[^A-Za-z0-9._\- ]/g;

/**
 * Sanitise an uploaded file's declared name for safe storage and display.
 *
 * Process:
 * 1. Strip every directory component (`path.basename`) — prevents path traversal.
 * 2. Reject names that contain NUL bytes before or after stripping.
 * 3. Replace characters outside the safe set with `_`.
 * 4. Return `null` for names that are empty or entirely dots after sanitisation
 *    (e.g. `".."`, `"..."`) — the caller must reject these uploads.
 */
export function sanitiseFilename(raw: string): string | null {
  if (raw.includes("\0")) return null;
  // Strip directory components — renders "../../etc/passwd.pdf" → "passwd.pdf"
  // Also handle Windows-style backslash separators (path.basename only strips
  // the OS separator, so on Linux "C:\Windows\evil.pdf" is treated as one token).
  const afterBackslash = raw.split("\\").at(-1) ?? raw;
  const base = path.basename(afterBackslash);
  if (!base || base.includes("\0")) return null;
  // Replace every disallowed character with an underscore
  const clean = base.replace(SAFE_FILENAME_RE, "_");
  // Reject purely-dot names (e.g. "..", "...")
  if (!clean || /^\.+$/.test(clean)) return null;
  return clean;
}
import {
  db,
  researchSourceContainers,
  researchTransformations,
  type ResearchUploadBatch,
  type ResearchUploadBatchItem,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { getAdapters } from "../adapters";
import { recordAuditEvent } from "../domain/audit";
import { registerContainer, routeToReview } from "../data/containers";
import {
  createBatch,
  createBatchItem,
  getBatch,
  getBatchItem,
  listBatchItemsInStates,
  setBatchStatus,
  syncDeadLetters,
  transitionBatchItem,
} from "../data/uploads";
import { enqueue, cancel as cancelJob, registerProcessor } from "../processing";
import { ProcessorFailure } from "../processing/handlers";
import type { DbClient } from "../domain/types";
import {
  inspectZip,
  validateFile,
  isZipSignature,
  type Rejection,
} from "./validation";

// Phase 03 ingestion service (ADR 0004). The upload route stays content-
// neutral: validate → stage bytes → enqueue a resumable container.ingest job
// per item. Registration, dedup, and rights-review routing happen in the job
// runner so they are idempotent and retryable. A failing file only ever
// affects its own batch item.

export const INGEST_JOB_KIND = "container.ingest";

/** Postgres unique-violation (SQLSTATE 23505), possibly wrapped by drizzle. */
function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: unknown; cause?: unknown };
  if (e.code === "23505") return true;
  return isUniqueViolation(e.cause);
}

export interface UploadedFile {
  originalName: string;
  bytes: Buffer;
  declaredMime?: string;
}

interface LogicalFile {
  path: string;
  bytes: Buffer;
  mimeType: string;
}

function rejectionReport(rejection: Rejection) {
  return { code: rejection.code, message: rejection.message, retryable: false };
}

/**
 * Process an upload submission: expand ZIPs, validate every logical file,
 * stage accepted bytes, and enqueue one ingest job per item. Never throws on
 * a bad file — failures are isolated to their own batch items.
 */
export async function processUpload(
  files: UploadedFile[],
  opts: {
    declaredSource: string;
    uploadedBy: string;
    provenance?: Record<string, unknown>;
  },
): Promise<{ batch: ResearchUploadBatch; items: ResearchUploadBatchItem[] }> {
  const batch = await createBatch({
    declaredSource: opts.declaredSource,
    uploadedBy: opts.uploadedBy,
    provenance: {
      ...opts.provenance,
      fileCount: files.length,
    },
  });

  const items: ResearchUploadBatchItem[] = [];

  for (const file of files) {
    // ── Filename sanitisation ───────────────────────────────────────────────
    // Sanitise the declared filename before any further processing.
    // A null result means the name is structurally unsafe (e.g. path traversal
    // sequences, NUL bytes, or empty after stripping).
    const safeName = sanitiseFilename(file.originalName);
    if (!safeName) {
      items.push(
        await createBatchItem({
          batchId: batch.id,
          originalPath: file.originalName,
          state: "REJECTED",
          sizeBytes: file.bytes.length,
          errorReport: {
            code: "UNSAFE_FILENAME",
            message: `File name '${file.originalName}' contains unsafe characters or path components`,
            retryable: false,
          },
        }),
      );
      continue;
    }
    // Use the sanitised name for all downstream processing
    const safeFile: UploadedFile = { ...file, originalName: safeName };

    const ext = path.extname(safeFile.originalName).toLowerCase();
    const isArchive =
      ext === ".zip" ||
      (ext !== ".docx" && isZipSignature(safeFile.bytes));

    const logical: LogicalFile[] = [];
    if (isArchive) {
      const inspection = inspectZip(safeFile.originalName, safeFile.bytes);
      if (inspection.zipRejection) {
        items.push(
          await createBatchItem({
            batchId: batch.id,
            originalPath: safeFile.originalName,
            state: "REJECTED",
            sizeBytes: safeFile.bytes.length,
            errorReport: rejectionReport(inspection.zipRejection),
          }),
        );
        continue;
      }
      for (const entry of inspection.entries) {
        if (entry.rejection) {
          items.push(
            await createBatchItem({
              batchId: batch.id,
              originalPath: entry.path,
              state: "REJECTED",
              errorReport: rejectionReport(entry.rejection),
            }),
          );
        } else {
          logical.push({
            path: entry.path,
            bytes: entry.bytes!,
            mimeType: entry.mimeType!,
          });
        }
      }
    } else {
      const result = validateFile(
        safeFile.originalName,
        safeFile.bytes,
        safeFile.declaredMime,
      );
      if (!result.ok) {
        items.push(
          await createBatchItem({
            batchId: batch.id,
            originalPath: safeFile.originalName,
            state: "REJECTED",
            sizeBytes: safeFile.bytes.length,
            errorReport: rejectionReport(result.rejection),
          }),
        );
        continue;
      }
      logical.push({
        path: safeFile.originalName,
        bytes: safeFile.bytes,
        mimeType: result.mimeType,
      });
    }

    for (const lf of logical) {
      const sha = createHash("sha256").update(lf.bytes).digest("hex");
      const item = await createBatchItem({
        batchId: batch.id,
        originalPath: lf.path,
        contentSha256: sha,
        sizeBytes: lf.bytes.length,
        mimeType: lf.mimeType,
      });
      let staged: ResearchUploadBatchItem;
      try {
        const stagingKey = await getAdapters().storage.put(
          `research/containers/${batch.id}/${item.id}-${sha}`,
          lf.bytes,
          lf.mimeType,
        );
        staged = await transitionBatchItemSet(item.id, stagingKey);
      } catch (err) {
        // Bytes could not be persisted — unrecoverable without re-upload.
        logger.error(
          { batchId: batch.id, itemId: item.id, err: (err as Error).message },
          "Research upload staging failed",
        );
        items.push(
          await transitionBatchItem(item.id, "DEAD_LETTER", {
            actor: opts.uploadedBy,
            set: {
              errorReport: {
                code: "STAGING_FAILED",
                message:
                  "Bytes could not be persisted to storage; re-upload required",
                retryable: false,
              },
            },
          }),
        );
        continue;
      }
      const enqueued = await enqueueIngestJob(staged, 0, opts.uploadedBy);
      items.push(enqueued);
    }
  }

  return { batch, items };
}

// Attach the staging key outside the guarded transition (state unchanged).
async function transitionBatchItemSet(
  itemId: number,
  stagingKey: string,
): Promise<ResearchUploadBatchItem> {
  const { researchUploadBatchItems } = await import("@workspace/db");
  const [updated] = await db
    .update(researchUploadBatchItems)
    .set({ stagingKey, updatedAt: new Date() })
    .where(eq(researchUploadBatchItems.id, itemId))
    .returning();
  return updated!;
}

/** Enqueue (or re-enqueue) the ingest job for an item. Attempt-suffixed keys
 * keep old FAILED_PERMANENT jobs terminal while making retries possible. */
export async function enqueueIngestJob(
  item: ResearchUploadBatchItem,
  attempt: number,
  actor: string,
): Promise<ResearchUploadBatchItem> {
  const idempotencyKey =
    attempt === 0
      ? `ingest-item-${item.id}`
      : `ingest-item-${item.id}-r${attempt}`;
  const job = await enqueue(
    INGEST_JOB_KIND,
    idempotencyKey,
    { batchItemId: item.id, batchId: item.batchId },
    {
      actor,
      sourceChecksum: item.contentSha256 ?? undefined,
      provenance: { batchId: item.batchId, batchItemId: item.id, attempt },
    },
  );
  if (!job) return item;
  const { researchUploadBatchItems } = await import("@workspace/db");
  const [updated] = await db
    .update(researchUploadBatchItems)
    .set({ jobId: job.id, retryCount: attempt, updatedAt: new Date() })
    .where(eq(researchUploadBatchItems.id, item.id))
    .returning();
  return updated!;
}

/** Retry a dead-lettered item: DEAD_LETTER → PENDING + a fresh job. */
export async function retryBatchItem(
  itemId: number,
  actor: string,
): Promise<ResearchUploadBatchItem> {
  const item = await getBatchItem(itemId);
  if (!item) throw new Error(`Batch item ${itemId} not found`);
  if (item.errorReport?.code === "STAGING_FAILED" || !item.stagingKey) {
    throw new ProcessorFailure(
      "NOT_RETRYABLE",
      "Item has no staged bytes; re-upload is required",
      false,
    );
  }
  const pending = await transitionBatchItem(itemId, "PENDING", {
    actor,
    detail: { action: "retry" },
    set: { errorReport: null },
  });
  return enqueueIngestJob(pending, (item.retryCount ?? 0) + 1, actor);
}

/** Cancel a batch: cancel queued jobs and mark PENDING items CANCELLED. */
export async function cancelBatch(
  batchId: number,
  actor: string,
): Promise<number> {
  await syncDeadLetters(batchId);
  const pending = await listBatchItemsInStates(batchId, ["PENDING"]);
  let cancelled = 0;
  for (const item of pending) {
    if (item.jobId) {
      try {
        await cancelJob(item.jobId, { actor });
      } catch {
        // Job already terminal (e.g. SUCCEEDED racing this cancel) — the
        // item transition below is the authoritative guard.
      }
    }
    try {
      await transitionBatchItem(item.id, "CANCELLED", {
        actor,
        detail: { action: "cancel-batch" },
      });
      cancelled += 1;
    } catch {
      // Item finished between the list and the lock; leave it be.
    }
  }
  await setBatchStatus(batchId, "CANCELLED", actor);
  return cancelled;
}

/** Restart a batch: CANCELLED/DEAD_LETTER items go back to PENDING with new jobs. */
export async function restartBatch(
  batchId: number,
  actor: string,
): Promise<number> {
  await setBatchStatus(batchId, "ACTIVE", actor);
  const stopped = await listBatchItemsInStates(batchId, [
    "CANCELLED",
    "DEAD_LETTER",
  ]);
  let restarted = 0;
  for (const item of stopped) {
    if (!item.stagingKey) continue; // nothing staged — needs re-upload
    const pending = await transitionBatchItem(item.id, "PENDING", {
      actor,
      detail: { action: "restart-batch" },
      set: { errorReport: null },
    });
    await enqueueIngestJob(pending, (item.retryCount ?? 0) + 1, actor);
    restarted += 1;
  }
  return restarted;
}

/**
 * container.ingest processor. touchesContent:false — it registers a
 * container and routes it to rights review, but never interprets content
 * (inventory is a separate, rights-gated job).
 */
async function ingestProcessor({
  job,
  dbc,
}: {
  job: { id: number; payload: Record<string, unknown> };
  dbc: DbClient;
}): Promise<{ outputChecksum?: string }> {
  const batchItemId = job.payload["batchItemId"];
  if (typeof batchItemId !== "number") {
    throw new ProcessorFailure(
      "MISSING_BATCH_ITEM",
      "container.ingest payload has no batchItemId",
      false,
    );
  }
  const item = await getBatchItem(batchItemId, dbc);
  if (!item) {
    throw new ProcessorFailure(
      "MISSING_BATCH_ITEM",
      `Batch item ${batchItemId} not found`,
      false,
    );
  }
  if (item.state !== "PENDING") return {}; // idempotent re-execution
  if (!item.stagingKey || !item.contentSha256 || !item.mimeType) {
    throw new ProcessorFailure(
      "MISSING_STAGED_BYTES",
      `Batch item ${batchItemId} has no staged bytes/checksum`,
      false,
    );
  }

  // SHA-256 duplicate detection: flag, never silently re-ingest.
  const sha = item.contentSha256;
  const markDuplicate = async (existingId: number) => {
    await dbc.transaction(async (tx) => {
      await transitionBatchItem(item.id, "DUPLICATE", {
        actor: `job:${job.id}`,
        detail: { duplicateOfContainerId: existingId },
        set: { duplicateOfContainerId: existingId },
        dbc: tx,
      });
      await tx.insert(researchTransformations).values({
        containerId: existingId,
        kind: "duplicate-upload",
        detail: {
          batchId: item.batchId,
          batchItemId: item.id,
          originalPath: item.originalPath,
          contentSha256: item.contentSha256,
        },
        actor: `job:${job.id}`,
      });
      await recordAuditEvent(tx, {
        entityType: "batch_item",
        entityId: item.id,
        event: "duplicate-detected",
        actor: `job:${job.id}`,
        detail: { duplicateOfContainerId: existingId },
      });
    });
    return { outputChecksum: sha };
  };

  const [existing] = await dbc
    .select({ id: researchSourceContainers.id })
    .from(researchSourceContainers)
    .where(eq(researchSourceContainers.contentSha256, item.contentSha256))
    .limit(1);
  if (existing) return markDuplicate(existing.id);

  // Resolve the uploader identity from the batch record (Task #7).
  const batch = await getBatch(item.batchId, dbc);
  const uploadedBy = batch?.uploadedBy ?? null;

  let container;
  try {
    container = await registerContainer(
      {
        originalName: path.basename(item.originalPath),
        sourceBatch: `upload-batch-${item.batchId}`,
        contentSha256: item.contentSha256,
        sizeBytes: item.sizeBytes ?? 0,
        mimeType: item.mimeType,
        storageKey: item.stagingKey,
        uploadedBy,
        provenance: {
          enteredVia: "upload",
          batchId: item.batchId,
          batchItemId: item.id,
          originalPath: item.originalPath,
          uploadedAt: item.createdAt.toISOString(),
        },
      },
      dbc,
    );
  } catch (err) {
    // Unique-violation on content_sha256: a concurrent job registered the
    // same bytes between our pre-check and insert. Resolve as DUPLICATE —
    // the unique index guarantees at most one container per SHA-256.
    if (isUniqueViolation(err)) {
      const [winner] = await dbc
        .select({ id: researchSourceContainers.id })
        .from(researchSourceContainers)
        .where(eq(researchSourceContainers.contentSha256, item.contentSha256))
        .limit(1);
      if (winner) return markDuplicate(winner.id);
    }
    throw err;
  }
  // New containers go straight to the rights-review queue (UNREVIEWED).
  await routeToReview(container.id, "New upload awaiting rights review", {
    kind: "rights",
    actor: `job:${job.id}`,
    dbc,
  });
  await transitionBatchItem(item.id, "INGESTED", {
    actor: `job:${job.id}`,
    detail: { containerId: container.id },
    set: { containerId: container.id },
    dbc,
  });
  return { outputChecksum: sha };
}

let registered = false;
/** Register Phase 03 processors (idempotent; called at route/test setup). */
export function registerIngestionProcessors(): void {
  if (registered) return;
  registered = true;
  registerProcessor(INGEST_JOB_KIND, ingestProcessor, {
    touchesContent: false,
  });
}
