import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";

const DDL = `
CREATE TABLE IF NOT EXISTS lit_lawyes_members (
 id serial PRIMARY KEY, access_code_id integer NOT NULL REFERENCES lit_access_codes(id) ON DELETE CASCADE,
 name text NOT NULL, email text, role text NOT NULL DEFAULT 'viewer', revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS lit_lawyes_members_tenant_idx ON lit_lawyes_members(access_code_id);
CREATE TABLE IF NOT EXISTS lit_lawyes_credentials (
 id serial PRIMARY KEY, member_id integer NOT NULL REFERENCES lit_lawyes_members(id) ON DELETE CASCADE,
 code_lookup_hash text NOT NULL, code_hash text NOT NULL, last_used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS lit_lawyes_credentials_lookup_uidx ON lit_lawyes_credentials(code_lookup_hash);
CREATE UNIQUE INDEX IF NOT EXISTS lit_lawyes_credentials_member_uidx ON lit_lawyes_credentials(member_id);
CREATE TABLE IF NOT EXISTS lit_lawyes_invitations (
 id serial PRIMARY KEY, access_code_id integer NOT NULL REFERENCES lit_access_codes(id) ON DELETE CASCADE,
 member_id integer NOT NULL REFERENCES lit_lawyes_members(id) ON DELETE CASCADE,
 invited_by_member_id integer REFERENCES lit_lawyes_members(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), accepted_at timestamptz);
CREATE INDEX IF NOT EXISTS lit_lawyes_invitations_tenant_idx ON lit_lawyes_invitations(access_code_id);
CREATE TABLE IF NOT EXISTS lit_lawyes_matter_grants (
 id serial PRIMARY KEY, access_code_id integer NOT NULL REFERENCES lit_access_codes(id) ON DELETE CASCADE,
 matter_id integer NOT NULL REFERENCES lit_matters(id) ON DELETE CASCADE,
 member_id integer NOT NULL REFERENCES lit_lawyes_members(id) ON DELETE CASCADE, role text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS lit_lawyes_matter_grants_matter_member_uidx ON lit_lawyes_matter_grants(matter_id, member_id);
CREATE INDEX IF NOT EXISTS lit_lawyes_matter_grants_member_idx ON lit_lawyes_matter_grants(access_code_id, member_id);
CREATE TABLE IF NOT EXISTS lit_lawyes_audit_events (
 id serial PRIMARY KEY, access_code_id integer NOT NULL REFERENCES lit_access_codes(id) ON DELETE CASCADE,
 actor_member_id integer REFERENCES lit_lawyes_members(id) ON DELETE SET NULL,
 action text NOT NULL, resource_type text NOT NULL, resource_id text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS lit_lawyes_audit_tenant_created_idx ON lit_lawyes_audit_events(access_code_id, created_at);
-- Personal bearer credentials must never survive in the legacy plaintext SSO
-- binding table. This also repairs any value linked during a partial rollout.
UPDATE microsoft_links
   SET access_code = 'REDACTED-LAWYES-MEMBER-' || id::text, active = false
 WHERE access_code ~ '^LY-[A-Z0-9_-]{20}$';
`;
let ready: Promise<void> | null = null;
export function ensureLawyesMemberSchema(): Promise<void> {
  if (!ready) ready = pool.query(DDL).then(() => undefined).catch((err) => {
    ready = null;
    logger.error({ err }, "Failed to ensure LAWYes member schema");
    throw err;
  });
  return ready;
}