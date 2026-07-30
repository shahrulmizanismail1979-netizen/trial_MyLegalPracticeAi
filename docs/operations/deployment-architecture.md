# Deployment Architecture — Judgment Research Platform

**Last updated:** 2026-07-30  
**Audience:** Administrators, developers

---

## 1. Production Topology

The Judgment Research Platform is deployed as part of a pnpm monorepo on Replit. It shares infrastructure with the eight legal portal applications.

```
Internet
    │
    ▼
Replit Proxy (TLS termination, mTLS to containers)
    │
    ├──► /mylitai/            → MyLitAI web app (artifacts/mylitai)
    ├──► /mylitai-irac/       → MyLitAI IRAC (artifacts/mylitai-irac)
    ├──► /mysyariahai/        → MySyalitAI (artifacts/mysyariahai)
    ├──► /mycorplegalai/      → MyCorpLegalAI (artifacts/mycorplegalai)
    ├──► /myconveylitai/      → MyConveyLitAI (artifacts/myconveylitai)
    ├──► /mycrimai/           → MyCrimAI (artifacts/mycrimai)
    ├──► /myccblitai/         → MyCCBLitAI (artifacts/myccblitai)
    ├──► /myaccidentai/       → MyAccidentAI (artifacts/myaccidentai)
    ├──► /mylawfirmai/        → MyLawFirmAI (artifacts/mylawfirmai)
    ├──► /mylawacad/          → MyLawAcad (artifacts/mylawacad)
    └──► /                    → API Server  (artifacts/api-server)
             │
             ├── /api/research/*   ← Research platform (staff only)
             ├── /api/*            ← Portal APIs (subscriber auth)
             │
             ├──► PostgreSQL (managed Replit database)
             └──► Private Object Storage (managed Replit bucket)
```

---

## 2. Components

### 2.1 API Server (`artifacts/api-server`)

- **Runtime:** Node.js / Express
- **Port:** Bound to `$PORT` environment variable (assigned by Replit)
- **Research module:** Mounted at `/api/research` behind `requireAuth + requireStaff` middleware
- **Authentication:** Clerk session cookies + staff allowlist (portal subscribers cannot reach `/api/research`)
- **Database access:** All database queries via Drizzle ORM; no direct database access from browsers or portal frontends

### 2.2 PostgreSQL Database

- **Provider:** Replit managed PostgreSQL
- **Connection:** Via `DATABASE_URL` environment secret
- **Schema:** All research tables prefixed `research_`; shared with portal tables
- **Access:** API server only; no direct external access
- **Migrations:** Applied additively via psql scripts in `lib/db/sql/migrations/`

### 2.3 Private Object Storage

- **Provider:** Replit private object storage
- **Bucket:** Identified by `DEFAULT_OBJECT_STORAGE_BUCKET_ID` environment secret
- **Access policy:** Private (no public ACLs); all access mediated by the API server with authentication and rights checks
- **Contents:** Original uploaded documents, rendered page images
- **Key structure:**
  - Original files: keys recorded in `research_source_containers.storage_key`
  - Page images: keys recorded in `research_page_extractions.image_storage_key`
  - All artifact keys: recorded in `research_stored_artifacts.storage_key`

### 2.4 Clerk Authentication

- **Provider:** Replit-managed Clerk tenant
- **Used by:** All portal applications and the API server
- **Research platform:** Staff members must be on the staff allowlist AND have a row in `research_users` with an appropriate role
- **Configuration:** `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` environment secrets

---

## 3. Secret Management

All secrets are stored in Replit Secrets (environment variables). The research platform uses:

| Secret | Purpose |
|--------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Private object storage bucket |
| `CLERK_SECRET_KEY` | Clerk backend authentication |
| `CLERK_PUBLISHABLE_KEY` | Clerk frontend key |
| `SESSION_SECRET` | Express session signing |
| `MASTER_ACCESS_CODE` | One-code override for all portals (research platform uses its own role model) |

**No secrets are in code, fixtures, docs, or source control.** Rotation of any secret requires updating the Replit Secret and restarting the affected workflow.

---

## 4. Network Boundaries

- **Research platform → external internet:** No outbound calls in standard operation. AI adapter disabled. OCR uses local tesseract (no external API). Storage uses Replit's internal object storage.
- **Browsers → research platform:** Via Replit proxy (TLS). No direct browser-to-database access. No public URLs into research data.
- **Research platform → external AI:** Structurally blocked (`isEnabled() = false`). Enabling requires an explicit ADR and configuration change.

---

## 5. Monorepo Artifact Routing

Each artifact is registered in `artifact.toml` and mapped to a path prefix:

| Artifact | Preview path | Description |
|----------|-------------|-------------|
| `artifacts/api-server` | `/` (root) | Shared API + research module |
| `artifacts/mylitai` | `/mylitai/` | MyLitAI web portal |
| `artifacts/mylitai-irac` | `/mylitai-irac/` | MyLitAI IRAC portal |
| … | … | … |

Workflows for each artifact are managed by Replit. The `artifacts/api-server: API Server` workflow runs the shared Express server.

---

## 6. Scaling Constraints

| Constraint | Current state |
|-----------|--------------|
| Job workers | Single-process (inline with API server); no background worker process |
| Concurrent uploads | Up to 25 files per request; multer in-memory with 50 MB limit |
| Database connections | Drizzle pool; shared with portal APIs |
| Object storage | No hard limit documented; subject to Replit plan limits |
| Horizontal scaling | Not currently configured; job queue designed to support future external queue replacement |

The job queue uses `FOR UPDATE SKIP LOCKED` which supports multiple workers, but no parallel worker configuration is currently deployed.

---

## 7. Health Check

```
GET /api/research/health
```

Returns:
```json
{
  "phase": "14",
  "db": "ok",
  "storage": "ok"
}
```

Check this endpoint after any deployment, restart, or incident recovery to confirm the API server can reach both data stores.

---

## 8. Verifying a Deployment

After deploying or restarting:

1. **Health endpoint:** `GET /api/research/health` → `{ "db": "ok", "storage": "ok" }`
2. **Authentication gate:** Unauthenticated request to `GET /api/research/containers` → `401 Unauthorized`
3. **Container count:** Authenticated staff request → should return the expected number of containers
4. **Recent audit event:** `SELECT MAX(created_at) FROM research_audit_events` → should be within expected range

If any check fails, consult the API server workflow logs and the incident-response guide.
