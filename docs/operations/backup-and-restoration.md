# Backup and Restoration Guide — Judgment Research Platform

**Audience:** Administrators and owners  
**Last updated:** 2026-07-30

---

## 1. What Data Exists and Where

The platform has two independent data stores. Both must be backed up together; a backup of only one is incomplete.

### 1.1 PostgreSQL Database

Contains all structured data:
- Container metadata, rights records, audit events, transformations
- Extraction runs, page records, text blocks, corrections
- Segmentation runs, candidates, coherence checks, review actions
- Cross-file spans, validated judgments, metadata, search index
- Job queue (research_jobs), user accounts (research_users)

**Location:** Managed by Replit. Connection string in the `DATABASE_URL` environment secret.

### 1.2 Private Object Storage

Contains all original uploaded files and extracted page images:
- `containers/{sha256}` — original uploaded documents (byte-identical to what was submitted)
- `pages/{container_id}/{page_number}.png` — rendered page images for OCR containers
- Any other storage keys recorded in `research_stored_artifacts.storage_key`

**Location:** Replit private object storage bucket. Bucket ID in the `DEFAULT_OBJECT_STORAGE_BUCKET_ID` environment secret.

---

## 2. Backup Procedure

### 2.1 Database Backup

**Trigger a manual backup:**

```bash
# Export the full database
pg_dump "$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --file="research-backup-$(date +%Y%m%d-%H%M%S).dump"
```

**Store the backup file** in a location separate from the production system (e.g. an external object storage bucket, a local encrypted drive). The backup file contains all research data including potentially restricted content — handle it with the same controls as the live system.

**Verify the backup immediately after creation:**

```bash
# Verify the dump is readable
pg_restore --list "research-backup-<timestamp>.dump" | tail -20
echo "Exit code: $?"
```

A non-zero exit code indicates a corrupt or incomplete backup. Re-run the backup.

### 2.2 Object Storage Backup

Replit's object storage does not currently provide automated cross-region replication. Until automated verification is in place (see known-limitations.md), take a manual snapshot:

```bash
# List all objects in the research storage paths
# (use the Replit object storage API or rclone with appropriate credentials)
# This step must be coordinated with the Replit object storage documentation
# for your specific bucket configuration.
```

**Known limitation:** Automated object storage backup verification is not yet implemented. This is a documented risk (see risk-register.md, R-08).

---

## 3. Backup Schedule

Until automated backup is in place, the recommended manual schedule is:

| Trigger | Action |
|---------|--------|
| Before any full-corpus import | Full database backup + verify |
| After completing a significant ingestion batch | Database backup |
| Weekly (minimum) | Database backup |
| Before any schema migration | Database backup + verify |

---

## 4. Restoration Procedure

**Before starting restoration, ensure the API server is stopped to prevent writes during restoration.**

### Step 1 — Stop the API server

From the Replit workspace: stop the `artifacts/api-server: API Server` workflow.

### Step 2 — Restore the database

```bash
# Create a new database or restore into the existing one
# WARNING: This will overwrite the current database contents.
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --verbose \
  "research-backup-<timestamp>.dump"

echo "Restoration exit code: $?"
```

A non-zero exit code indicates failure. Check the error output before proceeding.

### Step 3 — Verify database integrity

```bash
psql "$DATABASE_URL" -c "
  SELECT 
    (SELECT COUNT(*) FROM research_source_containers) AS containers,
    (SELECT COUNT(*) FROM research_jobs) AS jobs,
    (SELECT COUNT(*) FROM research_audit_events) AS audit_events,
    (SELECT COUNT(*) FROM research_rights_records) AS rights_records;
"
```

Compare the counts against the numbers recorded before the incident. Significant discrepancies indicate an incomplete restore.

### Step 4 — Verify object storage consistency

After database restoration, check that the storage keys recorded in the database still resolve in object storage. Any container whose storage key no longer resolves is in a degraded state (metadata present, file absent):

```sql
-- Find containers whose storage keys may be inconsistent
SELECT id, original_name, storage_key, processing_state
FROM research_source_containers
WHERE storage_key IS NOT NULL
  AND processing_state NOT IN ('DELETED', 'DELETION_PENDING')
ORDER BY created_at DESC
LIMIT 50;
```

For each container, verify the storage key exists in the object storage bucket. If a key is missing, quarantine the container:
```
POST /api/research/containers/:id/quarantine
Body: { "reason": "Storage key missing after restoration — integrity check required" }
```

### Step 5 — Restart and verify

1. Restart the `artifacts/api-server: API Server` workflow.
2. Check the health endpoint:
   ```
   GET /api/research/health
   ```
   Should return `{ "db": "ok", "storage": "ok" }`.
3. Verify a known container is accessible and in the expected state.
4. Record the restoration in the audit log manually:
   ```sql
   INSERT INTO research_audit_events 
     (entity_type, entity_id, event, from_state, to_state, actor, detail)
   VALUES 
     ('system', 0, 'DATABASE_RESTORED', 'backup', 'restored', 'administrator@organisation.com',
      '{"backupTimestamp": "2026-07-30T10:00:00Z", "restorationReason": "..."}');
   ```

---

## 5. RTO and RPO Targets

| Metric | Current target | Notes |
|--------|---------------|-------|
| Recovery Time Objective (RTO) | 4 hours | Time from decision to restored system |
| Recovery Point Objective (RPO) | 24 hours | Maximum data loss acceptable |

These targets are aspirational until automated backup and restoration drills are in place.

---

## 6. Known Limitations

- No automated backup verification. Manual verification required after each backup (see step above).
- No automated object storage backup. Object storage is not yet covered by an independent backup procedure.
- No scheduled backup automation. Manual schedule required until automated procedures are implemented.
- Replit's underlying infrastructure provides some database durability guarantees; consult Replit documentation for current SLA details.

For a full list of known limitations, see known-limitations.md.
