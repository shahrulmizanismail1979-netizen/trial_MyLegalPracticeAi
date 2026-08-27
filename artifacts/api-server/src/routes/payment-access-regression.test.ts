// Customer-critical payment-to-access regression suite.
//
// This deliberately uses a fully mocked Stripe client and unique, temporary
// database records. It proves the customer path without creating a Checkout
// Session, subscription, webhook, or customer in the live Stripe account.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";

type FakeCheckoutSession = {
  id: string;
  status: "complete";
  mode: "subscription";
  subscription: string;
  customer: string;
  amount_total: number;
  metadata: Record<string, string>;
  customer_details: { email: string; name: string; phone: string };
};

const RUN_ID = randomUUID().replace(/-/g, "");
const WEBHOOK_SESSION_ID = `cs_payment_guard_webhook_${RUN_ID}`;
const RECONCILE_SESSION_ID = `cs_payment_guard_reconcile_${RUN_ID}`;
const WEBHOOK_SUBSCRIPTION_ID = `sub_payment_guard_webhook_${RUN_ID}`;
const RECONCILE_SUBSCRIPTION_ID = `sub_payment_guard_reconcile_${RUN_ID}`;
const WEBHOOK_EMAIL = `payment-guard-webhook-${RUN_ID}@lawyes.invalid`;
const RECONCILE_EMAIL = `payment-guard-reconcile-${RUN_ID}@lawyes.invalid`;

const state = vi.hoisted(() => ({
  createdSessions: [] as Record<string, unknown>[],
  sessions: new Map<string, FakeCheckoutSession>(),
  subscriptions: [] as Array<{ id: string; status: string }>,
}));

vi.mock("../stripeClient", () => ({
  requireLiveStripeInProduction: vi.fn().mockResolvedValue(undefined),
  getStripeSync: vi
    .fn()
    .mockRejectedValue(new Error("not used by payment regression tests")),
  getUncachableStripeClient: vi.fn().mockResolvedValue({
    products: {
      search: vi
        .fn()
        .mockResolvedValue({ data: [{ id: "prod_payment_guard_single" }] }),
    },
    prices: {
      list: vi.fn().mockResolvedValue({
        data: [
          {
            id: "price_payment_guard_single",
            currency: "usd",
            unit_amount: 2500,
            recurring: { interval: "month" },
          },
        ],
      }),
    },
    checkout: {
      sessions: {
        create: vi
          .fn()
          .mockImplementation(async (params: Record<string, unknown>) => {
            state.createdSessions.push(params);
            return {
              id: WEBHOOK_SESSION_ID,
              url: "https://checkout.stripe.test/payment-guard",
            };
          }),
        retrieve: vi.fn().mockImplementation(async (sessionId: string) => {
          const session = state.sessions.get(sessionId);
          if (!session)
            throw new Error(`Unknown synthetic checkout session: ${sessionId}`);
          return session;
        }),
        list: vi
          .fn()
          .mockImplementation(
            async ({ subscription }: { subscription: string }) => ({
              data: [...state.sessions.values()].filter(
                (session) => session.subscription === subscription,
              ),
            }),
          ),
      },
    },
    subscriptions: {
      list: vi.fn().mockImplementation(({ status }: { status: string }) => ({
        async *[Symbol.asyncIterator]() {
          for (const subscription of state.subscriptions) {
            if (subscription.status === status) yield subscription;
          }
        },
      })),
    },
  }),
}));

// The route is exercised with its real raw-body handling and lifecycle rules.
// Stripe signature validation and Convey's separate subscription side effect
// are stubbed because this synthetic suite must not call external services.
vi.mock("../webhookHandlers", () => ({
  WebhookHandlers: {
    processWebhook: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../lib/conveyStripe", () => ({
  handleConveyStripeEvent: vi.fn().mockResolvedValue(undefined),
}));

// Provisioning delivery is intentionally best-effort. Stub it so the safety
// suite never sends a real email while still executing all access-code writes.
vi.mock("../lib/mailer", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  getOwnerEmail: vi.fn().mockResolvedValue(null),
}));

const { default: app } = await import("../app");
const { reconcileMissedProvisioning } = await import("../lib/provisioning");
const { db, subscribersTable, activityTable, litAccessCodes } =
  await import("@workspace/db");
const { eq, inArray, like } = await import("drizzle-orm");

function completedSession(
  id: string,
  subscription: string,
  email: string,
): FakeCheckoutSession {
  return {
    id,
    status: "complete",
    mode: "subscription",
    subscription,
    customer: `cus_${subscription}`,
    amount_total: 2500,
    metadata: { tier: "single", trial: "false", appUrl: "/mylitai/" },
    customer_details: {
      email,
      name: `Payment guard ${RUN_ID}`,
      phone: "",
    },
  };
}

function checkoutCompletedWebhook(sessionId: string): string {
  return JSON.stringify({
    id: `evt_payment_guard_checkout_${sessionId}`,
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: sessionId, mode: "subscription" } },
  });
}

function subscriptionDeletedWebhook(subscriptionId: string): string {
  return JSON.stringify({
    id: `evt_payment_guard_cancel_${subscriptionId}`,
    object: "event",
    type: "customer.subscription.deleted",
    data: { object: { id: subscriptionId, status: "canceled" } },
  });
}

async function subscriberFor(subscriptionId: string) {
  const [subscriber] = await db
    .select()
    .from(subscribersTable)
    .where(eq(subscribersTable.stripeSubscriptionId, subscriptionId));
  return subscriber;
}

describe("payment-to-access customer journey", () => {
  const originalLawyesUrl = process.env.LAWYES_PUBLIC_URL;
  const originalDomains = process.env.REPLIT_DOMAINS;

  beforeEach(() => {
    // A deployment can expose a preview domain too. Stripe must always send a
    // buyer back to the official LAWYes site, never to that runtime hostname.
    process.env.LAWYES_PUBLIC_URL = "https://mylegalpracticeai.life/";
    process.env.REPLIT_DOMAINS = "payment-guard-preview.replit.app";
  });

  afterAll(async () => {
    const subscriptionIds = [
      WEBHOOK_SUBSCRIPTION_ID,
      RECONCILE_SUBSCRIPTION_ID,
    ];
    const subscribers = await db
      .select({ accessCode: subscribersTable.accessCode })
      .from(subscribersTable)
      .where(inArray(subscribersTable.stripeSubscriptionId, subscriptionIds));
    const accessCodes = subscribers
      .map((subscriber) => subscriber.accessCode)
      .filter((accessCode): accessCode is string => !!accessCode);

    if (accessCodes.length > 0) {
      await db
        .delete(litAccessCodes)
        .where(inArray(litAccessCodes.code, accessCodes));
    }
    await db
      .delete(subscribersTable)
      .where(inArray(subscribersTable.stripeSubscriptionId, subscriptionIds));
    await db
      .delete(activityTable)
      .where(like(activityTable.description, `%Payment guard ${RUN_ID}%`));

    if (originalLawyesUrl === undefined) delete process.env.LAWYES_PUBLIC_URL;
    else process.env.LAWYES_PUBLIC_URL = originalLawyesUrl;
    if (originalDomains === undefined) delete process.env.REPLIT_DOMAINS;
    else process.env.REPLIT_DOMAINS = originalDomains;
  });

  it("keeps a selected portal purchaser on the official return path, provisions from a webhook, grants access, and revokes it on cancellation", async () => {
    const checkout = await request(app)
      .post("/api/stripe/checkout")
      .send({ tier: "single", appUrl: "/mylitai/" });

    expect(checkout.status).toBe(200);
    expect(checkout.body.url).toBe(
      "https://checkout.stripe.test/payment-guard",
    );
    expect(state.createdSessions).toHaveLength(1);
    expect(state.createdSessions[0]).toMatchObject({
      mode: "subscription",
      success_url:
        "https://mylegalpracticeai.life/?checkout=success&session_id={CHECKOUT_SESSION_ID}&redirect=%2Fmylitai%2F",
      cancel_url: "https://mylegalpracticeai.life/?checkout=cancelled",
      metadata: { tier: "single", appUrl: "/mylitai/" },
      subscription_data: { metadata: { tier: "single", trial: "false" } },
    });

    state.sessions.set(
      WEBHOOK_SESSION_ID,
      completedSession(
        WEBHOOK_SESSION_ID,
        WEBHOOK_SUBSCRIPTION_ID,
        WEBHOOK_EMAIL,
      ),
    );
    const completedWebhook = await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", "synthetic-payment-guard-signature")
      .set("content-type", "application/json")
      .send(checkoutCompletedWebhook(WEBHOOK_SESSION_ID));
    expect(completedWebhook.status).toBe(200);
    await vi.waitFor(async () => {
      expect(await subscriberFor(WEBHOOK_SUBSCRIPTION_ID)).toBeDefined();
    });

    const provisioned = await subscriberFor(WEBHOOK_SUBSCRIPTION_ID);
    expect(provisioned).toMatchObject({
      email: WEBHOOK_EMAIL,
      apps: ["MyLitAI"],
      tier: "single",
      paymentStatus: "confirmed",
    });
    expect(provisioned?.accessCode).toMatch(
      /^MLPA-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/,
    );

    // The success page's session lookup is the buyer-facing reconciliation
    // path. It must return the same code rather than duplicating the customer.
    const sessionInfo = await request(app).get(
      `/api/stripe/session-info?session_id=${WEBHOOK_SESSION_ID}`,
    );
    expect(sessionInfo.status).toBe(200);
    expect(sessionInfo.body).toMatchObject({
      accessCode: provisioned?.accessCode,
      apps: ["MyLitAI"],
      tier: "single",
      trial: false,
    });

    const beforeCancellation = await request(app)
      .post("/api/lit/auth/login")
      .send({ password: provisioned!.accessCode });
    expect(beforeCancellation.status).toBe(200);

    const cancelledWebhook = await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", "synthetic-payment-guard-signature")
      .set("content-type", "application/json")
      .send(subscriptionDeletedWebhook(WEBHOOK_SUBSCRIPTION_ID));
    expect(cancelledWebhook.status).toBe(200);

    const cancelled = await subscriberFor(WEBHOOK_SUBSCRIPTION_ID);
    const [portalCode] = await db
      .select()
      .from(litAccessCodes)
      .where(eq(litAccessCodes.code, provisioned!.accessCode!));
    expect(cancelled?.paymentStatus).toBe("cancelled");
    expect(portalCode?.status).toBe("inactive");

    // A delayed success-page poll must not resurrect a cancelled subscription.
    const replayedSessionInfo = await request(app).get(
      `/api/stripe/session-info?session_id=${WEBHOOK_SESSION_ID}`,
    );
    expect(replayedSessionInfo.status).toBe(200);
    const afterCancellation = await request(app)
      .post("/api/lit/auth/login")
      .send({ password: provisioned!.accessCode });
    expect(afterCancellation.status).toBe(401);
  });

  it("recovers a completed portal checkout that missed its webhook without making Stripe calls", async () => {
    state.sessions.set(
      RECONCILE_SESSION_ID,
      completedSession(
        RECONCILE_SESSION_ID,
        RECONCILE_SUBSCRIPTION_ID,
        RECONCILE_EMAIL,
      ),
    );
    state.subscriptions.push({
      id: RECONCILE_SUBSCRIPTION_ID,
      status: "active",
    });

    const result = await reconcileMissedProvisioning();
    const provisioned = await subscriberFor(RECONCILE_SUBSCRIPTION_ID);

    expect(result).toEqual({
      checked: 1,
      provisioned: 1,
      skipped: 0,
      errors: 0,
    });
    expect(provisioned).toMatchObject({
      email: RECONCILE_EMAIL,
      apps: ["MyLitAI"],
      paymentStatus: "confirmed",
    });

    const portalLogin = await request(app)
      .post("/api/lit/auth/login")
      .send({ password: provisioned!.accessCode });
    expect(portalLogin.status).toBe(200);
  });
});
