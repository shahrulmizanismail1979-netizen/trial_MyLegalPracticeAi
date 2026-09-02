# Drive-to-Pipeline Ingestion Bridge

## What & Why
Drive-discovered assets (stored in `drive_assets`) are not currently connected to the research processing pipeline. This task builds the bridge: for each rights-approved Drive asset, download the file from Google Drive, store it in object storage, register it as a `research_source_container`, and enqueue the full pipeline (ingest → extract → segment → validate → editorial → metadata → search index).

This is the prerequisite for all case law to flow through to headnote generation and portal search.

## Done looks like
- The Research Admin console has a "Run Pipeline" button (or auto-triggers after a Drive inventory run) that enqueues all approved Drive assets that haven't been ingested yet
- Each asset's processing status is visible in the Research Admin Drive Inventory table (columns: ingested, extracted, verified, indexed)
- The existing job queue processes all enqueued jobs; verified judgments appear in `research_verified_judgments` as they complete each stage
- Re-running does not duplicate already-ingested containers (idempotent on Drive file ID)

## Out of scope
- Human review/verification UI for candidates/judgments (existing admin tooling handles this)
- Headnote and catchword generation (separate task)
- Portal-facing API or UI (separate tasks)

## Steps
1. **Download helper** — Add a `downloadDriveFile(fileId)` function using the Google Drive connector that streams the file content and stores it in object storage, returning the storage key and file size.
2. **Ingestion bridge function** — Write `ingestDriveAsset(driveAssetId)` that: checks the asset isn't already ingested (idempotent), downloads via step 1, creates a `research_source_container` row, creates a `research_source_page` for each page (or defers to extraction), and enqueues a `container.ingest` job. Update `drive_assets.processing_status` to `QUEUED`.
3. **Bulk trigger endpoint** — Add `POST /api/research-admin/drive/pipeline/start` that calls `ingestDriveAsset` for every `drive_assets` row with `rights_status = APPROVED` and `processing_status = PENDING`. Returns counts of newly queued vs already queued.
4. **Status sync** — Update `drive_assets.processing_status` as research jobs progress: listen/poll `research_jobs` for job state changes on containers that originate from Drive assets, and mirror: RUNNING → `PROCESSING`, SUCCEEDED (final stage) → `COMPLETED`, FAILED_PERMANENT → `FAILED`.
5. **Admin UI** — Add a "Run Pipeline on Approved Assets" button to the Research Admin Drive Inventory page and show per-asset pipeline status in the table.

## Relevant files
- `artifacts/api-server/src/research/drive/driveClient.ts`
- `artifacts/api-server/src/routes/research-admin.ts`
- `artifacts/research-admin/src/pages/drive-inventory.tsx`
- `lib/db/src/schema/research.ts`
- `artifacts/api-server/src/research/ingestion/service.ts`
