import { describe, it, expect, vi, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

/**
 * Total delivery failure test (task: flag buyers who received neither text nor
 * email so staff can send the code manually).
 *
 * Worst case for a paying buyer: sendSms resolves "failed" AND sendEmail
 * resolves false. Provisioning must write BOTH an "sms_failed" and an
 * "email_failed" activity row for the same access code, and the email_failed
 * description must carry the access code and buyer email so staff can send
 * the code manually.
 */

const RUN_ID = randomUUID();
const SUB = `sub_totalfail_${RUN_ID}`;
const SES = `cs_totalfail_${RUN_ID}`;
const PHONE = "+60125556666";
const EMAIL = `provision-totalfail-${RUN_ID}@example.test`;

vi.mock("../stripeClient", () => ({
  getStripeSync: vi.fn().mockRejectedValue(new Error("not used")),
  getUncachableStripeClient: vi.fn().mockResolvedValue({
    checkout: {
      sessions: {
        retrieve: vi.fn().mockImplementation(async (id: string) => {
          if (id !== SES) throw new Error(`unexpected session ${id}`);
          return {
            id: SES,
            status: "complete",
            mode: "subscription",
            subscription: SUB,
            customer: `cus_totalfail_${RUN_ID}`,
            amount_total: 0,
            metadata: { tier: "single", trial: "true", appUrl: "https://mylitai.life" },
            customer_details: { email: EMAIL, name: "Total Failure Test", phone: PHONE },
          };
        }),
      },
    },
  }),
}));

vi.mock("./mailer", () => ({
  sendEmail: vi.fn().mockResolvedValue(false),
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
const { sendEmail } = await import("./mailer");
const { db, subscribersTable, activityTable } = await import("@workspace/db");
const { eq, like, and } = await import("drizzle-orm");

async function activityRows(type: string, accessCode: string) {
  return db
    .select()
    .from(activityTable)
    .where(and(eq(activityTable.type, type), like(activityTable.description, `%${accessCode}%`)));
}

describe("provisioning flags buyers who received neither SMS nor email", () => {
  afterAll(async () => {
    await db.delete(subscribersTable).where(eq(subscribersTable.stripeSubscriptionId, SUB));
    await db.delete(activityTable).where(like(activityTable.description, `%${RUN_ID}%`));
  });

  it("writes both sms_failed and email_failed activity rows for the same access code", async () => {
    const result = await provisionFromCheckoutSession(SES);
    const accessCode = result?.accessCode;
    if (!accessCode) throw new Error("provisioning returned no access code");

    // Delivery is fire-and-forget — wait for both activity rows to land.
    await vi.waitFor(async () => {
      const smsRows = await activityRows("sms_failed", accessCode);
      expect(smsRows.length).toBe(1);
      expect(smsRows[0]!.description).toContain(PHONE);

      const emailRows = await activityRows("email_failed", accessCode);
      expect(emailRows.length).toBe(1);
      // Staff need the access code and buyer email to act manually.
      expect(emailRows[0]!.description).toContain(accessCode);
      expect(emailRows[0]!.description).toContain(EMAIL);
    });

    // Sanity: the buyer email send was attempted (and mocked to fail).
    const call = vi.mocked(sendEmail).mock.calls.find(([args]) => args.to === EMAIL);
    expect(call).toBeDefined();
  });
});
