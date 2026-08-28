ALTER TABLE lit_matters
  ADD COLUMN IF NOT EXISTS preparation_state jsonb;