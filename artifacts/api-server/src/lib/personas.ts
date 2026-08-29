/**
 * Shared professional-persona layer ("the intelligent front door").
 *
 * One platform, multiple professional experiences:
 *   - practitioner  → law firm / legal practice (clients + matters + firm mgmt)
 *   - inhouse       → in-house counsel (contracts, compliance, business risk)
 *   - academic      → law lecturer / legal academic (teaching, research, supervision)
 *   - student       → law student (learning, exam prep, IRAC drills)
 *   - judicial      → judicial officer / court staff (research, judgment analysis)
 *   - other         → everyone else (default balanced experience)
 *
 * The persona is keyed to the subscriber's access code (the one identity that
 * spans every portal). Any portal — and the landing page — can look up or set
 * the persona so navigation, terminology, dashboards and AI context adapt.
 *
 * Security: writes require a code that actually exists in at least one portal
 * access-code registry (no unauthenticated invention of owner keys). The
 * master access code is deliberately NOT accepted here — it is an operator
 * override, not a subscriber identity.
 */
import { Router } from "express";
import { z } from "zod/v4";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import { loginRateLimit } from "./loginRateLimit";
import { resolvePersonaSessionCode } from "./personaSessionOwner";

export const PERSONA_ROLES = [
  "practitioner",
  "inhouse",
  "academic",
  "student",
  "judicial",
  "other",
] as const;
export type PersonaRole = (typeof PERSONA_ROLES)[number];

const DDL = `
CREATE TABLE IF NOT EXISTS user_personas (
  id serial PRIMARY KEY,
  owner_key text NOT NULL UNIQUE,
  primary_role text NOT NULL,
  roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  onboarding jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

export async function ensureUserPersonasTable(): Promise<void> {
  try {
    await pool.query(DDL);
  } catch (err) {
    logger.error({ err }, "Failed to ensure user_personas table");
    throw err;
  }
}

/** Uppercase, trimmed — matches how portal access codes are stored. */
function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Does this access code exist as an ACTIVE, unexpired entitlement in at least
 * one portal registry? Codes are checked case-insensitively because portals
 * differ in casing rules. Expiry is re-checked here on every call (codes can
 * be revoked/expired after issuance — see portal expiry enforcement rule).
 *
 * Note on identity: access codes are issued by one shared provisioning
 * pipeline and synced to every portal registry for the same subscriber, so a
 * code is a platform-global identity, not a per-portal one.
 */
export async function accessCodeExists(code: string): Promise<boolean> {
  const master = (process.env.MASTER_ACCESS_CODE ?? "").trim();
  if (master && code === normalizeCode(master)) return false; // operator override, not a user
  const { rows } = await pool.query<{ found: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM access_codes       WHERE upper(code) = $1 AND is_active AND (expires_at IS NULL OR expires_at > now())
       UNION ALL SELECT 1 FROM crim_access_codes WHERE upper(code) = $1 AND is_active AND (expires_at IS NULL OR expires_at > now())
       UNION ALL SELECT 1 FROM corp_access_codes WHERE upper(code) = $1 AND is_active AND (expires_at IS NULL OR expires_at > now())
       UNION ALL SELECT 1 FROM lit_access_codes  WHERE upper(code) = $1 AND status = 'active' AND (expires_at IS NULL OR expires_at > now())
       UNION ALL SELECT 1 FROM ccb_access_codes  WHERE upper(code) = $1 AND active AND (expires_at IS NULL OR expires_at > now())
       UNION ALL SELECT 1 FROM sya_access_codes  WHERE upper(code) = $1 AND is_active AND (expires_at IS NULL OR expires_at > now())
       UNION ALL SELECT 1 FROM firm_access_codes WHERE upper(code) = $1 AND is_active AND (expires_at IS NULL OR expires_at > now())
     ) AS found`,
    [code],
  );
  return rows[0]?.found === true;
}

export interface PersonaRecord {
  primaryRole: PersonaRole;
  roles: PersonaRole[];
  onboarding: Record<string, unknown>;
  updatedAt: string;
}

export async function getPersona(ownerKey: string): Promise<PersonaRecord | null> {
  const { rows } = await pool.query(
    `SELECT primary_role, roles, onboarding, updated_at FROM user_personas WHERE owner_key = $1`,
    [ownerKey],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    primaryRole: r.primary_role,
    roles: Array.isArray(r.roles) ? r.roles : [],
    onboarding: r.onboarding ?? {},
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

const roleSchema = z.enum(PERSONA_ROLES);
const lookupSchema = z.object({ code: z.string().min(4).max(64) });
const saveSchema = z.object({
  code: z.string().min(4).max(64),
  primaryRole: roleSchema,
  roles: z.array(roleSchema).max(3).optional(),
  onboarding: z.record(z.string(), z.unknown()).optional(),
});

export function buildPersonasRouter(): Router {
  const router = Router();

  // Brute-force protection: these endpoints accept raw access codes, so they
  // get the same IP throttling as portal login endpoints (20 / 15 min).
  router.use(loginRateLimit);

  // Look up the saved persona for an access code (used at login on every portal).
  router.post("/lookup", async (req, res) => {
    const parsed = lookupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
    const code = normalizeCode(parsed.data.code);
    try {
      if (!(await accessCodeExists(code))) {
        return res.status(404).json({ error: "Unknown access code" });
      }
      const persona = await getPersona(code);
      return res.json({ persona });
    } catch (err) {
      logger.error({ err }, "Persona lookup failed");
      return res.status(500).json({ error: "Lookup failed" });
    }
  });

  // Save/update the persona for an access code (front-door onboarding + settings switch).
  //
  // Authorization model (code-review hardening): the raw access code in the
  // body is NOT sufficient to authorize an UPDATE. Writes are bound to the
  // caller's authenticated portal session server-side:
  //   • If the caller has a resolvable portal session, it MUST resolve to the
  //     same access code as the body (else 403). This is the settings switcher.
  //   • If the caller has no session, we allow the write ONLY when no persona
  //     row exists yet for the code — i.e. the create-only onboarding flow used
  //     by the landing-page front door, which PUTs {code, primaryRole} with no
  //     session. Updating an EXISTING persona anonymously is rejected (401).
  router.put("/", async (req, res) => {
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
    const { primaryRole, onboarding } = parsed.data;
    const code = normalizeCode(parsed.data.code);
    const roles = Array.from(new Set([primaryRole, ...(parsed.data.roles ?? [])]));
    try {
      if (!(await accessCodeExists(code))) {
        return res.status(404).json({ error: "Unknown access code" });
      }

      // Bind the write to the caller's authenticated portal identity.
      const sessionCode = await resolvePersonaSessionCode(req);
      if (sessionCode !== null) {
        // Authenticated caller: may only write their OWN code's persona.
        if (sessionCode !== code) {
          return res.status(403).json({ error: "Sign in to change your professional mode" });
        }
      } else {
        // No session: create-only onboarding. Refuse to overwrite an existing
        // persona without proof of identity.
        const existing = await getPersona(code);
        if (existing) {
          return res.status(401).json({ error: "Sign in to change your professional mode" });
        }
      }

      await pool.query(
        `INSERT INTO user_personas (owner_key, primary_role, roles, onboarding)
         VALUES ($1, $2, $3::jsonb, $4::jsonb)
         ON CONFLICT (owner_key) DO UPDATE SET
           primary_role = EXCLUDED.primary_role,
           roles = EXCLUDED.roles,
           onboarding = COALESCE(user_personas.onboarding, '{}'::jsonb) || EXCLUDED.onboarding,
           updated_at = now()`,
        [code, primaryRole, JSON.stringify(roles), JSON.stringify(onboarding ?? {})],
      );
      const persona = await getPersona(code);
      return res.json({ persona });
    } catch (err) {
      logger.error({ err }, "Persona save failed");
      return res.status(500).json({ error: "Save failed" });
    }
  });

  return router;
}
