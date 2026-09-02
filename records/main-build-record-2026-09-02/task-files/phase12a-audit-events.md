# Phase 12a: Audit Event Coverage

## What & Why
The platform already has a `research_audit_events` table and a `recordAuditEvent` helper. However only container state-machine transitions are currently logged. Phase 12a extends audit coverage to every security- and compliance-relevant action: document access, search, AI requests, exports, prints, quotation creation, failed access attempts, administrator actions, deletion, and rights changes. Restricted judgment text must never appear in audit log bodies — only identifiers and metadata.

## Done looks like
- Every action in the list below produces a row in `research_audit_events` with `actor`, `action`, `entity_id`, `entity_kind`, `metadata` (safe, no judgment text), and `created_at`.
- A new admin-only `GET /api/research/audit-events` route returns paginated audit logs filterable by `actor`, `action`, `entityKind`, `entityId`, `dateFrom`, `dateTo`.
- A test file `phase12a.test.ts` covers all new event types (≥ 15 tests), including verifying that judgment text is absent from logged metadata.

## Out of scope
- UI for the audit log viewer (future phase)
- Exporting audit logs to external SIEM systems
- Altering the existing state-machine transition events (they already log correctly)

## Steps
1. **Audit event taxonomy** — define a TypeScript const enum of all event action strings (`DOCUMENT_UPLOADED`, `CHECKSUM_VERIFIED`, `RIGHTS_CHANGED`, `PROCESSING_STARTED`, `OCR_COMPLETED`, `SEGMENTATION_PROPOSED`, `BOUNDARY_CHANGED`, `REVIEWER_DECISION`, `JUDGMENT_VERIFIED`, `DOCUMENT_ACCESSED`, `SEARCH_EXECUTED`, `QUOTATION_CREATED`, `EXPORT_REQUESTED`, `PRINT_REQUESTED`, `AI_ANALYSIS_REQUESTED`, `AI_PROVIDER_USED`, `RECORD_DELETED`, `ACCESS_DENIED`, `ADMIN_ACTION`). Store in `research/domain/auditEvents.ts`.
2. **Text-leak guard** — add a `sanitiseForAudit(obj)` utility that recursively removes any key whose value is a string longer than 500 characters (to stop judgment text leaking into metadata). Apply to all `metadata` payloads before insertion.
3. **Instrument upload and checksum paths** — emit `DOCUMENT_UPLOADED` and `CHECKSUM_VERIFIED` events from the upload/registration flow.
4. **Instrument rights change** — emit `RIGHTS_CHANGED` from `recordRightsDecision` (and any update path) with old-status → new-status in metadata (no text content).
5. **Instrument processing milestones** — emit `PROCESSING_STARTED`, `OCR_COMPLETED`, `SEGMENTATION_PROPOSED`, `BOUNDARY_CHANGED`, `REVIEWER_DECISION`, `JUDGMENT_VERIFIED` at the relevant transition or job-completion points.
6. **Instrument access and search** — emit `DOCUMENT_ACCESSED` from the viewer judgment-fetch route and `SEARCH_EXECUTED` from the search route (query string is safe; result text is not included).
7. **Instrument workspace actions** — emit `QUOTATION_CREATED` from the quotation-save route, `EXPORT_REQUESTED` and `PRINT_REQUESTED` from the export/print stub routes (and later the real routes). Emit `AI_ANALYSIS_REQUESTED` and `AI_PROVIDER_USED` from the AI analysis runner.
8. **Instrument deletions** — emit `RECORD_DELETED` with `entityKind` and `entityId` from every deletion endpoint (Phase 12c will add more). Emit `ADMIN_ACTION` from admin-only endpoints (rights decisions, provider management, user management).
9. **Instrument failed access** — emit `ACCESS_DENIED` from `checkContainerAccess` when the decision is `allowed: false`. Include role and reason in metadata; never include judgment text.
10. **Admin audit-log query route** — `GET /api/research/audit-events` (owner/admin role only); paginated; filterable by actor, action, entityKind, entityId, dateFrom, dateTo. Returns events ordered by `created_at DESC`.
11. **Tests** — `phase12a.test.ts`: verify each event type is emitted; verify `sanitiseForAudit` strips long strings; verify `ACCESS_DENIED` events are written when a researcher tries to access a container they cannot view; verify judgment text is not present in any logged metadata field.

## Relevant files
- `artifacts/api-server/src/research/domain/audit.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/routes/viewer.ts`
- `artifacts/api-server/src/research/routes/search.ts`
- `artifacts/api-server/src/research/routes/workspace.ts`
- `artifacts/api-server/src/research/routes/authorities.ts`
- `artifacts/api-server/src/research/analysis/generator.ts`
- `artifacts/api-server/src/research/data/containers.ts`
- `lib/db/src/schema/research.ts`
