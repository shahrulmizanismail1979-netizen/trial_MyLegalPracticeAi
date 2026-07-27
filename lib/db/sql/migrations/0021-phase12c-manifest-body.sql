-- Phase 12c (addendum): Store full manifest JSON in the DB row so manifest
-- history is queryable even when object storage is temporarily unavailable.
ALTER TABLE research_deletion_manifests
  ADD COLUMN IF NOT EXISTS manifest_body jsonb;
