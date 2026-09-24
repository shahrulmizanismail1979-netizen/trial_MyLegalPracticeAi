// Automatic subscriber provisioning after Stripe checkout.
// Generates an access code, records the subscriber, and emails the
// access code to the customer plus a notification to the site owner (Gmail integration).
import { randomBytes, randomUUID } from "node:crypto";
import { eq, and, or, isNull, gt, desc, asc, lte } from "drizzle-orm";
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
import { usersTable as acadUsersTable } from "@workspace/db/acad";
import { getUncachableStripeClient } from "../stripeClient";
import { sendEmail, getOwnerEmail } from "./mailer";
import { sendSms, accessCodeSmsBody, type SmsResult } from "./sms";
import { logger } from "./logger";
import { portalLoginHtml } from "./portal-delivery";
import { portalRowAccessible } from "./portal-access-check";
import {
  cancelSarawak20Enrollment,
  consumeSarawak20Reservation,
  releaseSarawak20ReservationFromSession,
  SARAWAK20_TIER,
} from "./sarawak20";

export { PORTAL_APP_BY_URL as APP_NAME_BY_URL } from "@workspace/entitlements";
import { PORTAL_APP_BY_URL as APP_NAME_BY_URL } from "@workspace/entitlements";

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
  plan: string | null;
  licenses: number | null;
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
 * convey app's own Stripe reconciliation ignores these users. The nullable
 * current_period_end is a mirror only; landing subscribers remain the source
 * of truth for access expiry (see isConveyCodeExpired).
 */
async function syncConveyUser(params: {
  accessCode: string;
  name: string;
  email: string | null;
  expiresAt?: Date | null;
  maxSeats: number | null;
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
        currentPeriodEnd: params.expiresAt ?? null,
        maxSeats: params.maxSeats,
      })
      .onConflictDoUpdate({
        target: usersTable.accessCode,
        set: {
          isActive: true,
          subscriptionTier: "firm",
          subscriptionStatus: "active",
          // Explicitly write NULL when an admin clears an expiry. Otherwise a
          // previously expired mirror would survive a renewal/expiry reset.
          currentPeriodEnd: params.expiresAt ?? null,
          maxSeats: params.maxSeats,
        },
      });
    logger.info(
      "Synced MyConveyLitAI user for landing purchase",
    );
  } catch (err) {
    logger.error(
      { err },
      "Failed to sync MyConveyLitAI user for landing purchase",
    );
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
  /** Licensed seat count for team bundles; defaults to the individual cap. */
  maxUsers?: number | null;
}): Promise<void> {
  const maxUsers = Math.max(2, params.maxUsers ?? 2);
  try {
    await db
      .insert(accessCodesTable)
      .values({
        code: params.accessCode,
        label: params.name,
        maxUsers,
        isActive: true,
        expiresAt: params.expiresAt ?? null,
      })
      .onConflictDoUpdate({
        target: accessCodesTable.code,
        set: { isActive: true, expiresAt: params.expiresAt ?? null, maxUsers },
      });
    logger.info(
      "Synced MyAccidentAI access code for landing purchase",
    );
  } catch (err) {
    logger.error(
      { err },
      "Failed to sync MyAccidentAI access code for landing purchase",
    );
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
  maxSeats: number | null;
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
        maxSeats: params.maxSeats,
      })
      .onConflictDoUpdate({
        target: crimAccessCodesTable.code,
        set: {
          isActive: true,
          tier: "full",
          expiresAt: params.expiresAt ?? null,
          maxSeats: params.maxSeats,
        },
      });
    logger.info(
      "Synced MyCrimAI access code for landing purchase",
    );
  } catch (err) {
    logger.error(
      { err },
      "Failed to sync MyCrimAI access code for landing purchase",
    );
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
  maxSeats: number | null;
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
        maxSeats: params.maxSeats,
      })
      .onConflictDoUpdate({
        target: corpAccessCodesTable.code,
        set: {
          isActive: true,
          tier: "firm",
          expiresAt: params.expiresAt ?? null,
          maxSeats: params.maxSeats,
        },
      });
    logger.info(
      "Synced MyCorpLegalAI access code for landing purchase",
    );
  } catch (err) {
    logger.error(
      { err },
      "Failed to sync MyCorpLegalAI access code for landing purchase",
    );
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
  maxSeats: number | null;
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
        maxSeats: params.maxSeats,
      })
      .onConflictDoUpdate({
        target: litAccessCodesTable.code,
        set: {
          status: "active",
          expiresAt: params.expiresAt ?? null,
          maxSeats: params.maxSeats,
        },
      });
    logger.info(
      "Synced MyLitAI access code for landing purchase",
    );
  } catch (err) {
    logger.error(
      { err },
      "Failed to sync MyLitAI access code for landing purchase",
    );
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
export async function syncSyaAccessCode(params: {
  accessCode: string;
  name: string;
  expiresAt?: Date | null;
  maxSeats?: number | null;
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
        maxSeats: params.maxSeats ?? null,
      })
      .onConflictDoUpdate({
        target: syaAccessCodesTable.code,
        set: {
          isActive: true,
          expiresAt: params.expiresAt ?? null,
          maxSeats: params.maxSeats ?? null,
        },
      });
    logger.info(
      "Synced MySyalitAI access code for landing purchase",
    );
  } catch (err) {
    logger.error(
      { err },
      "Failed to sync MySyalitAI access code for landing purchase",
    );
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
  maxSeats: number | null;
}): Promise<void> {
  try {
    await db
      .insert(ccbAccessCodesTable)
      .values({
        code: params.accessCode,
        label: params.name,
        active: true,
        expiresAt: params.expiresAt ?? null,
        maxSeats: params.maxSeats,
      })
      .onConflictDoUpdate({
        target: ccbAccessCodesTable.code,
        set: {
          active: true,
          expiresAt: params.expiresAt ?? null,
          maxSeats: params.maxSeats,
        },
      });
    logger.info(
      "Synced MyCCBLitAI access code for landing purchase",
    );
  } catch (err) {
    logger.error(
      { err },
      "Failed to sync MyCCBLitAI access code for landing purchase",
    );
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
  maxSeats: number | null;
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
        maxSeats: params.maxSeats,
      })
      .onConflictDoUpdate({
        target: firmAccessCodesTable.code,
        set: {
          isActive: true,
          expiresAt: params.expiresAt ?? null,
          maxSeats: params.maxSeats,
        },
      });
    logger.info(
      "Synced MyLawFirmAi access code for landing purchase",
    );
  } catch (err) {
    logger.error(
      { err },
      "Failed to sync MyLawFirmAi access code for landing purchase",
    );
  }
}

type PortalAccessSubscriber = typeof subscribersTable.$inferSelect;

/** Check one subscriber without returning their code, name, or contact details. */
async function checkSubscriberPortalAccess(sub: PortalAccessSubscriber, now: Date) {
  const gaps: Array<{ subscriberId: number; portal: string }> = [];
  if (!sub.apps.length) return { gaps, unknownIntent: 1, unknownSubscriberId: sub.id };
  const code = sub.accessCode ?? "";
  const checks: Array<[string, boolean, () => Promise<boolean>]> = [
    ["MyCrimAI", includesCrimApp(sub.apps), async () => portalRowAccessible((await db.select().from(crimAccessCodesTable).where(eq(crimAccessCodesTable.code, code)).limit(1))[0], now)],
    ["MyCorpAI", includesCorpApp(sub.apps), async () => portalRowAccessible((await db.select().from(corpAccessCodesTable).where(eq(corpAccessCodesTable.code, code)).limit(1))[0], now)],
    ["MyLitAI", includesLitApp(sub.apps), async () => portalRowAccessible((await db.select().from(litAccessCodesTable).where(eq(litAccessCodesTable.code, code)).limit(1))[0], now)],
    ["MySyalitAI", includesSyaApp(sub.apps), async () => portalRowAccessible((await db.select().from(syaAccessCodesTable).where(eq(syaAccessCodesTable.code, code)).limit(1))[0], now)],
    ["MyCCBLitAI", includesCcbApp(sub.apps), async () => portalRowAccessible((await db.select().from(ccbAccessCodesTable).where(eq(ccbAccessCodesTable.code, code)).limit(1))[0], now)],
    ["MyAccidentAI", includesAccidentApp(sub.apps), async () => portalRowAccessible((await db.select().from(accessCodesTable).where(eq(accessCodesTable.code, code)).limit(1))[0], now)],
    ["MyLawFirmAi", includesFirmApp(sub.apps), async () => portalRowAccessible((await db.select().from(firmAccessCodesTable).where(eq(firmAccessCodesTable.code, code)).limit(1))[0], now)],
    ["MyConveyAI", includesConveyApp(sub.apps), async () => {
      const row = (await db.select().from(usersTable).where(eq(usersTable.accessCode, code)).limit(1))[0];
      return !!row && portalRowAccessible({ isActive: row.isActive, expiresAt: row.currentPeriodEnd }, now);
    }],
    ["MyLawAcad", includesAcadApp(sub.apps), async () => {
      const row = (await db.select().from(acadUsersTable).where(eq(acadUsersTable.accessCode, code)).limit(1))[0];
      return !!row && row.status === "active" && (!row.accessCodeExpiresAt || row.accessCodeExpiresAt > now);
    }],
  ];
  if (!checks.some(([, intended]) => intended)) {
    return { gaps, unknownIntent: 1, unknownSubscriberId: sub.id };
  }
  for (const [portal, intended, check] of checks) {
    if (intended && (!sub.accessCode || !await check())) gaps.push({ subscriberId: sub.id, portal });
  }
  return { gaps, unknownIntent: 0, unknownSubscriberId: null };
}

async function checkPortalAccessSubscribers(subscribers: PortalAccessSubscriber[], now: Date) {
  const gaps: Array<{ subscriberId: number; portal: string }> = [];
  let unknownIntent = 0;
  const unknownSubscriberIds: number[] = [];
  for (const sub of subscribers) {
    const result = await checkSubscriberPortalAccess(sub, now);
    gaps.push(...result.gaps);
    unknownIntent += result.unknownIntent;
    if (result.unknownSubscriberId != null) unknownSubscriberIds.push(result.unknownSubscriberId);
  }
  return { gaps, unknownIntent, unknownSubscriberIds };
}

/** Read-only, bounded sample for staff diagnostics. No code, name or contact data leaves this function. */
export async function checkRecentPortalAccess() {
  const now = new Date();
  const subscribers = await db.select().from(subscribersTable).where(and(
    eq(subscribersTable.paymentStatus, "confirmed"),
    or(isNull(subscribersTable.subscriptionExpiry), gt(subscribersTable.subscriptionExpiry, now)),
  )).orderBy(desc(subscribersTable.id)).limit(25);
  const { gaps, unknownIntent } = await checkPortalAccessSubscribers(subscribers, now);
  return { sampleLimit: 25, sampled: subscribers.length, unknownIntent, gaps };
}

/**
 * Cursor-based counterpart used by the automatic monitor. The upper bound is
 * fixed for a complete sweep, so a burst of newer signups can never starve
 * older rows. This function is strictly read-only.
 */
export async function checkPortalAccessBatch(params: {
  afterId: number;
  throughId: number;
  limit: number;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const subscribers = await db.select().from(subscribersTable).where(and(
    eq(subscribersTable.paymentStatus, "confirmed"),
    or(isNull(subscribersTable.subscriptionExpiry), gt(subscribersTable.subscriptionExpiry, now)),
    gt(subscribersTable.id, params.afterId),
    lte(subscribersTable.id, params.throughId),
  )).orderBy(asc(subscribersTable.id)).limit(params.limit);
  const result = await checkPortalAccessSubscribers(subscribers, now);
  return {
    ...result,
    sampled: subscribers.length,
    lastId: subscribers.at(-1)?.id ?? params.afterId,
    complete: subscribers.length < params.limit || subscribers.at(-1)?.id === params.throughId,
  };
}

export async function getPortalAccessScanUpperBound(now = new Date()): Promise<number> {
  const rows = await db.select({ id: subscribersTable.id }).from(subscribersTable).where(and(
    eq(subscribersTable.paymentStatus, "confirmed"),
    or(isNull(subscribersTable.subscriptionExpiry), gt(subscribersTable.subscriptionExpiry, now)),
  )).orderBy(desc(subscribersTable.id)).limit(1);
  return rows[0]?.id ?? 0;
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
  tier?: string | null;
  licenses?: number | null;
}): Promise<void> {
  const { accessCode, name, email, apps } = subscriber;
  if (!accessCode) return;
  // Propagate the subscriber's expiry date into every portal table that
  // supports one, so the code stops working when the subscription ends.
  const expiresAt = subscriber.subscriptionExpiry ?? null;
  // Team bundles carry a licensed seat count; every portal's access-code
  // record gets that seat cap so concurrent use is limited to the licensed
  // count. Individual (non-bundle) plans have no licensed seat count, so
  // their cap stays NULL and legacy behavior is preserved.
  const maxSeats = licensedSeatCap(subscriber);
  const licenses =
    subscriber.licenses ??
    (subscriber.tier
      ? BUNDLE_TIER_CATALOG[subscriber.tier]?.licenses
      : undefined) ??
    null;
  if (includesConveyApp(apps))
    await syncConveyUser({ accessCode, name, email, expiresAt, maxSeats });
  if (includesAccidentApp(apps))
    await syncAccidentAccessCode({
      accessCode,
      name,
      expiresAt,
      maxUsers: licenses,
    });
  if (includesCrimApp(apps))
    await syncCrimAccessCode({ accessCode, name, expiresAt, maxSeats });
  if (includesCorpApp(apps))
    await syncCorpAccessCode({ accessCode, name, expiresAt, maxSeats });
  if (includesLitApp(apps))
    await syncLitAccessCode({ accessCode, name, email, expiresAt, maxSeats });
  if (includesSyaApp(apps))
    await syncSyaAccessCode({ accessCode, name, expiresAt, maxSeats });
  if (includesCcbApp(apps))
    await syncCcbAccessCode({ accessCode, name, expiresAt, maxSeats });
  if (includesFirmApp(apps))
    await syncFirmAccessCode({ accessCode, name, email, expiresAt, maxSeats });
  if (includesAcadApp(apps))
    await syncAcadUser({ accessCode, name, expiresAt, maxSeats });
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
  if (includesAcadApp(apps)) {
    attempts.push([
      "MyLawAcad",
      () =>
        db
          .update(acadUsersTable)
          .set({ status: "suspended", subscriptionStatus: "canceled" })
          .where(eq(acadUsersTable.accessCode, accessCode)),
    ]);
  }
  for (const [app, run] of attempts) {
    try {
      await run();
      logger.info(
        { accessCode, app },
        "Deactivated portal access code after cancellation",
      );
    } catch (err) {
      logger.error(
        { err, accessCode, app },
        "Failed to deactivate portal access code",
      );
    }
  }
}

/**
 * Handle a cancelled Stripe subscription: mark the landing subscriber as
 * cancelled and switch off their access code on every portal in the plan.
 */
export async function handleSubscriptionCancelled(
  subscriptionId: string,
): Promise<void> {
  const [subscriber] = await db
    .select()
    .from(subscribersTable)
    .where(eq(subscribersTable.stripeSubscriptionId, subscriptionId));
  if (!subscriber) {
    await cancelSarawak20Enrollment(subscriptionId);
    logger.warn(
      { subscriptionId },
      "Cancelled subscription has no matching subscriber",
    );
    return;
  }
  const alreadyCancelled = subscriber.paymentStatus === "cancelled";
  // Deactivate portal codes FIRST and on every delivery (idempotent updates),
  // so a transient failure on one portal is retried on the next webhook retry
  // even if the subscriber row was already marked cancelled.
  await deactivatePortalAccessCodes(subscriber);
  if (subscriber.tier === SARAWAK20_TIER) {
    await cancelSarawak20Enrollment(subscriptionId);
  }
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

/**
 * Firm / corporate / education team bundles sold on the landing page.
 * Each grants access to ALL portals (like the individual Complete Bundle)
 * with a stated number of user licenses, billed as one monthly subscription.
 * The key is the checkout `tier` and also the Stripe product `metadata.tier`.
 */
/**
 * Licensed seat cap for a subscriber: team bundles carry a real licensed
 * seat count (explicit licenses or from the bundle-tier catalog); individual
 * plans have none, so their cap is NULL (legacy/unlimited-seat behavior).
 * Every path that (re)creates a portal access-code row must use this so a
 * recovered or re-synced bundle code can never lose its cap.
 */
// The Academic Bundle also covers MyLawAcad; its bundle codes log in via a
// dedicated access-code path on acad_users.
function includesAcadApp(apps: string[]): boolean {
  return apps.includes("MyLawAcad");
}

/**
 * Upsert a MyLawAcad account bound to the landing-page access code so the
 * bundle code also logs in to the Academic portal. Synthetic unique email
 * avoids collisions with real teacher accounts. Best-effort: never fails
 * provisioning.
 */
async function syncAcadUser(params: {
  accessCode: string;
  name: string;
  expiresAt?: Date | null;
  maxSeats: number | null;
}): Promise<void> {
  try {
    await db
      .insert(acadUsersTable)
      .values({
        id: randomUUID(),
        email: `${params.accessCode.toLowerCase()}@access-code.mylawacad.local`,
        name: params.name,
        role: "teacher",
        status: "active",
        accessCode: params.accessCode,
        maxSeats: params.maxSeats,
        accessCodeExpiresAt: params.expiresAt ?? null,
      })
      .onConflictDoUpdate({
        target: acadUsersTable.accessCode,
        set: {
          status: "active",
          maxSeats: params.maxSeats,
          accessCodeExpiresAt: params.expiresAt ?? null,
        },
      });
    logger.info(
      "Synced MyLawAcad account for landing purchase",
    );
  } catch (err) {
    logger.error(
      { err },
      "Failed to sync MyLawAcad account for landing purchase",
    );
  }
}

export function licensedSeatCap(subscriber: {
  tier?: string | null;
  licenses?: number | null;
}): number | null {
  const licenses =
    subscriber.licenses ??
    (subscriber.tier
      ? BUNDLE_TIER_CATALOG[subscriber.tier]?.licenses
      : undefined) ??
    null;
  return licenses != null ? Math.max(1, licenses) : null;
}

export const BUNDLE_TIER_CATALOG: Record<
  string,
  { name: string; monthlyUsdCents: number; licenses: number }
> = {
  "firm-boutique": {
    name: "Firm Bundle — Boutique (5 licenses)",
    monthlyUsdCents: 35500,
    licenses: 5,
  },
  "firm-practice": {
    name: "Firm Bundle — Practice (15 licenses)",
    monthlyUsdCents: 100500,
    licenses: 15,
  },
  "firm-firm": {
    name: "Firm Bundle — Firm (30 licenses)",
    monthlyUsdCents: 189000,
    licenses: 30,
  },
  "corp-startup": {
    name: "Corporate Bundle — Startup Legal (3 licenses)",
    monthlyUsdCents: 21300,
    licenses: 3,
  },
  "corp-growth": {
    name: "Corporate Bundle — Growth (8 licenses)",
    monthlyUsdCents: 55200,
    licenses: 8,
  },
  "corp-corporate": {
    name: "Corporate Bundle — Corporate (20 licenses)",
    monthlyUsdCents: 130000,
    licenses: 20,
  },
  "edu-faculty-starter": {
    name: "Academic Bundle — Faculty Starter (20 licenses)",
    monthlyUsdCents: 134000,
    licenses: 20,
  },
  "edu-faculty-plus": {
    name: "Academic Bundle — Faculty Plus (50 licenses)",
    monthlyUsdCents: 325000,
    licenses: 50,
  },
  "edu-campus": {
    name: "Academic Bundle — Campus (150 licenses)",
    monthlyUsdCents: 945000,
    licenses: 150,
  },
};

/** True when the tier unlocks every portal (individual bundle or any team bundle). */
export function isAllPortalsTier(tier: string | null | undefined): boolean {
  return (
    tier === "bundle" ||
    tier === SARAWAK20_TIER ||
    (tier != null && tier in BUNDLE_TIER_CATALOG)
  );
}

function appsForCheckout(tier: string | null, appUrl: string | null): string[] {
  if (isAllPortalsTier(tier)) return [...ALL_APP_NAMES];
  if (appUrl && APP_NAME_BY_URL[appUrl]) return [APP_NAME_BY_URL[appUrl]!];
  return [];
}

function customerEmailHtml(params: {
  name: string;
  accessCode: string;
  apps: string[];
  trial: boolean;
  tier?: string | null;
}): string {
  const { name, accessCode, apps, trial, tier } = params;
  const bundle = tier ? BUNDLE_TIER_CATALOG[tier] : undefined;
  const loginLinks = portalLoginHtml(apps);
  const appsText =
    apps.length > 0
      ? apps.join(", ")
      : "the AI portal of your choice (reply to this email to tell us which portal you picked)";
  if (bundle) {
    return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <h2 style="color:#1B3A6B">Welcome to LAWYes</h2>
    <p>Dear ${name},</p>
    <p>Thank you for subscribing to the <b>${bundle.name}</b>. Your team's access code is below:</p>
    <div style="background:#EEF3FF;border:2px solid #1B3A6B;border-radius:8px;padding:16px;text-align:center;margin:20px 0">
      <span style="font-size:24px;font-weight:bold;letter-spacing:2px;font-family:monospace">${accessCode}</span>
    </div>
    <p><b>Your plan:</b> ${bundle.name}<br/>
    <b>Licensed users:</b> ${bundle.licenses}</p>
    <p><b>One code for your whole team.</b> This single access code covers all ${bundle.licenses} of your licensed team members across every portal in your subscription: ${appsText}.</p>
    ${loginLinks}
    <p><b>How to add your teammates:</b></p>
    <ol style="padding-left:20px;margin:8px 0">
      <li>Share the access code above with each team member (up to ${bundle.licenses} people).</li>
      <li>Each person visits the portal they need and signs in with this code.</li>
      <li>That's it — no separate accounts or extra codes needed.</li>
    </ol>
    <p>Keep this code safe and only share it within your team — access is limited to ${bundle.licenses} licensed users. If a portal has not yet activated your code, it will be activated shortly (usually within a few hours).</p>
    <p>Questions? Just reply to this email.</p>
    <p style="color:#777;font-size:13px;margin-top:28px">LAWYes · Your Legal Work, Solved. · https://lawyes.com</p>
  </div>`;
  }
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <h2 style="color:#1B3A6B">Welcome to LAWYes</h2>
    <p>Dear ${name},</p>
    <p>Thank you for subscribing${trial ? " to the 7-day free trial" : ""}. Here is your access code:</p>
    ${loginLinks}
    <div style="background:#EEF3FF;border:2px solid #1B3A6B;border-radius:8px;padding:16px;text-align:center;margin:20px 0">
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
    <p style="color:#777;font-size:13px;margin-top:28px">LAWYes · Your Legal Work, Solved. · https://lawyes.com</p>
  </div>`;
}

/**
 * Best-effort delivery of an access code to a newly-provisioned subscriber.
 * Sends an SMS (if phone is provided) and a customer email, then notifies the
 * site owner — matching the same delivery flow that Stripe checkouts trigger.
 * Never throws; all delivery failures are logged and recorded as activity
 * entries so the admin can follow up manually.
 */
export function deliverAccessCode(params: {
  name: string;
  email: string;
  phone?: string | null;
  accessCode: string;
  apps: string[];
  tier?: string | null;
  trial?: boolean;
}): void {
  const {
    name,
    email,
    phone,
    accessCode,
    apps,
    tier = null,
    trial = false,
  } = params;
  void (async () => {
    if (phone) {
      const smsResult = await sendSms(
        phone,
        accessCodeSmsBody({
          accessCode,
          apps,
          trial,
          licenses: tier ? BUNDLE_TIER_CATALOG[tier]?.licenses : undefined,
        }),
      );
      if (smsResult === "failed") {
        await db.insert(activityTable).values({
          type: "sms_failed",
          description: `FAILED to SMS access code ${accessCode} to ${phone} — code was emailed to ${email} instead`,
          metadata: JSON.stringify({ accessCode, email, phone }),
        });
      } else if (smsResult === "not_configured") {
        await db.insert(activityTable).values({
          type: "sms_skipped",
          description: `SMS not configured (Twilio secrets missing) — access code ${accessCode} for ${phone} was emailed to ${email} instead`,
          metadata: JSON.stringify({ accessCode, email, phone }),
        });
      }
    }
    const sent = await sendEmail({
      to: email,
      subject: trial
        ? "Your LAWYes access code (7-day free trial)"
        : "Your LAWYes access code",
      html: customerEmailHtml({ name, accessCode, apps, trial, tier }),
    });
    if (!sent) {
      await db.insert(activityTable).values({
        type: "email_failed",
        description: `FAILED to email access code ${accessCode} to ${email} — send manually`,
        metadata: JSON.stringify({ accessCode, email, phone: phone ?? null }),
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
}

/**
 * Re-send the standard customer access-code email (same template used during
 * provisioning). Subscriber details are looked up by access code when
 * available so the email content matches the original.
 */
export async function resendAccessCodeEmail(params: {
  accessCode: string;
  email: string;
}): Promise<boolean> {
  const { accessCode, email } = params;
  const [subscriber] = await db
    .select()
    .from(subscribersTable)
    .where(eq(subscribersTable.accessCode, accessCode));
  const name = subscriber?.name ?? "Subscriber";
  const apps = subscriber?.apps ?? [];
  const tier = subscriber?.tier ?? null;
  const trial =
    subscriber?.notes?.toLowerCase().includes("free trial") ?? false;
  return sendEmail({
    to: email,
    subject: trial
      ? "Your LAWYes access code (7-day free trial)"
      : "Your LAWYes access code",
    html: customerEmailHtml({ name, accessCode, apps, trial, tier }),
  });
}

/**
 * Re-send the standard access-code SMS for a delivery-failure entry.
 * Looks up the subscriber to preserve the trial/team-bundle wording.
 */
export async function resendAccessCodeSms(params: {
  accessCode: string;
  phone: string;
}): Promise<SmsResult> {
  const { accessCode, phone } = params;
  const [subscriber] = await db
    .select()
    .from(subscribersTable)
    .where(eq(subscribersTable.accessCode, accessCode));
  const trial =
    subscriber?.notes?.toLowerCase().includes("free trial") ?? false;
  const tier = subscriber?.tier ?? null;
  return sendSms(
    phone,
    accessCodeSmsBody({
      accessCode,
      apps: subscriber?.apps ?? [],
      trial,
      licenses: tier ? BUNDLE_TIER_CATALOG[tier]?.licenses : undefined,
    }),
  );
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
    <h2>Subscriber baharu di LAWYes</h2>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:6px 10px;border:1px solid #ddd"><b>Nama</b></td><td style="padding:6px 10px;border:1px solid #ddd">${name}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd"><b>Email</b></td><td style="padding:6px 10px;border:1px solid #ddd">${email}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd"><b>Pelan</b></td><td style="padding:6px 10px;border:1px solid #ddd">${tier ?? "-"}${trial ? " (free trial 7 hari)" : ""}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd"><b>Portal</b></td><td style="padding:6px 10px;border:1px solid #ddd">${apps.length > 0 ? apps.join(", ") : "Belum pilih portal"}</td></tr>
      <tr><td style="padding:6px 10px;border:1px solid #ddd"><b>Kod akses</b></td><td style="padding:6px 10px;border:1px solid #ddd;font-family:monospace"><b>${accessCode}</b></td></tr>
    </table>
    <p><b>Tindakan:</b> Daftarkan kod akses ini dalam admin panel portal berkenaan supaya pelanggan boleh log masuk.</p>
    <p style="color:#777;font-size:13px">Emel automatik dari sistem lawyes.com</p>
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
    typeof session.customer === "string"
      ? session.customer
      : (session.customer?.id ?? null);

  const tier = session.metadata?.tier ?? null;
  const plan =
    tier === SARAWAK20_TIER ? (session.metadata?.plan ?? "legacy") : null;
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
        const consumed = await consumeSarawak20Reservation({
          session,
          subscriptionId,
          subscriberId: existing.id,
        });
        if (!consumed) {
          throw new Error(
            "Project Sarawak 20 paid session could not claim a cohort place",
          );
        }
        await syncPortalAccessCodes(existing);
      }
      return {
        accessCode: existing.accessCode,
        apps: existing.apps,
        tier: existing.tier,
        plan,
        licenses: existing.licenses,
        trial,
        email: existing.email,
        name: existing.name,
        alreadyExisted: true,
      };
    }
  }

  if (!email) {
    logger.error(
      { sessionId },
      "Checkout session has no customer email; skipping provisioning",
    );
    return null;
  }

  const sarawak20PlaceConsumed = await consumeSarawak20Reservation({
    session,
    subscriptionId,
  });
  if (!sarawak20PlaceConsumed) {
    throw new Error(
      "Project Sarawak 20 paid session could not claim a cohort place",
    );
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
      licenses:
        tier === SARAWAK20_TIER
          ? Number(session.metadata?.licenses) || null
          : (tier && BUNDLE_TIER_CATALOG[tier]?.licenses) || null,
      paymentStatus: "confirmed",
      paymentAmount,
      paymentDate: new Date(),
      paymentProvider: "stripe",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      accessCode,
      notes: trial
        ? "7-day free trial via Stripe checkout"
        : tier === SARAWAK20_TIER
          ? session.metadata?.plan === "aas_firm"
            ? "Project Sarawak 20 AAS 3-seat subscription"
            : `Project Sarawak 20 ${session.metadata?.plan ?? "legacy"} subscription`
          : null,
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
    const consumed = await consumeSarawak20Reservation({
      session,
      subscriptionId,
      subscriberId: existing.id,
    });
    if (!consumed) {
      throw new Error(
        "Project Sarawak 20 paid session could not link its subscriber",
      );
    }
    return {
      accessCode: existing.accessCode,
      apps: existing.apps,
      tier: existing.tier,
      plan,
      licenses: existing.licenses,
      trial,
      email: existing.email,
      name: existing.name,
      alreadyExisted: true,
    };
  }

  await syncPortalAccessCodes({
    accessCode,
    name,
    email,
    apps,
    tier,
    licenses: subscriber.licenses,
  });
  const consumed = await consumeSarawak20Reservation({
    session,
    subscriptionId,
    subscriberId: subscriber.id,
  });
  if (!consumed) {
    throw new Error(
      "Project Sarawak 20 paid session could not link its subscriber",
    );
  }

  // Safety net: if the checkout metadata didn't identify a portal, the code
  // above synced nowhere and the customer can't log in. Flag it loudly so the
  // owner assigns the purchased portal in the admin panel (editing the
  // subscriber's apps re-syncs the code automatically).
  if (apps.length === 0) {
    logger.error(
      { subscriberId: subscriber?.id, email, tier },
      "Provisioned subscriber has no portal assigned — access code is unusable until apps are set in admin",
    );
    await db.insert(activityTable).values({
      type: "needs_portal_assignment",
      description: `ACTION NEEDED: ${name} (${email}) paid but no portal was recorded — assign their app in Admin > Subscribers so access code ${accessCode} works`,
    });
  }

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
      const smsResult = await sendSms(
        phone,
        accessCodeSmsBody({
          accessCode,
          apps,
          trial,
          licenses: tier ? BUNDLE_TIER_CATALOG[tier]?.licenses : undefined,
        }),
      );
      if (smsResult === "failed") {
        await db.insert(activityTable).values({
          type: "sms_failed",
          description: `FAILED to SMS access code ${accessCode} to ${phone} — code was emailed to ${email} instead`,
          metadata: JSON.stringify({ accessCode, email, phone }),
        });
      } else if (smsResult === "not_configured") {
        // Never skip silently: record that SMS is off and email carried the code.
        await db.insert(activityTable).values({
          type: "sms_skipped",
          description: `SMS not configured (Twilio secrets missing) — access code ${accessCode} for ${phone} was emailed to ${email} instead`,
          metadata: JSON.stringify({ accessCode, email, phone }),
        });
      }
    }
    const sent = await sendEmail({
      to: email,
      subject: trial
        ? "Your LAWYes access code (7-day free trial)"
        : "Your LAWYes access code",
      html: customerEmailHtml({ name, accessCode, apps, trial, tier }),
    });
    if (!sent) {
      await db.insert(activityTable).values({
        type: "email_failed",
        description: `FAILED to email access code ${accessCode} to ${email} — send manually`,
        metadata: JSON.stringify({ accessCode, email, phone: phone ?? null }),
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
    plan,
    licenses: subscriber.licenses,
    trial,
    email,
    name,
    alreadyExisted: false,
  };
}

/** Emails used by automated tests — never provision/email these. */
function isTestEmail(email: string): boolean {
  return (
    /@example\.(com|test|org|net)$/i.test(email) ||
    email.startsWith("agent-test-")
  );
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
  const result: ReconcileResult = {
    checked: 0,
    provisioned: 0,
    skipped: 0,
    errors: 0,
  };
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
        logger.error(
          { err, subscriptionId: sub.id },
          "Reconciliation failed for subscription",
        );
      }
    }
  }

  logger.info(result, "Stripe provisioning reconciliation finished");
  return result;
}

/** Handle a verified Stripe webhook event for provisioning side effects. */
export async function handleStripeEventForProvisioning(
  payload: Buffer,
): Promise<void> {
  let event: Stripe.Event;
  try {
    event = JSON.parse(payload.toString("utf-8")) as Stripe.Event;
  } catch {
    return;
  }
  if (event.type === "checkout.session.expired") {
    await releaseSarawak20ReservationFromSession(
      event.data.object as Stripe.Checkout.Session,
    );
    return;
  }
  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    const terminalStatuses = ["canceled", "unpaid", "incomplete_expired"];
    const isTerminal =
      event.type === "customer.subscription.deleted" ||
      terminalStatuses.includes(sub.status);
    if (isTerminal) {
      // Let failures reach the webhook route. It returns a non-2xx response so
      // Stripe retries delivery instead of silently losing access revocation.
      await handleSubscriptionCancelled(sub.id);
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
        {
          err,
          sessionId: session.id,
          attempt: attempt + 1,
          willRetry: !lastAttempt,
        },
        "Provisioning from webhook failed",
      );
    }
  }
}
