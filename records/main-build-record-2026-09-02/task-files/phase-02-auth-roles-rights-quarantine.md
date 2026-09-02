# Phase 02: Authentication, Roles, Rights & Quarantine

## What & Why

Implement authentication, an 8-role model, a 13-status document-rights vocabulary, a combined role-plus-rights access decision layer, and quarantine enforcement for the Judgment Research Platform — before any document processing exists. This replaces the previously planned "Ingestion" scope for Phase 02, so the change requires a new Architecture Decision Record (ADR 0003) and updates to `docs/PHASES.md` and `docs/RIGHTS_MODEL.md` (which currently defines only 4 rights statuses: UNREVIEWED / CLEARED_INTERNAL / RESTRICTED / EXCLUDED — those must be migrated into the new 13-status vocabulary with a recorded, reversible mapping).

## Done looks like

- Research platform users authenticate and hold exactly one of 8 roles: owner, administrator, rights reviewer, legal reviewer, researcher, lecturer, student, read-only guest.
- Every source container carries one of the 13 rights statuses (UNREVIEWED, COMMERCIAL_SOURCE_REVIEW_REQUIRED, PRIVATE_PROCESSING_APPROVED, OFFICIAL_COURT_SOURCE, PUBLIC_OR_OPEN_LICENCE_SOURCE, USER_OWNED_OR_AUTHORISED, DISPLAY_RESTRICTED, ANALYSIS_RESTRICTED, EXTERNAL_AI_RESTRICTED, EXPORT_RESTRICTED, DO_NOT_PROCESS, DO_NOT_RETAIN, MANUAL_LEGAL_REVIEW_REQUIRED); new containers still default to UNREVIEWED with no way to supply another value at insert.
- A single access-decision function evaluates (user role × resource rights status × requested action: view / search / process / analyse / external-AI / export / share / print) and is the only gate used by routes and job processors. A permissive role can never override a more restrictive rights status — administrators cannot bypass DO_NOT_PROCESS without a formal, audited rights-status change.
- Quarantined sources (QUARANTINED processing state, or restrictive rights statuses) are visible only to administrators and rights reviewers, excluded from search and AI and external processing, cannot be shared by public URL, and cannot be exported without express approval recorded in the rights record.
- The rights record captures all 17 required fields (source; date obtained; declared source type; licence/permission reference; approved users; approved purposes; storage / analysis / external-processing / student-access / printing / export permissions; retention period; expiry date; reviewer; review date; notes) with an append-only history; the container mirrors the latest status.
- Rights-status changes and access denials on restricted resources create audit events atomically.
- Test suite proves all 6 required scenarios: unauthenticated user sees no protected source; student cannot see a lecturer-only source; administrator cannot bypass DO_NOT_PROCESS without a formal rights change; quarantined source absent from search results; EXTERNAL_AI_RESTRICTED source rejected by the external-AI submission gate; rights changes emit audit events. All 69 existing tests remain green.
- Completion report at `docs/reports/phase-02-completion.md` (PASS/PARTIAL/BLOCKED format) and `docs/status/current-phase.json` updated. Response ends with the PHASE:/STATUS:/CHECKPOINT: structure.

## Out of scope

- Uploading or parsing real files; folder/ZIP ingestion (moves to a later phase).
- OCR, extraction, segmentation, search implementation, or AI features — this phase only builds the *gates* those phases must pass through.
- Real restricted legal documents; external AI calls (only a gate that refuses them is built).
- Portal-facing UI beyond what is needed to exercise auth/rights (staff-facing routes and minimal admin surface only).

## Steps

1. **ADR 0003 + docs** — Record the Phase 02 redefinition (Auth/Roles/Rights/Quarantine; Ingestion shifts later), rewrite `docs/RIGHTS_MODEL.md` around the 13 statuses with a per-status capability matrix (storage, display, search, analysis, external AI, export, print, student access), and update `docs/PHASES.md`.
2. **Schema & migration** — Extend `research_users` with the 8-role vocabulary and authentication linkage; extend `research_rights_records` with the 17 required fields (append-only); migrate the 4 legacy rights statuses to the new vocabulary via psql-applied additive SQL with a recorded reversible mapping; keep the UNREVIEWED insert-time lock. Test both applying the migration and booting the app against the migrated database.
3. **Access-decision layer** — A pure, exhaustively-tested `decideAccess({role, rightsStatus, processingState, action})` function returning allow/deny with a structured reason; deny-by-default; rights status always caps role permissions; golden-pinned decision matrix.
4. **Authentication & role wiring** — Authenticate research users (building on the existing staff gate) and resolve their research role per request; unauthenticated requests see nothing protected; wire `decideAccess` into every research route and into job processing (processors re-check rights before touching content, per the existing enforcement rules).
5. **Quarantine & gate enforcement** — Enforce quarantine visibility rules; a search-listing gate that excludes quarantined/restricted containers; an external-processing/AI submission gate that structurally refuses EXTERNAL_AI_RESTRICTED / DO_NOT_PROCESS sources; no public-URL sharing; export requires recorded approval.
6. **Rights-review workflow** — Endpoints for rights reviewers/administrators to record a full rights decision (all 17 fields), which appends a rights record, updates the container mirror, and writes the audit event and transformation atomically; expiry dates and DO_NOT_RETAIN feed the container state machine (existing DELETION_PENDING path).
7. **Tests & close-out** — The 6 mandated proof tests plus exhaustive decision-matrix tests (synthetic fixtures only, isolated test schema); browser e2e extending the existing Playwright smoke for the unauthenticated-denial case; format/lint/typecheck/unit/integration/e2e all green; completion report + `current-phase.json`; architect security review.

Critical constraints: never weaken an existing control; no mocks in production code; no hard-coded success; deny-by-default everywhere; psql migrations only (never drizzle push); zod/v4 + req.log/logger conventions.

## Relevant files

- `lib/db/src/schema/research.ts`
- `lib/db/sql/research-schema.sql`
- `lib/db/sql/migrations/0002-phase01-core-architecture.sql`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/data/containers.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/domain/audit.ts`
- `artifacts/api-server/src/research/processing/queue.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/testing/testDb.ts`
- `artifacts/api-server/src/research/testing/fixtureFactory.ts`
- `artifacts/api-server/e2e/research-smoke.spec.ts`
- `docs/RIGHTS_MODEL.md`
- `docs/PHASES.md`
- `docs/status/current-phase.json`
- `docs/reports/phase-01-completion.md`
