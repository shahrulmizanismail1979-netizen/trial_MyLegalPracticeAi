---
title: Phase 07: Publisher-Content Isolation & Verified Judicial Text
---
# Phase 07 — Publisher-Content Isolation & Verified Judicial Text

## What & Why

Separate judicially-issued text from suspected publisher-created editorial
material. This is a core platform invariant stated in `replit.md` and
`docs/ARCHITECTURE.md` but not yet enforced at the data level. Phase 06
deferred automatic scrubbing; Phase 07 delivers it.

The state machine already defines `EDITORIAL_REVIEW_PENDING →
EDITORIAL_REVIEW_REQUIRED → JUDGMENT_VERIFICATION_PENDING → VERIFIED`, and
`validation/pipeline.ts` already transitions containers into
`EDITORIAL_REVIEW_PENDING` after coherence validation. Phase 07 implements
the content of those states.

## Done looks like

- Every page section of a container is classified with one of:
  `VERIFIED_JUDICIAL_TEXT`, `PROBABLE_JUDICIAL_TEXT`,
  `SUSPECTED_PUBLISHER_EDITORIAL`, `ADMINISTRATIVE_METADATA`,
  `SOURCE_ARTIFACT`, `UNKNOWN`, `MANUAL_REVIEW_REQUIRED`.
- The classifier uses all required detection signals (page location, layout,
  font changes, heading patterns, repeated headers/footers, branding markers,
  editorial vocabulary, court-document conventions, paragraph continuity,
  authorship context, prior reviewer decisions).
- The required safeguards are enforced: a section cannot be excluded solely
  because it appears before "Judgment", contains a summary, contains
  catchword-like wording, appears as a footnote, or uses bold headings.
  Court-issued summaries, judicial footnotes, judicial headings, and judicial
  annexures may remain VERIFIED_JUDICIAL_TEXT.
- `SUSPECTED_PUBLISHER_EDITORIAL` sections are held separately from verified
  judicial text, the full-text index, embeddings, AI prompts, AI summaries,
  classification models, and quotation tools — enforced by a single
  `isolationGate` function that all downstream consumers must call.
- The completeness checker catches: missing first/last page, incomplete
  opening/ending sentence, skipped paragraph numbers, duplicate paragraphs,
  missing orders/schedules/annexures, unreadable pages, multiple judgments
  accidentally combined.
- A verified judgment record is created only when: all approved judicial
  source spans are present, source refs, original page refs, and paragraph
  identifiers are recorded, a text checksum is computed, unresolved
  non-critical warnings are listed, and there are zero critical integrity
  warnings.
- Reviewer endpoints allow classification overrides and editorial approval
  before proceeding to verification.
- Excluded sections remain auditable via `research_transformations`.
- All included paragraphs retain source provenance.
- Incomplete cases (critical integrity warnings present) cannot reach VERIFIED.
- Judicial text is never silently rewritten.
- 196 existing tests continue to pass; new isolation tests are added.

## Out of scope

- Search adapter implementation (to become Phase 08).
- Research workspace portal UI (later phase).
- Embedding generation.
- AI research aids (later phase).
- Sentence-level character diffing inside a section.

## Steps

1. **ADR + phase redefinition** — Write `docs/decisions/0008-phase-07-publisher-content-isolation.md` recording the redefinition of Phase 07 from "Search & Research UI" to "Publisher-Content Isolation and Verified Judicial Text". Update `docs/PHASES.md` and `docs/status/current-phase.json`.

2. **DB schema: page sections table** — Add `research_page_sections` to `lib/db/src/schema/research.ts`: container_id (FK), page_id (FK, nullable — some sections span a full page), span_start_char / span_end_char (nullable — character offsets within the page's extracted text), classification (text enum, not null), confidence (real, 0–1), detector_version (text), reviewer_id (FK → research_users, nullable), reviewer_decision (text, nullable), reviewer_decided_at (timestamptz, nullable), isolation_applied (boolean, default false), notes (text, nullable), created_at. Index on (container_id, page_id).

3. **DB schema: editorial runs table** — Add `research_editorial_runs`: container_id (FK, not null), processor_version (text), section_count (int), uncertain_count (int), critical_warning_count (int), non_critical_warning_count (int), created_at.

4. **DB schema: verified judgments table** — Add `research_verified_judgments` to hold the full verified judgment record: candidate_id (FK → research_case_candidates, unique), approved_judicial_spans (jsonb — array of {containerId, pageId, spanStart, spanEnd}), source_refs (jsonb — array of {containerId, originalName}), original_page_refs (jsonb — array of page numbers), paragraph_identifiers (jsonb — array of paragraph labels), verified_by (text, not null), verified_at (timestamptz, not null), text_checksum (text, SHA-256 of all judicial text in order), critical_integrity_warnings (jsonb — must be empty array for VERIFIED), unresolved_non_critical_warnings (jsonb), created_at. A row here only exists when container is VERIFIED.

5. **Migration** — Generate and apply the Drizzle migration for all three new tables. Run `pnpm --filter @workspace/db run push` in dev.

6. **Section classifier (pure function)** — Create `artifacts/api-server/src/research/isolation/sectionClassifier.ts`. Input: page text, page metadata (page number, total pages, blocks/layout info from `research_page_blocks`). Output: `SectionClassification[]` with classification, confidence, supporting evidence text, and detector version. Implement the required detection signals: (a) page location heuristics — first/last pages are higher-risk for editorial framing but this alone is not exclusion grounds; (b) repeated header/footer patterns across pages; (c) branding markers (publisher name/logo patterns, ISBN, series titles, "All rights reserved", prices); (d) editorial vocabulary ("Headnotes", "Editorial Note", "Publisher's Summary", "Catchwords:", "Key Terms"); (e) court-document conventions (cause number, coram block, appearances block, date-of-judgment line, "JUDGMENT OF THE COURT" patterns); (f) paragraph continuity (numbered paragraph sequences signal judicial text); (g) font-change indicators from block metadata. Implement all safeguards: summary-like content, catchword-like wording, footnote position, bold headings, and pre-"Judgment" position cannot alone produce SUSPECTED_PUBLISHER_EDITORIAL — each requires corroborating signal evidence.

7. **Completeness checker (pure function)** — Create `artifacts/api-server/src/research/isolation/completenessChecker.ts`. Input: ordered judicial sections for a candidate with their page refs. Output: `{criticalWarnings: Warning[], nonCriticalWarnings: Warning[]}` where each warning has a code and description. Critical checks: missing first page, missing final page, incomplete opening sentence (no recognisable case-opening pattern), incomplete ending (no judgment dispositif or ending pattern), multiple judgments accidentally combined (conflicting case numbers/coram). Non-critical checks: skipped paragraph numbers, duplicate paragraph numbers, possible missing orders, possible missing schedules/annexures referenced in body, unreadable pages in span.

8. **Isolation gate** — Create `artifacts/api-server/src/research/isolation/isolationGate.ts`. Export a single `applyIsolationGate(sections: SectionClassification[]): SectionClassification[]` that keeps only VERIFIED_JUDICIAL_TEXT and PROBABLE_JUDICIAL_TEXT, strips everything else, and records a log-level note for each excluded section. This function must be called by any code path returning full-text content, and later by search indexing and AI prompt construction.

9. **Editorial processor (job)** — Create `artifacts/api-server/src/research/isolation/editorialProcessor.ts`, job kind `container.editorial_classify`. The processor: fetches all page extractions and block metadata for the container's active candidate pages; calls `sectionClassifier` for each page; persists `research_page_sections` rows (idempotent: ON CONFLICT DO NOTHING); creates a `research_editorial_runs` row; records a `research_transformations` row for every section classified as SUSPECTED_PUBLISHER_EDITORIAL or ADMINISTRATIVE_METADATA; if any section is MANUAL_REVIEW_REQUIRED or confidence < threshold, transitions container to EDITORIAL_REVIEW_REQUIRED and opens a `research_review_items` row; otherwise transitions to JUDGMENT_VERIFICATION_PENDING.

10. **Auto-enqueue editorial job** — In `validation/pipeline.ts`, after the transition to `EDITORIAL_REVIEW_PENDING`, enqueue a `container.editorial_classify` job (idempotent key: `editorial:${containerId}:${runId}`) in the same transaction.

11. **Editorial review routes** — Create `artifacts/api-server/src/research/routes/editorial.ts` and register it in `routes/index.ts`. Endpoints (all staff-gated):
    - `GET /api/research/containers/:id/sections` — list all research_page_sections for the container, grouped by page.
    - `PATCH /api/research/containers/:id/sections/:sectionId` — reviewer overrides classification; updates reviewer_id / reviewer_decision / reviewer_decided_at / isolation_applied; records a research_transformations row.
    - `POST /api/research/containers/:id/editorial-review/complete` — reviewer marks all editorial issues resolved; validates no remaining MANUAL_REVIEW_REQUIRED sections; transitions container EDITORIAL_REVIEW_REQUIRED → EDITORIAL_REVIEW_PENDING → JUDGMENT_VERIFICATION_PENDING.
    - `GET /api/research/containers/:id/judicial-text` — returns only isolation-gated (VERIFIED + PROBABLE) sections in page order, with provenance per section.
    - `POST /api/research/containers/:id/verify` — staff reviewer submits verification; runs completeness checker against gated sections; if critical warnings exist returns 422 with warning list (container stays in JUDGMENT_VERIFICATION_PENDING); if none, builds the `research_verified_judgments` record, computes text checksum, transitions container to VERIFIED, writes audit event.

12. **Synthetic fixtures** — Create fixtures in `fixtures/synthetic/isolation/`: multi-section judgment with clearly separated publisher headnotes; judgment with a court-issued summary (must NOT be excluded); judgment with judicial footnotes (must NOT be excluded); judgment with both publisher footer branding and judicial text on the same page; judgment with a missing final page (must trigger critical warning); judgment with skipped paragraph numbers (non-critical warning). All `.txt` fixtures paired with `.expected.json` acceptance gates.

13. **Tests** — Create `artifacts/api-server/src/research/phase07.test.ts`. Test: sectionClassifier correctly classifies each fixture scenario; safeguards are enforced (no false exclusion of judicial summaries, footnotes, catchword-adjacent text, bold headings alone); completenessChecker returns correct critical/non-critical warnings per scenario; isolationGate strips only the right sections; editorial processor job creates correct section rows and transitions container state; all five review endpoints (list, override, complete, judicial-text, verify); verify endpoint rejects with 422 when critical warnings remain; verified judgment record is complete and checksummed. All existing 196 tests must still pass.

14. **Completion report + phase status update** — Write `docs/reports/phase-07-completion.md` per `docs/BUILD_PROMPT.md`. Update `docs/status/current-phase.json` to mark Phase 07 complete and Phase 08 (now "Search & Research UI") as next.

## Relevant files

- `artifacts/api-server/src/research/validation/pipeline.ts`
- `artifacts/api-server/src/research/segmentation/signalDetector.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/routes/candidateReview.ts`
- `lib/db/src/schema/research.ts`
- `docs/PHASES.md`
- `docs/status/current-phase.json`
- `docs/PROCESSING_STATES.md`
- `docs/ARCHITECTURE.md`
- `docs/BUILD_PROMPT.md`
- `docs/decisions/0007-phase-06-validation-review-cross-file.md`
- `docs/reports/phase-06-completion.md`
- `fixtures/synthetic/`