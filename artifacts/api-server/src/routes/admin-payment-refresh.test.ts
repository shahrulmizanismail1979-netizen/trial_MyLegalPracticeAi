import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import { eq, sql } from "drizzle-orm";
import { db, subscribersTable } from "@workspace/db";

const state = vi.hoisted(() => ({
  auth: { userId: null as string | null },
  users: {} as Record<
    string,
    {
      emailAddresses: Array<{ id: string; emailAddress: string }>;
      primaryEmailAddressId: string | null;
    }
  >,
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => state.auth,
  clerkClient: {
    users: {
      getUser: async (id: string) => {
        const user = state.users[id];
        if (!user) throw new Error(`user ${id} not found`);
        return user;
      },
    },
  },
}));

const { default: app } = await import("../app");

const RUN_ID = crypto.randomUUID().slice(0, 8);
const SUB_ID = `sub_paytest_${RUN_ID}`;
const EMAIL = `payrefresh-${RUN_ID}@test.example`;
const INVOICE_A = `in_paytestA_${RUN_ID}`;
const INVOICE_B = `in_paytestB_${RUN_ID}`;

function signInAsStaff(): void {
  state.auth = { userId: "user_staff" };
  state.users["user_staff"] = {
    emailAddresses: [{ id: "email_1", emailAddress: "staff@example.com" }],
    primaryEmailAddressId: "email_1",
  };
}

async function insertInvoice(params: {
  id: string;
  amountPaid: number;
  created: number;
  status?: string;
}): Promise<void> {
  // All regular columns in stripe.invoices are generated from _raw_data.
  const raw = JSON.stringify({
    id: params.id,
    status: params.status ?? "paid",
    amount_paid: params.amountPaid,
    created: params.created,
    parent: { subscription_details: { subscription: SUB_ID } },
  });
  // Resolve a valid account ID: prefer an existing invoice's account, then
  // fall back to any row in stripe.accounts (populated by the Stripe sync).
  // Never hard-code 'acct_test' — it may not exist after test-data cleanup.
  await db.execute(sql`
    INSERT INTO stripe.invoices (_account_id, _raw_data)
    VALUES (
      COALESCE(
        (SELECT _account_id FROM stripe.invoices LIMIT 1),
        (SELECT id FROM stripe.accounts LIMIT 1)
      ),
      ${raw}::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET _raw_data = EXCLUDED._raw_data
  `);
}

beforeEach(() => {
  state.auth = { userId: null };
  state.users = {};
  process.env.ADMIN_ALLOWED_EMAILS = "staff@example.com";
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM stripe.invoices WHERE id IN (${INVOICE_A}, ${INVOICE_B})`);
  await db.delete(subscribersTable).where(eq(subscribersTable.email, EMAIL));
});

describe("GET /api/admin/subscribers payment refresh from Stripe invoices", () => {
  it("updates a trial subscriber's amount and date from the latest paid invoice", async () => {
    const [sub] = await db
      .insert(subscribersTable)
      .values({
        name: `Pay Refresh ${RUN_ID}`,
        email: EMAIL,
        phone: "0000000000",
        apps: ["MyLitAI"],
        paymentStatus: "confirmed",
        paymentAmount: "0.00",
        stripeSubscriptionId: SUB_ID,
      })
      .returning();

    // Trial conversion: first real paid invoice ($25.00, promo could make it differ)
    const firstPaidAt = 1_784_000_000;
    await insertInvoice({ id: INVOICE_A, amountPaid: 2500, created: firstPaidAt });

    signInAsStaff();
    const res = await request(app).get("/api/admin/subscribers");
    expect(res.status).toBe(200);
    const row = res.body.find((s: { id: number }) => s.id === sub!.id);
    expect(row.paymentAmount).toBe("25.00");
    expect(new Date(row.paymentDate).getTime()).toBe(firstPaidAt * 1000);

    // Same-amount renewal a month later: date must still refresh.
    const renewalPaidAt = firstPaidAt + 30 * 24 * 3600;
    await insertInvoice({ id: INVOICE_B, amountPaid: 2500, created: renewalPaidAt });

    const res2 = await request(app).get("/api/admin/subscribers");
    const row2 = res2.body.find((s: { id: number }) => s.id === sub!.id);
    expect(row2.paymentAmount).toBe("25.00");
    expect(new Date(row2.paymentDate).getTime()).toBe(renewalPaidAt * 1000);
  });
});
