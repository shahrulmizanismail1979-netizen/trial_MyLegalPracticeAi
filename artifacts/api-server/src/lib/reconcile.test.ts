import { describe, it, expect, vi, afterAll, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";

const RUN_ID = randomUUID();
const EMAIL_DUP = `reconcile-dup-${RUN_ID}@customer-mail.dev`;
const EMAIL_EXISTING = `reconcile-existing-${RUN_ID}@customer-mail.dev`;
const EMAIL_TEST = `agent-test-${RUN_ID}@example.com`;

const SUB_A = `sub_recA_${RUN_ID}`;
const SUB_B = `sub_recB_${RUN_ID}`;
const SUB_EXISTING = `sub_recC_${RUN_ID}`;
const SUB_TESTMAIL = `sub_recD_${RUN_ID}`;

interface FakeSession {
  id: string;
  status: string;
  mode: string;
  subscription: string;
  customer: string;
  amount_total: number;
  metadata: Record<string, string>;
  customer_details: { email: string; name: string; phone: string };
}

function makeSession(subId: string, email: string): FakeSession {
  return {
    id: `cs_rec_${subId}`,
    status: "complete",
    mode: "subscription",
    subscription: subId,
    customer: `cus_rec_${subId}`,
    amount_total: 0,
    metadata: { tier: "single", trial: "true", appUrl: "https://mylitai.life" },
    customer_details: { email, name: "Reconcile Test", phone: "" },
  };
}

const SESSIONS: Record<string, FakeSession> = {
  [SUB_A]: makeSession(SUB_A, EMAIL_DUP),
  [SUB_B]: makeSession(SUB_B, EMAIL_DUP),
  [SUB_EXISTING]: makeSession(SUB_EXISTING, EMAIL_EXISTING),
  [SUB_TESTMAIL]: makeSession(SUB_TESTMAIL, EMAIL_TEST),
};

const SUBS_BY_STATUS: Record<string, string[]> = {
  trialing: [SUB_A, SUB_B],
  active: [SUB_EXISTING],
  past_due: [SUB_TESTMAIL],
};

function asyncIterableOf(items: Array<{ id: string }>) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  };
}

vi.mock("../stripeClient", () => ({
  getStripeSync: vi.fn().mockRejectedValue(new Error("not used")),
  getUncachableStripeClient: vi.fn().mockResolvedValue({
    subscriptions: {
      list: vi.fn(({ status }: { status: string }) =>
        asyncIterableOf((SUBS_BY_STATUS[status] ?? []).map((id) => ({ id }))),
      ),
    },
    checkout: {
      sessions: {
        list: vi.fn(({ subscription }: { subscription: string }) =>
          Promise.resolve({ data: SESSIONS[subscription] ? [SESSIONS[subscription]] : [] }),
        ),
        retrieve: vi.fn((sessionId: string) => {
          const session = Object.values(SESSIONS).find((s) => s.id === sessionId);
          if (!session) throw new Error(`Unknown session ${sessionId}`);
          return Promise.resolve(session);
        }),
      },
    },
  }),
}));

const sendEmailMock = vi.fn().mockResolvedValue(true);
vi.mock("./mailer", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
  getOwnerEmail: vi.fn().mockResolvedValue(null),
}));

const { reconcileMissedProvisioning } = await import("./provisioning");
const { db, subscribersTable, activityTable } = await import("@workspace/db");
const { eq, like, inArray } = await import("drizzle-orm");

describe("reconcileMissedProvisioning", () => {
  beforeAll(async () => {
    // SUB_EXISTING already has a subscriber row — must be skipped untouched.
    await db.insert(subscribersTable).values({
      name: "Already Provisioned",
      email: EMAIL_EXISTING,
      phone: "",
      apps: ["MyLitAI"],
      tier: "single",
      paymentStatus: "confirmed",
      paymentAmount: "0",
      paymentProvider: "stripe",
      stripeSubscriptionId: SUB_EXISTING,
      accessCode: `MLPA-TESTX-${RUN_ID.slice(0, 5).toUpperCase()}`,
    });
  });

  afterAll(async () => {
    await db
      .delete(subscribersTable)
      .where(
        inArray(subscribersTable.stripeSubscriptionId, [SUB_A, SUB_B, SUB_EXISTING, SUB_TESTMAIL]),
      );
    await db.delete(activityTable).where(like(activityTable.description, `%${RUN_ID}%`));
  });

  it("provisions missed subscriptions once per email, skips existing and test emails", async () => {
    const result = await reconcileMissedProvisioning();

    // 4 checked: A provisioned; B (same email) deferred; existing skipped; test email skipped.
    expect(result.checked).toBe(4);
    expect(result.provisioned).toBe(1);
    expect(result.skipped).toBe(3);
    expect(result.errors).toBe(0);

    const dupRows = await db
      .select()
      .from(subscribersTable)
      .where(eq(subscribersTable.email, EMAIL_DUP));
    expect(dupRows).toHaveLength(1);
    expect(dupRows[0]!.accessCode).toMatch(/^MLPA-[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);

    // The pre-existing subscriber was not modified or duplicated.
    const existingRows = await db
      .select()
      .from(subscribersTable)
      .where(eq(subscribersTable.stripeSubscriptionId, SUB_EXISTING));
    expect(existingRows).toHaveLength(1);
    expect(existingRows[0]!.name).toBe("Already Provisioned");

    // No subscriber created for the test email.
    const testRows = await db
      .select()
      .from(subscribersTable)
      .where(eq(subscribersTable.email, EMAIL_TEST));
    expect(testRows).toHaveLength(0);
  });

  it("backfills the deferred same-email subscription on a second run without duplicating", async () => {
    const again = await reconcileMissedProvisioning();
    // SUB_B (deferred in run 1 by the one-email-per-run guard) is now provisioned.
    expect(again.provisioned).toBe(1);
    expect(again.errors).toBe(0);

    const dupRows = await db
      .select()
      .from(subscribersTable)
      .where(eq(subscribersTable.email, EMAIL_DUP));
    expect(dupRows).toHaveLength(2);
    expect(dupRows.filter((r) => r.stripeSubscriptionId === SUB_A)).toHaveLength(1);
    expect(dupRows.filter((r) => r.stripeSubscriptionId === SUB_B)).toHaveLength(1);

    // A third run provisions nothing — fully idempotent once caught up.
    const third = await reconcileMissedProvisioning();
    expect(third.provisioned).toBe(0);
    expect(third.errors).toBe(0);
  });
});
