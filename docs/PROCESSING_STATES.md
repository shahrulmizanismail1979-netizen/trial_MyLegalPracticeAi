# Processing States — Judgment Research Platform

As of Phase 01, all state changes are made through guarded state machines in
`artifacts/api-server/src/research/domain/` — never by writing state columns
directly. Invalid transitions throw a structured `StateTransitionError`, and
every accepted transition writes a `research_audit_events` row **in the same
transaction** as the change.

The authoritative allowed-transition maps are exported as
`CONTAINER_TRANSITIONS` and `JOB_TRANSITIONS` and are pinned by golden files
(`fixtures/golden/container-transitions.json`,
`fixtures/golden/job-transitions.json`). Changing a map requires deliberately
regenerating the golden files (`UPDATE_GOLDEN=1`) and a decision record.

## Container Processing States (20)

`research_source_containers.processing_state`:

| State                           | Meaning                                                          |
| ------------------------------- | ---------------------------------------------------------------- |
| `UPLOADED`                      | Row created; file identity recorded. Default for new containers. |
| `QUARANTINED`                   | Rights or integrity problem; frozen pending human decision.      |
| `RIGHTS_REVIEW_REQUIRED`        | Awaiting a rights decision (all containers pass through this).   |
| `RIGHTS_APPROVED`               | Rights review permits processing.                                |
| `INVENTORY_PENDING`             | Awaiting container inventory (page/attachment census).           |
| `INVENTORIED`                   | Inventory complete.                                              |
| `EXTRACTION_PENDING`            | Awaiting text extraction.                                        |
| `TEXT_EXTRACTED`                | Text extraction complete.                                        |
| `OCR_REVIEW_REQUIRED`           | Extraction uncertain (e.g. scan quality); human review needed.   |
| `SEGMENTATION_PENDING`          | Awaiting case-candidate segmentation.                            |
| `SEGMENTATION_PROPOSED`         | Segmentation proposed (zero/one/many candidates).                |
| `SEGMENTATION_REVIEW_REQUIRED`  | Segmentation uncertain; human review needed.                     |
| `EDITORIAL_REVIEW_PENDING`      | Awaiting publisher-content screening.                            |
| `EDITORIAL_REVIEW_REQUIRED`     | Suspected editorial material; human review needed.               |
| `JUDGMENT_VERIFICATION_PENDING` | Awaiting human verification of judicial text.                    |
| `VERIFIED`                      | Judicial text verified by a human.                               |
| `SEARCHABLE`                    | Published to search (later phases).                              |
| `PROCESSING_BLOCKED`            | Operational halt; resumes at an explicit safe re-entry point.    |
| `DELETION_PENDING`              | Deletion requested; awaiting execution.                          |
| `DELETED`                       | **Terminal.** Container removed (audit trail retained).          |

Structure of the machine:

- The pipeline path is `UPLOADED → RIGHTS_REVIEW_REQUIRED → RIGHTS_APPROVED →
INVENTORY_PENDING → INVENTORIED → EXTRACTION_PENDING → TEXT_EXTRACTED →
SEGMENTATION_PENDING → SEGMENTATION_PROPOSED → EDITORIAL_REVIEW_PENDING →
JUDGMENT_VERIFICATION_PENDING → VERIFIED → SEARCHABLE`, with review detours
  (`OCR_REVIEW_REQUIRED`, `SEGMENTATION_REVIEW_REQUIRED`,
  `EDITORIAL_REVIEW_REQUIRED`) that re-enter the pipeline.
- `QUARANTINED`, `PROCESSING_BLOCKED`, and `DELETION_PENDING` are safety
  states reachable from **any** live state (everything except `DELETED`, and
  `DELETION_PENDING` may only proceed to `DELETED` or be re-quarantined/
  blocked).
- `PROCESSING_BLOCKED` resumes only at explicit re-entry points
  (`RIGHTS_REVIEW_REQUIRED`, `INVENTORY_PENDING`, `EXTRACTION_PENDING`,
  `SEGMENTATION_PENDING`, `EDITORIAL_REVIEW_PENDING`,
  `JUDGMENT_VERIFICATION_PENDING`).
- `DELETED` is terminal — no transitions out.

Rules:

- Uncertainty always transitions to a `*_REVIEW_REQUIRED` state, never to a
  guessed downstream state.
- Failures are recorded and surfaced; silent failure is prohibited.
- `routeToReview()` accepts only review states and creates the
  `research_review_items` row in the same transaction as the state change.

## Job States (8)

`research_jobs.state`:

| State               | Meaning                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `QUEUED`            | Awaiting a worker.                                                 |
| `RUNNING`           | Claimed by a worker (`claimed_at`/`started_at` set).               |
| `SUCCEEDED`         | **Terminal.** Processor completed; `output_checksum` recorded.     |
| `FAILED_RETRYABLE`  | Attempt failed retryably; auto-requeued while `attempts < max`.    |
| `FAILED_PERMANENT`  | **Terminal.** Non-retryable failure or retries exhausted.          |
| `CANCELLED`         | **Terminal.** Deliberately cancelled.                              |
| `REVIEW_REQUIRED`   | Processor raised uncertainty; resumable after a human decision.    |
| `BLOCKED_BY_RIGHTS` | Rights status forbids processing; resumable after rights decision. |

Failure semantics:

- Failures carry a structured reason (`failure_reason` jsonb:
  `{ code, message, retryable, detail? }`) — never a bare string.
- Retryable failures pass through `FAILED_RETRYABLE` and are automatically
  requeued while attempts remain; otherwise they become `FAILED_PERMANENT`.
- Non-retryable failures go directly to `FAILED_PERMANENT`.
- `REVIEW_REQUIRED` and `BLOCKED_BY_RIGHTS` are resumable: a human decision
  requeues the job (`→ QUEUED`).

Jobs are idempotent (unique `idempotency_key`) and resumable; handlers must
tolerate re-execution. Processor outputs are deduplicated by the unique
`(produced_by_key, kind)` constraint on `research_stored_artifacts`, so
re-execution with the same idempotency key never duplicates outputs.
