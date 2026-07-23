-- Phase 02 migration (ADR 0003): roles, rights vocabulary, rights-record
-- expansion. Applied with psql (never interactive drizzle push). Idempotent:
-- safe to re-run.
BEGIN;

-- 1) New tables / base DDL (full definitions in lib/db/sql/research-schema.sql).
\i lib/db/sql/research-schema.sql

-- 2) Additive 17-field rights capture on research_rights_records.
ALTER TABLE research_rights_records
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS date_obtained timestamptz,
  ADD COLUMN IF NOT EXISTS declared_source_type text,
  ADD COLUMN IF NOT EXISTS licence_reference text,
  ADD COLUMN IF NOT EXISTS approved_users jsonb,
  ADD COLUMN IF NOT EXISTS approved_purposes jsonb,
  ADD COLUMN IF NOT EXISTS storage_permitted boolean,
  ADD COLUMN IF NOT EXISTS analysis_permitted boolean,
  ADD COLUMN IF NOT EXISTS external_processing_permitted boolean,
  ADD COLUMN IF NOT EXISTS student_access_permitted boolean,
  ADD COLUMN IF NOT EXISTS printing_permitted boolean,
  ADD COLUMN IF NOT EXISTS export_permitted boolean,
  ADD COLUMN IF NOT EXISTS retention_period text,
  ADD COLUMN IF NOT EXISTS expiry_date timestamptz,
  ADD COLUMN IF NOT EXISTS reviewer text,
  ADD COLUMN IF NOT EXISTS review_date timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

-- 3) Role vocabulary migration (reversible mapping recorded as audit events).
ALTER TABLE research_users ALTER COLUMN role SET DEFAULT 'guest';
WITH mapping (old_role, new_role) AS (
  VALUES
    ('reviewer', 'rights_reviewer'),
    ('admin', 'administrator')
), changed AS (
  UPDATE research_users u
  SET role = m.new_role
  FROM mapping m
  WHERE u.role = m.old_role
  RETURNING u.id, m.old_role, m.new_role
)
INSERT INTO research_audit_events (entity_type, entity_id, event, from_state, to_state, actor, detail)
SELECT 'user', id, 'role-vocabulary-migration', old_role, new_role,
       'migration:0003-phase02', jsonb_build_object('migration', '0003-phase02')
FROM changed;

-- 4) Rights vocabulary migration on containers (legacy 4 -> new 13),
--    recording a reversible mapping per changed row as a transformation.
WITH mapping (old_status, new_status) AS (
  VALUES
    ('CLEARED_INTERNAL', 'PRIVATE_PROCESSING_APPROVED'),
    ('RESTRICTED', 'MANUAL_LEGAL_REVIEW_REQUIRED'),
    ('EXCLUDED', 'DO_NOT_PROCESS')
), changed AS (
  UPDATE research_source_containers c
  SET rights_status = m.new_status, updated_at = now()
  FROM mapping m
  WHERE c.rights_status = m.old_status
  RETURNING c.id, m.old_status, m.new_status
)
INSERT INTO research_transformations (container_id, kind, detail, actor)
SELECT id, 'rights-vocabulary-migration',
       jsonb_build_object('migration', '0003-phase02', 'from', old_status, 'to', new_status),
       'migration:0003-phase02'
FROM changed;

-- 5) Same mapping for historical rights records (append-only history keeps
--    row identity; only the vocabulary token is modernised, and the original
--    token is preserved in detail.legacyStatus).
UPDATE research_rights_records r
SET detail = r.detail || jsonb_build_object('legacyStatus', r.status),
    status = m.new_status
FROM (
  VALUES
    ('CLEARED_INTERNAL', 'PRIVATE_PROCESSING_APPROVED'),
    ('RESTRICTED', 'MANUAL_LEGAL_REVIEW_REQUIRED'),
    ('EXCLUDED', 'DO_NOT_PROCESS')
) AS m (old_status, new_status)
WHERE r.status = m.old_status;

COMMIT;
