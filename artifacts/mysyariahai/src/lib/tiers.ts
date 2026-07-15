export const TIER_ORDER = ["starter", "professional", "premium", "firm"] as const;

export type FeatureKey =
  | "aiToolkit"
  | "voiceMode"
  | "elevenLabs"
  | "voiceStt"
  | "kitab"
  | "tafsir";

export const FEATURE_MIN_TIER: Record<FeatureKey, string> = {
  aiToolkit: "professional",
  voiceMode: "professional",
  elevenLabs: "premium",
  voiceStt: "premium",
  kitab: "premium",
  tafsir: "premium",
};

export function tierRank(tier: string | undefined): number {
  return TIER_ORDER.indexOf((tier ?? "starter") as (typeof TIER_ORDER)[number]);
}

export function tierHasFeature(tier: string | undefined, feature: FeatureKey): boolean {
  return tierRank(tier) >= tierRank(FEATURE_MIN_TIER[feature]);
}
