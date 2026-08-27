import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Persona =
  | "practitioner"
  | "inhouse"
  | "academic"
  | "student"
  | "judicial"
  | "other"
  | null;

interface PersonaContextType {
  persona: Persona;
  setPersona: (p: Persona) => void;
  /** True when the visitor chose to skip the role selection screen. */
  skipped: boolean;
  skipFrontDoor: () => void;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export function PersonaProvider({ children }: { children: ReactNode }) {
  // Match SSR for the first client render, then restore browser preferences.
  // This lets main.tsx hydrate instead of clearing the prerendered page.
  const [persona, setPersonaState] = useState<Persona>(null);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    try {
      setPersonaState((window.localStorage.getItem("legal_persona") as Persona) || null);
      setSkipped(window.localStorage.getItem("legal_persona_skipped") === "1");
    } catch {
      // Storage may be unavailable; retain the SSR-safe defaults.
    }
  }, []);

  const setPersona = (p: Persona) => {
    if (p) {
      localStorage.setItem("legal_persona", p);
    } else {
      localStorage.removeItem("legal_persona");
    }
    setPersonaState(p);
  };

  const skipFrontDoor = () => {
    try {
      localStorage.setItem("legal_persona_skipped", "1");
    } catch {
      // ignore storage failures; state still updates for this session
    }
    setSkipped(true);
  };

  return (
    <PersonaContext.Provider value={{ persona, setPersona, skipped, skipFrontDoor }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  const ctx = useContext(PersonaContext);
  if (!ctx) throw new Error("usePersona must be used within a PersonaProvider");
  return ctx;
}
