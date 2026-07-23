# ADR 0004 — Phase 03: Secure Upload, Container Inventory & Failure Isolation

Date: 2026-07-23
Status: Accepted

## Context

Phase 03 (Ingestion, see `docs/PHASES.md`) adds real file intake to the
platform. Until now containers were registered by metadata only. Ingestion
must uphold the source-container model (a file is a container, never
automatically a case), full provenance, hostile-input safety, and the Phase 02
deny-by-default access rules — while a single bad file must never take down a
batch.

## Decisions

### 1. Upload pipeline: stage first, register via resumable jobs

Uploads (single file, multiple files, or ZIP archives) arrive at a role-gated
multipart endpoint. The route performs only synchronous, content-neutral work:

1. **Validate** each logical file with the pure validation core
   (`src/research/ingestion/validation.ts`). Rejections are recorded as batch
   items in state `REJECTED` with a machine-readable error report — never
   thrown away silently.
2. **Stage** accepted bytes byte-for-byte to private object storage under a
   per-item key. Bytes are never modified.
3. **Enqueue** one `container.ingest` job per accepted item. Registration
   (SHA-256 dedup check, container creation, rights-review routing) happens in
   the resumable job runner, so it is idempotent and retryable.

`container.ingest` is registered with `touchesContent: false`: it registers a
container and routes it to rights review, but never interprets content.
Content interpretation (inventory) is a separate, rights-gated job.

### 2. Batch model with per-item failure isolation

New tables:

- `research_upload_batches` — one row per upload submission; carries declared
  source, uploader, and provenance.
- `research_upload_batch_items` — one row per logical file (a ZIP expands into
  many items). Item states: `PENDING → INGESTED | DUPLICATE | REJECTED |
  DEAD_LETTER | CANCELLED`, with `DEAD_LETTER → PENDING` (retry) and
  `CANCELLED → PENDING` (restart). Item transitions are guarded and audited
  like every other state change.

**Dead-lettering stays at the batch-item level.** The Phase 01 job machine is
golden-pinned at exactly 8 states with `SUCCEEDED`/`FAILED_PERMANENT`/
`CANCELLED` terminal; we do not widen it. Instead, when an item's ingest job
ends `FAILED_PERMANENT`, a sync step moves the item to `DEAD_LETTER` and
copies the job's structured failure reason into the item's per-file error
report. Retrying a dead-lettered item enqueues a *new* job under a new
idempotency key (attempt-suffixed), preserving the terminal semantics of the
old job while making the batch fully recoverable.

### 3. Duplicate detection flags, never re-ingests

An item whose SHA-256 matches an existing container becomes `DUPLICATE`,
records `duplicate_of_container_id`, and writes a transformation — no second
container is created and no bytes are re-registered. The staged copy remains
addressable from the item for audit.

### 4. Validation core is pure and exhaustive

`validation.ts` has no I/O and no DB access. It checks:

- magic bytes (file signature) vs extension vs claimed MIME agreement;
- supported formats only: PDF, DOCX, RTF, HTML, TXT, PNG, JPG, TIFF, ZIP;
- per-file size caps;
- executable masquerading (MZ/ELF/Mach-O/shebang payloads);
- ZIP safety: total uncompressed cap, expansion-ratio cap, entry-count cap,
  nested archives (rejected), path traversal / absolute paths, duplicate
  normalized paths, encrypted entries, corrupt central directories.

Every rejection is `{ code, message }` — machine-readable, logged without
content.

### 5. Inventory is a diagnostic, rights-gated content job

`container.inventory` (`touchesContent: true`, so the Phase 02 processor
rights re-check applies) runs only after a rights decision permits processing,
via `RIGHTS_APPROVED → INVENTORY_PENDING → INVENTORIED`. It reads the stored
bytes (storage adapter gains a `get()`), analyses them non-destructively, and
writes one row to `research_container_inventories`: file type, page count
where available, text-vs-scan estimate, probable OCR requirement, probable
case-title-region count, repeated header/footer lines, commercial-source
markers, blank/damaged page estimates, probable multi-case status, and exactly
one diagnostic label:

`EMPTY_OR_INVALID | SINGLE_CASE_POSSIBLE | MULTI_CASE_POSSIBLE |
MIXED_CONTENT_POSSIBLE | OCR_REQUIRED | MANUAL_INSPECTION_REQUIRED`

Labels are diagnostic only. No case records are created (Phase 05), and no
OCR/extraction is performed (Phase 04). Commercial markers or
manual-inspection labels additionally open a review item — uncertainty is
routed to humans, never guessed.

### 6. Provenance

Every container registered through ingestion records: uploader identity,
upload time, declared source, batch and item ids, original path (including
path inside a ZIP), SHA-256, byte size, MIME type, and storage locator.
Rights status starts `UNREVIEWED` and the container is immediately routed to
the rights-review queue.

## Consequences

- The job state machine and its golden files are untouched.
- Batches are cancellable, restartable, and observable (progress counts per
  item state) without any new daemon: syncing dead letters happens on read
  and on demand.
- Migration `lib/db/sql/migrations/0004-phase03-ingestion.sql` is additive
  and idempotent; applied with psql like 0003.
