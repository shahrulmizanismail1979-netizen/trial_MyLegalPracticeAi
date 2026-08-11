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
  // SSR-safe: no localStorage during prerender; hydrate after mount.
  const [persona, setPersonaState] = useState<Persona>(() => {
    if (typeof window === "undefined") return null;
    try {
      return (window.localStorage.getItem("legal_persona") as Persona) || null;
    } catch {
      return null;
    }
  });

  const [skipped, setSkipped] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("legal_persona_skipped") === "1";
    } catch {
      return false;
    }
  });

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
