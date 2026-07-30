# Phase 12c Completion Report — Retention & Granular Deletion

**Date:** 2026-07-27  
**Phase:** 12c  
**Status:** COMPLETE

---

## Objective

Implement per-layer deletion for the distinct data layers accumulated per document, producing a generated deletion manifest that is explicit about what was and was not deleted — including the invariant that backup copies are never claimed to have been deleted without separate backup-operator confirmation.

---

## Deliverables

### Database Migration (`0019-phase12c-deletion.sql`)

One new table:

| Table | Purpose |
|---|---|
| `research_deletion_manifests` | Tracks deletion manifest per container: requested_at, actor, layers_requested JSONB, manifest_key (object storage path), created_at |

---

### Deletion Module (`research/retention/deletionService.ts`)

**9 layer kinds:**

| Layer | What is deleted |
|---|---|
| `original_file` | Uploaded file from object storage; stored-artifact reference nullified |
| `page_text` | `research_page_extractions` rows for the container's pages |
| `ocr_images` | OCR intermediate objects from object storage (container + page keyed) |
| `corrected_text` | `research_page_corrections` rows |
| `case_candidates` | `research_case_candidates` + cascade `research_case_candidate_boundaries` |
| `verified_judgment` | `research_verified_judgments` row; container transitioned to DELETED |
| `search_index` | `research_search_index` row for the judgment |
| `ai_output` | `research_ai_propositions` + `research_ai_analysis_runs` for the judgment |
| `temp_files` | Object storage keys matching the container's temp prefix |

Each layer handler is atomic per layer. Failures are collected but do not roll back already-completed layers.

---

### Deletion Manifest

The manifest is a JSON document: `{ containerId, requestedAt, actor, backupConfirmed: false, layers: [{ layer, status, rowsAffected, objectStorageKeys, note }] }`.

**`backupConfirmed` is always `false`** with the fixed note: `"Backup deletion must be confirmed separately by the backup operator."` The manifest never claims backup copies are deleted.

The manifest is stored in object storage under `private/deletion-manifests/{containerId}/{uuid}.json` and its key recorded in `research_deletion_manifests`.

---

### API Routes

- `DELETE /api/research/containers/:id/layers` — accepts `{ layers: LayerKind[] }`; owner/admin only; returns manifest in response
- `GET /api/research/containers/:id/deletion-manifest` — most recent manifest from object storage; owner/admin only

---

### Key Design Decisions

1. **`backupConfirmed: false` is unconditional** — the manifest can never claim backup deletion; this is a structural invariant, not a configurable field.
2. **Partial failure is a valid outcome** — a layer that encounters an error returns `status: "failed"` in the manifest; the API returns 200 with the partial manifest rather than rolling back completed layers (which may already be irreversible).
3. **`not_found` is not a failure** — a layer with no data to delete returns `status: "not_found"`, keeping the manifest complete and predictable.
4. **`RECORD_DELETED` audit events per layer** — each successfully deleted layer emits an audit event with `{ layer, containerId }` but no content text.

---

## Tests (`phase12c.test.ts`)

**15 new tests; 404 total tests across all phases.**

Coverage: original_file layer deleted, manifest returned with correct structure; manifest always contains `backupConfirmed: false`; manifest contains the backup note string; manifest structure fields (containerId, requestedAt, actor, layers array); ai_output layer deletes propositions, runs, and authorities; search_index layer deletes search index row; verified_judgment layer deletes judgment and transitions container to DELETED; case_candidates layer fails when verified_judgment still exists (partial failure); non-owner (researcher) receives 403; GET /deletion-manifest returns most recent manifest; GET /deletion-manifest is owner/admin-only; multiple layers in one call all appear in manifest; layer with no data returns `not_found`; manifest stored in DB, GET returns most recent.

---

## PHASE: 12c | STATUS: complete | CHECKPOINT: 2026-07-27
