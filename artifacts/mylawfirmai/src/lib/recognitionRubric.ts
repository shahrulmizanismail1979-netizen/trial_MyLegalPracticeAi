// Presentation-side mirror of the backend recognition rubric.
// Keep these constants in sync with artifacts/api-server/src/lib/recognitionLogic.ts.

export type ComponentKey = "speed" | "throughput" | "quality" | "creativity";

export const OVERALL_WEIGHTS: Record<ComponentKey, number> = {
  speed: 0.3,
  throughput: 0.2,
  quality: 0.3,
  creativity: 0.2,
};

export const COMPONENT_ORDER: ComponentKey[] = [
  "speed",
  "throughput",
  "quality",
  "creativity",
];

export const THRESHOLDS = {
  bonus: { overall: 75, completed: 3, qc: 80 },
  promo: { overall: 82, completed: 5, speed: 70, qc: 85 },
} as const;

export type ScoreInput = {
  speedScore: number;
  throughputScore: number;
  qualityScore?: number | null;
  creativityScore?: number | null;
};

export type ComponentBreakdown = {
  key: ComponentKey;
  score: number | null;
  baseWeight: number;
  /** Renormalized weight actually applied (0 when the component is unrated). */
  effectiveWeight: number;
  /** score * effectiveWeight (0 when unrated). */
  contribution: number;
  rated: boolean;
};

function scoreFor(input: ScoreInput, key: ComponentKey): number | null | undefined {
  switch (key) {
    case "speed":
      return input.speedScore;
    case "throughput":
      return input.throughputScore;
    case "quality":
      return input.qualityScore;
    case "creativity":
      return input.creativityScore;
  }
}

/**
 * Decompose an overall score into its weighted parts, mirroring the backend's
 * renormalize-over-available-components rule.
 */
export function computeBreakdown(input: ScoreInput): ComponentBreakdown[] {
  const availableWeight = COMPONENT_ORDER.reduce(
    (sum, key) => (scoreFor(input, key) != null ? sum + OVERALL_WEIGHTS[key] : sum),
    0,
  );

  return COMPONENT_ORDER.map((key) => {
    const score = scoreFor(input, key);
    const rated = score != null;
    const effectiveWeight =
      rated && availableWeight > 0 ? OVERALL_WEIGHTS[key] / availableWeight : 0;
    return {
      key,
      score: score ?? null,
      baseWeight: OVERALL_WEIGHTS[key],
      effectiveWeight,
      contribution: rated ? (score as number) * effectiveWeight : 0,
      rated,
    };
  });
}

export function qcAverage(input: ScoreInput): number | null {
  if (input.qualityScore == null || input.creativityScore == null) return null;
  return (input.qualityScore + input.creativityScore) / 2;
}
