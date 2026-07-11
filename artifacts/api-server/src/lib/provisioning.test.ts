import { describe, it, expect, vi, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

const RUN_ID = randomUUID();
const SUBSCRIPTION_ID = `sub_test_${RUN_ID}`;
const SESSION_ID = `cs_test_${RUN_ID}`;

// Mock the Stripe client: return a completed subscription checkout session.
vi.mock("../stripeClient", () => ({
  getStripeSync: vi.fn().mockRejectedValue(new Error("not used")),
  getUncachableStripeClient: vi.fn().mockResolvedValue({
    checkout: {
      sessions: {
        retrieve: vi.fn().mockResolvedValue({
          id: SESSION_ID,
          status: "complete",
          mode: "subscription",
          subscription: SUBSCRIPTION_ID,
          customer: `cus_test_${RUN_ID}`,
          amount_total: 0,
          metadata: { tier: "single", trial: "true", appUrl: "https://mylitai.life" },
          customer_details: {
            email: `provision-test-${RUN_ID}@example.test`,
            name: "Provision Test",
            phone: "+60123456789",
          },
        }),
      },
    },
  }),
}));

// Emails are best-effort side effects — silence them in tests.
vi.mock("./mailer", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  getOwnerEmail: vi.fn().mockResolvedValue(null),
}));

const { provisionFromCheckoutSession } = await import("./provisioning");
const { db, subscribersTable, activityTable } = await import("@workspace/db");
const { eq, like } = await import("drizzle-orm");

describe("provisionFromCheckoutSession idempotency", () => {
  afterAll(async () => {
    await db
      .delete(subscribersTable)
      .where(eq(subscribersTable.stripeSubscriptionId, SUBSCRIPTION_ID));
    await db
      .delete(activityTable)
      .where(like(activityTable.description, `%provision-test-${RUN_ID}%`));
  });

  it("creates exactly one subscriber when provisioning races (webhook + success page)", async () => {
    const results = await Promise.all([
      provisionFromCheckoutSession(SESSION_ID),
      provisionFromCheckoutSession(SESSION_ID),
      provisionFromCheckoutSession(SESSION_ID),
    ]);

    const rows = await db
      .select()
      .from(subscribersTable)
      .where(eq(subscribersTable.stripeSubscriptionId, SUBSCRIPTION_ID));
    expect(rows).toHaveLength(1);

    const codes = results.map((r) => r?.accessCode);
    expect(codes.every((c) => c === rows[0]!.accessCode)).toBe(true);
    expect(rows[0]!.accessCode).toMatch(/^MLPA-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
    expect(rows[0]!.paymentStatus).toBe("confirmed");
    expect(rows[0]!.apps).toEqual(["MyLitAI"]);
  });

  it("returns the existing subscriber on subsequent calls", async () => {
    const again = await provisionFromCheckoutSession(SESSION_ID);
    expect(again?.alreadyExisted).toBe(true);
    const rows = await db
      .select()
      .from(subscribersTable)
      .where(eq(subscribersTable.stripeSubscriptionId, SUBSCRIPTION_ID));
    expect(rows).toHaveLength(1);
  });
});
