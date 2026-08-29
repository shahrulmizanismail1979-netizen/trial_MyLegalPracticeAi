-- Additive schema for Drive inventory and reviewed headnotes.
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
  ON research_catchwords (status);