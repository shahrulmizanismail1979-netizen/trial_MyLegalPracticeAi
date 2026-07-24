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
