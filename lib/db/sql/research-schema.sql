-- Judgment Research Platform — complete research_* DDL (Phase 01).
-- Idempotent and unqualified: applied to a fresh dedicated schema by the
-- DB-isolated test harness (search_path decides the target schema), and kept
-- as the reproducible, reviewable definition of the research tables.
-- Production/dev changes are applied additively via the migration files in
-- lib/db/sql/migrations/ — never via interactive drizzle push.

CREATE TABLE IF NOT EXISTS research_users (
  id serial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'guest',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_source_containers (
  id serial PRIMARY KEY,
  original_name text NOT NULL,
  source_batch text NOT NULL,
  storage_key text,
  content_sha256 text NOT NULL,
  size_bytes integer NOT NULL,
  mime_type text,
  rights_status text NOT NULL DEFAULT 'UNREVIEWED',
  processing_state text NOT NULL DEFAULT 'UPLOADED',
  provenance jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_source_pages (
  id serial PRIMARY KEY,
  container_id integer NOT NULL REFERENCES research_source_containers(id),
  page_number integer NOT NULL,
  content_sha256 text,
  notes text,
  provenance jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS research_source_pages_container_page_uq
  ON research_source_pages (container_id, page_number);

CREATE UNIQUE INDEX IF NOT EXISTS research_source_containers_content_sha256_uq
  ON research_source_containers (content_sha256);

CREATE TABLE IF NOT EXISTS research_jobs (
  id serial PRIMARY KEY,
  kind text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'QUEUED',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  processor_version text NOT NULL DEFAULT 'unversioned',
  failure_reason jsonb,
  last_error text,
  source_checksum text,
  output_checksum text,
  provenance jsonb NOT NULL DEFAULT '{}',
  claimed_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_case_candidates (
  id serial PRIMARY KEY,
  container_id integer NOT NULL REFERENCES research_source_containers(id),
  spans jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'proposed',
  proposed_by text NOT NULL DEFAULT 'system',
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_verified_cases (
  id serial PRIMARY KEY,
  candidate_id integer NOT NULL REFERENCES research_case_candidates(id),
  title text,
  citation text,
  verified_by text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}',
  verified_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_rights_records (
  id serial PRIMARY KEY,
  container_id integer NOT NULL REFERENCES research_source_containers(id),
  status text NOT NULL,
  decided_by text NOT NULL,
  reason text NOT NULL,
  -- 17-field rights capture (Phase 02, ADR 0003). Legacy rows keep NULLs.
  source text,
  date_obtained timestamptz,
  declared_source_type text,
  licence_reference text,
  approved_users jsonb,
  approved_purposes jsonb,
  storage_permitted boolean,
  analysis_permitted boolean,
  external_processing_permitted boolean,
  student_access_permitted boolean,
  printing_permitted boolean,
  export_permitted boolean,
  retention_period text,
  expiry_date timestamptz,
  reviewer text,
  review_date timestamptz,
  notes text,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_transformations (
  id serial PRIMARY KEY,
  container_id integer REFERENCES research_source_containers(id),
  kind text NOT NULL,
  detail jsonb NOT NULL,
  actor text NOT NULL DEFAULT 'system',
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_review_items (
  id serial PRIMARY KEY,
  container_id integer REFERENCES research_source_containers(id),
  kind text NOT NULL DEFAULT 'general',
  assigned_to integer REFERENCES research_users(id),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  resolution jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS research_audit_events (
  id serial PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id integer NOT NULL,
  event text NOT NULL,
  from_state text,
  to_state text,
  actor text NOT NULL DEFAULT 'system',
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS research_audit_events_entity_idx
  ON research_audit_events (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS research_stored_artifacts (
  id serial PRIMARY KEY,
  container_id integer REFERENCES research_source_containers(id),
  job_id integer REFERENCES research_jobs(id),
  kind text NOT NULL,
  storage_key text NOT NULL,
  content_sha256 text NOT NULL,
  size_bytes integer NOT NULL,
  produced_by_key text NOT NULL,
  provenance jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS research_stored_artifacts_key_kind_uq
  ON research_stored_artifacts (produced_by_key, kind);

-- Phase 03 (ADR 0004): upload batches, batch items, container inventories.
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
CREATE INDEX IF NOT EXISTS research_source_containers_sha_idx
  ON research_source_containers (content_sha256);

-- ── Phase 04: page-level extraction (ADR 0005) ──

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
