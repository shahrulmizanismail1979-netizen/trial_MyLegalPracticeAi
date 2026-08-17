import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

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
    } else {
      log("Stripe mode: live ✓");
    }
  } catch (err) {
    // Could not fetch credentials — Stripe init will surface the real error.
    log(`Stripe mode check skipped: ${String(err)}`);
  }
}
