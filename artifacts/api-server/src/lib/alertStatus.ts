/**
 * In-memory registry of the last Stripe alert delivery attempt per channel.
 *
 * This module is intentionally lightweight — it holds the most recent outcome
 * for each channel so the `/admin/alert-status` endpoint can surface health
 * without database I/O.  A server restart resets the state (i.e. it shows no
 * previous attempts), which is fine: the endpoint is an ops convenience, not
 * a source of truth for historical data.
 *
 * Every recorded attempt also emits a structured log line with
 * `"event":"stripeAlertDelivery"` so log aggregators can filter on it.
 */

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
 * Overwrites any previous record for the same channel and emits a structured
 * log line that log aggregators can filter on with `event = "stripeAlertDelivery"`.
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
}

/**
 * Returns the last recorded attempt for each channel, newest first.
 * Channels with no recorded attempt are omitted.
 */
export function getAlertStatus(): AlertAttempt[] {
  return Array.from(lastAttempts.values()).sort(
    (a, b) => b.attemptedAt.localeCompare(a.attemptedAt),
  );
}
