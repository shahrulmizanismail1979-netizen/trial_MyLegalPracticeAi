---
name: drizzle push rename trap
description: drizzle-kit push may propose renaming unrelated existing tables when adding new ones — create new tables via direct SQL instead
---

Rule: generic Drizzle push is not a safe synchronization mechanism for this
mixed SQL/ORM database, even for a change to an unrelated portal. Research SQL
owns physical safeguards intentionally missing from the query declarations.

**Why:** push has proposed destructive unrelated-table renames. A disposable-schema
probe also demonstrated removal of candidate idempotency, generated FTS columns
and indexes, audit indexes, checks and workspace cascades. `--force` is not protection.

**How to apply:** use reviewed additive SQL for development changes and verify
against disposable schemas first. Do not restore automatic post-merge pushes or
bypass command guards. Keep ORM query declarations useful without treating their
omissions as permission to remove SQL-owned objects. Managed production propagation
uses Publish, not custom migration runners.
