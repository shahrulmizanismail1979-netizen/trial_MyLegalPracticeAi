/**
 * Shared client for the platform-wide professional-persona layer.
 *
 * The persona ("professional mode") is keyed to the subscriber's access code
 * and stored centrally via the shared `/api/personas` endpoint on the API
 * server. Portals must NOT invent their own persona storage — they look the
 * persona up at login, adapt their dashboard framing, and write changes back
 * through the same endpoint.
 *
 * Because all portals are served from the same origin (path-routed), a single
 * localStorage cache is shared across every portal: a subscriber who picks a
 * mode in one portal sees it reflected everywhere.
 */

export const PERSONA_ROLES = [
  "practitioner",
  "inhouse",
  "academic",
  "student",
  "judicial",
  "other",
] as const;
export type PersonaRole = (typeof PERSONA_ROLES)[number];

export function isPersonaRole(v: unknown): v is PersonaRole {
  return typeof v === "string" && (PERSONA_ROLES as readonly string[]).includes(v);
}

/** Human labels for the switcher UI. */
export const PERSONA_LABELS: Record<PersonaRole, string> = {
  practitioner: "Practising Lawyer",
  inhouse: "In-House Counsel",
  academic: "Legal Academic",
  student: "Law Student",
  judicial: "Judicial Officer",
  other: "General / Other",
};

/** Short descriptions shown next to each mode in the switcher. */
export const PERSONA_DESCRIPTIONS: Record<PersonaRole, string> = {
  practitioner: "Client matters, court deadlines and firm practice tools first.",
  inhouse: "Contracts, compliance and business-risk framing first.",
  academic: "Teaching, research and doctrinal analysis first.",
  student: "Learning, exam preparation and IRAC drills first.",
  judicial: "Research, authorities and judgment analysis first.",
  other: "A balanced experience across all tools.",
};

/**
 * Dashboard framing per role. Portals interpolate these into their existing
 * dashboard welcome/subtitle so terminology matches the professional mode.
 */
export const PERSONA_DASHBOARD_FRAMING: Record<PersonaRole, { heading: string; tagline: string }> = {
  practitioner: {
    heading: "Practice command centre",
    tagline: "Your matters, deadlines and drafting tools — organised for a practising lawyer.",
  },
  inhouse: {
    heading: "Counsel workspace",
    tagline: "Contract, compliance and dispute tools framed for in-house legal work.",
  },
  academic: {
    heading: "Research workspace",
    tagline: "Doctrinal research and analysis tools framed for teaching and scholarship.",
  },
  student: {
    heading: "Learning workspace",
    tagline: "Work through authorities and drills step by step — built for study and exam prep.",
  },
  judicial: {
    heading: "Chambers workspace",
    tagline: "Authorities, judgment analysis and research tools framed for judicial work.",
  },
  other: {
    heading: "Workspace",
    tagline: "All tools available — pick a professional mode in settings to tailor the experience.",
  },
};

export interface PersonaRecord {
  primaryRole: PersonaRole;
  roles: PersonaRole[];
  onboarding: Record<string, unknown>;
  updatedAt: string;
}

const STORAGE_KEY = "portal_persona";

interface StoredPersona {
  /** Normalized access code the persona belongs to (needed for saves). */
  code: string;
  primaryRole: PersonaRole;
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readStoredPersona(): StoredPersona | null {
  const ls = safeStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPersona>;
    if (typeof parsed.code === "string" && isPersonaRole(parsed.primaryRole)) {
      return { code: parsed.code, primaryRole: parsed.primaryRole };
    }
  } catch {
    /* corrupted cache — ignore */
  }
  return null;
}

export function writeStoredPersona(stored: StoredPersona | null): void {
  const ls = safeStorage();
  if (!ls) return;
  try {
    if (stored) ls.setItem(STORAGE_KEY, JSON.stringify(stored));
    else ls.removeItem(STORAGE_KEY);
  } catch {
    /* storage full/blocked — non-fatal */
  }
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Root-relative on purpose: the API server is path-routed at /api. */
const PERSONAS_URL = "/api/personas";

/**
 * Portals whose sessions are bearer tokens (not cookies) must register a
 * header provider so persona WRITES carry the current portal session — the
 * server only allows updating an existing persona when the caller's portal
 * session resolves to the same access code. Cookie-session portals need no
 * setup: same-origin fetch sends their cookies automatically.
 */
let authHeadersProvider: (() => Record<string, string> | null) | null = null;
export function configurePersonaAuthHeaders(provider: () => Record<string, string> | null): void {
  authHeadersProvider = provider;
}
function authHeaders(): Record<string, string> {
  try {
    return authHeadersProvider?.() ?? {};
  } catch {
    return {};
  }
}

/**
 * Look up the saved persona for an access code (call at portal login) and
 * refresh the shared localStorage cache. Returns null when the subscriber has
 * not chosen a mode yet, or on any failure (persona is a nice-to-have — it
 * must never block login).
 */
export interface PersonaLookupResult {
  /** True when the server confirmed this access code (persona may still be null). */
  ok: boolean;
  persona: PersonaRecord | null;
}

export async function lookupPersona(code: string): Promise<PersonaLookupResult> {
  const normalized = normalizeCode(code);
  if (!normalized) return { ok: false, persona: null };
  // A new login for a different code invalidates any previous subscriber's
  // cached persona immediately — never let one subscriber's mode leak into
  // another subscriber's session on a shared browser.
  const prev = readStoredPersona();
  if (prev && prev.code !== normalized) writeStoredPersona(null);
  try {
    const res = await fetch(`${PERSONAS_URL}/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: normalized }),
    });
    if (!res.ok) {
      // Unknown/revoked code — drop any cache for it rather than keep stale identity.
      if (res.status === 404) writeStoredPersona(null);
      return { ok: false, persona: null };
    }
    const data = (await res.json()) as { persona: PersonaRecord | null };
    if (data.persona && isPersonaRole(data.persona.primaryRole)) {
      writeStoredPersona({ code: normalized, primaryRole: data.persona.primaryRole });
      return { ok: true, persona: data.persona };
    }
    // Known code, no persona chosen yet — remember the code so the settings
    // switcher can save one later.
    writeStoredPersona({ code: normalized, primaryRole: "other" });
    return { ok: true, persona: null };
  } catch {
    return { ok: false, persona: null };
  }
}

/**
 * Save a new professional mode for the access code via the shared endpoint,
 * then update the local cache. Throws on failure so the UI can surface it.
 */
export async function savePersona(code: string, primaryRole: PersonaRole): Promise<PersonaRecord> {
  const normalized = normalizeCode(code);
  const res = await fetch(PERSONAS_URL, {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ code: normalized, primaryRole }),
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error("Access code not recognised");
    if (res.status === 401 || res.status === 403)
      throw new Error("Log in again to change your professional mode");
    throw new Error("Could not save professional mode");
  }
  const data = (await res.json()) as { persona: PersonaRecord | null };
  if (!data.persona) throw new Error("Could not save professional mode");
  writeStoredPersona({ code: normalized, primaryRole: data.persona.primaryRole });
  return data.persona;
}

/** Clear the cached persona (call on portal logout if desired). */
export function clearStoredPersona(): void {
  writeStoredPersona(null);
}
