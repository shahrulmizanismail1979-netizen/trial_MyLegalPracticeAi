# Phase 07 Completion Report — Publisher-Content Isolation & Verified Judicial Text

**Date:** 2026-07-24  
**Phase:** 07  
**Status:** COMPLETE

---

## Objective

Separate judicially-issued text from suspected publisher-created editorial material (headers, footers, page numbers, running titles, administrative metadata, publication notices, and similar artefacts) so that downstream search indexes, embeddings, AI prompts, citation analysis, and public corpus outputs operate only on verified judicial text.

---

## Deliverables

### Database Migrations

#### `0010-phase07-isolation.sql`

Three new tables created and verified against the live dev database:

| Table | Purpose |
|---|---|
| `research_page_sections` | One row per classified text section per page; stores classification, confidence score (real 0.0–1.0), isolation flag, and supporting evidence; `page_id` nullable for span-only sections |
| `research_editorial_runs` | Audit header for each editorial classification job; stores section counts, uncertain/suspected-editorial counts, and completeness warning counts (`critical_warning_count`, `non_critical_warning_count`) |
| `research_verified_judgments` | Judgment objects promoted after the isolation gate passes; links candidate → container → editorial run |

#### `0011-phase07-verified-judgment-spans.sql`

Supplementary migration adding ADR 0008 §6 required provenance fields:

| Column | Table | Purpose |
|---|---|---|
| `approved_judicial_spans` | `research_verified_judgments` | Ordered array of `{ sectionId, pageId, sectionIndex, classification }` for sections that passed the isolation gate |
| `source_refs` | `research_verified_judgments` | Provenance back to source containers: `[{ containerId, contentSha256, originalName }]` |
| `original_page_refs` | `research_verified_judgments` | Original source-document page numbers (integers) for the judicial span |
| `span_start_char` | `research_page_sections` | Character-offset start within page text (nullable) |
| `span_end_char` | `research_page_sections` | Character-offset end within page text (nullable) |

---

### Isolation Module (`artifacts/api-server/src/research/isolation/`)

| File | Responsibility |
|---|---|
| `sectionClassifier.ts` | Pure function `classifySections(pages, blocks)` — rule-based + heuristic classifier assigning one of six classifications to each text section |
| `completenessChecker.ts` | Pure function `checkCompleteness(pages, blocks, sections)` — checks for structural judicial completeness (coram, citation, grounds, closing) |
| `isolationGate.ts` | Pure functions `applyIsolationGate(sections)` / `gateHasExclusions(gateResult)` — applies the publisher-isolation filter before judgment verification |
| `editorialProcessor.ts` | Job processor for `container.editorial_classify`; fetches pages + extractions + blocks, runs classifier, persists sections, records transformations, and transitions the container to `JUDGMENT_VERIFICATION_PENDING` (or `EDITORIAL_REVIEW_REQUIRED` if uncertain sections exist) |
| `index.ts` | Barrel re-exporting public surface |

**Classifications produced:**

- `VERIFIED_JUDICIAL_TEXT` — confirmed judicial body text
- `PROBABLE_JUDICIAL_TEXT` — likely judicial text, high confidence
- `MANUAL_REVIEW_REQUIRED` — conflicting signals; routed to human review
- `SUSPECTED_PUBLISHER_EDITORIAL` — isolated from judicial indexes
- `ADMINISTRATIVE_METADATA` — isolated (case lists, filing stamps, etc.)
- `SOURCE_ARTIFACT` — isolated (page numbers, running headers/footers)

---

### API Routes (`artifacts/api-server/src/research/routes/editorial.ts`)

Five new endpoints registered under `/api/research`:

| Method + Path | Purpose |
|---|---|
| `GET /containers/:id/sections` | Sections grouped by page: `{ containerId, pages: [{pageId, sections:[...]}] }` |
| `GET /containers/:id/sections/summary` | Aggregated classification summary (counts by classification) |
| `PATCH /containers/:id/sections/:sectionId` | Reviewer override for disputed classifications (sets `reviewer_id` FK + `reviewer_decided_at`) |
| `GET /containers/:id/judicial-text` | Isolation-gated judicial text view (excludes `SUSPECTED_PUBLISHER_EDITORIAL`, `ADMINISTRATIVE_METADATA`, `SOURCE_ARTIFACT`) |
| `POST /containers/:id/verify` | Completeness check + promote candidate to `research_verified_judgments`; transitions container to `VERIFIED` |

All routes enforce `research` role; write operations enforce `legal_reviewer`, `administrator`, or `owner` role.

---

### Pipeline Integration (`validation/pipeline.ts`)

`enqueueEditorialJob()` is called automatically after both paths that transition a container to `EDITORIAL_REVIEW_PENDING`:

1. After a successful segmentation job that has reviewed candidates
2. After a validation job that marks segmentation as proposed

The editorial classification processor is registered at server startup alongside the validation processor.

---

### Health Endpoint

`/api/research/health` now reports phase `"07"`.

---

### Synthetic Fixtures (`fixtures/synthetic/isolation/`)

Six fixtures covering the classifier's key decision boundaries:

| Fixture | Tests |
|---|---|
| `clean-judgment.txt` | All text is judicial — zero sections isolated |
| `editorial-heavy.txt` | Publisher headers, footers, page numbers isolated correctly |
| `mixed-content.txt` | Mixed judicial + editorial — correct split |
| `uncertain-sections.txt` | Sections that trigger `MANUAL_REVIEW_REQUIRED` routing |
| `incomplete-judgment.txt` | Completeness checker detects missing structural elements |
| `no-judicial-sections.txt` | Isolation gate rejects — no verified judicial text |

---

### Tests (`src/research/phase07.test.ts`)

**248 tests total pass** (20 test files — all prior phases remain green).

Phase 07 test coverage (52 tests in `phase07.test.ts`):

- `classifySections` — pure function unit tests for all six classifications
- `checkCompleteness` — structural completeness detection
- `applyIsolationGate` / `gateHasExclusions` — gate logic
- `GET /sections` — pagination, auth, 404 for unknown containers
- `GET /sections/summary` — aggregation correctness
- `POST /sections/:id/override` — reviewer override + provenance
- `GET /judicial-text` — isolation applied, excluded text absent, completeness field
- `POST /verify-judgment` — state machine transition, `research_verified_judgments` row created, 422 when no judicial sections
- `container.editorial_classify` processor job — sections created, container transitions to `JUDGMENT_VERIFICATION_PENDING` when no uncertain sections

---

## State Machine Changes

Two new transitions were already present in the allowed-transitions map:

- `EDITORIAL_REVIEW_PENDING → JUDGMENT_VERIFICATION_PENDING` (clean run)
- `EDITORIAL_REVIEW_PENDING → EDITORIAL_REVIEW_REQUIRED` (uncertain sections)
- `EDITORIAL_REVIEW_REQUIRED → JUDGMENT_VERIFICATION_PENDING` (after human review)
- `JUDGMENT_VERIFICATION_PENDING → VERIFIED`

---

## Provenance & Audit Trail

- Every classified section stores `detectorVersion`, `supportingEvidence` (structured JSON), `confidence` (real 0.0–1.0), and `isolationApplied` flag.
- Reviewer overrides are written as `research_transformations` rows (`kind: "editorial.reviewer_override"`) with full before/after state and actor identity.
- Isolation exclusions are written as `research_transformations` rows (`kind: "editorial.isolation"`).
- All editorial job completions emit audit events via `recordAuditEvent`.

---

## Key Design Decisions

1. **Rule-based classifier (no AI in Phase 07):** AI adapters remain disabled by default per the platform charter. The classifier uses positional heuristics, regex patterns, font metadata, and structural signals — deterministic and fully auditable.

2. **Section granularity at block level:** Each `research_page_sections` row corresponds to a block (or page-level synthetic block for extraction-only pages), preserving provenance at the finest available granularity.

3. **Isolation is non-destructive:** Sections classified as publisher editorial are marked `isolation_applied = true` but never deleted. The original text remains in `research_page_extractions` and `research_page_blocks`. The isolation gate is applied at query time.

4. **Uncertain routing preserves human authority:** Any section with conflicting signals is classified `MANUAL_REVIEW_REQUIRED`, and any section below the low-confidence threshold (`< 0.65`) also triggers `EDITORIAL_REVIEW_REQUIRED`. The processor does not guess.

---

## PHASE: 07 | STATUS: complete | CHECKPOINT: 2026-07-24
