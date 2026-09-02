# Migrate Legacy MyConveyAI User Data

## What & Why
Bring the ~107 existing student accounts (and related data) from the original MYConveyAI project's production database into this project's database, so legacy users can keep logging in (email+password or their existing access codes) on the integrated MyConveyLitAI app.

## Done looks like
- All legacy user rows imported into this project's `users` table with password hashes, access codes, tiers, and grandfathered flags intact.
- A legacy user can log in with email+password on the hosted MyConveyLitAI app.
- No duplicate or clobbered accounts; import is idempotent and reports a summary (imported/skipped counts).
- Prof confirms with a spot-check login.

## Out of scope
- Migrating AI conversation history unless the export includes it and Prof wants it.
- Changes to auth logic (done in the integration task).

## Steps
1. Ask Prof to export the data from the old project (provide exact instructions: SQL dump or CSV of the `users` table — and optionally `conversations`/`messages`/`ai_usage` — from the old project's production database).
2. Build an idempotent import script in the workspace `scripts` package that validates rows, preserves password hashes and access codes exactly, skips existing accounts, and logs a summary.
3. Run the import against the development database first, verify counts and a test login, then plan the production import (run against prod DB only with Prof's explicit go-ahead).
4. Verify: legacy login works both by email+password and by access code; admin user list shows the imported accounts.

## Relevant files
- `scripts/src`
- `lib/db/src/schema/index.ts`
