#!/bin/bash
set -e
# Task merges can reconcile while the portal previews are running. A code-only
# merge does not need a relink, and skipping that work avoids pnpm's worker
# pool competing with the previews. Dependency changes update the lockfile and
# still get a bounded, non-interactive install.
if git diff --quiet HEAD^ HEAD -- pnpm-lock.yaml; then
  echo "No lockfile changes; skipping dependency relink."
else
  pnpm install --frozen-lockfile --child-concurrency=1 --network-concurrency=1
fi
# Do not reconcile this mixed SQL/ORM schema with Drizzle push, even --force.
# Research has SQL-owned generated columns, indexes, checks and FK actions.
# Schema changes require reviewed additive SQL in development; managed
# production schema propagation remains the platform Publish flow.
echo "Automatic schema push disabled; see lib/db/sql/RESEARCH_SCHEMA_CONTRACT.md."
