/**
 * Hourly sweep worker for expired corp_pending_uploads rows.
 *
 * Exported as a standalone module so the loop logic can be unit-tested
 * independently of the full server bootstrap in index.ts.
 */
import { logger } from "../lib/logger";
import { sweepExpiredCorpUploads } from "./routes/legal/uploads";

export const CORP_UPLOAD_SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Starts an infinite loop that waits CORP_UPLOAD_SWEEP_INTERVAL_MS between
 * each call to sweepExpiredCorpUploads.  Errors from the sweep are caught and
 * logged; the loop always continues.
 */
export async function startCorpUploadSweepWorker(): Promise<void> {
  logger.info("Corp upload sweep worker started");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, CORP_UPLOAD_SWEEP_INTERVAL_MS),
    );
    try {
      await sweepExpiredCorpUploads();
    } catch (err) {
      logger.error({ err }, "Corp upload sweep failed (non-fatal)");
    }
  }
}
