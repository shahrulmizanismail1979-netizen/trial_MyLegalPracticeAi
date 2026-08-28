-- Task 522: additive LAWYes editorial report model.
-- No existing research rows or tables are altered or removed.

CREATE TABLE IF NOT EXISTS research_lawyes_reports (
  id serial PRIMARY KEY,
  judgment_id integer NOT NULL UNIQUE REFERENCES research_verified_judgments(id),
  state text NOT NULL DEFAULT 'Draft'
    CHECK (state IN ('Draft', 'AI-assisted', 'Lawyer reviewed', 'Published')),
  title text NOT NULL,
  neutral_citation text,
  report_citation text,
  case_number text,
  court text,
  registry text,
  decision_date text,
  coram jsonb NOT NULL DEFAULT '[]',
  counsel jsonb NOT NULL DEFAULT '[]',
  catchwords jsonb NOT NULL DEFAULT '[]',
  practice_tags jsonb NOT NULL DEFAULT '[]',
  outcome text,
  source_url text NOT NULL,
  source_verified_at timestamptz NOT NULL,
  source_rights_record_id integer NOT NULL REFERENCES research_rights_records(id),
  assigned_editor_id integer REFERENCES research_users(id),
  current_revision integer NOT NULL DEFAULT 1,
  lawyer_reviewed_at timestamptz,
  published_at timestamptz,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_lawyes_reports_state_idx ON research_lawyes_reports(state);
CREATE INDEX IF NOT EXISTS research_lawyes_reports_judgment_idx ON research_lawyes_reports(judgment_id);

CREATE TABLE IF NOT EXISTS research_lawyes_paragraphs (
  id serial PRIMARY KEY,
  report_id integer NOT NULL REFERENCES research_lawyes_reports(id),
  paragraph_key text NOT NULL,
  ordinal integer NOT NULL,
  text text NOT NULL,
  source_page integer,
  source_checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS research_lawyes_paragraphs_report_key_uq ON research_lawyes_paragraphs(report_id, paragraph_key);
CREATE UNIQUE INDEX IF NOT EXISTS research_lawyes_paragraphs_report_ordinal_uq ON research_lawyes_paragraphs(report_id, ordinal);

CREATE TABLE IF NOT EXISTS research_lawyes_sections (
  id serial PRIMARY KEY,
  report_id integer NOT NULL REFERENCES research_lawyes_reports(id),
  kind text NOT NULL,
  heading text NOT NULL,
  body text NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS research_lawyes_sections_report_order_uq ON research_lawyes_sections(report_id, sort_order);

CREATE TABLE IF NOT EXISTS research_lawyes_propositions (
  id serial PRIMARY KEY,
  report_id integer NOT NULL REFERENCES research_lawyes_reports(id),
  section_id integer NOT NULL REFERENCES research_lawyes_sections(id),
  proposition text NOT NULL,
  material boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_lawyes_propositions_report_idx ON research_lawyes_propositions(report_id);

CREATE TABLE IF NOT EXISTS research_lawyes_proposition_pinpoints (
  id serial PRIMARY KEY,
  proposition_id integer NOT NULL REFERENCES research_lawyes_propositions(id),
  paragraph_id integer NOT NULL REFERENCES research_lawyes_paragraphs(id),
  supporting_passage text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS research_lawyes_prop_pinpoint_uq ON research_lawyes_proposition_pinpoints(proposition_id, paragraph_id);

CREATE TABLE IF NOT EXISTS research_lawyes_assignments (
  id serial PRIMARY KEY,
  report_id integer NOT NULL REFERENCES research_lawyes_reports(id),
  assignee_id integer NOT NULL REFERENCES research_users(id),
  role text NOT NULL CHECK (role IN ('editor', 'lawyer_reviewer')),
  assigned_by text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS research_lawyes_reviews (
  id serial PRIMARY KEY,
  report_id integer NOT NULL REFERENCES research_lawyes_reports(id),
  reviewer_id integer NOT NULL REFERENCES research_users(id),
  decision text NOT NULL CHECK (decision IN ('approved', 'changes_requested')),
  legally_trained boolean NOT NULL,
  source_checked boolean NOT NULL,
  pinpoints_checked boolean NOT NULL,
  missing_fields_checked boolean NOT NULL,
  reviewed_revision integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_lawyes_revisions (
  id serial PRIMARY KEY,
  report_id integer NOT NULL REFERENCES research_lawyes_reports(id),
  revision integer NOT NULL,
  from_state text,
  to_state text NOT NULL,
  snapshot jsonb NOT NULL,
  reason text NOT NULL,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS research_lawyes_revisions_report_revision_uq ON research_lawyes_revisions(report_id, revision);

CREATE OR REPLACE FUNCTION reject_lawyes_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LAWYes review and revision records are append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS research_lawyes_reviews_immutable ON research_lawyes_reviews;
CREATE TRIGGER research_lawyes_reviews_immutable
  BEFORE UPDATE OR DELETE ON research_lawyes_reviews
  FOR EACH ROW EXECUTE FUNCTION reject_lawyes_audit_mutation();
DROP TRIGGER IF EXISTS research_lawyes_revisions_immutable ON research_lawyes_revisions;
CREATE TRIGGER research_lawyes_revisions_immutable
  BEFORE UPDATE OR DELETE ON research_lawyes_revisions
  FOR EACH ROW EXECUTE FUNCTION reject_lawyes_audit_mutation();