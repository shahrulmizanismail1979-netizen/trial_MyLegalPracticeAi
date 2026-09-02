# Production-Readiness Review & Operational Docs

## What & Why

Conduct a structured production-readiness review of the Judgment Research Platform across all 24 required domains, issue a formal written readiness status, and produce the 12 operational documents needed before any supervised or full production use begins.

Phases 00–14 are now all merged (488/488 tests pass). The controlled pilot (Task #85) has merged. Before any corpus import or supervised use, a formal assessment and documentation suite must exist.

---

## Readiness Decision to Issue

The executor must read all phase completion reports, the pilot report, all ADRs, the security model, the rights model, and the open task list, then produce a formal decision using exactly one status:

- NOT_READY
- READY_FOR_LIMITED_INTERNAL_PILOT
- READY_FOR_CONTROLLED_PRIVATE_USE
- READY_FOR_APPROVED_PRODUCTION_USE

The decision must assess all 24 domains listed in the Steps section and cite the evidence for each.

**Known factors that must be weighed:**
- Task #7 (upload submitter binding) — still PROPOSED; unauthorised document access not fully closed
- Task #21 (corp chat isolation) — still PROPOSED; cross-subscriber isolation not formally verified
- Task #87 (job-stealing test) — still PROPOSED; test coverage gap
- Pilot report: Task #85 has merged but the acceptance-gate outcome must be read from the merged pilot report
- No backup/restoration or incident-response procedures yet exist
- All 12 operational documents are absent

---

## Done Looks Like

### Formal decision report
`docs/PRODUCTION_READINESS.md` — contains the status decision, a table assessing all 24 domains (authentication, permissions, rights gating, quarantine, file provenance, original-file integrity, page extraction, OCR review, multi-case segmentation, human boundary review, cross-file reconstruction, publisher-content isolation, complete-judgment verification, metadata, duplicates, search, quotations, AI evidence, exports, audit, deletion, security, backups, capacity, operational documentation), evidence citations, and the explicit preconditions for each higher status.

### 12 operational documents in `docs/operations/`

| # | Document | File |
|---|---|---|
| 1 | Administrator manual | `administrator-manual.md` |
| 2 | Staff ingestion manual | `staff-ingestion-manual.md` |
| 3 | Legal-review manual | `legal-review-manual.md` |
| 4 | Segmentation-review manual | `segmentation-review-manual.md` |
| 5 | Rights-review manual | `rights-review-manual.md` |
| 6 | Backup and restoration guide | `backup-and-restoration.md` |
| 7 | Incident-response guide | `incident-response.md` |
| 8 | Full-corpus import procedure | `full-corpus-import.md` |
| 9 | Risk register | `risk-register.md` |
| 10 | Known-limitations register | `known-limitations.md` |
| 11 | Deployment architecture | `deployment-architecture.md` |
| 12 | Rollback procedure | `rollback-procedure.md` |

Each document must be written to practitioner depth — sufficient for a staff member who has not built the system to operate it safely, make correct decisions, and escalate appropriately.

---

## Out of Scope

- Beginning full-corpus processing (explicitly deferred)
- Resolving Task #7, #21, or #87 (separate tasks — document them as blockers, do not fix them here)
- Any code changes — documentation only

---

## Steps

1. **Read all evidence** — phase completion reports (phases 00–07 in `docs/reports/`; phases 08–14 from merged test files and pilot report), all ADRs in `docs/decisions/`, `docs/ARCHITECTURE.md`, `docs/RIGHTS_MODEL.md`, `docs/SECURITY_MODEL.md`, `docs/PROCESSING_STATES.md`, `pilot-report.md`, and the open task list. Note the accepted pilot outcome.

2. **Write `docs/PRODUCTION_READINESS.md`** — formal status decision with full 24-domain assessment table; evidence citations per domain; explicit precondition list for each higher status level (READY_FOR_LIMITED_INTERNAL_PILOT, READY_FOR_CONTROLLED_PRIVATE_USE, READY_FOR_APPROVED_PRODUCTION_USE).

3. **Write administrator manual** — platform overview; user and role management (8 roles, how to grant/revoke); system health check procedure; job queue monitoring and intervention; container state dashboard; emergency quarantine of a container; session revocation; escalation contacts.

4. **Write staff ingestion manual** — end-to-end ingestion workflow step by step (upload → rights triage → extraction → segmentation → human review → editorial review → verification); expected processing times; what each queue state means; common error states and recovery; when to escalate to rights reviewer or legal reviewer.

5. **Write legal-review manual** — what `MANUAL_LEGAL_REVIEW_REQUIRED` means and how containers reach that state; the review decision procedure; the 17-field rights record fields a legal reviewer must complete; how to record the outcome; escalation and recusal procedure.

6. **Write segmentation-review manual** — what `SEGMENTATION_REVIEW_REQUIRED` and `EDITORIAL_REVIEW_REQUIRED` mean; how to inspect candidate boundaries; how to approve/reject/split/merge candidates in the review UI; cross-file span confirmation; when to escalate; what happens after approval.

7. **Write rights-review manual** — all 13 rights statuses explained for a reviewer (plain language); how to make a rights decision; the capability matrix (what each status permits for storage/display/search/analysis/AI/export/print/student access); handling expired rights records; the `DO_NOT_RETAIN` deletion path; audit trail obligations.

8. **Write backup and restoration guide** — what data exists (PostgreSQL database, private object storage bucket); where it lives in production (Replit deployment); how to trigger a manual database backup; how to verify backup integrity; step-by-step restoration procedure (database, then object storage, then consistency check); RTO and RPO targets; known limitations (no automated backup verification currently).

9. **Write incident-response guide** — severity classification (P1 data exposure / P2 processing error / P3 operational issue); first-responder checklist for each severity; how to quarantine a container immediately; how to freeze the job queue; how to revoke a user session; evidence preservation steps; communication chain; post-incident review requirement.

10. **Write full-corpus import procedure** — pre-conditions that must be met (pilot acceptance gate passed, security tasks #7 and #21 resolved, administrator and staff manuals read); batch sizing guidance; monitoring checkpoints during import; how to pause/resume the import job; handling partial batch failures; post-import report generation and sign-off.

11. **Write risk register** — one row per risk across: data loss, unauthorised access, rights mis-classification, OCR error propagation, segmentation error, AI evidence failure, external AI exposure, publisher-content leakage, single-point infrastructure failure, operational errors. Columns: risk, likelihood (H/M/L), impact (H/M/L), current mitigations, residual risk, owner, review date.

12. **Write known-limitations register** — document every confirmed limitation at this release: OCR confidence threshold not calibrated to real corpus; pilot not yet run with court-issued documents (or record actual pilot outcome if Task #85 data is available); full-corpus performance unverified at scale; AI evidence not enabled by default; upload submitter binding incomplete (Task #7); cross-subscriber chat isolation not formally verified (Task #21); job-stealing test coverage gap (Task #87); automated backup verification absent; no SLA commitments.

13. **Write deployment architecture** — production topology (Replit deployment, shared Express API server, PostgreSQL database, private object storage bucket); how the monorepo artifacts map to preview paths and routes; secret management (Replit Secrets); TLS termination; no direct database access from browsers (all through API); scaling constraints; health check endpoint (`/api/research/health`); how to verify the deployment is live and healthy.

14. **Write rollback procedure** — how to use Replit checkpoints to revert a bad deployment; which database migrations are reversible and which are irreversible (and what the safe path is for each irreversible one); how to verify system stability after rollback; how to communicate a rollback to affected staff; when rollback is not appropriate and forward-fix is preferred.

---

## Relevant Files

- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/RIGHTS_MODEL.md`
- `docs/PROCESSING_STATES.md`
- `docs/SECURITY_MODEL.md`
- `docs/PHASES.md`
- `docs/PROJECT_CHARTER.md`
- `docs/reports/phase-00-completion.md`
- `docs/reports/phase-01-completion.md`
- `docs/reports/phase-02-completion.md`
- `docs/reports/phase-03-completion.md`
- `docs/reports/phase-04-completion.md`
- `docs/reports/phase-05-completion.md`
- `docs/reports/phase-06-completion.md`
- `docs/reports/phase-07-completion.md`
- `docs/decisions/0001-bootstrap-inside-monorepo.md`
- `docs/decisions/0002-phase-01-redefined-core-architecture.md`
- `docs/decisions/0003-phase-02-auth-roles-rights-quarantine.md`
- `docs/decisions/0004-phase-03-ingestion.md`
- `docs/decisions/0005-phase-04-extraction.md`
- `docs/decisions/0006-phase-05-segmentation.md`
- `docs/decisions/0007-phase-06-validation-review-cross-file.md`
- `docs/decisions/0008-phase-07-publisher-content-isolation.md`
- `docs/decisions/0009-phase-08-search-research-ui.md`
- `pilot-report.md`
- `artifacts/api-server/src/research/domain/access.ts`
- `artifacts/api-server/src/research/retention/deletionService.ts`
- `artifacts/api-server/src/research/storage/keyValidation.ts`
- `scripts/src/generate-pilot-report.ts`
