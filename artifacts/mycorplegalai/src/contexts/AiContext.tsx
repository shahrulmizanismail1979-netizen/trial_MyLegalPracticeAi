import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type AiTool = "tutor" | "drafter" | "risk-scanner" | "checklist" | "deadline-calculator" | "document-analyzer" | "case-finder" | "minutes-drafter" | "contract-review" | "compliance-advisor";

interface AiTrigger {
  tool: AiTool;
  message: string;
  context?: string;
}

interface AiContextValue {
  trigger: AiTrigger | null;
  panelOpen: boolean;
  activeTool: AiTool;
  clearTrigger: () => void;
  openWithContext: (tool: AiTool, message: string, context?: string) => void;
  setPanelOpen: (open: boolean) => void;
  setActiveTool: (tool: AiTool) => void;
}

const AiContext = createContext<AiContextValue | null>(null);

export function AiContextProvider({ children }: { children: ReactNode }) {
  const [trigger, setTrigger] = useState<AiTrigger | null>(null);
  // Open by default on desktop; closed on mobile (where it renders full-screen).
  const [panelOpen, setPanelOpen] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );
  const [activeTool, setActiveTool] = useState<AiTool>("tutor");

  const clearTrigger = useCallback(() => setTrigger(null), []);

  const openWithContext = useCallback((tool: AiTool, message: string, context?: string) => {
    setActiveTool(tool);
    setPanelOpen(true);
    setTrigger({ tool, message, context });
  }, []);

  return (
    <AiContext.Provider value={{ trigger, panelOpen, activeTool, clearTrigger, openWithContext, setPanelOpen, setActiveTool }}>
      {children}
    </AiContext.Provider>
  );
}

export function useAiContext() {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error("useAiContext must be used inside AiContextProvider");
  return ctx;
}
