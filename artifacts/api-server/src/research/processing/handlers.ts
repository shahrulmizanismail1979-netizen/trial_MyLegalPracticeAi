import { logger } from "../../lib/logger";
import { claimNext, complete, fail, type ResearchJob } from "./index";

// Job handlers (Phase 00). Handlers must be idempotent: a job may be
// re-executed after a crash. Handlers never log restricted content — only
// ids, kinds, and states.

type Handler = (job: ResearchJob) => Promise<void>;

const handlers: Record<string, Handler> = {
  // Phase 00 proof-of-loop handler: a container was registered. Extraction,
  // OCR, and segmentation are later phases — this is deliberately a no-op.
  "container.registered": async (job) => {
    logger.info(
      { jobId: job.id, containerId: job.payload["containerId"] },
      "Research container registered",
    );
  },
};

/**
 * Claim and run the next queued job. Returns the finished job (with outcome
 * applied) or null when the queue is empty.
 */
export async function runNextJob(kind?: string): Promise<ResearchJob | null> {
  const job = await claimNext(kind);
  if (!job) return null;
  const handler = handlers[job.kind];
  try {
    if (!handler) {
      throw new Error(`No handler registered for job kind '${job.kind}'`);
    }
    await handler(job);
    await complete(job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { jobId: job.id, kind: job.kind, err: message },
      "Research job failed",
    );
    await fail(job.id, message);
  }
  return job;
}
