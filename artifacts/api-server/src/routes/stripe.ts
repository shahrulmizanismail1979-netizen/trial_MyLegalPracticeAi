import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import type Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, subscribersTable } from "@workspace/db";
import {
  CreateSarawak20CheckoutBody,
  CreateSarawak20EligibilityBody,
  CreateSarawak20EligibilityResponse,
  GetSarawak20StatusResponse,
} from "@workspace/api-zod";
import {
  getUncachableStripeClient,
  getStripeMode,
  requireLiveStripeInProduction,
} from "../stripeClient";
import {
  provisionFromCheckoutSession,
  BUNDLE_TIER_CATALOG,
  isAllPortalsTier,
} from "../lib/provisioning";
import {
  attachSarawak20Checkout,
  buildSarawak20CheckoutParams,
  claimSarawak20Reservation,
  createSarawak20Eligibility,
  ensureSarawak20Price,
  getSarawak20Status,
  Sarawak20EligibilityError,
  releaseSarawak20Reservation,
  sarawak20CheckoutExpiresAt,
} from "../lib/sarawak20";

const router: IRouter = Router();

const CHECKOUT_TIERS = [
  "bundle",
  "single",
  "standard",
  ...Object.keys(BUNDLE_TIER_CATALOG),
];
type CheckoutTier = string;

const BILLING_PORTAL_ERROR =
  "We couldn't verify those subscription details. Check your access code and billing email, or contact support if your plan was arranged manually.";

const billingPortalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many attempts. Please wait a few minutes and try again.",
  },
});

const catalogPriceRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many pricing requests. Please wait a minute and try again.",
  },
});

const sarawak20CheckoutRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error:
      "Too many checkout attempts. Please wait a few minutes and try again.",
  },
});

/**
 * Stripe is the durable idempotency authority for landing checkout intents.
 * This is deliberately not a subscriber/customer deduplication mechanism:
 * anonymous purchasers have no reliable identity, and separate intent IDs
 * remain legitimate separate purchases.
 */
function landingCheckoutIdempotencyKey(intentId: string): string {
  return `lawyes-landing-checkout-v1-${intentId}`;
}

function readCheckoutIntentId(value: unknown): string {
  // The landing page sends UUIDs from crypto.randomUUID(). Keep accepting only
  // similarly unguessable-looking values when a caller supplies an ID.
  if (value === undefined || value === null || value === "") return randomUUID();
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error("Invalid checkout intent.");
  }
  return value;
}

/**
 * Allowlist of app URLs that can be used as post-checkout redirect targets.
 * Only URLs in this list are accepted — the client cannot supply arbitrary URLs.
 */
import { PORTAL_APP_BY_URL, canonicalPortalRedirect } from "@workspace/entitlements";
const ALLOWED_APP_REDIRECTS = new Set(Object.keys(PORTAL_APP_BY_URL));

/**
 * Preserve legacy appUrl metadata for entitlement provisioning while
 * returning customers to the integrated portal rather than the standalone build.
 */
function checkoutReturnRedirect(appUrl: string): string {
  return canonicalPortalRedirect(appUrl)!;
}

/**
 * Canonical origin for Stripe return URLs. Derived only from the server
 * environment — never from the client-supplied Origin header — so a public
 * checkout request cannot redirect the post-payment flow to an attacker domain.
 */
export function resolveOrigin(): string {
  const configured = process.env.LAWYES_PUBLIC_URL?.trim().replace(/\/+$/, "");
  if (configured && /^https:\/\//i.test(configured)) return configured;
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (domain) return `https://${domain}`;
  return "";
}

/** Active price id for the product tagged with the given tier metadata (from local DB cache). */
async function getActivePriceIdForTier(
  tier: CheckoutTier,
): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT pr.id AS price_id
    FROM stripe.products p
    JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
    WHERE p.active = true AND p.metadata->>'tier' = ${tier}
    ORDER BY pr.created DESC NULLS LAST
    LIMIT 1
  `);
  const row = result.rows[0] as { price_id?: string } | undefined;
  return row?.price_id ?? null;
}

/**
 * Search Stripe directly for an active price tagged with the given tier.
 * Used as a fallback when the local DB cache has stale (e.g. test-mode) data.
 */
async function findPriceInStripeForTier(
  stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>,
  tier: string,
): Promise<string | null> {
  try {
    const products = await stripe.products.search({
      query: `active:'true' AND metadata['tier']:'${tier}'`,
      limit: 1,
    });
    const product = products.data[0];
    if (!product) return null;
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 10,
    });
    // Prefer monthly recurring USD price; fall back to first active price.
    const monthly = prices.data.find(
      (p) => p.currency === "usd" && p.recurring?.interval === "month",
    );
    return monthly?.id ?? prices.data[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Team-bundle tiers are auto-provisioned in Stripe on first checkout:
 * if the synced catalog has no product tagged with the tier, create the
 * product + monthly USD price directly (idempotency keys make retries and
 * concurrent requests safe — dev and prod share one Stripe account).
 */
/**
 * Core individual tiers sold on the landing page. Auto-provisioned in live
 * Stripe the same way as team bundles — the original products only ever
 * existed in test mode, so live mode must be able to self-seed.
 */
const CORE_TIER_CATALOG: Record<
  string,
  { name: string; monthlyUsdCents: number; licenses: number }
> = {
  single: {
    name: "MyLegalPracticeAI — Single App",
    monthlyUsdCents: 2500,
    licenses: 1,
  },
  bundle: {
    name: "MyLegalPracticeAI — Complete Bundle (All Portals)",
    monthlyUsdCents: 7900,
    licenses: 1,
  },
};

async function ensureBundleTierPrice(
  tier: string,
  stripeClient?: Awaited<ReturnType<typeof getUncachableStripeClient>>,
): Promise<string | null> {
  const def = BUNDLE_TIER_CATALOG[tier] ?? CORE_TIER_CATALOG[tier];
  if (!def) return null;

  const stripe = stripeClient ?? (await getUncachableStripeClient());

  // Prefer an existing live product tagged with this tier.
  const found = await stripe.products.search({
    query: `active:'true' AND metadata['tier']:'${tier}'`,
    limit: 1,
  });
  let productId = found.data[0]?.id;

  if (!productId) {
    const product = await stripe.products.create(
      {
        name: def.name,
        metadata: { tier, licenses: String(def.licenses) },
      },
      { idempotencyKey: `mlpa-bundle-product-${tier}-v1` },
    );
    productId = product.id;
  }

  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 10,
  });
  const existing = prices.data.find(
    (p) =>
      p.currency === "usd" &&
      p.recurring?.interval === "month" &&
      p.unit_amount === def.monthlyUsdCents,
  );
  if (existing) return existing.id;

  const price = await stripe.prices.create(
    {
      product: productId,
      currency: "usd",
      unit_amount: def.monthlyUsdCents,
      recurring: { interval: "month" },
    },
    { idempotencyKey: `mlpa-bundle-price-${tier}-${def.monthlyUsdCents}-v1` },
  );
  return price.id;
}

const CATALOG_TIER_KEYS = [
  "single",
  "bundle",
  ...Object.keys(BUNDLE_TIER_CATALOG),
] as const;

type CatalogPriceResponse = {
  id: string;
  unitAmount: number;
  currency: "usd";
  recurring: { interval: "month" };
};

type CatalogPriceMap = Record<string, CatalogPriceResponse | null>;
type CatalogLookup = {
  tier: string;
  price: CatalogPriceResponse | null;
  error?: unknown;
};

const CATALOG_PRICE_CACHE_TTL_MS = 5 * 60 * 1000;
let catalogPriceCache: { data: CatalogPriceMap; expiresAt: number } | null =
  null;
let lastKnownGoodCatalog: CatalogPriceMap | null = null;
let catalogPriceRefresh: Promise<CatalogPriceMap> | null = null;
let catalogPriceGeneration = 0;

/**
 * Controlled startup/deployment seed for the complete landing-page catalog.
 * This is deliberately separate from the public read endpoint: it runs before
 * the API starts serving traffic and guarantees that a first-time visitor can
 * see a real price and use checkout. Checkout remains able to repair a missing
 * tier if a later Stripe change removes one.
 */
export async function ensureLandingCatalogPrices(): Promise<void> {
  const stripe = await getUncachableStripeClient();
  await Promise.all(
    CATALOG_TIER_KEYS.map((tier) => ensureBundleTierPrice(tier, stripe)),
  );
  invalidateCatalogPriceCache();
}

/**
 * Read a catalog tier directly from Stripe without creating or changing any
 * Stripe object. Checkout remains the only public path that auto-provisions a
 * missing price, and this reader only accepts the same exact USD amount.
 */
async function findCatalogPriceInStripe(
  stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>,
  tier: string,
): Promise<CatalogPriceResponse | null> {
  const def = BUNDLE_TIER_CATALOG[tier] ?? CORE_TIER_CATALOG[tier];
  if (!def) return null;

  const products = await stripe.products.search({
    query: `active:'true' AND metadata['tier']:'${tier}'`,
    limit: 1,
  });
  const product = products.data[0];
  if (!product) return null;

  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    limit: 10,
  });
  const price = prices.data.find(
    (candidate) =>
      candidate.currency === "usd" &&
      candidate.recurring?.interval === "month" &&
      candidate.unit_amount === def.monthlyUsdCents,
  );
  if (!price) return null;

  return {
    id: price.id,
    unitAmount: def.monthlyUsdCents,
    currency: "usd",
    recurring: { interval: "month" },
  };
}

function hasCompleteCatalog(data: CatalogPriceMap): boolean {
  return CATALOG_TIER_KEYS.every((tier) => data[tier] != null);
}

async function refreshCatalogPrices(
  generation: number,
): Promise<CatalogPriceMap> {
  const stripe = await getUncachableStripeClient();
  const results = await Promise.all(
    CATALOG_TIER_KEYS.map(async (tier): Promise<CatalogLookup> => {
      try {
        return { tier, price: await findCatalogPriceInStripe(stripe, tier) };
      } catch (error) {
        return { tier, price: null, error };
      }
    }),
  );

  const failures = results.filter((result) => result.error);
  if (failures.length > 0 && lastKnownGoodCatalog) {
    // A Stripe rate limit or transient outage must not hide prices that were
    // already verified. Serve the complete last-known-good catalog instead.
    return lastKnownGoodCatalog;
  }
  if (failures.length > 0) {
    throw new Error(
      `Stripe catalog lookup failed for ${failures.map((result) => result.tier).join(", ")}`,
    );
  }

  const data = Object.fromEntries(
    results.map((result) => [result.tier, result.price]),
  ) as CatalogPriceMap;
  if (hasCompleteCatalog(data) && generation === catalogPriceGeneration) {
    lastKnownGoodCatalog = data;
  }
  return data;
}

async function getCatalogPrices(): Promise<CatalogPriceMap> {
  if (catalogPriceCache && catalogPriceCache.expiresAt > Date.now()) {
    return catalogPriceCache.data;
  }

  if (!catalogPriceRefresh) {
    const generation = catalogPriceGeneration;
    catalogPriceRefresh = refreshCatalogPrices(generation)
      .then((data) => {
        if (generation === catalogPriceGeneration) {
          catalogPriceCache = {
            data,
            expiresAt: Date.now() + CATALOG_PRICE_CACHE_TTL_MS,
          };
        }
        return data;
      })
      .finally(() => {
        catalogPriceRefresh = null;
      });
  }
  return catalogPriceRefresh;
}

/**
 * Invalidate both fresh and fallback snapshots. Stripe webhook events call
 * this after signature verification so a replacement price cannot remain
 * visible until the normal cache TTL expires.
 */
export function invalidateCatalogPriceCache(): void {
  catalogPriceGeneration += 1;
  catalogPriceCache = null;
  catalogPriceRefresh = null;
  lastKnownGoodCatalog = null;
}

/** Test-only cache control for isolated rate-limit and concurrency coverage. */
export function resetCatalogPriceCacheForTests(
  preserveLastKnownGood = false,
): void {
  const previousLastKnownGood = lastKnownGoodCatalog;
  invalidateCatalogPriceCache();
  if (preserveLastKnownGood) {
    // Preserve the old helper's fallback behavior for tests that specifically
    // exercise transient failure handling, while still forcing a fresh read.
    lastKnownGoodCatalog = previousLastKnownGood;
  }
}

// Public: return a cached, read-only snapshot of the exact active Stripe
// prices used by checkout for every sellable landing-page tier.
router.get("/catalog-prices", catalogPriceRateLimit, async (req, res) => {
  try {
    const data = await getCatalogPrices();
    // Do not let an intermediary or browser serve a retired Stripe price.
    // Server-side caching is bounded and invalidated by Stripe webhooks.
    res.set("Cache-Control", "no-store");
    res.json({ data });
  } catch (err) {
    req.log.error({ err }, "Failed to load Stripe catalog prices");
    res.status(503).json({ error: "Pricing is temporarily unavailable." });
  }
});

// Public: list active products with their prices (for the pricing page)
router.get("/products-with-prices", async (req, res) => {
  const result = await db.execute(sql`
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.description AS product_description,
      p.metadata AS product_metadata,
      pr.id AS price_id,
      pr.unit_amount,
      pr.currency,
      pr.recurring
    FROM stripe.products p
    LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
    WHERE p.active = true
    ORDER BY pr.unit_amount NULLS LAST
  `);

  const products = new Map<string, Record<string, unknown>>();
  for (const raw of result.rows as Array<Record<string, unknown>>) {
    const productId = String(raw.product_id);
    if (!products.has(productId)) {
      products.set(productId, {
        id: productId,
        name: raw.product_name,
        description: raw.product_description,
        metadata: raw.product_metadata,
        prices: [] as Array<Record<string, unknown>>,
      });
    }
    if (raw.price_id) {
      (products.get(productId)!.prices as Array<Record<string, unknown>>).push({
        id: raw.price_id,
        unitAmount: raw.unit_amount,
        currency: raw.currency,
        recurring: raw.recurring,
      });
    }
  }

  res.json({ data: Array.from(products.values()) });
});

// Public: start a subscription checkout for a given tier
router.post("/checkout", async (req, res) => {
  const tier = req.body?.tier as string | undefined;
  const appUrl = req.body?.appUrl as string | undefined;
  const trial = req.body?.trial === true;
  let checkoutIntentId: string;
  try {
    checkoutIntentId = readCheckoutIntentId(req.body?.checkoutIntentId);
  } catch {
    res.status(400).json({ error: "Invalid checkout intent." });
    return;
  }

  if (trial && tier !== "single") {
    res
      .status(400)
      .json({ error: "Free trial is only available on the single tier." });
    return;
  }

  if (!tier || !CHECKOUT_TIERS.includes(tier as CheckoutTier)) {
    res.status(400).json({
      error: `Invalid tier. Expected one of: ${CHECKOUT_TIERS.join(", ")}`,
    });
    return;
  }

  if (appUrl !== undefined && !ALLOWED_APP_REDIRECTS.has(appUrl)) {
    res.status(400).json({ error: "Invalid appUrl." });
    return;
  }

  // Non-bundle plans cover exactly one portal. Without an appUrl the
  // provisioning step cannot tell which portal was purchased, leaving the
  // subscriber with an access code that works nowhere — so require it.
  if (!isAllPortalsTier(tier) && !appUrl) {
    res
      .status(400)
      .json({ error: "Please choose an AI portal before subscribing." });
    return;
  }

  try {
    await requireLiveStripeInProduction();
  } catch (err) {
    req.log.error(
      { err },
      "Refusing checkout because production Stripe is not in live mode",
    );
    res.status(503).json({
      error:
        "Live payment processing is temporarily unavailable. Please try again shortly.",
    });
    return;
  }

  const origin = resolveOrigin();
  const stripe = await getUncachableStripeClient();

  let priceId: string | null = null;
  if (tier in BUNDLE_TIER_CATALOG || tier in CORE_TIER_CATALOG) {
    // Catalog tiers resolve against live Stripe with an exact amount match
    // (auto-provisioning the product/price if missing). Never trust the local
    // DB cache here — it may hold stale test-mode prices or mistagged
    // products with the wrong amount.
    try {
      priceId = await ensureBundleTierPrice(tier);
      invalidateCatalogPriceCache();
    } catch (err) {
      req.log.error(
        { err, tier },
        "Failed to resolve/auto-provision Stripe tier price",
      );
    }
  } else {
    priceId = await getActivePriceIdForTier(tier as CheckoutTier);
    if (!priceId) {
      // Local DB cache may hold only test-mode data — search live Stripe directly.
      priceId = await findPriceInStripeForTier(stripe, tier);
    }
  }
  if (!priceId) {
    req.log.error({ tier }, "No active Stripe price found for tier");
    res.status(503).json({
      error:
        "Pricing is not configured yet. Please run the product seed script or contact support.",
    });
    return;
  }

  // If the caller supplied a whitelisted appUrl, encode it into the success_url
  // so the landing page can redirect the user there after payment is confirmed.
  // NOTE: {CHECKOUT_SESSION_ID} must stay literal (unencoded) — Stripe replaces
  // it with the real session id. URLSearchParams would percent-encode the braces.
  const successUrl =
    `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}` +
    (appUrl
      ? `&redirect=${encodeURIComponent(checkoutReturnRedirect(appUrl))}`
      : "");

  const buildSessionParams = (resolvedPriceId: string) => ({
    mode: "subscription" as const,
    line_items: [{ price: resolvedPriceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto" as const,
    phone_number_collection: { enabled: true },
    adaptive_pricing: { enabled: false },
    payment_method_collection: "always" as const,
    success_url: successUrl,
    cancel_url: `${origin}/?checkout=cancelled`,
    subscription_data: {
      metadata: {
        tier,
        trial: trial ? "true" : "false",
        checkout_intent_id: checkoutIntentId,
      },
      ...(trial
        ? {
            trial_period_days: 7,
            trial_settings: {
              end_behavior: { missing_payment_method: "cancel" as const },
            },
          }
        : {}),
    },
    metadata: {
      tier,
      trial: trial ? "true" : "false",
      checkout_intent_id: checkoutIntentId,
      ...(appUrl ? { appUrl } : {}),
    },
  });

  let session;
  const idempotencyKey = landingCheckoutIdempotencyKey(checkoutIntentId);
  try {
    session = await stripe.checkout.sessions.create(buildSessionParams(priceId), {
      idempotencyKey,
    });
  } catch (err: unknown) {
    const stripeErr = err as {
      code?: string;
      type?: string;
      param?: string;
      message?: string;
    };
    const isIdempotencyConflict =
      stripeErr?.code === "idempotency_error" ||
      stripeErr?.code === "idempotency_key_in_use" ||
      stripeErr?.type === "idempotency_error";
    if (isIdempotencyConflict) {
      res.status(409).json({
        code: "checkout_intent_conflict",
        error:
          "This checkout attempt was reused with different purchase details. Start a new checkout.",
      });
      return;
    }
    // The DB price may be stale (e.g. test-mode price used with a live key).
    // Fall back to searching Stripe directly for a live-mode price for this tier.
    if (stripeErr?.code === "resource_missing") {
      req.log.warn(
        { tier, priceId },
        "DB price invalid in current Stripe mode; searching Stripe directly",
      );
      const livePriceId =
        tier in BUNDLE_TIER_CATALOG || tier in CORE_TIER_CATALOG
          ? await ensureBundleTierPrice(tier).catch((e) => {
              req.log.error(
                { err: e, tier },
                "ensureBundleTierPrice failed in fallback",
              );
              return null;
            })
          : await findPriceInStripeForTier(stripe, tier);
      if (!livePriceId) {
        req.log.error(
          { tier },
          "No live-mode price found for tier after fallback search",
        );
        res.status(503).json({
          error:
            "Pricing is not configured in live mode yet. Please contact support.",
        });
        return;
      }
      invalidateCatalogPriceCache();
      try {
        // Stripe does not retain an idempotency result when the original
        // request fails validation for a missing price, so the same key is
        // safe for this exact server-side price repair. If Stripe reports a
        // parameter conflict, do not guess or create another session.
        session = await stripe.checkout.sessions.create(
          buildSessionParams(livePriceId),
          { idempotencyKey },
        );
      } catch (fallbackErr: unknown) {
        const fallbackStripeErr = fallbackErr as {
          code?: string;
          type?: string;
        };
        if (
          fallbackStripeErr?.code === "idempotency_error" ||
          fallbackStripeErr?.code === "idempotency_key_in_use" ||
          fallbackStripeErr?.type === "idempotency_error"
        ) {
          res.status(409).json({
            code: "checkout_intent_conflict",
            error:
              "This checkout attempt was reused with different purchase details. Start a new checkout.",
          });
          return;
        }
        req.log.error(
          { err: fallbackErr, tier },
          "Stripe checkout session fallback failed",
        );
        res.status(502).json({
          error: "Payment provider error. Please try again.",
        });
        return;
      }
    } else {
      req.log.error({ err, tier }, "Stripe checkout session creation failed");
      res
        .status(502)
        .json({ error: "Payment provider error. Please try again." });
      return;
    }
  }

  if (!session?.id) {
    req.log.error({ tier }, "Stripe checkout returned no session id");
    res.status(502).json({
      code: "checkout_session_unavailable",
      error: "Payment provider returned an unusable checkout session.",
    });
    return;
  }

  // Never trust a cached/local URL or silently reuse a session whose status
  // cannot be verified. Stripe's response is authoritative across restarts
  // and API instances.
  let verifiedSession: Stripe.Checkout.Session;
  try {
    verifiedSession = await stripe.checkout.sessions.retrieve(session.id);
  } catch (err) {
    req.log.error(
      { err, tier, sessionId: session.id },
      "Unable to verify Stripe checkout session",
    );
    res.status(502).json({
      code: "checkout_session_unavailable",
      error: "We could not verify the checkout session. Please try again.",
    });
    return;
  }
  if (verifiedSession.status === "expired") {
    res.status(409).json({
      code: "checkout_intent_expired",
      error:
        "This checkout session has expired. Start checkout again to continue.",
    });
    return;
  }
  if (verifiedSession.status === "complete") {
    res.status(409).json({
      code: "checkout_intent_completed",
      error:
        "This checkout session is already complete. We did not create another purchase.",
    });
    return;
  }
  if (
    verifiedSession.status !== "open" ||
    !verifiedSession.url
  ) {
    req.log.error(
      { tier, sessionId: session.id, status: verifiedSession.status },
      "Stripe checkout session is not payable",
    );
    res.status(502).json({
      code: "checkout_session_unavailable",
      error: "The checkout session is not currently available. Please try again.",
    });
    return;
  }
  res.json({ url: verifiedSession.url });
});

router.get("/sarawak20/status", async (req, res) => {
  try {
    res.json(GetSarawak20StatusResponse.parse(await getSarawak20Status()));
  } catch (err) {
    req.log.error({ err }, "Failed to read Project Sarawak 20 availability");
    res
      .status(503)
      .json({ error: "Programme availability is temporarily unavailable." });
  }
});

router.post(
  "/sarawak20/eligibility",
  sarawak20CheckoutRateLimit,
  async (req, res): Promise<void> => {
    const parsed = CreateSarawak20EligibilityBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Please complete the required eligibility details correctly.",
      });
      return;
    }
    if (parsed.data.cohort === "chambering") {
      const date = new Date(`${parsed.data.pupillageStartDate}T00:00:00.000Z`);
      if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== parsed.data.pupillageStartDate
      ) {
        res.status(400).json({ error: "Enter a valid pupillage start date." });
        return;
      }
    }
    try {
      res.json(
        CreateSarawak20EligibilityResponse.parse(
          await createSarawak20Eligibility(parsed.data),
        ),
      );
    } catch (error) {
      if (error instanceof Sarawak20EligibilityError) {
        res.status(error.code === "service-unavailable" ? 503 : 409).json({
          error:
            error.code === "service-unavailable"
              ? "The AAS directory is temporarily unavailable. Please try again."
              : "The advocate and firm could not be verified in the AAS directory.",
        });
        return;
      }
      req.log.error({ error }, "Sarawak 20 eligibility processing failed");
      res.status(503).json({
        error: "Eligibility verification is temporarily unavailable.",
      });
    }
  },
);

router.post(
  "/sarawak20/checkout",
  sarawak20CheckoutRateLimit,
  async (req, res) => {
    const parsed = CreateSarawak20CheckoutBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Choose a valid cohort and try again." });
      return;
    }
    const { cohort, requestId, eligibilityId } = parsed.data;

    try {
      await requireLiveStripeInProduction();
    } catch (err) {
      req.log.error(
        { err },
        "Refusing Sarawak 20 checkout because Stripe is not live",
      );
      res.status(503).json({
        error:
          "Live payment processing is temporarily unavailable. Please try again shortly.",
      });
      return;
    }

    let claim;
    try {
      claim = await claimSarawak20Reservation(cohort, requestId, eligibilityId);
    } catch (err) {
      req.log.error(
        { err, cohort },
        "Failed to reserve Project Sarawak 20 place",
      );
      res
        .status(503)
        .json({ error: "We could not reserve your place. Please try again." });
      return;
    }

    if (claim.kind === "sold-out") {
      res
        .status(409)
        .json({ error: "This founding cohort has filled all 20 places." });
      return;
    }
    if (claim.kind === "eligibility-required") {
      res.status(409).json({
        error:
          "Verified AAS-directory eligibility is required for this firm offer.",
      });
      return;
    }
    if (claim.kind === "reused") {
      res.json({ url: claim.url });
      return;
    }
    if (claim.kind === "pending") {
      res.status(409).json({
        error:
          "This checkout attempt is already being prepared. Please wait a moment and retry.",
      });
      return;
    }

    const origin = resolveOrigin();
    if (!origin) {
      await releaseSarawak20Reservation(claim.id);
      req.log.error(
        "Cannot create Sarawak 20 checkout without a trusted server origin",
      );
      res.status(503).json({ error: "Checkout is temporarily unavailable." });
      return;
    }

    const stripe = await getUncachableStripeClient();
    let priceId: string;
    try {
      priceId = await ensureSarawak20Price(stripe, claim.plan);
    } catch (err) {
      await releaseSarawak20Reservation(claim.id).catch(() => undefined);
      req.log.error(
        {
          cohort,
          errorType: err instanceof Error ? err.name : typeof err,
        },
        "Project Sarawak 20 price resolution failed",
      );
      res
        .status(502)
        .json({ error: "Payment provider error. Please try again." });
      return;
    }

    let session: Stripe.Checkout.Session;
    try {
      const expiresAt = sarawak20CheckoutExpiresAt();
      session = await stripe.checkout.sessions.create(
        buildSarawak20CheckoutParams({
          origin,
          priceId,
          reservationId: claim.id,
          cohort,
          plan: claim.plan,
          eligibilityId: claim.eligibilityId,
          expiresAt,
        }),
        { idempotencyKey: `sarawak20-checkout-${requestId}` },
      );
    } catch (err) {
      await releaseSarawak20Reservation(claim.id).catch(() => undefined);
      req.log.error(
        {
          cohort,
          errorType: err instanceof Error ? err.name : typeof err,
        },
        "Project Sarawak 20 checkout creation failed",
      );
      res
        .status(502)
        .json({ error: "Payment provider error. Please try again." });
      return;
    }

    if (!session.url) {
      req.log.error(
        { cohort },
        "Stripe checkout exists without a hosted URL; retaining reservation",
      );
      res
        .status(502)
        .json({ error: "Payment provider error. Please try again." });
      return;
    }

    // Once Stripe has returned a payable URL, this place must remain allocated.
    // A transient DB failure here must never release it and allow a 21st sale:
    // the session metadata lets completion consume the original reservation.
    try {
      await attachSarawak20Checkout({
        reservationId: claim.id,
        sessionId: session.id,
        url: session.url,
      });
    } catch (err) {
      req.log.error(
        {
          cohort,
          errorType: err instanceof Error ? err.name : typeof err,
        },
        "Stripe checkout exists but local attachment failed; retaining reservation",
      );
    }
    res.json({ url: session.url });
  },
);

// Public self-service billing handoff. An access code is not enough on its own:
// the purchaser's billing email must match the same subscriber row before a
// short-lived Stripe Customer Portal session is created.
router.post("/customer-portal", billingPortalRateLimit, async (req, res) => {
  const accessCode =
    typeof req.body?.accessCode === "string"
      ? req.body.accessCode.trim().toUpperCase()
      : "";
  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";
  const action = req.body?.action === "cancel" ? "cancel" : "manage";

  if (
    accessCode.length < 8 ||
    accessCode.length > 64 ||
    email.length < 3 ||
    email.length > 320 ||
    !email.includes("@")
  ) {
    res.status(400).json({ error: BILLING_PORTAL_ERROR });
    return;
  }

  const [subscriber] = await db
    .select({
      stripeCustomerId: subscribersTable.stripeCustomerId,
      stripeSubscriptionId: subscribersTable.stripeSubscriptionId,
      tier: subscribersTable.tier,
    })
    .from(subscribersTable)
    .where(
      and(
        eq(subscribersTable.accessCode, accessCode),
        sql`lower(${subscribersTable.email}) = ${email}`,
      ),
    )
    .limit(1);

  if (!subscriber?.stripeCustomerId || !subscriber.stripeSubscriptionId) {
    res.status(400).json({ error: BILLING_PORTAL_ERROR });
    return;
  }

  const origin = resolveOrigin();
  if (!origin) {
    req.log.error(
      "Cannot create billing portal session without a trusted server origin",
    );
    res
      .status(503)
      .json({ error: "Subscription management is temporarily unavailable." });
    return;
  }

  const returnUrl =
    subscriber.tier === "sarawak20"
      ? `${origin}/sarawak20/manage-subscription`
      : `${origin}/manage-subscription`;
  const params: Stripe.BillingPortal.SessionCreateParams = {
    customer: subscriber.stripeCustomerId,
    return_url: returnUrl,
  };

  if (action === "cancel") {
    params.flow_data = {
      type: "subscription_cancel",
      subscription_cancel: { subscription: subscriber.stripeSubscriptionId },
      after_completion: {
        type: "redirect",
        redirect: { return_url: `${returnUrl}?status=cancelled` },
      },
    };
  }

  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.billingPortal.sessions.create(params);
    res.json({ url: session.url });
  } catch (err) {
    req.log.error(
      { err, action },
      "Stripe billing portal session creation failed",
    );
    res.status(502).json({
      error: "Could not open subscription management. Please try again.",
    });
  }
});

// Public: fetch access details for a completed checkout session so the
// success page can show the customer their access code immediately.
// The session id itself is the bearer secret (only the purchaser has it).
router.get("/session-info", async (req, res) => {
  const sessionId = req.query.session_id;
  if (typeof sessionId !== "string" || !/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
    res.status(400).json({ error: "Invalid session_id." });
    return;
  }

  try {
    const result = await provisionFromCheckoutSession(sessionId);
    if (!result) {
      res.status(404).json({ error: "Checkout session is not complete yet." });
      return;
    }
    res.json({
      accessCode: result.accessCode,
      apps: result.apps,
      tier: result.tier,
      plan: result.plan,
      licenses: result.licenses,
      trial: result.trial,
    });
  } catch (err) {
    req.log.error(
      { errorType: err instanceof Error ? err.name : typeof err },
      "session-info lookup failed",
    );
    res.status(404).json({ error: "Checkout session not found." });
  }
});

/**
 * GET /stripe/mode
 * Returns the current Stripe mode so monitoring tools can verify the server is
 * running against live keys.  No auth required — the response contains no
 * sensitive data.
 *
 * Response: { mode: "live" | "test" }
 */
router.get("/mode", async (req, res) => {
  try {
    const mode = await getStripeMode();
    res.json({ mode });
  } catch (err) {
    req.log.error({ err }, "Failed to determine Stripe mode");
    res.status(503).json({ error: "Stripe credentials unavailable" });
  }
});

export default router;
