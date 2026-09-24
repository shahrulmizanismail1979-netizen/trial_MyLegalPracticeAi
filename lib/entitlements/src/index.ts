export * from "./portals";
/**
 * Shared entitlements: subscription tiers, feature gating, and pricing.
 * Imported by both the API server (gating) and the web client (pricing UI,
 * feature locks). Keep this dependency-free so it stays portable.
 */

export const PURCHASABLE_TIERS = [
  "starter",
  "practitioner",
  "advocate",
  "chambers",
] as const;
export type PurchasableTier = (typeof PURCHASABLE_TIERS)[number];

/** "full" is reserved for legacy / admin-issued codes (unrestricted access). */
export type Tier = PurchasableTier | "full";

export const AI_TOOLS = [
  "legal-research",
  "case-analyzer",
  "charge-analyzer",
  "document-drafter",
  "sentencing",
  "legal-opinion",
  "case-strategy",
  "appeal-grounds",
  "cross-examination",
  "witness-practice",
  "judge-practice",
] as const;
export type AiToolId = (typeof AI_TOOLS)[number];

/** AI tools whose interactive/oral output is voiced by ElevenLabs (Advocate+). */
export const ORAL_AI_TOOLS: AiToolId[] = [
  "witness-practice",
  "judge-practice",
  "cross-examination",
];

export interface TierDefinition {
  id: Tier;
  name: string;
  tagline: string;
  /** Base monthly price in USD (major units). Other currencies derived via FX. */
  monthlyUsd: number;
  /** "all" means every AI tool; otherwise the explicit allow-list. */
  aiTools: AiToolId[] | "all";
  /** Realistic ElevenLabs character voices for oral practice. */
  voice: boolean;
  /** Number of access codes (seats) issued on purchase. */
  seats: number;
  /** Marketing highlights for the pricing card. */
  highlights: string[];
  /** Most popular badge on the pricing page. */
  popular?: boolean;
}

export const TIER_DEFINITIONS: Record<Tier, TierDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "Core research, for getting started",
    monthlyUsd: 19,
    aiTools: ["legal-research", "case-analyzer", "charge-analyzer"],
    voice: false,
    seats: 1,
    highlights: [
      "Full reference library & legal glossary",
      "AI Legal Research",
      "Case Fact Analyzer",
      "Charge Sheet Analyzer",
      "Single practitioner seat",
    ],
  },
  practitioner: {
    id: "practitioner",
    name: "Practitioner",
    tagline: "The complete AI text toolkit",
    monthlyUsd: 39,
    aiTools: "all",
    voice: false,
    seats: 1,
    popular: true,
    highlights: [
      "Everything in Starter",
      "All 11 AI tools (drafting, sentencing, opinions, strategy, appeals)",
      "Document Drafter & Legal Opinion Writer",
      "Case Strategy & Appeal Grounds Analyzer",
      "Witness & Judge practice (text)",
    ],
  },
  advocate: {
    id: "advocate",
    name: "Advocate",
    tagline: "Realistic voice oral-practice",
    monthlyUsd: 79,
    aiTools: "all",
    voice: true,
    seats: 1,
    highlights: [
      "Everything in Practitioner",
      "Realistic AI voices for oral practice",
      "Speak with the judge, witness & opposing counsel",
      "Oral submissions & witness examination out loud",
      "Distinct character voices per persona",
    ],
  },
  chambers: {
    id: "chambers",
    name: "Chambers",
    tagline: "For firms & chambers",
    monthlyUsd: 149,
    aiTools: "all",
    voice: true,
    seats: 5,
    highlights: [
      "Everything in Advocate",
      "5 practitioner seats for your chambers",
      "Realistic voice oral-practice for the whole team",
      "Priority AI processing",
      "Early access to new tools",
    ],
  },
  full: {
    id: "full",
    name: "Full Access",
    tagline: "Unrestricted access",
    monthlyUsd: 0,
    aiTools: "all",
    voice: true,
    seats: 1,
    highlights: ["Unrestricted access to every feature"],
  },
};

export type BillingInterval = "month" | "year";

export interface CurrencyDefinition {
  code: string;
  symbol: string;
  label: string;
}

export const CURRENCIES: CurrencyDefinition[] = [
  { code: "usd", symbol: "$", label: "USD" },
  { code: "eur", symbol: "€", label: "EUR" },
  { code: "gbp", symbol: "£", label: "GBP" },
  { code: "myr", symbol: "RM", label: "MYR" },
  { code: "sgd", symbol: "S$", label: "SGD" },
  { code: "aud", symbol: "A$", label: "AUD" },
  { code: "cad", symbol: "C$", label: "CAD" },
];

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

export const DEFAULT_CURRENCY: CurrencyCode = "usd";

/** Approximate FX multipliers from USD. Used to derive nice round prices. */
const FX: Record<string, number> = {
  usd: 1,
  eur: 0.92,
  gbp: 0.79,
  myr: 4.7,
  sgd: 1.35,
  aud: 1.52,
  cad: 1.37,
};

/** All listed currencies use 2 decimal places. */
const MINOR_UNIT_FACTOR = 100;

export function isPurchasableTier(value: unknown): value is PurchasableTier {
  return (
    typeof value === "string" &&
    (PURCHASABLE_TIERS as readonly string[]).includes(value)
  );
}

export function normalizeTier(value: unknown): Tier {
  if (value === "full") return "full";
  return isPurchasableTier(value) ? value : "full";
}

/**
 * Grandfather cutoff for the tiered subscription packages.
 *
 * Access codes created strictly BEFORE this instant predate the new packages
 * and are granted unrestricted ("full") access for life. The tiered packages
 * (Starter/Practitioner/Advocate/Chambers) only apply to codes created on or
 * after this cutoff (i.e. new purchasers).
 *
 * Set to the end of the week of 2026-06-02 in Malaysia time (UTC+8): all codes
 * issued through Sunday 2026-06-07 (MYT) are grandfathered. Change this single
 * constant to move the boundary.
 */
export const GRANDFATHER_CUTOFF = new Date("2026-06-08T00:00:00+08:00");

/**
 * True if an access code created at `createdAt` predates the tiered packages.
 *
 * A missing or unparsable timestamp is treated as grandfathered: new-purchaser
 * codes are always inserted with a real `createdAt`, so any code lacking one can
 * only be a legacy/migrated row, which must keep full access for life.
 */
export function isGrandfathered(
  createdAt: Date | string | number | null | undefined,
): boolean {
  if (createdAt === null || createdAt === undefined) return true;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return true;
  return t < GRANDFATHER_CUTOFF.getTime();
}

/**
 * Resolve the effective tier for an access code, applying grandfathering.
 * Codes created before {@link GRANDFATHER_CUTOFF} always resolve to "full".
 */
export function effectiveTier(
  rawTier: unknown,
  createdAt: Date | string | number | null | undefined,
): Tier {
  if (isGrandfathered(createdAt)) return "full";
  return normalizeTier(rawTier);
}

export function isCurrency(value: unknown): value is CurrencyCode {
  return (
    typeof value === "string" && CURRENCIES.some((c) => c.code === value)
  );
}

/** Price in major currency units (e.g. dollars), rounded to a whole unit. */
export function priceMajor(
  tier: PurchasableTier,
  interval: BillingInterval,
  currency: CurrencyCode,
): number {
  const fx = FX[currency] ?? 1;
  const monthly = TIER_DEFINITIONS[tier].monthlyUsd * fx;
  const total = interval === "year" ? monthly * 10 : monthly;
  return Math.round(total);
}

/** Price in the currency's minor unit (e.g. cents) for Stripe. */
export function priceMinor(
  tier: PurchasableTier,
  interval: BillingInterval,
  currency: CurrencyCode,
): number {
  return priceMajor(tier, interval, currency) * MINOR_UNIT_FACTOR;
}

export function formatPrice(
  tier: PurchasableTier,
  interval: BillingInterval,
  currency: CurrencyCode,
): string {
  const def = CURRENCIES.find((c) => c.code === currency) ?? CURRENCIES[0];
  return `${def.symbol}${priceMajor(tier, interval, currency).toLocaleString()}`;
}

export function tierHasTool(tier: Tier, toolId: AiToolId): boolean {
  const tools = TIER_DEFINITIONS[tier].aiTools;
  return tools === "all" || tools.includes(toolId);
}

export function tierHasVoice(tier: Tier): boolean {
  return TIER_DEFINITIONS[tier].voice;
}

export function tierSeats(tier: Tier): number {
  return TIER_DEFINITIONS[tier].seats;
}

/** Entitlements snapshot sent to the client after auth. */
export interface Entitlements {
  tier: Tier;
  tierName: string;
  voice: boolean;
  aiTools: AiToolId[];
}

export function entitlementsFor(tier: Tier): Entitlements {
  const def = TIER_DEFINITIONS[tier];
  return {
    tier,
    tierName: def.name,
    voice: def.voice,
    aiTools: def.aiTools === "all" ? [...AI_TOOLS] : [...def.aiTools],
  };
}

/** Stripe product metadata key used to map a product back to a tier. */
export const STRIPE_TIER_METADATA_KEY = "mycrimai_tier";
