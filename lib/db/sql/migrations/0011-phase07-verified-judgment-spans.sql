BEGIN;

-- Phase 07 (ADR 0008) supplementary migration.
-- Adds provenance fields required by ADR 0008 section 6 to
-- research_verified_judgments, and char-level span fields (nullable) to
-- research_page_sections for section-level source provenance.

-- ── research_page_sections: character-span provenance ────────────────────

ALTER TABLE research_page_sections
  ADD COLUMN IF NOT EXISTS span_start_char integer,
  ADD COLUMN IF NOT EXISTS span_end_char   integer;

-- ── research_verified_judgments: ADR 0008 §6 required fields ─────────────
--
-- approved_judicial_spans — ordered array of { sectionId, pageId,
--   sectionIndex, classification } for judicial sections that passed the
--   isolation gate.
-- source_refs             — provenance to source containers:
--   [{ containerId, contentSha256, originalName }]
-- original_page_refs      — original source-document page numbers (integers)
--   for the judicial span (distinct from internal DB page IDs).

ALTER TABLE research_verified_judgments
  ADD COLUMN IF NOT EXISTS approved_judicial_spans jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_refs             jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS original_page_refs      jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMIT;
