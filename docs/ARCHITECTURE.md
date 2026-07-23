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

The research module is split into five submodules with strict boundaries:

| Submodule  | Path                   | Responsibility                                      |
| ---------- | ---------------------- | --------------------------------------------------- |
| Web        | `research/routes/`     | HTTP routes, request validation, auth gating        |
| Data       | `research/data/`       | Repositories over `research_*` tables               |
| Processing | `research/processing/` | Job queue + job handlers                            |
| Storage    | `research/storage/`    | Storage adapter interface + implementations         |
| AI         | `research/ai/`         | AI-provider adapter interface (disabled by default) |

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

## Job Queue

The initial queue is database-backed (`research_jobs` table):

- `enqueue` with an idempotency key (unique) — duplicate enqueues are no-ops;
- atomic claim via `UPDATE ... WHERE state='queued' ... FOR UPDATE SKIP LOCKED`
  semantics (single-statement claim);
- `complete` / `fail` transitions with attempt counting and retry limits;
- errors recorded on the job row and surfaced in logs (restricted data is
  never logged).

The queue interface is deliberately small so it can be replaced by an external
queue later without changing handlers.

## Isolation Constraints (enforced in later phases)

- Publisher/editorial spans are segregated at the data level
  (`research_transformations` records exclusions) and must never enter search
  indexes, embeddings, summaries, AI prompts, classifications, or citation
  analysis.
- Rights gating is applied at the data layer: repositories filter by rights
  status; processing refuses containers whose rights status forbids it.
