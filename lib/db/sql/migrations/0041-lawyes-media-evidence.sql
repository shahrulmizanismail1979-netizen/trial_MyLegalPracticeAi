ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS extracted_text TEXT;
ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS extraction_metadata JSONB;
ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS evidence_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS evidence_verified_at TIMESTAMPTZ;
ALTER TABLE case_pending_uploads ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE case_pending_uploads ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE case_pending_uploads ADD COLUMN IF NOT EXISTS matter_id INTEGER;