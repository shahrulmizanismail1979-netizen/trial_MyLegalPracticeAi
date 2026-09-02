# Phase 01: Core Architecture & State Machines

## What & Why
Build the architectural foundation of the Judgment Research Platform on top of the Phase 00 bootstrap: the full entity model, enforceable state machines for containers and jobs, a processor execution contract, and a complete testing foundation. No document intelligence (no OCR, PDF parsing, segmentation, AI, semantic search, or exports) is implemented — this phase makes later phases safe to build.

Note: this redefines Phase 01 relative to the current `docs/PHASES.md` table ("Ingestion"). Per the phase-discipline rule, the change requires a decision record (`docs/decisions/0002-...`) and an updated phase table — included in scope.

## Done looks like
- All ten core entities exist as `research_*` tables with Drizzle schemas and Zod validation: users (staff roles for review), source containers (extended), source pages, processing jobs (extended), case candidates, verified cases, rights records, human-review tasks, audit events, stored artifacts.
- Containers move through an enforceable state machine with exactly the 20 required states (UPLOADED → … → DELETED, incl. QUARANTINED, PROCESSING_BLOCKED, DELETION_PENDING); every transition goes through one guarded function; invalid transitions are rejected with a structured error and are proven rejected by tests.
- Jobs use the 8 required job states (QUEUED, RUNNING, SUCCEEDED, FAILED_RETRYABLE, FAILED_PERMANENT, CANCELLED, REVIEW_REQUIRED, BLOCKED_BY_RIGHTS) with their own guarded transition function; retryable and permanent failures are distinguishable.
- Every processor run records: processor version, idempotency key, created/started/finished times, retry count, structured failure reason, source checksum, output checksum, and provenance links; re-running with the same idempotency key never duplicates outputs.
- Every state change (container and job) emits an audit event row automatically and atomically (same transaction).
- Testing foundation in place: unit tests (vitest), integration tests against an isolated database schema (not the shared dev data), a browser end-to-end framework wired up with at least one passing smoke test, a synthetic fixture factory, and golden-result comparison utilities with golden files under `fixtures/golden/`.
- All previously passing tests (49) remain green; docs updated (`ARCHITECTURE.md`, `DATA_MODEL.md`, `PROCESSING_STATES.md`, `PHASES.md` + decision record); completion report `docs/reports/phase-01-completion.md` written and `docs/status/current-phase.json` updated.

## Out of scope
- OCR, PDF parsing, text extraction, segmentation, AI summaries, semantic search, production exports (Phases 02+).
- Any upload UI or portal-facing UI (state machines are exercised via code/API and tests only; a UI is not required by this phase).
- Real restricted legal documents — synthetic fixtures only.
- Removing or weakening any Phase 00 control (rights gating, provenance, review routing, disabled AI).

## Steps
1. **Decision record + phase table update** — Write an ADR recording the redefinition of Phase 01 as "Core architecture, state machines, test harness" (Ingestion shifts later) and update the phase table accordingly.
2. **Entity schema expansion** — Add the missing entities as additive `research_*` tables (source pages, case candidates, verified cases, rights records, review tasks, audit events, stored artifacts, research users/roles) and extend containers and jobs with the required state and processor-metadata columns; migrate existing rows from the Phase 00 states to the new state vocabulary with a recorded, reversible mapping. Apply tables via additive SQL (do not use interactive drizzle push — it has proposed destructive renames in this repo).
3. **Container state machine** — Implement a single guarded transition function with an explicit allowed-transitions map for the 20 states; invalid transitions throw a structured error; every accepted transition writes an audit event in the same transaction.
4. **Job state machine + processor contract** — Rework the job queue to the 8 job states while keeping idempotent enqueue and SKIP LOCKED claiming; add processor version, checksums, structured failure reasons, timing fields, and provenance links; rights-blocked and review-required outcomes route to the correct states; same-idempotency-key re-execution is a no-op.
5. **Testing foundation** — Add a database-isolated integration test environment (dedicated schema created/dropped per run), a synthetic fixture factory, golden-result comparison utilities with initial golden files, and a browser end-to-end framework with a passing smoke test; keep the existing 49 tests green.
6. **State-machine and processor test suites** — Exhaustive tests: every invalid container/job transition rejected, retryable vs permanent failure paths, idempotency no-duplication, audit events emitted for all state changes.
7. **Docs + close-out** — Update architecture/data-model/processing-state docs, write the phase-01 completion report in the agreed template, and set `docs/status/current-phase.json` to complete.

## Relevant files
- `lib/db/src/schema/research.ts`
- `lib/db/src/schema/index.ts`
- `artifacts/api-server/src/research/processing/queue.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/data/containers.ts`
- `artifacts/api-server/src/research/adapters.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/research.test.ts`
- `docs/PROCESSING_STATES.md`
- `docs/PHASES.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/status/current-phase.json`
- `docs/reports/phase-00-completion.md`
- `fixtures/synthetic/README.md`
- `fixtures/golden/README.md`
