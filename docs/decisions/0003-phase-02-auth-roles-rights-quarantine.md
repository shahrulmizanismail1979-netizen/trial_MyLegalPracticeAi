# ADR 0003 — Phase 02 Redefined: Authentication, Roles, Rights & Quarantine

- **Date**: 2026-07-23
- **Status**: Accepted

## Context

`docs/PHASES.md` (as amended by ADR 0002) defined Phase 02 as **Ingestion**
(upload of folders/ZIP archives, duplicate detection, staging, rights-review
queue UI). Ingestion would put real — potentially rights-restricted — files
into the platform. Doing that before authentication, roles, a full rights
vocabulary, and quarantine enforcement exist would mean live restricted data
arriving into a system that cannot yet gate who sees it, what may be done to
it, or how a restriction is enforced.

The platform's persistent rules (rights gating, publisher-content isolation,
default-deny security) demand the opposite order: **the gates must exist
before any document passes through them.**

The original rights vocabulary (4 statuses: `UNREVIEWED`,
`CLEARED_INTERNAL`, `RESTRICTED`, `EXCLUDED`) was also too coarse: it could
not express per-capability restrictions (display vs analysis vs external AI
vs export), source-type provenance (official court vs commercial publisher vs
user-owned), or retention obligations.

## Decision

Phase 02 is redefined as **Authentication, roles, rights & quarantine**.
Ingestion moves to Phase 03 and all subsequent phases shift by one. The phase
table in `docs/PHASES.md` is updated accordingly (this record authorises the
change).

Scope of the redefined Phase 02:

1. **8-role model** for research platform users: `owner`, `administrator`,
   `rights_reviewer`, `legal_reviewer`, `researcher`, `lecturer`, `student`,
   `guest` (read-only). Exactly one role per user. The legacy roles are
   migrated with a recorded, reversible mapping (`reviewer →
   rights_reviewer`, `admin → administrator`).
2. **13-status rights vocabulary** replacing the legacy 4 statuses, with a
   recorded, reversible mapping applied by a psql migration
   (`lib/db/sql/migrations/0003-phase02-auth-roles-rights.sql`):
   - `UNREVIEWED → UNREVIEWED`
   - `CLEARED_INTERNAL → PRIVATE_PROCESSING_APPROVED`
   - `RESTRICTED → MANUAL_LEGAL_REVIEW_REQUIRED`
   - `EXCLUDED → DO_NOT_PROCESS`
   Every changed row is recorded as a `research_transformations` row of kind
   `rights-vocabulary-migration` carrying the old and new values.
3. **17-field rights records**: the append-only `research_rights_records`
   table gains the full set of fields required for a formal rights decision
   (source, date obtained, declared source type, licence reference, approved
   users, approved purposes, storage/analysis/external-processing/
   student-access/printing/export permissions, retention period, expiry date,
   reviewer, review date, notes). The container mirrors the latest status.
4. **Single access-decision function** `decideAccess({role, rightsStatus,
   processingState, action, restrictions?})` — pure, deny-by-default,
   golden-pinned. Rights status always caps role permissions: an
   administrator cannot bypass `DO_NOT_PROCESS` without a formal, audited
   rights-status change.
5. **Quarantine enforcement**: quarantined or restrictively-classified
   sources are visible only to owners, administrators and rights reviewers;
   excluded from search; structurally refused by the external-AI submission
   gate; never shareable by public URL; exportable only with express
   approval recorded in the rights record.
6. **Authentication & role wiring**: research routes stay behind the
   existing staff gate (Clerk session + `ADMIN_ALLOWED_EMAILS`); a
   per-request middleware resolves the staff member's research role from
   `research_users` (unknown staff act as read-only `guest`). Job processors
   re-check rights before touching content.

Explicitly out of scope: uploading/parsing real files, OCR, extraction,
segmentation, search implementation, AI features, real restricted documents,
real external AI calls (only the refusing gate is built).

## Consequences

- Ingestion (now Phase 03) starts life fully gated: every upload lands in a
  system that already enforces roles, rights and quarantine.
- The decision matrix is pinned by golden files; loosening any cell is a
  deliberate, reviewable act.
- The legacy vocabularies remain recoverable from the recorded
  transformation mappings.
- External references to "Phase 02 = Ingestion" are obsolete;
  `docs/PHASES.md` remains the single source of truth.
