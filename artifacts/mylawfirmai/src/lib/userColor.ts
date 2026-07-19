export interface UserColorStyle {
  backgroundColor: string;
  color: string;
}

/**
 * Deterministic per-user avatar color, derived from the user id so the same
 * staff member always shows the same color across the radar for quick visual
 * identification. Uses the golden-angle hue rotation for well-spread hues.
 */
export function userColor(id: number | null | undefined): UserColorStyle {
  if (id == null) {
    return { backgroundColor: "hsl(40 6% 55%)", color: "hsl(40 30% 97%)" };
  }
  const hue = Math.abs(Math.round(id * 137.508)) % 360;
  return { backgroundColor: `hsl(${hue} 48% 38%)`, color: "hsl(0 0% 100%)" };
}

export interface UserCardTint {
  background: string;
  borderColor: string;
  accent: string;
}

/**
 * Soft, parchment-friendly tint for an entire task card so the whole card
 * "follows" its owner's color (not just an accent line). Keeps lightness high
 * and saturation low so the dark Expedition-Log foreground text stays readable.
 */
export function userCardTint(id: number | null | undefined): UserCardTint {
  if (id == null) {
    return {
      background: "linear-gradient(135deg, hsl(40 18% 93%), hsl(40 14% 88%))",
      borderColor: "hsl(40 12% 68%)",
      accent: "hsl(40 6% 50%)",
    };
  }
  const hue = Math.abs(Math.round(id * 137.508)) % 360;
  return {
    background: `linear-gradient(135deg, hsl(${hue} 44% 94%), hsl(${hue} 40% 87%))`,
    borderColor: `hsl(${hue} 46% 52%)`,
    accent: `hsl(${hue} 48% 38%)`,
  };
}
