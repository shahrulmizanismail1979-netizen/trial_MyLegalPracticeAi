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

## Boundaries

This is a processor schema-availability contract, not full bidirectional
schema synchronization. SQL contains additional checks, generated FTS
vectors, GIN/audit indexes and some cascading foreign-key actions that are
not represented in Drizzle. The FTS vectors intentionally coexist with the
plain `document_text` column; they are not renamed versions of it.
Do not remove these SQL-only objects merely to make the definitions match.
The contract does not assert every SQL check, FK delete action, default,
type or nullability. Historical migrations remain unchanged.

Run with:

```sh
pnpm --filter @workspace/api-server exec vitest run src/research/freshSchemaContract.test.ts src/research/metadataMigration.test.ts
```