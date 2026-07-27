-- Phase 11a: Authorities & Legislation Extraction
-- Creates research_authorities and research_legislation_refs tables.
-- Both are extracted from AI analysis runs (Phase 10) and are idempotent
-- on (run_id, proposition_id).

CREATE TABLE IF NOT EXISTS research_authorities (
  id                 serial      PRIMARY KEY,
  judgment_id        integer     NOT NULL REFERENCES research_verified_judgments(id),
  run_id             integer     NOT NULL REFERENCES research_ai_analysis_runs(id),
  proposition_id     integer     NOT NULL REFERENCES research_ai_propositions(id),
  case_name          text        NOT NULL,
  citation           text,
  source_paragraph_id text,
  treatment          text        NOT NULL,  -- AuthorityTreatment enum
  treatment_evidence text,
  review_status      text        NOT NULL DEFAULT 'pending_review',
  reviewer_email     text,
  reviewed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS research_authorities_run_prop_uq
  ON research_authorities(run_id, proposition_id);
CREATE INDEX IF NOT EXISTS research_authorities_judgment_idx
  ON research_authorities(judgment_id);
CREATE INDEX IF NOT EXISTS research_authorities_citation_idx
  ON research_authorities(citation);

CREATE TABLE IF NOT EXISTS research_legislation_refs (
  id                  serial      PRIMARY KEY,
  judgment_id         integer     NOT NULL REFERENCES research_verified_judgments(id),
  run_id              integer     NOT NULL REFERENCES research_ai_analysis_runs(id),
  proposition_id      integer     NOT NULL REFERENCES research_ai_propositions(id),
  statute             text        NOT NULL,
  provision           text,
  jurisdiction        text,
  source_paragraph_id text,
  mode                text        NOT NULL,  -- LegislationMode enum
  supporting_passage  text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS research_legislation_refs_run_prop_uq
  ON research_legislation_refs(run_id, proposition_id);
CREATE INDEX IF NOT EXISTS research_legislation_refs_judgment_idx
  ON research_legislation_refs(judgment_id);
