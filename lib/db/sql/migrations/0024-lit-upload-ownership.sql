-- Migration 0024: bind MyLitAI drafting uploads to the issuing subscriber.
-- Each direct-to-storage upload path is registered here when /upload-url is
-- issued and consumed atomically (owner-checked one-time use) at
-- /extract-stored, so one subscriber cannot extract (and thereby delete)
-- another subscriber's pending upload. DB-backed so the check holds across
-- API instances and restarts.

CREATE TABLE IF NOT EXISTS lit_pending_uploads (
  id SERIAL PRIMARY KEY,
  object_path TEXT NOT NULL UNIQUE,
  access_code_id INTEGER NOT NULL
    REFERENCES lit_access_codes(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
