# Processing States — Judgment Research Platform

## Container Processing States

`research_source_containers.processing_state`:

| State          | Meaning                                                               |
| -------------- | --------------------------------------------------------------------- |
| `REGISTERED`   | Row created; file identity (name, batch, checksum) recorded. Default. |
| `STAGED`       | File bytes stored via the storage adapter (`storage_key` set).        |
| `QUEUED`       | A processing job for this container is enqueued.                      |
| `PROCESSING`   | A job is actively working on the container.                           |
| `NEEDS_REVIEW` | Processing produced uncertainty; routed to `research_review_items`.   |
| `PROCESSED`    | Current phase's processing complete.                                  |
| `FAILED`       | Processing failed after retries; error recorded; visible to staff.    |
| `QUARANTINED`  | Rights or integrity problem; frozen pending human decision.           |

Rules:

- Uncertainty always transitions to `NEEDS_REVIEW`, never to a guessed
  `PROCESSED`.
- Failures are recorded and surfaced (job `last_error`, logs without
  restricted content); silent failure is prohibited.
- State changes driven by anything other than plain pipeline progress are
  recorded in `research_transformations`.

## Job States

`research_jobs.state`:

| State       | Meaning                                                          |
| ----------- | ---------------------------------------------------------------- |
| `queued`    | Awaiting a worker.                                               |
| `running`   | Claimed by a worker (`claimed_at` set).                          |
| `succeeded` | Handler completed.                                               |
| `failed`    | Attempt failed; requeued while `attempts < max_attempts`.        |
| `dead`      | Retries exhausted; requires human attention; surfaced in review. |

Jobs are idempotent (unique `idempotency_key`) and resumable: a crashed worker
leaves the job claimable again; handlers must tolerate re-execution.
