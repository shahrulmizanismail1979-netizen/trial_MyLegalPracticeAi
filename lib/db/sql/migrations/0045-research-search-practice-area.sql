BEGIN;

-- The search processor always writes this field, including when it is NULL.
-- Keep fresh SQL installs aligned with Drizzle without requiring a server
-- startup repair. Existing indexed text and classifications are unchanged.
ALTER TABLE research_search_index
  ADD COLUMN IF NOT EXISTS practice_area text;

CREATE INDEX IF NOT EXISTS research_search_index_practice_area_idx
  ON research_search_index (practice_area);

COMMIT;