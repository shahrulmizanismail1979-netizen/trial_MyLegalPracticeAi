# Phase 03: Secure Upload, Container Inventory & Failure Isolation

## What & Why
Implement Phase 03 (Ingestion) of the Judgment Research Platform: secure upload of individual files, multiple files, folder uploads (as multi-file batches), and ZIP archives. Every accepted upload becomes a `source_container` — never automatically a case (source-container principle). Includes hostile-input validation, full provenance, a non-destructive inventory/triage pass with diagnostic classifications, and batch processing where one failed file never terminates the batch. All work stays behind the Phase 02 auth/roles/rights gates, follows `docs/BUILD_PROMPT.md`, and ends with `docs/reports/phase-03-completion.md` plus an updated `docs/status/current-phase.json`.

## Done looks like
- Authorized staff (roles permitted to upload) can submit single files, multiple files, or ZIP archives; each accepted file becomes an `UNREVIEWED` source container with the original bytes stored unchanged in private object storage.
- Supported formats: PDF, DOCX, RTF, HTML, TXT, PNG, JPG, TIFF, and ZIP containing supported files.
- Uploads are validated: MIME type, extension, file signature (magic bytes), size limits, archive structure, expansion ratio, nested-archive depth, unsafe/duplicate paths, executable masquerading, corrupted content. Malicious archives (ZIP bombs, path traversal, disguised executables) are rejected with recorded reasons.
- Every container records full provenance: internal ID, original filename, byte size, MIME type, SHA-256, uploader, upload time, declared source, rights status (UNREVIEWED), storage locator, processing status.
- Duplicate uploads (same SHA-256) are detected and flagged, not silently re-ingested.
- An inventory job produces per-container diagnostics: file type, page count where available, text vs scan, probable OCR requirement, probable case-title-region count, repeated header/footer patterns, possible commercial-source markers, blank/unreadable/damaged pages, probable multi-case status — plus one diagnostic label from EMPTY_OR_INVALID / SINGLE_CASE_POSSIBLE / MULTI_CASE_POSSIBLE / MIXED_CONTENT_POSSIBLE / OCR_REQUIRED / MANUAL_INSPECTION_REQUIRED. Labels are diagnostic, never final findings; no case records are created.
- Batch ingestion isolates failures: a failed file is dead-lettered with a per-file error report while the rest of the batch completes; jobs support progress, retry, cancellation, restart, and dead-letter status (extending the existing resumable job runner).
- Synthetic fixtures exist for: one-case, five-case, thirty-case containers, blank pages, corrupt pages, repeated pages, nested ZIPs, unsafe ZIP paths, misleading filenames. No real restricted documents are used.
- All existing 89 tests remain green; new validation/ingestion/inventory tests pass; full typecheck passes; completion report written with PASS/PARTIAL/BLOCKED status and the PHASE:/STATUS:/CHECKPOINT: response format.

## Out of scope
- Text extraction/OCR execution and character-level span provenance (Phase 04) — inventory only estimates OCR need.
- Case-candidate segmentation and case creation (Phase 05).
- Duplicate/version consolidation (Phase 06).
- Search, research UI beyond a minimal upload/queue surface, and any AI processing (Phases 07–08). External AI remains disabled.
- Sending any document to an external service.

## Steps
1. **Decision record & schema** — Write ADR 0004 for the ingestion design; extend the DB schema (upload batches, batch items with per-file status/error, container inventory results, dead-letter fields as needed) via an additive migration; test applying the migration and booting against the migrated database.
2. **Validation core** — Build a pure, well-tested validation module: magic-byte/extension/MIME agreement, size caps, ZIP safety (expansion ratio, nesting depth, path traversal, duplicate paths, executable detection), and corruption checks; every rejection carries a machine-readable reason.
3. **Upload & registration endpoints** — Role-gated upload routes for single/multi-file and ZIP submission that stage original bytes byte-for-byte to private object storage, compute SHA-256, detect duplicates, and register UNREVIEWED containers with full provenance; deny-by-default access rules from Phase 02 apply (per-container checks, 404-not-403, restriction-aware filters).
4. **Batch jobs with failure isolation** — Ingestion and inventory run through the existing resumable job runner, extended with batch progress, per-item retry, cancellation, restart, and dead-letter status; a content-touching job without rights clearance still fails closed.
5. **Inventory analyzer** — Non-destructive per-container inventory (format probing, page counts, text-vs-scan heuristics, header/footer repetition, commercial-source markers, blank/damaged page detection) producing the six diagnostic labels; results stored with provenance, never mutating the original file.
6. **Fixtures & tests** — Generate the required synthetic fixture set (including hostile ZIPs built programmatically in tests, not committed as binaries where avoidable); add unit + integration tests covering every acceptance criterion; run the full api-tests suite and typecheck.
7. **Minimal review-queue surface & close-out** — Expose container/batch listing for the rights-review queue via existing role-gated routes; browser-test any UI touched; write `docs/reports/phase-03-completion.md`, update `docs/status/current-phase.json`, and finish with architect review and the required response format.

Note: preserve all Phase 02 invariants — deny-by-default access, absolute rights-status caps, append-only audit, fail-closed processors, and no mock implementations in production code.

## Relevant files
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/processing/queue.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/data/containers.ts`
- `artifacts/api-server/src/research/storage/objectStorageAdapter.ts`
- `artifacts/api-server/src/research/testing/fixtureFactory.ts`
- `lib/db/src/schema/research.ts:118-141`
- `docs/PHASES.md`
- `docs/BUILD_PROMPT.md`
- `docs/status/current-phase.json`
- `fixtures/synthetic`
