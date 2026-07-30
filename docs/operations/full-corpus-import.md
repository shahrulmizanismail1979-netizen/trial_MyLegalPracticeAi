# Full-Corpus Import Procedure — Judgment Research Platform

**Audience:** Administrators and owners  
**Last updated:** 2026-07-30

---

## ⚠️ Pre-Conditions — All Must Be Met Before Starting

Do not begin full-corpus import unless every item on this checklist is confirmed:

| # | Pre-condition | Confirmed by |
|---|--------------|-------------|
| 1 | **Pilot acceptance gate has passed** — `pilot-report.md` shows ✅ for all 7 conditions | Platform owner |
| 2 | **Task #7 resolved** — Upload submitter binding implemented and verified | Developer |
| 3 | **Task #21 assessed** — Cross-subscriber chat isolation documented | Developer |
| 4 | **Task #87 closed** — Job-stealing test coverage in place | Developer |
| 5 | **Pilot human-review sign-off** — A legal reviewer has inspected and approved the pilot candidates | Legal reviewer |
| 6 | **Database backup taken and verified** — Follows backup-and-restoration.md §2 | Administrator |
| 7 | **All operational manuals read** — Administrator, staff ingestion, rights-review, and segmentation-review manuals read by all operators | All operators |
| 8 | **Capacity confirmed** — Stress test results reviewed for the anticipated corpus size | Administrator |

**If any pre-condition is not met, stop and resolve it first. Document who confirmed each item and when.**

---

## 1. Corpus Preparation

### 1.1 Organise source files into batches

The recommended batch size is **50–100 containers per batch**. Smaller batches:
- Allow monitoring of each stage before committing the next
- Make it easier to pause if a problem is found
- Reduce the blast radius of any processing error

Batch naming convention: `corpus-v1-batch-001`, `corpus-v1-batch-002`, etc.

### 1.2 Validate rights for each batch before upload

Before uploading a batch, confirm:
- The source of every file in the batch is documented
- Written licences or permissions are on file for commercial-source material
- Court-sourced files have a provenance record (URL, date, court)

Rights review is mandatory and must be completed before extraction begins. Do not upload a batch and then "worry about rights later."

---

## 2. Upload Procedure

### 2.1 Generate a pilot corpus (optional, for validation)

The corpus generator script produces synthetic test documents and can be used to validate the import pipeline before live documents:

```bash
pnpm --filter @workspace/scripts exec tsx ./src/generate-pilot-corpus.ts \
  --batch=corpus-v1-batch-001 \
  --output=/tmp/corpus-batch-001/
```

### 2.2 Upload a batch

```
POST /api/research/uploads
Content-Type: multipart/form-data
Body:
  files[] = <file1>, <file2>, ...  (up to 25 per request)
  source_batch = "corpus-v1-batch-001"
```

For batches larger than 25 files, split into multiple upload requests with the same `source_batch` label.

### 2.3 Monitor upload progress

```
GET /api/research/uploads?batch=corpus-v1-batch-001
```

Wait for all items to reach `INGESTED` or `DUPLICATE` before proceeding. Investigate any `DEAD_LETTER` items before continuing.

---

## 3. Rights Review for Each Batch

After upload, every container is `UNREVIEWED` and blocked. A rights reviewer must process each container.

**Target:** Clear all rights-review items for the batch before triggering extraction. Do not let UNREVIEWED containers accumulate across multiple batches.

Monitor the rights queue:
```
GET /api/research/review-items?status=open
```

---

## 4. Monitoring Checkpoints

After each batch, before starting the next one, verify these checkpoints:

### Checkpoint A — After upload

```sql
SELECT state, COUNT(*) FROM research_upload_batch_items
WHERE batch_id IN (
  SELECT id FROM research_upload_batches 
  WHERE source_batch LIKE 'corpus-v1-batch-001%'
)
GROUP BY state;
```
Expected: all `INGESTED` or `DUPLICATE`. Zero `DEAD_LETTER`.

### Checkpoint B — After rights review

```sql
SELECT rights_status, COUNT(*) FROM research_source_containers
WHERE source_batch = 'corpus-v1-batch-001'
GROUP BY rights_status;
```
Expected: no `UNREVIEWED`. All cleared to a permissive or explicitly restrictive status.

### Checkpoint C — After extraction

```sql
SELECT processing_state, COUNT(*) FROM research_source_containers
WHERE source_batch = 'corpus-v1-batch-001'
GROUP BY processing_state;
```
Expected: no `EXTRACTION_PENDING`. `OCR_REVIEW_REQUIRED` containers need OCR review before continuing.

### Checkpoint D — After segmentation

All containers should be in `SEGMENTATION_REVIEW_REQUIRED` or beyond. Containers still in `SEGMENTATION_PENDING` after 2 hours indicate a stuck job — check the queue.

### Checkpoint E — After human review

```sql
SELECT processing_state, COUNT(*) FROM research_source_containers
WHERE source_batch = 'corpus-v1-batch-001'
GROUP BY processing_state;
```
Expected: containers in `VERIFIED` or `SEARCHABLE`. Containers still in `*_REVIEW_REQUIRED` need reviewer attention.

---

## 5. Pausing and Resuming

### To pause the import

Stop accepting new uploads. Allow in-progress jobs to complete (they are idempotent and safe to resume). Do not cancel running jobs.

Record the pause and reason in a batch log:
```
docs/import-logs/corpus-v1-pause-YYYY-MM-DD.md
```

### To resume

Re-check all pre-conditions. In particular, verify the job queue has no stuck jobs before resuming (see administrator-manual.md §5).

---

## 6. Handling Partial Batch Failures

If some containers in a batch fail permanently:

1. Check `failure_reason` for each failed job
2. If the failure is a rights issue, trigger a new rights decision
3. If the failure is a processing error, quarantine the container and notify the administrator
4. Do not re-upload a container that has already been ingested — the duplicate will be flagged
5. Document failures in the batch log

---

## 7. Post-Import Report

After each batch is fully processed, generate a report:

```bash
pnpm --filter @workspace/scripts exec tsx ./src/generate-pilot-report.ts \
  --batch=corpus-v1-batch-001
```

Review the report for:
- Candidate counts per container (do they match expected case counts?)
- Any containers stuck in review states
- Rights restrictions flagged
- Audit event coverage (every container should have audit events)

The report must be reviewed and signed off by the platform owner before the next batch begins.

---

## 8. Final Sign-Off

After all batches are imported and the post-import report is approved:

1. **Update `docs/status/current-phase.json`** to reflect the import completion
2. **File the signed post-import report** in `docs/import-logs/`
3. **Take a final database backup** (see backup-and-restoration.md)
4. **Notify all staff** with researcher, lecturer, and student roles that the corpus is available
