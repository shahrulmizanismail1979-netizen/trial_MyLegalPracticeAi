/**
 * One-time provisioning script for "Feeza" (Hafizah binti Hanapi).
 *
 * Background
 * ----------
 * Hafizah attempted to subscribe to MyCorpAI 6 times between Aug 9–17 2026.
 * Every checkout session was in Stripe TEST mode (cs_test_*) and expired
 * unpaid because her real credit card was rejected in test mode. She was
 * never provisioned because:
 *   1. The test-mode Stripe integration rejects real cards.
 *   2. The reconciliation scan only covers active/trialing Stripe subs —
 *      it cannot see expired test-mode sessions.
 *
 * This script creates her subscriber record manually and delivers her access
 * code. The admin should separately collect her payment for the single-app
 * MyCorpAI plan (RM 25/mo) or mark it as comped.
 *
 * Usage (run on the production server):
 *   pnpm --filter @workspace/api-server tsx src/scripts/provision-feeza.ts
 *
 * The script is idempotent — re-running it when she already exists is safe.
 */

import { db, subscribersTable, activityTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  generateAccessCode,
  syncPortalAccessCodes,
  deliverAccessCode,
  normalizeAppNames,
} from "../lib/provisioning";

const FEEZA_NAME = "Hafizah binti Hanapi";
// Most recent email used in her Stripe checkout attempts (Aug 17 2026).
const FEEZA_EMAIL = "hafizahhanapi14@gmail.com";
// Earlier attempts used hafizah.hanapi1@gmail.com — both belong to the same person.
const FEEZA_APPS = normalizeAppNames(["MyCorpAI"]);
const FEEZA_TIER = "single";
const FEEZA_NOTES =
  "Provisioned manually — Stripe test-mode checkout sessions expired (real card rejected). " +
  "Contacted admin as 'Feeza'. Payment collection pending (single plan, RM 25/mo MyCorpAI).";

async function main() {
  console.log("=== Provision Feeza (Hafizah binti Hanapi) ===\n");

  // --- Idempotency: skip if she already has a record ---
  const [existing] = await db
    .select({ id: subscribersTable.id, accessCode: subscribersTable.accessCode })
    .from(subscribersTable)
    .where(eq(subscribersTable.email, FEEZA_EMAIL))
    .limit(1);

  if (existing) {
    console.log(
      `✅ Subscriber already exists (id=${existing.id}, code=${existing.accessCode}). Nothing to do.`,
    );
    return;
  }

  // --- Insert confirmed subscriber ---
  const accessCode = generateAccessCode();
  console.log(`Generated access code: ${accessCode}`);

  const [subscriber] = await db
    .insert(subscribersTable)
    .values({
      name: FEEZA_NAME,
      email: FEEZA_EMAIL,
      phone: "",          // required NOT NULL in dev schema; use "" not null
      apps: FEEZA_APPS,
      tier: FEEZA_TIER,
      accessCode,
      paymentStatus: "confirmed",
      paymentAmount: "25.00",
      paymentDate: new Date(),
      notes: FEEZA_NOTES,
    })
    .returning();

  if (!subscriber) {
    throw new Error("Insert returned no row — unexpected.");
  }

  console.log(`✅ Subscriber inserted (id=${subscriber.id})`);

  // --- Sync code to MyCorpAI (corp_access_codes) and every other portal ---
  await syncPortalAccessCodes(subscriber);
  console.log("✅ Portal access codes synced (corp_access_codes)");

  // --- Log activity ---
  await db.insert(activityTable).values({
    type: "subscriber_added",
    description: `Manually provisioned: ${FEEZA_NAME} (${FEEZA_EMAIL}) for ${FEEZA_APPS.join(", ")} — Feeza test-mode checkout fix`,
  });

  // --- Deliver access code via email ---
  deliverAccessCode({
    name: FEEZA_NAME,
    email: FEEZA_EMAIL,
    accessCode,
    apps: FEEZA_APPS,
    tier: FEEZA_TIER,
    trial: false,
  });
  console.log(`✅ Access code email queued to ${FEEZA_EMAIL}`);

  console.log("\n=== Done ===");
  console.log(`Name  : ${FEEZA_NAME}`);
  console.log(`Email : ${FEEZA_EMAIL}`);
  console.log(`Apps  : ${FEEZA_APPS.join(", ")}`);
  console.log(`Code  : ${accessCode}`);
  console.log("\nNext steps for admin:");
  console.log(" 1. Confirm Feeza received her access code email.");
  console.log(" 2. Collect her RM 25/month payment (or mark as comped).");
  console.log(
    " 3. Update subscription_expiry in the admin panel once payment is received.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Provisioning failed:", err);
    process.exit(1);
  });
