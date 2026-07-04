import { getUncachableStripeClient } from "./stripeClient";

/**
 * Creates (or migrates) the AI Portals subscription products and monthly (USD)
 * recurring prices in Stripe. Idempotent -- products are matched by the `tier`
 * metadata, and each product is ensured to have exactly one active monthly USD
 * price at the target amount. Any pre-existing price in another currency/amount
 * (e.g. the earlier MYR prices) is deactivated. Safe to run multiple times.
 *
 * Run with: pnpm --filter @workspace/scripts exec tsx src/seed-products.ts
 */

const CURRENCY = "usd";

type TierPlan = {
  tier: "bundle" | "single" | "standard";
  name: string;
  description: string;
  amountUSD: number; // whole US dollars, per month
  coursesPerYear: number;
  insuranceEntitled: boolean;
};

const PLANS: TierPlan[] = [
  {
    tier: "bundle",
    name: "AI Portals Bundle",
    description:
      "Access to all 7 AI Portals, Prudential Takaful life insurance, and 3 free legal-skills courses/year at Commonwealth Law University (clui.life).",
    amountUSD: 53,
    coursesPerYear: 3,
    insuranceEntitled: true,
  },
  {
    tier: "single",
    name: "AI Portal — Single App",
    description:
      "Access to 1 AI Portal of choice, Prudential Takaful life insurance, and 1 free legal-skills course/year at Commonwealth Law University (clui.life).",
    amountUSD: 17,
    coursesPerYear: 1,
    insuranceEntitled: true,
  },
  {
    tier: "standard",
    name: "AI Portal — Standard",
    description:
      "Standard per-app price (101st buyer onwards). Includes Prudential Takaful life insurance and 1 free legal-skills course/year at Commonwealth Law University (clui.life).",
    amountUSD: 23,
    coursesPerYear: 1,
    insuranceEntitled: true,
  },
];

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  for (const plan of PLANS) {
    const desiredAmount = plan.amountUSD * 100;

    // Find or create the product by tier metadata.
    const existing = await stripe.products.search({
      query: `metadata['tier']:'${plan.tier}' AND active:'true'`,
    });

    let product = existing.data[0];
    if (!product) {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: {
          tier: plan.tier,
          coursesPerYear: String(plan.coursesPerYear),
          insuranceEntitled: String(plan.insuranceEntitled),
        },
      });
      console.log(`Created product ${plan.name} (${product.id}).`);
    }

    // Inspect existing prices for this product.
    const prices = await stripe.prices.list({ product: product.id, limit: 100 });
    const match = prices.data.find(
      (p) =>
        p.active &&
        p.currency === CURRENCY &&
        p.unit_amount === desiredAmount &&
        p.recurring?.interval === "month",
    );

    // The price we want to keep active: an existing match, or a newly created one.
    let targetPriceId: string;
    if (match) {
      targetPriceId = match.id;
      console.log(
        `Tier "${plan.tier}" already has active ${CURRENCY.toUpperCase()} price ${match.id} ($${plan.amountUSD}/mo).`,
      );
    } else {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: desiredAmount,
        currency: CURRENCY,
        recurring: { interval: "month" },
        metadata: { tier: plan.tier },
      });
      targetPriceId = price.id;
      console.log(
        `Set ${plan.name} (${product.id}) — $${plan.amountUSD}/mo (${price.id}).`,
      );
    }

    // Deactivate every other active price on this product (e.g. old MYR prices),
    // guaranteeing exactly one active target price per tier.
    for (const p of prices.data) {
      if (p.active && p.id !== targetPriceId) {
        await stripe.prices.update(p.id, { active: false });
        console.log(`  Deactivated old price ${p.id} (${p.currency.toUpperCase()}).`);
      }
    }
  }

  console.log("Done. Webhooks will sync these into the stripe schema.");
}

createProducts().catch((error: unknown) => {
  console.error(
    "Error creating products:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
