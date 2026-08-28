-- Task 522 step 11: pending access records for sources that are eligible but
-- do not yet have verified, paragraph-addressable judicial text.
CREATE TABLE IF NOT EXISTS research_lawyes_access_records (
  id serial PRIMARY KEY,
  judgment_id integer NOT NULL UNIQUE REFERENCES research_verified_judgments(id),
  source_rights_record_id integer NOT NULL REFERENCES research_rights_records(id),
  status text NOT NULL DEFAULT 'pending_verified_full_text',
  reason text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_lawyes_access_records_status_idx
  ON research_lawyes_access_records(status);