# Production-Readiness Assessment — Judgment Research Platform

**Assessed:** 2026-07-30  
**Assessor:** Platform engineering team  
**Evidence base:** Phase completion reports 00–14 (docs/reports/); pilot-report.md (2026-07-29); ADRs 0001–0015; RIGHTS_MODEL.md; SECURITY_MODEL.md; ARCHITECTURE.md; open task register.

> **Note:** Phase tracking records (current-phase.json, completion reports for phases 08–14, ADRs 0010–0015, PHASES.md phases 10–14) were stale at the time of initial writing — frozen at phase 07. These records were corrected and completed on 2026-07-30 as Task #97. The readiness assessment itself is unaffected; the underlying evidence (test results, pilot data, security findings) is unchanged.

---

## Decision

### Status: NOT_READY

The platform's core pipeline is architecturally complete, thoroughly tested (488/488 tests pass across 31 test files), and the Phase 14 controlled pilot has passed its acceptance gate (6 containers, 37 candidates, 73 audit events, all 7 gate checks green). However, two open security tasks create an authorization gap that must be closed before any operational use, and operational documentation was absent until this assessment (now remediated below).

### Preconditions for READY_FOR_LIMITED_INTERNAL_PILOT

All of the following must be met before a small supervised staff cohort may use the platform:

1. **Task #7 resolved** — Upload submitter binding must be implemented and verified. Until closed, an authenticated staff member with an operational role can access containers uploaded by another staff member, even before rights review is complete. This undermines the principle that UNREVIEWED content is visible only to rights-privileged roles.
2. **Task #21 assessed** — Cross-subscriber AI chat isolation must be formally verified or confirmed out of scope for the research platform. Document the outcome.
3. **Backup procedure executed** — A manual database backup must be taken and its restoration verified before any documents enter the system operationally (see backup-and-restoration.md).
4. **Operational documents read and signed off** — The administrator, staff ingestion, and rights-review manuals (this suite) must be read by every operator before access is granted.

### Preconditions for READY_FOR_CONTROLLED_PRIVATE_USE

In addition to the above:

5. **Task #87 resolved** — Job-stealing between parallel workers must be confirmed not to occur silently.
6. **Pilot human-review sign-off** — A designated legal reviewer must inspect and sign off on the pilot candidates (pilot-report.md §12 documents that human-review time has not yet been measured).
7. **OCR calibration** — The OCR confidence threshold (currently 70%) must be validated against a representative sample of real court documents and adjusted if necessary.
8. **Formal capacity test** — The stress test suite must be run against a production-representative corpus size and its results documented.

### Preconditions for READY_FOR_APPROVED_PRODUCTION_USE

In addition to the above:

9. **Full-corpus import completed** — The full-corpus import procedure must have been executed and the post-import report reviewed.
10. **Automated backup verification** — Scheduled backup-and-restore verification must be running.
11. **SLA commitments documented** — Response time, availability, and recovery objectives must be defined and agreed.
12. **External security audit** — An independent security review of the production deployment must be completed.

---

## 24-Domain Assessment

| # | Domain | Status | Finding | Evidence |
|---|--------|--------|---------|----------|
| 1 | **Authentication** | ✅ Pass | All `/api/research` routes require staff authentication (Clerk + staff allowlist). Unauthenticated requests receive 401. Per-request role resolved from `research_users` table; no row → `guest`. | SECURITY_MODEL §1; phase02.test.ts; e2e smoke |
| 2 | **Permissions** | ✅ Pass | `decideAccess({role, rightsStatus, processingState, action})` is the sole gate. Deny-by-default, pure, golden-pinned (`fixtures/golden/access-decision-matrix.json`). Role caps are applied after rights-status caps — no role can override a restrictive rights status. | RIGHTS_MODEL §Enforcement; phase02.test.ts scenario 3 |
| 3 | **Rights gating** | ✅ Pass | 13 rights statuses; 17-field append-only rights record; capability matrix enforced at data layer. Rights changes are atomic (append record + update mirror + audit event + transformation in one transaction). Expired records treated as restrictive. | RIGHTS_MODEL; phase02.test.ts scenario 6 |
| 4 | **Quarantine** | ✅ Pass | `QUARANTINED` state reachable from any live state. Quarantined containers excluded from search, AI, export, and all processing. Visible only to owner/administrator/rights_reviewer. | PROCESSING_STATES; phase02.test.ts scenario 4 |
| 5 | **File provenance** | ✅ Pass | SHA-256 content checksum on every container. Idempotency keys prevent duplicate processing. `research_stored_artifacts` unique `(produced_by_key, kind)` constraint prevents output duplication. Every transformation recorded append-only in `research_transformations`. | DATA_MODEL; phase03 completion |
| 6 | **Original-file integrity** | ✅ Pass | Original bytes stored byte-for-byte in private object storage. SHA-256 verified at ingestion and before every content-touching job (`CHECKSUM_MISMATCH` → dead-letter). Raw page extractions immutable; corrections are versioned append-only rows. | phase03, phase04 completion |
| 7 | **Page extraction** | ✅ Pass | Phase 04 complete. Four replaceable adapters (native text, page renderer, OCR, layout). Span model with character-range provenance. Every page extraction run records processor version, adapter identities, checksums. | phase04 completion; ADR 0005 |
| 8 | **OCR review** | ✅ Pass | Pages with mean OCR confidence <70% receive `LOW_OCR_CONFIDENCE` warning and route to `OCR_REVIEW_REQUIRED` human review. Word confidence <40% emits `ILLEGIBLE_REGION`. Disabled OCR adapter routes to review (`POSSIBLE_MISSING_TEXT`) — never fakes output. ⚠️ Threshold not yet calibrated against real corpus. | phase04 completion; known-limitations.md |
| 9 | **Multi-case segmentation** | ✅ Pass | Phase 05 complete. 24 deterministic signal types, 5 strength tiers. Handles zero/one/many cases per file and cases spanning multiple files. No AI involvement. | phase05 completion; ADR 0006 |
| 10 | **Human boundary review** | ✅ Pass | Phase 06 complete. `SEGMENTATION_REVIEW_REQUIRED` routes to review queue. Review UI: approve/reject/split/merge/reprocess. Every action recorded as `research_candidate_review_actions` row + audit event. | phase06 completion; candidateReview.ts |
| 11 | **Cross-file reconstruction** | ✅ Pass | Phase 06 complete. `detectCrossFileRelationship` detects EXACT_DUPLICATE, POSSIBLE_DUPLICATE, POSSIBLE_CONTINUATION, ALTERNATIVE_VERSION, RELATED_APPEAL. Pilot confirmed: e1/e2 split-file containers correctly identified. | phase06 completion; pilot-report.md |
| 12 | **Publisher-content isolation** | ✅ Pass | Phase 07 complete. Six classifications (VERIFIED_JUDICIAL_TEXT, PROBABLE_JUDICIAL_TEXT, MANUAL_REVIEW_REQUIRED, SUSPECTED_PUBLISHER_EDITORIAL, ADMINISTRATIVE_METADATA, SOURCE_ARTIFACT). Isolation gate enforced on all full-text paths. Non-destructive (originals retained). | phase07 completion; ADR 0008 |
| 13 | **Complete-judgment verification** | ✅ Pass | Completeness checker verifies structural elements (coram, citation, grounds, closing order). Incomplete judgments route to `EDITORIAL_REVIEW_REQUIRED`. `research_verified_judgments` records approved judicial spans with source refs. | phase07 completion |
| 14 | **Metadata** | ✅ Pass | 17-field rights records per container. Phase 08: 13-field case metadata per verified judgment (caseName, neutralCitation, court, judges, dates, parties, jurisdiction, etc.) with source references and confidence scores. | ADR 0009; phase08 |
| 15 | **Duplicates** | ✅ Pass | Phase 03: SHA-256 duplicate detection at ingest (never silently re-ingested). Phase 08: `research_duplicate_links` with checksum, citation, and paragraph-fingerprint signals. No auto-merge (judicial-text integrity rule). | phase03, ADR 0009 |
| 16 | **Search** | ✅ Pass | Phase 08: PostgreSQL full-text search (English + Malay dictionaries). Isolation gate enforced structurally — only `VERIFIED_JUDICIAL_TEXT`/`PROBABLE_JUDICIAL_TEXT` sections enter the index. Quarantined/restricted containers excluded. | ADR 0009; phase08 |
| 17 | **Quotations** | ✅ Pass | Phase 09 complete. Quotation extraction and citation matching tools implemented. | phase09 |
| 18 | **AI evidence** | ✅ Pass | Phase 10 complete. AI disabled by default (`isEnabled() = false`). Enabling requires explicit ADR. Every substantive AI proposition requires paragraph-level supporting evidence. External AI gate refuses `EXTERNAL_AI_RESTRICTED` and `DO_NOT_PROCESS` containers structurally. | SECURITY_MODEL §4; phase02.test.ts scenario 5; phase10 |
| 19 | **Exports** | ✅ Pass | Export gate requires both rights-status cap (`decideAccess`) and express `exportPermitted = true` in the latest rights record. `DO_NOT_PROCESS`, `DO_NOT_RETAIN`, `DISPLAY_RESTRICTED`, `EXTERNAL_AI_RESTRICTED` statuses block export. | RIGHTS_MODEL capability matrix; phase02 completion |
| 20 | **Audit** | ✅ Pass | Every container/job state change writes a `research_audit_events` row in the same database transaction. Audit events carry entity type, entity id, event, from/to states, actor identity, and structured detail. Rights changes, review actions, corrections, and access denials all emit audit events. Pilot: 73 audit events recorded across 6 containers. | ARCHITECTURE §State Machines; pilot-report.md §10 |
| 21 | **Deletion** | ✅ Pass | `DO_NOT_RETAIN` rights status routes container to `DELETION_PENDING` via state machine. `retention/deletionService.ts` implements soft and hard deletion paths. `DELETED` is a terminal state; audit trail is retained after deletion. | RIGHTS_MODEL §13; phase02 |
| 22 | **Security** | ❌ Blocker | Two open tasks: **Task #7** (upload submitter binding — staff member A can access documents uploaded by B before rights review); **Task #21** (cross-subscriber chat isolation not formally verified). Phase 12d security test suite covers access denial and audit trails for unauthorised access. CSRF protection and path-traversal prevention implemented. | SECURITY_MODEL; phase12d-security.test.ts; open task register |
| 23 | **Backups** | ⚠️ Gap | No automated backup verification procedure. No backup/restoration guide existed before this assessment. Manual backup instructions now documented in backup-and-restoration.md. PostgreSQL and object storage are the two data stores. | backup-and-restoration.md (this document set) |
| 24 | **Capacity** | ⚠️ Partial | `stress.test.ts` exists with synthetic corpus. Pilot ran 6 containers successfully. Full-corpus performance at scale (hundreds of containers, thousands of pages) has not been formally benchmarked. | pilot-report.md; stress.test.ts; known-limitations.md |
| — | **Operational documentation** | ✅ Remediated | All 12 operational documents produced as part of this assessment (docs/operations/). Absent before this task. | This document set |

---

## Pilot Evidence Summary (pilot-v1, 2026-07-29)

| Metric | Value |
|--------|-------|
| Containers processed | 6 |
| Candidates detected | 37 |
| Audit events recorded | 73 |
| Rights records created | 6 |
| Rights-restricted containers | 0 |
| Verified judgments | 0 (human sign-off pending) |
| Acceptance gate | ✅ ALL 7 CONDITIONS PASS |

Pilot files tested the key scenarios: dense multi-case file (30 candidates), scanned PDF (OCR path), split-judgment across two files (cross-file reconstruction), duplicate file, and a 4-case file. All containers are in `PRIVATE_PROCESSING_APPROVED` rights status. All containers are in `SEGMENTATION_REVIEW_REQUIRED` or `JUDGMENT_VERIFICATION_PENDING` — human review is the next step for each.

---

## Operational Documents Produced

All 12 required operational documents are at `docs/operations/`:

| Document | File |
|----------|------|
| Administrator manual | administrator-manual.md |
| Staff ingestion manual | staff-ingestion-manual.md |
| Legal-review manual | legal-review-manual.md |
| Segmentation-review manual | segmentation-review-manual.md |
| Rights-review manual | rights-review-manual.md |
| Backup and restoration guide | backup-and-restoration.md |
| Incident-response guide | incident-response.md |
| Full-corpus import procedure | full-corpus-import.md |
| Risk register | risk-register.md |
| Known-limitations register | known-limitations.md |
| Deployment architecture | deployment-architecture.md |
| Rollback procedure | rollback-procedure.md |

---

*This report supersedes any informal readiness assessments. Re-issue after each blocking condition is resolved.*
