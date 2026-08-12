-- Task #193: client document vault on every portal.
CREATE TABLE IF NOT EXISTS case_documents (
  id SERIAL PRIMARY KEY,
  portal TEXT NOT NULL,
  owner_key TEXT NOT NULL,
  matter_id INTEGER,
  client_id INTEGER,
  object_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  doc_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_documents_owner_idx ON case_documents (portal, owner_key);
CREATE INDEX IF NOT EXISTS case_documents_matter_idx ON case_documents (portal, owner_key, matter_id);

CREATE TABLE IF NOT EXISTS case_pending_uploads (
  id SERIAL PRIMARY KEY,
  portal TEXT NOT NULL,
  owner_key TEXT NOT NULL,
  object_path TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
