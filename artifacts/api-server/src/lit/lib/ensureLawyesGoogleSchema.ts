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

    CREATE TABLE IF NOT EXISTS lawyes_gmail_imports (
      id bigserial PRIMARY KEY,
      tenant_id integer NOT NULL REFERENCES lit_access_codes(id) ON DELETE CASCADE,
      matter_id integer NOT NULL REFERENCES lit_matters(id) ON DELETE CASCADE,
      google_subject text NOT NULL,
      gmail_message_id text NOT NULL,
      thread_id text,
      sender text,
      recipients text,
      subject text NOT NULL,
      sent_at timestamptz,
      snippet text,
      content text NOT NULL,
      imported_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, matter_id, google_subject, gmail_message_id)
    );
    CREATE INDEX IF NOT EXISTS lawyes_gmail_imports_matter_idx
      ON lawyes_gmail_imports (tenant_id, matter_id, imported_at DESC);

    CREATE TABLE IF NOT EXISTS lawyes_drive_export_reviews (
      id bigserial PRIMARY KEY,
      tenant_id integer NOT NULL REFERENCES lit_access_codes(id) ON DELETE CASCADE,
      matter_id integer NOT NULL REFERENCES lit_matters(id) ON DELETE CASCADE,
      google_subject text NOT NULL,
      token_hash text NOT NULL UNIQUE,
      output_ids bigint[] NOT NULL,
      destination_folder_id text NOT NULL DEFAULT 'root',
      destination_name text NOT NULL DEFAULT 'My Drive',
      expires_at timestamptz NOT NULL,
      confirmed_at timestamptz,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE lawyes_drive_export_reviews
      ADD COLUMN IF NOT EXISTS output_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;
    CREATE INDEX IF NOT EXISTS lawyes_drive_export_reviews_lookup_idx
      ON lawyes_drive_export_reviews (tenant_id, matter_id, google_subject, token_hash);
    CREATE TABLE IF NOT EXISTS lawyes_drive_export_items (
      id bigserial PRIMARY KEY,
      review_id bigint NOT NULL REFERENCES lawyes_drive_export_reviews(id) ON DELETE CASCADE,
      output_id bigint NOT NULL,
      filename text NOT NULL,
      content_hash text NOT NULL,
      item_key text NOT NULL UNIQUE,
      status text NOT NULL DEFAULT 'pending',
      drive_file_id text,
      drive_web_view_link text,
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (review_id, output_id)
    );
    CREATE INDEX IF NOT EXISTS lawyes_drive_export_items_review_idx
      ON lawyes_drive_export_items (review_id, status);
  `).then(() => undefined).catch((err) => {
    ready = undefined;
    logger.error({ err }, "Failed to ensure LAWYes Google connection schema");
    throw err;
  });
  return ready;
}
