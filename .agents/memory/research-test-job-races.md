---
name: Research test job-queue races
description: Parallel vitest workers share the live research job queue; how to write drain/assert logic that survives job stealing and purges
---

# Research test job-queue races

Parallel vitest workers all poll the same live `research_jobs` table, so any worker's `runNextJob()` can claim another test file's job, and test helpers that force-fail "stale" RUNNING jobs can purge a job another worker is executing.

**Rules for job-driven assertions in research tests:**
- Never assert entity state immediately after a `drainJobs()` call — poll (re-draining each iteration) until the entity settles or a timeout expires.
- Any loop calling `runNextJob()` must tolerate `StateTransitionError` (err.name === "StateTransitionError") — it means a parallel worker purged/finished the claimed job mid-flight, which is harmless.
- Scope audit-event lookups to this run's actor/RUN_ID; the shared DB retains matching events from earlier runs (last-100 scans will match stale rows).

**Why:** these races made `api-tests` validation fail nondeterministically (different file each run) while every file passed in isolation.

- Cross-worker purges must park competitors in a state the owner can recover from; each worker must re-queue its own job if a competitor parked it, or tests strand jobs and time out.
