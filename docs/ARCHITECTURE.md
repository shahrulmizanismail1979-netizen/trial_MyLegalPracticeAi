# Architecture — Judgment Research Platform

## Placement in the Monorepo

The platform lives inside the existing pnpm workspace:

- **Web/API module**: `artifacts/api-server/src/research/` — mounted at
  `/api/research` on the shared Express API server.
- **Data**: `lib/db/src/schema/research.ts` — Drizzle schema, all tables
  prefixed `research_`, in the shared PostgreSQL database.
- **Docs**: `/docs` (this directory).
- **Fixtures**: `/fixtures/synthetic` (committed) and `/fixtures/golden`
  (curated expected outputs; real restricted case files are never committed).

## Module Separation

The research module is split into submodules with strict boundaries:

| Submodule  | Path                   | Responsibility                                              |
| ---------- | ---------------------- | ----------------------------------------------------------- |
| Web        | `research/routes/`     | HTTP routes, request validation, auth gating                |
| Data       | `research/data/`       | Repositories over `research_*` tables                       |
| Domain     | `research/domain/`     | Container/job state machines, audit events, domain errors   |
| Processing | `research/processing/` | Job queue + processor registry/contract                     |
| Storage    | `research/storage/`    | Storage adapter interface + implementations                 |
| AI         | `research/ai/`         | AI-provider adapter interface (disabled by default)         |
| Testing    | `research/testing/`    | Isolated test DB, synthetic fixture factory, golden helpers |

Rules:

- Routes never touch the database directly; they go through `data/`.
- Processing handlers are resumable and idempotent; state lives in
  `research_jobs`, never in process memory.
- Nothing outside `ai/` imports an AI SDK; nothing outside `storage/` imports
  a storage SDK.

## Replaceable Adapters

All external capabilities sit behind TypeScript interfaces resolved through a
single registry (`research/adapters.ts`), selected by configuration:

| Adapter     | Interface           | Default (Phase 00)                                 |
| ----------- | ------------------- | -------------------------------------------------- |
| Storage     | `StorageAdapter`    | Replit object storage (private bucket)             |
| OCR         | `OcrAdapter`        | Stub — not configured; calling it routes to review |
| Search      | `SearchAdapter`     | PostgreSQL full-text (stub in Phase 00)            |
| AI provider | `AiProviderAdapter` | Disabled — `isEnabled()` returns false             |

AI is **disabled by default**. Enabling it is an explicit configuration
decision recorded in `docs/decisions/`.

## State Machines & Audit (Phase 01)

All container and job lifecycle changes go through single guarded transition
functions in `research/domain/`:

- explicit allowed-transition maps (`CONTAINER_TRANSITIONS`,
  `JOB_TRANSITIONS`), pinned by golden files under `fixtures/golden/`;
- invalid transitions throw a structured `StateTransitionError`;
- every accepted transition locks the row (`FOR UPDATE`) and writes a
  `research_audit_events` row in the **same transaction**.

See `docs/PROCESSING_STATES.md` for the full state vocabularies.

## Job Queue & Processor Contract

The queue is database-backed (`research_jobs` table):

- `enqueue` with an idempotency key (unique) — duplicate enqueues are no-ops;
- atomic claim via `FOR UPDATE SKIP LOCKED` (QUEUED → RUNNING);
- outcomes route through the job state machine: success, retryable failure
  (auto-requeue while attempts remain), permanent failure, review-required,
  rights-blocked, cancel;
- every run records processor version, timings (created/started/finished),
  retry count, structured failure reason, source/output checksums, and
  provenance links;
- processor outputs are recorded in `research_stored_artifacts` with a unique
  `(produced_by_key, kind)` constraint, so same-key re-execution never
  duplicates outputs;
- errors recorded on the job row and surfaced in logs (restricted data is
  never logged).

Processors are registered via `registerProcessor(kind, fn)` and signal
outcomes with `ProcessorFailure`, `ReviewRequiredSignal`, or
`RightsBlockedSignal`. The queue interface is deliberately small so it can be
replaced by an external queue later without changing processors.

## Testing Foundation (Phase 01)

- Integration tests run against a dedicated per-run Postgres schema
  (`research/testing/testDb.ts`) — never the shared dev data.
- Synthetic fixtures only (`fixtures/synthetic/`,
  `research/testing/fixtureFactory.ts`).
- Golden-result comparisons (`research/testing/golden.ts`); golden files are
  committed under `fixtures/golden/` and regenerated only deliberately with
  `UPDATE_GOLDEN=1`.
- Browser end-to-end tests (Playwright, `artifacts/api-server/e2e/`) run
  through the shared proxy like real users:
  `pnpm --filter @workspace/api-server run test:e2e`.

## Isolation Constraints (enforced in later phases)

- Publisher/editorial spans are segregated at the data level
  (`research_transformations` records exclusions) and must never enter search
  indexes, embeddings, summaries, AI prompts, classifications, or citation
  analysis.
- Rights gating is applied at the data layer: repositories filter by rights
  status; processing refuses containers whose rights status forbids it.
