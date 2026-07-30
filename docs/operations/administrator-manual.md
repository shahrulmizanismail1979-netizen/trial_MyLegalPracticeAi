# Administrator Manual — Judgment Research Platform

**Audience:** Platform administrators and owners  
**Roles required:** `administrator` or `owner`  
**Last updated:** 2026-07-30

---

## 1. Platform Overview

The Judgment Research Platform is a private, staff-only system for ingesting legal judgment documents and building a curated research corpus. It is mounted at `/api/research` on the shared API server and is accessible only to authenticated staff who hold a research platform role.

The platform processes documents through a controlled pipeline:

```
Upload → Rights Review → Extraction → Segmentation → Human Review →
Editorial Review → Verification → Search Indexing
```

Each stage is gated by rights status and role permissions. No document ever moves forward automatically if there is uncertainty — uncertain results are routed to human review.

---

## 2. Role Model

The platform has 8 roles. Assign the minimum role needed.

| Role | What they can do |
|------|-----------------|
| `owner` | Everything, including all admin actions. Capped by rights status. |
| `administrator` | All operational actions. Cannot override restrictive rights statuses. |
| `rights_reviewer` | Decide rights statuses. See UNREVIEWED and quarantined content. |
| `legal_reviewer` | Review MANUAL_LEGAL_REVIEW_REQUIRED containers. |
| `researcher` | View, search, analyse, print rights-approved content. |
| `lecturer` | View, search, print rights-approved content. |
| `student` | View and search where the rights record explicitly permits student access. |
| `guest` | Read-only access to unrestricted content only. Default for authenticated staff with no row in research_users. |

An authenticated staff member with **no row in `research_users`** is treated as `guest`. They can see the platform but cannot upload, review, or access restricted content.

### 2.1 Adding a User

```sql
INSERT INTO research_users (email, display_name, role)
VALUES ('name@organisation.com', 'Full Name', 'researcher')
ON CONFLICT (email) DO NOTHING;
```

Verify immediately:
```
GET /api/research/me
```
(with the user's session cookie) — should return their resolved role.

### 2.2 Changing a Role

```sql
UPDATE research_users
SET role = 'rights_reviewer', updated_at = NOW()
WHERE email = 'name@organisation.com';
```

Role changes take effect on the next request (no session restart needed — role is resolved per-request from the database).

### 2.3 Revoking Access

Do not delete the row (audit trail preservation). Instead, set the role to `guest`:
```sql
UPDATE research_users
SET role = 'guest', updated_at = NOW()
WHERE email = 'name@organisation.com';
```

For immediate session invalidation, revoke the user's Clerk session from the Clerk dashboard.

---

## 3. System Health Check

### 3.1 Health Endpoint

```
GET /api/research/health
```

Returns the current phase, adapter statuses, and a database connectivity check. A healthy response looks like:
```json
{ "phase": "14", "db": "ok", "storage": "ok" }
```

If `"db"` is not `"ok"`, the API server cannot reach the database. Check the `DATABASE_URL` secret and PostgreSQL status.

### 3.2 Job Queue Status

Check for stuck or permanently-failed jobs:

```sql
SELECT kind, state, COUNT(*) 
FROM research_jobs 
GROUP BY kind, state 
ORDER BY kind, state;
```

Expected: most jobs in `SUCCEEDED`. `QUEUED` jobs are waiting for a worker to pick them up. `RUNNING` jobs older than 10 minutes may be stuck — see §5 (Intervening in the Job Queue).

### 3.3 Container State Dashboard

```sql
SELECT processing_state, COUNT(*) 
FROM research_source_containers 
WHERE processing_state != 'DELETED'
GROUP BY processing_state 
ORDER BY processing_state;
```

Containers accumulating in `*_REVIEW_REQUIRED` states need human attention. See §4 for intervention steps.

---

## 4. Container State Management

### 4.1 Container Processing States (Quick Reference)

| State | Meaning | Who acts next |
|-------|---------|---------------|
| UPLOADED | Registered, awaiting rights review | Rights reviewer |
| RIGHTS_REVIEW_REQUIRED | Awaiting rights decision | Rights reviewer |
| RIGHTS_APPROVED | Cleared for processing | System (auto) |
| INVENTORY_PENDING / INVENTORIED | Page census | System (auto) |
| EXTRACTION_PENDING | Text extraction queued | System (auto) |
| TEXT_EXTRACTED | Extraction complete | System (auto) |
| OCR_REVIEW_REQUIRED | Low OCR quality | Extraction reviewer |
| SEGMENTATION_PENDING / PROPOSED | Segmentation queued/done | System (auto) |
| SEGMENTATION_REVIEW_REQUIRED | Boundaries uncertain | Segmentation reviewer |
| EDITORIAL_REVIEW_PENDING / REQUIRED | Editorial screening | System / reviewer |
| JUDGMENT_VERIFICATION_PENDING | Awaiting human verification | Legal reviewer |
| VERIFIED | Judicial text verified | — |
| SEARCHABLE | In search index | — |
| QUARANTINED | Frozen; rights or integrity problem | Rights reviewer |
| PROCESSING_BLOCKED | Halted; needs admin action | Administrator |
| DELETION_PENDING | Awaiting deletion | System (auto) / Admin |
| DELETED | Terminal | — |

### 4.2 Emergency Quarantine

To immediately freeze a container (e.g. suspected sensitive content, copyright concern):

```
POST /api/research/containers/:id/quarantine
Authorization: (staff session)
Body: { "reason": "Suspected restricted content — pending legal review" }
```

This transitions the container to `QUARANTINED` from any live state, excluding it from all processing, search, and access by non-rights roles. An audit event is written.

### 4.3 Unblocking a PROCESSING_BLOCKED Container

A `PROCESSING_BLOCKED` container was halted by an administrator or a critical system error. To resume it, transition it to the appropriate re-entry state:

```
POST /api/research/containers/:id/transition
Body: { "to": "EXTRACTION_PENDING", "reason": "Unblocked after system maintenance" }
```

Valid re-entry points: `RIGHTS_REVIEW_REQUIRED`, `INVENTORY_PENDING`, `EXTRACTION_PENDING`, `SEGMENTATION_PENDING`, `EDITORIAL_REVIEW_PENDING`, `JUDGMENT_VERIFICATION_PENDING`.

---

## 5. Job Queue Monitoring and Intervention

### 5.1 Finding Stuck Jobs

```sql
SELECT id, kind, state, attempts, max_attempts, created_at, started_at
FROM research_jobs
WHERE state = 'RUNNING'
  AND started_at < NOW() - INTERVAL '10 minutes'
ORDER BY started_at;
```

A job stuck in `RUNNING` for more than 10 minutes indicates the worker process died mid-job.

### 5.2 Resetting a Stuck Job

A job that is `RUNNING` but has no active worker can be reset to `QUEUED` for re-processing:

```sql
UPDATE research_jobs
SET state = 'QUEUED', claimed_at = NULL, started_at = NULL
WHERE id = <job_id> AND state = 'RUNNING';
```

Only do this after confirming the worker is not running. Check the API server logs first.

### 5.3 Permanently-Failed Jobs

```sql
SELECT id, kind, failure_reason, container_id_from_payload
FROM research_jobs
WHERE state = 'FAILED_PERMANENT'
ORDER BY updated_at DESC
LIMIT 20;
```

(Replace `container_id_from_payload` with: `(payload->>'containerId')::int AS container_id`)

For each permanently-failed job, check `failure_reason` (structured JSON with `code`, `message`, `detail`). Common codes:
- `BLOCKED_BY_RIGHTS` — container's rights status forbids processing; trigger a rights review.
- `CHECKSUM_MISMATCH` — stored file does not match registered checksum; quarantine the container.
- `NO_PROCESSOR` — no processor registered for this job kind; a deployment issue.

### 5.4 Freezing the Job Queue (Emergency)

To stop all new job processing (e.g. during an incident):

```sql
UPDATE research_jobs
SET state = 'FAILED_PERMANENT', failure_reason = '{"code":"ADMIN_FREEZE","message":"Queue frozen by administrator"}'
WHERE state = 'QUEUED';
```

**WARNING:** This is irreversible for the affected jobs. Prefer `PROCESSING_BLOCKED` on individual containers when possible.

---

## 6. Session Revocation

To revoke a specific staff member's active session immediately:

1. Go to the Clerk dashboard → Users → find the user → Revoke all sessions.
2. Optionally set their research platform role to `guest` (see §2.3).

The research platform re-resolves role from the database on every request, so a role downgrade takes effect immediately for new requests.

---

## 7. Audit Log Access

All critical events are in `research_audit_events`:

```sql
SELECT entity_type, entity_id, event, from_state, to_state, actor, created_at
FROM research_audit_events
WHERE entity_type = 'container' AND entity_id = <container_id>
ORDER BY created_at;
```

Audit events are append-only and write in the same transaction as the change they record. They cannot be amended through the application.

---

## 8. Escalation

| Situation | Action |
|-----------|--------|
| Suspected data breach | Follow incident-response.md immediately |
| Container with suspicious content | Emergency quarantine (§4.2), then notify legal reviewer |
| Database unreachable | Check API server logs; contact Replit support if infrastructure |
| Job queue not processing | Check API server workflow status; restart if needed |
| User access dispute | Document in audit log; escalate to owner |
