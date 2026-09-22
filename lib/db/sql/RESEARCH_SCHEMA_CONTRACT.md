# Research fresh-schema contract

`artifacts/api-server/src/research/freshSchemaContract.test.ts` applies the
research bootstrap plus research-only additive migrations in a disposable
schema with no `public` search-path fallback. It compares all tables exported
by `lib/db/src/schema/research.ts` (including Drive and LAWYes) to PostgreSQL.
No application boot repair or test-only table/index DDL is used.

The contract covers declared columns, primary/single-column unique keys,
unique constraints, declared indexes by ordered columns/uniqueness/method,
foreign-key endpoints, and SQL-only candidate idempotency, FTS and audit
indexes. It also exercises the search processor's conflict target and checks
that reapplying the practice-area migration preserves existing rows.

## Audit findings

- Search `practice_area` and its index were supplied only by the runtime
  search adapter's ensure function, not by SQL migrations. Migration 0045
  supplies both additively; it neither deletes data nor reclassifies old rows.
- Metadata uniqueness is already supplied by migration 0044.
- Bookmark and duplicate-link uniqueness are already supplied by inline
  constraints in 0014. Their names differ from Drizzle's index names; adding
  duplicate indexes would not improve the conflict contract.
- Authorities and legislation `(run_id, proposition_id)` keys are already
  supplied by 0017. Headnotes/Drive dependencies are supplied by 0038.
- The bootstrap's candidate partial unique key is present and must stay:
  `(run_id, container_id, start_page_id) WHERE start_page_id IS NOT NULL`.

## Schema synchronization policy

Research SQL is authoritative for physical database objects. Drizzle research
declarations describe application queries; they are **not** a complete desired
database state. Generic `drizzle-kit push` is therefore unsafe for this mixed
schema, including when a change is to an unrelated portal.

The installed push engine proposes dropping the candidate partial unique index,
both generated search vectors and their GIN indexes, and the three audit indexes;
it also replaces workspace collection cascades with `NO ACTION`. A column rename
prompt is not a safe solution: `document`, `document_ms`, and `document_text` are
three distinct columns. The probe also confirms removal of the undeclared
annotation-kind CHECK constraint.

Protection is explicit rather than duplicating SQL definitions:

- `@workspace/db` scripts `push` and `push-force` fail closed before connecting.
- `drizzle.config.ts` rejects direct configured push invocations as well.
- Post-merge setup never pushes the schema. This applies to **all** tables because
  a full-schema diff triggered by another portal can still damage research.
- There is no environment-variable override. Do not bypass this policy with a
  custom config or the raw Drizzle push API.

To evolve the development database, write and review an additive SQL migration,
test it in a disposable schema first, then apply the reviewed SQL in development.
Changing only a Drizzle declaration no longer applies any DDL automatically.
Managed production propagation remains the platform Publish flow, not a custom
migration runner or startup hook. Inspect that flow's proposed changes as well;
this guard protects repository commands, not external tools or arbitrary SQL.
Never rewrite historical migrations or create duplicate indexes to match an
inline UNIQUE constraint's name.

`schemaPushProtection.test.ts` obtains a **plan only** from the installed raw
push engine against representative tables in a disposable schema; it never
applies the destructive plan. It exercises package/direct-command guards with
an unreachable dummy database endpoint, snapshots the disposable SQL catalog,
reapplies migrations 0008/0014/0018/0019 there, and verifies real candidate retries,
FTS generation/update, invalid-value rejection, workspace cascades and inline
unique keys. It does not modify shared rows.

## Boundaries

The fresh-schema test is a processor schema-availability contract, not full
bidirectional schema synchronization. SQL contains additional checks, generated FTS
vectors, GIN/audit indexes and some cascading foreign-key actions that are
not represented in Drizzle. The FTS vectors intentionally coexist with the
plain `document_text` column; they are not renamed versions of it.
Do not remove these SQL-only objects merely to make the definitions match.
The contract does not assert every SQL check, FK delete action, default,
type or nullability. Historical migrations remain unchanged.

Run with:

```sh
pnpm --filter @workspace/api-server exec vitest run src/research/freshSchemaContract.test.ts src/research/metadataMigration.test.ts
pnpm --filter @workspace/api-server exec vitest run src/research/schemaPushProtection.test.ts
```