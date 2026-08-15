---
name: Portal-accessible Case Law API
description: /api/cases search+detail endpoints — auth pattern, rights gate, rate limit design.
---

# Portal-Accessible Case Law API (`/api/cases`)

## Auth middleware: `requireAnyPortalAuth`
- File: `artifacts/api-server/src/middlewares/requireAnyPortalAuth.ts`
- Checks in priority order:
  1. `x-master-code` header (env MASTER_ACCESS_CODE)
  2. `Authorization: Bearer` — JWT (CCB/Convey, signed with SESSION_SECRET) then Corp opaque (corp_sessions table)
  3. Session cookies: `lit.sid` → lit_sessions, `crim.sid` / `sya.sid` → user_sessions, `acad.sid` → acad_user_sessions, `session_id` → access_code_usage
- Cookie unsigning: implements cookie-signature format inline using Node crypto (no extra dep).
- Sets `req.portalAuth = { type, identityKey }` for downstream rate limiting.

**Why:** Each portal has its own session mechanism; there is no shared session table. The middleware checks each in turn, failing closed (401) if none matches.

## Rights gate
Filter: container `rights_status` IN (`OFFICIAL_COURT_SOURCE`, `PUBLIC_OR_OPEN_LICENCE_SOURCE`, `USER_OWNED_OR_AUTHORISED`) AND `processing_state = 'SEARCHABLE'` AND at least one headnote with `status = 'accepted'`.

**Why:** `PRIVATE_PROCESSING_APPROVED` is internal only (not for display); others are too restricted or unreviewed. Always return 404 (not 403) for cases that fail the gate — don't reveal existence.

## Rate limiting
- 200 case detail reads per identity per calendar day (in-memory Map, resets on restart).
- Master access code is exempt.
- Rate limit only on `GET /api/cases/:id`, not on search.
- Sets `X-RateLimit-Remaining` header on each allowed detail request.

## Routes
- `GET /api/cases/search` — FTS (with `q`) or browse (no `q`); court/dateFrom/dateTo/lang/sort filters; paginated.
- `GET /api/cases/:id` — full case record: metadata, accepted headnotes, accepted catchwords, paragraphs.

## Mount
Mounted at `/api/cases` in `routes/index.ts` behind `requireAnyPortalAuth` — no Clerk required.
