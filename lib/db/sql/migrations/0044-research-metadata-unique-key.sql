BEGIN;

-- Align historical Phase 08 databases with the metadata processor's
-- ON CONFLICT (judgment_id, field_name, processor_version) contract.
-- Prevent concurrent writes between the duplicate check and index creation.
LOCK TABLE research_case_metadata IN SHARE MODE;

DO $$
DECLARE
  duplicate_groups bigint;
BEGIN
  SELECT count(*) INTO duplicate_groups
  FROM (
    SELECT judgment_id, field_name, processor_version
    FROM research_case_metadata
    GROUP BY judgment_id, field_name, processor_version
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = format('Cannot enforce research metadata uniqueness: %s duplicate key groups exist; no records were changed.', duplicate_groups),
      HINT = 'Inspect SELECT judgment_id, field_name, processor_version, count(*) FROM research_case_metadata GROUP BY judgment_id, field_name, processor_version HAVING count(*) > 1. Resolve conflicts with editorial review before retrying; do not automatically delete metadata.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS research_case_metadata_judgment_field_version_uq
  ON research_case_metadata (judgment_id, field_name, processor_version);

COMMIT;