---
title: Judgment Research Platform bootstrap (Phase 00)
---
# Judgment Research Platform Bootstrap (Phase 00)

## What & Why
Bootstrap a private legal judgment research and knowledge-management platform inside this monorepo. It will eventually serve the 8 legal portals (MyLitAI, MyLitAI IRAC, MySyalitAI, MyCorpLegalAI, MyConveyLitAI, MyCrimAI, MyCCBLitAI, MyAccidentAI). The platform ingests folders/ZIP archives of documents where a source file is a CONTAINER, not automatically a case — a file may hold zero, one, many, duplicate, partial, or split judgments. Phase 00 delivers only the stable foundation: persistent governance documents, module architecture with replaceable adapters, database schema stubs, a database-backed job queue skeleton, and smoke tests. No document extraction, OCR, case segmentation, or AI analysis in this phase.

## Done looks like
- The API server starts successfully with the new research module mounted (health endpoint responds).
- All required persistent documents exist:
  - `replit.md` extended with a "Judgment Research Platform" section carrying the persistent agent rules (source-container model, provenance, uncertainty routed to human review, judicial-text integrity, publisher-content isolation, rights gating with all files starting UNREVIEWED, AI as separate evidence-backed research aid, engineering behaviour rules, phase discipline). The existing AI Web Books content is preserved, not replaced.
  - `docs/PROJECT_CHARTER.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/SECURITY_MODEL.md`, `docs/RIGHTS_MODEL.md`, `docs/PROCESSING_STATES.md`, `docs/PHASES.md`
  - `docs/status/current-phase.json` recording Phase 00 as complete
  - `docs/reports/` (Phase 00 completion report goes here) and `docs/decisions/` (ADR directory with an initial decision record)
  - `fixtures/synthetic/` with small synthetic multi-judgment container fixtures; `fixtures/golden/` scaffolded (real restricted case files are excluded from source control — enforced via .gitignore)
- Test, lint, type-check, and formatting commands exist and pass (`typecheck` and `prettier` exist at root already; add lint and research tests).
- An automated smoke test passes (server boots, research health endpoint, job queue enqueue/claim/complete round-trip, adapter registry resolves defaults).
- Architecture separates web, data, processing, storage, and AI modules with replaceable adapters: storage adapter (object storage default), OCR adapter (stub, disabled), search adapter (Postgres default), AI-provider adapter (disabled by default).
- Rights gating baked into the schema: every source file row starts with rights status `UNREVIEWED`.
- A checkpoint is produced and a Phase 00 completion report is written to `docs/reports/`, after which work stops (phase discipline).

## Out of scope
- Document extraction, OCR, case segmentation, deduplication, and AI analysis (later phases)
- Any UI inside the 8 portals (later phases; Phase 00 is backend + docs foundation)
- Real judgment data ingestion; only local synthetic fixtures
- External queue/search infrastructure (database-backed queue and Postgres search only for now)

## Steps
1. **Persistent documents** — Write the charter, architecture, data model, security model, rights model, processing states, and phases documents; create the status, reports, decisions, and fixtures directories; extend `replit.md` with the platform's persistent rules section.
2. **Research module scaffold** — Add a `research` module to the shared API server following the existing per-portal module pattern, with clear submodule boundaries: web (routes), data (repositories), processing (job handlers), storage, and AI. Mount under `/api/research` with a health endpoint.
3. **Database schema (non-destructive)** — Add research-prefixed tables in the shared db lib: source containers (with rights status defaulting to UNREVIEWED, checksum, provenance fields), processing jobs (queue with states, attempts, idempotency key, resumability), transformations/audit log, and review queue stubs. Push via the existing dev push flow; no destructive migrations.
4. **Adapter layer** — Define TypeScript interfaces and a registry for storage, OCR, search, and AI-provider adapters; wire default implementations (object storage, stub OCR, Postgres search, disabled AI) selected via configuration, with AI off by default.
5. **Job queue skeleton** — Database-backed queue with enqueue, atomic claim, complete/fail, retry with attempt limits, and idempotent handlers; a no-op "container registered" job proves the loop works. Errors recorded to the jobs table and surfaced in logs (restricted data excluded from log lines).
6. **Fixtures and tests** — Add synthetic fixture files modelling the container principle (empty file, single judgment, multi-judgment, split-across-files) and integration tests: smoke boot test, health endpoint, queue round-trip, adapter registry, rights-status default. Add a root lint command if missing. All existing tests must remain passing.
7. **Phase close-out** — Write `docs/status/current-phase.json` (phase 00, complete) and the Phase 00 completion report in `docs/reports/`, then stop (do not begin extraction/OCR work).

Note: judicial-text integrity and publisher-content isolation are documented as schema/architecture constraints in this phase; the enforcing pipelines arrive in later phases.

## Relevant files
- `replit.md`
- `artifacts/api-server/src/app.ts`
- `lib/db`
- `artifacts/api-server/package.json`
- `package.json`
- `pnpm-workspace.yaml`