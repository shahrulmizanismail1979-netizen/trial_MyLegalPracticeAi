import {
  db,
  researchJobs,
  researchStoredArtifacts,
  type ResearchJob,
  type JobState,
  type JobFailureReason,
  type ResearchStoredArtifact,
} from "@workspace/db";
import { sql } from "drizzle-orm";
import { recordAuditEvent } from "../domain/audit";
import { transitionJob } from "../domain/jobStateMachine";
import type { DbClient } from "../domain/types";

// Database-backed job queue (Phase 01). Jobs are idempotent (unique
// idempotency key), resumable (state lives entirely in research_jobs), and
// follow the 8-state machine in domain/jobStateMachine.ts. Payloads carry
// references (ids, keys) — never restricted content.

export interface EnqueueOptions {
  maxAttempts?: number;
  processorVersion?: string;
  sourceChecksum?: string;
  provenance?: Record<string, unknown>;
  actor?: string;
  dbc?: DbClient;
}

/**
 * Idempotent enqueue: returns null when a job with the same idempotency key
 * already exists (the original job stands). Creation writes an audit event in
 * the same transaction.
 */
export async function enqueue(
  kind: string,
  idempotencyKey: string,
  payload: Record<string, unknown>,
  opts: EnqueueOptions = {},
): Promise<ResearchJob | null> {
  const dbc = opts.dbc ?? db;
  return dbc.transaction(async (tx) => {
    const [job] = await tx
      .insert(researchJobs)
      .values({
        kind,
        idempotencyKey,
        payload,
        maxAttempts: opts.maxAttempts ?? 3,
        processorVersion: opts.processorVersion ?? "unversioned",
        sourceChecksum: opts.sourceChecksum,
        provenance: opts.provenance ?? {},
      })
      .onConflictDoNothing({ target: researchJobs.idempotencyKey })
      .returning();
    if (!job) return null; // duplicate enqueue; idempotency preserved
    await recordAuditEvent(tx, {
      entityType: "job",
      entityId: job.id,
      event: "enqueued",
      fromState: null,
      toState: "QUEUED",
      actor: opts.actor,
      detail: { kind, idempotencyKey },
    });
    return job;
  });
}

/**
 * Atomically claim the oldest QUEUED job (optionally of a given kind).
 * Single-statement UPDATE with SKIP LOCKED semantics so concurrent workers
 * never double-claim; the audit event is written in the same transaction.
 */
export async function claimNext(
  kind?: string,
  dbc: DbClient = db,
): Promise<ResearchJob | null> {
  return dbc.transaction(async (tx) => {
    const rows = await tx.execute(sql`
      UPDATE research_jobs SET
        state = 'RUNNING',
        attempts = attempts + 1,
        claimed_at = now(),
        started_at = COALESCE(started_at, now())
      WHERE id = (
        SELECT id FROM research_jobs
        WHERE state = 'QUEUED' ${kind ? sql`AND kind = ${kind}` : sql``}
        ORDER BY id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id, kind, idempotency_key, payload, state, attempts,
        max_attempts, processor_version, failure_reason, last_error,
        source_checksum, output_checksum, provenance,
        claimed_at, started_at, finished_at, created_at
    `);
    const row = rows.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    await recordAuditEvent(tx, {
      entityType: "job",
      entityId: row.id as number,
      event: "state-transition",
      fromState: "QUEUED",
      toState: "RUNNING",
      detail: { attempt: row.attempts as number },
    });
    return {
      id: row.id as number,
      kind: row.kind as string,
      idempotencyKey: row.idempotency_key as string,
      payload: row.payload as Record<string, unknown>,
      state: row.state as JobState,
      attempts: row.attempts as number,
      maxAttempts: row.max_attempts as number,
      processorVersion: row.processor_version as string,
      failureReason: row.failure_reason as JobFailureReason | null,
      lastError: row.last_error as string | null,
      sourceChecksum: row.source_checksum as string | null,
      outputChecksum: row.output_checksum as string | null,
      provenance: row.provenance as Record<string, unknown>,
      claimedAt: row.claimed_at as Date | null,
      startedAt: row.started_at as Date | null,
      finishedAt: row.finished_at as Date | null,
      createdAt: row.created_at as Date,
    };
  });
}

export async function complete(
  jobId: number,
  opts: { outputChecksum?: string; actor?: string; dbc?: DbClient } = {},
): Promise<ResearchJob> {
  return transitionJob(jobId, "SUCCEEDED", {
    actor: opts.actor,
    set: { finishedAt: new Date(), outputChecksum: opts.outputChecksum },
    dbc: opts.dbc,
  });
}

/**
 * Record a failure with a structured reason. Retryable failures pass through
 * FAILED_RETRYABLE and requeue while attempts remain; otherwise the job ends
 * FAILED_PERMANENT. Failure reasons must already be free of restricted
 * content.
 */
export async function fail(
  jobId: number,
  reason: JobFailureReason,
  opts: { actor?: string; dbc?: DbClient } = {},
): Promise<ResearchJob> {
  const dbc = opts.dbc ?? db;
  return dbc.transaction(async (tx) => {
    const failed = await transitionJob(
      jobId,
      reason.retryable ? "FAILED_RETRYABLE" : "FAILED_PERMANENT",
      {
        actor: opts.actor,
        detail: { code: reason.code },
        set: {
          failureReason: reason,
          lastError: reason.message,
          ...(reason.retryable ? {} : { finishedAt: new Date() }),
        },
        dbc: tx,
      },
    );
    if (!reason.retryable) return failed;
    if (failed.attempts < failed.maxAttempts) {
      return transitionJob(jobId, "QUEUED", {
        actor: opts.actor,
        detail: { requeue: true, attempt: failed.attempts },
        dbc: tx,
      });
    }
    return transitionJob(jobId, "FAILED_PERMANENT", {
      actor: opts.actor,
      detail: { code: reason.code, retriesExhausted: true },
      set: { finishedAt: new Date() },
      dbc: tx,
    });
  });
}

/** Route a running job to human review (uncertainty is preserved). */
export async function requireReview(
  jobId: number,
  detail: Record<string, unknown> = {},
  opts: { actor?: string; dbc?: DbClient } = {},
): Promise<ResearchJob> {
  return transitionJob(jobId, "REVIEW_REQUIRED", {
    actor: opts.actor,
    detail,
    dbc: opts.dbc,
  });
}

/** Block a job on rights grounds; it can be requeued after a rights decision. */
export async function blockByRights(
  jobId: number,
  detail: Record<string, unknown> = {},
  opts: { actor?: string; dbc?: DbClient } = {},
): Promise<ResearchJob> {
  return transitionJob(jobId, "BLOCKED_BY_RIGHTS", {
    actor: opts.actor,
    detail,
    dbc: opts.dbc,
  });
}

export async function cancel(
  jobId: number,
  opts: {
    actor?: string;
    detail?: Record<string, unknown>;
    dbc?: DbClient;
  } = {},
): Promise<ResearchJob> {
  return transitionJob(jobId, "CANCELLED", {
    actor: opts.actor,
    detail: opts.detail,
    set: { finishedAt: new Date() },
    dbc: opts.dbc,
  });
}

/** Return a paused job (review/rights/retryable) to the queue. */
export async function requeue(
  jobId: number,
  opts: {
    actor?: string;
    detail?: Record<string, unknown>;
    dbc?: DbClient;
  } = {},
): Promise<ResearchJob> {
  return transitionJob(jobId, "QUEUED", {
    actor: opts.actor,
    detail: opts.detail,
    dbc: opts.dbc,
  });
}

/**
 * Record a processor output idempotently: keyed by (produced_by_key, kind),
 * so re-running the same job never duplicates outputs. Returns null when the
 * artifact already exists.
 */
export async function recordStoredArtifact(
  values: {
    jobId: number;
    producedByKey: string;
    kind: string;
    storageKey: string;
    contentSha256: string;
    sizeBytes: number;
    containerId?: number;
    provenance?: Record<string, unknown>;
  },
  dbc: DbClient = db,
): Promise<ResearchStoredArtifact | null> {
  const [artifact] = await dbc
    .insert(researchStoredArtifacts)
    .values({ provenance: {}, ...values })
    .onConflictDoNothing({
      target: [
        researchStoredArtifacts.producedByKey,
        researchStoredArtifacts.kind,
      ],
    })
    .returning();
  return artifact ?? null;
}
