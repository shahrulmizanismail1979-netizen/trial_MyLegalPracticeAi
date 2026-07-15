import { describe, it, expect, vi, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

const RUN_ID = randomUUID();
const SUBSCRIPTION_ID = `sub_cancel_${RUN_ID}`;
const ACCESS_CODE = `MLPA-CANCL-${RUN_ID.slice(0, 5).toUpperCase()}`;

vi.mock("../stripeClient", () => ({
  getStripeSync: vi.fn().mockRejectedValue(new Error("not used")),
  getUncachableStripeClient: vi.fn().mockRejectedValue(new Error("not used")),
}));

vi.mock("./mailer", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  getOwnerEmail: vi.fn().mockResolvedValue(null),
}));

const { syncPortalAccessCodes, handleSubscriptionCancelled } = await import("./provisioning");
const { db, subscribersTable, activityTable, litAccessCodes, ccbAccessCodes } = await import(
  "@workspace/db"
);
const { eq, like } = await import("drizzle-orm");

describe("subscription cancellation deactivates portal access", () => {
  afterAll(async () => {
    await db.delete(litAccessCodes).where(eq(litAccessCodes.code, ACCESS_CODE));
    await db.delete(ccbAccessCodes).where(eq(ccbAccessCodes.code, ACCESS_CODE));
    await db
      .delete(subscribersTable)
      .where(eq(subscribersTable.stripeSubscriptionId, SUBSCRIPTION_ID));
    await db.delete(activityTable).where(like(activityTable.description, `%cancel-test-${RUN_ID}%`));
  });

  it("marks the subscriber cancelled and switches off portal codes", async () => {
    const [subscriber] = await db
      .insert(subscribersTable)
      .values({
        name: `cancel-test-${RUN_ID}`,
        email: `cancel-test-${RUN_ID}@example.test`,
        phone: "",
        apps: ["MyLitAI", "MyCCBLitAI"],
        tier: "single",
        paymentStatus: "confirmed",
        paymentAmount: "0.00",
        accessCode: ACCESS_CODE,
        stripeSubscriptionId: SUBSCRIPTION_ID,
      })
      .returning();
    expect(subscriber).toBeDefined();

    await syncPortalAccessCodes(subscriber!);

    const [litBefore] = await db
      .select()
      .from(litAccessCodes)
      .where(eq(litAccessCodes.code, ACCESS_CODE));
    expect(litBefore?.status).toBe("active");

    await handleSubscriptionCancelled(SUBSCRIPTION_ID);

    const [updated] = await db
      .select()
      .from(subscribersTable)
      .where(eq(subscribersTable.id, subscriber!.id));
    expect(updated?.paymentStatus).toBe("cancelled");

    const [litAfter] = await db
      .select()
      .from(litAccessCodes)
      .where(eq(litAccessCodes.code, ACCESS_CODE));
    expect(litAfter?.status).toBe("inactive");

    const [ccbAfter] = await db
      .select()
      .from(ccbAccessCodes)
      .where(eq(ccbAccessCodes.code, ACCESS_CODE));
    expect(ccbAfter?.active).toBe(false);
  });

  it("re-runs deactivation on repeat webhook deliveries (retry-safe)", async () => {
    // Manually flip lit back on to simulate a portal that failed the first pass.
    await db
      .update(litAccessCodes)
      .set({ status: "active" })
      .where(eq(litAccessCodes.code, ACCESS_CODE));

    await handleSubscriptionCancelled(SUBSCRIPTION_ID);

    const [lit] = await db.select().from(litAccessCodes).where(eq(litAccessCodes.code, ACCESS_CODE));
    expect(lit?.status).toBe("inactive");
  });

  it("is a no-op for unknown subscription ids", async () => {
    await expect(handleSubscriptionCancelled(`sub_missing_${RUN_ID}`)).resolves.toBeUndefined();
  });
});
