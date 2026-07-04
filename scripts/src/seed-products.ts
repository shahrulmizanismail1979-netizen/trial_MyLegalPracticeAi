import { getUncachableStripeClient } from "./stripeClient";

/**
 * Creates the AI Portals subscription products and monthly (MYR) recurring
 * prices in Stripe. Idempotent -- skips products that already exist (matched by
 * the `tier` metadata), so it is safe to run multiple times.
 *
 * Run with: pnpm --filter @workspace/scripts exec tsx src/seed-products.ts
 */

type TierPlan = {
  tier: "bundle" | "single" | "standard";
  name: string;
  description: string;
  amountMYR: number; // whole ringgit, per month
  coursesPerYear: number;
  insuranceEntitled: boolean;
};

const PLANS: TierPlan[] = [
  {
    tier: "bundle",
    name: "AI Portals Bundle",
    description:
      "Access to all 7 AI Portals, Prudential Takaful life insurance, and 3 free legal-skills courses/year at Commonwealth Law University (clui.life).",
    amountMYR: 249,
    coursesPerYear: 3,
    insuranceEntitled: true,
  },
  {
    tier: "single",
    name: "AI Portal — Single App",
    description:
      "Access to 1 AI Portal of choice, Prudential Takaful life insurance, and 1 free legal-skills course/year at Commonwealth Law University (clui.life).",
    amountMYR: 79,
    coursesPerYear: 1,
    insuranceEntitled: true,
  },
  {
    tier: "standard",
    name: "AI Portal — Standard",
    description:
      "Standard per-app price (101st buyer onwards). Includes Prudential Takaful life insurance and 1 free legal-skills course/year at Commonwealth Law University (clui.life).",
    amountMYR: 109,
    coursesPerYear: 1,
    insuranceEntitled: true,
  },
];

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  for (const plan of PLANS) {
    const existing = await stripe.products.search({
      query: `metadata['tier']:'${plan.tier}' AND active:'true'`,
    });

    if (existing.data.length > 0) {
      console.log(
        `Product for tier "${plan.tier}" already exists (${existing.data[0].id}). Skipping.`,
      );
      continue;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: {
        tier: plan.tier,
        coursesPerYear: String(plan.coursesPerYear),
        insuranceEntitled: String(plan.insuranceEntitled),
      },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.amountMYR * 100,
      currency: "myr",
      recurring: { interval: "month" },
      metadata: { tier: plan.tier },
    });

    console.log(
      `Created ${plan.name} (${product.id}) — RM${plan.amountMYR}/mo (${price.id})`,
    );
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
