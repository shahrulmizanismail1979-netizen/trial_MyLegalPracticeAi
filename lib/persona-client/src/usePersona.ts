import { useCallback, useEffect, useState } from "react";
import {
  type PersonaRole,
  lookupPersona,
  readStoredPersona,
  savePersona,
} from "./persona";

export interface UsePersonaResult {
  /** Current professional mode, or null when none chosen / unknown. */
  role: PersonaRole | null;
  /**
   * Access code the persona is keyed to. Only exposed after this session's
   * server lookup has re-confirmed the cached code, so a stale cache from a
   * previous subscriber can never be written against. Null until then.
   */
  code: string | null;
  /** True while a save is in flight. */
  saving: boolean;
  /** Switch professional mode — persists via the shared /api/personas endpoint. */
  switchRole: (role: PersonaRole) => Promise<void>;
}

/**
 * Shared portal hook for the professional persona.
 *
 * Reads the same-origin localStorage cache (written at login by
 * `lookupPersona`, cleared at logout by `clearStoredPersona`) synchronously so
 * the dashboard can frame itself without a flash, then re-validates against
 * the server. Writes (switchRole) are only enabled once the server has
 * confirmed the cached code in this session.
 */
export function usePersona(): UsePersonaResult {
  const stored = readStoredPersona();
  const [role, setRole] = useState<PersonaRole | null>(stored?.primaryRole ?? null);
  // Deliberately NOT initialised from the cache: the code is only usable for
  // writes after the server re-confirms it below.
  const [code, setCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const current = readStoredPersona();
    if (!current) return;
    // Re-validate against the shared endpoint (persona may have been switched
    // on another portal, or the code revoked, since it was cached).
    void lookupPersona(current.code).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setRole(result.persona?.primaryRole ?? readStoredPersona()?.primaryRole ?? null);
        setCode(current.code);
      } else if (readStoredPersona() === null) {
        // Lookup cleared the cache (unknown/revoked code) — drop local state too.
        setRole(null);
        setCode(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const switchRole = useCallback(
    async (next: PersonaRole) => {
      if (!code) throw new Error("Log in with your access code first");
      setSaving(true);
      try {
        const persona = await savePersona(code, next);
        setRole(persona.primaryRole);
      } finally {
        setSaving(false);
      }
    },
    [code],
  );

  return { role, code, saving, switchRole };
}
