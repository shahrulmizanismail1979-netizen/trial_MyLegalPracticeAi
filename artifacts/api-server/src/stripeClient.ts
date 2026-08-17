import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";
import { sendEmail, getOwnerEmail, sendWebhookAlert } from "./lib/mailer";
import { recordAlertAttempt } from "./lib/alertStatus";

/** De-duplicate: only send the test-mode alert once per server process. */
let testModeAlertSent = false;

/** Key used to persist the last alert timestamp in the server_kv table. */
const ALERT_KV_KEY = "stripe_test_mode_alert_sent_at";

/**
 * How long to suppress repeat alerts, even across process restarts.
 * Controlled by the STRIPE_ALERT_COOLDOWN_MINUTES env var (integer, default 60).
 * Invalid values (non-numeric, negative) fall back to 60 minutes with a warning.
 * Exported so tests can override via the env var without touching source.
 */
export const ALERT_COOLDOWN_MS = (() => {
  const DEFAULT_MINUTES = 60;
  const raw = process.env.STRIPE_ALERT_COOLDOWN_MINUTES;
  if (raw !== undefined) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      console.warn(
        `[Stripe] STRIPE_ALERT_COOLDOWN_MINUTES="${raw}" is invalid (must be a non-negative integer). ` +
          `Falling back to ${DEFAULT_MINUTES}-minute default.`,
      );
    } else {
      return parsed * 60 * 1_000;
    }
  }
  return DEFAULT_MINUTES * 60 * 1_000;
})();

/**
 * Maximum time (ms) to wait for each DB operation during the alert check.
 * A DB hang must not block server startup indefinitely.
 */
const DB_TIMEOUT_MS = 3_000;

/**
 * Run a promise with a hard timeout.  When the deadline fires, `fallback` is
 * returned so the caller can fail open / closed as appropriate.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      const t = setTimeout(() => resolve(fallback), ms);
      // Don't let this timer hold the Node.js event loop open.
      if (typeof t === "object" && "unref" in t) t.unref();
    }),
  ]);
}

/**
 * Atomically claims the alert-send slot in the DB.
 *
 * Uses a single conditional upsert so concurrent server startups cannot both
 * read "no record" and both proceed to send:
 *
 *   INSERT INTO server_kv (key, value, updated_at)
 *   VALUES ($key, NOW()::text, NOW())
 *   ON CONFLICT (key) DO UPDATE
 *     SET value = NOW()::text, updated_at = NOW()
 *     WHERE server_kv.updated_at < $cutoff          -- only update if stale
 *   RETURNING key
 *
 * A row is returned **only** when this process acquired the slot:
 *   - No existing row → INSERT fires → RETURNING returns the row.
 *   - Existing row is older than the cutoff → UPDATE fires → row returned.
 *   - Existing row is within the cooldown → UPDATE WHERE is false →
 *       row is not modified → RETURNING returns nothing.
 *
 * Returns `true` when this process won the race (should send the alert).
 * Returns `false` when another process already claimed the slot recently.
 *
 * Best-effort: returns `false` (suppress) on timeout or DB errors to avoid
 * spamming on infrastructure failures, while keeping startup non-blocking.
 */
async function tryClaimAlertSlot(): Promise<boolean> {
  const cutoff = new Date(Date.now() - ALERT_COOLDOWN_MS).toISOString();

  const work = (async () => {
    const { pool } = await import("@workspace/db");

    // Ensure the table exists (idempotent, cheap after first run).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS server_kv (
        key         TEXT PRIMARY KEY,
        value       TEXT NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Atomic conditional upsert — only the process that actually writes gets
    // a row back.  Two concurrent processes racing here are safe: the DB
    // serialises the INSERT/UPDATE and only one will satisfy the WHERE clause.
    const result = await pool.query<{ key: string }>(
      `INSERT INTO server_kv (key, value, updated_at)
       VALUES ($1, NOW()::text, NOW())
       ON CONFLICT (key) DO UPDATE
         SET value      = NOW()::text,
             updated_at = NOW()
         WHERE server_kv.updated_at < $2::timestamptz
       RETURNING key`,
      [ALERT_KV_KEY, cutoff],
    );

    return result.rows.length > 0;
  })();

  try {
    // Fail closed on timeout (suppress) so a DB hang doesn't block boot.
    return await withTimeout(work, DB_TIMEOUT_MS, false);
  } catch {
    // DB error — suppress to avoid alert spam on DB outages.
    return false;
  }
}

/**
 * Fetches Stripe credentials.
 *
 * Priority:
 *  1. STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET environment variables (live keys).
 *  2. Replit connector API (fallback for local dev when env vars are absent).
 *
 * Not cached — fetch fresh every call so rotated keys are picked up immediately.
 */
async function getStripeCredentials(): Promise<{
  secretKey: string;
  webhookSecret?: string;
}> {
  // Prefer explicitly-set env vars so live keys are always used in production
  // regardless of what the Replit connector is configured with.
  // Only use the env var if it looks like a real Stripe key (sk_live_ or sk_test_).
  const envSecret = process.env.STRIPE_SECRET_KEY;
  if (envSecret) {
    if (envSecret.startsWith("sk_live_") || envSecret.startsWith("sk_test_")) {
      const mode = envSecret.startsWith("sk_live_") ? "LIVE" : "TEST";
      console.log(`[Stripe] Using STRIPE_SECRET_KEY env var (${mode} mode, length=${envSecret.length})`);
      return {
        secretKey: envSecret,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      };
    } else {
      console.warn(
        `[Stripe] STRIPE_SECRET_KEY is set but does not start with sk_live_ or sk_test_ ` +
        `(got prefix: "${envSecret.slice(0, 8)}...", length=${envSecret.length}). ` +
        `Falling back to Replit connector. ` +
        `Please set STRIPE_SECRET_KEY to your Stripe Secret key (starts with sk_live_ or sk_test_).`
      );
    }
  } else {
    console.log("[Stripe] STRIPE_SECRET_KEY not set — using Replit connector.");
  }

  // Fallback: fetch from the Replit connector (useful in local dev).
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Missing Replit environment variables. " +
        "Ensure the Stripe integration is connected via the Integrations tab.",
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!resp.ok) {
    throw new Error(
      `Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`,
    );
  }

  const data = (await resp.json()) as {
    items?: Array<{
      settings?: {
        secret?: string;
        secret_key?: string;
        webhook_secret?: string;
      };
    }>;
  };
  const settings = data.items?.[0]?.settings;
  const secretKey = settings?.secret ?? settings?.secret_key;

  if (!secretKey) {
    throw new Error(
      "Stripe integration not connected or missing secret key. " +
        "Connect Stripe via the Integrations tab first.",
    );
  }

  // Log key mode so we can see connector key prefix in startup logs
  const connectorPrefix = secretKey.slice(0, 12);
  console.log(`[Stripe] Using connector key (prefix: ${connectorPrefix}..., length=${secretKey.length})`);

  return {
    secretKey,
    webhookSecret: settings?.webhook_secret,
  };
}

/**
 * Returns a fresh authenticated Stripe client.
 * Not cached -- fetches credentials on every call so rotated keys are picked up.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}

/**
 * Returns the Stripe mode inferred from the current secret key prefix.
 * "test"  → key starts with sk_test_  (or rk_test_)
 * "live"  → key starts with sk_live_  (or rk_live_)
 * Does NOT cache the result so rotated keys are reflected immediately.
 */
export async function getStripeMode(): Promise<"live" | "test"> {
  const { secretKey } = await getStripeCredentials();
  return secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_")
    ? "live"
    : "test";
}

/**
 * Returns a fresh StripeSync instance for webhook processing and data sync.
 * Not cached -- fetches credentials on every call so rotated keys are picked up.
 */
export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const { secretKey, webhookSecret } = await getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret ?? "",
  });
}

/**
 * Checks the Stripe mode at server startup and emits a loud ERROR log when the
 * server is running in production (REPLIT_DEPLOYMENT is set) but the Stripe key
 * is a test key.  Silently does nothing in development — test mode is expected
 * there.
 *
 * Call this once during the boot sequence, after Stripe credentials are
 * available.  The check is best-effort: a failure to fetch credentials is
 * logged as a warning but does NOT crash the server.
 *
 * Alert de-duplication
 * --------------------
 * An in-memory flag (`testModeAlertSent`) suppresses duplicate sends within
 * the same process lifetime (fast path — no DB round-trip after the first check).
 *
 * For cross-restart dedup, a single atomic conditional upsert into the
 * `server_kv` table claims the alert slot.  The upsert returns a row only to
 * the process that actually writes (INSERT or UPDATE); concurrent restarts that
 * race on the same slot get no row back and stay silent.  The operation is
 * bounded by DB_TIMEOUT_MS so a DB hang cannot block startup.
 */
export async function warnIfTestModeInProduction(
  log: (msg: string) => void,
  errorLog: (msg: string) => void,
): Promise<void> {
  const isProduction = !!process.env.REPLIT_DEPLOYMENT;
  if (!isProduction) return; // test mode is fine in dev

  try {
    const mode = await getStripeMode();
    if (mode === "test") {
      const banner = [
        "════════════════════════════════════════════════════════════════",
        "  ██████  STRIPE IS IN TEST MODE ON A PRODUCTION SERVER  ██████",
        "  Real client cards will be DECLINED with:                     ",
        '  "Your request was in test mode, but used a non-test card."   ',
        "  Switch to a live Stripe key (sk_live_...) immediately.       ",
        "════════════════════════════════════════════════════════════════",
      ].join("\n");
      errorLog(banner);

      if (!testModeAlertSent) {
        // Atomic claim — only the process that wins the upsert race proceeds
        // to send.  Sets testModeAlertSent regardless to short-circuit future
        // same-process calls without hitting the DB again.
        const claimed = await tryClaimAlertSlot();
        testModeAlertSent = true;

        if (claimed) {
          // Fire-and-forget — do not await; send failures must not crash startup.
          (async () => {
            const subject = "🚨 CRITICAL: Stripe is in TEST mode on production";
            const detectedAt = new Date().toISOString();
            const server = process.env.REPLIT_DEPLOYMENT ?? "production";
            const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;border:3px solid #dc2626;border-radius:8px;">
  <h1 style="color:#dc2626;margin-top:0;">🚨 CRITICAL: Stripe is in TEST mode on production</h1>
  <p style="font-size:16px;">The production server started with a <strong>Stripe test key</strong> (<code>sk_test_…</code>).</p>
  <p style="font-size:16px;"><strong>Impact:</strong> Real customer card charges will be declined with the error:<br>
  <em>"Your request was in test mode, but used a non-test card."</em></p>
  <p style="font-size:16px;"><strong>Action required:</strong> Set the <code>STRIPE_SECRET_KEY</code> environment variable to a live key (<code>sk_live_…</code>) and restart the server immediately.</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #fca5a5;">
  <p style="color:#6b7280;font-size:13px;">Detected at: ${detectedAt}<br>Server: ${server}</p>
</div>`;

            // --- Primary channel: Gmail connector ---
            let gmailOk = false;
            try {
              const adminEmail = await getOwnerEmail();
              if (!adminEmail) {
                errorLog("[Stripe] Could not resolve admin email — skipping Gmail alert.");
                recordAlertAttempt("gmail", "skipped", "Could not resolve admin email from Gmail profile");
              } else {
                errorLog(`[Stripe] Attempting to send test-mode alert email to ${adminEmail}...`);
                gmailOk = await sendEmail({ to: adminEmail, subject, html });
                if (gmailOk) {
                  errorLog(`[Stripe] Test-mode alert email sent via Gmail to ${adminEmail}.`);
                  recordAlertAttempt("gmail", "success", `Alert email delivered to ${adminEmail}`);
                } else {
                  errorLog(`[Stripe] Gmail send returned false (connector error or 5xx).`);
                  recordAlertAttempt("gmail", "failure", "sendEmail returned false (connector error or 5xx)");
                }
              }
            } catch (emailErr) {
              errorLog(`[Stripe] Gmail send threw an error: ${String(emailErr)}`);
              recordAlertAttempt("gmail", "failure", `sendEmail threw: ${String(emailErr)}`);
            }

            // --- Fallback channel: configurable webhook (ALERT_WEBHOOK_URL) ---
            if (!gmailOk) {
              errorLog("[Stripe] Gmail alert failed — attempting webhook fallback...");
              try {
                const webhookOk = await sendWebhookAlert({ subject, html, detectedAt, server });
                if (webhookOk) {
                  errorLog("[Stripe] Test-mode alert delivered via webhook fallback.");
                  recordAlertAttempt("webhook", "success", "Alert delivered via ALERT_WEBHOOK_URL");
                } else {
                  errorLog(
                    "[Stripe] Webhook fallback also failed (or ALERT_WEBHOOK_URL not set). " +
                    "Alert was NOT delivered. Check ALERT_WEBHOOK_URL env var.",
                  );
                  recordAlertAttempt(
                    "webhook",
                    process.env.ALERT_WEBHOOK_URL ? "failure" : "skipped",
                    process.env.ALERT_WEBHOOK_URL
                      ? "sendWebhookAlert returned false (non-2xx or timeout)"
                      : "ALERT_WEBHOOK_URL not configured",
                  );
                }
              } catch (webhookErr) {
                errorLog(`[Stripe] Webhook fallback threw an error: ${String(webhookErr)}`);
                recordAlertAttempt("webhook", "failure", `sendWebhookAlert threw: ${String(webhookErr)}`);
              }
            }
          })();
        }
        // else: another process already claimed the slot within the cooldown window.
      }
    } else {
      log("Stripe mode: live ✓");
    }
  } catch (err) {
    // Could not fetch credentials — Stripe init will surface the real error.
    log(`Stripe mode check skipped: ${String(err)}`);
  }
}
