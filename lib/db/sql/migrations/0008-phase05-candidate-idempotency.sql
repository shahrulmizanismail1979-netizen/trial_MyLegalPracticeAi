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
