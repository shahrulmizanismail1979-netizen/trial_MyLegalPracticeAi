import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { getUncachableStripeClient } from "../stripeClient";
import {
  provisionFromCheckoutSession,
  BUNDLE_TIER_CATALOG,
  isAllPortalsTier,
} from "../lib/provisioning";

const router: IRouter = Router();

const CHECKOUT_TIERS = ["bundle", "single", "standard", ...Object.keys(BUNDLE_TIER_CATALOG)];
type CheckoutTier = string;

/**
 * Allowlist of app URLs that can be used as post-checkout redirect targets.
 * Only URLs in this list are accepted — the client cannot supply arbitrary URLs.
 */
const ALLOWED_APP_REDIRECTS = new Set([
  "https://mylitai.life",
  "https://mylitai.life/irac/",
  "https://mysyalitai.life",
  "https://mycorpai.life",
  "/mycorplegalai/",
  "https://myconveyai.life",
  "/myconveylitai/",
  "https://mycrimai.life/",
  "/mycrimai/",
  "https://myccblitai.life/",
  "https://myaccidentai.life/",
  "/myaccidentai/",
]);

/**
 * Canonical origin for Stripe return URLs. Derived only from the server
 * environment — never from the client-supplied Origin header — so a public
 * checkout request cannot redirect the post-payment flow to an attacker domain.
 */
function resolveOrigin(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (domain) return `https://${domain}`;
  return "";
}

/** Active price id for the product tagged with the given tier metadata. */
async function getActivePriceIdForTier(tier: CheckoutTier): Promise<string | null> {
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
 * Team-bundle tiers are auto-provisioned in Stripe on first checkout:
 * if the synced catalog has no product tagged with the tier, create the
 * product + monthly USD price directly (idempotency keys make retries and
 * concurrent requests safe — dev and prod share one Stripe account).
 */
async function ensureBundleTierPrice(tier: string): Promise<string | null> {
  const def = BUNDLE_TIER_CATALOG[tier];
  if (!def) return null;

  const stripe = await getUncachableStripeClient();

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

  const prices = await stripe.prices.list({ product: productId, active: true, limit: 10 });
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

  if (trial && tier !== "single") {
    res.status(400).json({ error: "Free trial is only available on the single tier." });
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
    res.status(400).json({ error: "Please choose an AI portal before subscribing." });
    return;
  }

  let priceId = await getActivePriceIdForTier(tier as CheckoutTier);
  if (!priceId && tier in BUNDLE_TIER_CATALOG) {
    try {
      priceId = await ensureBundleTierPrice(tier);
    } catch (err) {
      req.log.error({ err, tier }, "Failed to auto-provision Stripe bundle tier");
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

  const origin = resolveOrigin();
  const stripe = await getUncachableStripeClient();

  // If the caller supplied a whitelisted appUrl, encode it into the success_url
  // so the landing page can redirect the user there after payment is confirmed.
  // NOTE: {CHECKOUT_SESSION_ID} must stay literal (unencoded) — Stripe replaces
  // it with the real session id. URLSearchParams would percent-encode the braces.
  const successUrl =
    `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}` +
    (appUrl ? `&redirect=${encodeURIComponent(appUrl)}` : "");

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    // Collect the customer's phone number so the access code can also be
    // sent by SMS immediately after checkout.
    phone_number_collection: { enabled: true },
    // Disable Stripe Adaptive Pricing so checkout always shows USD
    // instead of auto-converting to the customer's local currency (e.g. MYR).
    adaptive_pricing: { enabled: false },
    // For trials: always collect a card upfront so the subscription
    // auto-converts to a paid plan when the trial ends unless cancelled.
    payment_method_collection: "always",
    success_url: successUrl,
    cancel_url: `${origin}/?checkout=cancelled`,
    subscription_data: {
      metadata: { tier, trial: trial ? "true" : "false" },
      ...(trial
        ? {
            trial_period_days: 7,
            trial_settings: {
              end_behavior: { missing_payment_method: "cancel" },
            },
          }
        : {}),
    },
    metadata: { tier, trial: trial ? "true" : "false", ...(appUrl ? { appUrl } : {}) },
  });

  res.json({ url: session.url });
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
      trial: result.trial,
    });
  } catch (err) {
    req.log.error({ err, sessionId }, "session-info lookup failed");
    res.status(404).json({ error: "Checkout session not found." });
  }
});

export default router;
