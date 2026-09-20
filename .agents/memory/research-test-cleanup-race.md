---
name: Research test cleanup FK race & job stealing
description: Parallel vitest workers share the live research job queue — they steal each other's jobs mid-test and repopulate tables mid-cleanup
---

All research test files use the live DB and one shared `research_jobs` queue. Parallel workers' `runNextJob()` loops freely claim OTHER files' queued jobs. Two failure families:

1. **Cleanup FK violations**: another worker processes this file's queued validation/editorial/cross-file jobs *during* afterAll, re-inserting child rows (coherence checks, editorial runs, page sections, verified judgments, transformations, candidate boundaries) between a child-delete and its parent-delete.
2. **Mid-test flakes**: a stolen job means `runNextJob()` returns null / drain returns early while the job is still running elsewhere — asserts on state/pages/batch items see stale data; `cancelBatch` may find items already INGESTED; `startValidation` can return null jobId on an idempotency-key race.

**How to apply:**
- At cleanup start, DELETE this file's still-QUEUED jobs by `payload->>'containerId'`.
- Wrap every FK-sensitive parent delete (candidates, case boundaries, validation runs, jobs, containers, pages) in a retry loop (~5 × 1s) that re-queries and re-clears ALL FK holders on failure.
- Never use globally claimed job IDs as cleanup authority, even if unreferenced. Derive jobs from proven run-owned batches/containers or explicit fixture identities; never clear foreign batch-item links to make deletion succeed.
- After drain loops, poll (≈15s) for the expected state instead of asserting immediately; tolerate "already done by another worker" outcomes.
