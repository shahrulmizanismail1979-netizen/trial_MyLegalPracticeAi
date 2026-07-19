// Automatic subscriber provisioning after Stripe checkout.
// Generates an access code, records the subscriber, and emails the
// access code to the customer plus a notification to the site owner (Gmail integration).
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import {
  db,
  subscribersTable,
  activityTable,
  usersTable,
  accessCodesTable,
  crimAccessCodesTable,
  corpAccessCodes as corpAccessCodesTable,
  litAccessCodes as litAccessCodesTable,
  ccbAccessCodes as ccbAccessCodesTable,
} from "@workspace/db";
import { accessCodesTable as syaAccessCodesTable } from "@workspace/db/sya";
import { firmAccessCodesTable } from "@workspace/db/firm";
import { getUncachableStripeClient } from "../stripeClient";
import { sendEmail, getOwnerEmail } from "./mailer";
import { sendSms, accessCodeSmsBody } from "./sms";
import { logger } from "./logger";

export const APP_NAME_BY_URL: Record<string, string> = {
  "https://mylitai.life": "MyLitAI",
  "https://mylitai.life/irac/": "MyLitAI (Versi 2)",
  "https://mysyalitai.life": "MySyalitAI",
  "https://mycorpai.life": "MyCorpAI",
  // The hosted MyCorpLegalAI app (rebranded MyCorpAI) — keeps the canonical
  // "MyCorpAI" app name so admin stats/filters stay on one bucket.
  "/mycorplegalai/": "MyCorpAI",
  "https://myconveyai.life": "MyConveyAI",
  // The hosted MyConveyLitAI app (rebranded MyConveyAI) — keeps the canonical
  // "MyConveyAI" app name so admin stats/filters stay on one bucket.
  "/myconveylitai/": "MyConveyAI",
  "https://mycrimai.life/": "MyCrimAI",
  // The hosted MyCrimAI app — same canonical "MyCrimAI" bucket.
  "/mycrimai/": "MyCrimAI",
  "https://myccblitai.life/": "MyCCBLitAI",
  "https://myaccidentai.life/": "MyAccidentAI",
  // The hosted MyAccidentAI app — keeps the canonical "MyAccidentAI" app
  // name so admin stats/filters stay on one bucket.
  "/myaccidentai/": "MyAccidentAI",
  // The hosted MyLawFirmAi firm-management portal.
  "/mylawfirmai/": "MyLawFirmAi",
};

export const ALL_APP_NAMES = [
  "MyLitAI",
  "MySyalitAI",
  "MyCorpAI",
  "MyConveyAI",
  "MyCrimAI",
  "MyCCBLitAI",
  "MyAccidentAI",
  "MyLawFirmAi",
];

// Unambiguous alphabet (no 0/O, 1/I/L) for human-friendly codes.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateAccessCode(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
    if (i === 4) out += "-";
  }
  return `MLPA-${out}`;
}

export interface ProvisionResult {
  accessCode: string | null;
  apps: string[];
  tier: string | null;
  trial: boolean;
  email: string | null;
  name: string | null;
  alreadyExisted: boolean;
}

// Older UI surfaces used slightly different app spellings. Normalize to the
// canonical names before persisting so DB data stays consistent.
const APP_NAME_ALIASES: Record<string, string> = {
  MyConveyAI: "MyConveyLitAI",
  MyCorpCommBankLitAi: "MyCCBLitAI",
  MyAccidentAi: "MyAccidentAI",
};

export function normalizeAppNames(apps: string[]): string[] {
  return [...new Set(apps.map((a) => APP_NAME_ALIASES[a] ?? a))];
}

// Landing purchases for the conveyancing product also unlock the hosted
// MyConveyLitAI app (one synced access-code system).
const CONVEY_APP_NAMES = new Set(["MyConveyAI", "MyConveyLitAI"]);

function includesConveyApp(apps: string[]): boolean {
  return apps.some((a) => CONVEY_APP_NAMES.has(a));
}

/**
 * Upsert a MyConveyLitAI user so the landing-page access code also logs in
 * to the hosted app. Idempotent via the unique access_code constraint.
 * Best-effort: never fails provisioning. Stripe IDs are intentionally NOT
 * copied — landing billing stays owned by the subscribers table, so the
 * convey app's own Stripe reconciliation ignores these users.
 */
async function syncConveyUser(params: {
  accessCode: string;
  name: string;
  email: string | null;
}): Promise<void> {
  try {
    await db
      .insert(usersTable)
      .values({
        accessCode: params.accessCode,
        displayName: params.name,
        email: params.email,
        role: "user",
        isActive: true,
        subscriptionTier: "firm",
        subscriptionStatus: "active",
      })
      .onConflictDoUpdate({
        target: usersTable.accessCode,
        set: {
          isActive: true,
          subscriptionTier: "firm",
          subscriptionStatus: "active",
        },
      });
    logger.info(
      { accessCode: params.accessCode },
      "Synced MyConveyLitAI user for landing purchase",
    );
  } catch (err) {
    logger.error({ err }, "Failed to sync MyConveyLitAI user for landing purchase");
  }
}

// Landing purchases for the accident/PI product also unlock the hosted
// MyAccidentAI app (one synced access-code system).
// Both spellings appear in admin UI history ("MyAccidentAi") and canonical
// data ("MyAccidentAI") — accept either so sync never silently skips.
const ACCIDENT_APP_NAMES = new Set(["MyAccidentAI", "MyAccidentAi"]);

function includesAccidentApp(apps: string[]): boolean {
  return apps.some((a) => ACCIDENT_APP_NAMES.has(a));
}

/**
 * Upsert a MyAccidentAI access code so the landing-page access code also
 * logs in to the hosted app. Idempotent via the unique code constraint.
 * Best-effort: never fails provisioning.
 */
async function syncAccidentAccessCode(params: {
  accessCode: string;
  name: string;
  expiresAt?: Date | null;
}): Promise<void> {
  try {
    await db
      .insert(accessCodesTable)
      .values({
        code: params.accessCode,
        label: params.name,
        maxUsers: 2,
        isActive: true,
        expiresAt: params.expiresAt ?? null,
      })
      .onConflictDoUpdate({
        target: accessCodesTable.code,
        set: { isActive: true, expiresAt: params.expiresAt ?? null },
      });
    logger.info(
      { accessCode: params.accessCode },
      "Synced MyAccidentAI access code for landing purchase",
    );
  } catch (err) {
    logger.error({ err }, "Failed to sync MyAccidentAI access code for landing purchase");
  }
}

// Landing purchases for the criminal-law product also unlock the hosted
// MyCrimAI app (one synced access-code system).
function includesCrimApp(apps: string[]): boolean {
  return apps.includes("MyCrimAI");
}

/**
 * Upsert a MyCrimAI access code so the landing-page access code also logs
 * in to the hosted app. Tier "full" = unrestricted (landing sells one plan).
 * Idempotent via the unique code constraint. Best-effort: never fails
 * provisioning. Stripe IDs intentionally NOT copied — landing billing stays
 * owned by the subscribers table.
 */
async function syncCrimAccessCode(params: {
  accessCode: string;
  name: string;
  expiresAt?: Date | null;
}): Promise<void> {
  try {
    await db
      .insert(crimAccessCodesTable)
      .values({
        code: params.accessCode,
        label: params.name,
        tier: "full",
        isActive: true,
        expiresAt: params.expiresAt ?? null,
      })
      .onConflictDoUpdate({
        target: crimAccessCodesTable.code,
        set: { isActive: true, tier: "full", expiresAt: params.expiresAt ?? null },
      });
    logger.info(
      { accessCode: params.accessCode },
      "Synced MyCrimAI access code for landing purchase",
    );
  } catch (err) {
    logger.error({ err }, "Failed to sync MyCrimAI access code for landing purchase");
  }
}

// Landing purchases for the corporate product also unlock the hosted
// MyCorpLegalAI app (one synced access-code system).
function includesCorpApp(apps: string[]): boolean {
  return apps.includes("MyCorpAI");
}

/**
 * Upsert a MyCorpLegalAI access code so the landing-page access code also
 * logs in to the hosted app. Tier "firm" = highest purchasable tier (landing
 * sells one plan). Idempotent via the unique code constraint. Best-effort:
 * never fails provisioning. Stripe IDs intentionally NOT copied — landing
 * billing stays owned by the subscribers table.
 */
async function syncCorpAccessCode(params: {
  accessCode: string;
  name: string;
  expiresAt?: Date | null;
}): Promise<void> {
  try {
    await db
      .insert(corpAccessCodesTable)
      .values({
        code: params.accessCode,
        label: params.name,
        tier: "firm",
        isActive: true,
        expiresAt: params.expiresAt ?? null,
      })
      .onConflictDoUpdate({
        target: corpAccessCodesTable.code,
        set: { isActive: true, tier: "firm", expiresAt: params.expiresAt ?? null },
      });
    logger.info(
      { accessCode: params.accessCode },
      "Synced MyCorpLegalAI access code for landing purchase",
    );
  } catch (err) {
    logger.error({ err }, "Failed to sync MyCorpLegalAI access code for landing purchase");
  }
}

// Landing purchases for the litigation product also unlock the hosted
// MyLitAI apps (Version 1 + Version 2 share lit_access_codes).
// Both MyLitAI names may appear in a subscriber's app list ("MyLitAI" and
// "MyLitAI (Versi 2)") — both share the same lit_access_codes table.
const LIT_APP_NAMES = new Set(["MyLitAI", "MyLitAI (Versi 2)"]);

function includesLitApp(apps: string[]): boolean {
  return apps.some((a) => LIT_APP_NAMES.has(a));
}

/**
 * Upsert a MyLitAI access code (shared by Version 1 and Version 2 / IRAC).
 * Idempotent via the unique code constraint. Best-effort: never fails
 * provisioning.
 */
async function syncLitAccessCode(params: {
  accessCode: string;
  name: string;
  email: string | null;
  expiresAt?: Date | null;
}): Promise<void> {
  try {
    await db
      .insert(litAccessCodesTable)
      .values({
        code: params.accessCode,
        recipientName: params.name,
        recipientEmail: params.email ?? "",
        status: "active",
        expiresAt: params.expiresAt ?? null,
      })
      .onConflictDoUpdate({
        target: litAccessCodesTable.code,
        set: { status: "active", expiresAt: params.expiresAt ?? null },
      });
    logger.info(
      { accessCode: params.accessCode },
      "Synced MyLitAI access code for landing purchase",
    );
  } catch (err) {
    logger.error({ err }, "Failed to sync MyLitAI access code for landing purchase");
  }
}

// Landing purchases for the syariah product also unlock the hosted
// MySyalitAI app.
function includesSyaApp(apps: string[]): boolean {
  return apps.includes("MySyalitAI");
}

/**
 * Upsert a MySyalitAI access code. Idempotent via the unique code
 * constraint. Best-effort: never fails provisioning.
 */
async function syncSyaAccessCode(params: {
  accessCode: string;
  name: string;
  expiresAt?: Date | null;
}): Promise<void> {
  try {
    await db
      .insert(syaAccessCodesTable)
      .values({
        code: params.accessCode,
        name: params.name,
        role: "practitioner",
        isActive: true,
        expiresAt: params.expiresAt ?? null,
      })
      .onConflictDoUpdate({
        target: syaAccessCodesTable.code,
        set: { isActive: true, expiresAt: params.expiresAt ?? null },
      });
    logger.info(
      { accessCode: params.accessCode },
      "Synced MySyalitAI access code for landing purchase",
    );
  } catch (err) {
    logger.error({ err }, "Failed to sync MySyalitAI access code for landing purchase");
  }
}

// Landing purchases for the construction-law product also unlock the hosted
// MyCCBLitAI app.
// Accept the legacy admin-UI spelling ("MyCorpCommBankLitAi") alongside the
// canonical name so sync never silently skips.
const CCB_APP_NAMES = new Set(["MyCCBLitAI", "MyCorpCommBankLitAi"]);

function includesCcbApp(apps: string[]): boolean {
  return apps.some((a) => CCB_APP_NAMES.has(a));
}

/**
 * Upsert a MyCCBLitAI access code. Idempotent via the unique code
 * constraint. Best-effort: never fails provisioning.
 */
async function syncCcbAccessCode(params: {
  accessCode: string;
  name: string;
  expiresAt?: Date | null;
}): Promise<void> {
  try {
    await db
      .insert(ccbAccessCodesTable)
      .values({
        code: params.accessCode,
        label: params.name,
        active: true,
        expiresAt: params.expiresAt ?? null,
      })
      .onConflictDoUpdate({
        target: ccbAccessCodesTable.code,
        set: { active: true, expiresAt: params.expiresAt ?? null },
      });
    logger.info(
      { accessCode: params.accessCode },
      "Synced MyCCBLitAI access code for landing purchase",
    );
  } catch (err) {
    logger.error({ err }, "Failed to sync MyCCBLitAI access code for landing purchase");
  }
}

// Landing purchases of the firm-management product unlock the MyLawFirmAi
// portal. Accept a few plausible spellings so sync never silently skips.
const FIRM_APP_NAMES = new Set(["MyLawFirmAi", "MyLawFirmAI"]);

function includesFirmApp(apps: string[]): boolean {
  return apps.some((a) => FIRM_APP_NAMES.has(a));
}

/**
 * Upsert a MyLawFirmAi access code. Idempotent via the unique code
 * constraint. Best-effort: never fails provisioning.
 */
async function syncFirmAccessCode(params: {
  accessCode: string;
  name: string;
  email: string | null;
  expiresAt?: Date | null;
}): Promise<void> {
  try {
    await db
      .insert(firmAccessCodesTable)
      .values({
        code: params.accessCode,
        label: params.name,
        customerEmail: params.email,
        isActive: true,
        expiresAt: params.expiresAt ?? null,
      })
      .onConflictDoUpdate({
        target: firmAccessCodesTable.code,
        set: { isActive: true, expiresAt: params.expiresAt ?? null },
      });
    logger.info(
      { accessCode: params.accessCode },
      "Synced MyLawFirmAi access code for landing purchase",
    );
  } catch (err) {
    logger.error({ err }, "Failed to sync MyLawFirmAi access code for landing purchase");
  }
}

/**
 * Sync a subscriber's access code into every portal-specific access-code
 * table covered by their plan, so the code works on all their apps.
 * Idempotent and best-effort — safe to call repeatedly.
 */
export async function syncPortalAccessCodes(subscriber: {
  accessCode: string | null;
  name: string;
  email: string | null;
  apps: string[];
  subscriptionExpiry?: Date | null;
}): Promise<void> {
  const { accessCode, name, email, apps } = subscriber;
  if (!accessCode) return;
  // Propagate the subscriber's expiry date into every portal table that
  // supports one, so the code stops working when the subscription ends.
  const expiresAt = subscriber.subscriptionExpiry ?? null;
  if (includesConveyApp(apps)) await syncConveyUser({ accessCode, name, email });
  if (includesAccidentApp(apps)) await syncAccidentAccessCode({ accessCode, name, expiresAt });
  if (includesCrimApp(apps)) await syncCrimAccessCode({ accessCode, name, expiresAt });
  if (includesCorpApp(apps)) await syncCorpAccessCode({ accessCode, name, expiresAt });
  if (includesLitApp(apps)) await syncLitAccessCode({ accessCode, name, email, expiresAt });
  if (includesSyaApp(apps)) await syncSyaAccessCode({ accessCode, name, expiresAt });
  if (includesCcbApp(apps)) await syncCcbAccessCode({ accessCode, name, expiresAt });
  if (includesFirmApp(apps)) await syncFirmAccessCode({ accessCode, name, email, expiresAt });
}

/**
 * Deactivate a subscriber's access code on every portal covered by their
 * plan — used when their Stripe subscription is cancelled (e.g. a trial
 * user cancels, or payment ultimately fails). Best-effort per portal.
 */
export async function deactivatePortalAccessCodes(subscriber: {
  accessCode: string | null;
  apps: string[];
}): Promise<void> {
  const { accessCode, apps } = subscriber;
  if (!accessCode) return;
  const attempts: Array<[string, () => Promise<unknown>]> = [];
  if (includesConveyApp(apps)) {
    attempts.push([
      "MyConveyLitAI",
      () =>
        db
          .update(usersTable)
          .set({ isActive: false, subscriptionStatus: "canceled" })
          .where(eq(usersTable.accessCode, accessCode)),
    ]);
  }
  if (includesAccidentApp(apps)) {
    attempts.push([
      "MyAccidentAI",
      () =>
        db
          .update(accessCodesTable)
          .set({ isActive: false })
          .where(eq(accessCodesTable.code, accessCode)),
    ]);
  }
  if (includesCrimApp(apps)) {
    attempts.push([
      "MyCrimAI",
      () =>
        db
          .update(crimAccessCodesTable)
          .set({ isActive: false })
          .where(eq(crimAccessCodesTable.code, accessCode)),
    ]);
  }
  if (includesCorpApp(apps)) {
    attempts.push([
      "MyCorpLegalAI",
      () =>
        db
          .update(corpAccessCodesTable)
          .set({ isActive: false })
          .where(eq(corpAccessCodesTable.code, accessCode)),
    ]);
  }
  if (includesLitApp(apps)) {
    attempts.push([
      "MyLitAI",
      () =>
        db
          .update(litAccessCodesTable)
          .set({ status: "inactive" })
          .where(eq(litAccessCodesTable.code, accessCode)),
    ]);
  }
  if (includesSyaApp(apps)) {
    attempts.push([
      "MySyalitAI",
      () =>
        db
          .update(syaAccessCodesTable)
          .set({ isActive: false })
          .where(eq(syaAccessCodesTable.code, accessCode)),
    ]);
  }
  if (includesCcbApp(apps)) {
    attempts.push([
      "MyCCBLitAI",
      () =>
        db
          .update(ccbAccessCodesTable)
          .set({ active: false })
          .where(eq(ccbAccessCodesTable.code, accessCode)),
    ]);
  }
  if (includesFirmApp(apps)) {
    attempts.push([
      "MyLawFirmAi",
      () =>
        db
          .update(firmAccessCodesTable)
          .set({ isActive: false })
          .where(eq(firmAccessCodesTable.code, accessCode)),
    ]);
  }
  for (const [app, run] of attempts) {
    try {
      await run();
      logger.info({ accessCode, app }, "Deactivated portal access code after cancellation");
    } catch (err) {
      logger.error({ err, accessCode, app }, "Failed to deactivate portal access code");
    }
  }
}

/**
 * Handle a cancelled Stripe subscription: mark the landing subscriber as
 * cancelled and switch off their access code on every portal in the plan.
 */
export async function handleSubscriptionCancelled(subscriptionId: string): Promise<void> {
  const [subscriber] = await db
    .select()
    .from(subscribersTable)
    .where(eq(subscribersTable.stripeSubscriptionId, subscriptionId));
  if (!subscriber) {
    logger.warn({ subscriptionId }, "Cancelled subscription has no matching subscriber");
    return;
  }
  const alreadyCancelled = subscriber.paymentStatus === "cancelled";
  // Deactivate portal codes FIRST and on every delivery (idempotent updates),
  // so a transient failure on one portal is retried on the next webhook retry
  // even if the subscriber row was already marked cancelled.
  await deactivatePortalAccessCodes(subscriber);
  if (alreadyCancelled) return;
  await db
    .update(subscribersTable)
    .set({ paymentStatus: "cancelled" })
    .where(eq(subscribersTable.id, subscriber.id));
  try {
    await db.insert(activityTable).values({
      type: "subscription_cancelled",
      description: `Subscription cancelled for ${subscriber.name} — portal access deactivated`,
    });
  } catch (err) {
    logger.error({ err }, "Failed to log cancellation activity");
  }
  logger.info(
    { subscriptionId, subscriberId: subscriber.id },
    "Subscriber cancelled and portal access deactivated",
  );
}

/**
 * Backfill: sync every confirmed subscriber's access code into the portal
 * tables. Run at startup so codes created before this sync existed (or
 * added manually via the admin page) work on all portals. Idempotent.
 */
export async function backfillPortalAccessCodes(): Promise<number> {
  const confirmed = await db
    .select()
    .from(subscribersTable)
    .where(eq(subscribersTable.paymentStatus, "confirmed"));
  let synced = 0;
  for (const sub of confirmed) {
    if (!sub.accessCode) continue;
    await syncPortalAccessCodes(sub);
    synced++;
  }
  logger.info({ synced }, "Portal access-code backfill finished");
  return synced;
}

function appsForCheckout(tier: string | null, appUrl: string | null): string[] {
  if (tier === "bundle") return [...ALL_APP_NAMES];
  if (appUrl && APP_NAME_BY_URL[appUrl]) return [APP_NAME_BY_URL[appUrl]!];
  return [];
}

function customerEmailHtml(params: {
  name: string;
  accessCode: string;
  apps: string[];
  trial: boolean;
}): string {
  const { name, accessCode, apps, trial } = params;
  const appsText =
    apps.length > 0
      ? apps.join(", ")
      : "the AI portal of your choice (reply to this email to tell us which portal you picked)";
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <h2 style="color:#8a6d1a">Welcome to MyLegalPracticeAI</h2>
    <p>Dear ${name},</p>
    <p>Thank you for subscribing${trial ? " to the 7-day free trial" : ""}. Here is your access code:</p>
    <div style="background:#f7f3e8;border:2px solid #d4af37;border-radius:8px;padding:16px;text-align:center;margin:20px 0">
      <span style="font-size:24px;font-weight:bold;letter-spacing:2px;font-family:monospace">${accessCode}</span>
    </div>
    <p><b>Your subscription covers:</b> ${appsText}</p>
    ${
      trial
        ? "<p>Your free trial lasts 7 days. After that, your card will be billed US$25/month automatically unless you cancel.</p>"
        : ""
    }
    <p>Keep this code safe — you will use it to log in to your portal. If your portal has not yet activated your code, it will be activated shortly (usually within a few hours).</p>
    <p>Questions? Just reply to this email.</p>
    <p style="color:#777;font-size:13px;margin-top:28px">MyLegalPracticeAI · https://mylegalpracticeai.life</p>
  </div>`;
}

function ownerEmailHtml(params: {
  name: string;
  email: string;
  accessCode: string;
  apps: string[];
  tier: string | null;
  trial: boolean;
}): string {
  const { name, email, accessCode, apps, tier, trial } = params;
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <h2>Subscriber baharu di MyLegalPracticeAI</h2>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:6px 10px;border:1px solid #ddd"><b>Nama</b></td><td style="padding:6px 10px;border:1px solid #ddd">${name}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd"><b>Email</b></td><td style="padding:6px 10px;border:1px solid #ddd">${email}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd"><b>Pelan</b></td><td style="padding:6px 10px;border:1px solid #ddd">${tier ?? "-"}${trial ? " (free trial 7 hari)" : ""}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd"><b>Portal</b></td><td style="padding:6px 10px;border:1px solid #ddd">${apps.length > 0 ? apps.join(", ") : "Belum pilih portal"}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd"><b>Kod akses</b></td><td style="padding:6px 10px;border:1px solid #ddd;font-family:monospace"><b>${accessCode}</b></td></tr>
    </table>
    <p><b>Tindakan:</b> Daftarkan kod akses ini dalam admin panel portal berkenaan supaya pelanggan boleh log masuk.</p>
    <p style="color:#777;font-size:13px">Emel automatik dari sistem mylegalpracticeai.life</p>
  </div>`;
}

/**
 * Idempotently provision a subscriber from a completed Stripe checkout session.
 * Returns the subscriber's access details, creating the record and sending
 * emails only on first call for a given session/subscription.
 */
export async function provisionFromCheckoutSession(
  sessionId: string,
): Promise<ProvisionResult | null> {
  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.status !== "complete") {
    return null;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  const customerId =
    typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);

  const tier = session.metadata?.tier ?? null;
  const trial = session.metadata?.trial === "true";
  const appUrl = session.metadata?.appUrl ?? null;
  const email = session.customer_details?.email ?? null;
  const name = session.customer_details?.name ?? email ?? "Subscriber";
  const phone = session.customer_details?.phone ?? "";
  const apps = appsForCheckout(tier, appUrl);

  // Idempotency: one subscriber per Stripe subscription.
  if (subscriptionId) {
    const [existing] = await db
      .select()
      .from(subscribersTable)
      .where(eq(subscribersTable.stripeSubscriptionId, subscriptionId));
    if (existing) {
      // Never re-activate portal access for a cancelled subscriber — a
      // replayed/out-of-order checkout webhook must not undo a cancellation.
      if (existing.paymentStatus !== "cancelled") {
        await syncPortalAccessCodes(existing);
      }
      return {
        accessCode: existing.accessCode,
        apps: existing.apps,
        tier: existing.tier,
        trial,
        email: existing.email,
        name: existing.name,
        alreadyExisted: true,
      };
    }
  }

  if (!email) {
    logger.error({ sessionId }, "Checkout session has no customer email; skipping provisioning");
    return null;
  }

  const accessCode = generateAccessCode();
  const amountTotal = session.amount_total ?? 0;
  const paymentAmount = trial ? "0.00" : (amountTotal / 100).toFixed(2);

  // Atomic idempotency: stripe_subscription_id has a UNIQUE constraint, so if
  // the webhook and the success-page poll race, only one insert wins and the
  // loser re-reads the winner's row instead of creating a duplicate.
  const [subscriber] = await db
    .insert(subscribersTable)
    .values({
      name,
      email,
      phone,
      apps,
      tier,
      paymentStatus: "confirmed",
      paymentAmount,
      paymentDate: new Date(),
      paymentProvider: "stripe",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      accessCode,
      notes: trial ? "7-day free trial via Stripe checkout" : null,
    })
    .onConflictDoNothing({ target: subscribersTable.stripeSubscriptionId })
    .returning();

  if (!subscriber) {
    // Lost the race — another request already provisioned this subscription.
    if (!subscriptionId) return null;
    const [existing] = await db
      .select()
      .from(subscribersTable)
      .where(eq(subscribersTable.stripeSubscriptionId, subscriptionId));
    if (!existing) return null;
    if (existing.paymentStatus !== "cancelled") {
      await syncPortalAccessCodes(existing);
    }
    return {
      accessCode: existing.accessCode,
      apps: existing.apps,
      tier: existing.tier,
      trial,
      email: existing.email,
      name: existing.name,
      alreadyExisted: true,
    };
  }

  await syncPortalAccessCodes({ accessCode, name, email, apps });

  await db.insert(activityTable).values({
    type: "subscriber_added",
    description: `Auto-provisioned subscriber ${name} (${email}) — ${tier ?? "?"}${trial ? " trial" : ""}, access code ${accessCode}`,
  });

  logger.info(
    { subscriberId: subscriber?.id, email, tier, trial },
    "Subscriber auto-provisioned from Stripe checkout",
  );

  // Emails/SMS are best-effort: provisioning must not fail if delivery is down.
  void (async () => {
    if (phone) {
      const smsResult = await sendSms(phone, accessCodeSmsBody({ accessCode, trial }));
      if (smsResult === "failed") {
        await db.insert(activityTable).values({
          type: "sms_failed",
          description: `FAILED to SMS access code ${accessCode} to ${phone} — send manually`,
        });
      }
    }
    const sent = await sendEmail({
      to: email,
      subject: trial
        ? "Your MyLegalPracticeAI access code (7-day free trial)"
        : "Your MyLegalPracticeAI access code",
      html: customerEmailHtml({ name, accessCode, apps, trial }),
    });
    if (!sent) {
      await db.insert(activityTable).values({
        type: "email_failed",
        description: `FAILED to email access code ${accessCode} to ${email} — send manually`,
      });
    }
    const ownerEmail = await getOwnerEmail();
    if (ownerEmail) {
      await sendEmail({
        to: ownerEmail,
        subject: `Subscriber baharu: ${name} (${tier ?? "?"}${trial ? ", trial" : ""})`,
        html: ownerEmailHtml({ name, email, accessCode, apps, tier, trial }),
      });
    }
  })().catch((err) => {
    logger.error({ err }, "Post-provisioning email dispatch failed");
  });

  return {
    accessCode,
    apps,
    tier,
    trial,
    email,
    name,
    alreadyExisted: false,
  };
}

/** Emails used by automated tests — never provision/email these. */
function isTestEmail(email: string): boolean {
  return /@example\.(com|test|org|net)$/i.test(email) || email.startsWith("agent-test-");
}

export interface ReconcileResult {
  checked: number;
  provisioned: number;
  skipped: number;
  errors: number;
}

/**
 * Safety net for missed webhooks: scan all live Stripe subscriptions and
 * provision any that have no local subscriber record (access code + emails).
 * Idempotent — already-provisioned subscriptions are skipped via the
 * unique stripe_subscription_id constraint inside provisionFromCheckoutSession.
 */
export async function reconcileMissedProvisioning(): Promise<ReconcileResult> {
  const stripe = await getUncachableStripeClient();
  const result: ReconcileResult = { checked: 0, provisioned: 0, skipped: 0, errors: 0 };
  // Customers sometimes retry checkout several times, leaving duplicate
  // subscriptions. Only provision ONE subscription per email per run so the
  // customer gets a single access-code email; duplicates are logged for
  // admin review instead.
  const provisionedEmailsThisRun = new Set<string>();

  for (const status of ["trialing", "active", "past_due"] as const) {
    for await (const sub of stripe.subscriptions.list({ status, limit: 100 })) {
      result.checked++;

      const [existing] = await db
        .select({ id: subscribersTable.id })
        .from(subscribersTable)
        .where(eq(subscribersTable.stripeSubscriptionId, sub.id));
      if (existing) {
        result.skipped++;
        continue;
      }

      try {
        const sessions = await stripe.checkout.sessions.list({
          subscription: sub.id,
          limit: 1,
        });
        const session = sessions.data[0];
        if (!session || session.status !== "complete") {
          result.skipped++;
          continue;
        }
        const email = session.customer_details?.email ?? "";
        if (!email || isTestEmail(email)) {
          result.skipped++;
          continue;
        }
        const emailKey = email.toLowerCase();
        if (provisionedEmailsThisRun.has(emailKey)) {
          result.skipped++;
          logger.warn(
            { subscriptionId: sub.id, email },
            "Reconciliation skipped duplicate subscription for same email — review in Stripe dashboard",
          );
          continue;
        }
        const provisioned = await provisionFromCheckoutSession(session.id);
        if (provisioned && !provisioned.alreadyExisted) {
          provisionedEmailsThisRun.add(emailKey);
          result.provisioned++;
          logger.info(
            { subscriptionId: sub.id, email },
            "Reconciliation provisioned a missed subscriber",
          );
        } else {
          result.skipped++;
        }
      } catch (err) {
        result.errors++;
        logger.error({ err, subscriptionId: sub.id }, "Reconciliation failed for subscription");
      }
    }
  }

  logger.info(result, "Stripe provisioning reconciliation finished");
  return result;
}

/** Handle a verified Stripe webhook event for provisioning side effects. */
export async function handleStripeEventForProvisioning(payload: Buffer): Promise<void> {
  let event: Stripe.Event;
  try {
    event = JSON.parse(payload.toString("utf-8")) as Stripe.Event;
  } catch {
    return;
  }
  if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const terminalStatuses = ["canceled", "unpaid", "incomplete_expired"];
    const isTerminal =
      event.type === "customer.subscription.deleted" || terminalStatuses.includes(sub.status);
    if (isTerminal) {
      try {
        await handleSubscriptionCancelled(sub.id);
      } catch (err) {
        logger.error({ err, subscriptionId: sub.id }, "Cancellation handling from webhook failed");
      }
    }
    return;
  }
  if (event.type !== "checkout.session.completed") return;
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "subscription") return;
  // Retry with backoff — the Stripe credential fetch can transiently 429
  // right after checkout (several credential lookups happen in a short window).
  const delaysMs = [0, 3000, 10000];
  for (let attempt = 0; attempt < delaysMs.length; attempt++) {
    if (delaysMs[attempt]! > 0) {
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
    }
    try {
      await provisionFromCheckoutSession(session.id);
      return;
    } catch (err) {
      const lastAttempt = attempt === delaysMs.length - 1;
      logger.error(
        { err, sessionId: session.id, attempt: attempt + 1, willRetry: !lastAttempt },
        "Provisioning from webhook failed",
      );
    }
  }
}
