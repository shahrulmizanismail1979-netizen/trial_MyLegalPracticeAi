# Data Model — Judgment Research Platform (Phase 00)

All tables are prefixed `research_` and live in the shared PostgreSQL
database (Drizzle schema: `lib/db/src/schema/research.ts`).

## Core Principle

A source file is a **container**, not a case. Cases (later phases) are
assembled from one or more _spans_ of one or more containers. Phase 00 defines
the container, job, transformation, and review primitives only.

## Tables (Phase 00)

### research_source_containers

One row per ingested file. A container is never assumed to be a case.

| Column                     | Notes                                               |
| -------------------------- | --------------------------------------------------- |
| `id`                       | serial PK                                           |
| `original_name`            | file name as received                               |
| `source_batch`             | folder/ZIP identifier the file arrived in           |
| `storage_key`              | key in the storage adapter (nullable until staged)  |
| `content_sha256`           | checksum for duplicate detection and integrity      |
| `size_bytes`, `mime_type`  | container facts                                     |
| `rights_status`            | **defaults to `UNREVIEWED`** (see RIGHTS_MODEL.md)  |
| `processing_state`         | defaults to `REGISTERED` (see PROCESSING_STATES.md) |
| `provenance`               | jsonb — who/when/how the file entered the system    |
| `created_at`, `updated_at` | timestamps                                          |

### research_jobs

Database-backed job queue. Jobs are resumable and idempotent.

| Column                                    | Notes                                                  |
| ----------------------------------------- | ------------------------------------------------------ |
| `id`                                      | serial PK                                              |
| `kind`                                    | job type, e.g. `container.registered`                  |
| `idempotency_key`                         | unique — duplicate enqueues are no-ops                 |
| `payload`                                 | jsonb (never contains restricted judgment text)        |
| `state`                                   | `queued` → `running` → `succeeded` / `failed` / `dead` |
| `attempts`, `max_attempts`                | retry accounting                                       |
| `last_error`                              | recorded error message (sanitised)                     |
| `claimed_at`, `finished_at`, `created_at` | timestamps                                             |

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

| Column                      | Notes                                                       |
| --------------------------- | ----------------------------------------------------------- |
| `id`                        | serial PK                                                   |
| `container_id`              | FK → research_source_containers (nullable for global items) |
| `reason`                    | why review is required                                      |
| `status`                    | `open` → `resolved` / `dismissed`                           |
| `resolution`                | jsonb, nullable                                             |
| `created_at`, `resolved_at` | timestamps                                                  |

## Future (not in Phase 00)

Spans, case candidates, case versions, paragraphs, citations, embeddings, and
editorial-material segregation tables arrive with the extraction phases. Every
one of them must carry provenance back to `research_source_containers`.
