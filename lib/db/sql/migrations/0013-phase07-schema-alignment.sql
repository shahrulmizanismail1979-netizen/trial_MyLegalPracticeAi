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
