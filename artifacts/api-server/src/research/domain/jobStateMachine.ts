import {
  db,
  researchJobs,
  type JobState,
  type ResearchJob,
} from "@workspace/db";
import { sql } from "drizzle-orm";
import { recordAuditEvent } from "./audit";
import {
  StateTransitionError,
  EntityNotFoundError,
  type DbClient,
} from "./types";

// Job state machine (Phase 01). The 8 required states; SUCCEEDED,
// FAILED_PERMANENT, and CANCELLED are terminal. Every transition goes through
// transitionJob() and writes an audit event in the same transaction.

export const JOB_TRANSITIONS: Readonly<Record<JobState, readonly JobState[]>> =
  {
    QUEUED: ["RUNNING", "CANCELLED", "BLOCKED_BY_RIGHTS"],
    RUNNING: [
      "SUCCEEDED",
      "FAILED_RETRYABLE",
      "FAILED_PERMANENT",
      "REVIEW_REQUIRED",
      "BLOCKED_BY_RIGHTS",
      "CANCELLED",
    ],
    FAILED_RETRYABLE: ["QUEUED", "FAILED_PERMANENT", "CANCELLED"],
    REVIEW_REQUIRED: ["QUEUED", "CANCELLED"],
    BLOCKED_BY_RIGHTS: ["QUEUED", "CANCELLED"],
    SUCCEEDED: [],
    FAILED_PERMANENT: [],
    CANCELLED: [],
  };

export function canTransitionJob(from: JobState, to: JobState): boolean {
  return JOB_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Guarded job transition: locks the row, validates against the allowed map,
 * applies the change (plus any extra column updates), and writes the audit
 * event — all in one transaction.
 */
export async function transitionJob(
  jobId: number,
  to: JobState,
  opts: {
    actor?: string;
    detail?: Record<string, unknown>;
    set?: Partial<typeof researchJobs.$inferInsert>;
    dbc?: DbClient;
  } = {},
): Promise<ResearchJob> {
  const dbc = opts.dbc ?? db;
  return dbc.transaction(async (tx) => {
    const locked = await tx.execute(sql`
      SELECT id, state FROM research_jobs WHERE id = ${jobId} FOR UPDATE
    `);
    const row = locked.rows[0] as { id: number; state: JobState } | undefined;
    if (!row) throw new EntityNotFoundError("job", jobId);
    const from = row.state;
    if (!canTransitionJob(from, to)) {
      throw new StateTransitionError("job", jobId, from, to);
    }
    const [updated] = await tx
      .update(researchJobs)
      .set({ ...opts.set, state: to })
      .where(sql`${researchJobs.id} = ${jobId}`)
      .returning();
    await recordAuditEvent(tx, {
      entityType: "job",
      entityId: jobId,
      event: "state-transition",
      fromState: from,
      toState: to,
      actor: opts.actor,
      detail: opts.detail,
    });
    return updated!;
  });
}
