// Shared tier capability definitions for MYCorpLegalAI.
// Pure TypeScript — NO node/db dependencies, so the frontend can import this safely.
// This is the single source of truth for tier ranks, plan metadata, and tool access.

export const ACCESS_TIERS = ["legacy_full", "student", "practitioner", "firm"] as const;
export type AccessTier = (typeof ACCESS_TIERS)[number];

// Paid tiers that can be purchased via Stripe (excludes legacy_full).
export const PURCHASABLE_TIERS = ["student", "practitioner", "firm"] as const;
export type PurchasableTier = (typeof PURCHASABLE_TIERS)[number];

// Grandfather cutoff: every access code created on/before this instant gets permanent FULL access.
// Sunday 7 June 2026 23:59:59 (+08).
export const GRANDFATHER_CUTOFF = new Date("2026-06-07T23:59:59+08:00");

// Higher rank = more access. legacy_full unlocks everything.
export const TIER_RANK: Record<AccessTier, number> = {
  student: 1,
  practitioner: 2,
  firm: 3,
  legacy_full: 99,
};

export function tierRank(tier: AccessTier): number {
  return TIER_RANK[tier] ?? 0;
}

// ---- Tool → minimum tier mapping -------------------------------------------

// Side-panel chat tools available to Student tier.
export const STUDENT_TOOL_IDS = [
  "tutor",
  "drafter",
  "checklist",
  "deadline-calculator",
  "case-finder",
] as const;

// Remaining side-panel chat tools (Practitioner+).
export const PRACTITIONER_SIDE_PANEL_TOOL_IDS = [
  "risk-scanner",
  "document-analyzer",
  "minutes-drafter",
  "contract-review",
  "compliance-advisor",
] as const;

// Dedicated practitioner tools (Practitioner+).
export const PRACTITIONER_TOOL_IDS = [
  "legal-opinion",
  "transaction-advisor",
  "dd-report",
  "spa-reviewer",
  "board-resolution",
  "macc-17a",
  "ssm-filing",
  "stamp-duty",
  "compliance-calendar",
  "client-letter",
  "sha-builder",
  "aml-checker",
  "corporate-secretary",
  "ipo-readiness",
  "employment-advisor",
  "cross-border",
  "dispute-resolution",
  "islamic-finance",
  "negotiation-points",
] as const;

// Practice simulators (Firm only).
export const SIMULATOR_TOOL_IDS = [
  "negotiation-simulator",
  "mediation-simulator",
  "arbitration-simulator",
  "client-consultation-trainer",
  "board-presentation-simulator",
] as const;

// Build the canonical tool -> minimum tier map.
export const TOOL_MIN_TIER: Record<string, AccessTier> = (() => {
  const map: Record<string, AccessTier> = {};
  for (const id of STUDENT_TOOL_IDS) map[id] = "student";
  for (const id of PRACTITIONER_SIDE_PANEL_TOOL_IDS) map[id] = "practitioner";
  for (const id of PRACTITIONER_TOOL_IDS) map[id] = "practitioner";
  for (const id of SIMULATOR_TOOL_IDS) map[id] = "firm";
  return map;
})();

/** Minimum tier required for a given tool id. Unknown tools default to practitioner. */
export function minTierForTool(toolId: string): AccessTier {
  return TOOL_MIN_TIER[toolId] ?? "practitioner";
}

/** Whether a user on `tier` can access `toolId`. */
export function canAccessTool(tier: AccessTier, toolId: string): boolean {
  return tierRank(tier) >= tierRank(minTierForTool(toolId));
}

/** Voice (ElevenLabs TTS / read-aloud / spoken simulators) is Firm-only (legacy included). */
export function canUseVoice(tier: AccessTier): boolean {
  return tierRank(tier) >= tierRank("firm");
}

/** Reference library is available to every tier. */
export function canAccessLibrary(_tier: AccessTier): boolean {
  return true;
}

/**
 * Effective tier given the stored tier + when the code was created.
 * Any code created on/before the grandfather cutoff is permanently full access.
 */
export function getEffectiveTier(tier: AccessTier, createdAt: Date | string): AccessTier {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  if (created.getTime() <= GRANDFATHER_CUTOFF.getTime()) return "legacy_full";
  return tier;
}

// ---- Plan metadata (pricing page + Stripe) ---------------------------------

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface Plan {
  tier: PurchasableTier;
  name: string;
  tagline: string;
  /** Monthly price in the smallest currency unit (sen). RM49 = 4900. */
  priceAmount: number;
  priceDisplay: string;
  currency: "myr";
  interval: "month";
  /** Stripe price lookup_key — used to resolve the price at checkout time. */
  stripeLookupKey: string;
  highlighted: boolean;
  features: PlanFeature[];
}

export const PLANS: Plan[] = [
  {
    tier: "student",
    name: "Student",
    tagline: "For law students building Malaysian corporate law fundamentals.",
    priceAmount: 4900,
    priceDisplay: "RM49",
    currency: "myr",
    interval: "month",
    stripeLookupKey: "mycorplegal_student_monthly",
    highlighted: false,
    features: [
      { text: "Full reference library (6 sections, glossary, cases)", included: true },
      { text: "AI Tutor, Drafter, Checklist Generator", included: true },
      { text: "Deadline Calculator & Case Finder", included: true },
      { text: "Single-device login", included: true },
      { text: "20 practitioner tools", included: false },
      { text: "Practice simulators", included: false },
      { text: "AI voice (read-aloud & spoken role-play)", included: false },
    ],
  },
  {
    tier: "practitioner",
    name: "Practitioner",
    tagline: "For practising lawyers and corporate advisors.",
    priceAmount: 14900,
    priceDisplay: "RM149",
    currency: "myr",
    interval: "month",
    stripeLookupKey: "mycorplegal_practitioner_monthly",
    highlighted: true,
    features: [
      { text: "Everything in Student", included: true },
      { text: "All 10 side-panel AI chat tools", included: true },
      { text: "All 20 practitioner tools (opinions, DD, SPA, MACC 17A, SSM, stamp duty…)", included: true },
      { text: "Risk scanner & document analyzer", included: true },
      { text: "Practice simulators", included: false },
      { text: "AI voice (read-aloud & spoken role-play)", included: false },
    ],
  },
  {
    tier: "firm",
    name: "Firm",
    tagline: "For firms running training and high-stakes practice prep.",
    priceAmount: 39900,
    priceDisplay: "RM399",
    currency: "myr",
    interval: "month",
    stripeLookupKey: "mycorplegal_firm_monthly",
    highlighted: false,
    features: [
      { text: "Everything in Practitioner", included: true },
      { text: "5 practice simulators (negotiation, mediation, arbitration…)", included: true },
      { text: "ElevenLabs AI voice — read-aloud of AI outputs", included: true },
      { text: "Spoken role-play in all simulators", included: true },
      { text: "Highest priority AI responses", included: true },
    ],
  },
];

export function getPlan(tier: PurchasableTier): Plan {
  const plan = PLANS.find((p) => p.tier === tier);
  if (!plan) throw new Error(`Unknown plan tier: ${tier}`);
  return plan;
}

export function planByLookupKey(lookupKey: string): Plan | undefined {
  return PLANS.find((p) => p.stripeLookupKey === lookupKey);
}
