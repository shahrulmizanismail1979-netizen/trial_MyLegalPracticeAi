# Phase 01 Completion Report — Core Architecture, State Machines & Test Harness

- **Phase**: 01 (Core Architecture, State Machines & Test Harness — redefined
  from "Ingestion" by ADR 0002)
- **Date**: 2026-07-23
- **Status**: PASS

## Objective

Build the load-bearing core of the Judgment Research Platform: the full
`research_*` entity set, a 20-state container state machine and 8-state job
state machine (guarded transitions, atomic audit events), an explicit
processor contract (versioning, idempotency, checksums, structured failure
reasons, provenance), and a real testing foundation (DB-isolated integration
environment, synthetic fixture factory, golden files, browser e2e).
Explicitly excluded: OCR, PDF parsing, extraction, segmentation, AI, and
search (later phases).

## Implementation Summary

1. **Phase redefinition** — ADR 0002
   (`docs/decisions/0002-phase-01-redefined-core-architecture.md`) redefines
   Phase 01 and shifts Ingestion to Phase 02; `docs/PHASES.md` updated.
2. **Entity schema expansion** — 7 additive tables: `research_users`,
   `research_source_pages`, `research_case_candidates`,
   `research_verified_cases`, `research_rights_records`,
   `research_audit_events`, `research_stored_artifacts`. Containers gained
   the 20-state `processing_state`; jobs gained `processor_version`,
   `failure_reason` (structured jsonb), `source_checksum`,
   `output_checksum`, `provenance`, `started_at`; review items gained `kind`
   and `assigned_to`. Existing rows migrated to the new state vocabularies
   with a recorded, reversible mapping
   (`lib/db/sql/migrations/0002-phase01-core-architecture.sql`);
   reproducible full DDL in `lib/db/sql/research-schema.sql`.
3. **Container state machine** —
   `research/domain/containerStateMachine.ts`: explicit allowed-transitions
   map for all 20 states (pipeline path + review detours +
   QUARANTINED/PROCESSING_BLOCKED/DELETION_PENDING reachable from any live
   state; DELETED terminal). Single guarded `transitionContainer()` locks
   the row, validates, applies, and writes the audit event in one
   transaction. Invalid transitions throw structured
   `StateTransitionError`.
4. **Job state machine + processor contract** —
   `research/domain/jobStateMachine.ts` (8 states; SUCCEEDED /
   FAILED_PERMANENT / CANCELLED terminal) and a reworked queue
   (`research/processing/queue.ts`): idempotent enqueue, `FOR UPDATE SKIP
LOCKED` claiming, structured failure reasons with retryable → auto-requeue
   / permanent routing, review-required and rights-blocked outcomes,
   cancel/requeue, and idempotent artifact recording (unique
   `(produced_by_key, kind)`). Processor registry
   (`research/processing/handlers.ts`) with `ProcessorFailure`,
   `ReviewRequiredSignal`, `RightsBlockedSignal`.
5. **Testing foundation** — per-run isolated Postgres schema
   (`research/testing/testDb.ts`), synthetic fixture factory
   (`research/testing/fixtureFactory.ts`), golden-result utilities
   (`research/testing/golden.ts`, `UPDATE_GOLDEN=1` to regenerate), and a
   Playwright browser e2e framework (`artifacts/api-server/e2e/`) using the
   environment-provided Chromium.
6. **State-machine/processor test suites** —
   `research/domain/stateMachines.test.ts`: exhaustive invalid-transition
   rejection for both machines (every from/to pair), golden-pinned
   transition maps, full happy-path walk with one audit event per step,
   retryable vs permanent failure paths, cancel/requeue, audit-event
   atomicity, processor-contract field recording, and no-duplication under
   same-key re-execution.

## Files Created

- `docs/decisions/0002-phase-01-redefined-core-architecture.md`
- `docs/reports/phase-01-completion.md`
- `lib/db/sql/research-schema.sql`,
  `lib/db/sql/migrations/0002-phase01-core-architecture.sql`
- `artifacts/api-server/src/research/domain/{types.ts,audit.ts,containerStateMachine.ts,jobStateMachine.ts,index.ts}`
- `artifacts/api-server/src/research/testing/{testDb.ts,fixtureFactory.ts,golden.ts}`
- `artifacts/api-server/src/research/domain/stateMachines.test.ts`
- `artifacts/api-server/playwright.config.ts`,
  `artifacts/api-server/e2e/research-smoke.spec.ts`
- `fixtures/golden/container-transitions.json`,
  `fixtures/golden/job-transitions.json`

## Files Changed

- `lib/db/src/schema/research.ts` — state constants, failure-reason schema,
  new tables, extended columns
- `lib/db/src/index.ts` — `createPool` / `createDb` factories (isolated test
  schemas)
- `artifacts/api-server/src/research/processing/{queue.ts,handlers.ts,index.ts}`
  — state-machine-backed queue + processor contract
- `artifacts/api-server/src/research/data/containers.ts` — UPLOADED default,
  audit on registration, state-machine-backed `routeToReview`
- `artifacts/api-server/src/research/routes/index.ts` — health phase "01"
- `artifacts/api-server/src/research/research.test.ts` — updated to the new
  vocabularies
- `artifacts/api-server/package.json` — `test:e2e` script
- `docs/{PHASES.md,PROCESSING_STATES.md,DATA_MODEL.md,ARCHITECTURE.md}`,
  `docs/status/current-phase.json`

## Database Migrations

Additive only, applied via psql (interactive drizzle push avoided per repo
policy): 7 new tables, new columns on `research_source_containers`,
`research_jobs`, `research_review_items`, and an in-place mapping of the
Phase 00 state vocabularies (`REGISTERED→UPLOADED`, `NEEDS_REVIEW→
RIGHTS_REVIEW_REQUIRED`, `queued→QUEUED`, `dead→FAILED_PERMANENT`, etc.),
recorded and reversible in the migration file. No destructive changes; no
non-research tables touched. Application boots against the migrated
database.

## Dependencies Added or Removed

- Added (dev, api-server): `@playwright/test` — browser e2e framework.
  Browser binary is the environment-provided Chromium
  (`REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE`); no download needed.

## Test Commands

- `pnpm --filter @workspace/api-server run test` — full unit/integration
  suite
- `pnpm --filter @workspace/api-server run test:e2e` — browser e2e smoke
- `pnpm run typecheck` — full monorepo
- `pnpm run lint` / `pnpm run format`

## Test Results (2026-07-23)

- Unit/integration: **69/69 tests passed across 12 files** (20 new
  state-machine/processor tests; all 49 Phase 00 tests remain green).
- Browser e2e: **2/2 passed** (health endpoint 200; research API 401
  unauthenticated).
- TypeScript: full monorepo typecheck clean.

## Browser-Testing Results

Playwright (Chromium, through the shared proxy exactly as users reach the
server): `/api/healthz` renders 200 with `{"status":"ok"}`;
`/api/research/healthz` renders 401 `{"error":"Unauthorized"}` for an
unauthenticated browser — the staff-only security model verified end to end.
Research endpoints are intentionally staff-only, so the smoke test asserts
the default-deny posture rather than bypassing authentication.

## Synthetic Fixtures Used

`fixtures/synthetic/` (unchanged, 6 files) plus factory-generated containers
(`research/testing/fixtureFactory.ts`). Golden files added under
`fixtures/golden/`: the pinned container and job transition maps. No real
legal documents were used anywhere.

## Acceptance Criteria Evidence

| Criterion                                                          | Evidence                                                                                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Phase redefinition recorded                                        | ADR 0002 + updated `docs/PHASES.md`                                                                                           |
| All 10 entities exist additively                                   | Tables verified in dev DB; migration file applied cleanly (0 destructive ops)                                                 |
| 20 container states, guarded transitions, structured errors        | Exhaustive from/to pair test; invalid DB transition rejected with `INVALID_TRANSITION`; golden-pinned map                     |
| 8 job states, retryable vs permanent distinguishable               | Tests: permanent fails once; retryable requeues then exhausts to FAILED_PERMANENT; structured `failure_reason` persisted      |
| Processor runs record version/timings/retries/checksums/provenance | Contract test asserts all fields on the job row after a run                                                                   |
| Same idempotency key never duplicates outputs                      | Duplicate enqueue is a no-op; artifact recording idempotent across re-execution (unique `(produced_by_key, kind)`)            |
| Every state change emits an audit event atomically                 | Audit rows written in the same transaction; per-step audit assertions on the full happy path; rejected transitions write none |
| DB-isolated integration tests                                      | `createIsolatedTestDb()` — per-run schema created/dropped; suite passes against it                                            |
| Browser e2e framework with passing smoke                           | Playwright wired (`test:e2e`); 2/2 smoke tests pass                                                                           |
| Fixture factory + golden utilities with golden files               | `fixtureFactory.ts`, `golden.ts`, 2 committed golden files                                                                    |
| Existing 49 tests remain green                                     | 69/69 total pass                                                                                                              |
| Docs updated + report + status                                     | This report; PHASES/PROCESSING_STATES/DATA_MODEL/ARCHITECTURE updated; `current-phase.json` set                               |

## Defects Discovered

- The Phase 00 test "complete() marks a job succeeded" completed a job
  straight from QUEUED — an illegal transition under the new machine
  (QUEUED → SUCCEEDED). The test was corrected to claim first; the machine
  now makes this class of shortcut impossible in production code.

## Limitations

- Jobs still run only when explicitly invoked (`runNextJob`); no background
  worker loop yet (needed by the ingestion phase).
- `research_source_pages`, `research_case_candidates`,
  `research_verified_cases`, and `research_rights_records` are structural
  anchors only — no processors populate them until their phases.
- The e2e smoke does not authenticate a staff session (Clerk sessions cannot
  be minted headlessly here); authenticated-UI e2e arrives with the first
  research UI in the ingestion phase.
- Concurrency is exercised via SKIP LOCKED semantics but not with a
  multi-process stress test.
- `claimNext()` performs QUEUED → RUNNING as a single-statement SKIP LOCKED
  update (the deliberate exception to the `transitionJob()` primitive, for
  contention-free claiming); it writes the same audit event in the same
  transaction. Architect review suggested unifying these and adding DB-level
  CHECK constraints on state columns — deferred to the next phase.

## Security Implications

- No change to the access model: all `/api/research` routes remain
  staff-only; the browser e2e verifies the 401 default-deny posture.
- Audit trail is now automatic and atomic for every lifecycle change —
  tampering with states without a trace is structurally prevented.
- Job payloads, audit details, and logs continue to carry identifiers only.

## Privacy Implications

No personal data processed. Fixtures fully synthetic. The new
`research_users` table stores staff reviewer identities (email/display name)
only.

## Rights / Licensing Implications

Rights gating strengthened: rights decisions now have an append-only history
(`research_rights_records`), rights-blocked processing is a first-class,
resumable job outcome (`BLOCKED_BY_RIGHTS`), and containers still begin
`UNREVIEWED` with no way to supply a different value at insert.

## Rollback Instructions

1. Revert to the checkpoint before "Task #30: Phase 01 core architecture".
2. Reverse the state mapping and drop the additive columns/tables using the
   inverse statements documented in
   `lib/db/sql/migrations/0002-phase01-core-architecture.sql`.
3. Remove the `@playwright/test` devDependency if desired.

## Recommended Next Phase

Phase 02 — Ingestion: upload/registration of folders and ZIP archives,
checksum duplicate detection, staging to private storage, rights-review
queue UI. Requires explicit activation; see `docs/PHASES.md`.
