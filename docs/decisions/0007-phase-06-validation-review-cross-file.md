# ADR 0007 — Phase 06: Segmentation Validation, Human Review & Cross-File Reconstruction

- **Date**: 2026-07-24
- **Status**: Accepted
- **Phase**: 06 (Consolidation)

## Context

Phase 05 produced case-candidate proposals with boundary strength scores. A candidate
with strong boundary scores may still be structurally incoherent (e.g. mixed courts,
repeated closing orders, paragraph discontinuities). Additionally, a single logical
judgment may be split across two or more source files, requiring cross-file
reconstruction.

Phase 06 adds three layers on top of Phase 05's output:

1. **Coherence & contradiction checks** — 9 coherence dimensions + 9 contradiction
   types evaluated per candidate. Clean candidates advance to `EDITORIAL_REVIEW_PENDING`;
   candidates with `FAIL` or `UNCERTAIN` results stay in `SEGMENTATION_REVIEW_REQUIRED`.

2. **Structured human-review interface** — 11 audited reviewer actions. Every action is
   an append-only `research_candidate_review_actions` row combined with a
   `research_transformations` row and a `research_audit_events` row in the same
   transaction. Raw boundary/signal rows are never overwritten.

3. **Cross-file relationship detection and reconstruction** — 8 relationship types
   between candidates across containers. Confirmed cross-file continuations and merges
   require explicit human approval; no automatic merges.

---

## Coherence Check Vocabulary (18 types)

### Coherence checks (FAIL routes to review)

| Constant | Tests for |
|---|---|
| `COHERENT_CASE_IDENTITY` | Consistent case title / citation across the span |
| `COHERENT_COURT` | Same court name throughout |
| `COHERENT_PARTIES` | Party names consistent (not unrelated changes) |
| `COHERENT_CITATION` | One primary citation (neutral or report) |
| `COHERENT_JUDGE` | Same coram / judge throughout |
| `COHERENT_NARRATIVE` | Procedural text follows a recognisable judgment arc |
| `COHERENT_PARAGRAPHS` | Paragraph sequence is monotonically increasing |
| `COHERENT_DISPUTE` | Substantive dispute is present and of one type |
| `COHERENT_CONCLUSION` | A dispositive conclusion is present |

### Contradiction checks (any FAIL routes to review)

| Constant | Flags when |
|---|---|
| `NO_MIXED_COURTS` | Different court names appear inside one segment |
| `NO_UNRELATED_PARTY_CHANGE` | Party names change to completely unrelated names mid-span |
| `NO_MULTIPLE_DECISIONS` | Two independent dispositive orders exist in one span |
| `NO_REPEATED_ENDINGS` | Closing order / judicial signature appears more than once |
| `NO_NEW_PROCEEDING_MID_SPAN` | New proceeding number begins inside the span |
| `HAS_BEGINNING` | The span's start page carries case-start signals |
| `HAS_ENDING` | The span's end page carries case-end signals (or flagged incomplete) |
| `SEQUENTIAL_PARAGRAPHS` | No paragraph-number discontinuity ≥ 10 |
| `NO_SOURCE_PAGE_GAP` | No gap in page_number sequence within the candidate's pages |

Result values: `PASS | FAIL | UNCERTAIN | NOT_APPLICABLE`.

`NOT_APPLICABLE` is used when the check cannot run (e.g. `COHERENT_CITATION` on a
candidate from a file with no detectable citations). `UNCERTAIN` routes to review but
does not constitute a definitive failure.

---

## Reviewer Action Model (11 types)

All actions are append-only. Every action writes:
- one `research_candidate_review_actions` row
- one `research_transformations` row (lineage)
- one `research_audit_events` row (same transaction)

| Action | Side-effect |
|---|---|
| `APPROVE` | Sets `review_status = 'reviewed'` on candidate and its boundaries |
| `REJECT` | Sets `review_status = 'rejected'`; records reason |
| `REQUEST_REPROCESSING` | Enqueues `container.validate` job again |
| `MOVE_BOUNDARY` | Validates new page is within container; inserts new boundary row; updates join |
| `SPLIT` | Validates split page; inserts two new candidate rows; marks original `rejected` |
| `MERGE` | Validates adjacency; inserts one new candidate spanning both; marks both originals `rejected` |
| `MARK_NON_CASE` | Sets `status = 'non_case'`; records reason |
| `MARK_INCOMPLETE` | Sets `status = 'incomplete'`; records reason |
| `LINK_CONTINUATION` | Inserts/updates cross-file relationship: POSSIBLE_ or CONFIRMED_CONTINUATION |
| `LINK_DUPLICATE` | Inserts cross-file relationship: POSSIBLE_DUPLICATE / EXACT_DUPLICATE / ALTERNATIVE_VERSION / CORRECTED_VERSION |
| `LINK_RELATED` | Inserts cross-file relationship: RELATED_APPEAL or UNRELATED |

`APPROVE` and `REJECT` are idempotent: a second call on an already-decided candidate
returns 409 Conflict.

`SPLIT` and `MERGE` auto-trigger coherence checks on the resulting new candidates
(new `container.validate` job).

---

## Cross-File Relationship Types (8)

| Type | Description |
|---|---|
| `POSSIBLE_CONTINUATION` | CandidateA ends without closing order AND CandidateB begins with matching parties/court but no new header. Human confirmation required. |
| `CONFIRMED_CONTINUATION` | Only set by human `LINK_CONTINUATION` action with `confirmed: true`. |
| `POSSIBLE_DUPLICATE` | Title + court + date overlap ≥ 80% textual similarity (Jaccard on tokens). Human confirmation required. |
| `EXACT_DUPLICATE` | Content sha-256 of extracted text matches. Auto-proposed; human confirms. |
| `ALTERNATIVE_VERSION` | Same citation, materially different text (edit distance > 10%). Auto-proposed. |
| `CORRECTED_VERSION` | Same citation, one candidate has a correction annotation referencing the other. Human decision. |
| `RELATED_APPEAL` | One candidate's text references the other's citation as the lower-court decision. Auto-proposed. |
| `UNRELATED` | Explicit human declaration that two candidates are not related. |

Detection runs across candidate pairs within the same source batch
(`research_source_containers.source_batch`). Cross-batch detection is deferred.

---

## Database Design (6 new tables)

### `research_validation_runs`
One row per `container.validate` job attempt. Unique on `(container_id, run_key)`.

### `research_candidate_coherence_checks`
One row per check per candidate per validation run.
Unique on `(validation_run_id, candidate_id, check_type)`.

### `research_candidate_review_actions`
Append-only log of all reviewer actions. Index on `(candidate_id, created_at)`.

### `research_cross_file_relationships`
Declared relationships between candidates across containers.
Unique on `(source_candidate_id, target_candidate_id, relationship_type)`.

### `research_cross_file_spans`
Multi-container span assembly for a single logical case. Status: `PROPOSED | APPROVED | REJECTED`.
Requires explicit human approval to create.

### `research_cross_file_span_segments`
Ordered segments of a cross-file span. Unique on `(span_id, candidate_id)`.

---

## Pipeline Behaviour

### container.validate processor

- **Trigger**: called by segmentation pipeline after `SEGMENTATION_PROPOSED`.
- **State path**: `SEGMENTATION_PROPOSED → SEGMENTATION_PENDING` (re-entering) → `EDITORIAL_REVIEW_PENDING` (clean) or `SEGMENTATION_REVIEW_REQUIRED` (contradictions).
- **Rights gate**: same fail-closed pattern as prior phases.
- **Run identity**: `validate-<sha16>-<VALIDATE_VERSION>-j<job.id>`.
- **Coherence run**: pure `checkCoherence()` per candidate → inserts `research_candidate_coherence_checks` (idempotent via `ON CONFLICT DO NOTHING`).
- **Cross-file detection**: pure `detectCrossFileRelationships()` across same-batch candidate pairs → inserts POSSIBLE_* relationships. CONFIRMED_* never auto-set.
- **Zero-candidate containers**: skip coherence; advance directly to `EDITORIAL_REVIEW_PENDING`.
- **Transformation + audit**: one `research_transformations` row + one `research_audit_events` row per run.

---

## Consequences

- Human review is the gate before `EDITORIAL_REVIEW_PENDING` for all containers with candidates.
- No automatic merges; all structural candidate changes are append-only with lineage.
- Cross-file span assembly produces a separate provenance record (`research_cross_file_spans`) that requires explicit approval before being treated as a unified logical case.
- All checks are pure TypeScript — deterministic, no AI, no external calls.
