-- Task #194: versioned drafts & letters workspace for all portals.
CREATE TABLE IF NOT EXISTS case_drafts (
  id SERIAL PRIMARY KEY,
  portal TEXT NOT NULL,
  owner_key TEXT NOT NULL,
  matter_id INTEGER,
  root_id INTEGER,                    -- NULL on first version; set to self.id after insert
  version_number INTEGER NOT NULL DEFAULT 1,
  kind TEXT NOT NULL DEFAULT 'draft', -- 'draft' | 'letter'
  letter_type TEXT,                   -- e.g. 'status_update', 'fee_reminder', 'cover_letter'
  language TEXT NOT NULL DEFAULT 'en',
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_drafts_owner_idx ON case_drafts (portal, owner_key);
CREATE INDEX IF NOT EXISTS case_drafts_matter_idx ON case_drafts (portal, owner_key, matter_id);
CREATE INDEX IF NOT EXISTS case_drafts_root_idx ON case_drafts (root_id);
