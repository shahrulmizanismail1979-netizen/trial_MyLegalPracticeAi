---
name: Legacy MyConveyAI user import
description: How legacy user accounts are migrated into the users table, and why the production import must go through the deployed admin endpoint.
---

## Idempotent import, fill-only passwords
Legacy accounts are imported by matching on access code / username / email; existing accounts are skipped, never updated — with one exception: a missing password hash may be filled in from a follow-up export, but an existing hash is never overwritten.
**Why:** the old project's export tool omitted password_hash on the first pass, so imports arrive in two waves (profile data, then hashes). Students log in with BOTH access codes and email+password, so hashes must be preserved byte-for-byte.
**How to apply:** rerunning any import is always safe; use the fill-only rule for any future credential backfill.

## Production import path
The production database is read-only from the workspace, so the prod import runs through the deployed app's admin endpoint (`POST /api/convey-admin/import-users`, auth via `x-admin-token: ADMIN_PASSWORD`). The one-command pusher (`push-convey-users-to-prod` in `@workspace/scripts`) by default reads the fully-migrated accounts from the DEV database and POSTs them to the live URL (CSV mode also exists). The endpoint only exists in prod after the app is republished.
**Why:** direct DB writes to prod are blocked; the endpoint reuses the exact rules verified in dev.

## Never commit user exports to the repo
Raw production export CSVs (emails, access codes, bcrypt hashes) must NOT live in the repository — code review blocks it. The exports used for the migration were deleted after import; the dev DB is the source of truth for the prod push.
**Why:** committed PII/credential artifacts are a persistent exposure risk even after deletion (history).
**How to apply:** if a future export is needed, process it from a temp path outside the repo and delete it immediately after import.

## Deliberate exclusions
The old admin login and the old project's hardcoded master access code are NOT imported — the new project has its own ADMIN_PASSWORD / MASTER_ACCESS_CODE secrets. Stripe customer/subscription IDs are dropped (old Stripe account).
