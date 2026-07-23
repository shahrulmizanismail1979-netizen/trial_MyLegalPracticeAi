# Phase 00 Completion Report — Bootstrap

- **Phase**: 00 (Bootstrap)
- **Date**: 2026-07-23
- **Status**: PASS

## Objective

Bootstrap the Judgment Research Platform inside the existing monorepo:
persistent governance documents, module architecture, `research_*` database
schema, replaceable adapter registry, database-backed job queue skeleton,
synthetic fixtures, and smoke tests. Explicitly excluded: extraction, OCR,
segmentation, and AI functionality (later phases).

## Implementation Summary

1. **Persistent documents** — `PROJECT_CHARTER.md`, `ARCHITECTURE.md`,
   `DATA_MODEL.md`, `SECURITY_MODEL.md`, `RIGHTS_MODEL.md`,
   `PROCESSING_STATES.md`, `PHASES.md`, `docs/status/current-phase.json`,
   `docs/decisions/0001-bootstrap-inside-monorepo.md`, this report. The root
   `replit.md` carries the persistent agent rules for the platform.
2. **Research module** — `artifacts/api-server/src/research/` with strict
   submodule separation: `routes/` (web), `data/` (repositories),
   `processing/` (job queue + handlers), `storage/` (storage adapter), AI
   boundary via the adapter registry. Mounted at `/api/research` behind
   staff authentication.
3. **Database schema** — `research_source_containers` (rights status
   defaults to `UNREVIEWED` at the database level; insert schema forbids
   supplying it), `research_jobs`, `research_transformations` (append-only
   audit), `research_review_items`. Created additively; no existing tables
   touched.
4. **Adapter registry** — replaceable storage (Replit private object
   storage), OCR (stub, disabled — routes to review), search (Postgres
   stub), AI provider (disabled by default; propositions rejected).
5. **Job queue** — database-backed: idempotent enqueue (unique idempotency
   key), atomic claim (`FOR UPDATE SKIP LOCKED`), complete/fail with retry
   limits and dead-lettering; errors recorded on the job row; no restricted
   content in payloads or logs. Operations are idempotent and resumable.
6. **Provenance atomicity** — container registration + its registration
   transformation, and review-item creation + state change, each run in a
   single database transaction (all-or-nothing), so no container can exist
   without its audit record.
7. **Fixtures** — `fixtures/synthetic/` models the source-container
   principle; `fixtures/golden/` scaffolded; `.gitignore` blocks real
   document formats under `fixtures/`.

## Files Created

- `docs/PROJECT_CHARTER.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`,
  `docs/SECURITY_MODEL.md`, `docs/RIGHTS_MODEL.md`,
  `docs/PROCESSING_STATES.md`, `docs/PHASES.md`
- `docs/decisions/0001-bootstrap-inside-monorepo.md`
- `docs/status/current-phase.json`, `docs/reports/phase-00-completion.md`
- `lib/db/src/schema/research.ts`
- `artifacts/api-server/src/research/adapters.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/data/containers.ts`
- `artifacts/api-server/src/research/processing/{queue.ts,handlers.ts,index.ts}`
- `artifacts/api-server/src/research/storage/objectStorageAdapter.ts`
- `artifacts/api-server/src/research/research.test.ts`
- `fixtures/synthetic/` (6 fixture files + README), `fixtures/golden/README.md`

## Files Changed

- `lib/db/src/schema/index.ts` — export research schema
- `artifacts/api-server/src/routes/index.ts` — mount `/research` staff-only
- `package.json` — added root `lint` and `format` scripts
- `.gitignore` — block document formats under `fixtures/`
- `replit.md` — persistent platform rules section

## Database Migrations

Four additive tables: `research_source_containers`, `research_jobs`,
`research_transformations`, `research_review_items`. Schema source of truth
is `lib/db/src/schema/research.ts`; tables were applied with additive
`CREATE TABLE` SQL (drizzle-kit push was avoided because it interactively
proposed destructive renames of unrelated existing tables). Application
starts successfully against the migrated database (verified: server boot +
health endpoints after table creation). No destructive changes; no existing
tables altered.

## Dependencies Added or Removed

None. The module uses existing workspace dependencies (Express, Drizzle,
Zod, the object-storage client, vitest).

## Test Commands

- `pnpm --filter @workspace/api-server run test` (full api-server suite,
  includes the 10 research tests)
- `pnpm run typecheck` (full monorepo)
- `pnpm run lint` / `pnpm run format`

## Test Results (2026-07-23)

- Unit/integration: **49/49 tests passed across 11 files** (includes 10 new
  research tests; all 39 pre-existing tests remain green).
- TypeScript: full monorepo typecheck clean.
- Formatting/lint: `pnpm run lint` clean ("All matched files use Prettier
  code style").

## Browser-Testing Results

Not applicable — Phase 00 adds no user interface. HTTP-level smoke checks
performed instead: `/api/healthz` → 200; `/api/research/health` → 401
without staff authentication (private by default).

## Synthetic Fixtures Used

`fixtures/synthetic/`: `empty-container.txt`, `single-judgment.txt`,
`duplicate-of-single.txt` (byte-identical duplicate), `multi-judgment.txt`
(multiple cases + editorial material), `split-judgment-part1.txt` /
`split-judgment-part2.txt` (one case across files). No real legal documents
were used anywhere.

## Acceptance Criteria Evidence

| Criterion                                                         | Evidence                                                                                                                   |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Persistent docs exist                                             | All files listed above committed under `docs/`                                                                             |
| `research_*` schema created additively                            | Tables verified in dev DB; no existing tables changed                                                                      |
| Rights status defaults `UNREVIEWED`, cannot be supplied at insert | DB-level default + insert schema omission; test "registers a container with rights status defaulting to UNREVIEWED" passes |
| Registration recorded as transformation (provenance)              | Transactional write; test asserts a `registration` transformation exists                                                   |
| Uncertainty routed to review, never guessed                       | `routeToReview()` test: container → `NEEDS_REVIEW` + open review item                                                      |
| Adapter registry with OCR/AI disabled                             | Tests: `ocr.isEnabled() === false`, `ai.isEnabled() === false`, `ai.propose()` rejects                                     |
| Idempotent, resumable job queue with retry/dead-letter            | Tests: duplicate enqueue returns null; claim/run/complete round trip; retry-then-dead with error recorded                  |
| Module staff-only, no public access                               | Route mounted behind `requireAuth, requireStaff`; live check returns 401 unauthenticated                                   |
| Application starts with new schema                                | Server boots; health endpoints respond                                                                                     |
| Existing features/tests preserved                                 | All 39 pre-existing tests still pass (49/49 total)                                                                         |

## Defects Discovered

An architect review found that container registration and review routing
originally performed two non-atomic database writes; under partial failure
a container could exist without its provenance record. Fixed by wrapping
both operations in database transactions; re-tested green.

## Limitations

- No ingestion, extraction, segmentation, search, or AI — deliberately out
  of scope (Phases 01–06).
- Jobs run only when explicitly invoked (`runNextJob`); no background
  worker loop yet (appropriate for a skeleton; needed by Phase 01+).
- Failure-injection tests (forcing mid-transaction failure) are not yet
  written; the invariants are enforced by transactions but not adversarially
  tested.
- Root `lint`/`format` scripts are scoped to the research module and docs,
  not the whole repository.

## Security Implications

- All `/api/research` routes require staff authentication (Clerk +
  allowlist); unauthenticated access returns 401 (verified live).
- AI adapter disabled by default and rejects propositions — no data can be
  sent to any AI service.
- Job payloads and logs carry identifiers only, never restricted content.
- No new secrets; storage uses the existing private object storage bucket.

## Privacy Implications

No personal data is processed in this phase. Fixtures are fully synthetic.
Restricted data is excluded from logs by design (identifiers only).

## Rights / Licensing Implications

Every source container starts `UNREVIEWED`; rights status cannot be
supplied at registration and can only change through the review process
(see `docs/RIGHTS_MODEL.md`). `.gitignore` prevents real documents from
entering source control under `fixtures/`.

## Rollback Instructions

1. Revert to the checkpoint/commit before "Task #26: Judgment Research
   Platform bootstrap (Phase 00)".
2. Drop the four additive tables if desired:
   `DROP TABLE research_review_items, research_transformations,
research_jobs, research_source_containers;` (no other tables are
   affected).
3. No dependency or configuration rollback is required.

## Recommended Next Phase

Phase 01 — Ingestion: upload/registration of folders and ZIP archives,
checksum duplicate detection, staging to private storage, rights-review
queue UI. Requires explicit activation; see `docs/PHASES.md`.
