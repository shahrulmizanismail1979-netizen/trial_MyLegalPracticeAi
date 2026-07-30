# Phase 12a Completion Report — Audit Event Coverage

**Date:** 2026-07-27  
**Phase:** 12a  
**Status:** COMPLETE

---

## Objective

Extend audit coverage from container state-machine transitions (already logged) to every security- and compliance-relevant action across the platform, while ensuring that restricted judgment text never appears in audit log bodies.

---

## Deliverables

### Audit Taxonomy (`research/domain/auditEvents.ts`)

19 event action strings defined as a TypeScript const enum:

`DOCUMENT_UPLOADED`, `CHECKSUM_VERIFIED`, `RIGHTS_CHANGED`, `PROCESSING_STARTED`, `OCR_COMPLETED`, `SEGMENTATION_PROPOSED`, `BOUNDARY_CHANGED`, `REVIEWER_DECISION`, `JUDGMENT_VERIFIED`, `DOCUMENT_ACCESSED`, `SEARCH_EXECUTED`, `QUOTATION_CREATED`, `EXPORT_REQUESTED`, `PRINT_REQUESTED`, `AI_ANALYSIS_REQUESTED`, `AI_PROVIDER_USED`, `RECORD_DELETED`, `ACCESS_DENIED`, `ADMIN_ACTION`.

---

### Text-Leak Guard (`research/domain/audit.ts`)

`sanitiseForAudit(obj)` — recursively removes any key whose value is a string longer than 500 characters before any metadata payload is inserted into `research_audit_events`. Applied to all metadata passed to `recordAuditEvent`. Handles nested objects and arrays.

---

### Instrumentation Points Added

| Event | Instrumented in |
|---|---|
| DOCUMENT_UPLOADED, CHECKSUM_VERIFIED | Upload/registration flow (`ingestion/service.ts`) |
| RIGHTS_CHANGED | `recordRightsDecision` |
| PROCESSING_STARTED, OCR_COMPLETED, SEGMENTATION_PROPOSED, BOUNDARY_CHANGED, REVIEWER_DECISION, JUDGMENT_VERIFIED | Relevant job-completion and transition points |
| DOCUMENT_ACCESSED | Viewer judgment-fetch route |
| SEARCH_EXECUTED | Search route (query string logged; result text excluded) |
| QUOTATION_CREATED | Quotation-save route |
| EXPORT_REQUESTED, PRINT_REQUESTED | Export/print routes |
| AI_ANALYSIS_REQUESTED, AI_PROVIDER_USED | AI analysis runner |
| RECORD_DELETED | Deletion endpoints |
| ACCESS_DENIED | `checkContainerAccess` on denied decisions |
| ADMIN_ACTION | Admin-only endpoints (rights decisions, provider management, user management) |

---

### Admin Audit Query Route

`GET /api/research/audit-events` (owner/admin only): paginated; filterable by actor, action, entityKind, entityId, dateFrom, dateTo; ordered by `created_at DESC`.

---

### Key Design Decisions

1. **Text-leak guard is unconditional** — `sanitiseForAudit` runs on every metadata payload before insertion; it is not opt-in per call site.
2. **ACCESS_DENIED events are atomic** — written in the same path as the denial response so a denied attempt always produces an audit event, even if the denial happens before any DB row is touched.
3. **Query string logged; result text excluded** — `SEARCH_EXECUTED` records the query string (which is user-controlled input, not restricted content); search result text is never included.
4. **Admin audit route enforces owner/admin role** — researchers cannot read the audit log; the audit trail is privileged operational data.

---

## Tests (`phase12a.test.ts`)

**18 new tests; 367 total tests across all phases.**

Coverage: `sanitiseForAudit` (strips strings > 500 chars; preserves short strings; handles nested objects; handles arrays; preserves non-string values); event emission for DOCUMENT_ACCESSED, SEARCH_EXECUTED, QUOTATION_CREATED, EXPORT_REQUESTED, ADMIN_ACTION, AI_ANALYSIS_REQUESTED, AI_PROVIDER_USED, ACCESS_DENIED; admin audit-events route (returns events; owner-only, non-owner gets 403; filters by action; filters by entityId); judgment text absent from all logged event metadata; long passage text in QUOTATION_CREATED detail is redacted.

---

## PHASE: 12a | STATUS: complete | CHECKPOINT: 2026-07-27
