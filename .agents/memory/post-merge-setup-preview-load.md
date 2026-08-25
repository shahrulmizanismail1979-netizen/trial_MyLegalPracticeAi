---
name: Post-merge setup under preview load
description: Keep automatic merge setup reliable while many portal previews are running.
---

Post-merge setup must avoid a full pnpm relink when the lockfile is unchanged,
and avoid a Drizzle schema push unless the Drizzle schema/config changed. When
a push is required, run Drizzle/esbuild with `GOMAXPROCS=1`.

**Why:** The workspace may have many Vite previews active. Pnpm's linker and
Drizzle's bundled Go tooling can exhaust the shared OS thread budget, causing
otherwise valid merges or service restarts to fail with `EAGAIN`/`newosproc`.

**How to apply:** In the post-merge script, condition the bounded pnpm install
on a `pnpm-lock.yaml` change and the bounded schema push on changes under
`lib/db/src/schema` or its Drizzle config. Portal-owned direct-SQL tables are
ensured by API boot. Restart affected artifact workflows one at a time after
reconciliation.