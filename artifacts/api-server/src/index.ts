import { runMigrations } from "stripe-replit-sync";
import app from "./app";
import { logger } from "./lib/logger";
import {
  reconcileMissedProvisioning,
  backfillPortalAccessCodes,
} from "./lib/provisioning";
import { getStripeSync } from "./stripeClient";
import { seedApps } from "./acad/lib/seed";
import { seedSyaContent } from "./sya/lib/seed";
import { seedCrimContent } from "./crim/lib/seed";
import { seedLitContent } from "./lit/lib/seed";
import { ensureMatterFileTables } from "./lib/matterFiles";
import { ensureCaseIntelligenceTables } from "./lib/ensureCaseIntelligenceTables";
import { ensureUserPersonasTable } from "./lib/personas";
import { ensureAccMatterTables } from "./accident/matters";
import { ensureSeatLimitSchema } from "./lib/seatLimits";
import { ensureCaseEventsTable } from "./lib/caseEvents";
import { ensureBillingTables } from "./lib/caseBilling";
import { ensureDocumentTables } from "./lib/caseDocuments";
import { ensureDraftTables } from "./lib/caseDrafts";
import { ensureCaseClientMatterTable } from "./lib/caseClients";
import { ensureHrTables } from "./firm/routes/hr";
import { ensureAccountsTables } from "./firm/routes/accounts";

// ── Research background job worker ──────────────────────────────────────────
// All research pipeline processors (ingest → extract → segment → validate →
// editorial, metadata, search-index, analysis) share a single DB-backed job
// queue. This worker loop runs in the same process as the API server and
// continuously claims the next QUEUED job. If the queue is empty it backs off
// for 2 s to avoid hammering the DB. Any unhandled error in the loop is
// logged and retried after 5 s — the loop itself never crashes the server.
import { runNextJob } from "./research/processing/index";
import { registerIngestionProcessors } from "./research/ingestion/service";
import { registerInventoryProcessor } from "./research/ingestion/inventory";
import { registerExtractionProcessor } from "./research/extraction/pipeline";
import { registerSegmentationProcessor } from "./research/segmentation/pipeline";
import { registerValidationProcessor } from "./research/validation/pipeline";
import { registerEditorialProcessor } from "./research/isolation/editorialProcessor";
import { registerDuplicateProcessor } from "./research/metadata/duplicateProcessor";
import { registerMetadataProcessor } from "./research/metadata/metadataProcessor";
import { registerSearchIndexProcessor } from "./research/search/searchIndexProcessor";
import { registerAiAnalysisProcessor } from "./research/analysis/processor";
import { registerHeadnotesProcessor } from "./research/headnotes/processor";

function registerAllResearchProcessors(): void {
  // All register functions are idempotent — safe to call multiple times and
  // safe even if the route modules have already called them at load time.
  registerIngestionProcessors();
  registerInventoryProcessor();
  registerExtractionProcessor();
  registerSegmentationProcessor();
  registerValidationProcessor();
  registerEditorialProcessor();
  registerDuplicateProcessor();
  registerMetadataProcessor();
  registerSearchIndexProcessor();
  registerAiAnalysisProcessor();
  registerHeadnotesProcessor();
}

async function startResearchJobWorker(): Promise<void> {
  registerAllResearchProcessors();
  logger.info("Research job worker started");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const job = await runNextJob();
      if (!job) {
        // Queue empty — pause before the next poll to avoid busy-looping.
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      // Job found: loop immediately to claim the next one right away.
    } catch (err) {
      logger.error({ err }, "Research job worker loop error");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

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

// Corporate-portal matter files (corp/ccb/convey): direct SQL CREATE IF NOT
// EXISTS so production gets the tables on the next publish. Awaited before
// listen — matter routes must never race table creation. A failure here is
// fatal: better to crash and restart than serve a half-broken feature.
await ensureMatterFileTables();

// Shared AI case intelligence tables (checklists, insights cache, time entries,
// clients, stage history) — used by all 6 portals.
await ensureCaseIntelligenceTables();

// Shared professional-persona layer (persona-first front door, all portals).
await ensureUserPersonasTable();

// MyAccidentAI matter files (acc_matters / acc_matter_deadlines / acc_saved_work).
// Direct SQL CREATE IF NOT EXISTS, awaited before listen so matter routes never
// race table creation.
await ensureAccMatterTables();

// Team-bundle seat limits: shared seat registry + per-portal max_seats columns.
await ensureSeatLimitSchema();
await ensureCaseEventsTable();
await ensureBillingTables();
await ensureDocumentTables();
  await ensureDraftTables();
await ensureCaseClientMatterTable();
await ensureHrTables();
await ensureAccountsTables();

// Best-effort backfill: make every confirmed subscriber's access code work
// on all portals in their plan (idempotent upserts, no emails sent).
void backfillPortalAccessCodes().catch((err) =>
  logger.error({ err }, "Portal access-code backfill failed"),
);

// MyLawAcad: seed the apps catalog (acad_apps) once at boot. Best-effort — a
// failure here must not crash the shared api-server.
void seedApps().catch((err) =>
  logger.error({ err }, "MyLawAcad apps seed failed"),
);

// MySyariahAI: seed reference content (provisions, case laws, glossary, etc.)
// when the tables are empty — makes a fresh production DB self-populate on
// deploy instead of showing an empty dashboard. Best-effort.
void seedSyaContent().catch((err) =>
  logger.error({ err }, "MySyariahAI content seed failed"),
);

// MyCrimAI: seed reference content (topics, case laws, glossary, etc.) when
// the tables are empty — makes a fresh production DB self-populate on deploy
// instead of showing an empty dashboard. Best-effort.
void seedCrimContent().catch((err) =>
  logger.error({ err }, "MyCrimAI content seed failed"),
);

// MyLitAI / MyLitAI IRAC: seed the shared litigation library (theory, case
// law, forms, workflows, costs, glossary, practice directions, Bar Council
// rulings) when the tables are empty. Best-effort.
void seedLitContent().catch((err) =>
  logger.error({ err }, "Litigation library content seed failed"),
);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

// Start the research background job worker after the server is up.
// Best-effort: a crash in the worker loop logs + retries; it never takes
// down the HTTP server.
void startResearchJobWorker().catch((err) =>
  logger.error({ err }, "Research job worker crashed"),
);
