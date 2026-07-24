---
name: Research test cleanup — validation run orphans
description: Test afterAll cleanup must sweep validation_runs by job ID, not only by container ID, when auto-triggered jobs cross container scopes.
---

## Rule

When a test loop calls `runNextJob()`, it may pick up auto-triggered validation jobs whose containers belong to other test scopes. Cleaning up only by `containerId` leaves orphaned `validation_runs` rows that block the final `DELETE FROM research_jobs`.

**Why:** `startValidation()` fires automatically after every segmentation job (both clean and review-required outcomes), so extra QUEUED jobs appear in the DB beyond what a given test explicitly enqueued. These extra jobs may be dequeued mid-test and create `validation_runs` rows whose `containerId` is outside the test's tracked set.

**How to apply:** Any test that calls `runNextJob()` in a loop and tracks job IDs must delete `validation_runs` keyed by those job IDs (union with the container-scoped set) before deleting jobs and containers.
