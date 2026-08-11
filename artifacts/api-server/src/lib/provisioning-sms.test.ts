import { describe, it, expect, vi, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

/**
 * End-to-end SMS delivery test (task: confirm texts reach buyers' phones).
 *
 * Exercises the full provisioning path from a completed Stripe checkout
 * session through to the Twilio client boundary: when the subscriber record
 * carries a phone number, provisionFromCheckoutSession must call sendSms()
 * exactly once with that phone number and the correct access-code body.
 *
 * The sms module is mocked so no real Twilio message is ever sent in CI;
 * accessCodeSmsBody stays real so the asserted copy is the production copy.
 */

const RUN_ID = randomUUID();
const SUBSCRIPTION_ID = `sub_smstest_${RUN_ID}`;
const SESSION_ID = `cs_smstest_${RUN_ID}`;
const PHONE = "+60198765432";

// Mock the Stripe client: a completed subscription checkout with a phone.
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
          customer: `cus_smstest_${RUN_ID}`,
          amount_total: 0,
          metadata: { tier: "single", trial: "true", appUrl: "https://mylitai.life" },
          customer_details: {
            email: `provision-sms-test-${RUN_ID}@example.test`,
            name: "SMS Provision Test",
            phone: PHONE,
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

// Mock ONLY sendSms (the Twilio boundary); keep the real body builder so the
// test asserts the copy customers actually receive.
vi.mock("./sms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sms")>();
  return {
    ...actual,
    sendSms: vi.fn().mockResolvedValue("sent"),
  };
});

const { provisionFromCheckoutSession } = await import("./provisioning");
const { sendSms, accessCodeSmsBody } = await import("./sms");
const { db, subscribersTable, activityTable } = await import("@workspace/db");
const { eq, like } = await import("drizzle-orm");

describe("provisioning sends the access code by SMS", () => {
  afterAll(async () => {
    await db
      .delete(subscribersTable)
      .where(eq(subscribersTable.stripeSubscriptionId, SUBSCRIPTION_ID));
    await db
      .delete(activityTable)
      .where(like(activityTable.description, `%provision-sms-test-${RUN_ID}%`));
  });

  it("calls sendSms with the buyer's phone and the access-code body", async () => {
    const result = await provisionFromCheckoutSession(SESSION_ID);
    expect(result).not.toBeNull();
    expect(result!.alreadyExisted).toBeFalsy();

    // Phone is persisted on the subscriber record.
    const [row] = await db
      .select()
      .from(subscribersTable)
      .where(eq(subscribersTable.stripeSubscriptionId, SUBSCRIPTION_ID));
    expect(row?.phone).toBe(PHONE);

    // SMS delivery runs fire-and-forget after provisioning returns — wait for it.
    await vi.waitFor(() => {
      expect(sendSms).toHaveBeenCalledTimes(1);
    });

    const [to, body] = vi.mocked(sendSms).mock.calls[0]!;
    expect(to).toBe(PHONE);
    expect(body).toBe(
      accessCodeSmsBody({ accessCode: result!.accessCode, trial: true, licenses: undefined }),
    );
    expect(body).toContain(result!.accessCode);
    expect(body).toContain("7-day free trial");
  });

  it("does not send again on an idempotent re-provision of the same session", async () => {
    const again = await provisionFromCheckoutSession(SESSION_ID);
    expect(again?.alreadyExisted).toBe(true);

    // Give any stray fire-and-forget work a beat, then assert no extra send.
    await new Promise((r) => setTimeout(r, 200));
    expect(sendSms).toHaveBeenCalledTimes(1);
  });
});
