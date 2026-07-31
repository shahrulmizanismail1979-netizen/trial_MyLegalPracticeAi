import {
  db,
  researchUploadBatches,
  researchUploadBatchItems,
  researchJobs,
  researchSourceContainers,
  type ResearchUploadBatch,
  type ResearchUploadBatchItem,
  type BatchItemState,
  type JobFailureReason,
} from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { recordAuditEvent } from "../domain/audit";
import {
  EntityNotFoundError,
  StateTransitionError,
  type DbClient,
} from "../domain/types";

// Upload-batch repository (Phase 03, ADR 0004). Batch items carry the
// dead-letter status — the 8-state job machine is untouched. Every item
// state change is guarded by the transition map below and audited.

export const BATCH_ITEM_TRANSITIONS: Readonly<
  Record<BatchItemState, readonly BatchItemState[]>
> = {
  PENDING: ["INGESTED", "DUPLICATE", "REJECTED", "DEAD_LETTER", "CANCELLED"],
  DEAD_LETTER: ["PENDING"], // retry
  CANCELLED: ["PENDING"], // restart
  INGESTED: [],
  DUPLICATE: [],
  REJECTED: [],
};

export function canTransitionBatchItem(
  from: BatchItemState,
  to: BatchItemState,
): boolean {
  return BATCH_ITEM_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function createBatch(
  values: {
    declaredSource: string;
    uploadedBy: string;
    provenance?: Record<string, unknown>;
  },
  dbc: DbClient = db,
): Promise<ResearchUploadBatch> {
  return dbc.transaction(async (tx) => {
    const [batch] = await tx
      .insert(researchUploadBatches)
      .values({
        declaredSource: values.declaredSource,
        uploadedBy: values.uploadedBy,
        provenance: values.provenance ?? {},
      })
      .returning();
    await recordAuditEvent(tx, {
      entityType: "upload_batch",
      entityId: batch!.id,
      event: "created",
      actor: values.uploadedBy,
      detail: { declaredSource: values.declaredSource },
    });
    return batch!;
  });
}

export async function getBatch(
  id: number,
  dbc: DbClient = db,
): Promise<ResearchUploadBatch | undefined> {
  const [row] = await dbc
    .select()
    .from(researchUploadBatches)
    .where(eq(researchUploadBatches.id, id));
  return row;
}

export async function listBatches(
  limit = 50,
  dbc: DbClient = db,
): Promise<ResearchUploadBatch[]> {
  return dbc
    .select()
    .from(researchUploadBatches)
    .orderBy(desc(researchUploadBatches.id))
    .limit(limit);
}

export async function createBatchItem(
  values: {
    batchId: number;
    originalPath: string;
    state?: BatchItemState;
    contentSha256?: string;
    sizeBytes?: number;
    mimeType?: string;
    stagingKey?: string;
    errorReport?: JobFailureReason;
    detail?: Record<string, unknown>;
  },
  dbc: DbClient = db,
): Promise<ResearchUploadBatchItem> {
  return dbc.transaction(async (tx) => {
    const [item] = await tx
      .insert(researchUploadBatchItems)
      .values(values)
      .returning();
    await tx
      .update(researchUploadBatches)
      .set({
        totalItems: sql`${researchUploadBatches.totalItems} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(researchUploadBatches.id, values.batchId));
    await recordAuditEvent(tx, {
      entityType: "batch_item",
      entityId: item!.id,
      event: "created",
      fromState: null,
      toState: item!.state,
      detail: {
        batchId: values.batchId,
        originalPath: values.originalPath,
        ...(values.errorReport ? { errorCode: values.errorReport.code } : {}),
      },
    });
    return item!;
  });
}

export async function getBatchItem(
  id: number,
  dbc: DbClient = db,
): Promise<ResearchUploadBatchItem | undefined> {
  const [row] = await dbc
    .select()
    .from(researchUploadBatchItems)
    .where(eq(researchUploadBatchItems.id, id));
  return row;
}

export async function listBatchItems(
  batchId: number,
  dbc: DbClient = db,
): Promise<ResearchUploadBatchItem[]> {
  return dbc
    .select()
    .from(researchUploadBatchItems)
    .where(eq(researchUploadBatchItems.batchId, batchId))
    .orderBy(researchUploadBatchItems.id);
}

// Extended item type that carries the ingest-job timing fields.
export interface BatchItemWithTiming extends ResearchUploadBatchItem {
  jobState: string | null;
  jobStartedAt: Date | null;
  jobFinishedAt: Date | null;
  /** Processing state of the linked research container (null if not yet created). */
  containerState: string | null;
}

/**
 * Like listBatchItems but joins research_jobs AND research_source_containers to
 * surface per-item job timing and container pipeline state. Used by the
 * batch-detail API so the frontend can show per-file ETA labels and pipeline
 * progress after rights approval.
 */
export async function listBatchItemsWithTiming(
  batchId: number,
  dbc: DbClient = db,
): Promise<BatchItemWithTiming[]> {
  const rows = await dbc
    .select({
      item: researchUploadBatchItems,
      jobState: researchJobs.state,
      jobStartedAt: researchJobs.startedAt,
      jobFinishedAt: researchJobs.finishedAt,
      containerState: researchSourceContainers.processingState,
    })
    .from(researchUploadBatchItems)
    .leftJoin(researchJobs, eq(researchUploadBatchItems.jobId, researchJobs.id))
    .leftJoin(
      researchSourceContainers,
      eq(researchUploadBatchItems.containerId, researchSourceContainers.id),
    )
    .where(eq(researchUploadBatchItems.batchId, batchId))
    .orderBy(researchUploadBatchItems.id);

  return rows.map((r) => ({
    ...r.item,
    jobState: r.jobState ?? null,
    jobStartedAt: r.jobStartedAt ?? null,
    jobFinishedAt: r.jobFinishedAt ?? null,
    containerState: r.containerState ?? null,
  }));
}

/**
 * Average ingest time (seconds) across items in the batch that already
 * finished. Returns null when there is not enough data.
 */
export function computeAvgSecondsPerItem(
  items: BatchItemWithTiming[],
): number | null {
  const durations: number[] = [];
  for (const it of items) {
    if (it.jobStartedAt && it.jobFinishedAt) {
      const secs =
        (it.jobFinishedAt.getTime() - it.jobStartedAt.getTime()) / 1000;
      if (secs > 0) durations.push(secs);
    }
  }
  if (durations.length === 0) return null;
  return durations.reduce((a, b) => a + b, 0) / durations.length;
}

/** Guarded batch-item transition: row lock, allowed-map check, audit event. */
export async function transitionBatchItem(
  itemId: number,
  to: BatchItemState,
  opts: {
    actor?: string;
    detail?: Record<string, unknown>;
    set?: Partial<typeof researchUploadBatchItems.$inferInsert>;
    dbc?: DbClient;
  } = {},
): Promise<ResearchUploadBatchItem> {
  const dbc = opts.dbc ?? db;
  return dbc.transaction(async (tx) => {
    const locked = await tx.execute(sql`
      SELECT id, state FROM research_upload_batch_items
      WHERE id = ${itemId} FOR UPDATE
    `);
    const row = locked.rows[0] as
      | { id: number; state: BatchItemState }
      | undefined;
    if (!row) throw new EntityNotFoundError("batch_item", itemId);
    if (!canTransitionBatchItem(row.state, to)) {
      throw new StateTransitionError("batch_item", itemId, row.state, to);
    }
    const [updated] = await tx
      .update(researchUploadBatchItems)
      .set({ ...opts.set, state: to, updatedAt: new Date() })
      .where(eq(researchUploadBatchItems.id, itemId))
      .returning();
    await recordAuditEvent(tx, {
      entityType: "batch_item",
      entityId: itemId,
      event: "state-transition",
      fromState: row.state,
      toState: to,
      actor: opts.actor,
      detail: opts.detail,
    });
    return updated!;
  });
}

/**
 * Dead-letter sync: any PENDING item whose ingest job ended FAILED_PERMANENT
 * moves to DEAD_LETTER, copying the job's structured failure reason into the
 * item's per-file error report. Idempotent; called on read and on demand.
 */
export async function syncDeadLetters(
  batchId: number,
  dbc: DbClient = db,
): Promise<number> {
  const rows = await dbc
    .select({
      itemId: researchUploadBatchItems.id,
      failureReason: researchJobs.failureReason,
    })
    .from(researchUploadBatchItems)
    .innerJoin(
      researchJobs,
      eq(researchUploadBatchItems.jobId, researchJobs.id),
    )
    .where(
      and(
        eq(researchUploadBatchItems.batchId, batchId),
        eq(researchUploadBatchItems.state, "PENDING"),
        eq(researchJobs.state, "FAILED_PERMANENT"),
      ),
    );
  let moved = 0;
  for (const row of rows) {
    await transitionBatchItem(row.itemId, "DEAD_LETTER", {
      actor: "system:dead-letter-sync",
      detail: { batchId, code: row.failureReason?.code },
      set: {
        errorReport: row.failureReason ?? {
          code: "UNKNOWN",
          message: "Ingest job failed permanently",
          retryable: false,
        },
      },
      dbc,
    });
    moved += 1;
  }
  return moved;
}

export interface BatchProgress {
  total: number;
  counts: Record<BatchItemState, number>;
  done: boolean;
}

export function computeProgress(
  items: ResearchUploadBatchItem[],
): BatchProgress {
  const counts: Record<BatchItemState, number> = {
    PENDING: 0,
    INGESTED: 0,
    DUPLICATE: 0,
    REJECTED: 0,
    DEAD_LETTER: 0,
    CANCELLED: 0,
  };
  for (const item of items) counts[item.state] += 1;
  return {
    total: items.length,
    counts,
    done: counts.PENDING === 0,
  };
}

/** Items in the given states (used by cancel/restart/retry flows). */
export async function listBatchItemsInStates(
  batchId: number,
  states: BatchItemState[],
  dbc: DbClient = db,
): Promise<ResearchUploadBatchItem[]> {
  return dbc
    .select()
    .from(researchUploadBatchItems)
    .where(
      and(
        eq(researchUploadBatchItems.batchId, batchId),
        inArray(researchUploadBatchItems.state, states),
      ),
    )
    .orderBy(researchUploadBatchItems.id);
}

export async function setBatchStatus(
  batchId: number,
  status: "ACTIVE" | "CANCELLED",
  actor: string,
  dbc: DbClient = db,
): Promise<void> {
  await dbc.transaction(async (tx) => {
    const [batch] = await tx
      .update(researchUploadBatches)
      .set({ status, updatedAt: new Date() })
      .where(eq(researchUploadBatches.id, batchId))
      .returning();
    if (!batch) throw new EntityNotFoundError("upload_batch", batchId);
    await recordAuditEvent(tx, {
      entityType: "upload_batch",
      entityId: batchId,
      event: `status:${status}`,
      actor,
    });
  });
}
