-- Phase 01 migration: additive schema expansion + state-vocabulary migration.
-- Applied with psql (never interactive drizzle push — it has proposed
-- destructive renames in this repo). Idempotent: safe to re-run.
BEGIN;

-- 2) Additive columns on existing tables.
ALTER TABLE research_jobs
  ADD COLUMN IF NOT EXISTS processor_version text NOT NULL DEFAULT 'unversioned',
  ADD COLUMN IF NOT EXISTS failure_reason jsonb,
  ADD COLUMN IF NOT EXISTS source_checksum text,
  ADD COLUMN IF NOT EXISTS output_checksum text,
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE research_jobs ALTER COLUMN state SET DEFAULT 'QUEUED';

ALTER TABLE research_review_items
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS assigned_to integer REFERENCES research_users(id);

ALTER TABLE research_source_containers
  ALTER COLUMN processing_state SET DEFAULT 'UPLOADED';

-- 3) Migrate container states (Phase 00 vocabulary -> Phase 01 vocabulary),
--    recording a reversible mapping per changed row as a transformation.
WITH mapping (old_state, new_state) AS (
  VALUES
    ('REGISTERED', 'UPLOADED'),
    ('STAGED', 'UPLOADED'),
    ('QUEUED', 'UPLOADED'),
    ('PROCESSING', 'UPLOADED'),
    ('PROCESSED', 'UPLOADED'),
    ('NEEDS_REVIEW', 'RIGHTS_REVIEW_REQUIRED'),
    ('FAILED', 'PROCESSING_BLOCKED'),
    ('QUARANTINED', 'QUARANTINED')
), changed AS (
  UPDATE research_source_containers c
  SET processing_state = m.new_state, updated_at = now()
  FROM mapping m
  WHERE c.processing_state = m.old_state
    AND c.processing_state <> m.new_state
  RETURNING c.id, m.old_state, m.new_state
)
INSERT INTO research_transformations (container_id, kind, detail, actor)
SELECT id, 'state-vocabulary-migration',
       jsonb_build_object('migration', '0002-phase01', 'from', old_state, 'to', new_state),
       'migration:0002-phase01'
FROM changed;

-- 4) Migrate job states, recording the reversible mapping as audit events.
WITH mapping (old_state, new_state) AS (
  VALUES
    ('queued', 'QUEUED'),
    ('running', 'RUNNING'),
    ('succeeded', 'SUCCEEDED'),
    ('failed', 'FAILED_RETRYABLE'),
    ('dead', 'FAILED_PERMANENT')
), changed AS (
  UPDATE research_jobs j
  SET state = m.new_state
  FROM mapping m
  WHERE j.state = m.old_state
  RETURNING j.id, m.old_state, m.new_state
)
INSERT INTO research_audit_events (entity_type, entity_id, event, from_state, to_state, actor, detail)
SELECT 'job', id, 'state-vocabulary-migration', old_state, new_state,
       'migration:0002-phase01', jsonb_build_object('migration', '0002-phase01')
FROM changed;

COMMIT;
-- Phase 02 migration (ADR 0003): roles, rights vocabulary, rights-record
-- expansion. Applied with psql (never interactive drizzle push). Idempotent:
-- safe to re-run.
BEGIN;



-- 2) Additive 17-field rights capture on research_rights_records.
ALTER TABLE research_rights_records
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS date_obtained timestamptz,
  ADD COLUMN IF NOT EXISTS declared_source_type text,
  ADD COLUMN IF NOT EXISTS licence_reference text,
  ADD COLUMN IF NOT EXISTS approved_users jsonb,
  ADD COLUMN IF NOT EXISTS approved_purposes jsonb,
  ADD COLUMN IF NOT EXISTS storage_permitted boolean,
  ADD COLUMN IF NOT EXISTS analysis_permitted boolean,
  ADD COLUMN IF NOT EXISTS external_processing_permitted boolean,
  ADD COLUMN IF NOT EXISTS student_access_permitted boolean,
  ADD COLUMN IF NOT EXISTS printing_permitted boolean,
  ADD COLUMN IF NOT EXISTS export_permitted boolean,
  ADD COLUMN IF NOT EXISTS retention_period text,
  ADD COLUMN IF NOT EXISTS expiry_date timestamptz,
  ADD COLUMN IF NOT EXISTS reviewer text,
  ADD COLUMN IF NOT EXISTS review_date timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

-- 3) Role vocabulary migration (reversible mapping recorded as audit events).
ALTER TABLE research_users ALTER COLUMN role SET DEFAULT 'guest';
WITH mapping (old_role, new_role) AS (
  VALUES
    ('reviewer', 'rights_reviewer'),
    ('admin', 'administrator')
), changed AS (
  UPDATE research_users u
  SET role = m.new_role
  FROM mapping m
  WHERE u.role = m.old_role
  RETURNING u.id, m.old_role, m.new_role
)
INSERT INTO research_audit_events (entity_type, entity_id, event, from_state, to_state, actor, detail)
SELECT 'user', id, 'role-vocabulary-migration', old_role, new_role,
       'migration:0003-phase02', jsonb_build_object('migration', '0003-phase02')
FROM changed;

-- 4) Rights vocabulary migration on containers (legacy 4 -> new 13),
--    recording a reversible mapping per changed row as a transformation.
WITH mapping (old_status, new_status) AS (
  VALUES
    ('CLEARED_INTERNAL', 'PRIVATE_PROCESSING_APPROVED'),
    ('RESTRICTED', 'MANUAL_LEGAL_REVIEW_REQUIRED'),
    ('EXCLUDED', 'DO_NOT_PROCESS')
), changed AS (
  UPDATE research_source_containers c
  SET rights_status = m.new_status, updated_at = now()
  FROM mapping m
  WHERE c.rights_status = m.old_status
  RETURNING c.id, m.old_status, m.new_status
)
INSERT INTO research_transformations (container_id, kind, detail, actor)
SELECT id, 'rights-vocabulary-migration',
       jsonb_build_object('migration', '0003-phase02', 'from', old_status, 'to', new_status),
       'migration:0003-phase02'
FROM changed;

-- 5) Same mapping for historical rights records (append-only history keeps
--    row identity; only the vocabulary token is modernised, and the original
--    token is preserved in detail.legacyStatus).
UPDATE research_rights_records r
SET detail = r.detail || jsonb_build_object('legacyStatus', r.status),
    status = m.new_status
FROM (
  VALUES
    ('CLEARED_INTERNAL', 'PRIVATE_PROCESSING_APPROVED'),
    ('RESTRICTED', 'MANUAL_LEGAL_REVIEW_REQUIRED'),
    ('EXCLUDED', 'DO_NOT_PROCESS')
) AS m (old_status, new_status)
WHERE r.status = m.old_status;

COMMIT;
-- Phase 03 migration (ADR 0004): secure upload, container inventory &
-- failure isolation. Additive only; applied with psql (never interactive
-- drizzle push). Idempotent: safe to re-run.
BEGIN;

CREATE TABLE IF NOT EXISTS research_upload_batches (
  id serial PRIMARY KEY,
  declared_source text NOT NULL,
  uploaded_by text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  total_items integer NOT NULL DEFAULT 0,
  provenance jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_upload_batch_items (
  id serial PRIMARY KEY,
  batch_id integer NOT NULL REFERENCES research_upload_batches(id),
  original_path text NOT NULL,
  state text NOT NULL DEFAULT 'PENDING',
  container_id integer REFERENCES research_source_containers(id),
  duplicate_of_container_id integer REFERENCES research_source_containers(id),
  job_id integer REFERENCES research_jobs(id),
  content_sha256 text,
  size_bytes integer,
  mime_type text,
  staging_key text,
  error_report jsonb,
  retry_count integer NOT NULL DEFAULT 0,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_upload_batch_items_batch_idx
  ON research_upload_batch_items (batch_id);

CREATE TABLE IF NOT EXISTS research_container_inventories (
  id serial PRIMARY KEY,
  container_id integer NOT NULL REFERENCES research_source_containers(id),
  job_id integer REFERENCES research_jobs(id),
  label text NOT NULL,
  file_type text NOT NULL,
  page_count integer,
  text_char_count integer NOT NULL DEFAULT 0,
  blank_page_count integer,
  damaged_page_count integer,
  ocr_probable boolean NOT NULL DEFAULT false,
  case_title_region_count integer NOT NULL DEFAULT 0,
  repeated_lines jsonb NOT NULL DEFAULT '[]',
  commercial_markers jsonb NOT NULL DEFAULT '[]',
  multi_case_possible boolean NOT NULL DEFAULT false,
  detail jsonb NOT NULL DEFAULT '{}',
  provenance jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS research_container_inventories_container_job_uq
  ON research_container_inventories (container_id, job_id);

-- Useful for SHA-256 duplicate detection at ingest time.
CREATE INDEX IF NOT EXISTS research_source_containers_sha_idx
  ON research_source_containers (content_sha256);

COMMIT;
-- Phase 03 hardening: race-safe SHA-256 duplicate detection.
-- Concurrent ingest jobs previously used read-then-insert dedup; a unique
-- index makes duplicate registration impossible at the database level.
-- Precondition (verified before applying): no duplicate content_sha256
-- values exist in research_source_containers.

CREATE UNIQUE INDEX IF NOT EXISTS research_source_containers_content_sha256_uq
  ON research_source_containers (content_sha256);
-- Phase 04 migration (ADR 0005): page-level extraction & OCR adapters.
-- Additive only; applied with psql. Idempotent: safe to re-run.
BEGIN;

CREATE TABLE IF NOT EXISTS research_extraction_runs (
  id serial PRIMARY KEY,
  container_id integer NOT NULL REFERENCES research_source_containers(id),
  job_id integer REFERENCES research_jobs(id),
  run_key text NOT NULL,
  processor_version text NOT NULL,
  adapters jsonb NOT NULL,
  source_checksum text NOT NULL,
  page_count integer,
  status text NOT NULL DEFAULT 'RUNNING',
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS research_extraction_runs_container_key_uq
  ON research_extraction_runs (container_id, run_key);

CREATE TABLE IF NOT EXISTS research_page_extractions (
  id serial PRIMARY KEY,
  run_id integer NOT NULL REFERENCES research_extraction_runs(id),
  page_id integer NOT NULL REFERENCES research_source_pages(id),
  mode text NOT NULL,
  raw_text text NOT NULL,
  raw_text_sha256 text NOT NULL,
  char_start integer NOT NULL,
  char_end integer NOT NULL,
  image_storage_key text,
  image_sha256 text,
  ocr_mean_confidence integer,
  rotation_degrees integer,
  rotation_confidence integer,
  languages jsonb NOT NULL DEFAULT '[]',
  is_blank boolean NOT NULL DEFAULT false,
  provenance jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS research_page_extractions_run_page_uq
  ON research_page_extractions (run_id, page_id);

CREATE TABLE IF NOT EXISTS research_page_blocks (
  id serial PRIMARY KEY,
  page_extraction_id integer NOT NULL REFERENCES research_page_extractions(id),
  block_index integer NOT NULL,
  block_type text NOT NULL,
  text text NOT NULL,
  bbox jsonb,
  char_start integer NOT NULL,
  char_end integer NOT NULL,
  reading_order integer NOT NULL,
  column_index integer,
  font jsonb,
  confidence integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS research_page_blocks_extraction_index_uq
  ON research_page_blocks (page_extraction_id, block_index);

CREATE TABLE IF NOT EXISTS research_page_warnings (
  id serial PRIMARY KEY,
  page_extraction_id integer NOT NULL REFERENCES research_page_extractions(id),
  code text NOT NULL,
  coordinates jsonb,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_page_warnings_extraction_idx
  ON research_page_warnings (page_extraction_id);

CREATE TABLE IF NOT EXISTS research_page_corrections (
  id serial PRIMARY KEY,
  page_extraction_id integer NOT NULL REFERENCES research_page_extractions(id),
  version integer NOT NULL,
  raw_output text NOT NULL,
  corrected_text text NOT NULL,
  reviewer text NOT NULL,
  reason text NOT NULL,
  processor_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS research_page_corrections_extraction_version_uq
  ON research_page_corrections (page_extraction_id, version);

COMMIT;
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
-- Phase 05 addendum: idempotent candidate persistence.
-- Adds start_page_id (denormalized) and a partial unique index so that
-- ON CONFLICT DO NOTHING can prevent duplicate candidate rows on job retry.
-- Additive only; safe to re-run.
BEGIN;

ALTER TABLE research_case_candidates
  ADD COLUMN IF NOT EXISTS start_page_id integer;

-- Partial unique index: only enforced when start_page_id is NOT NULL
-- (old rows without start_page_id are not affected).
CREATE UNIQUE INDEX IF NOT EXISTS research_case_candidates_run_container_startpage_uq
  ON research_case_candidates (run_id, container_id, start_page_id)
  WHERE start_page_id IS NOT NULL;

COMMIT;
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
BEGIN;

-- Phase 07: Publisher-Content Isolation & Verified Judicial Text (ADR 0008).
-- Adds three tables:
--   research_page_sections        — per-block classification within a page
--   research_editorial_runs       — one row per editorial classification pass
--   research_verified_judgments   — verified judgment record (one per candidate)

-- ── research_editorial_runs (must precede page_sections FK) ───────────────

CREATE TABLE IF NOT EXISTS research_editorial_runs (
  id serial PRIMARY KEY,
  container_id integer NOT NULL REFERENCES research_source_containers(id),
  job_id integer REFERENCES research_jobs(id),
  processor_version text NOT NULL,
  section_count integer NOT NULL DEFAULT 0,
  uncertain_count integer NOT NULL DEFAULT 0,
  suspected_editorial_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── research_page_sections ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research_page_sections (
  id serial PRIMARY KEY,
  container_id integer NOT NULL REFERENCES research_source_containers(id),
  page_id integer NOT NULL REFERENCES research_source_pages(id),
  editorial_run_id integer REFERENCES research_editorial_runs(id),
  block_id integer,
  section_index integer NOT NULL,
  classification text NOT NULL
    CHECK (classification IN (
      'VERIFIED_JUDICIAL_TEXT',
      'PROBABLE_JUDICIAL_TEXT',
      'SUSPECTED_PUBLISHER_EDITORIAL',
      'ADMINISTRATIVE_METADATA',
      'SOURCE_ARTIFACT',
      'UNKNOWN',
      'MANUAL_REVIEW_REQUIRED'
    )),
  -- Stored as integer 0–100 (avoids NUMERIC precision in jsonb round-trips).
  confidence integer NOT NULL DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
  supporting_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  detector_version text NOT NULL,
  reviewer_decision text
    CHECK (reviewer_decision IS NULL OR reviewer_decision IN (
      'VERIFIED_JUDICIAL_TEXT',
      'PROBABLE_JUDICIAL_TEXT',
      'SUSPECTED_PUBLISHER_EDITORIAL',
      'ADMINISTRATIVE_METADATA',
      'SOURCE_ARTIFACT',
      'UNKNOWN',
      'MANUAL_REVIEW_REQUIRED'
    )),
  reviewer_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  isolation_applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS research_page_sections_container_page_idx_uq
  ON research_page_sections (container_id, page_id, section_index);

CREATE INDEX IF NOT EXISTS research_page_sections_container_idx
  ON research_page_sections (container_id);

CREATE INDEX IF NOT EXISTS research_page_sections_classification_idx
  ON research_page_sections (classification);

-- ── research_verified_judgments ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research_verified_judgments (
  id serial PRIMARY KEY,
  candidate_id integer NOT NULL UNIQUE REFERENCES research_case_candidates(id),
  container_id integer NOT NULL REFERENCES research_source_containers(id),
  editorial_run_id integer REFERENCES research_editorial_runs(id),
  page_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  paragraph_identifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- SHA-256 of concatenated ordered judicial text (hex string, 64 chars)
  text_checksum text NOT NULL,
  unresolved_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  verified_by text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_verified_judgments_container_idx
  ON research_verified_judgments (container_id);

COMMIT;
BEGIN;

-- Phase 07 (ADR 0008) supplementary migration.
-- Adds provenance fields required by ADR 0008 section 6 to
-- research_verified_judgments, and char-level span fields (nullable) to
-- research_page_sections for section-level source provenance.

-- ── research_page_sections: character-span provenance ────────────────────

ALTER TABLE research_page_sections
  ADD COLUMN IF NOT EXISTS span_start_char integer,
  ADD COLUMN IF NOT EXISTS span_end_char   integer;

-- ── research_verified_judgments: ADR 0008 §6 required fields ─────────────
--
-- approved_judicial_spans — ordered array of { sectionId, pageId,
--   sectionIndex, classification } for judicial sections that passed the
--   isolation gate.
-- source_refs             — provenance to source containers:
--   [{ containerId, contentSha256, originalName }]
-- original_page_refs      — original source-document page numbers (integers)
--   for the judicial span (distinct from internal DB page IDs).

ALTER TABLE research_verified_judgments
  ADD COLUMN IF NOT EXISTS approved_judicial_spans jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_refs             jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS original_page_refs      jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
BEGIN;

-- Phase 07 supplementary migration: add explicit critical/non-critical warning
-- fields to research_verified_judgments (ADR 0008 §6 requires separation).
--
-- critical_integrity_warnings  — always [] on verified records (422 blocks
--   non-empty lists); stored explicitly to prove the check passed.
-- unresolved_non_critical_warnings — replaces the ambiguously named
--   unresolved_warnings (which stays for backward compat).

ALTER TABLE research_verified_judgments
  ADD COLUMN IF NOT EXISTS critical_integrity_warnings        jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS unresolved_non_critical_warnings   jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Back-fill: promote existing unresolved_warnings → unresolved_non_critical_warnings
UPDATE research_verified_judgments
SET unresolved_non_critical_warnings = unresolved_warnings
WHERE unresolved_non_critical_warnings = '[]'::jsonb
  AND unresolved_warnings != '[]'::jsonb;

COMMIT;
BEGIN;

-- Phase 07 alignment migration: bring research_page_sections and
-- research_editorial_runs into exact conformance with the TypeScript schema
-- (lib/db/src/schema/research.ts) and route/processor column usage.
--
-- Changes vs 0010-phase07-isolation.sql:
--
--   research_page_sections
--   ─────────────────────
--   1. confidence: integer 0–100  →  double precision (real) 0.0–1.0
--      Existing values rescaled by dividing by 100 where > 1.0.
--   2. page_id: NOT NULL  →  nullable
--      ADR 0008 permits span-only sections that are not anchored to a page row.
--   3. reviewed_by text / reviewed_at timestamptz  →  dropped
--      Replaced by:
--        reviewer_id         integer REFERENCES research_users(id)
--        reviewer_decided_at timestamptz
--        notes               text
--
--   research_editorial_runs
--   ───────────────────────
--   4. critical_warning_count integer NOT NULL DEFAULT 0
--   5. non_critical_warning_count integer NOT NULL DEFAULT 0
--      Editorial processor persists completeness warning counts in the run row.

-- ── 1. confidence: integer → double precision ──────────────────────────────

ALTER TABLE research_page_sections
  ALTER COLUMN confidence TYPE double precision
    USING confidence::double precision;

-- Rescale rows that were stored as 0–100 integers (> 1 means pre-migration)
UPDATE research_page_sections
SET confidence = confidence / 100.0
WHERE confidence > 1.0;

-- Remove old integer CHECK constraint (if any) and add a real-value one.
-- PostgreSQL names inline column constraints automatically; we drop by name
-- if present, then add the correct one.
ALTER TABLE research_page_sections
  DROP CONSTRAINT IF EXISTS research_page_sections_confidence_check;

ALTER TABLE research_page_sections
  ADD CONSTRAINT research_page_sections_confidence_check
    CHECK (confidence >= 0.0 AND confidence <= 1.0);

-- ── 2. page_id: NOT NULL → nullable ───────────────────────────────────────

ALTER TABLE research_page_sections
  ALTER COLUMN page_id DROP NOT NULL;

-- The unique index must also tolerate nulls (PostgreSQL treats each NULL as
-- distinct, so the UNIQUE constraint is still safe; no action needed).

-- ── 3. Drop reviewed_by / reviewed_at; add reviewer_id FK + decided_at + notes ──

ALTER TABLE research_page_sections
  DROP COLUMN IF EXISTS reviewed_by,
  DROP COLUMN IF EXISTS reviewed_at;

ALTER TABLE research_page_sections
  ADD COLUMN IF NOT EXISTS reviewer_id          integer REFERENCES research_users(id),
  ADD COLUMN IF NOT EXISTS reviewer_decided_at  timestamptz,
  ADD COLUMN IF NOT EXISTS notes                text;

-- ── 4–5. Add warning count columns to research_editorial_runs ─────────────

ALTER TABLE research_editorial_runs
  ADD COLUMN IF NOT EXISTS critical_warning_count     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS non_critical_warning_count integer NOT NULL DEFAULT 0;

COMMIT;
BEGIN;

-- Phase 08: Search & Research UI (ADR 0009).
-- Adds five tables:
--   research_case_metadata    — per-field structured metadata per judgment
--   research_duplicate_links  — duplicate/version links between judgments
--   research_annotations      — per-user annotations on judgments
--   research_bookmarks        — per-user bookmarks on judgments
--   research_search_index     — FTS document index (tsvector via GIN)

-- ── research_case_metadata ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research_case_metadata (
  id serial PRIMARY KEY,
  judgment_id integer NOT NULL REFERENCES research_verified_judgments(id),
  container_id integer NOT NULL REFERENCES research_source_containers(id),
  field_name text NOT NULL CHECK (field_name IN (
    'caseName', 'neutralCitation', 'reportCitation', 'court', 'registry',
    'proceedingNumber', 'judges', 'hearingDate', 'decisionDate', 'parties',
    'jurisdiction', 'proceduralPosture', 'language'
  )),
  value jsonb NOT NULL,
  source_page_id integer REFERENCES research_source_pages(id),
  source_char_start integer,
  source_char_end integer,
  confidence double precision NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  method text NOT NULL CHECK (method IN ('regex', 'heuristic')),
  processor_version text NOT NULL,
  reviewer_status text NOT NULL DEFAULT 'pending'
    CHECK (reviewer_status IN ('pending', 'approved', 'rejected')),
  reviewer_id integer REFERENCES research_users(id),
  reviewer_decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_case_metadata_judgment_idx
  ON research_case_metadata (judgment_id);
CREATE INDEX IF NOT EXISTS research_case_metadata_field_idx
  ON research_case_metadata (field_name);
CREATE INDEX IF NOT EXISTS research_case_metadata_container_idx
  ON research_case_metadata (container_id);

-- ── research_duplicate_links ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research_duplicate_links (
  id serial PRIMARY KEY,
  source_judgment_id integer NOT NULL REFERENCES research_verified_judgments(id),
  target_judgment_id integer NOT NULL REFERENCES research_verified_judgments(id),
  link_type text NOT NULL CHECK (link_type IN (
    'EXACT_DUPLICATE', 'POSSIBLE_DUPLICATE', 'ALTERNATIVE_VERSION',
    'POSSIBLE_CONTINUATION', 'RELATED_APPEAL'
  )),
  evidence jsonb NOT NULL DEFAULT '{}',
  similarity_score double precision NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  detected_by text NOT NULL,
  reviewer_status text NOT NULL DEFAULT 'pending'
    CHECK (reviewer_status IN ('pending', 'confirmed', 'rejected')),
  reviewer_id integer REFERENCES research_users(id),
  reviewer_decided_at timestamptz,
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_judgment_id, target_judgment_id)
);

CREATE INDEX IF NOT EXISTS research_duplicate_links_source_idx
  ON research_duplicate_links (source_judgment_id);
CREATE INDEX IF NOT EXISTS research_duplicate_links_target_idx
  ON research_duplicate_links (target_judgment_id);

-- ── research_annotations ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research_annotations (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES research_users(id),
  judgment_id integer NOT NULL REFERENCES research_verified_judgments(id),
  paragraph_ref text,
  kind text NOT NULL DEFAULT 'note' CHECK (kind IN ('note', 'highlight', 'flag')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_annotations_judgment_idx
  ON research_annotations (judgment_id);
CREATE INDEX IF NOT EXISTS research_annotations_user_idx
  ON research_annotations (user_id);

-- ── research_bookmarks ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research_bookmarks (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES research_users(id),
  judgment_id integer NOT NULL REFERENCES research_verified_judgments(id),
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, judgment_id)
);

CREATE INDEX IF NOT EXISTS research_bookmarks_user_idx
  ON research_bookmarks (user_id);

-- ── research_search_index ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS research_search_index (
  id serial PRIMARY KEY,
  judgment_id integer NOT NULL UNIQUE REFERENCES research_verified_judgments(id),
  container_id integer NOT NULL REFERENCES research_source_containers(id),
  -- Plain text of the judicial corpus (isolation gate applied)
  document_text text NOT NULL,
  -- English-stemmed tsvector
  document tsvector GENERATED ALWAYS AS (to_tsvector('english', document_text)) STORED,
  -- Simple (unstemmed) tsvector for Malay/romanised terms
  document_ms tsvector GENERATED ALWAYS AS (to_tsvector('simple', document_text)) STORED,
  processor_version text NOT NULL,
  court text,
  decision_date timestamptz,
  language text,
  indexed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_search_index_container_idx
  ON research_search_index (container_id);
CREATE INDEX IF NOT EXISTS research_search_index_court_idx
  ON research_search_index (court);
CREATE INDEX IF NOT EXISTS research_search_index_date_idx
  ON research_search_index (decision_date);

-- GIN indexes for fast full-text search
CREATE INDEX IF NOT EXISTS research_search_index_document_gin
  ON research_search_index USING gin(document);
CREATE INDEX IF NOT EXISTS research_search_index_document_ms_gin
  ON research_search_index USING gin(document_ms);

COMMIT;
-- Phase 09: Exact Quotations & Citation Tools
-- Creates research_quotations and research_quotation_alterations tables.

CREATE TABLE IF NOT EXISTS research_quotations (
  id                    serial          PRIMARY KEY,
  judgment_id           integer         NOT NULL REFERENCES research_verified_judgments(id),
  case_name             text,
  citation              text,
  court                 text,
  judge                 text,
  decision_date         text,
  paragraph_identifier  text,
  source_page_id        integer         REFERENCES research_source_pages(id),
  selected_text         text            NOT NULL,
  char_start            integer         NOT NULL,
  char_end              integer         NOT NULL,
  source_checksum       text            NOT NULL,
  creator_id            integer         NOT NULL REFERENCES research_users(id),
  created_at            timestamptz     NOT NULL DEFAULT now(),
  user_note             text,
  kind                  text            NOT NULL DEFAULT 'exact'
);

CREATE INDEX IF NOT EXISTS research_quotations_judgment_idx ON research_quotations(judgment_id);
CREATE INDEX IF NOT EXISTS research_quotations_creator_idx  ON research_quotations(creator_id);

CREATE TABLE IF NOT EXISTS research_quotation_alterations (
  id                serial      PRIMARY KEY,
  quotation_id      integer     NOT NULL REFERENCES research_quotations(id),
  kind              text        NOT NULL,
  position_start    integer     NOT NULL,
  position_end      integer     NOT NULL,
  original_text     text        NOT NULL,
  replacement_text  text        NOT NULL,
  recorded_at       timestamptz NOT NULL DEFAULT now(),
  recorded_by       integer     NOT NULL REFERENCES research_users(id)
);

CREATE INDEX IF NOT EXISTS research_quotation_alterations_quotation_idx ON research_quotation_alterations(quotation_id);
-- Phase 10: AI-Generated Headnotes & Case Analysis
-- Creates research_ai_providers, research_ai_analysis_runs, and
-- research_ai_propositions tables.
-- Also extends the research_case_metadata.method CHECK constraint to include
-- the new 'publisher_supplied' method (required by the AI input boundary).

-- Extend the method CHECK constraint to include 'publisher_supplied'.
-- The prior constraint only allowed 'regex' and 'heuristic'.
ALTER TABLE research_case_metadata
  DROP CONSTRAINT IF EXISTS research_case_metadata_method_check;
ALTER TABLE research_case_metadata
  ADD CONSTRAINT research_case_metadata_method_check
  CHECK (method = ANY (ARRAY['regex'::text, 'heuristic'::text, 'publisher_supplied'::text]));

CREATE TABLE IF NOT EXISTS research_ai_providers (
  id              serial           PRIMARY KEY,
  name            text             NOT NULL,           -- 'gemini' | 'openai'
  enabled         boolean          NOT NULL DEFAULT false,
  model_name      text             NOT NULL,           -- e.g. 'gemini-2.5-flash'
  temperature     double precision NOT NULL DEFAULT 0.2,
  max_tokens      integer          NOT NULL DEFAULT 8192,
  prompt_version  text             NOT NULL DEFAULT 'analysis@1',
  approved_by     text,
  approved_at     timestamptz,
  created_at      timestamptz      NOT NULL DEFAULT now(),
  updated_at      timestamptz      NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_ai_analysis_runs (
  id                         serial      PRIMARY KEY,
  judgment_id                integer     NOT NULL REFERENCES research_verified_judgments(id),
  provider_id                integer     NOT NULL REFERENCES research_ai_providers(id),
  prompt_version             text        NOT NULL,
  model_version              text        NOT NULL,
  raw_output_storage_key     text,
  status                     text        NOT NULL DEFAULT 'DRAFT',
  reviewer_email             text,
  review_notes               text,
  evidence_validation_result jsonb,
  critical_warning_count     integer     NOT NULL DEFAULT 0,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  reviewed_at                timestamptz,
  approved_at                timestamptz
);

CREATE INDEX IF NOT EXISTS research_ai_analysis_runs_judgment_idx
  ON research_ai_analysis_runs(judgment_id);
CREATE INDEX IF NOT EXISTS research_ai_analysis_runs_status_idx
  ON research_ai_analysis_runs(status);

CREATE TABLE IF NOT EXISTS research_ai_propositions (
  id                       serial      PRIMARY KEY,
  run_id                   integer     NOT NULL REFERENCES research_ai_analysis_runs(id),
  proposition_id           text        NOT NULL,    -- UUID from AI output
  field_name               text        NOT NULL,    -- one of 17 AI output field names
  content                  text        NOT NULL,
  supporting_paragraph_ids jsonb       NOT NULL DEFAULT '[]',
  validated_passages       jsonb       NOT NULL DEFAULT '[]',
  confidence_category      text        NOT NULL,
  uncertainty_label        text,
  review_status            text        NOT NULL DEFAULT 'pending',
  reviewer_email           text,
  reviewed_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_ai_propositions_run_idx
  ON research_ai_propositions(run_id);
CREATE UNIQUE INDEX IF NOT EXISTS research_ai_propositions_run_prop_uq
  ON research_ai_propositions(run_id, proposition_id);
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
-- Phase 11b: Research Workspace
-- Adds workspace tables (folders, saved searches, reading lists, quotation
-- collections, comparison tables, authorities tables) and extends existing
-- bookmarks and annotations tables.

-- Extend research_annotations with highlight coordinates, tags, and visibility.
ALTER TABLE research_annotations
  ADD COLUMN IF NOT EXISTS char_start  integer,
  ADD COLUMN IF NOT EXISTS char_end    integer,
  ADD COLUMN IF NOT EXISTS tags        jsonb,
  ADD COLUMN IF NOT EXISTS is_public   boolean NOT NULL DEFAULT false;

-- Extend research_bookmarks with folder association.
-- (label column already exists from Phase 09.)
-- We add folder_id after research_folders is created below.

-- Folders
CREATE TABLE IF NOT EXISTS research_folders (
  id                  serial      PRIMARY KEY,
  owner_id            integer     NOT NULL REFERENCES research_users(id),
  kind                text        NOT NULL DEFAULT 'research',  -- research|course|matter
  name                text        NOT NULL,
  description         text,
  shared_with_students boolean    NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_folders_owner_idx ON research_folders(owner_id);

-- Folder items (unique membership)
CREATE TABLE IF NOT EXISTS research_folder_items (
  id            serial      PRIMARY KEY,
  folder_id     integer     NOT NULL REFERENCES research_folders(id) ON DELETE CASCADE,
  judgment_id   integer     NOT NULL REFERENCES research_verified_judgments(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS research_folder_items_folder_judgment_uq
  ON research_folder_items(folder_id, judgment_id);
CREATE INDEX IF NOT EXISTS research_folder_items_folder_idx ON research_folder_items(folder_id);
CREATE INDEX IF NOT EXISTS research_folder_items_judgment_idx ON research_folder_items(judgment_id);

-- Now add folder_id FK to bookmarks
ALTER TABLE research_bookmarks
  ADD COLUMN IF NOT EXISTS folder_id integer REFERENCES research_folders(id);

-- Saved searches
CREATE TABLE IF NOT EXISTS research_saved_searches (
  id          serial      PRIMARY KEY,
  owner_id    integer     NOT NULL REFERENCES research_users(id),
  name        text        NOT NULL,
  query       jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_saved_searches_owner_idx ON research_saved_searches(owner_id);

-- Reading lists
CREATE TABLE IF NOT EXISTS research_reading_lists (
  id                   serial      PRIMARY KEY,
  owner_id             integer     NOT NULL REFERENCES research_users(id),
  name                 text        NOT NULL,
  shared_with_students boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_reading_lists_owner_idx ON research_reading_lists(owner_id);

-- Reading list items
CREATE TABLE IF NOT EXISTS research_reading_list_items (
  id            serial      PRIMARY KEY,
  list_id       integer     NOT NULL REFERENCES research_reading_lists(id) ON DELETE CASCADE,
  judgment_id   integer     NOT NULL REFERENCES research_verified_judgments(id),
  position      integer     NOT NULL DEFAULT 0,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS research_reading_list_items_list_judgment_uq
  ON research_reading_list_items(list_id, judgment_id);
CREATE INDEX IF NOT EXISTS research_reading_list_items_list_idx ON research_reading_list_items(list_id);

-- Quotation collections
CREATE TABLE IF NOT EXISTS research_quotation_collections (
  id          serial      PRIMARY KEY,
  owner_id    integer     NOT NULL REFERENCES research_users(id),
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_quotation_collections_owner_idx
  ON research_quotation_collections(owner_id);

-- Saved quotation passages (linked to AI propositions)
CREATE TABLE IF NOT EXISTS research_workspace_quotations (
  id              serial      PRIMARY KEY,
  collection_id   integer     NOT NULL REFERENCES research_quotation_collections(id) ON DELETE CASCADE,
  proposition_id  integer     NOT NULL REFERENCES research_ai_propositions(id),
  passage_text    text        NOT NULL,
  label           text,
  char_start      integer,
  char_end        integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_workspace_quotations_collection_idx
  ON research_workspace_quotations(collection_id);

-- Case-comparison tables (config stored; grid assembled on read)
CREATE TABLE IF NOT EXISTS research_comparison_tables (
  id            serial      PRIMARY KEY,
  owner_id      integer     NOT NULL REFERENCES research_users(id),
  name          text        NOT NULL,
  judgment_ids  jsonb       NOT NULL DEFAULT '[]',
  field_names   jsonb       NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_comparison_tables_owner_idx ON research_comparison_tables(owner_id);

-- Authorities tables (scoped to judgment IDs; populated from Phase 11a)
CREATE TABLE IF NOT EXISTS research_authorities_tables (
  id            serial      PRIMARY KEY,
  owner_id      integer     NOT NULL REFERENCES research_users(id),
  name          text        NOT NULL,
  judgment_ids  jsonb       NOT NULL DEFAULT '[]',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_authorities_tables_owner_idx ON research_authorities_tables(owner_id);
-- Phase 12a: Add indexes on research_audit_events for the admin query route.
-- The existing index covers (entity_type, entity_id); we add actor, event,
-- and created_at to support filtered paginated queries efficiently.

CREATE INDEX IF NOT EXISTS research_audit_events_actor_idx
  ON research_audit_events (actor);

CREATE INDEX IF NOT EXISTS research_audit_events_event_idx
  ON research_audit_events (event);

CREATE INDEX IF NOT EXISTS research_audit_events_created_at_idx
  ON research_audit_events (created_at DESC);
-- Phase 12c: Per-layer granular deletion with manifest tracking.
-- Manifests are stored in object storage; this table records the key
-- so the manifest can be retrieved by container.

CREATE TABLE IF NOT EXISTS research_deletion_manifests (
  id           serial PRIMARY KEY,
  container_id int  NOT NULL REFERENCES research_source_containers(id),
  requested_at timestamptz NOT NULL,
  actor        text NOT NULL,
  layers_requested jsonb NOT NULL,
  manifest_key text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_deletion_manifests_container_idx
  ON research_deletion_manifests (container_id);
-- Phase 12c (addendum): Store full manifest JSON in the DB row so manifest
-- history is queryable even when object storage is temporarily unavailable.
ALTER TABLE research_deletion_manifests
  ADD COLUMN IF NOT EXISTS manifest_body jsonb;
-- Migration 0022: bind uploaded documents to their submitter (Task #7).
-- Adds uploaded_by to research_source_containers so every container records
-- who uploaded it. Nullable so existing rows remain valid.

ALTER TABLE research_source_containers
  ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
-- Migration 0023: subscriber chat isolation for CCB and Lit portals (Task #21).
-- Adds access_code_id to conversation tables so each subscriber's chat history
-- is invisible to other subscribers. Nullable for backward compatibility with
-- conversations created before this migration, and for admin/static-code sessions.

ALTER TABLE ccb_conversations
  ADD COLUMN IF NOT EXISTS access_code_id INTEGER
    REFERENCES ccb_access_codes(id) ON DELETE CASCADE;

ALTER TABLE lit_conversations
  ADD COLUMN IF NOT EXISTS access_code_id INTEGER
    REFERENCES lit_access_codes(id) ON DELETE CASCADE;
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
-- HR module for MyLawFirmAi
-- Employee HR profiles, leave management, attendance, payroll.

CREATE TABLE IF NOT EXISTS firm_hr_profiles (
  user_id          integer PRIMARY KEY REFERENCES firm_users(id) ON DELETE CASCADE,
  ic_number        text,
  position         text,
  department       text,
  employment_type  text NOT NULL DEFAULT 'full_time',
  employment_start text,
  employment_end   text,
  salary           double precision NOT NULL DEFAULT 0,
  epf_number       text,
  socso_number     text,
  pcb_number       text,
  bank_name        text,
  bank_account     text,
  emergency_name   text,
  emergency_phone  text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS firm_hr_leave_entitlements (
  id           serial PRIMARY KEY,
  user_id      integer NOT NULL REFERENCES firm_users(id) ON DELETE CASCADE,
  year         integer NOT NULL,
  leave_type   text NOT NULL,
  entitlement  double precision NOT NULL DEFAULT 0,
  used         double precision NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, leave_type)
);

CREATE TABLE IF NOT EXISTS firm_hr_leave_requests (
  id             serial PRIMARY KEY,
  user_id        integer NOT NULL REFERENCES firm_users(id) ON DELETE CASCADE,
  leave_type     text NOT NULL,
  start_date     text NOT NULL,
  end_date       text NOT NULL,
  days_requested double precision NOT NULL,
  reason         text,
  status         text NOT NULL DEFAULT 'pending',
  manager_notes  text,
  reviewed_by    integer REFERENCES firm_users(id),
  reviewed_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS firm_hr_leave_req_user_idx ON firm_hr_leave_requests(user_id);
CREATE INDEX IF NOT EXISTS firm_hr_leave_req_status_idx ON firm_hr_leave_requests(status);

CREATE TABLE IF NOT EXISTS firm_hr_attendance (
  id         serial PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES firm_users(id) ON DELETE CASCADE,
  work_date  text NOT NULL,
  clock_in   text,
  clock_out  text,
  status     text NOT NULL DEFAULT 'present',
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, work_date)
);
CREATE INDEX IF NOT EXISTS firm_hr_attendance_user_date_idx ON firm_hr_attendance(user_id, work_date);

CREATE TABLE IF NOT EXISTS firm_hr_payroll_runs (
  id         serial PRIMARY KEY,
  month      integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year       integer NOT NULL,
  run_by     integer REFERENCES firm_users(id),
  status     text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

CREATE TABLE IF NOT EXISTS firm_hr_payslips (
  id               serial PRIMARY KEY,
  run_id           integer NOT NULL REFERENCES firm_hr_payroll_runs(id) ON DELETE CASCADE,
  user_id          integer NOT NULL REFERENCES firm_users(id) ON DELETE CASCADE,
  gross_salary     double precision NOT NULL,
  allowances       jsonb NOT NULL DEFAULT '[]',
  epf_employee     double precision NOT NULL DEFAULT 0,
  epf_employer     double precision NOT NULL DEFAULT 0,
  socso_employee   double precision NOT NULL DEFAULT 0,
  socso_employer   double precision NOT NULL DEFAULT 0,
  eis_employee     double precision NOT NULL DEFAULT 0,
  eis_employer     double precision NOT NULL DEFAULT 0,
  pcb              double precision NOT NULL DEFAULT 0,
  other_deductions jsonb NOT NULL DEFAULT '[]',
  total_deductions double precision NOT NULL,
  net_pay          double precision NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, user_id)
);
-- Migration 0029: Bundle of Pleadings uploads + cause-paper linking.
-- Bundle documents gain provenance columns so a row can be a plain manual
-- index entry, an uploaded PDF/DOCX stored in object storage, or a link to a
-- cause paper generated in the app (lit_saved_work).

ALTER TABLE lit_bundle_documents
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS object_path TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS content_type TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS saved_work_id INTEGER;
-- Migration 0030: Persist Stripe alert delivery attempts so ops can audit
-- past failures across server restarts.

CREATE TABLE IF NOT EXISTS alert_delivery_attempts (
  id          SERIAL PRIMARY KEY,
  channel     TEXT        NOT NULL,
  outcome     TEXT        NOT NULL,
  detail      TEXT        NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index that backs the audit-history query (newest-first ORDER BY attempted_at DESC).
CREATE INDEX IF NOT EXISTS idx_alert_delivery_attempts_time
  ON alert_delivery_attempts (attempted_at DESC);
-- Project Sarawak 20: durable, idempotent checkout reservations and paid places.
-- Additive only; safe to apply more than once.

CREATE TABLE IF NOT EXISTS sarawak20_reservations (
  id text PRIMARY KEY,
  cohort text NOT NULL CHECK (cohort IN ('firm', 'chambering')),
  request_id text NOT NULL UNIQUE,
  checkout_session_id text UNIQUE,
  checkout_url text,
  subscription_id text UNIQUE,
  subscriber_id integer,
  status text NOT NULL DEFAULT 'creating'
    CHECK (status IN ('creating', 'reserved', 'consumed', 'released', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sarawak20_reservations_capacity_idx
  ON sarawak20_reservations (cohort, status, expires_at);-- Project Sarawak 20 post-founding AAS plan and eligibility ledger. Additive.
ALTER TABLE sarawak20_reservations
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS eligibility_id text,
  ADD CONSTRAINT sarawak20_reservations_plan_check
    CHECK (plan IN ('legacy', 'firm_founding', 'chambering_founding', 'aas_firm'));

CREATE TABLE IF NOT EXISTS sarawak20_eligibility (
  id text PRIMARY KEY,
  cohort text NOT NULL CHECK (cohort IN ('firm', 'chambering')),
  full_name text NOT NULL,
  firm_name text,
  practice_location text CHECK (practice_location IN ('KUCHING', 'SIBU', 'MIRI', 'BINTULU')),
  advocate_name text,
  pupil_master_name text,
  pupillage_start_date date,
  notice_acknowledgement boolean,
  cms_petition_number text,
  professional_reference text,
  declaration_accepted boolean NOT NULL,
  status text NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'not_verified')),
  source text NOT NULL CHECK (source IN ('aas_directory', 'submitted_details')),
  verified_at timestamptz,
  checkout_session_id text,
  subscription_id text,
  subscriber_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sarawak20_eligibility_cohort_status_idx
  ON sarawak20_eligibility (cohort, status);
CREATE INDEX IF NOT EXISTS sarawak20_eligibility_cache_idx
  ON sarawak20_eligibility (cohort, advocate_name, firm_name, practice_location, status);
CREATE UNIQUE INDEX IF NOT EXISTS sarawak20_eligibility_verified_aas_cache_unique
  ON sarawak20_eligibility (cohort, advocate_name, firm_name, practice_location)
  WHERE cohort = 'firm' AND status = 'verified' AND source = 'aas_directory';-- Task 522: additive LAWYes editorial report model.
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
  FOR EACH ROW EXECUTE FUNCTION reject_lawyes_audit_mutation();-- Task 522 step 11: pending access records for sources that are eligible but
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
  ON research_lawyes_access_records(status);ALTER TABLE lit_matters
  ADD COLUMN IF NOT EXISTS preparation_state jsonb;-- Task 522: reviews are approvals of one immutable editorial content revision.
ALTER TABLE research_lawyes_reviews
  ADD COLUMN IF NOT EXISTS reviewed_revision integer;
UPDATE research_lawyes_reviews
  SET reviewed_revision = 1
  WHERE reviewed_revision IS NULL;
ALTER TABLE research_lawyes_reviews
  ALTER COLUMN reviewed_revision SET NOT NULL;-- Additive language metadata for MyCrimAI precedents. Existing rows retain
-- their IDs and content and are classified as Bahasa Melayu by the default.
ALTER TABLE "cause_papers"
  ADD COLUMN IF NOT EXISTS "language" text NOT NULL DEFAULT 'ms',
  ADD COLUMN IF NOT EXISTS "source_id" integer,
  ADD COLUMN IF NOT EXISTS "stable_key" text;

ALTER TABLE "sample_documents"
  ADD COLUMN IF NOT EXISTS "language" text NOT NULL DEFAULT 'ms',
  ADD COLUMN IF NOT EXISTS "source_id" integer,
  ADD COLUMN IF NOT EXISTS "stable_key" text;

CREATE UNIQUE INDEX IF NOT EXISTS "cause_papers_stable_key_unique"
  ON "cause_papers" ("stable_key");
CREATE UNIQUE INDEX IF NOT EXISTS "sample_documents_stable_key_unique"
  ON "sample_documents" ("stable_key");

ALTER TABLE "cause_papers"
  DROP CONSTRAINT IF EXISTS "cause_papers_language_check";
ALTER TABLE "cause_papers"
  ADD CONSTRAINT "cause_papers_language_check" CHECK ("language" IN ('ms', 'en'));
ALTER TABLE "sample_documents"
  DROP CONSTRAINT IF EXISTS "sample_documents_language_check";
ALTER TABLE "sample_documents"
  ADD CONSTRAINT "sample_documents_language_check" CHECK ("language" IN ('ms', 'en'));-- Additive schema for Drive inventory and reviewed headnotes.
-- These tables were represented in the Drizzle schema but were missing from
-- the forward migration history and fresh research test bootstrap.

DO $$ BEGIN
  CREATE TYPE drive_inventory_status AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE drive_source_classification AS ENUM (
    'OFFICIAL_JUDGMENT',
    'COURT_AUTHORISED_COPY',
    'EXPRESSLY_LICENSED_SOURCE',
    'COMMERCIAL_PUBLISHER_REPORT',
    'UNKNOWN_SOURCE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE drive_rights_status AS ENUM (
    'RESTRICTED_REFERENCE_ONLY',
    'NEEDS_OFFICIAL_SOURCE',
    'RIGHTS_REVIEW_REQUIRED',
    'APPROVED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE drive_processing_status AS ENUM (
    'PENDING',
    'RIGHTS_PENDING',
    'RIGHTS_APPROVED',
    'RIGHTS_REJECTED',
    'INGESTION_QUEUED',
    'INGESTION_RUNNING',
    'INGESTION_COMPLETE',
    'EXTRACTION_QUEUED',
    'EXTRACTION_RUNNING',
    'EXTRACTION_COMPLETE',
    'SEGMENTATION_QUEUED',
    'SEGMENTATION_RUNNING',
    'SEGMENTATION_COMPLETE',
    'REVIEW_QUEUED',
    'REVIEW_IN_PROGRESS',
    'REVIEW_COMPLETE',
    'PUBLICATION_QUEUED',
    'PUBLISHED',
    'FAILED',
    'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS drive_inventory_runs (
  id serial PRIMARY KEY,
  root_folder_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status drive_inventory_status NOT NULL DEFAULT 'RUNNING',
  total_items integer NOT NULL DEFAULT 0,
  total_folders integer NOT NULL DEFAULT 0,
  total_bytes bigint NOT NULL DEFAULT 0,
  error_message text,
  actor_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drive_assets (
  id serial PRIMARY KEY,
  drive_file_id text NOT NULL UNIQUE,
  name text NOT NULL,
  mime_type text,
  size bigint,
  created_time timestamptz,
  modified_time timestamptz,
  folder_path text,
  intake_subject text,
  contributor_folder text,
  date_folder text,
  md5_checksum text,
  inventory_timestamp timestamptz NOT NULL DEFAULT now(),
  source_classification drive_source_classification NOT NULL DEFAULT 'UNKNOWN_SOURCE',
  rights_status drive_rights_status NOT NULL DEFAULT 'RIGHTS_REVIEW_REQUIRED',
  processing_status drive_processing_status NOT NULL DEFAULT 'PENDING',
  error_status text,
  parent_folder_id text,
  inventory_run_id integer REFERENCES drive_inventory_runs(id),
  source_batch_item_id integer,
  pipeline_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drive_assets_rights_status_idx
  ON drive_assets (rights_status);
CREATE INDEX IF NOT EXISTS drive_assets_processing_status_idx
  ON drive_assets (processing_status);
CREATE INDEX IF NOT EXISTS drive_assets_source_classification_idx
  ON drive_assets (source_classification);
CREATE INDEX IF NOT EXISTS drive_assets_inventory_run_id_idx
  ON drive_assets (inventory_run_id);

CREATE TABLE IF NOT EXISTS research_headnotes (
  id serial PRIMARY KEY,
  judgment_id integer NOT NULL REFERENCES research_verified_judgments(id),
  number integer NOT NULL,
  text text NOT NULL,
  paragraph_ref text,
  status text NOT NULL DEFAULT 'ai_draft',
  processor_version text NOT NULL DEFAULT 'headnotes@1',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS research_headnotes_judgment_number_uq
  ON research_headnotes (judgment_id, number);
CREATE INDEX IF NOT EXISTS research_headnotes_judgment_idx
  ON research_headnotes (judgment_id);
CREATE INDEX IF NOT EXISTS research_headnotes_status_idx
  ON research_headnotes (status);

CREATE TABLE IF NOT EXISTS research_catchwords (
  id serial PRIMARY KEY,
  judgment_id integer NOT NULL REFERENCES research_verified_judgments(id),
  sort_order integer NOT NULL DEFAULT 0,
  catchword_line text NOT NULL,
  status text NOT NULL DEFAULT 'ai_draft',
  processor_version text NOT NULL DEFAULT 'headnotes@1',
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS research_catchwords_judgment_idx
  ON research_catchwords (judgment_id);
CREATE INDEX IF NOT EXISTS research_catchwords_status_idx
  ON research_catchwords (status);-- Explicit, optional matter association for MyLitAI conversations.
-- Existing conversations remain NULL and are never guessed into a matter.
ALTER TABLE lit_conversations
  ADD COLUMN IF NOT EXISTS matter_id INTEGER
    REFERENCES lit_matters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lit_conversations_owner_matter_idx
  ON lit_conversations(access_code_id, matter_id);CREATE TABLE IF NOT EXISTS lit_lawyes_members (
  id serial PRIMARY KEY, access_code_id integer NOT NULL REFERENCES lit_access_codes(id) ON DELETE CASCADE,
  name text NOT NULL, email text, role text NOT NULL DEFAULT 'viewer', revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lit_lawyes_members_tenant_idx ON lit_lawyes_members(access_code_id);
CREATE TABLE IF NOT EXISTS lit_lawyes_credentials (
  id serial PRIMARY KEY, member_id integer NOT NULL REFERENCES lit_lawyes_members(id) ON DELETE CASCADE,
  code_lookup_hash text NOT NULL, code_hash text NOT NULL, last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lit_lawyes_credentials_lookup_uidx ON lit_lawyes_credentials(code_lookup_hash);
CREATE UNIQUE INDEX IF NOT EXISTS lit_lawyes_credentials_member_uidx ON lit_lawyes_credentials(member_id);
CREATE TABLE IF NOT EXISTS lit_lawyes_invitations (
  id serial PRIMARY KEY, access_code_id integer NOT NULL REFERENCES lit_access_codes(id) ON DELETE CASCADE,
  member_id integer NOT NULL REFERENCES lit_lawyes_members(id) ON DELETE CASCADE,
  invited_by_member_id integer REFERENCES lit_lawyes_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), accepted_at timestamptz
);
CREATE INDEX IF NOT EXISTS lit_lawyes_invitations_tenant_idx ON lit_lawyes_invitations(access_code_id);
CREATE TABLE IF NOT EXISTS lit_lawyes_matter_grants (
  id serial PRIMARY KEY, access_code_id integer NOT NULL REFERENCES lit_access_codes(id) ON DELETE CASCADE,
  matter_id integer NOT NULL REFERENCES lit_matters(id) ON DELETE CASCADE,
  member_id integer NOT NULL REFERENCES lit_lawyes_members(id) ON DELETE CASCADE,
  role text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lit_lawyes_matter_grants_matter_member_uidx ON lit_lawyes_matter_grants(matter_id, member_id);
CREATE INDEX IF NOT EXISTS lit_lawyes_matter_grants_member_idx ON lit_lawyes_matter_grants(access_code_id, member_id);
CREATE TABLE IF NOT EXISTS lit_lawyes_audit_events (
  id serial PRIMARY KEY, access_code_id integer NOT NULL REFERENCES lit_access_codes(id) ON DELETE CASCADE,
  actor_member_id integer REFERENCES lit_lawyes_members(id) ON DELETE SET NULL,
  action text NOT NULL, resource_type text NOT NULL, resource_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lit_lawyes_audit_tenant_created_idx ON lit_lawyes_audit_events(access_code_id, created_at);

UPDATE microsoft_links
   SET access_code = 'REDACTED-LAWYES-MEMBER-' || id::text, active = false
 WHERE access_code ~ '^LY-[A-Z0-9_-]{20}$';ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS extracted_text TEXT;
ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS extraction_metadata JSONB;
ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS evidence_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS evidence_verified_at TIMESTAMPTZ;
ALTER TABLE case_pending_uploads ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE case_pending_uploads ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE case_pending_uploads ADD COLUMN IF NOT EXISTS matter_id INTEGER;-- Explicit tenant discriminator for all MyLawFirmAI data. Existing rows are
-- owner-private and are therefore preserved in workspace 0.
ALTER TABLE IF EXISTS firm_users ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_tasks ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_goals ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_kpis ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_meetings ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_task_activity ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_task_assessments ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_task_attempts ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_task_collaborators ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_task_evidence ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_task_notes ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_hr_profiles ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_hr_leave_entitlements ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_hr_leave_requests ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_hr_attendance ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_hr_payroll_runs ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_hr_payslips ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_accounts_office_entries ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_accounts_client_ledgers ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_accounts_client_entries ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_accounts_budgets ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;

-- Business uniqueness is per workspace, never global.
ALTER TABLE firm_users DROP CONSTRAINT IF EXISTS firm_users_email_unique;
ALTER TABLE firm_task_assessments DROP CONSTRAINT IF EXISTS firm_task_assessments_task_id_unique;
ALTER TABLE firm_task_collaborators DROP CONSTRAINT IF EXISTS firm_task_collaborators_task_id_user_id_unique;
ALTER TABLE firm_hr_leave_entitlements DROP CONSTRAINT IF EXISTS firm_hr_leave_entitlements_user_id_year_leave_type_unique;
ALTER TABLE firm_hr_attendance DROP CONSTRAINT IF EXISTS firm_hr_attendance_user_id_work_date_unique;
ALTER TABLE firm_hr_leave_entitlements DROP CONSTRAINT IF EXISTS firm_hr_leave_entitlements_user_id_year_leave_type_key;
ALTER TABLE firm_hr_attendance DROP CONSTRAINT IF EXISTS firm_hr_attendance_user_id_work_date_key;
ALTER TABLE firm_hr_payroll_runs DROP CONSTRAINT IF EXISTS firm_hr_payroll_runs_month_year_key;
ALTER TABLE firm_hr_payslips DROP CONSTRAINT IF EXISTS firm_hr_payslips_run_id_user_id_key;
ALTER TABLE firm_accounts_budgets DROP CONSTRAINT IF EXISTS firm_accounts_budgets_year_month_category_key;

CREATE UNIQUE INDEX IF NOT EXISTS firm_users_workspace_id_email_unique
  ON firm_users (workspace_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS firm_task_assessments_workspace_id_task_id_unique
  ON firm_task_assessments (workspace_id, task_id);
CREATE UNIQUE INDEX IF NOT EXISTS firm_task_collaborators_workspace_id_task_id_user_id_unique
  ON firm_task_collaborators (workspace_id, task_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS firm_hr_leave_entitlements_workspace_id_user_id_year_leave_type_unique
  ON firm_hr_leave_entitlements (workspace_id, user_id, year, leave_type);
CREATE UNIQUE INDEX IF NOT EXISTS firm_hr_attendance_workspace_id_user_id_work_date_unique
  ON firm_hr_attendance (workspace_id, user_id, work_date);
CREATE UNIQUE INDEX IF NOT EXISTS firm_hr_payroll_runs_workspace_id_month_year_unique
  ON firm_hr_payroll_runs (workspace_id, month, year);
CREATE UNIQUE INDEX IF NOT EXISTS firm_hr_payslips_workspace_id_run_id_user_id_unique
  ON firm_hr_payslips (workspace_id, run_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS firm_accounts_budgets_workspace_id_year_month_category_unique
  ON firm_accounts_budgets (workspace_id, year, month, category);-- Global control-plane row per subscriber workspace. No legacy data is moved.
CREATE TABLE IF NOT EXISTS firm_workspace_credentials (
  id serial PRIMARY KEY,
  workspace_id integer NOT NULL DEFAULT 0,
  password_hash text,
  credential_version integer NOT NULL DEFAULT 0,
  challenge_hash text,
  challenge_nonce text,
  challenge_expires_at timestamptz,
  challenge_attempts integer NOT NULL DEFAULT 0,
  challenge_consumed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT firm_workspace_credentials_workspace_id_unique UNIQUE (workspace_id)
);BEGIN;

-- Align historical Phase 08 databases with the metadata processor's
-- ON CONFLICT (judgment_id, field_name, processor_version) contract.
-- Prevent concurrent writes between the duplicate check and index creation.
LOCK TABLE research_case_metadata IN SHARE MODE;

DO $$
DECLARE
  duplicate_groups bigint;
BEGIN
  SELECT count(*) INTO duplicate_groups
  FROM (
    SELECT judgment_id, field_name, processor_version
    FROM research_case_metadata
    GROUP BY judgment_id, field_name, processor_version
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = format('Cannot enforce research metadata uniqueness: %s duplicate key groups exist; no records were changed.', duplicate_groups),
      HINT = 'Inspect SELECT judgment_id, field_name, processor_version, count(*) FROM research_case_metadata GROUP BY judgment_id, field_name, processor_version HAVING count(*) > 1. Resolve conflicts with editorial review before retrying; do not automatically delete metadata.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS research_case_metadata_judgment_field_version_uq
  ON research_case_metadata (judgment_id, field_name, processor_version);

COMMIT;BEGIN;

-- The search processor always writes this field, including when it is NULL.
-- Keep fresh SQL installs aligned with Drizzle without requiring a server
-- startup repair. Existing indexed text and classifications are unchanged.
ALTER TABLE research_search_index
  ADD COLUMN IF NOT EXISTS practice_area text;

CREATE INDEX IF NOT EXISTS research_search_index_practice_area_idx
  ON research_search_index (practice_area);

COMMIT;