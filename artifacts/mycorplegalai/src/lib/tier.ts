import { useSyncExternalStore } from "react";
import { ACCESS_TIERS, type AccessTier } from "@workspace/tiers";

export {
  canAccessTool,
  canUseVoice,
  minTierForTool,
  tierRank,
  type AccessTier,
} from "@workspace/tiers";

const STORAGE_KEY = "access_tier";
const EVENT = "tierchange";

function isTier(value: unknown): value is AccessTier {
  return typeof value === "string" && (ACCESS_TIERS as readonly string[]).includes(value);
}

/** Read the stored effective tier. Defaults to the most restrictive tier until validated. */
export function getStoredTier(): AccessTier {
  const value = localStorage.getItem(STORAGE_KEY);
  return isTier(value) ? value : "student";
}

/** Persist the effective tier returned by the backend and notify subscribers. */
export function setStoredTier(tier: string | null | undefined): void {
  if (isTier(tier)) {
    localStorage.setItem(STORAGE_KEY, tier);
    window.dispatchEvent(new Event(EVENT));
  }
}

/** Remove the stored tier (on logout) and notify subscribers. */
export function clearStoredTier(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** React hook that re-renders when the stored tier changes. */
export function useTier(): AccessTier {
  return useSyncExternalStore(subscribe, getStoredTier, () => "student");
}
