---
name: Research Admin Portal
description: Architecture of the Case Law Research Admin frontend and its API backend
---

## Auth
- Password-gated (ADMIN_PASSWORD env var) via signed cookies
- `cookieParser` must be initialized with a secret (`process.env.SESSION_SECRET`) for `res.cookie(..., { signed: true })` to work — the call in `app.ts` was originally `cookieParser()` (no secret); was updated to `cookieParser(process.env.SESSION_SECRET ?? "dev-cookie-secret")`
- Cookie name: `ra_auth`, set to `"1"`, httpOnly, sameSite lax, 24h maxAge
- Auth routes: `POST /api/research-admin/auth/login`, `POST /api/research-admin/auth/logout`, `GET /api/research-admin/auth/me`

## API mounting
- Mounted at `/api/research-admin/` in `artifacts/api-server/src/routes/index.ts` — **outside** the Clerk-gated `/api/research/` prefix
- No Clerk auth; standalone ADMIN_PASSWORD-only portal
- Route file: `artifacts/api-server/src/routes/research-admin.ts`

## Drive Integration
- Google Drive connector: `google-drive` via ReplitConnectors
- Root folder ID: `1Rm5yiE4DsXEG1mVwbcTL8ehneCCRAtbx`
- Drive client at: `artifacts/api-server/src/research/drive/driveClient.ts`
- Classification logic: `artifacts/api-server/src/research/drive/classify.ts`
- Inventory worker runs async in-process (fire-and-forget from `POST /api/research-admin/drive/inventory/start`)

## DB Schema gotchas
- Drive tables (`drive_inventory_runs`, `drive_assets`) created via direct SQL — NOT drizzle push (rename trap)
- `researchJobs` table has column `state` NOT `status` — use `eq(researchJobs.state, "QUEUED")` etc.
- Drizzle schema in `lib/db/src/schema/research.ts` has the new tables appended but direct SQL is the source of truth for production schema

## Frontend
- Artifact: `artifacts/research-admin` at `/research-admin/`
- Pages: Dashboard, Drive Inventory, Rights Review, Processing Queue, Error Dashboard, Audit Log
- API helpers: `artifacts/research-admin/src/lib/api.ts`
- Dark legal navy/gold theme (light mode default, dark sidebar always)

**Why:** The research routes are behind Clerk staff auth; the admin portal needs a standalone login (like other admin portals) so it can be used without a Clerk account.
