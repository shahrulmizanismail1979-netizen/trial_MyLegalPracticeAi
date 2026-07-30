-- Migration 0023: subscriber chat isolation for CCB and Lit portals (Task #21).
-- Adds access_code_id to conversation tables so each subscriber's chat history
-- is invisible to other subscribers. Nullable for backward compatibility with
-- conversations created before this migration, and for admin/static-code sessions.

ALTER TABLE ccb_conversations
  ADD COLUMN IF NOT EXISTS access_code_id INTEGER
    REFERENCES ccb_access_codes(id) ON DELETE CASCADE;

ALTER TABLE lit_conversations
  ADD COLUMN IF NOT EXISTS access_code_id INTEGER
    REFERENCES lit_access_codes(id) ON DELETE CASCADE;
