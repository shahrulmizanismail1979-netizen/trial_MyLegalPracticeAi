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
