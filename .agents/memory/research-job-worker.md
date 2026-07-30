---
name: Research background job worker
description: The research pipeline requires an explicit background polling loop; it does not run automatically without one.
---

The research pipeline uses a DB-backed job queue (`research_jobs`). Processors (ingest, extract, segment, validate, editorial, metadata, search-index, analysis) register themselves, but `runNextJob()` must be called in a polling loop — it does not self-start.

**The fix:** a `startResearchJobWorker()` loop was added to `artifacts/api-server/src/index.ts`. It:
- Calls all `registerXxxProcessor()` functions at startup (all are idempotent)
- Loops calling `runNextJob()` — immediate retry if work found, 2 s sleep if queue empty, 5 s sleep on error
- Starts after `app.listen` as a best-effort void promise (never crashes the server)

**Why:** without the loop, jobs sit QUEUED indefinitely. Pilot scripts (`pilot-pipeline.ts`, `pilot-upload.ts`) called `runNextJob()` manually but these don't run in production.

**How to apply:** any time you see `container.ingest` (or other research) jobs stuck QUEUED, check that the worker loop is running. If the server restarts and the loop crashes, jobs will pile up silently until the next restart.
