-- Migration 0022: bind uploaded documents to their submitter (Task #7).
-- Adds uploaded_by to research_source_containers so every container records
-- who uploaded it. Nullable so existing rows remain valid.

ALTER TABLE research_source_containers
  ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
