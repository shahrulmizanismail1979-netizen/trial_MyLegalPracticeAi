// Automatic subscriber provisioning after Stripe checkout.
// Generates an access code, records the subscriber, and emails the
// access code to the customer plus a notification to the site owner (Gmail integration).
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db, subscribersTable, activityTable } from "@workspace/db";
import { getUncachableStripeClient } from "../stripeClient";
import { sendEmail, getOwnerEmail } from "./mailer";
import { logger } from "./logger";

export const APP_NAME_BY_URL: Record<string, string> = {
  "https://mylitai.life": "MyLitAI",
  "https://mylitai.life/irac/": "MyLitAI (Versi 2)",
  "https://mysyalitai.life": "MySyalitAI",
  "https://mycorpai.life": "MyCorpAI",
  "https://myconveyai.life": "MyConveyAI",
  "https://mycrimai.life/": "MyCrimAI",
  "https://myccblitai.life/": "MyCCBLitAI",
  "https://myaccidentai.life/": "MyAccidentAI",
};

export const ALL_APP_NAMES = [
  "MyLitAI",
  "MySyalitAI",
  "MyCorpAI",
  "MyConveyAI",
  "MyCrimAI",
  "MyCCBLitAI",
  "MyAccidentAI",
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

  await db.insert(activityTable).values({
    type: "subscriber_added",
    description: `Auto-provisioned subscriber ${name} (${email}) — ${tier ?? "?"}${trial ? " trial" : ""}, access code ${accessCode}`,
  });

  logger.info(
    { subscriberId: subscriber?.id, email, tier, trial },
    "Subscriber auto-provisioned from Stripe checkout",
  );

  // Emails are best-effort: provisioning must not fail if Gmail is down.
  void (async () => {
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
