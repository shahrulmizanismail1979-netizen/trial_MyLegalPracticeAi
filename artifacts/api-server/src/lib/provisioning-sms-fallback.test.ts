import { describe, it, expect, vi, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

/**
 * SMS fallback tests (task: confirm buyers still get their code when a text
 * message fails).
 *
 * Provisioning treats SMS as best-effort. These tests verify the two failure
 * modes of the fire-and-forget delivery block:
 *  - sendSms resolves "failed"        → an "sms_failed" activity row is written
 *  - sendSms resolves "not_configured" → an "sms_skipped" activity row is written
 * and in BOTH cases the buyer email is still sent carrying the access code.
 */

const RUN_ID = randomUUID();
const SUB_FAILED = `sub_smsfall_f_${RUN_ID}`;
const SES_FAILED = `cs_smsfall_f_${RUN_ID}`;
const SUB_SKIPPED = `sub_smsfall_s_${RUN_ID}`;
const SES_SKIPPED = `cs_smsfall_s_${RUN_ID}`;
const PHONE = "+60123334444";
const EMAIL_FAILED = `provision-smsfall-failed-${RUN_ID}@example.test`;
const EMAIL_SKIPPED = `provision-smsfall-skipped-${RUN_ID}@example.test`;

function makeSession(id: string, subscription: string, email: string) {
  return {
    id,
    status: "complete",
    mode: "subscription",
    subscription,
    customer: `cus_smsfall_${RUN_ID}`,
    amount_total: 0,
    metadata: { tier: "single", trial: "true", appUrl: "https://mylitai.life" },
    customer_details: { email, name: "SMS Fallback Test", phone: PHONE },
  };
}

vi.mock("../stripeClient", () => ({
  getStripeSync: vi.fn().mockRejectedValue(new Error("not used")),
  getUncachableStripeClient: vi.fn().mockResolvedValue({
    checkout: {
      sessions: {
        retrieve: vi.fn().mockImplementation(async (id: string) => {
          if (id === SES_FAILED) return makeSession(SES_FAILED, SUB_FAILED, EMAIL_FAILED);
          if (id === SES_SKIPPED) return makeSession(SES_SKIPPED, SUB_SKIPPED, EMAIL_SKIPPED);
          throw new Error(`unexpected session ${id}`);
        }),
      },
    },
  }),
}));

vi.mock("./mailer", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  getOwnerEmail: vi.fn().mockResolvedValue(null),
}));

vi.mock("./sms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sms")>();
  return {
    ...actual,
    sendSms: vi.fn().mockResolvedValue("failed"),
  };
});

const { provisionFromCheckoutSession } = await import("./provisioning");
const { sendSms } = await import("./sms");
const { sendEmail } = await import("./mailer");
const { db, subscribersTable, activityTable } = await import("@workspace/db");
const { eq, like, and } = await import("drizzle-orm");

async function activityRows(type: string, accessCode: string) {
  return db
    .select()
    .from(activityTable)
    .where(and(eq(activityTable.type, type), like(activityTable.description, `%${accessCode}%`)));
}

describe("provisioning falls back to email when SMS fails", () => {
  afterAll(async () => {
    for (const sub of [SUB_FAILED, SUB_SKIPPED]) {
      await db.delete(subscribersTable).where(eq(subscribersTable.stripeSubscriptionId, sub));
    }
    await db
      .delete(activityTable)
      .where(like(activityTable.description, `%provision-smsfall-%${RUN_ID}%`));
    // activity rows referencing the access code but not the email
    await db.delete(activityTable).where(like(activityTable.description, `%${RUN_ID}%`));
  });

  it('writes an sms_failed activity row and still emails the access code when sendSms returns "failed"', async () => {
    vi.mocked(sendSms).mockResolvedValue("failed");

    const result = await provisionFromCheckoutSession(SES_FAILED);
    const accessCode = result?.accessCode;
    if (!accessCode) throw new Error("provisioning returned no access code");

    // Delivery is fire-and-forget — wait for the activity row to land.
    await vi.waitFor(async () => {
      const rows = await activityRows("sms_failed", accessCode);
      expect(rows.length).toBe(1);
      expect(rows[0]!.description).toContain(PHONE);
      expect(rows[0]!.description).toContain(EMAIL_FAILED);
    });

    // Email still carries the access code to the buyer.
    await vi.waitFor(() => {
      const call = vi
        .mocked(sendEmail)
        .mock.calls.find(([args]) => args.to === EMAIL_FAILED);
      expect(call).toBeDefined();
      expect(call![0].html).toContain(accessCode);
    });

    // No sms_skipped row for this session.
    expect((await activityRows("sms_skipped", accessCode)).length).toBe(0);
  });

  it('writes an sms_skipped activity row and still emails the access code when sendSms returns "not_configured"', async () => {
    vi.mocked(sendSms).mockResolvedValue("not_configured");

    const result = await provisionFromCheckoutSession(SES_SKIPPED);
    const accessCode = result?.accessCode;
    if (!accessCode) throw new Error("provisioning returned no access code");

    await vi.waitFor(async () => {
      const rows = await activityRows("sms_skipped", accessCode);
      expect(rows.length).toBe(1);
      expect(rows[0]!.description).toContain(PHONE);
      expect(rows[0]!.description).toContain(EMAIL_SKIPPED);
    });

    await vi.waitFor(() => {
      const call = vi
        .mocked(sendEmail)
        .mock.calls.find(([args]) => args.to === EMAIL_SKIPPED);
      expect(call).toBeDefined();
      expect(call![0].html).toContain(accessCode);
    });

    expect((await activityRows("sms_failed", accessCode)).length).toBe(0);
  });
});
