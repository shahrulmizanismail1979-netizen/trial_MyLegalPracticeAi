BEGIN;

-- Phase 07 supplementary migration: add explicit critical/non-critical warning
-- fields to research_verified_judgments (ADR 0008 §6 requires separation).
--
-- critical_integrity_warnings  — always [] on verified records (422 blocks
--   non-empty lists); stored explicitly to prove the check passed.
-- unresolved_non_critical_warnings — replaces the ambiguously named
--   unresolved_warnings (which stays for backward compat).

ALTER TABLE research_verified_judgments
  ADD COLUMN IF NOT EXISTS critical_integrity_warnings        jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS unresolved_non_critical_warnings   jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Back-fill: promote existing unresolved_warnings → unresolved_non_critical_warnings
UPDATE research_verified_judgments
SET unresolved_non_critical_warnings = unresolved_warnings
WHERE unresolved_non_critical_warnings = '[]'::jsonb
  AND unresolved_warnings != '[]'::jsonb;

COMMIT;
