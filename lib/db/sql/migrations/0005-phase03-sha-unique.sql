-- Phase 03 hardening: race-safe SHA-256 duplicate detection.
-- Concurrent ingest jobs previously used read-then-insert dedup; a unique
-- index makes duplicate registration impossible at the database level.
-- Precondition (verified before applying): no duplicate content_sha256
-- values exist in research_source_containers.

CREATE UNIQUE INDEX IF NOT EXISTS research_source_containers_content_sha256_uq
  ON research_source_containers (content_sha256);
