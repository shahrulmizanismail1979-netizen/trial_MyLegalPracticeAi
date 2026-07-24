---
name: Phase 06 test cleanup isolation
description: afterAll cleanup must query validation_runs by both containerId and trackedJobIds to handle auto-triggered jobs picked up outside the current test's container scope.
---

## Rule

In the phase06 `afterAll` cleanup, step 3 (delete validation runs) must query `researchValidationRuns` by **both** `containerId IN (trackedContainerIds)` and `jobId IN (trackedJobIds)`, then merge and deduplicate.

**Why:** `startValidation()` is now auto-triggered after every segmentation job (both clean and review-required outcomes). This creates extra QUEUED validation jobs in the DB. When test loops call `runNextJob()`, they may pick up these auto-triggered jobs for containers belonging to _other_ test scopes (different vitest describe blocks running in parallel, or previous runs). These jobs get pushed into `trackedJobIds` but their containers are NOT in `trackedContainerIds`. When the loop then runs those jobs and validation_runs are created, a containerId-only cleanup query misses them — leaving orphaned validation_run rows that block the final `DELETE FROM research_jobs`.

**How to apply:** Whenever a test loop calls `runNextJob()` and pushes job IDs to a tracked list, the cleanup for those jobs must also sweep any validation_runs keyed by those job IDs, not only by containerId.
