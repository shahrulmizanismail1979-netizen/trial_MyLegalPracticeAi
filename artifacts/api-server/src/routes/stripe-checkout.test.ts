// POST /api/stripe/checkout must carry the requested plan tier into the
// Stripe checkout session's metadata and charge the right product/price.
// If a change drops or misspells `metadata.tier`, buyers would pay but get
// an access code that unlocks nothing — provisioning tests can't catch that
// because they mock the session with the tier already set.
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";

type CreatedSessionArgs = Record<string, any>;

const state = vi.hoisted(() => ({
  // Every stripe.checkout.sessions.create call's args, in order.
  sessionsCreated: [] as CreatedSessionArgs[],
  // Products/prices "created" through the mocked Stripe client during
  // bundle auto-provisioning, keyed by generated id.
  createdProducts: new Map<string, { name: string; metadata: Record<string, string> }>(),
  createdPrices: new Map<
    string,
    { product: string; currency: string; unit_amount: number; recurring: { interval: string } }
  >(),
  counter: 0,
}));

vi.mock("../stripeClient", () => ({
  getStripeSync: vi.fn().mockRejectedValue(new Error("not used in this test")),
  getUncachableStripeClient: vi.fn().mockResolvedValue({
    products: {
      // Auto-provisioning first searches live Stripe for a product tagged
      // with the tier. Return whatever this test run already "created" so
      // the flow behaves like the real (idempotent) one.
      search: vi.fn().mockImplementation(async ({ query }: { query: string }) => {
        const tier = /metadata\['tier'\]:'([^']+)'/.exec(query)?.[1];
        for (const [id, p] of state.createdProducts) {
          if (p.metadata.tier === tier) return { data: [{ id }] };
        }
        return { data: [] };
      }),
      create: vi.fn().mockImplementation(async (args: any) => {
        const id = `prod_test_${++state.counter}`;
        state.createdProducts.set(id, { name: args.name, metadata: args.metadata });
        return { id, ...args };
      }),
    },
    prices: {
      list: vi.fn().mockImplementation(async ({ product }: { product: string }) => ({
        data: [...state.createdPrices.entries()]
          .filter(([, p]) => p.product === product)
          .map(([id, p]) => ({ id, ...p })),
      })),
      create: vi.fn().mockImplementation(async (args: any) => {
        const id = `price_test_${++state.counter}`;
        state.createdPrices.set(id, {
          product: args.product,
          currency: args.currency,
          unit_amount: args.unit_amount,
          recurring: args.recurring,
        });
        return { id, ...args };
      }),
    },
    checkout: {
      sessions: {
        create: vi.fn().mockImplementation(async (args: CreatedSessionArgs) => {
          state.sessionsCreated.push(args);
          return { id: `cs_test_${++state.counter}`, url: "https://checkout.stripe.test/session" };
        }),
      },
    },
  }),
}));

const { default: app } = await import("../app");
const { BUNDLE_TIER_CATALOG } = await import("../lib/provisioning");
const { db } = await import("@workspace/db");

// At least one tier per family (firm / corp / edu). firm-practice and
// corp-startup typically have no synced Stripe product in the dev DB, so
// they exercise the auto-provisioning path; the others may resolve from
// the synced stripe.* tables.
const TIERS = [
  "firm-boutique",
  "firm-practice",
  "corp-startup",
  "corp-growth",
  "edu-faculty-starter",
  "edu-campus",
] as const;

/**
 * Given the price id the route put on the session, verify it points at a
 * product tagged with `tier` and a monthly USD price matching the catalog —
 * whether the price came from the mocked Stripe client (auto-provisioned)
 * or from the synced stripe.* tables in the live DB.
 */
async function assertPriceMatchesCatalog(priceId: string, tier: string): Promise<void> {
  const def = BUNDLE_TIER_CATALOG[tier];
  expect(def).toBeDefined();

  const mockPrice = state.createdPrices.get(priceId);
  if (mockPrice) {
    expect(mockPrice.currency).toBe("usd");
    expect(mockPrice.unit_amount).toBe(def.monthlyUsdCents);
    expect(mockPrice.recurring).toEqual({ interval: "month" });
    const product = state.createdProducts.get(mockPrice.product);
    expect(product).toBeDefined();
    expect(product!.metadata.tier).toBe(tier);
    expect(product!.metadata.licenses).toBe(String(def.licenses));
    expect(product!.name).toBe(def.name);
    return;
  }

  // Price came from the synced catalog: verify the DB row agrees with the
  // canonical catalog (catches price/tier drift between Stripe and code).
  const result = await db.execute(sql`
    SELECT pr.unit_amount, pr.currency, pr.recurring->>'interval' AS interval,
           p.metadata->>'tier' AS tier
    FROM stripe.prices pr
    JOIN stripe.products p ON p.id = pr.product
    WHERE pr.id = ${priceId}
  `);
  const row = result.rows[0] as
    | { unit_amount: string | number; currency: string; interval: string; tier: string }
    | undefined;
  expect(row, `price ${priceId} not found in stripe.prices`).toBeDefined();
  expect(row!.tier).toBe(tier);
  expect(row!.currency).toBe("usd");
  expect(Number(row!.unit_amount)).toBe(def.monthlyUsdCents);
  expect(row!.interval).toBe("month");
}

describe("POST /api/stripe/checkout carries the plan tier", () => {
  beforeEach(() => {
    state.sessionsCreated.length = 0;
  });

  for (const tier of TIERS) {
    it(`creates a session with metadata.tier=${tier} and the catalog price`, async () => {
      const res = await request(app).post("/api/stripe/checkout").send({ tier });

      expect(res.status).toBe(200);
      expect(res.body.url).toBe("https://checkout.stripe.test/session");
      expect(state.sessionsCreated).toHaveLength(1);

      const session = state.sessionsCreated[0];
      // The tier the buyer clicked must reach the session metadata verbatim —
      // provisioning reads it to decide which apps/seats the code unlocks.
      expect(session.metadata?.tier).toBe(tier);
      // And the subscription itself must be tagged too (used on renewal/cancel).
      expect(session.subscription_data?.metadata?.tier).toBe(tier);

      expect(session.mode).toBe("subscription");
      expect(session.line_items).toHaveLength(1);
      expect(session.line_items[0].quantity).toBe(1);
      await assertPriceMatchesCatalog(session.line_items[0].price, tier);
    });
  }

  it("rejects an unknown tier with a 4xx and creates no session", async () => {
    const res = await request(app)
      .post("/api/stripe/checkout")
      .send({ tier: "firm-boutiqe" }); // misspelled

    expect(res.status).toBe(400);
    expect(state.sessionsCreated).toHaveLength(0);
  });

  it("rejects a missing tier with a 4xx", async () => {
    const res = await request(app).post("/api/stripe/checkout").send({});
    expect(res.status).toBe(400);
    expect(state.sessionsCreated).toHaveLength(0);
  });
});
