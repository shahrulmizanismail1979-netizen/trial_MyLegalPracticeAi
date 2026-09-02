# AI Case Intelligence Engine — Shared Backend

## What & Why
All 7 portals need AI-powered case management on top of their existing matter tables. This task builds the shared backend layer that every portal UI will call: AI next-steps suggestions, case summary/chronology, risk assessment, auto-generated procedural checklists, case status/stage tracking, billing/time recording, client management, and Google Calendar sync for deadlines. All portal UIs depend on this first.

## Done looks like
- Every portal's matter now has a `status` field with portal-appropriate stages (e.g. Pre-Trial → Trial → Appeal for litigation; Charge → Hearing → Sentencing for criminal; Mal → Syariah Court → Decree for Syariah; Instruction → Completion for conveyancing) — queryable and settable via API.
- `GET /api/*/matters/:id/ai-insights` returns an AI-generated object with: `nextSteps` (ordered action items with deadlines), `caseSummary` (2-3 paragraph chronology derived from filed documents and notes), and `riskAssessment` (strength rating + key weaknesses). Works for all portals (`/api/lit/`, `/api/crim/`, `/api/sya/`, `/api/corp/`, `/api/ccb/`, `/api/convey/`).
- `POST /api/*/matters` auto-generates and saves a procedural checklist when a new matter is created — checklist items are portal and matter-type specific (e.g. for a winding-up matter: statutory demand, petition, sealed order checklist; for a robbery charge: cautioned statement, charge, PKDK, trial preparation).
- `GET /api/*/matters/:id/checklist` and `PATCH /api/*/matters/:id/checklist/:itemId` (mark done/undone) work for all portals.
- Client management: `GET/POST /api/*/clients` and `PATCH /api/*/matters/:id` can accept a `clientId` linking a matter to a client record (name, IC/company no, contact). Client tables follow the existing `lit_clients` pattern.
- Billing/time recording: `GET/POST /api/*/matters/:id/time-entries` stores time entries (description, minutes, rate, date) and returns running total. Tables per portal follow a consistent schema.
- Google Calendar: `POST /api/calendar/sync-matter` accepts a matter ID and portal, reads its deadlines, and creates/updates Google Calendar events using the Google OAuth connector. `GET /api/calendar/auth-url` and `GET /api/calendar/callback` handle the OAuth flow.

## Out of scope
- Portal frontend UI changes (handled by the three parallel UI tasks)
- Invoicing / PDF billing statements
- Google Drive document sync (calendar only for now)
- WhatsApp/SMS reminders

## Steps
1. **Case status schema** — Add a `status` text column and `stage_history` JSONB column to every portal's matter table (lit_matters, crim_matters, sya_matters, corp_matters, ccb_matters, convey_matters) via direct SQL boot-ensures (not drizzle push). Define permitted stage arrays per portal in a shared config.
2. **Status API routes** — Add `PATCH /api/*/matters/:id/status` to each portal's matter router; validate against the portal's allowed stages and append to history; ownership-scoped.
3. **Checklist schema and boot** — Create per-portal checklist tables (`lit_matter_checklists`, `crim_matter_checklists`, etc.) via direct SQL with columns: matter_id, item_text, done, position, created_at. Auto-generate on matter creation using a per-portal, per-matterType prompt to the Gemini/OpenAI integration.
4. **Checklist routes** — Add GET (full list), PATCH (toggle done), POST (add custom item) routes for each portal, ownership-scoped.
5. **AI case insights endpoint** — Create a shared `buildCaseInsights(portal, matterId, accessCodeId)` function that fetches the matter's notes, filed documents (first 800 chars each), deadlines, and status history, then calls Gemini with a structured prompt to return `nextSteps`, `caseSummary`, and `riskAssessment`. Cache result in a `case_ai_insights` table (per-portal) with a 6-hour TTL; invalidate on new document filing. Expose as `GET /api/*/matters/:id/ai-insights`.
6. **Client management** — Create per-portal client tables (`crim_clients`, `sya_clients`, etc.) mirroring `lit_clients` (name, ic_number, company_name, email, phone, access_code_id). Wire `GET/POST /api/*/clients` and `PATCH /api/*/matters/:id` to accept `clientId`.
7. **Billing/time recording** — Create per-portal time-entry tables (`lit_time_entries`, `crim_time_entries`, etc.) with columns: matter_id, description, minutes, rate_usd, date, access_code_id. Wire `GET/POST /api/*/matters/:id/time-entries`.
8. **Google Calendar integration** — Use the Replit Google OAuth connector to request `calendar.events` scope. Store user tokens in a `google_tokens` table keyed to access_code_id. Implement sync: for each deadline in the matter, upsert a Calendar event (title = deadline label, start = deadline date, description = matter file ref + portal link). Handle token refresh.

## Relevant files
- `lib/db/src/schema/lit-matters.ts`
- `lib/db/src/schema/lit-clients.ts`
- `artifacts/api-server/src/lit/routes/matters.ts`
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/index.ts`
- `.local/skills/ai-integrations-gemini/SKILL.md`
- `.local/skills/integrations/SKILL.md`
- `.agents/memory/drizzle-push-rename-trap.md`
- `.agents/memory/portal-matter-files.md`
