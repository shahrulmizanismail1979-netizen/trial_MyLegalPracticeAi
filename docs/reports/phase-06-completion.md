# Phase 06 Completion Report — Consolidation (Validation, Human Review & Cross-File Reconstruction)

**Status:** PASS  
**Date:** 2026-07-24  
**Phase:** 06  

---

## Objective

Implement segmentation validation (coherence checking), human review actions on case candidates, and cross-file span management (duplicate/continuation detection and multi-file case reconstruction). This corresponds to the "Consolidation" phase in PHASES.md.

---

## Implementation Summary

### 1. Validation Pipeline (`artifacts/api-server/src/research/validation/`)

**`pipeline.ts`** — End-to-end validation orchestration:
- `registerValidationProcessor()` — registers a job processor under the `validation` type; idempotent.
- `startValidation(containerId, actor)` — enqueues a validation job when the container is in `SEGMENTATION_PROPOSED` or `SEGMENTATION_REVIEW_REQUIRED`; returns the job id.
- `runValidation(containerId, runKey, actor)` — core processor: fetches all candidates, gathers page text per candidate, runs `checkCoherence` on each, persists `research_candidate_coherence_checks` rows, transitions container to `EDITORIAL_REVIEW_PENDING` (clean pass) or `SEGMENTATION_REVIEW_REQUIRED` (any FAIL/UNCERTAIN), emits audit events.
- `getLatestValidationRun(containerId)` — queries the most recent validation run.
- Segmentation pipeline (`segmentation/pipeline.ts`) auto-enqueues a validation job on `SEGMENTATION_PROPOSED` transition.

**`coherenceChecker.ts`** — 18 pure coherence checks, all returning `PASS | FAIL | UNCERTAIN | NOT_APPLICABLE`:

| # | Check | Description |
|---|-------|-------------|
| 1 | `HAS_BEGINNING` | First span page has a Malaysian legal citation |
| 2 | `HAS_ENDING` | Last span page has a closing order/judgment phrase |
| 3 | `NO_SOURCE_PAGE_GAP` | Span pages are contiguous (no missing page numbers) |
| 4 | `SINGLE_PARTY_BLOCK` | Consistent party names across all pages |
| 5 | `CONSISTENT_CITATION` | Same citation string on all pages that show it |
| 6 | `CONSISTENT_COURT` | Same court name throughout |
| 7 | `NO_MIXED_COURTS` | No conflicting court names on different pages |
| 8 | `CHAR_DENSITY` | Average text density is within normal range |
| 9 | `MIN_PAGE_COUNT` | Span covers at least 1 page |
| 10 | `MAX_PAGE_COUNT` | Span does not exceed 200 pages |
| 11 | `SEQUENTIAL_PARAGRAPHS` | Numbered paragraph sequence is monotonically increasing (gap < 10) |
| 12 | `NO_DUPLICATE_PARAGRAPHS` | No paragraph number appears twice |
| 13 | `JUDGE_CONSISTENCY` | Same judge name throughout |
| 14 | `DATE_CONSISTENCY` | Dates are consistent or not present |
| 15 | `LANGUAGE_CONSISTENCY` | Text is primarily in one language |
| 16 | `NO_PUBLISHER_CONTENT` | No publisher headnotes/editorial markers detected |
| 17 | `REASONABLE_WORD_COUNT` | Total word count is in a reasonable range |
| 18 | `CITATION_FORMAT_VALID` | Citation, if present, matches expected Malaysian format |

**`crossFileDetector.ts`** — Cross-file relationship detection:
- `detectCrossFileRelationship(cA, cB, pagesA, pagesB)` — pure function; returns `null` when candidates are in different source batches, same container with non-overlapping page ranges that don't fit continuation, or the same candidate; otherwise returns one of:
  - `EXACT_DUPLICATE` — SHA-256 content hashes match
  - `POSSIBLE_DUPLICATE` — token overlap ≥ 80%
  - `POSSIBLE_CONTINUATION` — A lacks ending AND B lacks beginning AND terminal/initial page text has shared tokens
  - `ALTERNATIVE_VERSION` — same citation but different content
  - `RELATED_APPEAL` — shared party names across different batches
- `detectAllCrossFileRelationships(candidates, pagesMap)` — runs pair-wise detection with canonical ordering (`sourceCandidateId < targetCandidateId`) and deduplicates.

### 2. Human Review Routes (`artifacts/api-server/src/research/routes/candidateReview.ts`)

REST endpoints for reviewers to act on individual case candidates:

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/api/research/candidates/:id` | Fetch candidate with its coherence checks |
| `POST` | `/api/research/candidates/:id/approve` | Approve candidate → `approved` status |
| `POST` | `/api/research/candidates/:id/reject` | Reject candidate with reason |
| `POST` | `/api/research/candidates/:id/request-split` | Flag for split review |
| `POST` | `/api/research/candidates/:id/request-merge` | Flag for merge review |
| `POST` | `/api/research/candidates/:id/request-reprocessing` | Re-enqueue validation job |

All actions:
- Require `owner` or `analyst` role (verified via `decideAccess`).
- Record an audit event via `recordAction`.
- Persist a `research_candidate_review_actions` row.
- Return structured JSON responses.

### 3. Database Migration (`lib/db/sql/migrations/0009-phase06-validation.sql`)

New tables:
- `research_validation_runs` — tracks each validation job run per container with `run_key`, `status`, `job_id`, `processor_version`, timestamps.
- `research_candidate_coherence_checks` — one row per check per candidate per validation run; stores `check_type`, `result`, `detail`, `severity`.
- `research_candidate_review_actions` — append-only log of human review actions on candidates.
- `research_cross_file_spans` — multi-file case spans (proposed by reviewers).
- `research_cross_file_span_segments` — ordered segments linking candidates to a cross-file span.
- `research_cross_file_relationships` — auto-detected pairwise relationships between candidates.

### 4. Schema Exports (`lib/db/src/schema/research.ts`)

All new tables and their Drizzle schemas exported from `@workspace/db`.

### 5. Route Registration (`artifacts/api-server/src/research/routes/index.ts`)

`candidateReview` router mounted at `/api/research/candidates`.

### 6. Phase 05 Migrations Applied

Phase 05 migrations (`0007`, `0008`) were not previously applied to the live dev DB. Applied as part of this phase's pre-requisite setup.

---

## Files Created

| File | Description |
|------|-------------|
| `artifacts/api-server/src/research/validation/pipeline.ts` | Validation pipeline orchestrator |
| `artifacts/api-server/src/research/validation/coherenceChecker.ts` | 18 pure coherence checks |
| `artifacts/api-server/src/research/validation/crossFileDetector.ts` | Cross-file relationship detector |
| `artifacts/api-server/src/research/routes/candidateReview.ts` | Human review REST routes |
| `artifacts/api-server/src/research/phase06.test.ts` | Phase 06 integration and unit tests (16 tests) |
| `lib/db/sql/migrations/0009-phase06-validation.sql` | DB migration for Phase 06 tables |
| `fixtures/synthetic/cross-file/split-case-part1.txt` | Synthetic fixture: first half of a split case |
| `fixtures/synthetic/cross-file/split-case-part2.txt` | Synthetic fixture: second half of a split case |

## Files Changed

| File | Change |
|------|--------|
| `lib/db/src/schema/research.ts` | Added 6 new table schemas + type exports |
| `lib/db/src/index.ts` | Re-exported new table names |
| `artifacts/api-server/src/research/routes/index.ts` | Mounted `candidateReview` router |
| `artifacts/api-server/src/research/segmentation/pipeline.ts` | Auto-enqueues validation job after segmentation completes |
| `artifacts/api-server/src/research/routes/candidateReview.ts` | Fixed redundant dynamic import |

---

## Database Migrations

| Migration | Status | Description |
|-----------|--------|-------------|
| `0009-phase06-validation.sql` | Applied | 6 new Phase 06 tables |
| `0007-phase05-segmentation.sql` | Applied (catch-up) | Phase 05 segmentation tables (were missing from live DB) |
| `0008-phase05-candidate-idempotency.sql` | Applied (catch-up) | Phase 05 candidate idempotency index (was missing from live DB) |

---

## Dependencies Added or Removed

None.

---

## Test Commands

```bash
# Phase 06 tests only
cd artifacts/api-server && npx vitest run src/research/phase06.test.ts --reporter=verbose

# Full suite
pnpm --filter @workspace/api-server run test

# Typecheck
pnpm --filter @workspace/api-server run typecheck
```

---

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| Phase 06 pure: coherence checker | 8 | ✅ PASS |
| Phase 06 pure: cross-file detector | 5 | ✅ PASS |
| Phase 06 integration: validation pipeline | 2 | ✅ PASS |
| Phase 06 integration: cross-file span management (DB) | 2 | ✅ PASS |
| **Phase 06 total** | **16** | **✅ PASS** |
| Phase 05 tests | 37 | ✅ PASS (unaffected) |
| Phase 00–04 tests | preserved | ✅ PASS |
| TypeScript typecheck | — | ✅ PASS |

---

## Browser Testing

Not applicable: Phase 06 introduces backend processing modules and REST routes only. No frontend UI was added.

---

## Synthetic Fixtures Used

| Fixture | Location | Description |
|---------|----------|-------------|
| `split-case-part1.txt` | `fixtures/synthetic/cross-file/` | Begins with a Malaysian citation + court header; no closing order |
| `split-case-part2.txt` | `fixtures/synthetic/cross-file/` | Begins mid-judgment; ends with "Ordered accordingly. (Judge) Judge" |

No real legal documents used.

---

## Acceptance Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| 18 coherence checks per candidate, stored as DB rows | ✅ PASS | `coherenceChecker.ts` defines 18 check types; test confirms `checks.length === 18` |
| `HAS_BEGINNING` / `HAS_ENDING` detect Malaysian citation / closing phrase | ✅ PASS | Unit tests for both checks pass |
| `NO_SOURCE_PAGE_GAP` detects non-contiguous page ranges | ✅ PASS | Unit test with gap [1,3] produces FAIL |
| `NO_MIXED_COURTS` detects conflicting court names | ✅ PASS | Unit test with two different courts produces FAIL |
| `SEQUENTIAL_PARAGRAPHS` detects large numbering gaps | ✅ PASS | Unit test with [1,2]→[20] gap produces FAIL |
| `requiresValidationReview` gates container transition | ✅ PASS | Returns `true` when any check FAILs |
| Validation pipeline persists checks to DB | ✅ PASS | Integration test queries `researchCandidateCoherenceChecks` after pipeline run |
| Validation auto-starts after segmentation | ✅ PASS | `startValidation` called from segmentation `SEGMENTATION_PROPOSED` transition |
| Human review routes: approve / reject / split / merge / reprocess | ✅ PASS | Routes registered; audit events recorded |
| Cross-file `POSSIBLE_CONTINUATION` detected (A lacks ending, B lacks beginning) | ✅ PASS | Pure unit test passes |
| Cross-file `POSSIBLE_DUPLICATE` detected (≥80% token overlap) | ✅ PASS | Pure unit test with identical fixture text passes |
| `detectAllCrossFileRelationships` deduplicates pairs canonically | ✅ PASS | Unit test verifies no duplicate pairs and `sourceCandidateId ≤ targetCandidateId` |
| Cross-file spans (`research_cross_file_spans`) can be created and approved | ✅ PASS | Integration test creates span + segments, approves, queries result |
| All previous phase tests remain passing | ✅ PASS | Full suite run confirms no regressions |

---

## Defects Discovered

1. **Phase 05 migrations not applied to dev DB** — `research_case_candidates` was missing `run_id`, `strength`, `page_count`, `review_status`, `reviewed_by`, `reviewed_at`, `start_page_id` columns. Applied `0007` and `0008` as a catch-up during this phase.

2. **Test afterAll FK ordering** — The phase06.test.ts afterAll must collect `job_id` values from segmentation and validation run rows *before* deleting those rows, because `research_segmentation_runs.job_id → research_jobs` FK blocks job deletion if runs still exist. Fixed by collecting job IDs from run rows prior to deletion.

---

## Limitations

1. Cross-file relationship detection runs as a pure function; it is not yet wired into an automatic background scan (i.e. it does not automatically compare every new candidate against all prior candidates in the same source batch). A reviewer must trigger it or it will run at the end of the validation job.

2. The `candidateReview` routes are guarded by `decideAccess` but rely on the calling context already having authenticated the user (via `req.researchUser`). Full middleware chain coverage is exercised in Phase 05 route tests; Phase 06 adds the review-specific actions.

3. Publisher-content isolation is partially implemented: the `NO_PUBLISHER_CONTENT` check flags suspected editorial material with `UNCERTAIN`, routing it to human review. Automatic scrubbing is out of scope for Phase 06.

---

## Security Implications

- All candidate review actions require `owner` or `analyst` role; unauthenticated and `guest` requests are rejected with 403.
- Audit events are written for every review action.
- No external AI services contacted.
- Coherence checks operate only on data already in the DB; no external calls.

---

## Privacy Implications

- No personal data is exposed by the new routes beyond what the research platform already stores.
- Coherence check detail fields (`detail` JSONB) store structural metadata only; no raw judicial text is duplicated into check rows.

---

## Rights or Licensing Implications

- Validation and cross-file detection operate only on containers with `PRIVATE_PROCESSING_APPROVED` rights status or higher (enforced by the state machine: segmentation and validation can only run after rights approval).
- No content is extracted to external services.

---

## Rollback Instructions

1. Remove `0009-phase06-validation.sql` migration effects by dropping the 6 new tables:
   ```sql
   DROP TABLE IF EXISTS research_cross_file_relationships CASCADE;
   DROP TABLE IF EXISTS research_cross_file_span_segments CASCADE;
   DROP TABLE IF EXISTS research_cross_file_spans CASCADE;
   DROP TABLE IF EXISTS research_candidate_review_actions CASCADE;
   DROP TABLE IF EXISTS research_candidate_coherence_checks CASCADE;
   DROP TABLE IF EXISTS research_validation_runs CASCADE;
   ```
2. Revert `artifacts/api-server/src/research/routes/index.ts` to remove the `candidateReview` mount.
3. Revert `artifacts/api-server/src/research/segmentation/pipeline.ts` to remove the auto-enqueue of validation jobs.
4. Remove `artifacts/api-server/src/research/validation/` directory.
5. Remove `artifacts/api-server/src/research/routes/candidateReview.ts`.
6. Revert `lib/db/src/schema/research.ts` and `lib/db/src/index.ts` to Phase 05 state.

Phase 05 migrations (`0007`, `0008`) were applied as a catch-up; rolling them back would also revert Phase 05 DB state.

---

## Recommended Next Phase

**Phase 07 — Search & Research UI**: Implement the search adapter and expose research results to the legal portals. The validation + review pipeline now produces `EDITORIAL_REVIEW_PENDING` candidates that are ready to be verified, and the cross-file reconstruction model is in place to support multi-file case search.
