import { pool } from "@workspace/db";
import { logger } from "./logger";
import { recordAlertAttempt } from "./alertStatus";
import { getOwnerEmail, sendEmail, sendWebhookAlert } from "./mailer";
import { checkPortalAccessBatch, getPortalAccessScanUpperBound } from "./provisioning";

const STATE_KEY = "portal_access_alert_state_v1";
const ADVISORY_LOCK_ID = 1_904_604;
export const PROVISIONING_ALERT_BATCH_SIZE = 25;
export const PROVISIONING_ALERT_COOLDOWN_MS = 60 * 60 * 1_000;
const SAMPLE_LIMIT = 20;

export interface ProvisioningAlertState {
  cursor: number;
  upperBound: number;
  gapCount: number;
  gapSamples: Array<{ subscriberId: number; portal: string }>;
  unknownIntentCount: number;
  unknownIntentSamples: number[];
  incidentOpen: boolean;
  lastWarningAt: string | null;
}

const emptyState = (): ProvisioningAlertState => ({
  cursor: 0, upperBound: 0, gapCount: 0, gapSamples: [],
  unknownIntentCount: 0, unknownIntentSamples: [],
  incidentOpen: false, lastWarningAt: null,
});

export type ProvisioningAlertKind = "warning" | "recovery";

export function decideProvisioningAlert(
  state: ProvisioningAlertState,
  now: Date,
): ProvisioningAlertKind | null {
  if (state.gapCount === 0 && state.unknownIntentCount === 0) {
    return state.incidentOpen ? "recovery" : null;
  }
  if (!state.incidentOpen) return "warning";
  if (!state.lastWarningAt) return "warning";
  return now.getTime() - new Date(state.lastWarningAt).getTime() >= PROVISIONING_ALERT_COOLDOWN_MS
    ? "warning" : null;
}

/** Privacy-safe content: only internal numeric IDs, portal names and counts. */
export function provisioningAlertContent(
  kind: ProvisioningAlertKind,
  state: ProvisioningAlertState,
  detectedAt: string,
) {
  if (kind === "recovery") {
    return {
      subject: "✅ RECOVERED: Subscriber portal access checks are healthy",
      html: `<p>The automatic subscriber portal access sweep completed with no provisioning gaps.</p><p>Recovered at: ${detectedAt}</p>`,
    };
  }
  const sample = state.gapSamples
    .map((gap) => `<li>Subscriber #${gap.subscriberId}: ${gap.portal}</li>`)
    .join("");
  const unknownSample = state.unknownIntentSamples
    .map((subscriberId) => `<li>Subscriber #${subscriberId}: unknown or empty entitlement</li>`)
    .join("");
  return {
    subject: `🚨 Subscriber portal access issue detected`,
    html: `<p>A read-only automatic sweep found ${state.gapCount} portal provisioning gap${state.gapCount === 1 ? "" : "s"} and ${state.unknownIntentCount} confirmed subscriber${state.unknownIntentCount === 1 ? "" : "s"} with unknown or empty portal entitlement.</p><ul>${sample}${unknownSample}</ul><p>No access was granted or changed. Review subscriber portal access in admin.</p><p>Detected at: ${detectedAt}</p>`,
  };
}

export async function deliverPrivacySafePortalAlert(
  content: { subject: string; html: string },
  detectedAt: string,
  eventLabel: string,
): Promise<void> {
  let gmailOk = false;
  try {
    const adminEmail = await getOwnerEmail();
    if (!adminEmail) {
      recordAlertAttempt("gmail", "skipped", `${eventLabel}: admin email unavailable`);
    } else {
      gmailOk = await sendEmail({ to: adminEmail, ...content });
      recordAlertAttempt("gmail", gmailOk ? "success" : "failure", `${eventLabel} alert ${gmailOk ? "delivered" : "not delivered"}`);
    }
  } catch {
    recordAlertAttempt("gmail", "failure", `${eventLabel} alert delivery threw`);
  }
  if (!gmailOk) {
    try {
      const ok = await sendWebhookAlert({
        ...content,
        detectedAt,
        server: process.env.REPLIT_DEPLOYMENT ?? "production",
      });
      recordAlertAttempt("webhook", ok ? "success" : (process.env.ALERT_WEBHOOK_URL ? "failure" : "skipped"), `${eventLabel} webhook ${ok ? "delivered" : "not delivered"}`);
    } catch {
      recordAlertAttempt("webhook", "failure", `${eventLabel} webhook threw`);
    }
  }
}

async function deliverProvisioningAlert(kind: ProvisioningAlertKind, state: ProvisioningAlertState, now: Date) {
  const detectedAt = now.toISOString();
  const content = provisioningAlertContent(kind, state, detectedAt);
  await deliverPrivacySafePortalAlert(content, detectedAt, `Portal access ${kind}`);
}

async function loadState(): Promise<ProvisioningAlertState> {
  await pool.query(`CREATE TABLE IF NOT EXISTS server_kv (
    key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  const result = await pool.query<{ value: string }>("SELECT value FROM server_kv WHERE key = $1", [STATE_KEY]);
  if (!result.rows[0]) return emptyState();
  try {
    return { ...emptyState(), ...JSON.parse(result.rows[0].value) };
  } catch {
    logger.warn("Invalid portal access alert state; restarting bounded sweep");
    return emptyState();
  }
}

async function saveState(state: ProvisioningAlertState): Promise<void> {
  await pool.query(
    `INSERT INTO server_kv (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [STATE_KEY, JSON.stringify(state)],
  );
}

export interface ProvisioningAlertDependencies {
  withLock: (work: () => Promise<void>) => Promise<void>;
  loadState: () => Promise<ProvisioningAlertState>;
  saveState: (state: ProvisioningAlertState) => Promise<void>;
  getUpperBound: (now: Date) => Promise<number>;
  checkBatch: typeof checkPortalAccessBatch;
  sendAlert: typeof deliverProvisioningAlert;
}

/**
 * Serialize the read/update/send/save sequence across deployment replicas.
 * Session advisory locks require lock, work, and unlock to use the same
 * dedicated pool client; pool.query() would not provide that guarantee.
 */
async function withProvisioningAlertLock(work: () => Promise<void>): Promise<void> {
  const client = await pool.connect();
  let acquired = false;
  try {
    const result = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [ADVISORY_LOCK_ID],
    );
    acquired = result.rows[0]?.acquired === true;
    if (acquired) await work();
  } finally {
    if (acquired) {
      // Never attach the caught DB error to logs: connection errors may include
      // credential-bearing connection details.
      await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID]).catch(() => {
        logger.error({ event: "portalAccessAlertUnlockFailed" }, "Portal access alert lock release failed");
      });
    }
    client.release();
  }
}

const defaultDependencies: ProvisioningAlertDependencies = {
  withLock: withProvisioningAlertLock,
  loadState, saveState,
  getUpperBound: getPortalAccessScanUpperBound,
  checkBatch: checkPortalAccessBatch,
  sendAlert: deliverProvisioningAlert,
};

/** Process at most one bounded page. A complete sweep drives warning/recovery transitions. */
export async function runProvisioningAccessAlertCycle(
  now = new Date(),
  deps: ProvisioningAlertDependencies = defaultDependencies,
): Promise<void> {
  await deps.withLock(async () => {
    const state = await deps.loadState();
    if (state.upperBound === 0) {
      state.upperBound = await deps.getUpperBound(now);
      state.cursor = 0;
      state.gapCount = 0;
      state.gapSamples = [];
      state.unknownIntentCount = 0;
      state.unknownIntentSamples = [];
    }
    const batch = await deps.checkBatch({
      afterId: state.cursor,
      throughId: state.upperBound,
      limit: PROVISIONING_ALERT_BATCH_SIZE,
      now,
    });
    state.cursor = batch.lastId;
    state.gapCount += batch.gaps.length;
    state.unknownIntentCount += batch.unknownIntent;
    state.unknownIntentSamples.push(
      ...(batch.unknownSubscriberIds ?? []).slice(0, SAMPLE_LIMIT - state.unknownIntentSamples.length),
    );
    state.gapSamples.push(...batch.gaps.slice(0, SAMPLE_LIMIT - state.gapSamples.length));

    if (batch.complete) {
      const kind = decideProvisioningAlert(state, now);
      // Delivery receives an immutable snapshot; the sweep counters are reset
      // below for the next pass and must not alter an in-flight alert payload.
      if (kind) await deps.sendAlert(kind, structuredClone(state), now);
      if (kind === "warning") {
        state.incidentOpen = true;
        state.lastWarningAt = now.toISOString();
      } else if (kind === "recovery") {
        state.incidentOpen = false;
        state.lastWarningAt = null;
      }
      state.cursor = 0;
      state.upperBound = 0;
      state.gapCount = 0;
      state.gapSamples = [];
      state.unknownIntentCount = 0;
      state.unknownIntentSamples = [];
    }
    await deps.saveState(state);
  });
}

export function startProvisioningAccessAlertWorker(): void {
  if (!process.env.REPLIT_DEPLOYMENT) return;
  const schedule = () => {
    const timer = setTimeout(async () => {
      await runProvisioningAccessAlertCycle().catch(() => {
        // Deliberately omit the exception object: DB/connector errors can contain
        // query parameters or credentials and this monitor must never leak them.
        logger.error({ event: "portalAccessAlertCycleFailed" }, "Portal access alert cycle failed");
      });
      // Login incidents are intentionally maintained separately from the
      // read-only provisioning sweep: a healthy sweep can never close one.
      await import("./portalSignInSignals")
        .then(({ runPortalSignInSignalMaintenance }) => runPortalSignInSignalMaintenance())
        .catch(() => {
          logger.error({ event: "portalSignInSignalMaintenanceFailed" }, "Portal sign-in signal maintenance failed");
        });
      // Schedule only after the async cycle settles: ticks cannot overlap even
      // when a database or mail provider takes longer than the normal cadence.
      schedule();
    }, 60_000);
    timer.unref();
  };
  schedule();
}