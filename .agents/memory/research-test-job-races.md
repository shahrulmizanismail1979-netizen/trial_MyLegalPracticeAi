---
name: Research test job-queue races
description: Research proof isolation and safeguards for remaining shared-database tests
---

# Research test job-queue races

Prefer a disposable schema for each proof-test worker, replacing the default database AND pool before service imports. Passing a scoped client only to the queue driver is insufficient: downstream services can use their own default database imports. Never add public to the isolated search path.

Fresh-schema helpers must apply checked-in production migrations, not inline repair DDL.

**Why:** A helper shared by isolation proofs and schema contracts can silently mask a missing migration if a parallel change adds a convenience column/index repair.

**How to apply:** Put missing processor dependencies in additive migrations and include them once in the helper's migration chain; never repair them after applying that chain.

**Why:** Queue claims against a shared database can dispatch another run's fixture to a worker whose in-memory storage does not contain its files. Polling/retrying cannot make that safe. Fresh schemas also expose drift between historical DDL and current service dependencies; include those dependencies rather than falling back to shared tables.

**How to apply:** Use schema isolation for proof suites with private adapters. For legacy shared-database tests not yet isolated, the safeguards below remain relevant, but cannot prevent foreign storage reads.

Model foreign/shared queue fixtures in a second disposable schema, not by planting runnable sentinel jobs in public.

**Why:** A real development worker could claim a public sentinel during the proof, changing shared state or dispatching a synthetic payload to a real adapter.

**How to apply:** Assert the isolated default db and pool agree, exclude public from search_path, and verify that a sibling schema's colliding queued jobs remain unclaimed while the local processor runs.

**Rules for job-driven assertions in research tests:**
- Never assert entity state immediately after a `drainJobs()` call — poll (re-draining each iteration) until the entity settles or a timeout expires.
- Any loop calling `runNextJob()` must tolerate `StateTransitionError` (err.name === "StateTransitionError") — it means a parallel worker purged/finished the claimed job mid-flight, which is harmless.
- Scope audit-event lookups to this run's actor/RUN_ID; the shared DB retains matching events from earlier runs (last-100 scans will match stale rows).

**Why:** these races made `api-tests` validation fail nondeterministically (different file each run) while every file passed in isolation.

- Never purge or park another run's jobs to unblock a test. Stale-job repair must be restricted to proven run-owned fixtures.

- drainSegmentationQueue-style loops that exit when runNextJob() returns null miss the case where a parallel worker is mid-run on your container's job — always follow with a state poll (leave PENDING) + re-drain loop.
- Do not revive dead-lettered fixtures merely to make a test pass; preserve the failure for diagnosis.

## Preserve failure signals in ingestion success tests

Wait for the owned item while its job is queued/running; do not automatically retry failed/dead-lettered jobs unless interference is positively identified. Read item and job state in one database snapshot when diagnosing completion.

**Why:** Unconditional revival can hide real processor defects, and separate reads can falsely combine a stale pending item with a newly completed job.

**How to apply:** Use bounded, item-scoped waits with item/job failure diagnostics; leave the final successful-state and output assertions strict.
