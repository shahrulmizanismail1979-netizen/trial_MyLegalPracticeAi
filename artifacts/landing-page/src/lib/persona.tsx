import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Persona = "practitioner" | "inhouse" | "academic" | null;

interface PersonaContextType {
  persona: Persona;
  setPersona: (p: Persona) => void;
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

  const setPersona = (p: Persona) => {
    if (p) {
      localStorage.setItem("legal_persona", p);
    } else {
      localStorage.removeItem("legal_persona");
    }
    setPersonaState(p);
  };

  return (
    <PersonaContext.Provider value={{ persona, setPersona }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  const ctx = useContext(PersonaContext);
  if (!ctx) throw new Error("usePersona must be used within a PersonaProvider");
  return ctx;
}
