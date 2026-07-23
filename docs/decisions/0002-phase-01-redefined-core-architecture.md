# ADR 0002 — Phase 01 Redefined: Core Architecture, State Machines & Test Harness

- **Date**: 2026-07-23
- **Status**: Accepted

## Context

`docs/PHASES.md` originally defined Phase 01 as **Ingestion** (upload of
folders/ZIP archives, duplicate detection, staging, rights-review queue UI).
Before building ingestion, the platform needed load-bearing foundations that
Phase 00's skeleton deliberately deferred:

- the full 20-state container lifecycle and 8-state job lifecycle as guarded
  state machines rather than free-form status columns;
- the complete entity set (users, pages, case candidates, verified cases,
  rights records, audit events, stored artifacts) so provenance can reference
  stable identities from day one;
- an explicit processor contract (versioning, idempotency, checksums,
  structured failure reasons, provenance) that all future phase processors
  must satisfy;
- a real testing foundation: DB-isolated integration environment, synthetic
  fixture factory, golden-file comparisons, and a browser e2e framework.

Building ingestion first would have forced these to be retrofitted under
live-data pressure, violating the platform's provenance and audit guarantees.

## Decision

Phase 01 is redefined as **Core architecture, state machines & test
harness**. Ingestion moves to Phase 02, and all subsequent phases shift by
one. The phase table in `docs/PHASES.md` is updated accordingly (this record
authorises that change, per the rule that phase-table changes require a
decision record).

Scope of the redefined Phase 01 (implemented):

1. Additive `research_*` entity expansion + state/processor-metadata columns.
2. Container state machine: 20 states, explicit allowed-transition map,
   single guarded transition function, audit event per transition (same
   transaction).
3. Job state machine: 8 states with the same guarantees; queue reworked to
   route retryable/permanent failures, review-required, and rights-blocked
   outcomes correctly while keeping idempotent enqueue and SKIP LOCKED
   claiming.
4. Processor contract: version, idempotency key, timings, retry count,
   structured failure reason, source/output checksums, provenance links;
   same-key re-execution never duplicates outputs.
5. Test harness: per-run isolated Postgres schema, synthetic fixture factory,
   golden files under `fixtures/golden/`, Playwright browser e2e smoke.

Explicitly out of scope (unchanged): OCR, PDF parsing, real extraction,
segmentation logic, AI, search.

## Consequences

- Later phases (ingestion onwards) inherit ready-made lifecycles, an audit
  trail, and a processor contract; they add processors and UI, not
  architecture.
- The existing Phase 00 state vocabularies were migrated to the new ones with
  a recorded mapping (`lib/db/sql/migrations/0002-phase01-core-architecture.sql`).
- The allowed-transition maps are pinned by golden files; loosening or
  tightening a lifecycle is a deliberate, reviewable act.
- The phase numbering shift means external references to "Phase 01 =
  Ingestion" are obsolete; `docs/PHASES.md` is the single source of truth.
