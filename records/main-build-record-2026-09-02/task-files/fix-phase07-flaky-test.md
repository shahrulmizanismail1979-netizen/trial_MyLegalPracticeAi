# Fix phase07 runNextJob race condition

## What & Why
The `phase07.test.ts` editorial-processor test fails intermittently when the full test suite runs together. The retry loop calls `runNextJob()` with no kind filter, so it can claim jobs from other test files (phase09, phase10, etc.) before claiming the editorial classification job it actually needs. After 15 stolen claims the retry budget exhausts and the container never transitions to `JUDGMENT_VERIFICATION_PENDING`.

The fix is a single-line change: pass `"container.editorial_classify"` as the kind argument to every `runNextJob()` call inside phase07's retry loop. `runNextJob(kind)` already supports this filter — it just isn't used.

## Done looks like
- `phase07.test.ts` passes consistently in the full suite across multiple back-to-back validation runs
- No other test files are affected

## Out of scope
- Changes to any production code (processors, routes, DB schema)
- Fixing other test files (only phase07 has this problem)

## Steps
1. **Pass kind filter to runNextJob** — In the retry loop at line ~955 of `phase07.test.ts`, change `runNextJob()` to `runNextJob(EDITORIAL_JOB_KIND)`. Import `EDITORIAL_JOB_KIND` from the editorial processor module (already available in the file via `startEditorialClassification`).
2. **Verify** — Run the full test suite three consecutive times and confirm 325/325 pass every time.

## Relevant files
- `artifacts/api-server/src/research/phase07.test.ts:929-975`
- `artifacts/api-server/src/research/isolation/editorialProcessor.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
