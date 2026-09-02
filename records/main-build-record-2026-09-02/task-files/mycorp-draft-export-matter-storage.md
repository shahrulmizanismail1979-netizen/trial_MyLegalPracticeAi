# Export and save every draft

## What & Why
Make every MyCorpLegalAI-generated work product easy to export in several useful formats and easy to file into the exact matter selected by the user. Store large draft bodies in private object storage while keeping searchable metadata and ownership links in the database, so saving and reopening drafts remains fast and reliable as the document library grows.

## Done looks like
- Every completed AI result, including the shared AI Drafter panel and specialist tool pages, exposes Copy, TXT, Markdown, Word, and PDF export actions.
- Users can choose an existing matter or create a new matter from any completed draft, see upload/save progress, and receive a clear success state with a link back to that matter.
- A saved draft appears in the selected matter's Documents/Work area and can be reopened or downloaded without exposing another user's files.
- Large drafts do not travel through PostgreSQL as the primary blob; private object storage holds the document body and the database holds ownership, matter, filename, format, size, and storage status metadata.
- Storage failures, expired upload grants, retries, and interrupted saves show actionable messages and never report success prematurely.
- Matter lists, saved-work lists, and document downloads remain owner-scoped and do not regress existing access-code isolation.

## Out of scope
- Collaborative simultaneous editing or version-diff workflows.
- Changing the AI drafting prompts or legal-content policy.
- Public or unauthenticated document URLs.
- Replacing the existing matter model or migrating unrelated portals.

## Steps
1. **Unify export actions** -- Ensure all completed draft surfaces use the shared export controls and preserve clean formatting for Word/PDF output, including tables and long documents.
2. **Add save-to-matter everywhere** -- Add the matter picker/create flow to the shared AI Drafter panel and keep the specialist page flow aligned, with save disabled until a terminally complete response exists.
3. **Move draft bodies to private storage** -- Add an owner-checked, database-backed upload/consume flow for generated draft content, store canonical object paths and metadata, and keep a bounded preview only where list responses need one.
4. **Serve saved drafts safely** -- Add owner- and matter-checked reopen/download behavior, clean up stored objects when a saved work item is deleted, and preserve existing soft-link and matter ownership rules.
5. **Make saves resilient** -- Add progress, retry-safe state handling, bounded client memory use, and explicit failure states so slow storage or a dropped connection cannot create duplicate or misleading records.
6. **Verify the full user flow** -- Cover export buttons, save-to-new/existing-matter, reopen/download, cross-owner denial, large content handling, interrupted upload, and browser behavior for both shared and specialist drafting surfaces.

## Relevant files
- `lib/draft-export/src/index.ts`
- `lib/draft-export/src/react.tsx`
- `artifacts/mycorplegalai/src/pages/ToolDetailPage.tsx`
- `artifacts/mycorplegalai/src/components/ai-tools/AiToolsPanel.tsx`
- `artifacts/mycorplegalai/src/components/SaveToMatterPanel.tsx`
- `artifacts/mycorplegalai/src/components/MatterPicker.tsx`
- `artifacts/mycorplegalai/src/hooks/use-saved-work.ts`
- `artifacts/mycorplegalai/src/pages/MatterDetailPage.tsx`
- `artifacts/api-server/src/lib/matterFiles.ts`
- `artifacts/api-server/src/lib/caseDocuments.ts`
- `artifacts/api-server/src/lib/objectStorage.ts`
- `lib/db/src/schema/matter-files.ts`