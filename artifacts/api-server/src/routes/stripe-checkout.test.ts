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
  productSearches: 0,
  failingTiers: new Set<string>(),
  sessionsByIdempotencyKey: new Map<string, { id: string; url: string }>(),
  sessionParamsByIdempotencyKey: new Map<string, string>(),
  sessionStatuses: new Map<string, "open" | "complete" | "expired">(),
  sessionIdempotencyKeys: [] as Array<string | undefined>,
  retrieveError: false,
}));

vi.mock("../stripeClient", () => ({
  getStripeSync: vi.fn().mockRejectedValue(new Error("not used in this test")),
  requireLiveStripeInProduction: vi.fn().mockResolvedValue(undefined),
  getUncachableStripeClient: vi.fn().mockResolvedValue({
    products: {
      // Auto-provisioning first searches live Stripe for a product tagged
      // with the tier. Return whatever this test run already "created" so
      // the flow behaves like the real (idempotent) one.
      search: vi.fn().mockImplementation(async ({ query }: { query: string }) => {
        const tier = /metadata\['tier'\]:'([^']+)'/.exec(query)?.[1];
        state.productSearches += 1;
        if (tier && state.failingTiers.has(tier)) {
          throw new Error("Stripe rate limit");
        }
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
        create: vi.fn().mockImplementation(async (
          args: CreatedSessionArgs,
          options?: { idempotencyKey?: string },
        ) => {
          state.sessionIdempotencyKeys.push(options?.idempotencyKey);
          if (options?.idempotencyKey) {
            const prior = state.sessionsByIdempotencyKey.get(options.idempotencyKey);
            const params = JSON.stringify(args);
            const priorParams = state.sessionParamsByIdempotencyKey.get(
              options.idempotencyKey,
            );
            if (prior && priorParams !== params) {
              const error = new Error("Keys for different parameters");
              Object.assign(error, {
                code: "idempotency_error",
                type: "idempotency_error",
              });
              throw error;
            }
            if (prior) return prior;
            state.sessionParamsByIdempotencyKey.set(options.idempotencyKey, params);
          }
          state.sessionsCreated.push(args);
          const session = {
            id: `cs_test_${++state.counter}`,
            url: `https://checkout.stripe.test/session`,
          };
          if (options?.idempotencyKey) {
            state.sessionsByIdempotencyKey.set(options.idempotencyKey, session);
          }
          state.sessionStatuses.set(session.id, "open");
          return session;
        }),
        retrieve: vi.fn().mockImplementation(async (id: string) => {
          if (state.retrieveError) throw new Error("Stripe retrieve unavailable");
          const session = [...state.sessionsByIdempotencyKey.values()].find(
            (candidate) => candidate.id === id,
          );
          return {
            id,
            url: session?.url ?? "https://checkout.stripe.test/session",
            status: state.sessionStatuses.get(id) ?? "open",
          };
        }),
      },
    },
  }),
}));

const { default: app } = await import("../app");
const {
  ensureLandingCatalogPrices,
  invalidateCatalogPriceCache,
  resetCatalogPriceCacheForTests,
} = await import("./stripe");
const { BUNDLE_TIER_CATALOG } = await import("../lib/provisioning");
const { db } = await import("@workspace/db");
const stripeClient = await import("../stripeClient");

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
const CATALOG_TIERS = [
  "single",
  "bundle",
  "firm-boutique",
  "firm-practice",
  "firm-firm",
  "corp-startup",
  "corp-growth",
  "corp-corporate",
  "edu-faculty-starter",
  "edu-faculty-plus",
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
    state.createdProducts.clear();
    state.createdPrices.clear();
    state.counter = 0;
    state.productSearches = 0;
    state.failingTiers.clear();
    state.sessionsByIdempotencyKey.clear();
    state.sessionParamsByIdempotencyKey.clear();
    state.sessionStatuses.clear();
    state.sessionIdempotencyKeys.length = 0;
    state.retrieveError = false;
    vi.mocked(stripeClient.requireLiveStripeInProduction).mockResolvedValue(undefined);
    resetCatalogPriceCacheForTests();
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

  it("returns the same Stripe price IDs and USD amounts that checkout uses for every sellable tier", async () => {
    // Checkout is the controlled auto-provisioning path. Seed every tier first
    // so the public catalog read can prove it does not create Stripe records.
    for (const tier of CATALOG_TIERS) {
      const seedResponse = await request(app)
        .post("/api/stripe/checkout")
        .send(tier === "single" ? { tier, appUrl: "/mylitai/" } : { tier });
      expect(seedResponse.status, `seed checkout failed for ${tier}`).toBe(200);
    }

    const catalogResponse = await request(app).get("/api/stripe/catalog-prices");

    expect(catalogResponse.status).toBe(200);
    const catalog = catalogResponse.body.data as Record<
      string,
      { id: string; unitAmount: number; currency: string; recurring: { interval: string } }
    >;

    for (const tier of CATALOG_TIERS) {
      const catalogPrice = catalog[tier];
      expect(catalogPrice, `catalog price missing for ${tier}`).toBeDefined();
      expect(catalogPrice.currency).toBe("usd");
      expect(catalogPrice.recurring).toEqual({ interval: "month" });

      const expectedAmount =
        tier === "single"
          ? 2500
          : tier === "bundle"
            ? 7900
            : BUNDLE_TIER_CATALOG[tier]!.monthlyUsdCents;
      expect(catalogPrice.unitAmount).toBe(expectedAmount);

      const checkoutResponse = await request(app)
        .post("/api/stripe/checkout")
        .send(tier === "single" ? { tier, appUrl: "/mylitai/" } : { tier });
      expect(checkoutResponse.status, `checkout failed for ${tier}`).toBe(200);

      const checkoutSession = state.sessionsCreated.at(-1);
      expect(checkoutSession?.line_items[0]?.price).toBe(catalogPrice.id);
      expect(checkoutSession?.metadata?.tier).toBe(tier);
    }
  });

  it("seeds every sellable tier before a fresh landing page can need its first checkout", async () => {
    await ensureLandingCatalogPrices();

    expect(state.createdProducts.size).toBe(CATALOG_TIERS.length);
    expect(state.createdPrices.size).toBe(CATALOG_TIERS.length);

    const catalogResponse = await request(app).get("/api/stripe/catalog-prices");
    expect(catalogResponse.status).toBe(200);
    for (const tier of CATALOG_TIERS) {
      expect(catalogResponse.body.data[tier], `seeded catalog price missing for ${tier}`).toMatchObject({
        currency: "usd",
        recurring: { interval: "month" },
      });
    }
  });

  it("coalesces concurrent read-only catalog requests without provisioning missing tiers", async () => {
    const searchesBefore = state.productSearches;
    const [first, second] = await Promise.all([
      request(app).get("/api/stripe/catalog-prices"),
      request(app).get("/api/stripe/catalog-prices"),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(state.createdProducts.size).toBe(0);
    expect(state.createdPrices.size).toBe(0);
    expect(state.productSearches - searchesBefore).toBe(CATALOG_TIERS.length);
    expect(first.body.data).toEqual(second.body.data);
    expect(first.body.data.single).toBeNull();
  });

  it("drops a retired price snapshot after an active Stripe price replacement", async () => {
    await ensureLandingCatalogPrices();
    const beforeReplacement = await request(app).get("/api/stripe/catalog-prices");
    const retiredPrice = beforeReplacement.body.data["corp-growth"];
    const retiredRecord = state.createdPrices.get(retiredPrice.id);
    expect(retiredRecord).toBeDefined();

    state.createdPrices.delete(retiredPrice.id);
    state.createdPrices.set("price_replacement_corp_growth", {
      product: retiredRecord!.product,
      currency: "usd",
      unit_amount: retiredRecord!.unit_amount,
      recurring: { interval: "month" },
    });
    invalidateCatalogPriceCache();

    const afterReplacement = await request(app).get("/api/stripe/catalog-prices");
    expect(afterReplacement.status).toBe(200);
    expect(afterReplacement.headers["cache-control"]).toBe("no-store");
    expect(afterReplacement.body.data["corp-growth"].id).toBe("price_replacement_corp_growth");

    const checkoutResponse = await request(app).post("/api/stripe/checkout").send({ tier: "corp-growth" });
    expect(checkoutResponse.status).toBe(200);
    expect(state.sessionsCreated.at(-1)?.line_items[0]?.price).toBe("price_replacement_corp_growth");
  });

  it("keeps last-known-good prices visible during a transient Stripe rate limit", async () => {
    for (const tier of CATALOG_TIERS) {
      const seedResponse = await request(app)
        .post("/api/stripe/checkout")
        .send(tier === "single" ? { tier, appUrl: "/mylitai/" } : { tier });
      expect(seedResponse.status, `seed checkout failed for ${tier}`).toBe(200);
    }

    const healthyResponse = await request(app).get("/api/stripe/catalog-prices");
    expect(healthyResponse.status).toBe(200);
    const knownPrice = healthyResponse.body.data["corp-growth"];

    resetCatalogPriceCacheForTests(true);
    state.failingTiers.add("corp-growth");
    const rateLimitedResponse = await request(app).get("/api/stripe/catalog-prices");

    expect(rateLimitedResponse.status).toBe(200);
    expect(rateLimitedResponse.body.data["corp-growth"]).toEqual(knownPrice);
    expect(rateLimitedResponse.body.data["firm-boutique"]).toEqual(
      healthyResponse.body.data["firm-boutique"],
    );

    // A failed public catalog refresh must not alter checkout's controlled
    // provisioning path or leave a buyer unable to subscribe.
    state.failingTiers.clear();
    const checkoutResponse = await request(app).post("/api/stripe/checkout").send({ tier: "corp-growth" });
    expect(checkoutResponse.status).toBe(200);
    expect(state.sessionsCreated.at(-1)?.line_items[0]?.price).toBe(knownPrice.id);
  });

  it("rate-limits the public catalog endpoint", async () => {
    const responses = await Promise.all(
      Array.from({ length: 70 }, () => request(app).get("/api/stripe/catalog-prices")),
    );
    const throttled = responses.find((response) => response.status === 429);

    expect(throttled).toBeDefined();
    expect(throttled?.body.error).toMatch(/too many pricing requests/i);
  });

  it("rejects an unknown tier with a 4xx and creates no session", async () => {
    const res = await request(app)
      .post("/api/stripe/checkout")
      .send({ tier: "firm-boutiqe" }); // misspelled

    expect(res.status).toBe(400);
    expect(state.sessionsCreated).toHaveLength(0);
  });

  it("refuses to create a checkout session when production Stripe is not live", async () => {
    vi.mocked(stripeClient.requireLiveStripeInProduction).mockRejectedValueOnce(
      new Error("Stripe is not configured for live payments."),
    );

    const res = await request(app)
      .post("/api/stripe/checkout")
      .send({ tier: "single", appUrl: "https://mycorpai.life" });

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/live payment processing/i);
    expect(state.sessionsCreated).toHaveLength(0);
  });

  it("returns legacy MyCrimAI checkouts to the integrated portal without changing entitlement metadata", async () => {
    const res = await request(app)
      .post("/api/stripe/checkout")
      .send({ tier: "single", appUrl: "https://mycrimai.life/" });

    expect(res.status).toBe(200);
    expect(state.sessionsCreated).toHaveLength(1);
    expect(state.sessionsCreated[0]?.success_url).toMatch(
      /\/\?checkout=success&session_id=\{CHECKOUT_SESSION_ID\}&redirect=%2Fmycrimai%2F$/,
    );
    expect(state.sessionsCreated[0]).toMatchObject({
      metadata: {
        tier: "single",
        appUrl: "https://mycrimai.life/",
      },
    });
  });

  it("rejects a missing tier with a 4xx", async () => {
    const res = await request(app).post("/api/stripe/checkout").send({});
    expect(res.status).toBe(400);
    expect(state.sessionsCreated).toHaveLength(0);
  });

  it("reuses one pending checkout intent and Stripe idempotency key on a retry", async () => {
    const checkoutIntentId = "11111111-1111-4111-8111-111111111111";
    const first = await request(app)
      .post("/api/stripe/checkout")
      .send({ tier: "single", appUrl: "/mylitai/", checkoutIntentId });
    const second = await request(app)
      .post("/api/stripe/checkout")
      .send({ tier: "single", appUrl: "/mylitai/", checkoutIntentId });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.url).toBe(first.body.url);
    expect(state.sessionsCreated).toHaveLength(1);
    expect(state.sessionIdempotencyKeys).toHaveLength(2);
    expect(state.sessionIdempotencyKeys[0]).toMatch(
      new RegExp(`lawyes-landing-checkout-v1-${checkoutIntentId}$`),
    );
    expect(state.sessionIdempotencyKeys[1]).toBe(state.sessionIdempotencyKeys[0]);
  });

  it("does not bind an intent to a changed tier or portal selection", async () => {
    const checkoutIntentId = "22222222-2222-4222-8222-222222222222";
    const first = await request(app)
      .post("/api/stripe/checkout")
      .send({ tier: "single", appUrl: "/mylitai/", checkoutIntentId });
    const changed = await request(app)
      .post("/api/stripe/checkout")
      .send({ tier: "single", appUrl: "/mycrimai/", checkoutIntentId });

    expect(first.status).toBe(200);
    expect(changed.status).toBe(409);
    expect(state.sessionsCreated).toHaveLength(1);
  });

  it("reports an expired session and requires a new client intent", async () => {
    const checkoutIntentId = "33333333-3333-4333-8333-333333333333";
    const body = { tier: "single", appUrl: "/mylitai/", checkoutIntentId };
    const first = await request(app).post("/api/stripe/checkout").send(body);
    const firstSessionId = [...state.sessionStatuses.keys()][0];
    state.sessionStatuses.set(firstSessionId, "expired");

    const second = await request(app).post("/api/stripe/checkout").send(body);

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("checkout_intent_expired");
    expect(state.sessionsCreated).toHaveLength(1);
    expect(state.sessionIdempotencyKeys[0]).toBe(state.sessionIdempotencyKeys[1]);
  });

  it("does not return a stale URL when Stripe session verification is unavailable", async () => {
    const checkoutIntentId = "55555555-5555-4555-8555-555555555555";
    const body = { tier: "single", appUrl: "/mylitai/", checkoutIntentId };
    const first = await request(app).post("/api/stripe/checkout").send(body);
    state.retrieveError = true;
    const retry = await request(app).post("/api/stripe/checkout").send(body);

    expect(first.status).toBe(200);
    expect(retry.status).toBe(502);
    expect(retry.body.code).toBe("checkout_session_unavailable");
    expect(retry.body.url).toBeUndefined();
    state.retrieveError = false;
  });

  it("does not recreate a completed checkout session", async () => {
    const checkoutIntentId = "66666666-6666-4666-8666-666666666666";
    const body = { tier: "single", appUrl: "/mylitai/", checkoutIntentId };
    const first = await request(app).post("/api/stripe/checkout").send(body);
    const sessionId = [...state.sessionStatuses.keys()][0];
    state.sessionStatuses.set(sessionId, "complete");
    const retry = await request(app).post("/api/stripe/checkout").send(body);

    expect(first.status).toBe(200);
    expect(retry.status).toBe(409);
    expect(retry.body.code).toBe("checkout_intent_completed");
    expect(state.sessionsCreated).toHaveLength(1);
  });

  it("coalesces concurrent retries through Stripe idempotency", async () => {
    const checkoutIntentId = "77777777-7777-4777-8777-777777777777";
    const body = { tier: "single", appUrl: "/mylitai/", checkoutIntentId };
    const [one, two] = await Promise.all([
      request(app).post("/api/stripe/checkout").send(body),
      request(app).post("/api/stripe/checkout").send(body),
    ]);

    expect(one.status).toBe(200);
    expect(two.status).toBe(200);
    expect(one.body.url).toBe(two.body.url);
    expect(state.sessionsCreated).toHaveLength(1);
    expect(state.sessionIdempotencyKeys).toHaveLength(2);
    expect(state.sessionIdempotencyKeys[0]).toBe(state.sessionIdempotencyKeys[1]);
  });

  it("replays Stripe's durable idempotency result after a route-module restart", async () => {
    const checkoutIntentId = "44444444-4444-4444-8444-444444444444";
    const body = { tier: "single", appUrl: "/mylitai/", checkoutIntentId };
    const first = await request(app).post("/api/stripe/checkout").send(body);

    // A fresh route module has no process-local checkout state by design.
    // Stripe's idempotency result is the cross-instance/restart safeguard.
    vi.resetModules();
    const { default: restartedApp } = await import("../app");
    const second = await request(restartedApp).post("/api/stripe/checkout").send(body);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.url).toBe(first.body.url);
    expect(state.sessionsCreated).toHaveLength(1);
    expect(state.sessionIdempotencyKeys[1]).toBe(state.sessionIdempotencyKeys[0]);
  });
});
