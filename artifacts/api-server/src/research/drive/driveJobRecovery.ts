/**
 * Stale RUNNING drive.ingest job recovery.
 *
 * `claimNext()` transitions a job to RUNNING but there is no lease timeout in
 * the base job runner.  If the server crashes or is restarted while a
 * drive.ingest job is RUNNING, that job stays permanently RUNNING and is never
 * retried unless something moves it back to QUEUED.
 *
 * Call `recoverStaleDriveIngestJobs()` once at worker startup (before the
 * polling loop) to sweep for orphaned RUNNING jobs and transition them back
 * through FAILED_RETRYABLE → QUEUED so the worker picks them up again.
 *
 * RUNNING → QUEUED is not an allowed transition in the state machine, so we
 * use the existing `fail()` helper with retryable=true, which handles the two-
 * step transition and respects the maxAttempts limit.
 */
import { db, researchJobs } from "@workspace/db";
import { and, eq, lt, sql } from "drizzle-orm";
import { fail } from "../processing";
import { logger } from "../../lib/logger";
import { DRIVE_INGEST_JOB_KIND } from "./driveIngestProcessor";

/**
 * Default threshold for periodic sweeps during normal operation. Jobs running
 * longer than this are assumed to have lost their worker (e.g. OOM kill).
 */
export const DEFAULT_STALE_THRESHOLD_MINUTES = 10;

/**
 * Find RUNNING drive.ingest jobs and transition each one back to QUEUED via
 * fail(retryable=true) → FAILED_RETRYABLE → QUEUED.
 *
 * `thresholdMinutes` controls the age filter on `claimed_at`:
 *  - Pass `0` (or omit and call at worker startup) to recover ALL RUNNING jobs
 *    unconditionally.  After a process restart there are no legitimate active
 *    workers, so every RUNNING job is an orphan regardless of age.
 *  - Pass a positive value for periodic sweeps during normal operation, where
 *    newly-claimed jobs may still be actively running in another worker thread.
 *
 * Jobs that have exhausted their attempts are moved to FAILED_PERMANENT by the
 * existing `fail()` logic — no special handling needed here.
 *
 * Returns the number of jobs successfully recovered.
 */
export async function recoverStaleDriveIngestJobs(
  opts: { thresholdMinutes?: number } = {},
): Promise<number> {
  const thresholdMinutes = opts.thresholdMinutes ?? DEFAULT_STALE_THRESHOLD_MINUTES;

  // Build the WHERE clause: always filter by kind + RUNNING state.
  // Only add the age filter for periodic sweeps (thresholdMinutes > 0).
  const whereConditions =
    thresholdMinutes > 0
      ? and(
          eq(researchJobs.kind, DRIVE_INGEST_JOB_KIND),
          eq(researchJobs.state, "RUNNING"),
          lt(researchJobs.claimedAt, new Date(Date.now() - thresholdMinutes * 60 * 1000)),
        )
      : and(
          eq(researchJobs.kind, DRIVE_INGEST_JOB_KIND),
          eq(researchJobs.state, "RUNNING"),
        );

  const orphaned = await db
    .select({ id: researchJobs.id, attempts: researchJobs.attempts })
    .from(researchJobs)
    .where(whereConditions);

  if (orphaned.length === 0) return 0;

  logger.warn(
    { count: orphaned.length, thresholdMinutes },
    thresholdMinutes === 0
      ? "drive.ingest: startup recovery — requeuing all RUNNING jobs (no active workers after restart)"
      : "drive.ingest: periodic sweep — recovering stale RUNNING jobs",
  );

  let recovered = 0;
  for (const job of orphaned) {
    try {
      await fail(job.id, {
        code: "STALE_RUNNING",
        message:
          thresholdMinutes === 0
            ? "Worker restarted; job was RUNNING with no active claimant. Requeuing."
            : `Job was RUNNING for >${thresholdMinutes} minutes without completing. Requeuing.`,
        retryable: true,
      });
      recovered++;
    } catch (err) {
      // Log but don't abort — recover as many jobs as possible.
      logger.error({ jobId: job.id, err }, "drive.ingest: failed to recover orphaned job");
    }
  }

  logger.info({ recovered }, "drive.ingest: job recovery complete");
  return recovered;
}
