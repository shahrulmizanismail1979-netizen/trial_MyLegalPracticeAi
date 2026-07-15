import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type LanguageMode = "en" | "bm" | "ar" | "both";

interface LanguageContextType {
  mode: LanguageMode;
  setMode: (mode: LanguageMode) => void;
  isRtl: boolean;
  t: (en: string, bm: string, ar?: string) => ReactNode;
  ts: (en: string, bm: string, ar?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "mysyariahai.lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<LanguageMode>(() => {
    if (typeof window === "undefined") return "both";
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return (saved as LanguageMode) || "both";
  });

  const setMode = (m: LanguageMode) => {
    setModeState(m);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, m);
  };

  const isRtl = mode === "ar";

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("dir", isRtl ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", mode === "ar" ? "ar" : mode === "bm" ? "ms" : "en");
  }, [mode, isRtl]);

  const ts = (en: string, bm: string, ar?: string): string => {
    if (mode === "en") return en;
    if (mode === "bm") return bm;
    if (mode === "ar") return ar || en;
    return en;
  };

  const t = (en: string, bm: string, ar?: string): ReactNode => {
    if (mode === "en") return en;
    if (mode === "bm") return bm;
    if (mode === "ar") return <span dir="rtl" className="font-serif">{ar || en}</span>;
    return (
      <span className="inline-flex flex-col sm:flex-row gap-1 sm:gap-2">
        <span>{en}</span>
        <span className="hidden sm:inline text-muted-foreground">/</span>
        <span className="text-muted-foreground italic">{bm}</span>
      </span>
    );
  };

  return (
    <LanguageContext.Provider value={{ mode, setMode, isRtl, t, ts }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
