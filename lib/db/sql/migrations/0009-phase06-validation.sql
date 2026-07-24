-- Phase 06 migration (ADR 0007): segmentation validation, human review & cross-file reconstruction.
-- Additive only; applied with psql. Idempotent: safe to re-run.
BEGIN;

-- One row per container.validate job attempt.
CREATE TABLE IF NOT EXISTS research_validation_runs (
  id serial PRIMARY KEY,
  container_id integer NOT NULL REFERENCES research_source_containers(id),
  job_id integer REFERENCES research_jobs(id),
  run_key text NOT NULL,
  processor_version text NOT NULL,
  status text NOT NULL DEFAULT 'RUNNING', -- RUNNING | COMPLETE | REVIEW_REQUIRED
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS research_validation_runs_container_key_uq
  ON research_validation_runs (container_id, run_key);

-- One row per coherence/contradiction check per candidate per validation run.
CREATE TABLE IF NOT EXISTS research_candidate_coherence_checks (
  id serial PRIMARY KEY,
  validation_run_id integer NOT NULL REFERENCES research_validation_runs(id),
  candidate_id integer NOT NULL REFERENCES research_case_candidates(id),
  check_type text NOT NULL CHECK (check_type IN (
    'COHERENT_CASE_IDENTITY', 'COHERENT_COURT', 'COHERENT_PARTIES',
    'COHERENT_CITATION', 'COHERENT_JUDGE', 'COHERENT_NARRATIVE',
    'COHERENT_PARAGRAPHS', 'COHERENT_DISPUTE', 'COHERENT_CONCLUSION',
    'NO_MIXED_COURTS', 'NO_UNRELATED_PARTY_CHANGE', 'NO_MULTIPLE_DECISIONS',
    'NO_REPEATED_ENDINGS', 'NO_NEW_PROCEEDING_MID_SPAN',
    'HAS_BEGINNING', 'HAS_ENDING', 'SEQUENTIAL_PARAGRAPHS', 'NO_SOURCE_PAGE_GAP'
  )),
  result text NOT NULL CHECK (result IN ('PASS', 'FAIL', 'UNCERTAIN', 'NOT_APPLICABLE')),
  detail jsonb NOT NULL DEFAULT '{}',
  processor_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS research_candidate_coherence_checks_run_candidate_type_uq
  ON research_candidate_coherence_checks (validation_run_id, candidate_id, check_type);

CREATE INDEX IF NOT EXISTS research_candidate_coherence_checks_candidate_idx
  ON research_candidate_coherence_checks (candidate_id);

-- Append-only log of all reviewer actions on a candidate.
CREATE TABLE IF NOT EXISTS research_candidate_review_actions (
  id serial PRIMARY KEY,
  candidate_id integer NOT NULL REFERENCES research_case_candidates(id),
  action_type text NOT NULL CHECK (action_type IN (
    'MOVE_BOUNDARY', 'SPLIT', 'MERGE', 'MARK_NON_CASE', 'MARK_INCOMPLETE',
    'APPROVE', 'REJECT', 'REQUEST_REPROCESSING', 'LINK_CONTINUATION',
    'LINK_DUPLICATE', 'LINK_RELATED'
  )),
  actor text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}',
  transformation_id integer REFERENCES research_transformations(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_candidate_review_actions_candidate_created_idx
  ON research_candidate_review_actions (candidate_id, created_at);

-- Declared relationships between candidates across containers.
CREATE TABLE IF NOT EXISTS research_cross_file_relationships (
  id serial PRIMARY KEY,
  source_candidate_id integer NOT NULL REFERENCES research_case_candidates(id),
  target_candidate_id integer NOT NULL REFERENCES research_case_candidates(id),
  relationship_type text NOT NULL CHECK (relationship_type IN (
    'POSSIBLE_CONTINUATION', 'CONFIRMED_CONTINUATION',
    'POSSIBLE_DUPLICATE', 'EXACT_DUPLICATE',
    'ALTERNATIVE_VERSION', 'CORRECTED_VERSION',
    'RELATED_APPEAL', 'UNRELATED'
  )),
  evidence jsonb NOT NULL DEFAULT '{}',
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS research_cross_file_relationships_src_tgt_type_uq
  ON research_cross_file_relationships (source_candidate_id, target_candidate_id, relationship_type);

CREATE INDEX IF NOT EXISTS research_cross_file_relationships_source_idx
  ON research_cross_file_relationships (source_candidate_id);

CREATE INDEX IF NOT EXISTS research_cross_file_relationships_target_idx
  ON research_cross_file_relationships (target_candidate_id);

-- Multi-container span assembly for a single logical case.
-- Creating a span requires explicit human approval (status: PROPOSED → APPROVED | REJECTED).
CREATE TABLE IF NOT EXISTS research_cross_file_spans (
  id serial PRIMARY KEY,
  created_by text NOT NULL,
  approved_by text,
  approved_at timestamptz,
  status text NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'APPROVED', 'REJECTED')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ordered segments of a cross-file span (1-based ordering within the span).
CREATE TABLE IF NOT EXISTS research_cross_file_span_segments (
  id serial PRIMARY KEY,
  span_id integer NOT NULL REFERENCES research_cross_file_spans(id),
  candidate_id integer NOT NULL REFERENCES research_case_candidates(id),
  segment_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS research_cross_file_span_segments_span_candidate_uq
  ON research_cross_file_span_segments (span_id, candidate_id);

CREATE INDEX IF NOT EXISTS research_cross_file_span_segments_span_order_idx
  ON research_cross_file_span_segments (span_id, segment_order);

COMMIT;
