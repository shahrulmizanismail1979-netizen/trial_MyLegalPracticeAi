import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";

let ready: Promise<void> | undefined;

export function ensureLawyesGoogleSchema(): Promise<void> {
  ready ??= pool.query(`
    CREATE TABLE IF NOT EXISTS lawyes_google_connections (
      id bigserial PRIMARY KEY,
      tenant_id integer NOT NULL REFERENCES lit_access_codes(id) ON DELETE CASCADE,
      lawyer_id text NOT NULL,
      google_subject text NOT NULL,
      email text NOT NULL,
      display_name text,
      encrypted_tokens text NOT NULL,
      granted_scopes text[] NOT NULL DEFAULT '{}',
      connected_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, lawyer_id),
      UNIQUE (tenant_id, google_subject)
    );
    CREATE INDEX IF NOT EXISTS lawyes_google_connections_tenant_lawyer_idx
      ON lawyes_google_connections (tenant_id, lawyer_id);
  `).then(() => undefined).catch((err) => {
    ready = undefined;
    logger.error({ err }, "Failed to ensure LAWYes Google connection schema");
    throw err;
  });
  return ready;
}
