# Client Letters & Dated Drafts Workspace

## What & Why
Lawyers write letters to clients (fee updates, status reports, requests for documents) and iterate on drafts of cause papers/legal documents over time. Portals can generate some AI documents but there is no letter-writing tool addressed to a client, and drafts are not organised by date/version. This adds an AI-assisted client letter writer and a dated drafts workspace on every practice portal.

## Done looks like
- A "Letters" tool per matter: pick letter type (status update, fee reminder, request for documents, cover letter to court/opponent, etc.), AI drafts it in English or Bahasa Malaysia on the firm's letterhead details, lawyer edits and saves; export as PDF/DOCX
- A "Drafts" workspace per matter: every saved draft (cause papers, letters, agreements, AI outputs) is listed by date with version history — saving again creates a new dated version, older versions remain viewable
- Both work end to end in the browser on all 7 practice portals

## Out of scope
- Emailing letters directly to clients
- Binary uploads (covered by the document vault task)

## Steps
1. **Draft versioning layer** — Extend the shared saved-work storage with versions (parent draft id, version number, created date) and a timeline listing endpoint
2. **Letter generation** — Shared AI letter-writer endpoint (behind auth + the shared AI rate limiter, auth first) with letter-type templates appropriate to each portal's practice area; letterhead details editable per subscriber
3. **Export** — PDF and DOCX export of any draft version
4. **Portal UI** — Letters tool and Drafts timeline on matter pages in all 7 practice portals
5. **End-to-end verification** — Generate, edit, re-save (new version), export, and confirm history displays correctly in the browser

## Relevant files
- `artifacts/api-server/src/lib/matterFiles.ts`
- `artifacts/api-server/src/utils/docxExport.ts`
- `artifacts/api-server/src/sya/routes/document-generator/index.ts`
- `.agents/memory/ai-ratelimit-auth-ordering.md`
