# Phase 03 Completion Report — Secure Upload, Container Inventory & Failure Isolation

- **Phase**: 03 (Ingestion)
- **Date**: 2026-07-23
- **Status**: PASS

## Objective

Implement secure upload of single files, multi-file batches, and ZIP
archives; hostile-input validation; full provenance for every accepted
container; a non-destructive inventory/triage pass with diagnostic
classifications; and batch processing where one failed file never
terminates the batch. All behind the Phase 02 deny-by-default
auth/roles/rights gates. Every accepted file becomes a `source_container`
— never automatically a case.

## Implementation Summary

1. **Decision record & schema** — ADR 0004
   (`docs/decisions/0004-phase-03-ingestion.md`). Additive migration adds
   `research_upload_batches`, `research_upload_batch_items` (per-item
   state machine PENDING → INGESTED / DUPLICATE / REJECTED / DEAD_LETTER /
   CANCELLED, per-item `error_report`, attempt counter, job linkage) and
   `research_container_inventory` (append-only diagnostics with
   provenance). Audit `entityType` vocabulary widened to include
   `upload_batch` / `batch_item`.
2. **Validation core** — `research/ingestion/validation.ts`: pure,
   machine-readable rejections. Magic-byte sniffing vs extension vs
   declared MIME agreement; size caps; ZIP safety (expansion ratio,
   nested-archive detection both by name and by disguised bytes, path
   traversal ⇒ `UNSAFE_PATH`, duplicate paths ⇒ `DUPLICATE_PATH`,
   executable masquerading, corrupt-content probes ⇒ `CORRUPT_FILE`).
   Whole-archive rejection for hostile ZIP structure; per-entry rejection
   for bad entries inside an otherwise sound archive.
3. **Upload endpoints** — `research/routes/uploads.ts` (multer in-memory,
   50 MB / 25 files, roles owner / administrator / rights_reviewer):
   `POST /api/research/uploads` (single/multi/ZIP with per-entry
   expansion), `GET /uploads`, `GET /uploads/:id` (progress + dead-letter
   sync), plus per-batch retry / cancel / restart. Original bytes staged
   byte-for-byte to private object storage; SHA-256 computed server-side;
   duplicates flagged as `DUPLICATE` (never silently re-ingested);
   containers registered `UNREVIEWED` with full provenance.
4. **Batch jobs with failure isolation** — per-item `container.ingest`
   jobs through the existing resumable runner; a failed item dead-letters
   with a per-file error report while the rest of the batch completes.
   Progress (`computeProgress` state counts), retry, cancel, and restart
   are idempotent. Content-touching jobs without rights clearance still
   fail closed (`BLOCKED_BY_RIGHTS`).
5. **Inventory analyzer** — `research/ingestion/inventory.ts`:
   non-destructive `container.inventory` job (rights-gated,
   `touchesContent: true`). Verifies stored bytes against the registered
   SHA-256 before analysis (tamper ⇒ `CHECKSUM_MISMATCH` dead-letter).
   Produces file type, page count where available, text-vs-scan and OCR
   heuristics, case-title-region count, repeated header/footer patterns,
   commercial-source markers, blank/damaged page detection, and exactly
   one diagnostic label from EMPTY_OR_INVALID / SINGLE_CASE_POSSIBLE /
   MULTI_CASE_POSSIBLE / MIXED_CONTENT_POSSIBLE / OCR_REQUIRED /
   MANUAL_INSPECTION_REQUIRED. Results stored append-only with a recorded
   `inventory` transformation; uncertain labels and commercial markers
   route a review item. No case records are created.
6. **Review-queue surface** — `GET /api/research/review-items`
   (role-gated, per-item view filter, `?status=resolved`),
   `POST /containers/:id/inventory` (403 on rights denial for operators),
   `GET /containers/:id/inventory`.

## Fixtures (all synthetic, `fixtures/synthetic/`)

`single-judgment.txt` (pre-existing), `five-case.txt`, `thirty-case.txt`,
`repeated-headers.txt`, `blank-pages.txt`, `commercial-marked.txt`.
Hostile ZIPs (nested archives, disguised archive bytes, path traversal,
duplicate paths, executable masquerading) are built programmatically in
tests — no hostile binaries are committed.

## Proof tests

| Acceptance criterion | Test |
|---|---|
| Role-gated single/multi/ZIP upload, UNREVIEWED containers, byte-identical storage | `phase03.test.ts` upload suite |
| Hostile-input rejection with recorded reasons | `ingestion/validation.test.ts` (17 tests: traversal, duplicates, nesting, disguised bytes, executables, corruption, expansion ratio) |
| Full provenance per container | `phase03.test.ts` provenance assertions |
| SHA-256 duplicate flagging, never silent re-ingest | `phase03.test.ts` duplicate suite |
| Inventory diagnostics + six labels, no case creation | `phase03.test.ts` inventory suite (single/five/thirty-case, blank, commercial-marked, OCR) |
| Failure isolation: dead-letter one file, batch completes; progress/retry/cancel/restart | `phase03.test.ts` batch-isolation suite (injected staging failure, tampered bytes) |
| Rights gating preserved (fail-closed processors, 403/404 semantics) | `phase03.test.ts` rights suite (`BLOCKED_BY_RIGHTS`, premature inventory blocked) |

## Verification

- Full api-server suite: **16 files, 125 tests, all passing** (89
  pre-existing tests remain green; 36 new).
- `pnpm run typecheck`: clean across the workspace.
- Migration applied to the dev database; server boots against it.

## Invariants preserved

Deny-by-default access, absolute rights-status caps, append-only audit,
fail-closed content-touching processors, source-container principle (no
case records created), judicial-text integrity (originals immutable;
inventory is read-only), no external AI calls, no mocks in production
code, synthetic fixtures only.

## Out of scope (deferred as planned)

Text extraction/OCR execution (Phase 04), case-candidate segmentation
(Phase 05), duplicate/version consolidation (Phase 06), search/AI
(Phases 07–08).
