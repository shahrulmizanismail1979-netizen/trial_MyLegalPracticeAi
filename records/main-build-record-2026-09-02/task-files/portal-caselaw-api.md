# Portal-Accessible Case Law Search API

## What & Why
The existing research search API (`/api/research/search`, `/api/research/judgments`) is staff-only (requires Clerk staff auth). Portal subscribers — lawyers using MyLitAI, MyCrimAI, MySyariahAI, etc. — cannot access it. This task exposes a subscriber-facing case law API that all portals can call using their existing access-code/JWT auth, returning cases with headnotes, catchwords, and full metadata, but only for rights-approved and headnote-accepted judgments.

## Done looks like
- `GET /api/cases/search?q=...&court=...&dateFrom=...&dateTo=...&limit=20&offset=0` returns a list of cases with: citation, case name, court, date, parties, catchwords, headnotes (numbered), and a snippet from the judgment text
- `GET /api/cases/:id` returns the full case record: all metadata, all accepted headnotes, all catchwords, and the full judgment text paragraphs
- All portal auth methods work (access-code session, CCB JWT, master access code) — any authenticated portal subscriber can call these endpoints
- Only rights-approved (`rights_status = APPROVED`) cases with at least one accepted headnote are returned
- Results are paginated and sortable by date/relevance

## Out of scope
- Staff review or editing of headnotes from this API (stays in Research Admin)
- Uploading or submitting new cases (staff/Drive pipeline only)
- Per-portal content filtering (all portals see all approved cases)

## Steps
1. **Auth middleware** — Write a `requireAnyPortalAuth` middleware that accepts any of the existing portal session types (lit session cookie, crim session cookie, sya session cookie, acad session cookie, CCB JWT bearer, convey session, corp bearer, accident session) and passes if any validates. This is the shared gate for the new endpoints.
2. **Search endpoint** — Implement `GET /api/cases/search` joining `research_search_index`, `research_verified_judgments`, `research_case_metadata`, `research_headnotes`, and `research_catchwords`. Filter to approved + accepted-headnotes. Support full-text `q`, `court`, `dateFrom`, `dateTo`, `limit`, `offset`. Return a normalised DTO.
3. **Case detail endpoint** — Implement `GET /api/cases/:id` returning full case record: all accepted headnotes (ordered by number), all catchwords, all metadata fields, and the judgment paragraphs from `research_verified_judgments`.
4. **Mount** — Register the new cases router at `/api/cases` in `artifacts/api-server/src/routes/index.ts` behind `requireAnyPortalAuth` (no Clerk required).
5. **Rate limit** — Apply the existing AI rate-limit pattern (or a simple per-access-code counter) to prevent bulk scraping: max 200 case reads per access code per day.

## Relevant files
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/research/routes/search.ts`
- `artifacts/api-server/src/research/routes/viewer.ts`
- `lib/db/src/schema/research.ts`
- `artifacts/api-server/src/routes/research-admin.ts`
