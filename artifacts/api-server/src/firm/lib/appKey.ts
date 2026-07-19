/**
 * Server-side app key validation.
 *
 * CONFIGURATION (via Replit environment secrets — never in source code):
 *
 *   TASKRADAR_APP_KEY=<secret>
 *     The credential required to create an AI session.  Shared out-of-band
 *     (e.g. Slack, email) with authorised team members.  The server validates
 *     it on POST /api/session; the value is never returned to any client.
 *
 *   ALLOW_ANON_SESSION=true
 *     Bypass the app key requirement for local development.  MUST NOT be set
 *     in production.  Set this in your local .env or Replit dev environment
 *     so the session endpoint stays open during development without a key.
 *
 * SECURITY POSTURE (fail-closed by default):
 *   - If neither variable is set: POST /api/session is BLOCKED (403).
 *     This is intentional — the app is secure by default; production must
 *     configure TASKRADAR_APP_KEY before AI features are usable.
 *   - If only ALLOW_ANON_SESSION=true is set: open (dev mode).
 *   - If TASKRADAR_APP_KEY is set: that key is always required, even if
 *     ALLOW_ANON_SESSION is also set, to prevent accidental prod leakage.
 */

const APP_KEY = process.env.TASKRADAR_APP_KEY ?? "";
const ALLOW_ANON = process.env.ALLOW_ANON_SESSION === "true";

/**
 * True when callers must supply the app key to establish a session.
 * False only when ALLOW_ANON_SESSION=true and no TASKRADAR_APP_KEY is set.
 */
export const APP_KEY_REQUIRED: boolean = !(ALLOW_ANON && !APP_KEY);

export function validateAppKey(supplied: string | undefined | null): boolean {
  // Dev mode: ALLOW_ANON=true and no key configured → open.
  if (!APP_KEY_REQUIRED) return true;

  if (!APP_KEY) {
    // Fail-closed: app key is required but TASKRADAR_APP_KEY is not configured.
    // Sessions are blocked until the admin sets the env var.
    return false;
  }
  if (!supplied) return false;
  return supplied === APP_KEY;
}
