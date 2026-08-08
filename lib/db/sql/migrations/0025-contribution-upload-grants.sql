-- Migration 0025: server-issued upload grants for public contributions.
-- POST /storage/uploads/request-url records each issued objectPath here;
-- POST /contributions consumes the row atomically. Client-supplied
-- objectPath values that were never issued (or already consumed) are
-- rejected, binding every contribution to a server-issued upload.

CREATE TABLE IF NOT EXISTS contribution_pending_uploads (
  id SERIAL PRIMARY KEY,
  object_path TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
