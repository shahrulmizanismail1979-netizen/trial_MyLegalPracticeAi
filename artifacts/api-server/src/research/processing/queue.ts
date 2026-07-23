import { db, researchJobs, type ResearchJob } from "@workspace/db";
import { and, eq, lt, sql } from "drizzle-orm";

// Database-backed job queue (Phase 00). Jobs are idempotent (unique
// idempotency key) and resumable: state lives entirely in research_jobs.
// Payloads must carry references (ids, keys) — never restricted content.

export async function enqueue(
  kind: string,
  idempotencyKey: string,
  payload: Record<string, unknown>,
  maxAttempts = 3,
): Promise<ResearchJob | null> {
  const [job] = await db
    .insert(researchJobs)
    .values({ kind, idempotencyKey, payload, maxAttempts })
    .onConflictDoNothing({ target: researchJobs.idempotencyKey })
    .returning();
  // null → duplicate enqueue; the original job stands (idempotency).
  return job ?? null;
}

/**
 * Atomically claim the oldest queued job (optionally of a given kind).
 * Single-statement UPDATE with SKIP LOCKED semantics so concurrent workers
 * never double-claim.
 */
export async function claimNext(kind?: string): Promise<ResearchJob | null> {
  const rows = await db.execute(sql`
    UPDATE research_jobs SET
      state = 'running',
      attempts = attempts + 1,
      claimed_at = now()
    WHERE id = (
      SELECT id FROM research_jobs
      WHERE state = 'queued' ${kind ? sql`AND kind = ${kind}` : sql``}
      ORDER BY id
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, kind, idempotency_key, payload, state, attempts,
      max_attempts, last_error, claimed_at, finished_at, created_at
  `);
  const row = rows.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as number,
    kind: row.kind as string,
    idempotencyKey: row.idempotency_key as string,
    payload: row.payload as Record<string, unknown>,
    state: row.state as string,
    attempts: row.attempts as number,
    maxAttempts: row.max_attempts as number,
    lastError: row.last_error as string | null,
    claimedAt: row.claimed_at as Date | null,
    finishedAt: row.finished_at as Date | null,
    createdAt: row.created_at as Date,
  };
}

export async function complete(jobId: number): Promise<void> {
  await db
    .update(researchJobs)
    .set({ state: "succeeded", finishedAt: new Date() })
    .where(eq(researchJobs.id, jobId));
}

/**
 * Record a failure. Requeues while attempts remain; otherwise marks the job
 * dead (requires human attention). Error text is recorded on the row and must
 * already be free of restricted content.
 */
export async function fail(jobId: number, error: string): Promise<void> {
  const requeued = await db
    .update(researchJobs)
    .set({ state: "queued", lastError: error })
    .where(
      and(
        eq(researchJobs.id, jobId),
        lt(researchJobs.attempts, researchJobs.maxAttempts),
      ),
    )
    .returning({ id: researchJobs.id });
  if (requeued.length === 0) {
    await db
      .update(researchJobs)
      .set({ state: "dead", lastError: error, finishedAt: new Date() })
      .where(eq(researchJobs.id, jobId));
  }
}
