-- Phase 05 migration (ADR 0006): multi-case segmentation engine.
-- Additive only; applied with psql. Idempotent: safe to re-run.
BEGIN;

-- One row per container.segment job attempt.
CREATE TABLE IF NOT EXISTS research_segmentation_runs (
  id serial PRIMARY KEY,
  container_id integer NOT NULL REFERENCES research_source_containers(id),
  job_id integer REFERENCES research_jobs(id),
  run_key text NOT NULL,
  processor_version text NOT NULL,
  source_checksum text NOT NULL,
  status text NOT NULL DEFAULT 'RUNNING', -- RUNNING | COMPLETE | REVIEW_REQUIRED
  detail jsonb NOT NULL DEFAULT '{}',    -- stores unassigned_pages etc.
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS research_segmentation_runs_container_key_uq
  ON research_segmentation_runs (container_id, run_key);

-- One row per detected signal instance (provenance at the page/block level).
CREATE TABLE IF NOT EXISTS research_boundary_signals (
  id serial PRIMARY KEY,
  run_id integer NOT NULL REFERENCES research_segmentation_runs(id),
  page_id integer NOT NULL REFERENCES research_source_pages(id),
  block_id integer,  -- references research_page_blocks(id), nullable
  signal_type text NOT NULL CHECK (signal_type IN (
    'NEW_CASE_TITLE', 'NEW_PARTY_CONFIGURATION', 'NEUTRAL_CITATION',
    'REPORT_CITATION', 'COURT_HEADING', 'PROCEEDING_NUMBER', 'CORAM_HEADING',
    'JUDGE_HEADING', 'DECISION_DATE', 'JUDGMENT_HEADING', 'PARAGRAPH_RESET',
    'PAGE_NUMBER_RESTART', 'CLOSING_ORDER', 'JUDICIAL_SIGNATURE',
    'ABRUPT_METADATA_CHANGE', 'ABRUPT_SEMANTIC_CHANGE', 'TYPOGRAPHY_CHANGE',
    'PUBLISHER_DIVIDER', 'BLANK_DIVIDER_PAGE', 'REPEATED_TITLE_IN_QUOTATION',
    'ADMINISTRATIVE_MATERIAL', 'INCOMPLETE_CASE_END', 'MULTI_PAGE_GAP',
    'PUBLISHER_ATTRIBUTION'
  )),
  signal_value text NOT NULL,
  supporting_text text NOT NULL DEFAULT '',
  score_contribution integer NOT NULL,
  processor_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_boundary_signals_run_page_idx
  ON research_boundary_signals (run_id, page_id);

CREATE UNIQUE INDEX IF NOT EXISTS research_boundary_signals_run_page_type_value_uq
  ON research_boundary_signals (run_id, page_id, signal_type, signal_value);

-- One row per proposed boundary location (start or end of a case).
CREATE TABLE IF NOT EXISTS research_case_boundaries (
  id serial PRIMARY KEY,
  run_id integer NOT NULL REFERENCES research_segmentation_runs(id),
  page_id integer NOT NULL REFERENCES research_source_pages(id),
  block_id integer,  -- nullable
  boundary_role text NOT NULL CHECK (boundary_role IN ('start', 'end')),
  strength text NOT NULL CHECK (strength IN (
    'STRONG_BOUNDARY_CANDIDATE', 'MODERATE_BOUNDARY_CANDIDATE',
    'WEAK_BOUNDARY_CANDIDATE', 'CONFLICTING_BOUNDARY'
  )),
  composite_score integer NOT NULL,
  conflicting_signal_count integer NOT NULL DEFAULT 0,
  review_status text NOT NULL DEFAULT 'review_required' CHECK (review_status IN (
    'auto_accepted', 'review_required', 'reviewed', 'rejected'
  )),
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS research_case_boundaries_run_page_role_uq
  ON research_case_boundaries (run_id, page_id, boundary_role);

-- Join table: links a candidate to its start and end boundaries.
-- One candidate has exactly one start boundary and one end boundary.
CREATE TABLE IF NOT EXISTS research_case_candidate_boundaries (
  id serial PRIMARY KEY,
  candidate_id integer NOT NULL REFERENCES research_case_candidates(id),
  start_boundary_id integer NOT NULL REFERENCES research_case_boundaries(id),
  end_boundary_id integer NOT NULL REFERENCES research_case_boundaries(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS research_case_candidate_boundaries_candidate_uq
  ON research_case_candidate_boundaries (candidate_id);

-- Augment research_case_candidates with Phase 05 columns.
ALTER TABLE research_case_candidates
  ADD COLUMN IF NOT EXISTS run_id integer REFERENCES research_segmentation_runs(id),
  ADD COLUMN IF NOT EXISTS strength text,
  ADD COLUMN IF NOT EXISTS page_count integer,
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'review_required',
  ADD COLUMN IF NOT EXISTS reviewed_by text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Unique index on (run_id, status) is too broad; use (run_id) + start boundary via join.
-- Index to speed up per-run candidate lookups.
CREATE INDEX IF NOT EXISTS research_case_candidates_run_idx
  ON research_case_candidates (run_id);

COMMIT;
