# Data Model — Judgment Research Platform (Phase 01)

All tables are prefixed `research_` and live in the shared PostgreSQL
database (Drizzle schema: `lib/db/src/schema/research.ts`; reproducible DDL:
`lib/db/sql/research-schema.sql`; applied migrations under
`lib/db/sql/migrations/`).

## Core Principle

A source file is a **container**, not a case. Cases are assembled from one or
more _spans_ of one or more containers. Phase 01 defines the full entity set;
segmentation/extraction content arrives in later phases, but every entity that
provenance must reference exists now with a stable identity.

## Tables

### research_source_containers

One row per ingested file. A container is never assumed to be a case.

| Column                     | Notes                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `id`                       | serial PK                                                                                                                           |
| `original_name`            | file name as received                                                                                                               |
| `source_batch`             | folder/ZIP identifier the file arrived in                                                                                           |
| `storage_key`              | key in the storage adapter (nullable until staged)                                                                                  |
| `content_sha256`           | checksum for duplicate detection and integrity                                                                                      |
| `size_bytes`, `mime_type`  | container facts                                                                                                                     |
| `rights_status`            | **defaults to `UNREVIEWED`** (see RIGHTS_MODEL.md)                                                                                  |
| `processing_state`         | one of the 20 container states; **defaults to `UPLOADED`**; changed only via the container state machine (see PROCESSING_STATES.md) |
| `provenance`               | jsonb — who/when/how the file entered the system                                                                                    |
| `created_at`, `updated_at` | timestamps                                                                                                                          |

### research_source_pages

Physical pages of a container. Populated by extraction phases; exists now so
provenance can reference page identity from day one. Unique per
`(container_id, page_number)`.

### research_jobs

Database-backed job queue. Jobs are resumable and idempotent, and every job
row is a full processor-contract record.

| Column                                                  | Notes                                                    |
| ------------------------------------------------------- | -------------------------------------------------------- |
| `id`                                                    | serial PK                                                |
| `kind`                                                  | job type, e.g. `container.registered`                    |
| `idempotency_key`                                       | unique — duplicate enqueues are no-ops                   |
| `payload`                                               | jsonb (never contains restricted judgment text)          |
| `state`                                                 | one of the 8 job states (see PROCESSING_STATES.md)       |
| `attempts`, `max_attempts`                              | retry accounting                                         |
| `processor_version`                                     | version of the processor that handles this job           |
| `failure_reason`                                        | structured jsonb `{ code, message, retryable, detail? }` |
| `last_error`                                            | sanitised error message                                  |
| `source_checksum`, `output_checksum`                    | integrity of inputs consumed and outputs produced        |
| `provenance`                                            | jsonb — links to the entities this job derives from      |
| `claimed_at`, `started_at`, `finished_at`, `created_at` | timing fields for every run                              |

### research_case_candidates

Case candidates proposed inside containers (zero/one/many per file); `spans`
carry the source ranges. Segmentation logic is a later phase.

### research_verified_cases

Human-verified cases (`verified_by` is always a human identity), linked to a
candidate, with provenance.

### research_rights_records

Append-only history of rights decisions per container (`status`,
`decided_by`, `reason`, `detail`). The container's `rights_status` column
mirrors the latest record.

### research_users

Staff users of the research platform (reviewers/admins). Distinct from portal
subscribers; the module is additionally staff-gated at the web layer.

### research_transformations

Append-only audit log. Every correction, normalisation, exclusion, merge, or
split of judicial text must be recorded here as a reviewable transformation.

| Column         | Notes                                                            |
| -------------- | ---------------------------------------------------------------- |
| `id`           | serial PK                                                        |
| `container_id` | FK → research_source_containers                                  |
| `kind`         | e.g. `registration`, `exclusion`, `merge`, `split`, `correction` |
| `detail`       | jsonb — before/after references, never silent                    |
| `actor`        | `system` or a reviewer identity                                  |
| `reviewed`     | boolean, defaults false                                          |
| `created_at`   | timestamp                                                        |

### research_review_items

Human review queue. Uncertain results land here instead of being guessed.
Phase 01 adds `kind` (review category) and `assigned_to` (FK →
research_users).

### research_audit_events

Automatic, atomic audit trail: **every** container/job state change writes a
row here in the same transaction as the change itself (`entity_type`,
`entity_id`, `event`, `from_state`, `to_state`, `actor`, `detail`). Indexed
by `(entity_type, entity_id)`.

### research_stored_artifacts

Outputs produced by processors (`kind`, `storage_key`, `content_sha256`,
`size_bytes`, provenance). The unique `(produced_by_key, kind)` constraint is
what makes re-execution with the same idempotency key a no-op — outputs are
never duplicated.

## Insert-schema guarantees

- `rights_status` cannot be supplied at insert; it always defaults to
  `UNREVIEWED`.
- `processing_state` cannot be supplied at insert; it always starts
  `UPLOADED` and changes only through the guarded state machine.

## Migration policy

Schema changes are applied with additive SQL (`lib/db/sql/migrations/`);
interactive `drizzle-kit push` is not used in this repo because it has
proposed destructive renames of unrelated tables. The Phase 00 → Phase 01
state-vocabulary migration and its mapping are recorded in
`lib/db/sql/migrations/0002-phase01-core-architecture.sql`.
