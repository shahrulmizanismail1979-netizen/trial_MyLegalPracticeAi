/**
 * Durable Drive Ingestion Processor
 *
 * Job kind: "drive.ingest"
 * Payload:  { driveAssetId: number }
 *
 * Each job downloads one Drive asset and feeds it into the research pipeline.
 * Jobs are persisted in research_jobs so they survive server restarts and are
 * automatically retried on transient failures (up to maxAttempts).
 *
 * Call registerDriveIngestProcessor() once at startup to activate.
 */
import { registerProcessor, ProcessorFailure } from "../processing";
import { ingestDriveAsset } from "./ingestBridge";
import { logger } from "../../lib/logger";

export const DRIVE_INGEST_JOB_KIND = "drive.ingest";
export const DRIVE_INGEST_PROCESSOR_VERSION = "1";

export function registerDriveIngestProcessor(): () => void {
  return registerProcessor(
    DRIVE_INGEST_JOB_KIND,
    async ({ job }) => {
      const driveAssetId = job.payload["driveAssetId"];
      if (typeof driveAssetId !== "number" || !Number.isInteger(driveAssetId)) {
        throw new ProcessorFailure(
          "INVALID_PAYLOAD",
          `drive.ingest job ${job.id} has no valid driveAssetId in payload`,
          false, // bad payload won't improve on retry
        );
      }

      logger.info({ jobId: job.id, driveAssetId, attempt: job.attempts }, "drive.ingest: starting");

      // forceReset resets FAILED→PENDING for retry attempts so ingestDriveAsset()
      // doesn't skip on the idempotency guard (which checks processingStatus===PENDING).
      const result = await ingestDriveAsset(driveAssetId, {
        forceReset: job.attempts > 1,
      });

      if (result.errorMessage) {
        // ingestDriveAsset already wrote FAILED to the asset row.
        // Throw retryable so the job worker tries again up to maxAttempts.
        throw new ProcessorFailure("INGEST_FAILED", result.errorMessage, true);
      }

      logger.info(
        { jobId: job.id, driveAssetId, queued: result.queued, skipped: result.skipped },
        "drive.ingest: complete",
      );

      return {};
    },
    // touchesContent: false — Drive download and batch-item creation happen
    // before a research container exists, so no rights check at this stage.
    { touchesContent: false },
  );
}
