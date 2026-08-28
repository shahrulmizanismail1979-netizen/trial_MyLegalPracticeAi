-- Task 522: reviews are approvals of one immutable editorial content revision.
ALTER TABLE research_lawyes_reviews
  ADD COLUMN IF NOT EXISTS reviewed_revision integer;
UPDATE research_lawyes_reviews
  SET reviewed_revision = 1
  WHERE reviewed_revision IS NULL;
ALTER TABLE research_lawyes_reviews
  ALTER COLUMN reviewed_revision SET NOT NULL;