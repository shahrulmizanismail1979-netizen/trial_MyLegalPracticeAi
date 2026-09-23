import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  getAdminAiProvider,
  parseAIProvider,
  setApiProvider,
  type AIProvider,
} from "@/lib/irac-api";

type AIProviderContextValue = {
  /** The provider actually used for requests (override → admin default → OpenAI). */
  provider: AIProvider;
  /** The admin-configured default (what is used when the user has no override). */
  adminDefault: AIProvider;
  /** The user's per-browser override, or null when following the admin default. */
  override: AIProvider | null;
  /** True when the server has an OPENAI_API_KEY configured. */
  openaiAvailable: boolean;
  /** True when the server has an ANTHROPIC_API_KEY configured. */
  anthropicAvailable: boolean;
  /** Set (or clear, with null) the user's override. */
  setOverride: (p: AIProvider | null) => void;
};

const AIProviderContext = createContext<AIProviderContextValue | null>(null);

const STORAGE_KEY = "irac.aiProvider.override";

function readOverride(): AIProvider | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  const provider = parseAIProvider(v);
  if (v !== null && provider === null) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return provider;
}

export function AIProviderProvider({ children }: { children: ReactNode }) {
  const [adminDefault, setAdminDefault] = useState<AIProvider>("openai");
  const [openaiAvailable, setOpenaiAvailable] = useState(false);
  const [anthropicAvailable, setAnthropicAvailable] = useState(false);
  const [override, setOverrideState] = useState<AIProvider | null>(() => readOverride());

  // Fetch the admin default once on mount.
  useEffect(() => {
    let active = true;
    getAdminAiProvider()
      .then((status) => {
        if (!active) return;
        setAdminDefault(status.provider);
        setOpenaiAvailable(status.openaiConfigured);
        setAnthropicAvailable(status.anthropicConfigured);
      })
      .catch(() => {
        /* keep the OpenAI default on failure */
      });
    return () => {
      active = false;
    };
  }, []);

  // The effective provider is never silently changed based on availability.
  // A selected but unavailable provider should produce an explicit server error.
  const provider: AIProvider = override ?? adminDefault;

  // Keep the api client's module-level provider in sync with the resolved value.
  useEffect(() => {
    setApiProvider(provider);
  }, [provider]);

  const setOverride = (p: AIProvider | null) => {
    setOverrideState(p);
    if (typeof window !== "undefined") {
      if (p) window.localStorage.setItem(STORAGE_KEY, p);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <AIProviderContext.Provider
      value={{ provider, adminDefault, override, openaiAvailable, anthropicAvailable, setOverride }}
    >
      {children}
    </AIProviderContext.Provider>
  );
}

export function useAIProvider() {
  const ctx = useContext(AIProviderContext);
  if (!ctx) throw new Error("useAIProvider must be used within AIProviderProvider");
  return ctx;
}
