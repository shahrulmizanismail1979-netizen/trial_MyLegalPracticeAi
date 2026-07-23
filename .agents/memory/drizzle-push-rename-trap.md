---
name: drizzle push rename trap
description: drizzle-kit push may propose renaming unrelated existing tables when adding new ones — create new tables via direct SQL instead
---

Rule: do not run `pnpm --filter @workspace/db run push` to create brand-new tables in this monorepo; apply `CREATE TABLE` via direct psql instead, keeping the drizzle schema file as the source of truth.

**Why:** push interactively proposed renaming existing `firm_*` tables to new `research_*` tables (destructive), instead of creating them fresh. Accepting would have destroyed unrelated data.

**How to apply:** whenever adding new tables (e.g. the `research_*` set), write the schema in `lib/db/src/schema/`, then create tables with hand-written SQL matching it; verify with `\d` in psql.
