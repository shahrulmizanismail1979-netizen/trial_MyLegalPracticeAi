import { runMigrations } from "stripe-replit-sync";
import app from "./app";
import { logger } from "./lib/logger";
import {
  reconcileMissedProvisioning,
  backfillPortalAccessCodes,
} from "./lib/provisioning";
import { getStripeSync } from "./stripeClient";

async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for the Stripe integration.");
  }

  try {
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    // Only the production deployment manages the Stripe webhook. The dev
    // workspace shares the same Stripe account, and findOrCreateManagedWebhook
    // deletes "orphaned" managed webhooks it doesn't know about — which means
    // a dev restart would silently delete the PRODUCTION webhook and break
    // subscriber provisioning for real customers. Set
    // ENABLE_DEV_STRIPE_WEBHOOK=1 to opt in during local webhook testing.
    const isProduction = !!process.env.REPLIT_DEPLOYMENT;
    if (isProduction || process.env.ENABLE_DEV_STRIPE_WEBHOOK === "1") {
      const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
      const webhookResult = await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`,
      );
      logger.info(
        { url: webhookResult?.url ?? "configured" },
        "Stripe webhook configured",
      );
    } else {
      logger.info(
        "Skipping Stripe webhook registration in development (set ENABLE_DEV_STRIPE_WEBHOOK=1 to enable)",
      );
    }

    stripeSync
      .syncBackfill({ object: "all" })
      .then(async () => {
        logger.info("Stripe data synced");
        // Production-only safety net: provision any paying/trialing customer
        // whose checkout.session.completed webhook was missed (e.g. the
        // webhook endpoint was deleted or the server was down). Never run in
        // dev — the dev DB is empty, so it would re-email every real customer.
        if (isProduction) {
          try {
            await reconcileMissedProvisioning();
          } catch (err) {
            logger.error({ err }, "Stripe provisioning reconciliation failed");
          }
        }
      })
      .catch((err) => logger.error({ err }, "Error syncing Stripe data"));
  } catch (err) {
    logger.error({ err }, "Failed to initialize Stripe");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initStripe();

// Best-effort backfill: make every confirmed subscriber's access code work
// on all portals in their plan (idempotent upserts, no emails sent).
void backfillPortalAccessCodes().catch((err) =>
  logger.error({ err }, "Portal access-code backfill failed"),
);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
