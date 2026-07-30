# Incident-Response Guide — Judgment Research Platform

**Audience:** All administrators and owners  
**Last updated:** 2026-07-30

---

## 1. Severity Classification

| Severity | Description | Examples | Response time |
|----------|-------------|---------|--------------|
| **P1 — Data exposure** | Restricted content may have been accessed by unauthorised parties, or may have been transmitted to an external service | Confirmed or suspected breach; external AI submission of restricted content; public exposure of UNREVIEWED content | Immediate — within 15 minutes |
| **P2 — Processing error** | Platform processes data incorrectly, silently loses data, or enters an unrecoverable state | Job queue halted; database inconsistency; mass processing failure; segmentation producing systematically wrong results | Within 2 hours |
| **P3 — Operational issue** | Platform degraded but data is safe | Slow performance; UI errors; individual job failures; authentication issues for one user | Within 1 business day |

---

## 2. Immediate Actions by Severity

### P1 — Data Exposure

**First 15 minutes:**

1. **Stop new writes** — Freeze the job queue immediately:
   ```sql
   UPDATE research_jobs
   SET state = 'FAILED_PERMANENT',
       failure_reason = '{"code":"INCIDENT_FREEZE","message":"P1 incident — queue frozen"}'
   WHERE state = 'QUEUED';
   ```

2. **Stop the API server** — Prevent further access while the scope is assessed:
   In the Replit workspace, stop the `artifacts/api-server: API Server` workflow.

3. **Preserve evidence** — Do NOT modify any data before capturing the state:
   ```bash
   # Capture current audit log tail
   psql "$DATABASE_URL" -c "
     SELECT * FROM research_audit_events 
     ORDER BY created_at DESC LIMIT 200;
   " > /tmp/audit-snapshot-$(date +%Y%m%d-%H%M%S).txt
   
   # Capture job queue state
   psql "$DATABASE_URL" -c "
     SELECT * FROM research_jobs 
     WHERE updated_at > NOW() - INTERVAL '24 hours'
     ORDER BY updated_at DESC;
   " > /tmp/jobs-snapshot-$(date +%Y%m%d-%H%M%S).txt
   ```

4. **Notify the platform owner immediately** — Phone or direct message; do not use email alone.

5. **Assess the scope** — Determine:
   - Which containers may have been exposed
   - Which users were involved
   - Whether external systems (AI providers, external storage) received any content
   - The time window of the exposure

6. **Quarantine affected containers:**
   ```
   POST /api/research/containers/:id/quarantine
   Body: { "reason": "P1 incident — under investigation" }
   ```

7. **Revoke sessions** for any user accounts involved in the incident (via Clerk dashboard).

**Within 2 hours:**
- Resume the API server only after root cause is identified and mitigated
- Prepare a written incident summary for the platform owner

### P2 — Processing Error

1. **Assess scope** — Are any containers at risk of data loss or corruption?
2. **Quarantine affected containers** if data integrity is uncertain
3. **Freeze the job queue** if the error is systematic (not isolated to one job)
4. **Check the audit log** to understand what state transitions have occurred
5. **Notify the platform owner** with a written summary
6. **Do not attempt to fix data manually** without administrator approval and documented rationale

### P3 — Operational Issue

1. Check API server logs (RefreshAllLogs)
2. Check the health endpoint
3. Identify the affected component (database, object storage, authentication, specific processor)
4. Restart affected workflows if appropriate
5. If the issue persists, escalate to P2

---

## 3. Evidence Preservation

Never delete, modify, or overwrite data during an active incident. Specifically:

- **Do not** run `UPDATE` or `DELETE` on `research_audit_events`, `research_transformations`, or `research_rights_records`
- **Do not** restart the database during an active investigation without taking a snapshot first
- **Do not** clear API server logs

Take snapshots:
```bash
# Full database snapshot
pg_dump "$DATABASE_URL" --format=custom \
  --file="incident-snapshot-$(date +%Y%m%d-%H%M%S).dump"

# API server logs
# Copy from the Replit log viewer or workflow stdout files
```

---

## 4. Quarantine Procedure (Any Severity)

To immediately freeze a container from all access and processing:

```
POST /api/research/containers/:id/quarantine
Authorization: (administrator or owner session)
Body: { "reason": "<incident description and reference>" }
```

The container is immediately:
- Excluded from all job processing
- Excluded from search results
- Excluded from display for non-rights roles
- Audited (a quarantine event is written)

A quarantined container can only be unquarantined by a rights reviewer or administrator after the incident is resolved.

---

## 5. Freezing the Job Queue

For systematic issues, stop all job processing without stopping the API server:

```sql
-- Mark all queued jobs as permanently failed (requires immediate admin notation)
UPDATE research_jobs
SET state = 'FAILED_PERMANENT',
    failure_reason = '{"code":"ADMIN_FREEZE","message":"Incident freeze — <date> <name>"}'
WHERE state = 'QUEUED';
```

To resume processing after the incident is resolved, re-enqueue failed jobs manually or wait for operators to re-trigger the relevant containers through the UI.

---

## 6. Communication Chain

| Severity | Notify | Method |
|----------|--------|--------|
| P1 | Platform owner + all administrators | Immediate phone/direct message |
| P1 (data breach) | Platform owner + legal counsel | Immediate; may require regulatory notification |
| P2 | Platform owner | Written summary within 2 hours |
| P3 | Platform owner | Written summary within 1 business day |

Do not communicate about a data breach via unsecured channels (public Slack, open email threads) until scope is assessed.

---

## 7. Post-Incident Review

After every P1 or P2 incident, a written post-incident review must be completed within 5 working days. The review must cover:

1. **Timeline** — what happened, when, and in what order
2. **Root cause** — the underlying technical or process failure
3. **Scope** — which data was affected and who was impacted
4. **Mitigation** — what was done to contain the incident
5. **Remediation** — what changes are being made to prevent recurrence
6. **Known limitations** — update known-limitations.md if this reveals a new limitation

The review is stored in `docs/incidents/YYYY-MM-DD-description.md` and referenced in the risk register.
