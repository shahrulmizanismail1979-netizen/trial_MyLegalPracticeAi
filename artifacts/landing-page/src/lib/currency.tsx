import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  useGetCurrencyRates,
  getGetCurrencyRatesQueryKey,
} from "@workspace/api-client-react";

export const SUPPORTED_CURRENCIES = [
  "USD",
  "MYR",
  "SGD",
  "IDR",
  "BND",
  "GBP",
  "EUR",
  "AUD",
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  USD: "USD ($)",
  MYR: "MYR (RM)",
  SGD: "SGD (S$)",
  IDR: "IDR (Rp)",
  BND: "BND (B$)",
  GBP: "GBP (£)",
  EUR: "EUR (€)",
  AUD: "AUD (A$)",
};

// Static fallback rates used until live rates load (approx values).
const FALLBACK_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  MYR: 4.4,
  SGD: 1.32,
  IDR: 16100,
  BND: 1.32,
  GBP: 0.77,
  EUR: 0.9,
  AUD: 1.48,
};

const STORAGE_KEY = "display-currency";

function detectDefaultCurrency(): CurrencyCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (SUPPORTED_CURRENCIES as readonly string[]).includes(saved)) {
      return saved as CurrencyCode;
    }
  } catch {
    // localStorage unavailable — fall through to auto-detection
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (tz === "Asia/Kuala_Lumpur" || tz === "Asia/Kuching") return "MYR";
    if (tz === "Asia/Singapore") return "SGD";
    if (tz.startsWith("Asia/Jakarta") || tz === "Asia/Makassar" || tz === "Asia/Jayapura")
      return "IDR";
    if (tz === "Asia/Brunei") return "BND";
    if (tz === "Europe/London") return "GBP";
    if (tz.startsWith("Australia/")) return "AUD";
  } catch {
    // Intl unavailable — fall through to locale detection
  }

  const locales = typeof navigator !== "undefined" ? navigator.languages ?? [] : [];
  for (const locale of locales) {
    const region = locale.split("-")[1]?.toUpperCase();
    if (region === "MY") return "MYR";
    if (region === "SG") return "SGD";
    if (region === "ID") return "IDR";
    if (region === "BN") return "BND";
    if (region === "GB") return "GBP";
    if (region === "AU") return "AUD";
  }

  return "USD";
}

interface CurrencyContextValue {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  /** Convert a USD amount and format it in the selected display currency. */
  format: (usdAmount: number) => string;
  /** True when the display currency is not USD (show "billed in USD" note). */
  isConverted: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  // Begin with the same value used during SSR. Detecting from local storage,
  // timezone, or browser locale during the initial render would make the
  // hydrated markup differ from the prerendered markup.
  const [currency, setCurrencyState] = useState<CurrencyCode>("USD");

  useEffect(() => {
    setCurrencyState(detectDefaultCurrency());
  }, []);

  const { data } = useGetCurrencyRates({
    query: {
      queryKey: getGetCurrencyRatesQueryKey(),
      staleTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  });

  const rates = useMemo(() => {
    const live = data?.rates as Record<string, number> | undefined;
    return { ...FALLBACK_RATES, ...(live ?? {}) };
  }, [data]);

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore storage failures
    }
  }, []);

  const format = useCallback(
    (usdAmount: number) => {
      const rate = rates[currency] ?? 1;
      const value = usdAmount * rate;
      // Whole numbers for large amounts / zero-decimal currencies, else 2 dp.
      const decimals = currency === "IDR" || Number.isInteger(Number(value.toFixed(2))) ? 0 : 2;
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
        .format(decimals === 0 ? Math.round(value) : value)
        .replace(/^MYR\s?/, "RM")
        .replace(/^SGD\s?/, "S$")
        .replace(/^BND\s?/, "B$")
        .replace(/^IDR\s?/, "Rp")
        .replace(/^A\$/, "A$");
    },
    [currency, rates],
  );

  const value = useMemo(
    () => ({ currency, setCurrency, format, isConverted: currency !== "USD" }),
    [currency, setCurrency, format],
  );

  useEffect(() => {
    // Persist the auto-detected currency so it stays stable across visits.
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, currency);
      }
    } catch {
      // ignore storage failures
    }
  }, [currency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return ctx;
}
