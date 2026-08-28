# LAWYes In-Place Upgrade Preservation Baseline (Task 522)

**Baseline date:** 2026-08-28  
**Machine-readable fixture:** `fixtures/preservation/task-522-baseline.json`

## Purpose and safety boundary

This is a source/configuration baseline, not a production-data export. It was
created without connecting to production, reading secret values, issuing Stripe
requests, charging a customer, changing DNS, publishing, or mutating database or
object-storage records. The existing deployment and canonical custom domain
`https://mylegalpracticeai.life` must be upgraded in place. Republishing remains
an owner-approved operation after validation; it is not part of implementation
or automated tests.

The following are preservation requirements, not suggestions:

1. Do not replace the deployment, database, authentication providers, Stripe
   account/catalog, object-storage bucket, or custom-domain mapping.
2. Do not reset, reseed, bulk rewrite, anonymise, or delete existing customer
   records. Test records must be synthetic, uniquely named, and cleaned up.
3. Do not place record counts, customer identifiers, tokens, connection strings,
   bucket identifiers, access codes, or webhook signatures in source control.
4. Keep each portal's existing auth/session boundary and data ownership key.
5. Keep all existing portal and API mounts reachable while adding LAWYes routes.

## Deployment and artifact routing

Replit uses the application router with an autoscale target. The canonical
origin comes from the production `LAWYES_PUBLIC_URL` contract, never from a
request `Origin` header. `/` is the landing page and `/api` is the shared API.

| Route              | Artifact                   |
| ------------------ | -------------------------- |
| `/`                | `artifacts/landing-page`   |
| `/api`             | `artifacts/api-server`     |
| `/myaccidentai/`   | `artifacts/myaccidentai`   |
| `/myccblitai/`     | `artifacts/myccblitai`     |
| `/myconveylitai/`  | `artifacts/myconveylitai`  |
| `/mycorplegalai/`  | `artifacts/mycorplegalai`  |
| `/mycrimai/`       | `artifacts/mycrimai`       |
| `/mylawacad/`      | `artifacts/mylawacad`      |
| `/mylawfirmai/`    | `artifacts/mylawfirmai`    |
| `/mylitai/`        | `artifacts/mylitai`        |
| `/mylitai-irac/`   | `artifacts/mylitai-irac`   |
| `/mysyariahai/`    | `artifacts/mysyariahai`    |
| `/research-admin/` | `artifacts/research-admin` |
| `/sarawak20/`      | `artifacts/sarawak20`      |

The API root keeps `/auth` for Microsoft Entra callbacks and `/api` for the
combined router. Protected mount contracts include `/api/admin`,
`/api/research`, `/api/research-admin`, `/api/cases`, `/api/stripe`,
`/api/access`, `/api/accident`, `/api/crim`, `/api/corp`, `/api/lit`,
`/api/ccb`, `/api/sya`, `/api/acad`, `/api/firm`, and the existing
`/api/convey` routers.

## Authentication, roles, sessions, and isolation

| Surface              | Preserved contract                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| Staff admin/research | Clerk request auth plus staff allowlist; research role is resolved from `research_users`; deny by default |
| Research admin       | Separate `ADMIN_PASSWORD` gate; it is not interchangeable with Clerk                                      |
| Litigation           | PostgreSQL express-session, signed `lit.sid`, `lit_sessions`                                              |
| Criminal             | PostgreSQL express-session, signed `crim.sid`, `user_sessions`                                            |
| Syariah              | PostgreSQL express-session, signed `sya.sid`, `user_sessions`                                             |
| Academic             | PostgreSQL express-session, signed `acad.sid`, `acad_user_sessions`                                       |
| CCB / Convey         | signed Bearer JWT; Convey also rechecks current subscription expiry                                       |
| Corporate            | opaque Bearer token, live lookup in `corp_sessions`                                                       |
| Accident             | `session_id` cookie, live lookup in `access_code_usage`                                                   |
| Firm                 | signed HTTP-only portal cookie with staff/manager gate                                                    |
| Shared SSO           | Microsoft Entra exchange at `/auth` with access-code/email binding                                        |
| Compatibility        | existing `MASTER_ACCESS_CODE` handling remains at portal gates                                            |

Ownership remains keyed to the authenticated subscriber/access-code/session
identity. A foreign matter, upload, draft, message, client, or file must not be
returned merely because its numeric ID is known. Existing regression suites for
shared uploads, corporate conversations, matter files, case clients, case
events, case tasks, and portal matters are preservation evidence.

## Stripe, webhooks, subscriptions, and access provisioning

- Stripe remains the payment provider.
- Checkout is created at `POST /api/stripe/checkout`; only allowlisted portal
  return paths are accepted.
- `LAWYES_PUBLIC_URL` is the canonical success/cancel origin.
- `POST /api/stripe/webhook` must retain raw-body handling before global JSON
  parsing and promptly acknowledge valid delivery.
- Checkout completion provisions the subscriber and portal access code
  idempotently. `/api/stripe/session-info` provides missed-webhook
  reconciliation without creating a duplicate subscriber.
- Subscription cancellation marks payment status cancelled and makes the
  provisioned portal code inactive. A later session-info replay must not
  resurrect access.
- `/api/stripe/customer-portal` remains the self-service billing route.
- Regression tests use mocked Stripe clients and `.invalid` addresses only.
  They must never use a live key, create a live object, or emit email.

## Database schema and count templates

Drizzle schema is under `lib/db/src/schema`; numbered SQL is under
`lib/db/sql/migrations`. At baseline the numbered migration frontier is
`0032-sarawak20-plans-eligibility.sql`. The schema contains shared commerce and
identity records plus portal families (`lit_`, `crim_`, `sya_`, `ccb_`,
`corp_`, accident/convey, `acad_`, `firm_`), Stripe's synced schema, research
tables (`research_`), and Sarawak 20 records.

An authorised operator may capture counts immediately before and after an
approved deployment with this **read-only** template. Store output in the
approved private operational location, never in git:

```sql
BEGIN TRANSACTION READ ONLY;

SELECT schemaname, relname AS table_name, n_live_tup AS estimated_rows
FROM pg_stat_user_tables
ORDER BY schemaname, relname;

-- For a reviewed list of critical tables, use exact counts:
SELECT 'subscribers' AS table_name, count(*) AS record_count FROM subscribers
UNION ALL SELECT 'lit_matters', count(*) FROM lit_matters
UNION ALL SELECT 'crim_matters', count(*) FROM crim_matters
UNION ALL SELECT 'sya_matters', count(*) FROM sya_matters
UNION ALL SELECT 'research_source_containers', count(*) FROM research_source_containers
UNION ALL SELECT 'research_audit_events', count(*) FROM research_audit_events;

ROLLBACK;
```

Before/after counts must be compared by an operator. A lower count on any
preserved table blocks release until explained and approved. Tests must use a
test database only and must never infer that `DATABASE_URL` is non-production.

## Non-destructive migration policy

All Task 522 and later migrations must be additive and forward-compatible:

- allowed: new tables; new indexes using safe deployment practices; nullable
  columns; columns with safe defaults after review; additive constraints only
  after existing data is validated;
- prohibited: `DROP TABLE`, `DROP COLUMN`, `DROP SCHEMA`, `TRUNCATE`, bulk
  `DELETE`, destructive rename/type conversion, table recreation, reset/reseed,
  and irreversible rewriting of existing values;
- data backfills require a separate reviewed script, bounded batches,
  idempotency, dry-run/count reporting, backup confirmation, and an explicit
  owner-approved execution step. They must not run automatically on app boot;
- rollback is code rollback/forward-fix. It must not delete newly added data.

Migration `0013-phase07-schema-alignment.sql` contains the two historical
`reviewed_by`/`reviewed_at` drops that predate this baseline. They are pinned as
the only legacy scanner exceptions and are not precedent for new migrations.
Any exceptional future destructive change requires a separate owner decision,
verified backup/restore, compatibility plan, and baseline revision.

Migration `0033-lawyes-editorial-reports.sql` is specifically asserted as
additive. Its two `DROP TRIGGER IF EXISTS` statements are limited to replacing
append-only triggers on tables created in that same migration (PostgreSQL has no
`CREATE OR REPLACE TRIGGER`); they do not drop customer data, tables, columns,
or schema objects. No other drop operation is allowed by the Task 522 fixture.

## Object storage and environment contracts

Private object paths are configured by `PRIVATE_OBJECT_DIR`; public search roots
use `PUBLIC_OBJECT_SEARCH_PATHS`. The Replit object-storage attachment/bucket
mapping is deployment configuration and must not be changed. Original source
bytes remain private and immutable; database ownership/grant records mediate
access. Deleting, moving, renaming, or making objects public is prohibited
during the upgrade.

Environment variable **names** are inventoried in the fixture. Critical groups
are:

- runtime/data: `DATABASE_URL`, `SESSION_SECRET`, `PORT`, `NODE_ENV`;
- domain/CORS: `LAWYES_PUBLIC_URL`, `REPLIT_DOMAINS`,
  `REPLIT_DEV_DOMAIN`, `CORS_EXTRA_ORIGINS`;
- auth: Clerk keys, staff/admin/master/manager contracts, and Azure client
  contracts;
- billing: Stripe key/webhook contracts and the development-only webhook flag;
- storage: `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`;
- optional integrations: AI, email, voice/SMS and alert contracts.

Names may be documented; values may not. Production must fail closed when a
required signing/auth secret is absent. Development fallbacks must never be
accepted as production readiness evidence.

## Existing feature surface

The landing page retains product discovery, pricing/checkout, sign-in/admin and
contribution entry points. Portals retain their current legal content, AI tools,
matter/client/file/saved-work workflows, deadlines, billing, export and
case-law handoffs. The API retains health/stats, storage and shared uploads,
contributions, personas/assistant, currency, access-code/legacy-code services,
Stripe, portal-specific auth/content/AI/matters/paralegal routes, research
ingestion/editorial/search, and gated subscriber case search. LAWYes additions
must compose with these surfaces rather than replacing them.

## Release regression gate

Before an owner is asked to approve republishing:

1. preservation fixture test passes (domain, artifact paths, route guards,
   evidence suites, and migration scanner);
2. auth/role and rights-gate tests pass;
3. mocked payment-to-access checkout, webhook, reconciliation, login and
   cancellation tests pass with no external call;
4. cross-tenant upload/chat/matter isolation suites pass;
5. custom-domain checkout return and Clerk host-resolution tests pass;
6. portal mount smoke tests and existing document/export tests pass;
7. production typecheck/build and production-secret validation pass;
8. operator compares read-only counts and verifies backup/restore readiness;
9. no browser console errors or accessibility blockers remain;
10. no deployment, custom-domain, secret, Stripe mode/catalog, database, or
    bucket replacement is proposed.

Automated checks are necessary but do not confer production readiness. Publishing
requires explicit user approval.
