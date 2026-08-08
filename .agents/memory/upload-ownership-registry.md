---
name: Upload ownership registry must be DB-backed
description: Presigned-upload ownership binding must persist in the DB, not process memory
---

Binding an issued upload objectPath to the requesting subscriber (one-time, owner-checked extraction) must be stored in a DB table (e.g. `lit_pending_uploads`) and consumed atomically via owner-checked `DELETE ... RETURNING`.

**Why:** completion code review rejects in-process `Map` registries: ownership breaks across instances/restarts (owner gets "invalid or expired"). Corp's legal uploads still use the in-memory Map — port the DB pattern when touched.

**How to apply:** register on `/upload-url`, consume atomically in `/extract-stored` before download/delete; failed ownership must NOT delete the object. Also ship a numbered SQL migration in `lib/db/sql/migrations/` AND an idempotent boot-time `CREATE TABLE IF NOT EXISTS` (no automatic migration runner exists). Tests: owner extract, cross-subscriber block (object survives), one-time replay, DB-forced expiry. Lit login uppercases codes — test access codes must be uppercase.
