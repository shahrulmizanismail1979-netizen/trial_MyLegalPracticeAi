-- Explicit, optional matter association for MyLitAI conversations.
-- Existing conversations remain NULL and are never guessed into a matter.
ALTER TABLE lit_conversations
  ADD COLUMN IF NOT EXISTS matter_id INTEGER
    REFERENCES lit_matters(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS lit_conversations_owner_matter_idx
  ON lit_conversations(access_code_id, matter_id);