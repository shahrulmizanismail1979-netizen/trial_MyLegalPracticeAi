# ADR 0006 — Phase 05: Multi-Case Segmentation Engine

- **Date**: 2026-07-23
- **Status**: Accepted
- **Phase**: 05 (Segmentation)

## Context

Phase 04 extraction produces a flat sequence of pages and text blocks per
container. The charter states that a single file may contain zero, one, or
many judgments. Phase 05 adds deterministic case-boundary detection: scan
extracted blocks for structured signals, score evidence at every candidate
boundary location, and propose case candidates for human review.

No AI is involved. The score is a **deterministic, additive, weighted integer
— explicitly NOT a calibrated probability**. Uncertain or conflicting
boundaries always route to human review. Verified cases are a later phase.

---

## Signal Vocabulary (24 Types)

Each signal instance is one detected occurrence of a named signal type on a
specific page and (optionally) block.

| # | Constant | Category | Score |
|---|---|---|---|
| 1 | `NEW_CASE_TITLE` | Case-start evidence | +12 |
| 2 | `NEW_PARTY_CONFIGURATION` | Case-start evidence | +8 |
| 3 | `NEUTRAL_CITATION` | Case-start evidence | +14 |
| 4 | `REPORT_CITATION` | Case-start evidence | +10 |
| 5 | `COURT_HEADING` | Case-start evidence | +10 |
| 6 | `PROCEEDING_NUMBER` | Case-start evidence | +10 |
| 7 | `CORAM_HEADING` | Case-start evidence | +6 |
| 8 | `JUDGE_HEADING` | Case-start evidence | +6 |
| 9 | `DECISION_DATE` | Case-start evidence | +5 |
| 10 | `JUDGMENT_HEADING` | Case-start evidence | +5 |
| 11 | `PARAGRAPH_RESET` | Structural evidence | +8 |
| 12 | `PAGE_NUMBER_RESTART` | Structural evidence | +8 |
| 13 | `CLOSING_ORDER` | Case-end evidence | +10 |
| 14 | `JUDICIAL_SIGNATURE` | Case-end evidence | +8 |
| 15 | `ABRUPT_METADATA_CHANGE` | Structural evidence | +4 |
| 16 | `ABRUPT_SEMANTIC_CHANGE` | Structural evidence | +3 |
| 17 | `TYPOGRAPHY_CHANGE` | Structural evidence | +3 |
| 18 | `PUBLISHER_DIVIDER` | Structural evidence | +4 |
| 19 | `BLANK_DIVIDER_PAGE` | Structural evidence | +5 |
| 20 | `REPEATED_TITLE_IN_QUOTATION` | Anti-signal | -8 |
| 21 | `ADMINISTRATIVE_MATERIAL` | Anti-signal | -6 |
| 22 | `INCOMPLETE_CASE_END` | Uncertainty signal | +3 |
| 23 | `MULTI_PAGE_GAP` | Structural evidence | +4 |
| 24 | `PUBLISHER_ATTRIBUTION` | Anti-signal | -4 |

Positive scores indicate boundary evidence; negative scores reduce the
composite (anti-signals).

---

## Five Strength Tiers

| Tier | Condition |
|---|---|
| `STRONG_BOUNDARY_CANDIDATE` | composite_score ≥ STRONG_THRESHOLD (20) AND conflicting_signal_count = 0 |
| `MODERATE_BOUNDARY_CANDIDATE` | composite_score ≥ MODERATE_THRESHOLD (12) AND conflicting_signal_count ≤ 1 |
| `WEAK_BOUNDARY_CANDIDATE` | composite_score ≥ WEAK_THRESHOLD (6) AND conflicting_signal_count ≤ 2 |
| `CONFLICTING_BOUNDARY` | conflicting_signal_count > 2 OR (positive score but conflicts exceed positive signals) |
| `NO_BOUNDARY` | composite_score < WEAK_THRESHOLD — not recorded |

---

## Scoring Rules

See `artifacts/api-server/src/research/segmentation/SCORING_RULES.md` for
the full scored vocabulary.

**Minimum evidence**: a boundary proposal requires either:
- at least **two independent signal types** from different signal instances, OR
- one signal type whose single contribution is ≥ STRONG_SINGLE_THRESHOLD (12).

A single weak signal alone produces `NO_BOUNDARY`.

**Composite score**: sum of all `score_contribution` values on the page.
Negative anti-signal contributions reduce the composite. The final integer is
not a probability; thresholds are calibration checkpoints, not confidence
levels.

**Conflicting signal count**: the count of *negative* signal instances
(anti-signals) that fire on the same page as positive boundary signals.

---

## Schema Design

Five new tables:

1. **`research_segmentation_runs`** — one row per `container.segment` job
   attempt; unique on `(container_id, run_key)`.
2. **`research_boundary_signals`** — one row per detected signal instance;
   idempotency via unique `(run_id, page_id, signal_type, signal_value)`.
3. **`research_case_boundaries`** — one row per proposed boundary location;
   idempotency via unique `(run_id, page_id, boundary_role)`.
4. **`research_case_candidate_boundaries`** — join: one candidate → one
   start boundary + one end boundary.
5. **`research_case_candidates`** augmented with Phase 05 columns:
   `run_id`, `strength`, `page_count`, `review_status`, `reviewed_by`,
   `reviewed_at`.

Existing JSONB `spans`/`detail` columns on `research_case_candidates` are
retained for backward compatibility. The new columns are canonical.

---

## Pipeline Behaviour

- Rights-gated (fail-closed): only `RIGHTS_APPROVED` containers proceed.
- Input states: `TEXT_EXTRACTED` or `SEGMENTATION_REVIEW_REQUIRED`.
- Idempotent: signals and boundaries use `ON CONFLICT DO NOTHING`.
- Run identity: `segment-<sha16>-<SEGMENT_VERSION>-j<job_id>` (per-attempt,
  same pattern as Phase 04 extraction).
- Zero-candidate result → `SEGMENTATION_PROPOSED` (not a failure).
- All boundaries `STRONG` or `MODERATE` with no conflicts → `SEGMENTATION_PROPOSED`.
- Any `WEAK_BOUNDARY_CANDIDATE` or `CONFLICTING_BOUNDARY` → `SEGMENTATION_REVIEW_REQUIRED`.
- Re-run from `SEGMENTATION_REVIEW_REQUIRED` allowed; re-run from
  `SEGMENTATION_PROPOSED` refused with `INVALID_STATE`.

---

## Review

Staff can accept, reject, or flag individual candidates at
`POST /api/research/containers/:id/candidates/:candidateId/review`.
The decision is recorded with an atomic audit event. Raw signal and boundary
records are **never overwritten** — only `review_status` on the candidate row
and on the relevant boundary rows is updated.

---

## Consequences

- Segmentation is deterministic and fully reproducible from the same input.
- Human review is the gate before consolidation (Phase 06).
- No AI used; no document content leaves the server.
- All 24 signal detectors can be independently validated against synthetic
  fixtures without a database.
