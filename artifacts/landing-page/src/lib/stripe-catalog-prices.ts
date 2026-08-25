import { useQuery } from "@tanstack/react-query";

export const CATALOG_TIERS = [
  "single",
  "bundle",
  "firm-boutique",
  "firm-practice",
  "firm-firm",
  "corp-startup",
  "corp-growth",
  "corp-corporate",
  "edu-faculty-starter",
  "edu-faculty-plus",
  "edu-campus",
] as const;

export type CatalogTier = (typeof CATALOG_TIERS)[number];

export interface StripeCatalogPrice {
  id: string;
  unitAmount: number;
  currency: "usd";
  recurring: { interval: "month" };
}

type CatalogPriceResponse = {
  data?: Partial<Record<CatalogTier, StripeCatalogPrice | null>>;
};

const CATALOG_PRICES_QUERY_KEY = ["stripe", "catalog-prices"] as const;

async function fetchCatalogPrices(): Promise<Partial<Record<CatalogTier, StripeCatalogPrice | null>>> {
  const response = await fetch("/api/stripe/catalog-prices");
  if (!response.ok) {
    throw new Error("Pricing is temporarily unavailable.");
  }

  const body = (await response.json()) as CatalogPriceResponse;
  if (!body.data || typeof body.data !== "object") {
    throw new Error("Pricing response was invalid.");
  }
  return body.data;
}

export function useStripeCatalogPrices() {
  const query = useQuery({
    queryKey: CATALOG_PRICES_QUERY_KEY,
    queryFn: fetchCatalogPrices,
    // Stripe webhooks invalidate the server snapshot, while this poll keeps
    // an already-open landing page from retaining a replaced price forever.
    staleTime: 0,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    prices: query.data ?? {},
    isLoading: query.isLoading,
    isUnavailable: query.isError,
  };
}

export function getCatalogUsdAmount(
  prices: Partial<Record<CatalogTier, StripeCatalogPrice | null>>,
  tier: CatalogTier,
): number | null {
  const price = prices[tier];
  if (
    !price ||
    price.currency !== "usd" ||
    price.recurring?.interval !== "month" ||
    !Number.isInteger(price.unitAmount) ||
    price.unitAmount < 0
  ) {
    return null;
  }
  return price.unitAmount / 100;
}