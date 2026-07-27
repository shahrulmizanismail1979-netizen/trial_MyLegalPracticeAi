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
