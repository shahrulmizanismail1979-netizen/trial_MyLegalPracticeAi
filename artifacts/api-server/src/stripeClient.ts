import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";
import { sendEmail, getOwnerEmail } from "./lib/mailer";

/** De-duplicate: only send the test-mode alert once per server process. */
let testModeAlertSent = false;

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

      // Send a one-time admin alert email (de-duplicated per server process).
      if (!testModeAlertSent) {
        testModeAlertSent = true;
        // Fire-and-forget — do not await; a send failure must not crash startup.
        (async () => {
          try {
            const adminEmail = await getOwnerEmail();
            if (!adminEmail) {
              errorLog("[Stripe] Could not resolve admin email — skipping test-mode alert.");
              return;
            }
            const detectedAt = new Date().toISOString();
            const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;border:3px solid #dc2626;border-radius:8px;">
  <h1 style="color:#dc2626;margin-top:0;">🚨 CRITICAL: Stripe is in TEST mode on production</h1>
  <p style="font-size:16px;">The production server started with a <strong>Stripe test key</strong> (<code>sk_test_…</code>).</p>
  <p style="font-size:16px;"><strong>Impact:</strong> Real customer card charges will be declined with the error:<br>
  <em>"Your request was in test mode, but used a non-test card."</em></p>
  <p style="font-size:16px;"><strong>Action required:</strong> Set the <code>STRIPE_SECRET_KEY</code> environment variable to a live key (<code>sk_live_…</code>) and restart the server immediately.</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #fca5a5;">
  <p style="color:#6b7280;font-size:13px;">Detected at: ${detectedAt}<br>Server: ${process.env.REPLIT_DEPLOYMENT ?? "production"}</p>
</div>`;
            await sendEmail({
              to: adminEmail,
              subject: "🚨 CRITICAL: Stripe is in TEST mode on production",
              html,
            });
            errorLog(`[Stripe] Test-mode alert email sent to ${adminEmail}.`);
          } catch (emailErr) {
            errorLog(`[Stripe] Failed to send test-mode alert email: ${String(emailErr)}`);
          }
        })();
      }
    } else {
      log("Stripe mode: live ✓");
    }
  } catch (err) {
    // Could not fetch credentials — Stripe init will surface the real error.
    log(`Stripe mode check skipped: ${String(err)}`);
  }
}
