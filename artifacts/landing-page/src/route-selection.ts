const LEGACY_MARKETING_ANCHORS = new Set([
  "pricing",
  "security",
  "apps",
  "about",
  "payment",
  "terms",
  "privacy",
]);

export type RootExperience = "chat" | "marketing";

/**
 * The bare root is the retained chat-first LAWYes surface. Marketing is
 * selected only for the checkout return or the legacy marketing anchors that
 * historically lived at /#pricing, /#security, /#apps, and /#about.
 */
export function rootExperience(
  search = "",
  hash = "",
): RootExperience {
  const params = new URLSearchParams(search);
  if (
    params.get("checkout") === "success" ||
    params.get("checkout") === "cancelled"
  ) {
    return "marketing";
  }

  const anchor = hash.replace(/^#/, "");
  return LEGACY_MARKETING_ANCHORS.has(anchor) ? "marketing" : "chat";
}

export { LEGACY_MARKETING_ANCHORS };