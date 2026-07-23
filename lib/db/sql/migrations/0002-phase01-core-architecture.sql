-- Phase 01 migration: additive schema expansion + state-vocabulary migration.
-- Applied with psql (never interactive drizzle push — it has proposed
-- destructive renames in this repo). Idempotent: safe to re-run.
BEGIN;

-- 1) New tables (full definitions live in lib/db/sql/research-schema.sql).
\i lib/db/sql/research-schema.sql

-- 2) Additive columns on existing tables.
ALTER TABLE research_jobs
  ADD COLUMN IF NOT EXISTS processor_version text NOT NULL DEFAULT 'unversioned',
  ADD COLUMN IF NOT EXISTS failure_reason jsonb,
  ADD COLUMN IF NOT EXISTS source_checksum text,
  ADD COLUMN IF NOT EXISTS output_checksum text,
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE research_jobs ALTER COLUMN state SET DEFAULT 'QUEUED';

ALTER TABLE research_review_items
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS assigned_to integer REFERENCES research_users(id);

ALTER TABLE research_source_containers
  ALTER COLUMN processing_state SET DEFAULT 'UPLOADED';

-- 3) Migrate container states (Phase 00 vocabulary -> Phase 01 vocabulary),
--    recording a reversible mapping per changed row as a transformation.
WITH mapping (old_state, new_state) AS (
  VALUES
    ('REGISTERED', 'UPLOADED'),
    ('STAGED', 'UPLOADED'),
    ('QUEUED', 'UPLOADED'),
    ('PROCESSING', 'UPLOADED'),
    ('PROCESSED', 'UPLOADED'),
    ('NEEDS_REVIEW', 'RIGHTS_REVIEW_REQUIRED'),
    ('FAILED', 'PROCESSING_BLOCKED'),
    ('QUARANTINED', 'QUARANTINED')
), changed AS (
  UPDATE research_source_containers c
  SET processing_state = m.new_state, updated_at = now()
  FROM mapping m
  WHERE c.processing_state = m.old_state
    AND c.processing_state <> m.new_state
  RETURNING c.id, m.old_state, m.new_state
)
INSERT INTO research_transformations (container_id, kind, detail, actor)
SELECT id, 'state-vocabulary-migration',
       jsonb_build_object('migration', '0002-phase01', 'from', old_state, 'to', new_state),
       'migration:0002-phase01'
FROM changed;

-- 4) Migrate job states, recording the reversible mapping as audit events.
WITH mapping (old_state, new_state) AS (
  VALUES
    ('queued', 'QUEUED'),
    ('running', 'RUNNING'),
    ('succeeded', 'SUCCEEDED'),
    ('failed', 'FAILED_RETRYABLE'),
    ('dead', 'FAILED_PERMANENT')
), changed AS (
  UPDATE research_jobs j
  SET state = m.new_state
  FROM mapping m
  WHERE j.state = m.old_state
  RETURNING j.id, m.old_state, m.new_state
)
INSERT INTO research_audit_events (entity_type, entity_id, event, from_state, to_state, actor, detail)
SELECT 'job', id, 'state-vocabulary-migration', old_state, new_state,
       'migration:0002-phase01', jsonb_build_object('migration', '0002-phase01')
FROM changed;

COMMIT;
