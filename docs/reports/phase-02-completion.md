# Phase 02 Completion Report — Authentication, Roles, Rights & Quarantine

- **Phase**: 02 (Authentication, Roles, Rights & Quarantine — redefined from
  "Ingestion" by ADR 0003)
- **Date**: 2026-07-23
- **Status**: PASS

## Objective

Build the access-control core of the Judgment Research Platform before any
document processing exists: authentication and per-request role resolution
(8 roles), the 13-status document-rights vocabulary with a full 17-field
append-only rights record, a single deny-by-default access-decision function
(role × rights status × processing state × action), and quarantine/gate
enforcement across routes and job processors. Ingestion shifts to Phase 03.

## Implementation Summary

1. **Phase redefinition** — ADR 0003
   (`docs/decisions/0003-phase-02-auth-roles-rights-quarantine.md`);
   `docs/PHASES.md` updated (Ingestion → Phase 03, later phases shifted);
   `docs/RIGHTS_MODEL.md` rewritten around the 13 statuses with a per-status
   capability matrix, the 8 roles, the 17-field rights record, and the
   enforcement rules.
2. **Schema & migration** — `research_users.role` now carries the 8-role
   vocabulary (default `guest`); `research_rights_records` gained the 17
   typed fields (append-only history preserved).
   `lib/db/sql/migrations/0003-phase02-auth-roles-rights.sql` (psql, applied)
   migrates the 4 legacy rights statuses and 3 legacy roles with a recorded,
   reversible mapping: CLEARED_INTERNAL→PRIVATE_PROCESSING_APPROVED,
   RESTRICTED→MANUAL_LEGAL_REVIEW_REQUIRED, EXCLUDED→DO_NOT_PROCESS;
   reviewer→rights_reviewer, admin→administrator. Containers still default
   to UNREVIEWED and the insert schema forbids supplying a rights status.
3. **Access-decision layer** — `research/domain/access.ts`: pure
   `decideAccess({role, rightsStatus, processingState, action,
   restrictions})`, deny-by-default with structured reason codes. Rights
   caps are absolute and applied before role grants — a permissive role can
   never override a restrictive status (administrator cannot bypass
   DO_NOT_PROCESS). Safety holds (QUARANTINED / PROCESSING_BLOCKED /
   DELETION_PENDING) allow metadata view for rights roles only. Expired
   rights records fall back to restrictive handling. The full role × status
   × action matrix and the hold-state matrix are golden-pinned
   (`fixtures/golden/access-decision-matrix.json`,
   `fixtures/golden/access-hold-matrix.json`).
4. **Authentication & role wiring** — `/api/research` remains behind the
   existing staff gate (Clerk auth + staff allowlist);
   `research/auth.ts` resolves each staff member's research role from
   `research_users` per request (no row / inactive ⇒ `guest`).
   `GET /api/research/me` reports the resolved identity. Container
   registration now requires an operational role (owner / administrator /
   rights_reviewer). Job processors re-check rights via the same decision
   function before touching content (`processing/handlers.ts`); processors
   are content-touching by default, with registration/checksum work
   explicitly exempted per the rights model. Denied jobs are
   BLOCKED_BY_RIGHTS and route a review item.
5. **Quarantine & gates** — `research/domain/gates.ts`:
   `checkContainerAccess`/`assertContainerAccess` load the live rights
   status, processing state, and latest rights record, and audit every
   denial on restricted resources. Search-listing gate
   (`filterSearchVisible` + `GET /containers/search-visible`) excludes
   quarantined/held/restricted containers for everyone. External-AI
   submission gate structurally refuses EXTERNAL_AI_RESTRICTED /
   DO_NOT_PROCESS (no external call exists behind it). Export gate requires
   both the rights cap and express `export_permitted` approval in the latest
   rights record. Restricted containers are absent from listings and return
   404 (not teased) on direct fetch. No public URLs exist into research
   data.
6. **Rights-review workflow** — `research/data/rights.ts`:
   `POST /containers/:id/rights-decision` (rights roles only) appends a full
   17-field rights record, mirrors the status onto the container, and writes
   the transformation + audit event in one transaction (row-locked).
   DO_NOT_RETAIN routes the container to DELETION_PENDING through the state
   machine. `GET /containers/:id/rights-records` exposes the append-only
   history to reviewer roles.

## Proof tests (all six mandated scenarios)

| # | Scenario | Test |
|---|----------|------|
| 1 | Unauthenticated user sees no protected source | `access.test.ts` ("denies everything when unauthenticated") + e2e `research-smoke.spec.ts` (401 in a real browser) |
| 2 | Student cannot see a lecturer-only source | `access.test.ts` ("students need express student-access permission") |
| 3 | Administrator cannot bypass DO_NOT_PROCESS without a formal rights change | `access.test.ts` ("rights status caps every role") |
| 4 | Quarantined source absent from search results | `phase02.test.ts` ("quarantined/unreviewed containers never appear in search listings") |
| 5 | EXTERNAL_AI_RESTRICTED rejected by the external-AI gate | `phase02.test.ts` ("external-AI gate structurally refuses restricted sources") |
| 6 | Rights changes emit audit events | `phase02.test.ts` ("appends a full 17-field record … audit atomically") |

## Verification

- `pnpm run typecheck:libs` and api-server typecheck: green.
- Full api-server suite via the `api-tests` workflow: **14 files, 89 tests
  passed** (69 pre-existing tests remain green; 20 new Phase 02 tests).
- Migration applied to the dev database via psql; server boots against the
  migrated schema; `/api/research/healthz` returns 401 unauthenticated and
  `/api/healthz` returns 200 through the shared proxy.
- Golden decision matrices generated deliberately with `UPDATE_GOLDEN=1` and
  committed.

## Deviations / Notes

- The external-AI submission endpoint returns 503 ("adapters disabled") when
  the gate passes — Phase 02 builds the gate, not the feature.
- Export endpoint verifies approval only; export mechanics arrive in a later
  phase.
- No real restricted documents or external AI calls were used anywhere.

## Next phase

Phase 03 — Ingestion (folder/ZIP upload, staging, checksum verification),
`status: not_started` in `docs/status/current-phase.json`.
