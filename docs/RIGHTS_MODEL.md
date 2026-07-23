# Rights Model — Judgment Research Platform

Every source container carries exactly one rights status. Access and
processing depend on it. **All source files begin as `UNREVIEWED`.** The
database default is `UNREVIEWED` and no code path may insert a container with
any other status.

Since Phase 02 (ADR 0003) the vocabulary has 13 statuses. The legacy 4-status
vocabulary (`UNREVIEWED` / `CLEARED_INTERNAL` / `RESTRICTED` / `EXCLUDED`)
was migrated with a recorded, reversible mapping — see ADR 0003 and
`lib/db/sql/migrations/0003-phase02-auth-roles-rights.sql`.

## Rights Statuses

| Status | Meaning |
| --- | --- |
| `UNREVIEWED` | Default on ingest. Rights not yet assessed. |
| `COMMERCIAL_SOURCE_REVIEW_REQUIRED` | Suspected commercial/publisher source; rights review must decide before any processing. |
| `PRIVATE_PROCESSING_APPROVED` | Cleared for full internal research processing. No external exposure. |
| `OFFICIAL_COURT_SOURCE` | Obtained from an official court source. Full processing permitted. |
| `PUBLIC_OR_OPEN_LICENCE_SOURCE` | Public domain or open licence. Full processing permitted. |
| `USER_OWNED_OR_AUTHORISED` | Supplied by the rights holder or with the holder's authorisation. Full internal processing; no public sharing. |
| `DISPLAY_RESTRICTED` | May be processed and analysed internally, but content must not be displayed, printed, exported or shared. |
| `ANALYSIS_RESTRICTED` | May be viewed, but must not be analysed, indexed for search, submitted to AI, or exported. |
| `EXTERNAL_AI_RESTRICTED` | Full internal processing, but must never be submitted to any external AI or external processor. |
| `EXPORT_RESTRICTED` | Full internal processing, but must not be exported, printed, or shared. |
| `DO_NOT_PROCESS` | Must not be processed in any way. Metadata visible to rights roles only, for disposition. |
| `DO_NOT_RETAIN` | Must not be retained. Feeds the container state machine's `DELETION_PENDING` path. No processing. |
| `MANUAL_LEGAL_REVIEW_REQUIRED` | A lawyer must review before anything happens. Treated like `DO_NOT_PROCESS` until decided. |

## Capability matrix (rights-status caps)

A permissive role can NEVER override a restrictive rights status: the cells
below are hard caps applied before any role permission is considered. The
machine-readable version of this matrix is golden-pinned
(`fixtures/golden/access-decision-matrix.json`) and enforced by
`decideAccess` — the single access-decision function.

| Status | Storage | Display | Search | Analysis | External AI | Export | Print | Student access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `UNREVIEWED` | yes | rights roles only | no | no | no | no | no | no |
| `COMMERCIAL_SOURCE_REVIEW_REQUIRED` | yes | rights roles only | no | no | no | no | no | no |
| `PRIVATE_PROCESSING_APPROVED` | yes | yes | yes | yes | no | no | yes | yes |
| `OFFICIAL_COURT_SOURCE` | yes | yes | yes | yes | yes | yes | yes | yes |
| `PUBLIC_OR_OPEN_LICENCE_SOURCE` | yes | yes | yes | yes | yes | yes | yes | yes |
| `USER_OWNED_OR_AUTHORISED` | yes | yes | yes | yes | no | yes | yes | yes |
| `DISPLAY_RESTRICTED` | yes | no | yes | yes | no | no | no | no |
| `ANALYSIS_RESTRICTED` | yes | yes | no | no | no | no | yes | yes |
| `EXTERNAL_AI_RESTRICTED` | yes | yes | yes | yes | no | yes | yes | yes |
| `EXPORT_RESTRICTED` | yes | yes | yes | yes | no | no | no | yes |
| `DO_NOT_PROCESS` | audit only | rights roles only | no | no | no | no | no | no |
| `DO_NOT_RETAIN` | deletion pending | rights roles only | no | no | no | no | no | no |
| `MANUAL_LEGAL_REVIEW_REQUIRED` | yes | rights roles only | no | no | no | no | no | no |

"Rights roles" = `owner`, `administrator`, `rights_reviewer` (and
`legal_reviewer` for `MANUAL_LEGAL_REVIEW_REQUIRED`). "Export" is always
additionally gated on express approval recorded in the latest rights record
(`exportPermitted`), regardless of status. Public-URL sharing is never
permitted for any status except `OFFICIAL_COURT_SOURCE` and
`PUBLIC_OR_OPEN_LICENCE_SOURCE`, and even then requires the share action to
pass `decideAccess`.

## Roles

Research platform users hold exactly one of 8 roles
(`research_users.role`):

| Role | Intent |
| --- | --- |
| `owner` | Platform owner. Full permissions (still capped by rights status). |
| `administrator` | Operational admin. Full permissions (still capped by rights status). |
| `rights_reviewer` | Reviews and decides rights statuses; sees quarantined/unreviewed material. |
| `legal_reviewer` | Legal review of flagged material; sees `MANUAL_LEGAL_REVIEW_REQUIRED`. |
| `researcher` | Internal research use: view, search, analyse, print. |
| `lecturer` | Teaching use: view, search, print. |
| `student` | Supervised use: view, search — and only where the rights record permits student access. |
| `guest` | Read-only: view of unrestricted material only. |

Authenticated staff without a `research_users` row act as `guest`.
Unauthenticated requests see nothing.

## The 17-field rights record

`research_rights_records` is append-only; the container's `rights_status`
column mirrors the latest record. A formal rights decision captures:

1. source, 2. date obtained, 3. declared source type, 4. licence/permission
reference, 5. approved users, 6. approved purposes, 7. storage permitted,
8. analysis permitted, 9. external processing permitted, 10. student access
permitted, 11. printing permitted, 12. export permitted, 13. retention
period, 14. expiry date, 15. reviewer, 16. review date, 17. notes.

Expired records (past `expiry_date`) are treated as restrictive: access
decisions fall back to deny.

## Enforcement Rules

1. The database default is `UNREVIEWED`; no code path may insert a container
   with a more permissive status.
2. `decideAccess({role, rightsStatus, processingState, action,
   restrictions})` is the **only** gate used by routes and job processors.
   It is pure, deny-by-default, and golden-pinned. Rights status always caps
   role permissions.
3. Repositories and job handlers must check rights status before touching
   container content. A handler that encounters an insufficient status fails
   the job with a recorded reason (`BLOCKED_BY_RIGHTS`) and routes a review
   item — it never guesses or proceeds.
4. Quarantined containers (`QUARANTINED` processing state) are visible only
   to owners, administrators and rights reviewers; they are excluded from
   search, AI, and external processing; they cannot be shared by public URL;
   they cannot be exported without express approval recorded in the rights
   record.
5. Rights-status changes are made only by rights reviewers, administrators
   or owners. Every change appends a rights record, updates the container
   mirror, and writes an audit event and a transformation — all in one
   transaction. `DO_NOT_RETAIN` immediately routes the container to
   `DELETION_PENDING`.
6. Access denials on restricted resources are recorded as audit events.
7. Publisher/editorial material identified inside a container inherits the
   container's rights status but is additionally isolated from indexes,
   embeddings, summaries, AI prompts, classifications, and citation analysis
   regardless of rights status.
8. Rights statuses are never downgraded silently: every change is a
   reviewable transformation.
