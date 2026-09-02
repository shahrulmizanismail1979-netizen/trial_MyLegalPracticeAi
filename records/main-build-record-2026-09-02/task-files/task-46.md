# Phase 05: Multi-Case Segmentation Engine

## What & Why

The extraction phase left every ingested container as a flat sequence of
pages and text blocks. Phase 05 adds deterministic case-boundary detection:
a segmentation processor scans the extracted blocks for 24 independently
weighted signal types, scores the evidence at every candidate boundary
location, classifies each location into one of five strength tiers, and
proposes zero, one, or many case candidates per container — never declaring
a verified case. Uncertain or conflicting boundaries route to human review.
No AI, no guessing, full provenance.

## Done looks like

- `POST /api/research/containers/:id/segmentation` starts a background
  `container.segment` job; container moves `TEXT_EXTRACTED →
  SEGMENTATION_PENDING` (rights-gated, idempotent).
- After the job runs, every proposed candidate is stored with its start
  boundary, end boundary, all detected signals, composite score, strength
  classification, and review status.
- Containers with only `STRONG_BOUNDARY_CANDIDATE` or
  `MODERATE_BOUNDARY_CANDIDATE` boundaries (no conflicts, no uncertain
  signals) move to `SEGMENTATION_PROPOSED`; all others move to
  `SEGMENTATION_REVIEW_REQUIRED`.
- A container with zero extractable content (no judgments) produces zero
  candidates and moves to `SEGMENTATION_PROPOSED` — the "no judgment"
  outcome is explicit, not a failure.
- A server-rendered segmentation review UI at
  `GET /api/research/containers/:id/segmentation-review` lists candidates,
  boundaries, signal evidence, and a review decision form.
- All 10 golden fixtures pass their `.expected.json` acceptance gates
  (true starts detected, true ends detected, no incorrect auto-approval,
  all pages classified).
- Full api-server test suite green; `pnpm run typecheck` clean.
- Completion report written; `current-phase.json` updated to phase 05
  complete / next phase 06.

## Out of scope

- Merging candidates into verified cases (Phase 06 Consolidation).
- Cross-file candidate spans (designed for but not implemented this phase).
- Publisher/editorial content screening (Phase 06).
- Search indexing, AI aids (Phases 07–08).
- Uniform disable-safe routing for non-OCR adapters (documented Phase 04
  limitation; still deferred).

## Steps

### 1. ADR 0006 + schema migration

Write `docs/decisions/0006-phase-05-segmentation.md` documenting the
signal vocabulary, the five strength tiers, the scoring rules (additive
weighted integer score, documented thresholds, explicitly NOT a
probability), and the multi-table schema design. Then author additive
migration `lib/db/sql/migrations/0007-phase05-segmentation.sql` adding:

- **`research_segmentation_runs`** — one row per `container.segment` job
  attempt (container id, job id, processor version, adapter identity,
  status, created/finished timestamps). Unique on `(container_id,
  run_key)` where run key is `segment-<sha16>-<version>-j<job_id>`.
- **`research_boundary_signals`** — one row per detected signal instance:
  `(run_id, page_id, block_id nullable, signal_type, signal_value,
  supporting_text, score_contribution integer, processor_version)`.
  `signal_type` is a checked enum of the 24 types. Index on
  `(run_id, page_id)`.
- **`research_case_boundaries`** — one row per proposed boundary location:
  `(run_id, page_id, block_id nullable, boundary_role TEXT — "start" |
  "end", strength TEXT — five tiers, composite_score integer, conflicting
  signal_count integer, review_status TEXT — "auto_accepted" |
  "review_required" | "reviewed" | "rejected", reviewed_by nullable,
  reviewed_at nullable)`. A boundary is `auto_accepted` only when strength
  is `STRONG_BOUNDARY_CANDIDATE` with no conflicting signals.
- **`research_case_candidate_boundaries`** join table — links a candidate
  row to its start boundary and end boundary (both `research_case_boundaries`
  ids). One candidate has exactly one start and one end boundary.
- Augment the existing **`research_case_candidates`** table with columns:
  `run_id` (FK → `research_segmentation_runs`), `strength TEXT`,
  `page_count integer`, `review_status TEXT`, `reviewed_by nullable`,
  `reviewed_at nullable`. The old `spans`/`detail` JSONB columns are kept
  for backward compatibility but the new schema is canonical. Add
  `uniqueIndex` on `(run_id, start_boundary_id)`.
- Widen `research_audit_events.entity_type` enum to include
  `"segmentation_run"` and `"case_candidate"`.

Update `lib/db/src/schema/research.ts` with typed Drizzle table definitions.
Run `pnpm --filter @workspace/db run push` to apply.

### 2. Signal detector (pure function, independently testable)

Create `artifacts/api-server/src/research/segmentation/signalDetector.ts`.

Implement a pure `detectSignals(pages, blocks) → DetectedSignal[]` function
that scans extracted page/block records and emits one `DetectedSignal`
record per matched signal instance. Implement all 24 signal types:

| # | Signal type constant | Detection method |
|---|---|---|
| 1 | `NEW_CASE_TITLE` | Regex: known title patterns (`[YEAR] court-ref [N]`, `[N] MLJ`, etc.) |
| 2 | `NEW_PARTY_CONFIGURATION` | `v.` / `lwn.` between title-case noun phrases |
| 3 | `NEUTRAL_CITATION` | `[YEAR] court-code N` pattern |
| 4 | `REPORT_CITATION` | `[YEAR] N MLJ N`, `N CLJ N`, `N AMR N`, etc. |
| 5 | `COURT_HEADING` | Known court names as block headings |
| 6 | `PROCEEDING_NUMBER` | `Guaman Sivil`, `Kes No`, `Civil Suit`, `Criminal Appeal`, etc. |
| 7 | `CORAM_HEADING` | "Coram:", "Presided by:", "Before:" |
| 8 | `JUDGE_HEADING` | `JC`, `J`, `FCJ`, `CJ` suffix in heading context |
| 9 | `DECISION_DATE` | Date in heading or near judgment text |
| 10 | `JUDGMENT_HEADING` | "Judgment", "Penghakiman", "Award", section heading |
| 11 | `PARAGRAPH_RESET` | Paragraph numbers restart from 1 or \[1\] |
| 12 | `PAGE_NUMBER_RESTART` | Page footer/header number resets to 1 |
| 13 | `CLOSING_ORDER` | "IT IS ORDERED", "DIPERINTAHKAN", "dismissed with costs" |
| 14 | `JUDICIAL_SIGNATURE` | "Signed:", "Sgd:", judge name + date block |
| 15 | `ABRUPT_METADATA_CHANGE` | Block-level metadata field (court, year) changes sharply |
| 16 | `ABRUPT_SEMANTIC_CHANGE` | Cosine distance heuristic across adjacent blocks (no AI) |
| 17 | `TYPOGRAPHY_CHANGE` | Font size / style change detected in block metadata |
| 18 | `PUBLISHER_DIVIDER` | Repeated horizontal rule / asterisk / em-dash divider |
| 19 | `BLANK_DIVIDER_PAGE` | Page with zero text blocks or only whitespace |
| 20 | `REPEATED_TITLE_IN_QUOTATION` | Same title text found inside a quotation block (anti-signal) |
| 21 | `ADMINISTRATIVE_MATERIAL` | Index / table-of-contents / cause list page patterns |
| 22 | `INCOMPLETE_CASE_END` | File ends without a closing order or signature |
| 23 | `MULTI_PAGE_GAP` | Page number jump (≥3 pages) suggesting missing pages |
| 24 | `PUBLISHER_ATTRIBUTION` | Publisher name/address/copyright block (editorial material) |

Each `DetectedSignal` carries: `pageId`, `blockId?`, `signalType`,
`signalValue` (matched text or metric), `supportingText` (surrounding
context), `scoreContribution` (positive = boundary evidence; negative =
anti-signal e.g. `REPEATED_TITLE_IN_QUOTATION`), `processorVersion`.

Document scoring weights in the ADR and in a co-located
`SCORING_RULES.md`. The score is a **deterministic integer** — document
it explicitly as not a calibrated probability.

### 3. Candidate composer (boundary scoring + classification)

Create `artifacts/api-server/src/research/segmentation/candidateComposer.ts`.

Implement `composeCandidate(signals: DetectedSignal[], pageRange) →
BoundaryProposal`:

- **Aggregate** signals by page location into per-page scores.
- **Classify** each candidate boundary location:
  - `STRONG_BOUNDARY_CANDIDATE` — score ≥ `STRONG_THRESHOLD` (documented),
    no conflicting signals.
  - `MODERATE_BOUNDARY_CANDIDATE` — score ≥ `MODERATE_THRESHOLD`, ≤ 1
    conflicting signal.
  - `WEAK_BOUNDARY_CANDIDATE` — score ≥ `WEAK_THRESHOLD`, ≤ 2 conflicting
    signals. **Cannot be auto-accepted.**
  - `CONFLICTING_BOUNDARY` — conflicting signals exceed 2 or score is
    positive but conflicting signals exceed positive signals. Routes to
    review.
  - `NO_BOUNDARY` — score below `WEAK_THRESHOLD`. Not recorded as a
    boundary row.
- **Enforce**: a boundary proposal requires at least two independent signals
  OR one strong signal above a higher threshold. A single weak signal alone
  produces `NO_BOUNDARY`.
- For every container, **all source pages must be classified**: pages covered
  by a candidate span are assigned to that candidate; pages between
  candidates or at the start/end with no signals are recorded as
  `unassigned_pages` in the run record (not silently dropped).
- The function is a pure TypeScript function; no DB calls. Fully testable
  without a database.

### 4. Segmentation pipeline processor

Create `artifacts/api-server/src/research/segmentation/pipeline.ts`.

Register a `container.segment` processor:

- **Rights gate**: fail-closed — abort if container's `rights_status` is
  not `RIGHTS_APPROVED`.
- **Input**: fetch all `research_source_pages` + `research_text_blocks` +
  `research_page_extractions` for the container from the latest extraction
  run.
- **Run identity**: `segment-<sha16(content_sha256)>-<SEGMENT_VERSION>-j<job.id>`
  — each job attempt owns a fresh segmentation run (same pattern as Phase
  04 extraction run identity). Mid-run retries reuse the same job row and
  resume the same run.
- **Idempotent outputs**: signals and boundaries are inserted with
  `ON CONFLICT DO NOTHING` keyed on `(run_id, page_id, signal_type,
  signal_value)` for signals and `(run_id, page_id, boundary_role)` for
  boundaries.
- **Signal detection**: call `detectSignals()`.
- **Candidate composition**: call `composeCandidate()` for each proposed
  span. Insert `research_segmentation_runs`, `research_boundary_signals`,
  `research_case_boundaries`, and `research_case_candidates` rows.
- **Unassigned page recording**: pages not covered by any candidate span
  are recorded in `research_segmentation_runs.detail` JSONB as
  `unassigned_pages: number[]`.
- **Review routing**: if any boundary is `WEAK_BOUNDARY_CANDIDATE` or
  `CONFLICTING_BOUNDARY`, raise `ReviewRequiredSignal` (→
  `SEGMENTATION_REVIEW_REQUIRED`) with a structured reason listing boundary
  ids. Otherwise transition to `SEGMENTATION_PROPOSED`.
- **Zero-candidate case**: a container that yields no boundaries transitions
  to `SEGMENTATION_PROPOSED` with an empty candidates list — not a failure
  and not review-required.
- **Audit**: every candidate insert fires an audit event
  `(entity_type: "case_candidate", kind: "proposed")` in the same
  transaction.
- **Transformation record**: the segmentation run records a
  `research_transformations` row `(kind: "segmentation", description:
  "Proposed N case candidates from M pages")`.

### 5. Routes + segmentation review UI

Add staff-only routes under `artifacts/api-server/src/research/routes/segmentation.ts`:

- `POST /api/research/containers/:id/segmentation` — enqueue
  `container.segment` job, respond 202 with `{ jobId }`.  Requires container
  to be in `TEXT_EXTRACTED` or `SEGMENTATION_REVIEW_REQUIRED`.
- `GET /api/research/containers/:id/candidates` — list all candidates for the
  container with strength, score, page range, and review status.
- `GET /api/research/containers/:id/candidates/:candidateId` — full candidate
  detail: boundaries, all detected signals (with supporting text), conflicting
  signals, unassigned pages in run.
- `GET /api/research/containers/:id/segmentation-review` — server-rendered
  HTML staff review UI showing the candidate list, per-candidate boundary
  evidence, signal table, and a review decision form.
- `POST /api/research/containers/:id/candidates/:candidateId/review` — staff
  accept/reject/flag decision (append-only, atomic audit event; no candidate
  row mutation — status updated only on the `review_status` column, raw
  signal/boundary records never overwritten).

All routes: deny-by-default (Clerk staff role); 403 for unauthenticated.
Register routes in `artifacts/api-server/src/research/routes/index.ts`.

### 6. Golden fixtures + acceptance tests

**Fixtures** in `fixtures/synthetic/segmentation/` — ten deterministic plain-text
files generated by a script
`artifacts/api-server/scripts/generate-segmentation-fixtures.ts`, each with a
corresponding `<name>.expected.json`. The ten fixtures:

| File | Content |
|---|---|
| `single-case.txt` | One judgment, clean signals |
| `two-case.txt` | Two judgments with a publisher divider |
| `ten-case.txt` | Ten judgments, mixed signal density |
| `thirty-case.txt` | Thirty judgments (stress test) |
| `admin-between-cases.txt` | Administrative/cause-list pages between two judgments |
| `quoted-titles.txt` | Repeated case titles inside cited quotations |
| `no-neutral-citation.txt` | Judgments identified only by parties + court |
| `page-restart.txt` | Page number restarts mid-file (two booklets bound together) |
| `incomplete-final-case.txt` | Last judgment has no closing order or signature |
| `no-judgment.txt` | Administrative/index document only |

Each `.expected.json` specifies:
```json
{
  "candidateCount": N,
  "candidates": [
    {
      "startPage": N, "startBlock": N,
      "endPage": N, "endBlock": N,
      "reviewRequired": bool,
      "startStrength": "STRONG_BOUNDARY_CANDIDATE | ...",
      "endStrength": "..."
    }
  ],
  "unassignedPages": [...],
  "nonCaseMaterialPages": [...]
}
```

**`phase05.test.ts`** (alongside existing phase test files):

- One test per golden fixture: run the full pipeline against a seeded
  container, drain the job queue, compare output against `.expected.json`.
- Explicit acceptance-gate tests:
  - All true case starts detected.
  - All true case ends detected.
  - No `WEAK_BOUNDARY_CANDIDATE` or `CONFLICTING_BOUNDARY` boundary is
    `auto_accepted`.
  - No source page disappears (page count in = page count classified + unassigned).
  - `no-judgment.txt`: zero candidates, state `SEGMENTATION_PROPOSED`, no
    review required.
  - `quoted-titles.txt`: repeated titles inside quotations do NOT generate
    spurious candidates (anti-signal test).
  - `incomplete-final-case.txt`: incomplete boundary routes to review.
  - Re-run from `SEGMENTATION_REVIEW_REQUIRED` creates a fresh run (same
    per-job-attempt key pattern as Phase 04).
  - Idempotency: re-running on an already-`SEGMENTATION_PROPOSED` container
    is refused with `INVALID_STATE`.
  - Staff routes: 202 start, 200 list, 200 detail, 403 unauthenticated,
    200 review UI HTML.
  - Review submission: decision recorded with audit event; raw signals/
    boundaries unchanged.

All pre-existing tests must remain passing.

### 7. Close-out

Following `docs/BUILD_PROMPT.md`:

- Run full check: `pnpm run typecheck`, `pnpm --filter @workspace/api-server run test`.
- Browser-test the segmentation review UI with a real Clerk-authenticated
  staff session: navigate to review UI, verify candidate list and signal
  evidence, submit a review decision, confirm audit event created.
- Write `docs/reports/phase-05-completion.md` (all BUILD_PROMPT sections).
- Update `docs/status/current-phase.json` → phase 05 complete, next 06
  Consolidation.
- Respond with `PHASE: / STATUS: / CHECKPOINT:` structure per
  `docs/BUILD_PROMPT.md`.

## Relevant files

- `docs/BUILD_PROMPT.md`
- `docs/PHASES.md`
- `docs/PROCESSING_STATES.md`
- `docs/ARCHITECTURE.md`
- `docs/PROJECT_CHARTER.md`
- `docs/status/current-phase.json`
- `docs/reports/phase-04-completion.md`
- `docs/decisions/0005-phase-04-extraction.md`
- `lib/db/src/schema/research.ts`
- `lib/db/sql/migrations/0006-phase04-extraction.sql`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/domain/audit.ts`
- `artifacts/api-server/src/research/extraction/pipeline.ts`
- `artifacts/api-server/src/research/routes/extraction.ts`
- `artifacts/api-server/src/research/routes/reviewUi.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/adapters.ts`
- `artifacts/api-server/src/research/testing/testDb.ts`
- `artifacts/api-server/src/research/phase04.test.ts`
- `fixtures/synthetic/single-judgment.txt`
- `fixtures/synthetic/thirty-case.txt`
- `fixtures/synthetic/repeated-headers.txt`
- `fixtures/synthetic/blank-pages.txt`
- `fixtures/synthetic/empty-container.txt`
