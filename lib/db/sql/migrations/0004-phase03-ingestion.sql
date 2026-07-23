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
