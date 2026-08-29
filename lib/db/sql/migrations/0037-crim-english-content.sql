-- Additive language metadata for MyCrimAI precedents. Existing rows retain
-- their IDs and content and are classified as Bahasa Melayu by the default.
ALTER TABLE "cause_papers"
  ADD COLUMN IF NOT EXISTS "language" text NOT NULL DEFAULT 'ms',
  ADD COLUMN IF NOT EXISTS "source_id" integer,
  ADD COLUMN IF NOT EXISTS "stable_key" text;

ALTER TABLE "sample_documents"
  ADD COLUMN IF NOT EXISTS "language" text NOT NULL DEFAULT 'ms',
  ADD COLUMN IF NOT EXISTS "source_id" integer,
  ADD COLUMN IF NOT EXISTS "stable_key" text;

CREATE UNIQUE INDEX IF NOT EXISTS "cause_papers_stable_key_unique"
  ON "cause_papers" ("stable_key");
CREATE UNIQUE INDEX IF NOT EXISTS "sample_documents_stable_key_unique"
  ON "sample_documents" ("stable_key");

ALTER TABLE "cause_papers"
  DROP CONSTRAINT IF EXISTS "cause_papers_language_check";
ALTER TABLE "cause_papers"
  ADD CONSTRAINT "cause_papers_language_check" CHECK ("language" IN ('ms', 'en'));
ALTER TABLE "sample_documents"
  DROP CONSTRAINT IF EXISTS "sample_documents_language_check";
ALTER TABLE "sample_documents"
  ADD CONSTRAINT "sample_documents_language_check" CHECK ("language" IN ('ms', 'en'));