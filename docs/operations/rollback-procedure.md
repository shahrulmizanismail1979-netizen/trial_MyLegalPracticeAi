# Rollback Procedure — Judgment Research Platform

**Audience:** Administrators and developers  
**Last updated:** 2026-07-30

---

## 1. When to Roll Back

Roll back (revert to a previous checkpoint) when:
- A deployment introduces a critical bug that cannot be quickly forward-fixed
- A schema migration causes data corruption that cannot be repaired
- The platform enters a state that is unsafe for continued operation and a forward fix would take more than 2 hours

**Do NOT roll back when:**
- A single job is failing (fix the job or quarantine the container)
- A single user is experiencing an issue (fix the user record or session)
- A non-critical feature is broken but the platform is otherwise healthy (forward-fix is preferred)
- Data has already been modified by the broken version and rolling back would create inconsistency (assess forward-fix first)

---

## 2. Replit Checkpoint Rollback

Replit automatically creates checkpoints when significant changes are made. To revert:

1. Open the Replit workspace
2. Click the Checkpoints icon in the toolbar
3. Find the checkpoint from before the problematic deployment
4. Select **Restore this checkpoint**

**What the checkpoint reverts:**
- All source code files
- The `artifact.toml` configuration
- The `.replit` configuration

**What the checkpoint does NOT revert:**
- The PostgreSQL database (database state is independent of code checkpoints)
- The private object storage contents
- Replit Secrets

After a checkpoint restore, the database schema may be ahead of the code. This must be assessed and handled (see §3).

---

## 3. Database Migration Assessment

### 3.0 Mandatory non-destructive policy

For Task 522 and later work, migrations must be additive and
forward-compatible. New `DROP TABLE`, `DROP COLUMN`, `DROP SCHEMA`, `TRUNCATE`,
bulk `DELETE`, destructive rename/type conversion, reset/reseed, and automatic
production backfill operations are prohibited. Backfills require a separate,
idempotent, dry-run-capable, owner-approved operational procedure after backup
and count verification; they must not run at application boot.

The two column drops in historical migration
`0013-phase07-schema-alignment.sql` predate this policy and are the only pinned
scanner exceptions. See `docs/PRESERVATION_BASELINE.md` for the complete policy
and read-only before/after record-count procedure.

Before restarting the API server after a code rollback, determine whether the database schema is compatible with the restored code.

### 3.1 Check which migrations have been applied

```sql
-- If you have a migrations tracking table:
SELECT * FROM drizzle_migrations ORDER BY created_at DESC LIMIT 10;
```

Or inspect what tables/columns exist compared to what the restored code expects.

### 3.2 Reversible migrations

All research platform migrations are additive (new tables, new columns). An additive migration applied to the database will not break the older code — the older code simply does not know about the new tables/columns. The platform can run safely against a schema that is ahead of the code.

**Additive migrations (safe with older code):**
- Adding new tables
- Adding nullable columns to existing tables
- Adding indexes

### 3.3 Irreversible migrations

The following types of migrations are NOT automatically reversible:

| Migration type | Safe to roll back? | What to do |
|---------------|-------------------|------------|
| Column rename | ❌ No | Rename back with a new migration; do not roll back the code without renaming first |
| Column type change | ❌ No | Assess data loss risk; may require a forward-fix migration |
| Table drop | ❌ No | Cannot recover dropped data without a database backup |
| Data migration (value transformation) | ⚠️ Depends | Check if the original values are still recoverable; may need a reverse migration |
| Unique constraint added | ⚠️ Depends | Safe to roll back code; constraint remains but older code won't enforce it |

For each irreversible migration, check the migration file in `lib/db/sql/migrations/` for the `-- ROLLBACK:` section, if one was documented.

### 3.4 Rolling back a migration (if required)

The migration files in `lib/db/sql/migrations/` include rollback SQL where documented. To apply a rollback:

```bash
psql "$DATABASE_URL" -f lib/db/sql/migrations/XXXX-phase-migration.sql.rollback
```

Only do this with an administrator-approved decision and after taking a database backup.

---

## 4. Step-by-Step Rollback

### Step 1 — Assess whether rollback is appropriate

- Can the problem be forward-fixed within 2 hours?
- Does the problematic code version hold data that would be lost in a rollback?
- Is the platform safe enough to continue operating while a fix is prepared?

If yes to any of these, prefer a forward-fix.

### Step 2 — Take a database backup

Before any rollback, capture the current state:
```bash
pg_dump "$DATABASE_URL" --format=custom \
  --file="pre-rollback-$(date +%Y%m%d-%H%M%S).dump"
```

### Step 3 — Stop the API server

Stop the `artifacts/api-server: API Server` workflow.

### Step 4 — Restore the checkpoint

Use the Replit checkpoint UI to restore the code to the desired state.

### Step 5 — Assess database compatibility

Review which migrations have been applied since the checkpoint. If the database has migrations that the restored code does not know about (additive only), it is safe to proceed. If destructive or incompatible migrations exist, resolve them before proceeding.

### Step 6 — Restart and verify

1. Restart the `artifacts/api-server: API Server` workflow
2. Check health: `GET /api/research/health` → `{ "db": "ok", "storage": "ok" }`
3. Verify a known container is accessible
4. Check the job queue for any stuck jobs created by the problematic version

### Step 7 — Communicate

Notify all platform users that a rollback occurred, what was affected, and approximately when normal service resumed. Do not disclose specific technical details in broad communications.

---

## 5. When Forward-Fix Is Preferred

Forward-fix (fixing the code while keeping the current deployment running) is preferred when:

1. The platform is still functional for most users
2. The problematic change is isolated to a specific feature or job kind
3. A fix can be developed and deployed within 2 hours
4. Rolling back would lose data that was correctly ingested by the problematic version

For a forward-fix:
1. Quarantine affected containers (see administrator-manual.md §4.2)
2. Freeze affected jobs (see administrator-manual.md §5.4)
3. Deploy the fix
4. Unquarantine containers and re-run affected jobs

---

## 6. Post-Rollback Review

After any rollback, write an incident review (see incident-response.md §7) covering:
- Why the rollback was necessary
- Which checkpoint was chosen and why
- Whether any data was lost
- What changes are being made to prevent a repeat
