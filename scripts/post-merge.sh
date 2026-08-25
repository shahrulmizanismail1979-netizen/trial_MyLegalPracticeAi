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
GOMAXPROCS=1 pnpm --filter @workspace/db run push-force
