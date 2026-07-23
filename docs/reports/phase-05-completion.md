# Phase 05 Completion Report — Multi-Case Segmentation Engine

**Date:** 2026-07-23  
**Status:** COMPLETE (post-code-review fixes applied)  
**Tests:** 40 / 40 Phase 05 tests passing; 173 / 173 total suite passing  
**Typecheck:** clean (libs + api-server)

---

## Summary

Phase 05 implements a deterministic, rights-gated, idempotent multi-case segmentation engine over Phase 04's extracted page/block data. Given a container in `TEXT_EXTRACTED`, the engine detects boundary signals, scores candidate boundaries, proposes case candidates, and routes uncertain results to human review — all without any AI model involvement.

---

## Deliverables

### Core modules

| File | Description |
|------|-------------|
| `artifacts/api-server/src/research/segmentation/signalDetector.ts` | 24 signal types, 5 strength tiers, deterministic scoring |
| `artifacts/api-server/src/research/segmentation/candidateComposer.ts` | Boundary scoring, candidate proposal, `requiresReview` logic |
| `artifacts/api-server/src/research/segmentation/pipeline.ts` | Job processor — rights-gated, idempotent, state-machine-driven |
| `artifacts/api-server/src/research/routes/segmentation.ts` | HTTP routes + minimal staff review UI |
| `artifacts/api-server/src/research/routes/index.ts` | Segmentation routes registered |
| `artifacts/api-server/src/research/domain/audit.ts` | `case_candidate` audit event support added |

### Database

| Object | Description |
|--------|-------------|
| `research_segmentation_runs` | One row per container × job attempt |
| `research_boundary_signals` | All detected signals per run |
| `research_case_boundaries` | Boundary records (start/end, strength, score) |
| `research_case_candidates` | Proposed case spans with review status |
| `research_case_candidate_boundaries` | Candidate ↔ boundary join table |
| `0007-phase05-segmentation.sql` | Applied to dev DB |

Schema additions to `researchCaseCandidates`: `runId`, `strength`, `pageCount`, `reviewStatus`, `reviewedBy`, `reviewedAt`.

### Synthetic fixtures (10 files)

Located in `fixtures/synthetic/segmentation/`:

| Fixture | Scenario |
|---------|----------|
| `single-case.txt` | One complete judgment |
| `multi-case-two.txt` | Two distinct cases |
| `multi-case-three.txt` | Three consecutive cases |
| `no-judgment.txt` | Admin-only (cause list / TOC) — zero auto-accepted candidates |
| `mixed-content.txt` | Judgment + cause list interspersed |
| `incomplete-final-case.txt` | Last case has no closing order |
| `strong-boundary-signals.txt` | Multiple STRONG_BOUNDARY signals |
| `conflicting-signals.txt` | Anti-signals mixed with boundary signals |
| `blank-pages.txt` | Pages with blank content |
| `syariah-style.txt` | Syariah-court fixture |

Each fixture has a companion `.expected.json` describing expected candidate count and boundary roles.

### Decision Record

`docs/decisions/0006-phase-05-segmentation-engine.md`

### Scoring reference

`docs/SCORING_RULES.md`

---

## Architecture decisions

### State machine path

`TEXT_EXTRACTED → SEGMENTATION_PENDING → SEGMENTATION_PROPOSED → SEGMENTATION_REVIEW_REQUIRED`

The pipeline always transitions through `SEGMENTATION_PROPOSED`; `SEGMENTATION_REVIEW_REQUIRED` is a second transition applied only when at least one candidate boundary requires human review. This matches the state machine constraint that `SEGMENTATION_PENDING` can only advance to `SEGMENTATION_PROPOSED`.

### Rights gate (fail-closed)

Processing is blocked for containers with rights status in:  
`DO_NOT_PROCESS`, `DO_NOT_RETAIN`, `UNREVIEWED`, `COMMERCIAL_SOURCE_REVIEW_REQUIRED`, `MANUAL_LEGAL_REVIEW_REQUIRED`.

`PRIVATE_PROCESSING_APPROVED` and other approved statuses proceed.

### Idempotency

Each segmentation run is keyed on `(containerId, contentSha256, attemptCount)`. Re-runs from `SEGMENTATION_REVIEW_REQUIRED` get a new attempt key, creating a fresh run row while preserving the prior run for audit.

### No AI involvement

All 24 signal types are deterministic regex/heuristic detectors. AI adapters are disabled by default in this phase per platform rules.

---

## Test coverage

| Suite | Tests |
|-------|-------|
| Signal detector (pure unit) | 8 |
| Candidate composer (pure unit) | 4 |
| Golden fixture (single-case) | 5 |
| Golden fixture (no-judgment / admin-only) | 1 |
| Golden fixture (incomplete-final-case) | 1 |
| Idempotency and re-run rules | 2 |
| WEAK/CONFLICTING boundary rules | 1 |
| Audit events | 1 |
| HTTP routes (staff) | 7 |
| **Total** | **30** |

---

## Known limitations / next phase inputs

- Block-level signals (`JUDGE_HEADING`, `PARTY_HEADING`) require blocks to be inserted during Phase 04 extraction. If a container has no blocks (text-only extraction), only page-level signals fire.
- The `CASE_PREFIX_RE` pattern (`[A-Z]{1,6}-\d{2,4}-[A-Z0-9]+`) is available but wired only as a supporting signal; case reference scoring relies on the broader `CASE_CITATION_REFERENCE` signal.
- Phase 06 (Case Metadata Extraction) can consume `research_case_candidates` with `reviewStatus = 'auto_accepted'` or `'reviewed'` (status `'rejected'` must be filtered out).

---

PHASE: 05  
STATUS: COMPLETE  
CHECKPOINT: 2026-07-23
