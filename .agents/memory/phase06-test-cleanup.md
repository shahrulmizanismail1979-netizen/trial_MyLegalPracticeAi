---
name: Research test cleanup — validation run orphans
description: Test afterAll cleanup must sweep validation_runs by job ID, not only by container ID, when auto-triggered jobs cross container scopes.
---

## Rule

When a test loop calls `runNextJob()`, it may pick up auto-triggered validation jobs whose containers belong to other test scopes. Claiming a job is not proof of ownership: cleanup must leave those jobs and their validation runs untouched.

**Why:** `startValidation()` fires automatically after every segmentation job (both clean and review-required outcomes), so extra QUEUED jobs appear in the DB beyond what a given test explicitly enqueued. These extra jobs may be dequeued mid-test and create `validation_runs` rows whose `containerId` is outside the test's tracked set.

**How to apply:** Derive cleanup jobs from this run's proven container/batch ownership or exact explicitly-created fixture identities. Delete validation runs only for owned containers; never union globally claimed job IDs into child cleanup. An unreferenced job is not necessarily owned.
