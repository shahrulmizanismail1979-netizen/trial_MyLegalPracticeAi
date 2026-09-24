import type { RequestHandler } from "express";
import { pool } from "@workspace/db";
import { PORTAL_DESTINATIONS } from "@workspace/entitlements";
import { logger } from "./logger";
import { deliverPrivacySafePortalAlert } from "./provisioningAlerts";

const STATE_KEY = "portal_sign_in_signal_state_v1";
const LOCK_ID = 1_904_605;
export const SIGN_IN_FAILURE_WINDOW_MS = 15 * 60_000;
export const SIGN_IN_WARNING_COOLDOWN_MS = 60 * 60_000;
export const SIGN_IN_SIGNAL_MAX_KEYS = 300;
const THRESHOLD = 3;
const MAX_IN_FLIGHT = 4;

export type Portal = "lit" | "corp" | "ccb" | "crim" | "accident" | "convey" | "sya" | "acad" | "firm";
type SignalKind = "warning" | "recovery-success" | "recovery-quiet";

export interface SignInSignalRecord {
  subscriberId: number;
  portal: Portal;
  failures: string[];
  incidentOpen: boolean;
  recoveryNotified: boolean;
  lastWarningAt: string | null;
  lastSeenAt: string;
}

export interface SignInSignalState {
  records: Record<string, SignInSignalRecord>;
}

interface Endpoint {
  portal: Portal;
  field?: string;
  sso?: boolean;
  validatedIdentityField?: string;
}

const ENDPOINTS = new Map<string, Endpoint>([
  ["/api/lit/auth/login", { portal: "lit", field: "password" }],
  ["/api/lit/auth/sso", { portal: "lit", field: "code", sso: true }],
  ["/api/corp/legal/verify-password", { portal: "corp", field: "password" }],
  ["/api/corp/legal/sso", { portal: "corp", field: "code", sso: true }],
  ["/api/ccb/auth/verify", { portal: "ccb", field: "code" }],
  ["/api/ccb/auth/sso", { portal: "ccb", field: "code", sso: true }],
  ["/api/crim/auth/verify", { portal: "crim", field: "accessCode" }],
  ["/api/crim/auth/sso", { portal: "crim", field: "code", sso: true }],
  ["/api/accident/auth/verify-code", { portal: "accident", field: "code" }],
  ["/api/accident/auth/sso", { portal: "accident", field: "code", sso: true }],
  ["/api/convey/auth", { portal: "convey", field: "accessCode", validatedIdentityField: "username" }],
  ["/api/convey/auth/sso", { portal: "convey", field: "code", sso: true }],
  ["/api/sya/auth/verify", { portal: "sya", field: "accessCode" }],
  ["/api/sya/auth/sso", { portal: "sya", field: "code", sso: true }],
  ["/api/acad/auth/code-login", { portal: "acad", field: "code" }],
  ["/api/acad/auth/login", { portal: "acad", validatedIdentityField: "email" }],
  ["/api/firm/auth/staff", { portal: "firm", field: "passcode" }],
]);

const PORTALS = new Set<Portal>(["lit", "corp", "ccb", "crim", "accident", "convey", "sya", "acad", "firm"]);
const PORTAL_PATHS: Record<Exclude<Portal, "acad">, readonly string[]> = {
  lit: ["/mylitai/", "/mylitai-irac/"],
  corp: ["/mycorplegalai/"],
  ccb: ["/myccblitai/"],
  crim: ["/mycrimai/"],
  accident: ["/myaccidentai/"],
  convey: ["/myconveylitai/"],
  sya: ["/mysyariahai/"],
  firm: ["/mylawfirmai/"],
};
const PORTAL_APPS: Record<Portal, ReadonlySet<string>> = Object.fromEntries([
  ...Object.entries(PORTAL_PATHS).map(([portal, paths]) => [
    portal,
    new Set(PORTAL_DESTINATIONS.filter((entry) => paths.includes(entry.path)).flatMap((entry) => [...entry.names])),
  ]),
  ["acad", new Set(["MyLawAcad"])],
]) as Record<Portal, ReadonlySet<string>>;

function defensiveState(value: unknown): SignInSignalState {
  const records: SignInSignalState["records"] = {};
  if (!value || typeof value !== "object") return { records };
  const source = (value as { records?: unknown }).records;
  if (!source || typeof source !== "object") return { records };
  for (const raw of Object.values(source).slice(0, SIGN_IN_SIGNAL_MAX_KEYS)) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Partial<SignInSignalRecord>;
    if (!Number.isSafeInteger(row.subscriberId) || row.subscriberId! <= 0 || !PORTALS.has(row.portal as Portal)) continue;
    const key = `${row.subscriberId}:${row.portal}`;
    const canonicalTimestamp = (stamp: unknown): string | null => {
      if (typeof stamp !== "string" ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(stamp)) return null;
      const time = Date.parse(stamp);
      return Number.isFinite(time) ? new Date(time).toISOString() : null;
    };
    records[key] = {
      subscriberId: row.subscriberId!,
      portal: row.portal as Portal,
      failures: Array.isArray(row.failures)
        ? row.failures.map(canonicalTimestamp).filter((v): v is string => v !== null).slice(-THRESHOLD)
        : [],
      incidentOpen: row.incidentOpen === true,
      recoveryNotified: row.recoveryNotified === true,
      lastWarningAt: canonicalTimestamp(row.lastWarningAt),
      lastSeenAt: canonicalTimestamp(row.lastSeenAt) ?? new Date(0).toISOString(),
    };
  }
  return { records };
}

export function updateSignInSignalState(
  input: SignInSignalState,
  event: { subscriberId: number; portal: Portal; success: boolean } | null,
  now: Date,
): { state: SignInSignalState; notifications: Array<{ kind: SignalKind; subscriberId: number; portal: Portal }> } {
  const state = defensiveState(input);
  const notifications: Array<{ kind: SignalKind; subscriberId: number; portal: Portal }> = [];
  const cutoff = now.getTime() - SIGN_IN_FAILURE_WINDOW_MS;
  const validEvent = event &&
    Number.isSafeInteger(event.subscriberId) &&
    event.subscriberId > 0 &&
    PORTALS.has(event.portal) &&
    typeof event.success === "boolean"
    ? event : null;

  for (const [key, record] of Object.entries(state.records)) {
    record.failures = record.failures.filter((stamp) => {
      const time = Date.parse(stamp);
      return Number.isFinite(time) && time >= cutoff;
    });
    if (record.incidentOpen && record.failures.length === 0) {
      if (validEvent?.success &&
          validEvent.subscriberId === record.subscriberId &&
          validEvent.portal === record.portal) {
        continue;
      }
      notifications.push({ kind: "recovery-quiet", subscriberId: record.subscriberId, portal: record.portal });
      record.incidentOpen = false;
      record.recoveryNotified = true;
      record.lastSeenAt = now.toISOString();
    } else if (!record.incidentOpen && record.failures.length === 0) {
      const warnedAt = record.lastWarningAt ? Date.parse(record.lastWarningAt) : 0;
      if (!warnedAt || now.getTime() - warnedAt >= SIGN_IN_WARNING_COOLDOWN_MS) {
        delete state.records[key];
      }
    }
  }

  if (validEvent) {
    const key = `${validEvent.subscriberId}:${validEvent.portal}`;
    const record = state.records[key] ?? {
      subscriberId: validEvent.subscriberId,
      portal: validEvent.portal,
      failures: [],
      incidentOpen: false,
      recoveryNotified: false,
      lastWarningAt: null,
      lastSeenAt: now.toISOString(),
    };
    if (validEvent.success) {
      if (record.incidentOpen) {
        notifications.push({ kind: "recovery-success", subscriberId: validEvent.subscriberId, portal: validEvent.portal });
      }
      record.failures = [];
      record.incidentOpen = false;
      record.recoveryNotified = true;
      record.lastSeenAt = now.toISOString();
      const warnedAt = record.lastWarningAt ? Date.parse(record.lastWarningAt) : 0;
      if (warnedAt && now.getTime() - warnedAt < SIGN_IN_WARNING_COOLDOWN_MS) {
        state.records[key] = record;
      } else {
        delete state.records[key];
      }
    } else {
      record.failures.push(now.toISOString());
      record.failures = record.failures.slice(-THRESHOLD);
      record.lastSeenAt = now.toISOString();
      const cooldownPassed = !record.lastWarningAt ||
        now.getTime() - Date.parse(record.lastWarningAt) >= SIGN_IN_WARNING_COOLDOWN_MS;
      if (record.failures.length >= THRESHOLD && cooldownPassed) {
        notifications.push({ kind: "warning", subscriberId: validEvent.subscriberId, portal: validEvent.portal });
        record.incidentOpen = true;
        record.recoveryNotified = false;
        record.lastWarningAt = now.toISOString();
      }
      state.records[key] = record;
    }
  }

  const ordered = Object.entries(state.records)
    .sort((a, b) => Date.parse(b[1].lastSeenAt) - Date.parse(a[1].lastSeenAt))
    .slice(0, SIGN_IN_SIGNAL_MAX_KEYS);
  state.records = Object.fromEntries(ordered);
  return { state, notifications };
}

export async function resolveKnownSubscriber(
  code: string,
  portal: Portal,
  now: Date,
  query: typeof pool.query = pool.query.bind(pool),
): Promise<number | null> {
  const result = await query<{ id: number; apps: string[] }>(
    `SELECT id, apps FROM subscribers
     WHERE upper(access_code) = upper($1)
       AND payment_status = 'confirmed'
       AND (subscription_expiry IS NULL OR subscription_expiry > $2)
     LIMIT 2`,
    [code, now],
  );
  if (result.rows.length !== 1) return null;
  const row = result.rows[0];
  return Array.isArray(row.apps) && row.apps.some((app) => PORTAL_APPS[portal].has(app))
    ? row.id : null;
}

async function resolveValidatedLegacyIdentity(
  identity: string,
  portal: "convey" | "acad",
  now: Date,
): Promise<number | null> {
  // This path runs only after a 2xx response, so the portal has validated the
  // password. The join projects no email, password hash, or access code.
  const table = portal === "convey" ? "users" : "acad_users";
  const column = portal === "convey" ? "username" : "email";
  const result = await pool.query<{ id: number; apps: string[] }>(
    `SELECT s.id, s.apps
       FROM ${table} p
       JOIN subscribers s ON upper(s.access_code) = upper(p.access_code)
      WHERE lower(p.${column}) = lower($1)
        AND s.payment_status = 'confirmed'
        AND (s.subscription_expiry IS NULL OR s.subscription_expiry > $2)
      LIMIT 2`,
    [identity, now],
  );
  if (result.rows.length !== 1) return null;
  return result.rows[0].apps.some((app) => PORTAL_APPS[portal].has(app))
    ? result.rows[0].id : null;
}

async function lockedUpdate(
  event: { subscriberId: number; portal: Portal; success: boolean } | null,
  now: Date,
): Promise<Array<{ kind: SignalKind; subscriberId: number; portal: Portal }>> {
  const client = await pool.connect();
  let acquired = false;
  try {
    const lock = await client.query<{ acquired: boolean }>("SELECT pg_try_advisory_lock($1) AS acquired", [LOCK_ID]);
    acquired = lock.rows[0]?.acquired === true;
    if (!acquired) return [];
    await client.query(`CREATE TABLE IF NOT EXISTS server_kv (
      key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const stored = await client.query<{ value: string }>("SELECT value FROM server_kv WHERE key = $1", [STATE_KEY]);
    let parsed: unknown = {};
    try { parsed = stored.rows[0] ? JSON.parse(stored.rows[0].value) : {}; } catch { /* sanitized reset */ }
    const updated = updateSignInSignalState(defensiveState(parsed), event, now);
    await client.query(
      `INSERT INTO server_kv (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [STATE_KEY, JSON.stringify(updated.state)],
    );
    return updated.notifications;
  } finally {
    if (acquired) await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => undefined);
    client.release();
  }
}

function content(kind: SignalKind, subscriberId: number, portal: Portal, at: string) {
  if (kind === "warning") return {
    subject: "🚨 Repeated subscriber portal sign-in failures",
    html: `<p>Subscriber #${subscriberId} had at least ${THRESHOLD} recognized sign-in failures for ${portal} within 15 minutes.</p><p>Detected at: ${at}</p>`,
  };
  const reason = kind === "recovery-success"
    ? "A successful sign-in was subsequently observed."
    : "No further failures were observed during the 15-minute quiet window. This does not confirm that sign-in was fixed.";
  return {
    subject: "✅ Portal sign-in incident update",
    html: `<p>Subscriber #${subscriberId}, portal ${portal}: ${reason}</p><p>Updated at: ${at}</p>`,
  };
}

async function processEvent(event: { code: string; portal: Portal; success: boolean }): Promise<void> {
  const now = new Date();
  const subscriberId = await resolveKnownSubscriber(event.code, event.portal, now);
  if (subscriberId == null) return;
  const notifications = await lockedUpdate({ subscriberId, portal: event.portal, success: event.success }, now);
  for (const notice of notifications) {
    await deliverPrivacySafePortalAlert(
      content(notice.kind, notice.subscriberId, notice.portal, now.toISOString()),
      now.toISOString(),
      `Portal sign-in ${notice.kind}`,
    );
  }
}

async function processValidatedIdentity(identity: string, portal: "convey" | "acad"): Promise<void> {
  const now = new Date();
  const subscriberId = await resolveValidatedLegacyIdentity(identity, portal, now);
  if (subscriberId == null) return;
  const notifications = await lockedUpdate({ subscriberId, portal, success: true }, now);
  for (const notice of notifications) {
    await deliverPrivacySafePortalAlert(
      content(notice.kind, notice.subscriberId, notice.portal, now.toISOString()),
      now.toISOString(),
      `Portal sign-in ${notice.kind}`,
    );
  }
}

let inFlight = 0;
export function classifySignInStatus(status: number): boolean | null {
  if (status >= 200 && status < 300) return true;
  if (status === 401 || status === 403 || status === 404 || status === 409 || status >= 500) return false;
  return null;
}

export function createPortalSignInSignalObserver(options: {
  enabled: boolean;
  onCodeOutcome?: (event: { code: string; portal: Portal; success: boolean }) => Promise<void>;
  onValidatedIdentity?: (identity: string, portal: "convey" | "acad") => Promise<void>;
}): RequestHandler {
  return (req, res, next) => {
    if (!options.enabled) {
      next();
      return;
    }
    const endpoint = req.method === "POST" ? ENDPOINTS.get(req.path) : undefined;
    const value = endpoint?.field && req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>)[endpoint.field]
      : undefined;
    // Ticket-only SSO requests are deliberately invisible to this observer.
    const code = typeof value === "string" ? value.trim() : "";
    const identityValue = endpoint?.validatedIdentityField && req.body && typeof req.body === "object"
      ? (req.body as Record<string, unknown>)[endpoint.validatedIdentityField]
      : undefined;
    const identity = typeof identityValue === "string" ? identityValue.trim() : "";
    if (endpoint && (code || identity || endpoint.sso)) {
      res.once("finish", () => {
        const validatedCode = (res.locals as { portalSignInCode?: unknown }).portalSignInCode;
        delete (res.locals as { portalSignInCode?: unknown }).portalSignInCode;
        const attributedCode = code ||
          (typeof validatedCode === "string" ? validatedCode.trim() : "");
        const explicitOutcome = (res.locals as { portalSignInSucceeded?: unknown }).portalSignInSucceeded;
        const success = typeof explicitOutcome === "boolean"
          ? explicitOutcome
          : classifySignInStatus(res.statusCode);
        if (success === null || inFlight >= MAX_IN_FLIGHT) return;
        // A legacy email/username is attributable only after the portal itself
        // validated its password. Failed credentials are never inferred.
        if (!attributedCode &&
            (!success || !identity || (endpoint.portal !== "convey" && endpoint.portal !== "acad"))) return;
        inFlight++;
        const work = attributedCode
          ? (options.onCodeOutcome ?? processEvent)({
              code: attributedCode,
              portal: endpoint.portal,
              success,
            })
          : (options.onValidatedIdentity ?? processValidatedIdentity)(
              identity,
              endpoint.portal as "convey" | "acad",
            );
        void work.catch(() => {
          logger.error({ event: "portalSignInSignalFailed" }, "Portal sign-in signal processing failed");
        }).finally(() => { inFlight--; });
      });
    }
    next();
  };
}

export const portalSignInSignalObserver = createPortalSignInSignalObserver({
  enabled: !!process.env.REPLIT_DEPLOYMENT,
});

export async function runPortalSignInSignalMaintenance(now = new Date()): Promise<void> {
  const notifications = await lockedUpdate(null, now);
  for (const notice of notifications) {
    await deliverPrivacySafePortalAlert(
      content(notice.kind, notice.subscriberId, notice.portal, now.toISOString()),
      now.toISOString(),
      `Portal sign-in ${notice.kind}`,
    );
  }
}