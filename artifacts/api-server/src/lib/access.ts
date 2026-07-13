import { randomBytes } from "node:crypto";
import type { User } from "@workspace/db/schema";

// ── Grandfathering cutoff ────────────────────────────────────────────────
// Every account created on/before this instant is entitled to full (Firm)
// access for free, forever. Confirmed business rule.
export const GRANDFATHER_CUTOFF = new Date("2026-06-07T23:59:59+08:00");

export function isBeforeCutoff(when: Date = new Date()): boolean {
  return when.getTime() <= GRANDFATHER_CUTOFF.getTime();
}

// ── Tiers ────────────────────────────────────────────────────────────────
export type Tier = "free" | "student" | "practitioner" | "firm";

export const TIER_RANK: Record<Tier, number> = {
  free: 0,
  student: 1,
  practitioner: 2,
  firm: 3,
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/** The tier the user is actually entitled to right now. */
export function effectiveTier(user: Pick<User, "grandfathered" | "subscriptionTier" | "subscriptionStatus">): Tier {
  if (user.grandfathered) return "firm";
  if (user.subscriptionStatus && ACTIVE_STATUSES.has(user.subscriptionStatus)) {
    return (user.subscriptionTier as Tier) || "free";
  }
  return "free";
}

export function hasTier(user: Parameters<typeof effectiveTier>[0], min: Tier): boolean {
  return TIER_RANK[effectiveTier(user)] >= TIER_RANK[min];
}

/** Students get a capped number of AI queries per day. */
export const STUDENT_DAILY_AI_LIMIT = 10;

// ── Currencies ─────────────────────────────────────────────────────────────
export const CURRENCIES = ["myr", "usd", "sgd", "gbp", "eur"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const CURRENCY_LABELS: Record<Currency, string> = {
  myr: "RM (Malaysian Ringgit)",
  usd: "US$ (US Dollar)",
  sgd: "S$ (Singapore Dollar)",
  gbp: "£ (British Pound)",
  eur: "€ (Euro)",
};
export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  myr: "RM", usd: "$", sgd: "S$", gbp: "£", eur: "€",
};

export type Interval = "month" | "year";

export interface PlanDef {
  id: Exclude<Tier, "free">;
  name: string;
  tagline: string;
  features: string[];
  /** amounts in minor units (sen / cents) per currency */
  prices: Record<Interval, Record<Currency, number>>;
}

// Amounts are in the smallest currency unit (e.g. RM19.00 => 1900 sen).
export const PLANS: Record<Exclude<Tier, "free">, PlanDef> = {
  student: {
    id: "student",
    name: "Student",
    tagline: "For law students learning Malaysian conveyancing.",
    features: [
      "All 6 learning sections (theory, workflows, cases, terminology)",
      "Practitioner-grade Costs & RPGT calculator",
      "AI Tutor & Case Law Research (10 queries/day)",
    ],
    prices: {
      month: { myr: 1900, usd: 399, sgd: 549, gbp: 299, eur: 369 },
      year: { myr: 14900, usd: 2999, sgd: 4200, gbp: 2499, eur: 2899 },
    },
  },
  practitioner: {
    id: "practitioner",
    name: "Practitioner",
    tagline: "For working conveyancing lawyers & firms.",
    features: [
      "Everything in Student, unlimited",
      "All 39 AI tools (drafting, review, tax, specialist)",
      "24 downloadable fill-in precedents",
      "Word / Google Docs document export",
    ],
    prices: {
      month: { myr: 8900, usd: 1899, sgd: 2599, gbp: 1499, eur: 1799 },
      year: { myr: 89000, usd: 18900, sgd: 25900, gbp: 14900, eur: 17900 },
    },
  },
  firm: {
    id: "firm",
    name: "Firm",
    tagline: "Full power, including AI audio narration.",
    features: [
      "Everything in Practitioner",
      "ElevenLabs AI audio narration (listen to topics, cases & generated documents)",
      "Priority AI processing",
      "Early access to new content & tools",
    ],
    prices: {
      month: { myr: 19900, usd: 4299, sgd: 5799, gbp: 3399, eur: 3999 },
      year: { myr: 199000, usd: 41900, sgd: 56900, gbp: 33900, eur: 39900 },
    },
  },
};

// ── Access codes ───────────────────────────────────────────────────────────
// Login is by access code only. Codes are the sole credential, so they must be
// unique and reasonably high-entropy. Format: MYCV-XXXX-XXXX-XXXX using an
// unambiguous alphabet (no 0/O/1/I) so they are easy to read out and type.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateAccessCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    let chunk = "";
    const bytes = randomBytes(4);
    for (let i = 0; i < 4; i++) {
      chunk += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    }
    groups.push(chunk);
  }
  return `MYCV-${groups.join("-")}`;
}

/** Public-facing access summary returned to the client. */
export function accessSummary(user: User) {
  return {
    tier: effectiveTier(user),
    grandfathered: user.grandfathered,
    subscriptionStatus: user.subscriptionStatus ?? null,
    currentPeriodEnd: user.currentPeriodEnd ?? null,
  };
}
