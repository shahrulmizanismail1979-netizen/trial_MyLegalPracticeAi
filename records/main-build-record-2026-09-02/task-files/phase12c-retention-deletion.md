# Phase 12c: Retention and Granular Deletion

## What & Why
The platform accumulates several distinct data layers per document: original uploaded file, extracted page text, OCR intermediate images, corrected text, case candidates, verified judgment, search embeddings, AI analysis output, and temporary processing artefacts. Different layers have different retention obligations (e.g. rights holders may require original-file deletion while research use of extracted text continues). Phase 12c implements per-layer deletion with a generated deletion manifest, and enforces the principle that backup confirmation is required before claiming backup copies are deleted.

## Done looks like
- `DELETE /api/research/containers/:id/layers` accepts a body `{ layers: LayerKind[] }` where `LayerKind` is one of `original_file | page_text | ocr_images | corrected_text | case_candidates | verified_judgment | search_index | ai_output | temp_files`.
- Each layer deletion is atomic per layer; failures are collected but do not roll back already-completed layers.
- The response is a **deletion manifest** JSON document: `{ containerId, requestedAt, actor, layers: [{ layer, status: "deleted"|"not_found"|"failed", rowsAffected, objectStorageKeys, note }] }`.
- The manifest explicitly states `backupConfirmed: false` and includes the note: `"Backup deletion must be confirmed separately by the backup operator."` It never claims backup copies are deleted.
- `GET /api/research/containers/:id/deletion-manifest` returns the most recent deletion manifest for a container (owner/admin only).
- Deletion manifests are stored in object storage under a private path and their key recorded in a new `research_deletion_manifests` table (`id`, `container_id`, `requested_at`, `actor`, `layers_requested jsonb`, `manifest_key text`, `created_at`).
- All deletion operations emit `RECORD_DELETED` audit events (via Phase 12a audit infra).
- `phase12c.test.ts`: ≥ 10 tests covering: each layer successfully deleted; manifest structure present and correct; `backupConfirmed: false` always in manifest; partial failure returns `failed` status for the failing layer; non-owner receives 403; `GET` manifest history works.

## Out of scope
- Automated retention-period enforcement / scheduled purges (future)
- Deletion of backup store contents (requires separate operator confirmation outside this system)
- Cross-container bulk deletion
- Audit-log deletion (audit logs are append-only by policy)

## Steps
1. **DB migration** — add `research_deletion_manifests` table: `id serial PK`, `container_id int FK`, `requested_at timestamptz`, `actor text`, `layers_requested jsonb`, `manifest_key text`, `created_at timestamptz default now()`.
2. **Layer deletion service** — create `research/retention/deletionService.ts`. Implement one handler per `LayerKind`:
   - `original_file`: delete the uploaded object from object storage; nullify the stored-artifact reference.
   - `page_text`: delete rows from `research_page_extractions` for the container's pages.
   - `ocr_images`: delete any OCR intermediate objects from object storage (keyed by container + page).
   - `corrected_text`: delete rows from `research_page_corrections` for the container's pages.
   - `case_candidates`: delete `research_case_candidates` + cascade (`research_case_candidate_boundaries`).
   - `verified_judgment`: transition container to `DELETED` state if not already; delete `research_verified_judgments` row.
   - `search_index`: delete `research_search_index` row for the judgment.
   - `ai_output`: delete `research_ai_propositions` + `research_ai_analysis_runs` for the judgment.
   - `temp_files`: delete any object storage keys matching the container's temp prefix.
3. **Manifest generation** — after all layer operations complete, build the manifest object (see Done looks like), store it in object storage under `private/deletion-manifests/{containerId}/{uuid}.json`, insert a row into `research_deletion_manifests`, and return the manifest in the HTTP response.
4. **Audit hooks** — emit `RECORD_DELETED` for each successfully deleted layer with `{ layer, containerId }` metadata (no content text).
5. **Route** — `DELETE /containers/:id/layers` (owner/admin only). `GET /containers/:id/deletion-manifest` returns the most recent manifest JSON from object storage.
6. **Tests** — `phase12c.test.ts`: full lifecycle tests; manifest structure assertions; `backupConfirmed: false` check; 403 for non-owner; partial-failure path (stub one layer to throw, assert status `failed`).

## Relevant files
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/domain/audit.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/data/containers.ts`
- `lib/db/src/schema/research.ts`
- `lib/db/sql/migrations/`
