import { logger } from "../../lib/logger";
import { db, researchReviewItems, type ResearchJob } from "@workspace/db";
import { checkContainerAccess } from "../domain/gates";
import {
  claimNext,
  complete,
  fail,
  requireReview,
  blockByRights,
  recordStoredArtifact,
} from "./queue";
import type { DbClient } from "../domain/types";

// Processor contract (Phase 01). Processors must be idempotent: a job may be
// re-executed after a crash, and outputs are deduplicated by the job's
// idempotency key (recordStoredArtifact). Processors never log restricted
// content — only ids, kinds, and states.

/** Signals a processor may throw to route the job to a non-failure outcome. */
export class ReviewRequiredSignal extends Error {
  constructor(readonly detail: Record<string, unknown> = {}) {
    super("processor routed job to human review");
    this.name = "ReviewRequiredSignal";
  }
}

export class RightsBlockedSignal extends Error {
  constructor(readonly detail: Record<string, unknown> = {}) {
    super("processor blocked job on rights grounds");
    this.name = "RightsBlockedSignal";
  }
}

/** A structured, classified processor failure. */
export class ProcessorFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ProcessorFailure";
  }
}

export interface ProcessorContext {
  job: ResearchJob;
  dbc: DbClient;
  /** Record an output idempotently (no duplicates on re-execution). */
  recordArtifact(artifact: {
    kind: string;
    storageKey: string;
    contentSha256: string;
    sizeBytes: number;
    containerId?: number;
    provenance?: Record<string, unknown>;
  }): Promise<void>;
}

export interface ProcessorResult {
  outputChecksum?: string;
}

export type Processor = (ctx: ProcessorContext) => Promise<ProcessorResult>;

interface ProcessorEntry {
  processor: Processor;
  /**
   * Whether the processor touches container CONTENT. Content-touching
   * processors are rights-gated before execution (Phase 02). Registration/
   * checksum/staging processors are permitted on UNREVIEWED containers per
   * docs/RIGHTS_MODEL.md.
   */
  touchesContent: boolean;
}

const processors: Record<string, ProcessorEntry> = {
  // Proof-of-loop processor: a container was registered. Extraction, OCR,
  // and segmentation are later phases — this is deliberately a no-op that
  // never touches content (registration is allowed while UNREVIEWED).
  "container.registered": {
    touchesContent: false,
    processor: async ({ job }) => {
      logger.info(
        { jobId: job.id, containerId: job.payload["containerId"] },
        "Research container registered",
      );
      return {};
    },
  },
};

/**
 * Register a processor (tests, later phases). Returns an unregister fn.
 * Processors touch content by default and are therefore rights-gated;
 * opting out is an explicit, reviewable act.
 */
export function registerProcessor(
  kind: string,
  processor: Processor,
  opts: { touchesContent?: boolean } = {},
) {
  processors[kind] = { processor, touchesContent: opts.touchesContent ?? true };
  return () => {
    delete processors[kind];
  };
}

/**
 * Claim and run the next queued job. Returns the claimed job (outcome is
 * applied to the row) or null when the queue is empty.
 */
export async function runNextJob(
  kind?: string,
  dbc?: DbClient,
): Promise<ResearchJob | null> {
  const job = await claimNext(kind, dbc);
  if (!job) return null;
  const entry = processors[job.kind];
  try {
    // Phase 02: processors re-check rights before touching content. The
    // check runs with the maximal role — rights-status caps are absolute, so
    // even that cannot bypass DO_NOT_PROCESS/quarantine. A denial blocks the
    // job on rights grounds and routes a review item (never guesses).
    const containerId = job.payload["containerId"];
    if (entry?.touchesContent ?? true) {
      // Fail closed: a content-touching job without a valid numeric
      // containerId can never be rights-checked, so it never runs.
      if (typeof containerId !== "number" || !Number.isInteger(containerId)) {
        throw new ProcessorFailure(
          "MISSING_CONTAINER_ID",
          `Content-touching job '${job.kind}' has no valid containerId in its payload; refusing to run without a rights check`,
          false,
        );
      }
      const { decision } = await checkContainerAccess(
        containerId,
        "owner",
        "process",
        { actor: `job:${job.id}`, dbc },
      );
      if (!decision.allowed) {
        await (dbc ?? db).insert(researchReviewItems).values({
          containerId,
          kind: "rights",
          reason: `Job ${job.id} (${job.kind}) blocked by rights: ${decision.reason}`,
        });
        throw new RightsBlockedSignal({
          containerId,
          reason: decision.reason,
        });
      }
    }
    if (!entry) {
      throw new ProcessorFailure(
        "NO_PROCESSOR",
        `No processor registered for job kind '${job.kind}'`,
        true,
      );
    }
    const result = await entry.processor({
      job,
      dbc: dbc ?? db,
      recordArtifact: async (artifact) => {
        await recordStoredArtifact(
          { ...artifact, jobId: job.id, producedByKey: job.idempotencyKey },
          dbc,
        );
      },
    });
    await complete(job.id, { outputChecksum: result.outputChecksum, dbc });
  } catch (err) {
    if (err instanceof ReviewRequiredSignal) {
      await requireReview(job.id, err.detail, { dbc });
    } else if (err instanceof RightsBlockedSignal) {
      await blockByRights(job.id, err.detail, { dbc });
    } else {
      const failure =
        err instanceof ProcessorFailure
          ? {
              code: err.code,
              message: err.message,
              retryable: err.retryable,
              detail: err.detail,
            }
          : {
              code: "UNHANDLED",
              message: err instanceof Error ? err.message : String(err),
              retryable: true,
            };
      logger.error(
        {
          jobId: job.id,
          kind: job.kind,
          code: failure.code,
          err: failure.message,
        },
        "Research job failed",
      );
      await fail(job.id, failure, { dbc });
    }
  }
  return job;
}
