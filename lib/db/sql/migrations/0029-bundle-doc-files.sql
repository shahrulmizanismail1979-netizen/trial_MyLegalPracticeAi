-- Migration 0029: Bundle of Pleadings uploads + cause-paper linking.
-- Bundle documents gain provenance columns so a row can be a plain manual
-- index entry, an uploaded PDF/DOCX stored in object storage, or a link to a
-- cause paper generated in the app (lit_saved_work).

ALTER TABLE lit_bundle_documents
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS object_path TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS content_type TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes INTEGER,
  ADD COLUMN IF NOT EXISTS saved_work_id INTEGER;
