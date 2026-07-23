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
