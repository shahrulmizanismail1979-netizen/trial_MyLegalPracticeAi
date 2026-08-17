/**
 * Alert delivery state registry.
 *
 * In-memory state is updated on every attempt for low-latency reads within a
 * running process.  Each attempt is also persisted to the
 * `alert_delivery_attempts` DB table (best-effort, non-blocking) so that
 * /admin/alert-status can surface history across server restarts.
 *
 * Every recorded attempt also emits a structured log line with
 * `"event":"stripeAlertDelivery"` so log aggregators can filter on it.
 */

import { db, alertDeliveryAttemptsTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { logger } from "./logger";

export type AlertChannel = "gmail" | "webhook";
export type AlertOutcome = "success" | "failure" | "skipped";

export interface AlertAttempt {
  /** The notification channel used. */
  channel: AlertChannel;
  /** Whether the delivery succeeded, failed, or was skipped (e.g. not configured). */
  outcome: AlertOutcome;
  /** ISO-8601 timestamp of the attempt. */
  attemptedAt: string;
  /** Human-readable detail (error message, skip reason, etc.). */
  detail: string;
}

// Module-level store — one entry per channel, keyed by channel name.
const lastAttempts = new Map<AlertChannel, AlertAttempt>();

/**
 * Record the outcome of a Stripe alert delivery attempt.
 * Overwrites any previous record for the same channel in memory, emits a
 * structured log line, and writes a row to the DB table (non-blocking).
 */
export function recordAlertAttempt(
  channel: AlertChannel,
  outcome: AlertOutcome,
  detail: string,
): void {
  const attemptedAt = new Date().toISOString();
  const attempt: AlertAttempt = { channel, outcome, attemptedAt, detail };
  lastAttempts.set(channel, attempt);

  // Structured log line — log aggregators can filter on event:"stripeAlertDelivery".
  const logFn = outcome === "success" ? logger.info.bind(logger) : logger.error.bind(logger);
  logFn(
    { event: "stripeAlertDelivery", channel, outcome, detail, attemptedAt },
    `Stripe alert delivery [${channel}]: ${outcome} — ${detail}`,
  );

  // Best-effort DB write — do not await, never throw.
  db.insert(alertDeliveryAttemptsTable)
    .values({ channel, outcome, detail })
    .catch((err: unknown) => {
      logger.warn(
        { event: "stripeAlertDeliveryDbWriteFailed", channel, outcome, err },
        "Failed to persist alert delivery attempt to DB (non-fatal)",
      );
    });
}

/**
 * Returns the last recorded attempt for each channel, newest first.
 * Reads from the DB so history survives server restarts; falls back to the
 * in-memory map if the DB query fails.
 */
export async function getAlertStatus(): Promise<AlertAttempt[]> {
  try {
    // Return the 100 most recent attempts (full history), newest-first.
    // The idx_alert_delivery_attempts_channel_time index keeps this fast.
    const rows = await db.execute<{
      channel: string;
      outcome: string;
      detail: string;
      attempted_at: Date;
    }>(sql`
      SELECT channel, outcome, detail, attempted_at
      FROM alert_delivery_attempts
      ORDER BY attempted_at DESC
      LIMIT 100
    `);

    const dbRows: AlertAttempt[] = (rows.rows ?? []).map((r) => ({
      channel: r.channel as AlertChannel,
      outcome: r.outcome as AlertOutcome,
      detail: r.detail,
      attemptedAt: (r.attempted_at instanceof Date
        ? r.attempted_at
        : new Date(r.attempted_at)
      ).toISOString(),
    }));

    // Merge DB history with in-memory entries so that attempts recorded since
    // the last boot (which may not yet be flushed to DB) are always visible.
    // Strategy: combine both sets, deduplicate by (channel, attemptedAt),
    // sort newest-first, cap at 100.
    const memRows = Array.from(lastAttempts.values());
    const dbKeys = new Set(dbRows.map((r) => `${r.channel}|${r.attemptedAt}`));
    const extraMemRows = memRows.filter((r) => !dbKeys.has(`${r.channel}|${r.attemptedAt}`));

    return [...dbRows, ...extraMemRows]
      .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
      .slice(0, 100);
  } catch (err) {
    logger.warn(
      { event: "stripeAlertStatusDbReadFailed", err },
      "Failed to read alert status from DB; falling back to in-memory state",
    );
    // Fallback: return in-memory state so the endpoint still works.
    return Array.from(lastAttempts.values()).sort(
      (a, b) => b.attemptedAt.localeCompare(a.attemptedAt),
    );
  }
}

/**
 * @internal Only for testing — clears all recorded attempts so each test suite
 * starts from a clean slate without module re-initialisation.
 */
export function _resetAlertStatusForTesting(): void {
  lastAttempts.clear();
}
