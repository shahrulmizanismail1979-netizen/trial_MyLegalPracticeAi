# Client Document Vault on Every Portal

## What & Why
Lawyers must safekeep client documents (ICs, agreements, court papers, medical reports, letters received). Portals currently upload files only as temporary AI-analysis inputs — nothing is stored against the matter or client permanently. This adds a per-matter/per-client document repository with real uploads to object storage, on all practice portals.

## Done looks like
- Each matter (and client record where clients exist) has a "Documents" tab: upload, list (with date, type, size, uploader), preview/download, rename, delete
- Files live in private object storage with ownership recorded in the database; only the owning subscriber (or master) can access them — presigned upload consumption must be owner-checked in the DB, never in-memory
- Documents can be tagged by category (correspondence, cause papers, evidence, client KYC, billing) and filtered by date
- Works end to end in the browser on every practice portal

## Out of scope
- OCR/AI analysis of stored documents (existing AI tools remain separate)
- Sharing links to third parties

## Steps
1. **Shared document-vault library** — Central module with a documents table (portal, owner, matter/client link, object key, category, dates) and routes for presigned upload, owner-checked confirm, list, download, delete; persist the canonical key returned by storage
2. **Per-portal mounts** — Mount behind each portal's auth with the correct owner mapping (mixed code/email portals scope by owner_type + owner_id)
3. **Portal UI** — Documents tab on matter pages (and client pages where applicable) in all 7 practice portals
4. **End-to-end verification** — Upload/download/delete verified against real object storage per portal; unauthenticated and cross-tenant access must 401/404

## Relevant files
- `artifacts/api-server/src/routes/storage.ts`
- `artifacts/api-server/src/lib/matterFiles.ts`
- `.agents/memory/upload-ownership-registry.md`
- `.agents/memory/storage-adapter-canonical-keys.md`
