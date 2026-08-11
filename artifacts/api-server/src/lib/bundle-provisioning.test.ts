// Team-bundle provisioning: a completed checkout for the new firm/corp/edu
// tiers must create one subscriber (idempotent), unlock every portal,
// grant the licensed seat count on MyAccidentAI, and deactivate all portal
// codes when the Stripe subscription is cancelled.
import { describe, it, expect, vi, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

const RUN_ID = randomUUID();

// One tier per family (firm / corp / edu).
const TIERS = ["firm-boutique", "corp-growth", "edu-campus"] as const;

const sessionId = (tier: string) => `cs_bundle_${tier}_${RUN_ID}`;
const subscriptionId = (tier: string) => `sub_bundle_${tier}_${RUN_ID}`;

// Mock the Stripe client: sessions.retrieve returns a completed team-bundle
// checkout session for whichever tier's session id is requested.
vi.mock("../stripeClient", () => ({
  getStripeSync: vi.fn().mockRejectedValue(new Error("not used")),
  getUncachableStripeClient: vi.fn().mockResolvedValue({
    checkout: {
      sessions: {
        retrieve: vi.fn().mockImplementation(async (id: string) => {
          const tier = TIERS.find((t) => id === sessionId(t));
          if (!tier) throw new Error(`unexpected session id ${id}`);
          return {
            id,
            status: "complete",
            mode: "subscription",
            subscription: subscriptionId(tier),
            customer: `cus_bundle_${tier}_${RUN_ID}`,
            amount_total: 0,
            metadata: { tier },
            customer_details: {
              email: `bundle-test-${tier}-${RUN_ID}@example.test`,
              name: `Bundle Test ${tier}`,
              phone: "+60123456789",
            },
          };
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

const { provisionFromCheckoutSession, handleSubscriptionCancelled, BUNDLE_TIER_CATALOG, ALL_APP_NAMES } =
  await import("./provisioning");
const {
  db,
  subscribersTable,
  activityTable,
  usersTable,
  accessCodesTable,
  crimAccessCodesTable,
  corpAccessCodes,
  litAccessCodes,
  ccbAccessCodes,
} = await import("@workspace/db");
const { accessCodesTable: syaAccessCodesTable } = await import("@workspace/db/sya");
const { firmAccessCodesTable } = await import("@workspace/db/firm");
const { eq, like, inArray } = await import("drizzle-orm");

async function subscriberFor(tier: string) {
  const rows = await db
    .select()
    .from(subscribersTable)
    .where(eq(subscribersTable.stripeSubscriptionId, subscriptionId(tier)));
  return rows;
}

describe("team-bundle checkout provisioning (one tier per family)", () => {
  afterAll(async () => {
    const rows = await db
      .select()
      .from(subscribersTable)
      .where(
        inArray(
          subscribersTable.stripeSubscriptionId,
          TIERS.map((t) => subscriptionId(t)),
        ),
      );
    const codes = rows.map((r) => r.accessCode).filter((c): c is string => !!c);
    if (codes.length > 0) {
      await db.delete(usersTable).where(inArray(usersTable.accessCode, codes));
      await db.delete(accessCodesTable).where(inArray(accessCodesTable.code, codes));
      await db.delete(crimAccessCodesTable).where(inArray(crimAccessCodesTable.code, codes));
      await db.delete(corpAccessCodes).where(inArray(corpAccessCodes.code, codes));
      await db.delete(litAccessCodes).where(inArray(litAccessCodes.code, codes));
      await db.delete(syaAccessCodesTable).where(inArray(syaAccessCodesTable.code, codes));
      await db.delete(ccbAccessCodes).where(inArray(ccbAccessCodes.code, codes));
      await db.delete(firmAccessCodesTable).where(inArray(firmAccessCodesTable.code, codes));
    }
    await db
      .delete(subscribersTable)
      .where(
        inArray(
          subscribersTable.stripeSubscriptionId,
          TIERS.map((t) => subscriptionId(t)),
        ),
      );
    await db.delete(activityTable).where(like(activityTable.description, `%${RUN_ID}%`));
  });

  for (const tier of TIERS) {
    it(`${tier}: provisions once, unlocks all portals, seats MyAccidentAI with licensed count`, async () => {
      // Simulate the webhook + success-page race: provisioning must be idempotent.
      const results = await Promise.all([
        provisionFromCheckoutSession(sessionId(tier)),
        provisionFromCheckoutSession(sessionId(tier)),
      ]);

      const rows = await subscriberFor(tier);
      expect(rows).toHaveLength(1);
      const subscriber = rows[0]!;

      expect(results.every((r) => r?.accessCode === subscriber.accessCode)).toBe(true);
      expect(subscriber.accessCode).toMatch(/^MLPA-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
      expect(subscriber.paymentStatus).toBe("confirmed");
      expect(subscriber.tier).toBe(tier);

      // A team bundle covers every portal.
      expect([...subscriber.apps].sort()).toEqual([...ALL_APP_NAMES].sort());

      const code = subscriber.accessCode!;

      // Portal code sync: the code must be active on each portal table.
      const [accident] = await db
        .select()
        .from(accessCodesTable)
        .where(eq(accessCodesTable.code, code));
      expect(accident?.isActive).toBe(true);
      // MyAccidentAI seat cap = licensed seats of the tier.
      expect(accident?.maxUsers).toBe(BUNDLE_TIER_CATALOG[tier]!.licenses);

      const [lit] = await db.select().from(litAccessCodes).where(eq(litAccessCodes.code, code));
      expect(lit?.status).toBe("active");
      const [crim] = await db
        .select()
        .from(crimAccessCodesTable)
        .where(eq(crimAccessCodesTable.code, code));
      expect(crim?.isActive).toBe(true);
      const [corp] = await db.select().from(corpAccessCodes).where(eq(corpAccessCodes.code, code));
      expect(corp?.isActive).toBe(true);
      const [sya] = await db
        .select()
        .from(syaAccessCodesTable)
        .where(eq(syaAccessCodesTable.code, code));
      expect(sya?.isActive).toBe(true);
      const [ccb] = await db.select().from(ccbAccessCodes).where(eq(ccbAccessCodes.code, code));
      expect(ccb?.active).toBe(true);
      const [firm] = await db
        .select()
        .from(firmAccessCodesTable)
        .where(eq(firmAccessCodesTable.code, code));
      expect(firm?.isActive).toBe(true);
      const [convey] = await db.select().from(usersTable).where(eq(usersTable.accessCode, code));
      expect(convey?.isActive).toBe(true);
    });

    it(`${tier}: repeat provisioning returns the existing subscriber`, async () => {
      const again = await provisionFromCheckoutSession(sessionId(tier));
      expect(again?.alreadyExisted).toBe(true);
      expect((await subscriberFor(tier))).toHaveLength(1);
    });

    it(`${tier}: cancellation deactivates the code on every portal`, async () => {
      await handleSubscriptionCancelled(subscriptionId(tier));

      const [subscriber] = await subscriberFor(tier);
      expect(subscriber?.paymentStatus).toBe("cancelled");
      const code = subscriber!.accessCode!;

      const [accident] = await db
        .select()
        .from(accessCodesTable)
        .where(eq(accessCodesTable.code, code));
      expect(accident?.isActive).toBe(false);
      const [lit] = await db.select().from(litAccessCodes).where(eq(litAccessCodes.code, code));
      expect(lit?.status).toBe("inactive");
      const [crim] = await db
        .select()
        .from(crimAccessCodesTable)
        .where(eq(crimAccessCodesTable.code, code));
      expect(crim?.isActive).toBe(false);
      const [corp] = await db.select().from(corpAccessCodes).where(eq(corpAccessCodes.code, code));
      expect(corp?.isActive).toBe(false);
      const [sya] = await db
        .select()
        .from(syaAccessCodesTable)
        .where(eq(syaAccessCodesTable.code, code));
      expect(sya?.isActive).toBe(false);
      const [ccb] = await db.select().from(ccbAccessCodes).where(eq(ccbAccessCodes.code, code));
      expect(ccb?.active).toBe(false);
      const [firm] = await db
        .select()
        .from(firmAccessCodesTable)
        .where(eq(firmAccessCodesTable.code, code));
      expect(firm?.isActive).toBe(false);
      const [convey] = await db.select().from(usersTable).where(eq(usersTable.accessCode, code));
      expect(convey?.isActive).toBe(false);
      expect(convey?.subscriptionStatus).toBe("canceled");
    });
  }
});
