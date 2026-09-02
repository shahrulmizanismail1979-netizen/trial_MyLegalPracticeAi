---
title: Phase 06: Segmentation Validation, Human Review & Cross-File Reconstruction
---
# Phase 06: Segmentation Validation, Human Review & Cross-File Reconstruction

## What & Why

Phase 05 produced case-candidate proposals with boundary strength scores.
Phase 06 adds three layers on top of that:

1. **Coherence & contradiction checks** — Automated structural analysis of
   each candidate evaluating nine coherence dimensions and nine contradiction
   types. Candidates with contradictions route to review; clean candidates
   advance to `EDITORIAL_REVIEW_PENDING`.

2. **Human-review interface** — A full reviewer surface with eleven
   audited actions (move boundary, split, merge, mark non-case / incomplete,
   approve, reject, request reprocessing, etc.). Every action is an
   append-only transformation row with an atomic audit event.

3. **Cross-file relationship detection and reconstruction** — Detect and
   record the eight cross-file relationship types between candidates across
   containers (continuation, duplicate, version, related appeal). A
   confirmed cross-file merge requires explicit human approval; no automatic
   merges where material differences exist.

This phase corresponds to Phase 06 "Consolidation" in `docs/PHASES.md`.

## Done looks like

- A `container.validate` job runs automatically after segmentation
  (`SEGMENTATION_PROPOSED` → `SEGMENTATION_PENDING` → re-enters validation).
  Every candidate receives a structured coherence result record with pass/fail
  per check.
- Candidates with any `CONTRADICTION` result route to
  `SEGMENTATION_REVIEW_REQUIRED`; clean candidates advance their container
  to `EDITORIAL_REVIEW_PENDING`.
- A reviewer can exercise all eleven review actions from the segmentation
  review UI; every action is recorded in `research_candidate_review_actions`
  and `research_audit_events` in the same transaction.
- Boundary moves, splits, and merges are stored as new candidate records
  (with lineage pointers to the original), never as overwrites.
- Cross-file relationships are stored in `research_cross_file_relationships`
  with provenance and evidence. `CONFIRMED_CONTINUATION` and cross-file
  merges are gated on human approval.
- A reviewer can assemble one case from spans across multiple containers by
  linking confirmed continuations, producing a `research_cross_file_spans`
  record.
- All seven synthetic cross-file test scenarios pass their acceptance gates.
- Full api-server suite green; `pnpm run typecheck` clean.
- Completion report and updated `current-phase.json` (phase 06 complete,
  next 07 Search).

## Out of scope

- Publisher/editorial material isolation enforcement beyond flagging
  (deferred to the editorial-review path that already exists in the state
  machine).
- Search indexing (Phase 07).
- AI aids (Phase 08).
- Verified-case creation (that is the human act in
  `JUDGMENT_VERIFICATION_PENDING`; this phase only prepares candidates for
  it).

## Steps

### 1. ADR 0007 + schema migration

Write `docs/decisions/0007-phase-06-validation-review-cross-file.md`
documenting the coherence check vocabulary, the reviewer action model,
the cross-file relationship types, and the database design.

Author additive migration `lib/db/sql/migrations/0009-phase06-validation.sql`
adding:

**`research_candidate_coherence_checks`** — one row per check per
candidate per validation run:
- `candidate_id` FK → `research_case_candidates`
- `validation_run_id` FK → new `research_validation_runs` table
- `check_type TEXT` — one of the 18 check constants (9 coherence +
  9 contradiction; see Step 2)
- `result TEXT` — `PASS | FAIL | UNCERTAIN | NOT_APPLICABLE`
- `detail JSONB` — structured evidence (which pages, which blocks,
  what was found)
- `processor_version TEXT`
- `created_at TIMESTAMPTZ`
- Unique on `(validation_run_id, candidate_id, check_type)`.

**`research_validation_runs`** — one row per `container.validate` job
attempt:
- `container_id`, `job_id`, `run_key`, `processor_version`,
  `status TEXT` (RUNNING | COMPLETE | REVIEW_REQUIRED),
  `created_at`, `finished_at`.
- Unique on `(container_id, run_key)`.

**`research_candidate_review_actions`** — append-only log of all
reviewer actions on a candidate:
- `id SERIAL PRIMARY KEY`
- `candidate_id` FK → `research_case_candidates`
- `action_type TEXT` — one of eleven constants:
  `MOVE_BOUNDARY | SPLIT | MERGE | MARK_NON_CASE | MARK_INCOMPLETE |
   APPROVE | REJECT | REQUEST_REPROCESSING | LINK_CONTINUATION |
   LINK_DUPLICATE | LINK_RELATED`
- `actor TEXT` — reviewer identity
- `detail JSONB` — action-specific payload (e.g. new page for
  MOVE_BOUNDARY; target candidate id for MERGE; relationship type for
  LINK_*)
- `transformation_id` FK → `research_transformations` (every action
  creates a transformation row)
- `created_at TIMESTAMPTZ`
- Index on `(candidate_id, created_at)`.

**`research_cross_file_relationships`** — declared relationships between
candidates across containers:
- `id SERIAL PRIMARY KEY`
- `source_candidate_id` FK → `research_case_candidates`
- `target_candidate_id` FK → `research_case_candidates`
- `relationship_type TEXT` — one of eight constants:
  `POSSIBLE_CONTINUATION | CONFIRMED_CONTINUATION |
   POSSIBLE_DUPLICATE | EXACT_DUPLICATE |
   ALTERNATIVE_VERSION | CORRECTED_VERSION |
   RELATED_APPEAL | UNRELATED`
- `evidence JSONB` — detected signals supporting the relationship
- `confirmed_by TEXT nullable` — populated only when a human confirms
- `confirmed_at TIMESTAMPTZ nullable`
- `created_at TIMESTAMPTZ`
- Unique on `(source_candidate_id, target_candidate_id,
  relationship_type)`.

**`research_cross_file_spans`** — multi-container span assembly for a
single logical case (requires human approval to create):
- `id SERIAL PRIMARY KEY`
- `created_by TEXT` — reviewer who assembled the span
- `approved_by TEXT nullable`
- `approved_at TIMESTAMPTZ nullable`
- `status TEXT` — `PROPOSED | APPROVED | REJECTED`
- `created_at TIMESTAMPTZ`

**`research_cross_file_span_segments`** — ordered segments of a
cross-file span:
- `span_id` FK → `research_cross_file_spans`
- `candidate_id` FK → `research_case_candidates`
- `segment_order INTEGER` — 1-based ordering within the span
- Unique on `(span_id, candidate_id)`.

Update `lib/db/src/schema/research.ts` with typed Drizzle table
definitions. Run `pnpm --filter @workspace/db run push`.

### 2. Coherence & contradiction checker (pure functions)

Create `artifacts/api-server/src/research/validation/coherenceChecker.ts`.

Implement a pure `checkCoherence(candidate, pages, blocks) →
CoherenceResult[]` function. The eighteen check types:

**Coherence checks (all must pass for a candidate to auto-advance):**

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

**Contradiction checks (any FAIL routes to review):**

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
| `NO_SOURCE_PAGE_GAP` | No gap in `page_number` sequence within the candidate's pages |

Each `CoherenceResult` carries: `checkType`, `result` (`PASS | FAIL |
UNCERTAIN | NOT_APPLICABLE`), `detail` (evidence pages, blocks, found
values), `processorVersion`.

A result of `UNCERTAIN` routes to review. `NOT_APPLICABLE` is used when
the check cannot run (e.g. `COHERENT_CITATION` on a candidate from a file
with no detectable citations).

All functions are pure TypeScript — no DB calls — so they can be tested
in isolation without a database.

### 3. Cross-file relationship detector (pure function)

Create
`artifacts/api-server/src/research/validation/crossFileDetector.ts`.

Implement `detectCrossFileRelationships(candidateA, candidateB, pagesA,
pagesB, blocksA, blocksB) → CandidateRelationship | null`:

- **POSSIBLE_CONTINUATION** — `candidateA` ends without a closing order
  AND `candidateB` begins with matching parties/court but no new case
  header. Requires human confirmation.
- **CONFIRMED_CONTINUATION** — only set by human action; never auto-set.
- **POSSIBLE_DUPLICATE** — title + court + date overlap ≥ 80% textual
  similarity (Jaccard on tokens). Requires human confirmation.
- **EXACT_DUPLICATE** — content sha-256 of extracted text matches.
  Auto-proposed; human confirms.
- **ALTERNATIVE_VERSION** — same citation, materially different text
  (edit distance > 10%). Auto-proposed.
- **CORRECTED_VERSION** — same citation, one candidate has a correction
  annotation referencing the other. Human decision.
- **RELATED_APPEAL** — one candidate's text references the other's
  citation as the lower-court decision. Auto-proposed.
- **UNRELATED** — explicit human declaration that two candidates are
  not related (used to close false positives).

The function emits a `CandidateRelationship` with `relationshipType`,
`evidence` (matching signals), `confidenceNote` (descriptive, not a
probability). Confirmed/rejected states are set only via reviewer actions
(Step 5), never by the detector.

Run detection across all candidate pairs within the same batch (same
`source_batch` field on containers). Cross-batch detection is out of
scope this phase.

### 4. Validation pipeline processor

Create `artifacts/api-server/src/research/validation/pipeline.ts`.

Register a `container.validate` processor:

- **Trigger**: fired automatically when `startValidation(containerId,
  actor)` is called. The segmentation pipeline calls `startValidation`
  at the end of a successful segmentation run (so validation starts as
  soon as candidates are proposed, without requiring a separate HTTP
  call). The state transition is `SEGMENTATION_PROPOSED →
  SEGMENTATION_PENDING` before enqueue; the processor transitions to
  `EDITORIAL_REVIEW_PENDING` on success or stays/returns to
  `SEGMENTATION_REVIEW_REQUIRED` on contradictions.
- **Rights gate**: same fail-closed pattern as prior phases.
- **Run identity**: `validate-<sha16>-<VALIDATE_VERSION>-j<job.id>`.
- **Coherence run**: for each candidate in the container, run
  `checkCoherence()`, insert `research_candidate_coherence_checks` rows
  (idempotent via `ON CONFLICT DO NOTHING`).
- **Cross-file detection**: for each pair of candidates in the same
  source batch, call `detectCrossFileRelationships()`, insert
  `research_cross_file_relationships` rows for POSSIBLE_* types
  (idempotent). Never insert CONFIRMED_* or EXACT_DUPLICATE without
  human action.
- **Review routing**: if any candidate has a `FAIL` or `UNCERTAIN`
  coherence result, raise `ReviewRequiredSignal` (→
  `SEGMENTATION_REVIEW_REQUIRED`). Otherwise transition container to
  `EDITORIAL_REVIEW_PENDING`.
- **Zero-candidate containers**: containers with zero candidates skip
  coherence checks and go directly to `EDITORIAL_REVIEW_PENDING`.
- **Transformation record**: `(kind: "validation", description:
  "Checked N candidates, F contradictions found")`.
- **Audit event**: `(entity_type: "container", event: "validation-run",
  detail: { candidateCount, failCount, uncertainCount })`.

### 5. Reviewer action endpoints

Add staff-only routes under
`artifacts/api-server/src/research/routes/candidateReview.ts`.

For each of the eleven reviewer actions, one POST endpoint. All share
the same transaction pattern: insert `research_candidate_review_actions`
row → insert `research_transformations` row → `recordAuditEvent` →
apply structural side-effect (if any) → respond 200/201.

| Endpoint | Action | Side-effect |
|---|---|---|
| `POST /candidates/:id/review/approve` | `APPROVE` | Set `review_status = 'reviewed'` on candidate and its boundaries |
| `POST /candidates/:id/review/reject` | `REJECT` | Set `review_status = 'rejected'`; record reason |
| `POST /candidates/:id/review/reprocess` | `REQUEST_REPROCESSING` | Enqueue `container.validate` job again |
| `POST /candidates/:id/review/move-boundary` | `MOVE_BOUNDARY` | Validate new page is within container; insert new `research_case_boundaries` row for the new page; update `research_case_candidate_boundaries` join; record lineage in detail |
| `POST /candidates/:id/review/split` | `SPLIT` | Validate split page; insert two new candidate rows with status `proposed` and lineage; mark original `rejected`; auto-trigger coherence checks on new candidates |
| `POST /candidates/:id/review/merge` | `MERGE` | Validate adjacency; insert one new candidate spanning both; mark both originals `rejected`; auto-trigger coherence checks; body must carry `targetCandidateId` |
| `POST /candidates/:id/review/mark-non-case` | `MARK_NON_CASE` | Set `status = 'non_case'` on candidate; record reason |
| `POST /candidates/:id/review/mark-incomplete` | `MARK_INCOMPLETE` | Set `status = 'incomplete'` on candidate; record reason |
| `POST /candidates/:id/review/link-continuation` | `LINK_CONTINUATION` | Body: `{ targetCandidateId, confirmed: bool }`. Insert/update cross-file relationship row to POSSIBLE_ or CONFIRMED_CONTINUATION. CONFIRMED requires `confirmed: true`. |
| `POST /candidates/:id/review/link-duplicate` | `LINK_DUPLICATE` | Body: `{ targetCandidateId, type: POSSIBLE_DUPLICATE | EXACT_DUPLICATE | ALTERNATIVE_VERSION | CORRECTED_VERSION }`. |
| `POST /candidates/:id/review/link-related` | `LINK_RELATED` | Body: `{ targetCandidateId, type: RELATED_APPEAL | UNRELATED }`. |

All endpoints: deny-by-default, require `legal_reviewer`, `administrator`,
or `owner` role; 403 for unauthenticated.

### 6. Cross-file span assembly endpoints

Add under `artifacts/api-server/src/research/routes/candidateReview.ts`:

- `POST /cross-file-spans` — Create a proposed span: body
  `{ candidateIds: number[], note: string }`. Validates all candidates
  exist, belong to rights-approved containers, are not already in an
  approved span. Inserts `research_cross_file_spans` (status:
  `PROPOSED`) + `research_cross_file_span_segments` ordered by
  container's original page sequence.
- `POST /cross-file-spans/:id/approve` — Approve (requires `administrator`
  or `owner`). Flips status to `APPROVED`; records audit event; inserts
  transformation row.
- `POST /cross-file-spans/:id/reject` — Flip to `REJECTED`; record reason.
- `GET /cross-file-spans` — List all spans with status, candidate ids,
  container ids.
- `GET /cross-file-spans/:id` — Full span detail: segments in order,
  candidate summaries, coherence results, relationship evidence.

### 7. Segmentation review UI — extended

Extend the existing server-rendered review UI
(`artifacts/api-server/src/research/routes/reviewUi.ts` or a new
`segmentationReviewUi.ts`) at
`GET /api/research/containers/:id/segmentation-review` to include:

- **Coherence panel per candidate** — a table of 18 checks showing
  PASS / FAIL / UNCERTAIN / N/A with the detail evidence expandable.
- **Reviewer action panel** — buttons and forms for each of the eleven
  actions (rendered as a form that POSTs to the appropriate endpoint).
  Actions that create new candidates (split, merge) show a confirmation
  prompt with the new span.
- **Cross-file relationship panel** — list of detected POSSIBLE_*
  relationships for this container's candidates, with "Confirm" /
  "Reject" buttons wired to the link-* endpoints.
- **Audit trail** — the last 20 `research_candidate_review_actions` rows
  for the container's candidates, newest first.

All UI forms use the existing Clerk staff session cookie — no new auth.

### 8. Synthetic fixtures + acceptance tests

**Seven cross-file test fixtures** in `fixtures/synthetic/cross-file/`.
Generate with a script
`artifacts/api-server/scripts/generate-cross-file-fixtures.ts`:

| Fixture pair | Scenario |
|---|---|
| `split-a.txt` + `split-b.txt` | One case split across two containers |
| `similar-unrelated-a.txt` + `similar-unrelated-b.txt` | Two cases with similar but distinct party names and courts |
| `continuation-with-repeated-page-a.txt` + `continuation-with-repeated-page-b.txt` | Continuation where the last page of A is repeated as the first page of B |
| `missing-middle-a.txt` + `missing-middle-b.txt` | A single case split across three containers where the middle one is absent |
| `corrected-original.txt` + `corrected-replacement.txt` | Same citation, replacement has added "Corrigendum" heading |
| `duplicate-scan-clean.txt` + `duplicate-scan-ocr.txt` | Same judgment, one native PDF, one OCR scan with confidence variations |
| `false-continuation-a.txt` + `false-continuation-b.txt` | Superficially similar party names produce POSSIBLE_CONTINUATION that a reviewer marks UNRELATED |

Each pair has a `<scenario>.expected.json` specifying: expected
relationship types detected, which require human confirmation, expected
coherence check results.

**`phase06.test.ts`** alongside existing phase tests:

Acceptance-gate tests:

- Coherence checks: each of the 18 check types passes a unit test
  with a synthetic page/block set (pure function test, no DB).
- Contradiction detection: for each contradiction type, a fixture
  containing a candidate with that contradiction fails the relevant
  check.
- Review action integrity:
  - `MOVE_BOUNDARY` to a page outside the container is rejected 400.
  - `SPLIT` produces two new candidates with total page coverage = original.
  - `MERGE` produces one candidate spanning both originals; originals
    are `rejected`.
  - `APPROVE` + `REJECT` are idempotent (second call is a no-op with
    409).
  - Every action inserts exactly one transformation row and one audit
    event.
- Cross-file: `split-a` + `split-b` scenario produces
  `POSSIBLE_CONTINUATION`; human `link-continuation` with
  `confirmed: true` produces `CONFIRMED_CONTINUATION`; span assembly
  succeeds; approval succeeds.
- Cross-file: `false-continuation` scenario produces
  `POSSIBLE_CONTINUATION` that reviewer marks `UNRELATED`; no span is
  created.
- No automatic merge: `duplicate-scan` scenario produces
  `POSSIBLE_DUPLICATE` or `EXACT_DUPLICATE` but state remains
  `SEGMENTATION_REVIEW_REQUIRED` until human approves span.
- All source pages are classified (covered by a candidate or explicitly
  unassigned) after validation.
- Staff-only gate: all review-action endpoints return 403 for
  unauthenticated requests.

### 9. Close-out

Follow `docs/BUILD_PROMPT.md`:

- Run `pnpm run typecheck` + `pnpm --filter @workspace/api-server run test`.
- Browser-test the extended segmentation review UI: log in as a staff
  reviewer, inspect a candidate with a contradiction, use the
  MOVE_BOUNDARY and APPROVE actions, verify audit trail, verify the
  cross-file relationship panel.
- Write `docs/reports/phase-06-completion.md`.
- Update `docs/status/current-phase.json` → phase 06 complete, next
  07 Search & Research UI.
- Respond with `PHASE: / STATUS: / CHECKPOINT:` structure.

## Relevant files

- `docs/BUILD_PROMPT.md`
- `docs/PHASES.md`
- `docs/PROCESSING_STATES.md`
- `docs/ARCHITECTURE.md`
- `docs/PROJECT_CHARTER.md`
- `docs/status/current-phase.json`
- `docs/reports/phase-05-completion.md`
- `docs/decisions/0006-phase-05-segmentation.md`
- `lib/db/src/schema/research.ts`
- `lib/db/sql/migrations/0007-phase05-segmentation.sql`
- `lib/db/sql/migrations/0008-phase05-candidate-idempotency.sql`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/domain/audit.ts`
- `artifacts/api-server/src/research/segmentation/pipeline.ts`
- `artifacts/api-server/src/research/segmentation/candidateComposer.ts`
- `artifacts/api-server/src/research/segmentation/signalDetector.ts`
- `artifacts/api-server/src/research/routes/segmentation.ts`
- `artifacts/api-server/src/research/routes/reviewUi.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/testing/testDb.ts`
- `artifacts/api-server/src/research/phase05.test.ts`
- `fixtures/synthetic/segmentation/`